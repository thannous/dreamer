// Tests of scripts/verify-local.mjs, the engine of the common delivery rule.
// Each repository keeps and pins its own copy. Run: node --test scripts/test-verify-local.mjs

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  PROOF_FORMAT_VERSION,
  checkFingerprint,
  checkReleaseProof,
  cleanGitEnv,
  normaliseConfig,
  externalEvidenceIssue,
  hasFlock,
  hasPdeathsig,
  loadExternalSources,
  globToRegExp,
  prePush,
  readBlobs,
  proofBlock,
  readProof,
  verify,
} from './verify-local.mjs';

const ENGINE = fileURLToPath(new URL('./verify-local.mjs', import.meta.url));
// The engine's sha256 is pinned in this repository's own verify-local.config.mjs
// (export ENGINE_SHA256). No other repository is read or compared.
const CONFIG_PATH = fileURLToPath(new URL('../verify-local.config.mjs', import.meta.url));
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
  externalSources: ['https://ci.example/run/'],
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
    // Each fixture takes its own heavy-check lock, never the machine's.
    VERIFY_LOCAL_HEAVY_LOCK: path.join(base, 'heavy.lock'),
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

describe('engine pin', () => {
  test('the engine matches the ENGINE_SHA256 pinned in this repository config', async () => {
    const { ENGINE_SHA256 } = await import(pathToFileURL(CONFIG_PATH).href);
    assert.match(ENGINE_SHA256 ?? '', /^[0-9a-f]{64}$/, 'verify-local.config.mjs exports ENGINE_SHA256');
    const actual = createHash('sha256').update(readFileSync(ENGINE)).digest('hex');
    assert.equal(actual, ENGINE_SHA256, 'scripts/verify-local.mjs differs from the ENGINE_SHA256 pin of verify-local.config.mjs; update the pin after a deliberate engine edit');
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
  test('checks the commit in an isolated copy and writes a proof keyed by tree', async () => {
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

    const evidence = `owner-machine: tanuki pgTAP on ${sha}`;
    const external = await verify('pr', ['--external', `db=${evidence}`], repo.options);
    assert.equal(external.status, 0);
    const db = external.proof.checks.find((check) => check.name === 'db');
    assert.equal(db.result, 'passed');
    assert.equal(db.external, evidence);

    repo.clearRuns();
    const local = await verify('pr', ['--force'], { ...repo.options, env: { ...repo.env, DB_AVAILABLE: '1' } });
    assert.equal(local.status, 0);
    assert.deepEqual(repo.runs(), ['lint', 'test', 'db']);
  });

  test('without a known base, a check limited by when runs rather than being skipped', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    repo.commit('feature', { 'src/b.js': '1\n' });
    // No origin/main (a fresh clone of another remote, or a missing fetch):
    // the changed files are unknown, so nothing is out of scope.
    repo.git(['update-ref', '-d', 'refs/remotes/origin/main']);

    const { status, proof } = await verify('pr', [], { ...repo.options, env: { ...repo.env, DB_AVAILABLE: '1' } });
    assert.equal(status, 0);
    assert.deepEqual(repo.runs(), ['lint', 'test', 'db', 'site-check']);
    assert.equal(proof.base.sha, null);
    assert.ok(proof.checks.every((check) => check.result !== 'skipped'));
  });

  test('--external only stands in for a specialised check that cannot run here, with evidence for this head', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const sha = repo.commit('migration', { 'db/1.sql': 'select 1;\n' });
    const tree = repo.git(['rev-parse', `${sha}^{tree}`]);

    await assert.rejects(verify('pr', ['--external', `lint=https://ci.example/1 on ${sha}`], repo.options), /only a specialised check/);
    await assert.rejects(verify('pr', ['--external', `nope=https://ci.example/1 on ${sha}`], repo.options), /no such pr check/);
    const unknown = spawnSync(process.execPath, [ENGINE, 'pr', '--external', `lint=https://ci.example/1 on ${sha}`], { cwd: repo.work, env: repo.env, encoding: 'utf8' });
    assert.equal(unknown.status, 64);

    // Evidence must give an https location and name the verified head SHA exactly once.
    const other = repo.git(['rev-parse', 'origin/main']);
    for (const [evidence, reason] of [
      [`https://app.circleci.com/pipelines/github/o/r/42 on ${sha}`, /not under an external CI source/],
      ['https://ci.example/run/42', /does not name the verified commit/],
      [`https://ci.example/run/42 on ${sha.slice(0, 12)}`, /does not name the verified commit/],
      [`owner-machine: pc on ${sha.slice(0, 7)}`, /does not name the verified commit/],
      [`owner-machine: pc on ${sha}, log https://paste.example/1`, /not under an external CI source/],
      [`CircleCI pipeline 42 on ${sha}`, /neither starts with "owner-machine:"/],
      [`owner laptop on ${sha}`, /neither starts with "owner-machine:"/],
      [`http://ci.example/run?sha=${sha}`, /http:\/\/ URL/],
      [`https://ci.example/run/1 on ${tree}`, /which is not the verified commit/],
      [`https://ci.example/run/1 on ${other}`, new RegExp(`names ${other}`)],
      [`https://ci.example/run/1 on ${sha}, see ${other.toUpperCase()}`, /which is not the verified commit/],
      [`https://ci.example/run/1 on ${sha} ${sha}`, /2 times/],
    ]) {
      await assert.rejects(verify('pr', ['--force', '--external', `db=${evidence}`], repo.options), reason, evidence);
    }

    // The head SHA counts only in lowercase, as git prints it: an uppercase head alone is refused.
    await assert.rejects(
      verify('pr', ['--force', '--external', `db=https://ci.example/run/2 on ${sha.toUpperCase()}`], repo.options),
      /the verified commit in another case/,
    );
    await assert.rejects(
      verify('pr', ['--force', '--external', `db=owner-machine: tanuki pgTAP on ${sha.toUpperCase()}`], repo.options),
      /the verified commit in another case/,
    );
    // The lowercase head passes; a same-tree squash needs its own evidence.
    const evidence = `https://ci.example/run/2 on ${sha}`;
    assert.equal((await verify('pr', ['--force', '--external', `db=${evidence}`], repo.options)).status, 0);
    const squash = repo.git(['commit-tree', tree, '-p', 'origin/main', '-m', 'squash']);
    await assert.rejects(
      verify('pr', ['--rev', squash, '--force', '--external', `db=${evidence}`], repo.options),
      /which is not the verified commit/,
    );
    assert.equal((await verify('pr', ['--rev', squash, '--force', '--external', `db=https://ci.example/run/3 on ${squash}`], repo.options)).status, 0);

    // When the check can run here, --external is refused: run it.
    await assert.rejects(
      verify('pr', ['--force', '--external', `db=https://ci.example/run/4 on ${sha}`], { ...repo.options, env: { ...repo.env, DB_AVAILABLE: '1' } }),
      /can run it/,
    );
  });

  test('evidence rule: owner-machine or a listed external CI source, and the full head SHA once', () => {
    const sha = '0123456789abcdef0123456789abcdef01234567';
    const other = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const listed = ['https://github.com/o/r/actions/runs/'];
    // Default config (External CI: none): the owner machine only.
    assert.equal(externalEvidenceIssue(null, `owner-machine: tanuki pgTAP 42 passed on ${sha}`, sha), null);
    // The head counts only in lowercase; an uppercase or mixed-case copy is another SHA.
    const mixed = sha.slice(0, 20) + sha.slice(20).toUpperCase();
    assert.match(externalEvidenceIssue(null, `owner-machine: tanuki pgTAP on ${sha.toUpperCase()}`, sha) ?? '', /the verified commit in another case/);
    assert.match(externalEvidenceIssue(null, `owner-machine: tanuki pgTAP on ${mixed}`, sha) ?? '', /the verified commit in another case/);
    assert.match(externalEvidenceIssue(null, `https://github.com/o/r/actions/runs/7 on ${sha.toUpperCase()}`, sha, null, listed) ?? '', /the verified commit in another case/);
    assert.match(externalEvidenceIssue(null, `owner-machine: tanuki pgTAP ${sha.toUpperCase()} on ${sha}`, sha) ?? '', /the verified commit in another case/);
    // Exactly "owner-machine: <host> <note> on <sha>": a host token, a note, and " on <sha>" at the end.
    for (const evidence of [
      `owner-machine:x ${sha}`,
      `owner-machine: tanuki ${sha}`,
      `owner-machine: tanuki on ${sha}`,
      `owner-machine:  tanuki pgTAP on ${sha}`,
      `owner-machine:tanuki pgTAP on ${sha}`,
      `owner-machine: tanuki pgTAP on ${sha} (passed)`,
      `owner-machine: tanuki pgTAP at ${sha}`,
      `owner-machine: tanuki pgTAP on\t${sha}`,
    ]) {
      assert.match(externalEvidenceIssue(null, evidence, sha) ?? '', /must read exactly "owner-machine: <host> <note> on /, evidence);
    }
    assert.match(externalEvidenceIssue(null, `Owner-Machine: tanuki pgTAP on ${sha}`, sha) ?? '', /neither starts with "owner-machine:"/);
    assert.match(externalEvidenceIssue(null, `owner-machine: tanuki pgTAP on ${sha.slice(0, 39)}`, sha) ?? '', /does not name the verified commit/);
    assert.match(externalEvidenceIssue(null, `https://github.com/o/r/actions/runs/7 on ${sha}`, sha) ?? '', /External CI: none/);
    assert.match(externalEvidenceIssue(null, `owner laptop on ${sha}`, sha) ?? '', /neither starts with "owner-machine:"/);
    assert.match(externalEvidenceIssue(null, `see owner-machine: pc on ${sha}`, sha) ?? '', /neither starts with "owner-machine:"/);
    assert.match(externalEvidenceIssue(null, `owner-machine: pc on ${sha.slice(0, 12)}`, sha) ?? '', /does not name the verified commit/);
    assert.match(externalEvidenceIssue(null, `owner-machine: pc on ${other}`, sha) ?? '', new RegExp(`names ${other}`));
    assert.match(externalEvidenceIssue(null, `owner-machine: pc on ${sha}, mirror http://ci.example/1`, sha) ?? '', /http:\/\/ URL/);
    // A listed source passes; any other https URL, or a lookalike prefix, does not.
    assert.equal(externalEvidenceIssue(null, `https://github.com/o/r/actions/runs/7 on ${sha}`, sha, null, listed), null);
    assert.match(externalEvidenceIssue(null, `https://github.com/o/r-fork/actions/runs/7 on ${sha}`, sha, null, listed) ?? '', /not under an external CI source/);
    assert.match(externalEvidenceIssue(null, `https://ci.example/run/7 on ${sha}`, sha, null, listed) ?? '', /not under an external CI source/);
    assert.match(externalEvidenceIssue(null, `http://github.com/o/r/actions/runs/7 on ${sha}`, sha, null, listed) ?? '', /http:\/\/ URL/);
    assert.match(externalEvidenceIssue(null, 'https://github.com/o/r/actions/runs/7', sha, null, listed) ?? '', /does not name the verified commit/);
    assert.match(externalEvidenceIssue(null, `https://github.com/o/r/actions/runs/7 on ${sha.slice(0, 7)}`, sha, null, listed) ?? '', /does not name the verified commit/);
    assert.match(externalEvidenceIssue(null, `https://github.com/o/r/actions/runs/7 on ${sha}, see ${other.toUpperCase()}`, sha, null, listed) ?? '', /which is not the verified commit/);
    assert.match(externalEvidenceIssue(null, `https://github.com/o/r/actions/runs/7 on ${sha} ${sha}`, sha, null, listed) ?? '', /2 times/);
  });

  test('externalSources must be https:// URL prefixes with a path ending in /', () => {
    const base = { checks: [{ name: 'a', command: 'true' }] };
    assert.deepEqual(normaliseConfig(base).externalSources, []);
    assert.deepEqual(normaliseConfig({ ...base, externalSources: ['https://github.com/o/r/actions/runs/'] }).externalSources, ['https://github.com/o/r/actions/runs/']);
    for (const bad of ['http://ci.example/run/', 'https://ci.example', 'https://ci.example/', 'https://ci.example/run', 'ci.example/run/', 42]) {
      assert.throws(() => normaliseConfig({ ...base, externalSources: [bad] }), /externalSources/, String(bad));
    }
    assert.throws(() => normaliseConfig({ ...base, externalSources: 'https://ci.example/run/' }), /externalSources/);
  });

  test('external evidence is never reused by another proof', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const sha = repo.commit('migration', { 'db/1.sql': 'select 1;\n' });
    assert.equal((await verify('pr', ['--external', `db=https://ci.example/run/1 on ${sha}`], repo.options)).status, 0);
    // A squash has the same tree, so every other check is reused, but not the evidence.
    const tree = repo.git(['rev-parse', `${sha}^{tree}`]);
    const squash = repo.git(['commit-tree', tree, '-p', 'origin/main', '-m', 'squash']);
    const again = await verify('pr', ['--rev', squash], repo.options);
    assert.equal(again.status, 2, 'incomplete: the evidence for the first commit is not carried over');
    // The passed proof of the tree is kept; the incomplete run is recorded beside it.
    const attempt = JSON.parse(readFileSync(path.join(repo.work, '.git', 'verify-proofs', `${tree}.pr-attempt.json`), 'utf8'));
    assert.equal(attempt.sha, squash);
    assert.equal(attempt.checks.find((check) => check.name === 'db').result, 'unavailable');
  });

  test('a check that picks its work from the base is reused only against the same merge base', () => {
    const check = { name: 'affected', command: 'x', env: {}, inputs: null, exclude: [], perCommit: false, perBase: true };
    const args = { check, files: [], tree: 't', sha: 's', environment: {} };
    assert.notEqual(checkFingerprint({ ...args, mergeBase: 'a' }), checkFingerprint({ ...args, mergeBase: 'b' }));
    const plain = { ...check, perBase: false };
    assert.equal(checkFingerprint({ ...args, check: plain, mergeBase: 'a' }), checkFingerprint({ ...args, check: plain, mergeBase: 'b' }));
  });

  test('heavy steps wait for the machine-wide lock, and a step under it does not take it again', { skip: hasFlock() ? false : 'flock is not installed here (macOS has none by default): the engine runs steps without the lock' }, async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    repo.commit('feature', { 'src/b.js': '1\n' });
    const lock = repo.env.VERIFY_LOCAL_HEAVY_LOCK;
    const hold = (seconds) => new Promise((resolve) => {
      const holder = spawn('flock', [lock, 'sh', '-c', `echo held; exec sleep ${seconds}`], { stdio: ['ignore', 'pipe', 'ignore'], detached: true });
      holder.stdout.once('data', () => {
        holder.stdout.destroy();
        holder.unref();
        resolve(holder);
      });
    });

    // Free lock: no wait.
    assert.equal((await verify('pr', ['--force'], repo.options)).status, 0);
    assert.ok(!repo.lines.some((line) => line.includes('waiting for lock')), repo.lines.join('\n'));

    // Held lock: the run says it waits, then passes once the holder is done.
    let holder = await hold(1);
    repo.lines.length = 0;
    const started = Date.now();
    assert.equal((await verify('pr', ['--force'], repo.options)).status, 0);
    assert.ok(repo.lines.some((line) => line.includes(`waiting for lock ${lock}`)), repo.lines.join('\n'));
    assert.ok(Date.now() - started >= 500, 'the run waited for the holder');

    // A run inside a step that already holds this lock does not wait for it.
    holder = await hold(30);
    try {
      repo.lines.length = 0;
      const nested = await verify('pr', ['--force'], { ...repo.options, env: { ...repo.env, VERIFY_LOCAL_HEAVY_LOCK_HELD: lock } });
      assert.equal(nested.status, 0);
      assert.ok(!repo.lines.some((line) => line.includes('waiting for lock')));
    } finally {
      process.kill(-holder.pid, 'SIGKILL');
    }
  });

  test('the lock is free once verify exits, even if a check left a process behind', { skip: hasFlock() ? false : 'flock is not installed here (macOS has none by default): the engine runs steps without the lock' }, async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const lock = repo.env.VERIFY_LOCAL_HEAVY_LOCK;
    const pidFile = path.join(repo.work, '..', 'background.pid');
    const config = readFileSync(path.join(repo.work, 'verify-local.config.mjs'), 'utf8');
    repo.commit('daemon', {
      'verify-local.config.mjs': config.replace(`command: 'echo lint >> "$RUN_LOG"'`, () => `command: 'sleep 30 > /dev/null 2>&1 & echo $! > ${pidFile}; echo lint >> "$RUN_LOG"'`),
    });
    try {
      assert.equal((await verify('pr', [], repo.options)).status, 0);
      // The next steps of the same run did not wait for the background process either.
      assert.ok(!repo.lines.some((line) => line.includes('waiting for lock')), repo.lines.join('\n'));
      for (let i = 0; i < 50 && !existsSync(pidFile); i += 1) await new Promise((resolve) => setTimeout(resolve, 50));
      assert.ok(existsSync(pidFile), 'the check left a background process');
      assert.equal(spawnSync('flock', ['--nonblock', lock, 'true']).status, 0, 'the background process does not hold the lock');
    } finally {
      if (existsSync(pidFile)) try { process.kill(Number(readFileSync(pidFile, 'utf8')), 'SIGKILL'); } catch {}
    }
  });

  test('a SIGKILLed verify run leaves no process holding the lock', {
    skip: !hasFlock() ? 'flock is not installed here: the engine runs steps without the lock'
      : !hasPdeathsig() ? 'setpriv --pdeathsig is not available here: plain flock keeps the lock until the step ends, as the engine logs'
      : false,
  }, async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const lock = repo.env.VERIFY_LOCAL_HEAVY_LOCK;
    const pidFile = path.join(repo.work, '..', 'step.pid');
    const config = readFileSync(path.join(repo.work, 'verify-local.config.mjs'), 'utf8');
    repo.commit('slow', {
      'verify-local.config.mjs': config.replace(`command: 'echo lint >> "$RUN_LOG"'`, () => `command: 'echo $$ > ${pidFile}; exec sleep 30'`),
    });
    const run = spawn(process.execPath, [ENGINE, 'pr'], { cwd: repo.work, env: repo.env, stdio: 'ignore' });
    const wait = async (condition) => {
      for (let i = 0; i < 200 && !condition(); i += 1) await new Promise((resolve) => setTimeout(resolve, 50));
      return condition();
    };
    try {
      assert.ok(await wait(() => existsSync(pidFile)), 'the step started');
      assert.notEqual(spawnSync('flock', ['--nonblock', lock, 'true']).status, 0, 'the step holds the lock');
      run.kill('SIGKILL');
      assert.ok(await wait(() => spawnSync('flock', ['--nonblock', lock, 'true']).status === 0), 'the lock is free after the run was killed');
    } finally {
      run.kill('SIGKILL');
      if (existsSync(pidFile)) try { process.kill(Number(readFileSync(pidFile, 'utf8')), 'SIGKILL'); } catch {}
    }
  });

  test('without flock or setpriv on PATH, a step still runs, passes or fails, and the run says how it is locked', async () => {
    // A PATH with every command of this one except the hidden ones, so the
    // engine's own probes find them missing (as on macOS), on Linux too.
    const pathWithout = (hidden) => {
      const dir = mkdtempSync(path.join(scratch, 'path-'));
      for (const entry of (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
        let names = [];
        try { names = readdirSync(entry); } catch { continue; }
        for (const name of names) {
          if (hidden.includes(name) || existsSync(path.join(dir, name))) continue;
          try { symlinkSync(path.join(entry, name), path.join(dir, name)); } catch {}
        }
      }
      return dir;
    };
    const unlocked = 'flock is not installed here: this step runs without the lock';
    for (const hidden of [['flock', 'setpriv'], ['flock'], ['setpriv']]) {
      const repo = makeRepository();
      const env = { ...repo.env, PATH: pathWithout(hidden) };
      assert.equal(hasFlock(env), !hidden.includes('flock') && hasFlock(), hidden.join(','));
      assert.equal(hasPdeathsig(env), !hidden.includes('setpriv') && hasPdeathsig(), hidden.join(','));
      const line = hasFlock(env) ? 'setpriv --pdeathsig is not available here' : unlocked;
      repo.git(['checkout', '--quiet', '-b', 'feature']);
      repo.commit('feature', { 'src/b.js': '1\n' });
      const passed = await verify('pr', [], { ...repo.options, env });
      assert.equal(passed.status, 0, hidden.join(','));
      assert.ok(repo.runs().includes('lint'), 'the step ran');
      assert.ok(repo.lines.some((entry) => entry.includes(line)), `${hidden.join(',')}: ${repo.lines.join('\n')}`);
      repo.commit('break', { 'src/a.js': 'nope\n' });
      const failed = await verify('pr', [], { ...repo.options, env });
      assert.equal(failed.status, 1, hidden.join(','));
      assert.equal(failed.proof.result, 'failed');
    }
  });

  test('a check killed by a signal fails and is never passed', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const config = readFileSync(path.join(repo.work, 'verify-local.config.mjs'), 'utf8');
    repo.commit('killed', { 'verify-local.config.mjs': config.replace(`command: 'echo lint >> "$RUN_LOG"'`, () => `command: 'kill -KILL $$'`) });
    const { status, proof } = await verify('pr', [], repo.options);
    assert.equal(status, 1);
    assert.equal(proof.result, 'failed');
    const lint = proof.checks.find((check) => check.name === 'lint');
    assert.equal(lint.result, 'failed');
    assert.match(lint.reason ?? '', /killed/);
    assert.ok(repo.lines.some((line) => line.includes('counts as failed')), repo.lines.join('\n'));
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

  test('variables that narrow what a check runs are stripped from the environment', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const config = readFileSync(path.join(repo.work, 'verify-local.config.mjs'), 'utf8')
      .replace("mainBranch: 'main',", "mainBranch: 'main',\n  stripEnv: ['MY_SCOPE'],")
      .replace(
        "command: 'echo lint >> \"$RUN_LOG\"'",
        "command: 'echo \"lint:${JEST_CHANGED_SINCE-unset}:${TURBO_SCM_HEAD-unset}:${MY_SCOPE-unset}:${TURBO_SCM_BASE-unset}\" >> \"$RUN_LOG\"', env: { TURBO_SCM_BASE: 'origin/main' }",
      );
    repo.commit('scope', { 'verify-local.config.mjs': config });
    const narrowed = { JEST_CHANGED_SINCE: 'HEAD', TURBO_SCM_HEAD: 'HEAD', TURBO_SCM_BASE: 'HEAD', MY_SCOPE: 'x' };
    const { status } = await verify('pr', [], { ...repo.options, env: { ...repo.env, ...narrowed } });
    assert.equal(status, 0);
    // A check's own env still applies: here it sets TURBO_SCM_BASE itself.
    assert.ok(repo.runs().includes('lint:unset:unset:unset:origin/main'), repo.runs().join('\n'));
    assert.ok(repo.lines.some((line) => line.includes('ignored JEST_CHANGED_SINCE, TURBO_SCM_BASE, TURBO_SCM_HEAD, MY_SCOPE from the environment')));
  });
});

describe('verify:release and the deploy guard', () => {
  test('release runs every check again, even one the PR proof of the same tree passed, and covers the requested targets', async () => {
    const repo = makeRepository();
    // The release runs the database check too: say the database is up.
    repo.env.DB_AVAILABLE = '1';
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const head = repo.commit('feature', { 'src/b.js': '1\n' });
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    repo.clearRuns();

    const release = await verify('release', ['--target', 'site'], repo.options);
    assert.equal(release.status, 0);
    assert.deepEqual(repo.runs(), ['lint', 'test', 'db', 'site-check', `build:${head}`, 'site']);
    assert.ok(release.proof.checks.every((check) => !check.reused), 'a release reuses nothing');
    assert.deepEqual(release.proof.targets, ['site']);

    // A PR run on the same tree keeps the release proof.
    await verify('pr', [], repo.options);
    const tree = repo.git(['rev-parse', `${head}^{tree}`]);
    assert.equal(readProof(path.join(repo.work, '.git'), tree).kind, 'release');

    const unknown = spawnSync(process.execPath, [ENGINE, 'release', '--target', 'nope'], { cwd: repo.work, env: repo.env, encoding: 'utf8' });
    assert.equal(unknown.status, 64);
  });

  test('on the main commit, a release runs every check, when ones included, while a PR run has nothing in scope', async () => {
    const repo = makeRepository();
    // The release runs the database check too: say the database is up.
    repo.env.DB_AVAILABLE = '1';
    const head = repo.commit('site', { 'site/index.html': '<p>ok</p>\n' });
    repo.git(['push', '--quiet', 'origin', 'main']);
    const { status, proof } = await verify('release', [], repo.options);
    assert.equal(status, 0);
    assert.equal(proof.sha, head);
    assert.equal(proof.checks.find((check) => check.name === 'db').result, 'passed');
    assert.ok(repo.runs().includes('site-check'));
    assert.ok(repo.runs().includes('db'), 'a when check runs at release although nothing changed since origin/main');
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

  test('a release runs again a check whose identical inputs passed on another tree', async () => {
    const repo = makeRepository();
    // The release runs the database check too: say the database is up.
    repo.env.DB_AVAILABLE = '1';
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    repo.commit('feature', { 'src/b.js': '1\n' });
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    repo.commit('docs', { 'docs/readme.md': '# more\n' });
    repo.clearRuns();
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    assert.ok(!repo.runs().includes('lint'), 'a PR reuses lint: its inputs (src/**) did not change');
    repo.clearRuns();
    const release = await verify('release', [], repo.options);
    assert.equal(release.status, 0);
    assert.ok(repo.runs().includes('lint'), 'a release runs lint again');
  });

  test('a failed or incomplete release run never replaces a passed PR proof', async () => {
    const repo = makeRepository();
    // The release runs the database check too: say the database is up.
    repo.env.DB_AVAILABLE = '1';
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
    assert.deepEqual(repo.runs(), ['lint', 'test', 'db', 'site-check', `build:${head}`], 'every release check runs again');
    assert.equal(readProof(commonDir, tree).kind, 'release');
  });

  test('a failed run for one more target never replaces a passed release proof', async () => {
    const repo = makeRepository();
    // The release runs the database check too: say the database is up.
    repo.env.DB_AVAILABLE = '1';
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const head = repo.commit('feature', { 'src/b.js': '1\n' });
    assert.equal((await verify('release', [], repo.options)).status, 0);
    const failing = await verify('release', ['--target', 'site'], { ...repo.options, env: { ...repo.env, FAIL_BUILD: '1' } });
    assert.equal(failing.status, 1, 'the build runs again and fails');
    const commonDir = path.join(repo.work, '.git');
    const tree = repo.git(['rev-parse', `${head}^{tree}`]);
    const kept = readProof(commonDir, tree);
    assert.equal(kept.result, 'passed');
    assert.deepEqual(kept.targets, []);
    assert.ok(existsSync(path.join(commonDir, 'verify-proofs', `${tree}.release-attempt.json`)));

    // A passing run for the target extends the proof of the same commit.
    assert.equal((await verify('release', ['--target', 'site'], repo.options)).status, 0);
    assert.deepEqual(readProof(commonDir, tree).targets, ['site']);
  });

  test('a check that needs a real install replaces the linked node_modules first', async () => {
    const repo = makeRepository();
    // The release runs the database check too: say the database is up.
    repo.env.DB_AVAILABLE = '1';
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
    // The release runs the database check too: say the database is up.
    repo.env.DB_AVAILABLE = '1';
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
    assert.deepEqual(repo.runs(), ['lint', 'test', 'db', 'site-check', `build:${squash}`], 'every release check runs again on the delivered commit');
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

  test('the deploy guard refuses a forged external entry and a proof of an older format', async () => {
    const repo = makeRepository();
    const head = repo.git(['rev-parse', 'HEAD']);
    const tree = repo.git(['rev-parse', 'HEAD^{tree}']);
    const commonDir = path.join(repo.work, '.git');
    const forged = (version, external) => ({
      version, rule: 'regle-commune-livraison v2', kind: 'release', sha: head, tree, clean: true, result: 'passed',
      startedAt: 'x', finishedAt: 'x', command: 'x', node: process.version, packageManager: null, targets: [],
      checks: [{ name: 'test', result: 'passed', external, specialised: false }],
    });
    mkdirSync(path.join(commonDir, 'verify-proofs'), { recursive: true });
    const file = path.join(commonDir, 'verify-proofs', `${tree}.json`);

    writeFileSync(file, JSON.stringify(forged(2, 'x')));
    const older = checkReleaseProof({ cwd: repo.work, env: repo.env, fetch: false }).failures;
    assert.deepEqual(older.map((failure) => failure.check), ['proof-present']);
    assert.match(older[0].message, new RegExp(`has format 2, older than ${PROOF_FORMAT_VERSION}`));

    writeFileSync(file, JSON.stringify(forged(PROOF_FORMAT_VERSION, 'x')));
    assert.deepEqual(checkReleaseProof({ cwd: repo.work, env: repo.env, fetch: false }).failures.map((failure) => failure.check), ['proof-external']);

    // A specialised external entry is checked against the repository's own externalSources.
    const proofWith = (external) => ({ ...forged(PROOF_FORMAT_VERSION, external), checks: [{ name: 'db', result: 'passed', external, specialised: true }] });
    const failuresOf = (external, externalSources) => {
      writeFileSync(file, JSON.stringify(proofWith(external)));
      return checkReleaseProof({ cwd: repo.work, env: repo.env, fetch: false, externalSources }).failures.map((failure) => failure.check);
    };
    assert.deepEqual(failuresOf(`owner-machine: tanuki pgTAP on ${head}`), []);
    assert.deepEqual(failuresOf(`owner-machine:x ${head}`), ['proof-external'], 'the deploy guard checks the owner-machine shape too');
    assert.deepEqual(failuresOf(`owner-machine: tanuki pgTAP on ${head.toUpperCase()}`), ['proof-external'], 'an uppercase head alone is refused at deploy');
    assert.deepEqual(failuresOf(`https://ci.example/run/1 on ${head.toUpperCase()}`, ['https://ci.example/run/']), ['proof-external'], 'an uppercase head alone is refused at deploy');
    assert.deepEqual(failuresOf(`https://ci.example/run/1 on ${head}`), ['proof-external'], 'no listed source by default');
    assert.deepEqual(failuresOf(`https://ci.example/run/1 on ${head}`, await loadExternalSources({ cwd: repo.work, env: repo.env })), []);
    assert.deepEqual(failuresOf(`https://other.example/run/1 on ${head}`, ['https://ci.example/run/']), ['proof-external']);
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

  test('proof-block also flags the repository check scripts and package.json changes', async () => {
    const repo = makeRepository();
    const config = readFileSync(path.join(repo.work, 'verify-local.config.mjs'), 'utf8')
      .replace("mainBranch: 'main',", "mainBranch: 'main',\n  deliveryFiles: ['scripts/lint-changed.mjs'],");
    repo.commit('declare', { 'verify-local.config.mjs': config });
    repo.git(['push', '--quiet', 'origin', 'main']);
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    repo.commit('weaken', {
      'scripts/lint-changed.mjs': 'process.exit(0);\n',
      'package.json': '{ "name": "fixture", "packageManager": "npm@11.0.0", "scripts": { "lint": "true" } }\n',
    });
    await verify('pr', [], repo.options);
    repo.lines.length = 0;
    await proofBlock([], repo.options);
    assert.match(repo.lines.join('\n'), /^- Delivery checks changed: scripts\/lint-changed.mjs, package.json \(needs the owner's review\)$/m);

    // A workspace's scripts, tool config inside a package.json and tool config files count too.
    repo.commit('weaken more', {
      'apps/web/package.json': '{ "name": "web", "scripts": { "test": "true" } }\n',
      'apps/web/tsconfig.json': '{ "compilerOptions": { "strict": false } }\n',
      'eslint.config.mjs': 'export default [];\n',
      'apps/mobile/package.json': '{ "name": "mobile", "jest": { "passWithNoTests": true, "testPathIgnorePatterns": [".*"] } }\n',
      'supabase/functions/deno.json': '{ "test": { "exclude": ["api/"] } }\n',
      'sdk/python/pyproject.toml': '[tool.pytest.ini_options]\naddopts = "--collect-only"\n',
    });
    await verify('pr', [], repo.options);
    repo.lines.length = 0;
    await proofBlock([], repo.options);
    const flagged = repo.lines.join('\n');
    for (const item of ['apps/web/package.json', 'apps/web/tsconfig.json', 'eslint.config.mjs', 'apps/mobile/package.json', 'supabase/functions/deno.json', 'sdk/python/pyproject.toml']) {
      assert.ok(flagged.includes(item), `${item} is flagged`);
    }

    // A dependency or version bump alone is not flagged, nor is a key reordering.
    repo.git(['checkout', '--quiet', 'main']);
    repo.git(['checkout', '--quiet', '-b', 'deps']);
    repo.commit('bump', {
      'package-lock.json': '{ "lockfileVersion": 3, "bump": 1 }\n',
      'package.json': '{ "packageManager": "npm@11.0.0", "name": "fixture", "version": "2.0.0", "dependencies": { "ext": "^1.0.0" } }\n',
    });
    await verify('pr', [], repo.options);
    repo.lines.length = 0;
    await proofBlock([], repo.options);
    assert.doesNotMatch(repo.lines.join('\n'), /Delivery checks changed/);
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

  // A git whose `cat-file --batch` fails or answers short; everything else is real git.
  function fakeGit(repo, mode) {
    const bin = path.join(repo.base, `fake-git-${mode}`);
    mkdirSync(bin, { recursive: true });
    const realGit = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
    const batch = mode === 'fail'
      ? 'exit 1'
      : `"${realGit}" "$@" | head -c 60`;
    writeFileSync(path.join(bin, 'git'), `#!/bin/sh\nif [ "$1" = cat-file ] && [ "$2" = --batch ]; then\n  ${batch}\n  exit $?\nfi\nexec "${realGit}" "$@"\n`, { mode: 0o755 });
    return { ...repo.env, PATH: `${bin}:${process.env.PATH}` };
  }

  for (const mode of ['fail', 'short']) {
    test(`the hook blocks a push when cat-file ${mode === 'fail' ? 'fails' : 'answers short'}`, async () => {
      const repo = makeRepository();
      repo.git(['checkout', '--quiet', '-b', 'feature']);
      const fake = ['AKIA', 'ABCDEFGHIJKLMNOP'].join('');
      const sha = repo.commit('key', { 'src/config.js': `${'// padding\n'.repeat(20)}const key = "${fake}";\n` });
      const output = [];
      const result = await prePush('origin', `refs/heads/feature ${sha} refs/heads/feature ${ZERO}\n`, {
        cwd: repo.work, env: fakeGit(repo, mode), log: (line) => output.push(line), error: (line) => output.push(line),
      });
      assert.equal(result.status, 1, output.join('\n'));
      assert.match(output.join('\n'), /secret scan did not run/);
    });
  }

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
