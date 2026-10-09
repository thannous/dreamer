// Tests of scripts/verify-local.mjs, the engine of the common delivery rule.
// Identical in the five repositories. Run: node --test scripts/test-verify-local.mjs

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  PROOF_FORMAT_VERSION,
  checkFingerprint,
  checkReleaseProof,
  cleanGitEnv,
  globToRegExp,
  prePush,
  readBlobs,
  proofBlock,
  readProof,
  verify,
} from './verify-local.mjs';

const ENGINE = fileURLToPath(new URL('./verify-local.mjs', import.meta.url));
// sha256 of the engine shared by the five repositories. An edit to
// scripts/verify-local.mjs in one repository alone fails here: change the
// engine in all five at once, then update this value in all five.
const ENGINE_SHA256 = '696cff84902798b6d9042b4d9a4db48220ca387c221d90a8f77233c7824bbf52';
const scratch = mkdtempSync(path.join(os.tmpdir(), 'verify-local-test-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

const CONFIG = `export default {
  mainBranch: 'main',
  commands: { pr: 'npm run verify:pr', release: 'npm run verify:release' },
  deps: { mode: 'link', lockfile: 'package-lock.json', install: 'echo install >> "$RUN_LOG" && mkdir -p node_modules' },
  checks: [
    { name: 'lint', command: 'echo lint >> "$RUN_LOG"', inputs: ['src/**'] },
    { name: 'test', command: 'echo test >> "$RUN_LOG" && grep -q ok src/a.js && test -z "$GIT_DIR"' },
    { name: 'db', command: 'echo db >> "$RUN_LOG"', when: ['db/'], specialised: true, requires: { command: 'test -n "$DB_AVAILABLE"', hint: 'start the database' } },
    { name: 'site', command: 'echo site-check >> "$RUN_LOG"', when: ['site/'], releaseAlways: true },
    { name: 'build', command: 'echo build:$VERIFY_LOCAL_SHA >> "$RUN_LOG" && test -z "$FAIL_BUILD"', kinds: ['release'], perCommit: true },
    { name: 'bundle', command: 'echo bundle >> "$RUN_LOG" && test ! -e node_modules/ext', kinds: ['release'], targets: ['app'], install: true },
    { name: 'site-e2e', command: 'echo site >> "$RUN_LOG"', kinds: ['release'], targets: ['site'], specialised: true },
  ],
  hook: { maxFileBytes: 1024 * 1024, allow: ['public/*.pem'] },
};
`;

let counter = 0;

function makeRepository() {
  counter += 1;
  const base = path.join(scratch, `case-${counter}`);
  const origin = path.join(base, 'origin.git');
  const work = path.join(base, 'work');
  const runLog = path.join(base, 'run.log');
  mkdirSync(base, { recursive: true });
  const env = {
    ...cleanGitEnv(),
    RUN_LOG: runLog,
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
    GIT_CONFIG_NOSYSTEM: '1',
    HOME: base,
  };
  const git = (args, cwd = work, extra = {}) => {
    const result = spawnSync('git', args, { cwd, env: { ...env, ...extra }, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
    return result.stdout.trim();
  };
  git(['init', '--quiet', '--bare', '--initial-branch=main', origin], base);
  git(['clone', '--quiet', origin, work], base);
  git(['checkout', '--quiet', '-b', 'main']);
  const write = (file, content) => {
    mkdirSync(path.dirname(path.join(work, file)), { recursive: true });
    writeFileSync(path.join(work, file), content);
  };
  write('verify-local.config.mjs', CONFIG);
  write('package.json', '{ "name": "fixture", "packageManager": "npm@11.0.0" }\n');
  write('package-lock.json', '{ "lockfileVersion": 3 }\n');
  write('src/a.js', 'export const value = "ok";\n');
  write('docs/readme.md', '# fixture\n');
  write('.gitignore', 'node_modules/\n');
  git(['add', '-A']);
  git(['commit', '--quiet', '-m', 'init']);
  git(['push', '--quiet', 'origin', 'main']);
  const commit = (message, files) => {
    for (const [file, content] of Object.entries(files)) write(file, content);
    git(['add', '-A']);
    git(['commit', '--quiet', '-m', message]);
    return git(['rev-parse', 'HEAD']);
  };
  const runs = () => (existsSync(runLog) ? readFileSync(runLog, 'utf8').trim().split('\n').filter(Boolean) : []);
  const clearRuns = () => rmSync(runLog, { force: true });
  const lines = [];
  const options = { cwd: work, env, log: (line) => lines.push(line), worktreeRoot: path.join(base, 'worktrees') };
  return { base, origin, work, env, git, write, commit, runs, clearRuns, lines, options };
}

describe('shared engine', () => {
  test('the engine is the version shared by the five repositories', () => {
    const actual = createHash('sha256').update(readFileSync(ENGINE)).digest('hex');
    assert.equal(actual, ENGINE_SHA256, 'scripts/verify-local.mjs differs from the shared engine; change it in all five repositories at once and update ENGINE_SHA256');
  });
});

describe('globs', () => {
  test('** crosses directories, * does not, a trailing slash is a prefix', () => {
    assert.ok(globToRegExp('src/**').test('src/a/b.js'));
    assert.ok(globToRegExp('**/.env').test('.env'));
    assert.ok(globToRegExp('**/.env').test('apps/web/.env'));
    assert.ok(!globToRegExp('src/*.js').test('src/a/b.js'));
    assert.ok(globToRegExp('db/').test('db/migrations/1.sql'));
    assert.ok(!globToRegExp('db/').test('dbx/1.sql'));
  });
});

describe('verify:pr', () => {
  test('checks the commit in an isolated copy and writes a v2 proof keyed by tree', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const sha = repo.commit('feature', { 'src/b.js': 'export const b = 1;\n' });
    // Work in progress is neither checked nor disturbed.
    repo.write('src/a.js', 'broken\n');
    repo.write('scratch.txt', 'untracked\n');

    const { status, proof } = await verify('pr', [], repo.options);
    assert.equal(status, 0);
    assert.deepEqual(repo.runs(), ['lint', 'test']);
    const tree = repo.git(['rev-parse', `${sha}^{tree}`]);
    assert.equal(proof.tree, tree);
    assert.equal(proof.sha, sha);
    for (const field of ['version', 'sha', 'clean', 'startedAt', 'finishedAt', 'command', 'node', 'tree', 'kind', 'checks', 'packageManager']) {
      assert.ok(field in proof, `proof has ${field}`);
    }
    assert.equal(proof.version, PROOF_FORMAT_VERSION);
    assert.equal(proof.kind, 'pr');
    assert.equal(proof.clean, true);
    assert.equal(proof.packageManager, 'npm@11.0.0');
    assert.equal(proof.command, 'npm run verify:pr');
    const commonDir = path.join(repo.work, '.git');
    assert.ok(existsSync(path.join(commonDir, 'verify-proofs', `${tree}.json`)));
    assert.equal(readFileSync(path.join(repo.work, 'src/a.js'), 'utf8'), 'broken\n');
    assert.equal(repo.git(['worktree', 'list']).split('\n').length, 1, 'the isolated copy is removed');
    // The committed config is loaded from the clone's own git directory, whatever the current directory.
    assert.ok(existsSync(path.join(commonDir, 'verify-local')), 'config copy kept in the shared git directory');
    assert.equal(proof.checks.find((check) => check.name === 'db').result, 'skipped');
  });

  test('a squash of an up-to-date branch reuses the proof without running anything', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    repo.commit('one', { 'src/b.js': '1\n' });
    const head = repo.commit('two', { 'src/b.js': '2\n' });
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    repo.clearRuns();

    // The squash commit has another SHA but the same tree.
    const tree = repo.git(['rev-parse', `${head}^{tree}`]);
    const squash = repo.git(['commit-tree', tree, '-p', 'origin/main', '-m', 'squash']);
    const { status, proof } = await verify('pr', ['--rev', squash], repo.options);
    assert.equal(status, 0);
    assert.deepEqual(repo.runs(), []);
    assert.ok(proof.checks.filter((check) => check.result === 'passed').every((check) => check.reused));
  });

  test('after the base moves, only checks whose inputs changed run again', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    repo.commit('feature', { 'src/b.js': '1\n' });
    assert.equal((await verify('pr', [], repo.options)).status, 0);

    // main moves with a docs-only change, then the branch merges it.
    repo.git(['checkout', '--quiet', 'main']);
    repo.commit('docs', { 'docs/readme.md': '# changed\n' });
    repo.git(['push', '--quiet', 'origin', 'main']);
    repo.git(['checkout', '--quiet', 'feature']);
    repo.git(['merge', '--quiet', '--no-edit', 'main']);
    repo.clearRuns();

    const { status, proof } = await verify('pr', [], repo.options);
    assert.equal(status, 0);
    assert.deepEqual(repo.runs(), ['test'], 'lint (src/** only) is reused, test (whole tree) runs');
    assert.equal(proof.checks.find((check) => check.name === 'lint').reused, true);
  });

  test('a specialised check runs only when its inputs change, and can come from elsewhere', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const sha = repo.commit('migration', { 'db/1.sql': 'select 1;\n' });

    const missing = await verify('pr', [], repo.options);
    assert.equal(missing.status, 2, 'incomplete when the database cannot run here');
    assert.equal(missing.proof.result, 'incomplete');
    assert.equal(missing.proof.checks.find((check) => check.name === 'db').result, 'unavailable');

    const external = await verify('pr', ['--external', `db=CircleCI pipeline 42 on ${sha}`], repo.options);
    assert.equal(external.status, 0);
    const db = external.proof.checks.find((check) => check.name === 'db');
    assert.equal(db.result, 'passed');
    assert.equal(db.external, `CircleCI pipeline 42 on ${sha}`);

    repo.clearRuns();
    const local = await verify('pr', ['--force'], { ...repo.options, env: { ...repo.env, DB_AVAILABLE: '1' } });
    assert.equal(local.status, 0);
    assert.deepEqual(repo.runs(), ['lint', 'test', 'db']);
  });

  test('--external only stands in for a specialised check that cannot run here, with evidence for this tree', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const sha = repo.commit('migration', { 'db/1.sql': 'select 1;\n' });
    const tree = repo.git(['rev-parse', `${sha}^{tree}`]);

    await assert.rejects(verify('pr', ['--external', `lint=done on ${sha}`], repo.options), /only a specialised check/);
    await assert.rejects(verify('pr', ['--external', 'db=CircleCI pipeline 42'], repo.options), /must name the verified commit/);
    await assert.rejects(verify('pr', ['--external', `nope=x on ${sha}`], repo.options), /no such pr check/);
    const unknown = spawnSync(process.execPath, [ENGINE, 'pr', '--external', `lint=x on ${sha}`], { cwd: repo.work, env: repo.env, encoding: 'utf8' });
    assert.equal(unknown.status, 64);

    // The tree, or another commit with the same tree (a squash), also counts.
    assert.equal((await verify('pr', ['--force', '--external', `db=owner machine, tree ${tree}`], repo.options)).status, 0);
    const squash = repo.git(['commit-tree', tree, '-p', 'origin/main', '-m', 'squash']);
    assert.equal((await verify('pr', ['--rev', squash, '--force', '--external', `db=run on ${sha}`], repo.options)).status, 0);

    // When the check can run here, it runs: --external cannot skip it.
    repo.clearRuns();
    const local = await verify('pr', ['--force', '--external', `db=run on ${sha}`], { ...repo.options, env: { ...repo.env, DB_AVAILABLE: '1' } });
    assert.equal(local.status, 0);
    assert.ok(repo.runs().includes('db'));
    assert.equal(local.proof.checks.find((check) => check.name === 'db').external, undefined);
  });

  test('a check that picks its work from the base is reused only against the same merge base', () => {
    const check = { name: 'affected', command: 'x', env: {}, inputs: null, exclude: [], perCommit: false, perBase: true };
    const args = { check, files: [], tree: 't', sha: 's', environment: {} };
    assert.notEqual(checkFingerprint({ ...args, mergeBase: 'a' }), checkFingerprint({ ...args, mergeBase: 'b' }));
    const plain = { ...check, perBase: false };
    assert.equal(checkFingerprint({ ...args, check: plain, mergeBase: 'a' }), checkFingerprint({ ...args, check: plain, mergeBase: 'b' }));
  });

  test('a failed check fails the run, stops it, and is never reused', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    repo.commit('break', { 'src/a.js': 'nope\n' });
    const first = await verify('pr', [], repo.options);
    assert.equal(first.status, 1);
    assert.equal(first.proof.result, 'failed');
    repo.clearRuns();
    const second = await verify('pr', [], repo.options);
    assert.equal(second.status, 1);
    assert.deepEqual(repo.runs(), ['test'], 'lint is reused, the failed test runs again');
  });

  test('checks run without the GIT_* variables of a hook', () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    repo.commit('feature', { 'src/b.js': '1\n' });
    const result = spawnSync(process.execPath, [ENGINE, 'pr'], {
      cwd: repo.work,
      env: { ...repo.env, GIT_DIR: path.join(repo.work, '.git'), GIT_INDEX_FILE: path.join(repo.work, '.git', 'index') },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
});

describe('verify:release and the deploy guard', () => {
  test('release reuses identical checks, reruns per-commit ones, and covers the requested targets', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const head = repo.commit('feature', { 'src/b.js': '1\n' });
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    repo.clearRuns();

    const release = await verify('release', ['--target', 'site'], repo.options);
    assert.equal(release.status, 0);
    // site-check was out of scope for the PR, so the release runs it once.
    assert.deepEqual(repo.runs(), ['site-check', `build:${head}`, 'site']);
    assert.deepEqual(release.proof.targets, ['site']);

    // A PR run on the same tree keeps the release proof.
    await verify('pr', [], repo.options);
    const tree = repo.git(['rev-parse', `${head}^{tree}`]);
    assert.equal(readProof(path.join(repo.work, '.git'), tree).kind, 'release');

    const unknown = spawnSync(process.execPath, [ENGINE, 'release', '--target', 'nope'], { cwd: repo.work, env: repo.env, encoding: 'utf8' });
    assert.equal(unknown.status, 64);
  });

  test('on the main commit, a releaseAlways check runs while a plain when check stays out of scope', async () => {
    const repo = makeRepository();
    const head = repo.commit('site', { 'site/index.html': '<p>ok</p>\n' });
    repo.git(['push', '--quiet', 'origin', 'main']);
    const { status, proof } = await verify('release', [], repo.options);
    assert.equal(status, 0);
    assert.equal(proof.sha, head);
    assert.equal(proof.checks.find((check) => check.name === 'db').result, 'skipped');
    assert.ok(repo.runs().includes('site-check'));
    repo.clearRuns();
    await verify('pr', ['--force'], repo.options);
    assert.deepEqual(repo.runs(), ['lint', 'test'], 'a PR run on main has no path in scope');
  });

  test('checks get a temporary directory of their own, removed with the copy', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    repo.commit('feature', { 'src/b.js': '1\n' });
    const config = readFileSync(path.join(repo.work, 'verify-local.config.mjs'), 'utf8')
      .replace("command: 'echo lint >> \"$RUN_LOG\"'", "command: 'echo lint:$TMPDIR >> \"$RUN_LOG\" && test -d \"$TMPDIR\"'");
    repo.commit('tmp', { 'verify-local.config.mjs': config });
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    const tmp = repo.runs().find((line) => line.startsWith('lint:')).slice('lint:'.length);
    assert.ok(tmp.startsWith(path.join(repo.base, 'worktrees')), tmp);
    assert.ok(!existsSync(tmp), 'removed with the copy');
  });

  test('a nested project is linked only when its own lockfile is unchanged', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    repo.commit('nested', {
      'apps/a/package.json': '{ "name": "a" }\n',
      'apps/a/package-lock.json': '{ "lockfileVersion": 3, "v": 1 }\n',
      'apps/b/package.json': '{ "name": "b" }\n',
      'apps/b/package-lock.json': '{ "lockfileVersion": 3, "v": 1 }\n',
    });
    for (const app of ['a', 'b']) mkdirSync(path.join(repo.work, 'apps', app, 'node_modules', 'dep'), { recursive: true });
    repo.write('apps/b/package-lock.json', '{ "lockfileVersion": 3, "v": 2 }\n');
    await verify('pr', ['--keep'], repo.options);
    const copy = repo.lines.find((line) => line.includes('isolated copy kept at')).replace(/^.*kept at /, '').replace(/\.$/, '');
    assert.ok(existsSync(path.join(copy, 'apps', 'a', 'node_modules', 'dep')));
    assert.ok(!existsSync(path.join(copy, 'apps', 'b', 'node_modules')));
    assert.ok(repo.lines.some((line) => line.includes('apps/b/node_modules not linked')));
    repo.git(['worktree', 'remove', '--force', copy]);
  });

  test('the package manager version is recorded even without a packageManager field', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    repo.commit('no field', { 'package.json': '{ "name": "fixture" }\n' });
    const { proof } = await verify('pr', [], repo.options);
    assert.match(proof.packageManager ?? '', /^npm@\d+\./);
  });

  test('a release replays a result that only ever passed on another tree', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    repo.commit('feature', { 'src/b.js': '1\n' });
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    repo.commit('docs', { 'docs/readme.md': '# more\n' });
    repo.clearRuns();
    const release = await verify('release', [], repo.options);
    assert.equal(release.status, 0);
    assert.ok(repo.runs().includes('lint'), 'lint runs again: its earlier pass was on another tree');
  });

  test('a failed or incomplete release run never replaces a passed PR proof', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const head = repo.commit('feature', { 'src/b.js': '1\n' });
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    const failing = await verify('release', [], { ...repo.options, env: { ...repo.env, FAIL_BUILD: '1' } });
    assert.equal(failing.status, 1);
    const commonDir = path.join(repo.work, '.git');
    const tree = repo.git(['rev-parse', `${head}^{tree}`]);
    const kept = readProof(commonDir, tree);
    assert.equal(kept.kind, 'pr');
    assert.equal(kept.result, 'passed');
    assert.ok(existsSync(path.join(commonDir, 'verify-proofs', `${tree}.release-attempt.json`)));

    repo.clearRuns();
    const passing = await verify('release', [], repo.options);
    assert.equal(passing.status, 0);
    assert.deepEqual(repo.runs(), [`build:${head}`], 'the failed build runs again, the PR checks are reused');
    assert.equal(readProof(commonDir, tree).kind, 'release');
  });

  test('an incomplete run for one more target never replaces a passed release proof', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const head = repo.commit('feature', { 'src/b.js': '1\n' });
    assert.equal((await verify('release', [], repo.options)).status, 0);
    const failing = await verify('release', ['--target', 'site'], { ...repo.options, env: { ...repo.env, FAIL_BUILD: '1' } });
    assert.equal(failing.status, 0, 'build is reused, site-e2e passes');
    const commonDir = path.join(repo.work, '.git');
    const tree = repo.git(['rev-parse', `${head}^{tree}`]);
    assert.deepEqual(readProof(commonDir, tree).targets, ['site']);

    // A rerun that only reuses this tree's results keeps the proof and its counts.
    const before = readFileSync(path.join(commonDir, 'verify-proofs', `${tree}.json`), 'utf8');
    assert.equal((await verify('release', ['--target', 'site'], repo.options)).status, 0);
    assert.equal(readFileSync(path.join(commonDir, 'verify-proofs', `${tree}.json`), 'utf8'), before);
  });

  test('a check that needs a real install replaces the linked node_modules first', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    repo.commit('feature', { 'src/b.js': '1\n' });
    mkdirSync(path.join(repo.work, 'node_modules', 'ext'), { recursive: true });
    const { status } = await verify('release', ['--target', 'app'], repo.options);
    assert.equal(status, 0);
    const runs = repo.runs();
    assert.deepEqual(runs.slice(runs.indexOf('install')), ['install', 'bundle']);
    assert.ok(runs.indexOf('lint') < runs.indexOf('install'), 'the other checks ran on the links');
    assert.ok(existsSync(path.join(repo.work, 'node_modules', 'ext')), 'the main checkout keeps its packages');
  });

  test('a deploy needs a release proof for HEAD = origin/main; a PR proof or another commit is refused', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const head = repo.commit('feature', { 'src/b.js': '1\n' });
    assert.equal((await verify('release', [], repo.options)).status, 0);

    // Squash-merge: main gets a new commit with the same tree.
    const tree = repo.git(['rev-parse', `${head}^{tree}`]);
    const squash = repo.git(['commit-tree', tree, '-p', 'main', '-m', 'squash']);
    repo.git(['checkout', '--quiet', 'main']);
    repo.git(['reset', '--quiet', '--hard', squash]);
    repo.git(['push', '--quiet', 'origin', 'main']);

    const before = checkReleaseProof({ cwd: repo.work, env: repo.env, fetch: false });
    assert.deepEqual(before.failures.map((failure) => failure.check), ['proof-matches-head']);

    repo.clearRuns();
    assert.equal((await verify('release', [], repo.options)).status, 0);
    assert.deepEqual(repo.runs(), [`build:${squash}`], 'only the per-commit build runs again');
    assert.deepEqual(checkReleaseProof({ cwd: repo.work, env: repo.env, fetch: false }).failures, []);
    assert.deepEqual(
      checkReleaseProof({ cwd: repo.work, env: repo.env, fetch: false, targets: ['site'] }).failures.map((failure) => failure.check),
      ['proof-target'],
    );

    // A PR proof never unlocks a deploy.
    const next = repo.commit('next', { 'src/c.js': '1\n' });
    repo.git(['push', '--quiet', 'origin', 'main']);
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    const refused = checkReleaseProof({ cwd: repo.work, env: repo.env, fetch: false });
    assert.equal(refused.head, next);
    assert.deepEqual(refused.failures.map((failure) => failure.check), ['proof-kind']);

    repo.write('dirty.txt', 'x\n');
    assert.ok(checkReleaseProof({ cwd: repo.work, env: repo.env, fetch: false }).failures.some((failure) => failure.check === 'clean-tree'));
  });

  test('proof-block prints the Local proof section the merge gate reads', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const head = repo.commit('feature', { 'src/b.js': '1\n' });
    await verify('pr', [], repo.options);
    repo.lines.length = 0;
    assert.equal((await proofBlock([], repo.options)).status, 0);
    const block = repo.lines.join('\n');
    assert.match(block, /^## Local proof$/m);
    assert.match(block, /^- Commands: `npm run verify:pr`$/m);
    assert.match(block, new RegExp(`^- Commit SHA: \`${head}\`$`, 'm'));
    assert.match(block, /^- Result: passed/m);
    assert.match(block, /^- Tree \(`git rev-parse <sha>\^\{tree\}`\): `[0-9a-f]{40}`$/m);
    assert.match(block, /^- Integration: base unchanged/m);
    assert.doesNotMatch(block, /Delivery checks changed/);
  });

  test('proof-block flags a change to the checks themselves for the owner', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const config = readFileSync(path.join(repo.work, 'verify-local.config.mjs'), 'utf8');
    repo.commit('relax', { 'verify-local.config.mjs': config.replace("allow: ['public/*.pem']", "allow: ['public/*.pem', '**/*.key']") });
    await verify('pr', [], repo.options);
    repo.lines.length = 0;
    await proofBlock([], repo.options);
    assert.match(repo.lines.join('\n'), /^- Delivery checks changed: verify-local.config.mjs \(needs the owner's review\)$/m);
  });
});

describe('node_modules of the isolated copy', () => {
  test('links installed packages and points workspace links at the isolated copy', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    repo.commit('workspace', {
      'packages/ws/package.json': '{ "name": "@fixture/ws" }\n',
      'packages/ws/index.js': 'module.exports = "verified";\n',
    });
    mkdirSync(path.join(repo.work, 'node_modules', 'ext'), { recursive: true });
    writeFileSync(path.join(repo.work, 'node_modules', 'ext', 'index.js'), 'module.exports = 1;\n');
    mkdirSync(path.join(repo.work, 'node_modules', '@fixture'), { recursive: true });
    symlinkSync('../../packages/ws', path.join(repo.work, 'node_modules', '@fixture', 'ws'));
    // The checkout's workspace source differs from the commit being verified.
    repo.write('packages/ws/index.js', 'module.exports = "work in progress";\n');

    await verify('pr', ['--keep'], repo.options);
    const kept = repo.lines.find((line) => line.includes('isolated copy kept at'));
    const copy = kept.replace(/^.*kept at /, '').replace(/\.$/, '');
    assert.ok(lstatSync(path.join(copy, 'node_modules', 'ext')).isSymbolicLink());
    assert.equal(readlinkSync(path.join(copy, 'node_modules', 'ext')), path.join(repo.work, 'node_modules', 'ext'));
    assert.equal(
      readFileSync(path.join(copy, 'node_modules', '@fixture', 'ws', 'index.js'), 'utf8'),
      'module.exports = "verified";\n',
    );
    assert.deepEqual(repo.runs().filter((line) => line === 'install'), [], 'same lockfile: nothing installed');
    repo.git(['worktree', 'remove', '--force', copy]);
  });

  test('installs when the lockfile of the commit differs from the checkout', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    repo.commit('deps', { 'package-lock.json': '{ "lockfileVersion": 3, "packages": {} }\n' });
    mkdirSync(path.join(repo.work, 'node_modules'), { recursive: true });
    repo.write('package-lock.json', '{ "lockfileVersion": 3 }\n');
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    assert.equal(repo.runs()[0], 'install');
  });
});

describe('pre-push hook', () => {
  const ZERO = '0'.repeat(40);

  function hookRun(repo, stdin) {
    const output = [];
    return prePush('origin', stdin, { cwd: repo.work, env: repo.env, log: (line) => output.push(line), error: (line) => output.push(line) })
      .then((result) => ({ ...result, output: output.join('\n') }));
  }

  test('a branch deletion or commits the remote already has run nothing', async () => {
    const repo = makeRepository();
    const head = repo.git(['rev-parse', 'HEAD']);
    const deletion = await hookRun(repo, `(delete) ${ZERO} refs/heads/old ${head}\n`);
    assert.equal(deletion.status, 0);
    assert.match(deletion.output, /nothing new/);
    const known = await hookRun(repo, `refs/heads/copy ${head} refs/heads/copy ${ZERO}\n`);
    assert.equal(known.status, 0);
    assert.match(known.output, /nothing new/);
  });

  test('blocks forbidden files, secrets and oversized files, allows examples', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const fake = ['AKIA', 'ABCDEFGHIJKLMNOP'].join('');
    const sha = repo.commit('bad', {
      'apps/web/.env': 'TOKEN=1\n',
      'apps/web/.env.example': 'TOKEN=\n',
      'public/cert.pem': 'public certificate\n',
      'src/config.js': `const key = "${fake}";\n`,
      'assets/big.bin': Buffer.alloc(2 * 1024 * 1024, 1),
    });
    const result = await hookRun(repo, `refs/heads/feature ${sha} refs/heads/feature ${ZERO}\n`);
    assert.equal(result.status, 1);
    assert.match(result.output, /apps\/web\/\.env: forbidden/);
    assert.doesNotMatch(result.output, /\.env\.example/);
    assert.doesNotMatch(result.output, /cert\.pem/);
    assert.match(result.output, /src\/config\.js: looks like a AWS access key/);
    assert.match(result.output, /assets\/big\.bin: 2\.0 MB/);
  });

  test('a clean push passes in a few seconds and reports the proof', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const sha = repo.commit('feature', { 'src/b.js': '1\n' });
    const line = `refs/heads/feature ${sha} refs/heads/feature ${ZERO}\n`;
    const before = await hookRun(repo, line);
    assert.equal(before.status, 0);
    assert.match(before.output, /no proof yet; run npm run verify:pr/);
    await verify('pr', [], repo.options);
    const afterProof = await hookRun(repo, line);
    assert.match(afterProof.output, /pr proof passed/);
  });

  test('the secret scan fails closed when git cannot read the blobs', () => {
    assert.equal(readBlobs(path.join(scratch, 'no-such-repository'), cleanGitEnv(), [{ file: 'a', object: 'b'.repeat(40) }]), null);
  });

  test('a real git push runs the hook in under 10 seconds', () => {
    const repo = makeRepository();
    mkdirSync(path.join(repo.work, '.githooks'), { recursive: true });
    writeFileSync(
      path.join(repo.work, '.githooks', 'pre-push'),
      `#!/bin/sh\nexec "${process.execPath}" "${ENGINE}" hook "$@"\n`,
      { mode: 0o755 },
    );
    repo.git(['config', 'core.hooksPath', '.githooks']);
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    repo.commit('feature', { 'src/b.js': '1\n' });
    const started = Date.now();
    const result = spawnSync('git', ['push', '--quiet', 'origin', 'feature'], { cwd: repo.work, env: repo.env, encoding: 'utf8' });
    const elapsed = Date.now() - started;
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout + result.stderr, /fast checks passed/);
    assert.ok(elapsed < 10_000, `hook took ${elapsed} ms`);
  });
});
