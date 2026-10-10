// Tests of scripts/verify-local.mjs, the engine of the common delivery rule.
// Each repository keeps and pins its own copy. Run: node --test scripts/test-verify-local.mjs

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  PROOF_FORMAT_VERSION,
  attemptName,
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
  PROOF_LOCK_STALE_MS,
  PROOF_LOCK_WAIT_MS,
  readRunLog,
  openChecks,
  RUN_LOG_UNREADABLE,
  withProofLock,
  runLogName,
  stepGrace,
  status,
  verify,
} from './verify-local.mjs';

const ENGINE = fileURLToPath(new URL('./verify-local.mjs', import.meta.url));
// The engine's sha256 is pinned in this repository's own verify-local.config.mjs
// (export ENGINE_SHA256). No other repository is read or compared.
const CONFIG_PATH = fileURLToPath(new URL('../verify-local.config.mjs', import.meta.url));
const scratch = mkdtempSync(path.join(os.tmpdir(), 'verify-local-test-'));

/** Whether a process is gone (or a zombie waiting to be reaped), within about 5 s. */
async function gone(pid) {
  const dead = () => {
    try { process.kill(pid, 0); } catch { return true; }
    try { return /^\d+ \(.*\) Z/.test(readFileSync(`/proc/${pid}/stat`, 'utf8')); } catch { return false; }
  };
  for (let i = 0; i < 100 && !dead(); i += 1) await new Promise((resolve) => setTimeout(resolve, 50));
  return dead();
}
after(() => rmSync(scratch, { recursive: true, force: true }));

const CONFIG = `export default {
  mainBranch: 'main',
  commands: { pr: 'npm run verify:pr', release: 'npm run verify:release' },
  deps: { mode: 'link', lockfile: 'package-lock.json', install: 'echo install >> "$RUN_LOG" && mkdir -p node_modules' },
  checks: [
    { name: 'lint', command: 'echo lint >> "$RUN_LOG"', inputs: ['src/**'] },
    { name: 'test', command: 'echo test >> "$RUN_LOG" && grep -q ok src/a.js && test -z "$GIT_DIR" && test -z "$FAIL_TEST"' },
    { name: 'db', command: 'echo db >> "$RUN_LOG" && test -z "$FAIL_DB"', when: ['db/'], specialised: true, requires: { command: 'test -n "$DB_AVAILABLE"', hint: 'start the database' } },
    { name: 'site', command: 'echo site-check >> "$RUN_LOG"', when: ['site/'], releaseAlways: true },
    { name: 'build', command: 'echo build:$VERIFY_LOCAL_SHA >> "$RUN_LOG" && test -z "$FAIL_BUILD"', kinds: ['release'], perCommit: true },
    { name: 'bundle', command: 'echo bundle >> "$RUN_LOG" && test ! -e node_modules/ext && test -z "$FAIL_BUNDLE"', kinds: ['release'], targets: ['app'], install: true },
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

  test('an https:// URL is under a listed source only after parsing: no dot segment, user info, port, query or fragment', () => {
    const sha = 'c'.repeat(40);
    const listed = ['https://github.com/thannous/shapier/'];
    const issue = (url) => externalEvidenceIssue(null, `${url} on ${sha}`, sha, null, listed);
    assert.equal(issue('https://github.com/thannous/shapier/actions/runs/42'), null, 'a listed URL passes');
    assert.equal(issue('https://GitHub.com/thannous/shapier/actions/runs/42'), null, 'the host compares in any case');
    assert.equal(issue('https://github.com:443/thannous/shapier/actions/runs/42'), null, 'the default port is the same origin');
    const refused = [
      ['https://github.com/thannous/shapier/../other/42', /dot segment/],
      ['https://github.com/thannous/shapier/./42', /dot segment/],
      ['https://github.com/thannous/shapier/%2e%2e/other/42', /percent-encoded dot/],
      ['https://github.com/thannous/shapier/%2E%2E/other/42', /percent-encoded dot/],
      ['https://github.com/thannous/shapier/%2e./other/42', /percent-encoded dot/],
      ['https://github.com/thannous/shapier/x%2Fother', /percent-encoded dot or path separator/],
      ['https://github.com/thannous/shapier\\..\\other/42', /backslash/],
      ['https://user@github.com/thannous/shapier/actions/runs/42', /user info/],
      ['https://github.com@evil.example/thannous/shapier/actions/runs/42', /user info/],
      ['https://github.com:8443/thannous/shapier/actions/runs/42', /non-default port \(8443\)/],
      ['https://github.com/thannous/shapier/actions/runs/42?next=/other', /query or fragment/],
      ['https://github.com/thannous/shapier/actions/runs/42#../../other', /query or fragment/],
      ['https://github.com/thannous/shapier-evil/actions/runs/42', /not under an external CI source/],
      ['https://github.com/thannous/shapier', /not under an external CI source/],
      ['https://github.com.evil.example/thannous/shapier/actions/runs/42', /not under an external CI source/],
      // A URL must cite a run: not the bare source, no empty segment, no encoding.
      ['https://github.com/thannous/shapier/', /cites no run/],
      ['https://github.com/thannous/shapier//', /empty path segment/],
      ['https://github.com/thannous/shapier/actions/runs//', /empty path segment/],
      ['https://github.com/thannous/shapier/actions/runs//evil', /empty path segment/],
      ['https://github.com/thannous/shapier/actions/runs/%20', /percent-encoding/],
      ['https://github.com./thannous/shapier/actions/runs/42', /host ends with a dot/],
    ];
    // Whitespace ends the URL: what is left is the bare source.
    assert.match(issue('https://github.com/thannous/shapier/ actions/runs/42') ?? '', /cites no run/);
    for (const [url, reason] of refused) assert.match(issue(url) ?? '', reason, url);
    // A source in the config must itself be a clean URL.
    const base = { checks: [{ name: 'a', command: 'true' }] };
    for (const bad of ['https://github.com/o/r/../x/', 'https://u@github.com/o/r/', 'https://github.com:8443/o/r/', 'https://github.com/o/r/?x/', 'https://github.com/o/%2e%2e/', 'https://github.com./a/', 'https://github.com/a//b/', 'https://github.com/a%20b/']) {
      assert.throws(() => normaliseConfig({ ...base, externalSources: [bad] }), /externalSources/, bad);
    }
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
    const attempt = JSON.parse(readFileSync(path.join(repo.work, '.git', 'verify-proofs', attemptName(tree, 'pr', squash)), 'utf8'));
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

  test('a process a check leaves behind is killed when the step ends, and the lock is free', { skip: hasFlock() ? false : 'flock is not installed here (macOS has none by default): the engine runs steps without the lock' }, async () => {
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
      assert.ok(await gone(Number(readFileSync(pidFile, 'utf8'))), 'the background process was killed with the step group');
    } finally {
      if (existsSync(pidFile)) try { process.kill(Number(readFileSync(pidFile, 'utf8')), 'SIGKILL'); } catch {}
    }
  });

  test('a SIGKILLed verify run leaves no step process running and the lock free', {
    skip: process.platform !== 'linux' ? `Linux only (${process.platform}): the test needs util-linux flock and /proc semantics`
      : !hasFlock() ? 'flock is not installed here: the engine runs steps without the lock'
      : false,
  }, async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const lock = repo.env.VERIFY_LOCAL_HEAVY_LOCK;
    const stepPid = path.join(repo.work, '..', 'step.pid');
    const childPid = path.join(repo.work, '..', 'child.pid');
    const config = readFileSync(path.join(repo.work, 'verify-local.config.mjs'), 'utf8');
    // The step's shell, a background child and a foreground sleep: all of them
    // belong to the step group the engine owns.
    repo.commit('slow', {
      'verify-local.config.mjs': config.replace(`command: 'echo lint >> "$RUN_LOG"'`, () => `command: 'sleep 300 > /dev/null 2>&1 & echo $! > ${childPid}; echo $$ > ${stepPid}; sleep 300'`),
    });
    const run = spawn(process.execPath, [ENGINE, 'pr'], { cwd: repo.work, env: repo.env, stdio: 'ignore' });
    const wait = async (condition) => {
      for (let i = 0; i < 200 && !condition(); i += 1) await new Promise((resolve) => setTimeout(resolve, 50));
      return condition();
    };
    const pids = () => [stepPid, childPid].map((file) => Number(readFileSync(file, 'utf8')));
    try {
      assert.ok(await wait(() => existsSync(stepPid) && existsSync(childPid)), 'the step started');
      assert.notEqual(spawnSync('flock', ['--nonblock', lock, 'true']).status, 0, 'the step holds the lock');
      run.kill('SIGKILL');
      assert.ok(await wait(() => spawnSync('flock', ['--nonblock', lock, 'true']).status === 0), 'the lock is free after the run was killed');
      for (const pid of pids()) assert.ok(await gone(pid), `step process ${pid} was killed with the run`);
    } finally {
      run.kill('SIGKILL');
      for (const file of [stepPid, childPid]) if (existsSync(file)) try { process.kill(Number(readFileSync(file, 'utf8')), 'SIGKILL'); } catch {}
    }
  });

  for (const [how, stopRun] of [
    ['a SIGKILLed verify', (run) => run.kill('SIGKILL')],
    // A closed terminal: HUP to the whole foreground group, the supervisor included.
    ['a SIGHUP to the verify group', (run) => process.kill(-run.pid, 'SIGHUP')],
    // Ctrl-backslash: QUIT to the whole foreground group.
    ['a SIGQUIT to the verify group', (run) => process.kill(-run.pid, 'SIGQUIT')],
  ]) test(`${how} stops the step with TERM first, so its trap frees a server it started in another session, and the lock is held until the trap is done`, {
    skip: process.platform !== 'linux' ? `Linux only (${process.platform}): the test needs util-linux setsid and /proc semantics`
      : spawnSync('setsid', ['--version'], { stdio: 'ignore' }).status !== 0 ? 'setsid is not installed here'
      : !hasFlock() ? 'flock is not installed here: the engine runs steps without the lock'
      : false,
  }, async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const dir = mkdtempSync(path.join(scratch, 'server-'));
    const port = await new Promise((resolve) => {
      const probe = net.createServer().listen(0, '127.0.0.1', () => { const { port: free } = probe.address(); probe.close(() => resolve(free)); });
    });
    // Like the verify-skillcodex launcher: the server runs in its own session
    // (outside the step group), and the step's TERM trap stops it.
    writeFileSync(path.join(dir, 'step.sh'), [
      `setsid ${JSON.stringify(process.execPath)} -e "require('net').createServer().listen(${port}, '127.0.0.1')" &`,
      `echo $! > ${dir}/server.pid`,
      // A teardown that takes a while: the lock must stay held until it ends.
      `trap 'kill $(cat ${dir}/server.pid); sleep 1; echo done > ${dir}/teardown.done; exit 143' TERM`,
      `echo $$ > ${dir}/step.pid`,
      'sleep 300 &',
      'wait',
      '',
    ].join('\n'));
    const config = readFileSync(path.join(repo.work, 'verify-local.config.mjs'), 'utf8');
    repo.commit('server', { 'verify-local.config.mjs': config.replace(`command: 'echo lint >> "$RUN_LOG"'`, () => `command: 'sh ${dir}/step.sh'`) });
    const listening = () => new Promise((resolve) => {
      const socket = net.connect(port, '127.0.0.1');
      socket.on('connect', () => { socket.destroy(); resolve(true); });
      socket.on('error', () => resolve(false));
    });
    const waitFor = async (condition) => {
      for (let i = 0; i < 200; i += 1) {
        if (await condition()) return true;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return condition();
    };
    const run = spawn(process.execPath, [ENGINE, 'pr'], { cwd: repo.work, env: repo.env, stdio: 'ignore', detached: true });
    try {
      assert.ok(await waitFor(async () => existsSync(path.join(dir, 'step.pid')) && await listening()), 'the step started its server');
      stopRun(run);
      const lockFree = () => spawnSync('flock', ['--nonblock', repo.env.VERIFY_LOCAL_HEAVY_LOCK, 'true']).status === 0;
      assert.ok(await waitFor(async () => lockFree()), 'the lock is free once the step is stopped');
      assert.ok(existsSync(path.join(dir, 'teardown.done')), 'the lock was held until the step teardown ended');
      assert.ok(await waitFor(async () => !(await listening())), 'the server stopped: the port is free');
      assert.ok(await gone(Number(readFileSync(path.join(dir, 'server.pid'), 'utf8'))), 'the server in another session is gone');
      assert.ok(await gone(Number(readFileSync(path.join(dir, 'step.pid'), 'utf8'))), 'the step shell is gone');
      assert.equal(spawnSync('flock', ['--nonblock', repo.env.VERIFY_LOCAL_HEAVY_LOCK, 'true']).status, 0, 'the lock is free');
    } finally {
      run.kill('SIGKILL');
      for (const name of ['server.pid', 'step.pid']) {
        const file = path.join(dir, name);
        if (existsSync(file)) try { process.kill(Number(readFileSync(file, 'utf8')), 'SIGKILL'); } catch {}
      }
    }
  });

  test('a step that ignores TERM is killed after the grace period', {
    skip: process.platform !== 'linux' ? `Linux only (${process.platform}): the test needs /proc semantics` : false,
  }, async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const pidFile = path.join(repo.work, '..', 'stubborn.pid');
    const config = readFileSync(path.join(repo.work, 'verify-local.config.mjs'), 'utf8');
    repo.commit('stubborn', { 'verify-local.config.mjs': config.replace(`command: 'echo lint >> "$RUN_LOG"'`, () => `command: 'trap "" TERM; echo $$ > ${pidFile}; sleep 300'`) });
    const run = spawn(process.execPath, [ENGINE, 'pr'], { cwd: repo.work, env: { ...repo.env, VERIFY_LOCAL_STEP_GRACE_MS: '300' }, stdio: 'ignore' });
    try {
      for (let i = 0; i < 200 && !existsSync(pidFile); i += 1) await new Promise((resolve) => setTimeout(resolve, 50));
      assert.ok(existsSync(pidFile), 'the step started');
      await new Promise((resolve) => setTimeout(resolve, 100));
      run.kill('SIGKILL');
      assert.ok(await gone(Number(readFileSync(pidFile, 'utf8'))), 'the step that ignores TERM was killed');
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

      repo.git(['checkout', '--quiet', '-b', 'feature']);
      repo.commit('feature', { 'src/b.js': '1\n' });
      const passed = await verify('pr', [], { ...repo.options, env });
      assert.equal(passed.status, 0, hidden.join(','));
      assert.ok(repo.runs().includes('lint'), 'the step ran');
      assert.equal(repo.lines.some((entry) => entry.includes(unlocked)), !hasFlock(env), `${hidden.join(',')}: ${repo.lines.join('\n')}`);
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
    assert.ok(existsSync(path.join(commonDir, 'verify-proofs', attemptName(tree, 'release', head))));

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
    assert.ok(existsSync(path.join(commonDir, 'verify-proofs', attemptName(tree, 'release', head))));

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

  test('a deploy needs the latest release run of the commit passed and no open check, whatever the times', async () => {
    const repo = makeRepository();
    repo.env.DB_AVAILABLE = '1';
    const head = repo.commit('site', { 'site/index.html': '<p>ok</p>\n' });
    repo.git(['push', '--quiet', 'origin', 'main']);
    const guard = () => checkReleaseProof({ cwd: repo.work, env: repo.env, fetch: false }).failures;
    const checks = () => guard().map((failure) => failure.check);
    const proofs = path.join(repo.work, '.git', 'verify-proofs');
    const append = (entry) => writeFileSync(path.join(proofs, runLogName(head)), `${JSON.stringify({ sha: head, ...entry })}\n`, { flag: 'a' });
    assert.equal((await verify('release', [], repo.options)).status, 0);
    assert.deepEqual(guard(), []);
    // Pass, then fail: refused.
    assert.equal((await verify('release', [], { ...repo.options, env: { ...repo.env, FAIL_BUILD: '1' } })).status, 1);
    let failures = guard();
    assert.deepEqual(failures.map((failure) => failure.check), ['proof-latest-release', 'proof-open-check']);
    assert.match(failures[0].message, new RegExp(`^the latest release run of ${head} failed at `));
    assert.match(failures[1].message, new RegExp(`^open on ${head}: build \\(release failed at [^)]+\\); a run that really reruns them must pass, then verify:release on HEAD$`));
    // Pass, fail, pass: accepted.
    assert.equal((await verify('release', [], repo.options)).status, 0);
    assert.deepEqual(guard(), []);
    // A failed PR check after the release pass: refused.
    assert.equal((await verify('pr', ['--force'], { ...repo.options, env: { ...repo.env, FAIL_TEST: '1' } })).status, 1);
    assert.deepEqual(checks(), ['proof-open-check']);
    assert.match(guard()[0].message, /: test \(pr failed at /);
    // The next PR run cannot reuse that check: it really reruns it (here it fails again).
    repo.clearRuns();
    assert.equal((await verify('pr', [], { ...repo.options, env: { ...repo.env, FAIL_TEST: '1' } })).status, 1);
    assert.ok(repo.runs().includes('test'), 'the open check ran again, it was not reused');
    assert.deepEqual(checks(), ['proof-open-check']);
    // A reused pass (0 run) never closes it.
    append({ kind: 'pr', result: 'passed', finishedAt: new Date().toISOString(), checks: [{ name: 'lint', result: 'passed', reused: true }, { name: 'test', result: 'passed', reused: true }] });
    assert.deepEqual(checks(), ['proof-open-check']);
    // A real rerun that passes closes it.
    repo.clearRuns();
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    assert.ok(repo.runs().includes('test'));
    assert.deepEqual(guard(), []);
    // No clock: a failed result stamped 2020 is still open, until a real pass after it.
    append({ kind: 'pr', result: 'failed', finishedAt: '2020-01-01T00:01:00.000Z', checks: [{ name: 'lint', result: 'failed' }] });
    assert.deepEqual(checks(), ['proof-open-check']);
    assert.match(guard()[0].message, /lint \(pr failed at 2020-01-01T00:01:00\.000Z\)/);
    assert.equal((await verify('release', [], repo.options)).status, 0);
    assert.deepEqual(guard(), []);
    // Pass, then incomplete: refused.
    assert.equal((await verify('release', [], { ...repo.options, env: { ...repo.env, DB_AVAILABLE: '' } })).status, 2);
    assert.deepEqual(checks(), ['proof-latest-release', 'proof-open-check']);
    // A proof without a run log (an older engine) is refused.
    rmSync(path.join(proofs, runLogName(head)));
    assert.deepEqual(checks(), ['proof-latest-release']);
  });

  for (const [how, spoil] of [
    ['a truncated last line', (text) => `${text}{"kind":"release","sha":"`],
    ['garbage JSON in the middle', (text) => { const lines = text.trimEnd().split('\n'); return `${[lines[0], '{not json', ...lines.slice(1)].join('\n')}\n`; }],
  ]) test(`${how} in the run log opens every known check, each until its own real pass`, async () => {
    const repo = makeRepository();
    repo.env.DB_AVAILABLE = '1';
    const head = repo.commit('site', { 'site/index.html': '<p>ok</p>\n' });
    repo.git(['push', '--quiet', 'origin', 'main']);
    const guard = () => checkReleaseProof({ cwd: repo.work, env: repo.env, fetch: false }).failures;
    const file = path.join(repo.work, '.git', 'verify-proofs', runLogName(head));
    assert.equal((await verify('release', [], repo.options)).status, 0);
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    assert.deepEqual(guard(), []);
    writeFileSync(file, spoil(readFileSync(file, 'utf8')));
    let failures = guard();
    assert.deepEqual(failures.map((failure) => failure.check), ['proof-open-check']);
    assert.match(failures[0].message, new RegExp(`open on ${head}: lint \\(unreadable run log line \\d+, counts as failed\\)`));
    for (const name of ['lint', 'test', 'db', 'site', 'build', 'bundle', 'site-e2e']) assert.ok(failures[0].message.includes(`${name} (unreadable`), name);
    repo.lines.length = 0;
    await status(['--json'], repo.options);
    const shown = JSON.parse(repo.lines.join('\n')).openChecks;
    assert.equal(shown.length, 7);
    assert.ok(shown.every((item) => item.kind === 'unreadable'));
    repo.lines.length = 0;
    await proofBlock([], repo.options);
    assert.match(repo.lines.join('\n'), /^- Open on this commit: lint \(unreadable run log line \d+/m);
    // Nothing is reused after it, and a PR pass does not clear it.
    repo.clearRuns();
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    assert.ok(repo.runs().includes('lint') && repo.runs().includes('test'), `nothing reused: ${repo.runs().join(',')}`);
    assert.deepEqual(guard().map((failure) => failure.check), ['proof-open-check']);
    // A plain release closes what it runs; the target-only checks stay open
    // until a run of their targets. Each entry is on a line of its own even
    // after a torn last line.
    assert.equal((await verify('release', [], repo.options)).status, 0);
    assert.equal(readRunLog(path.join(repo.work, '.git'), head).at(-1).kind, 'release');
    failures = guard();
    assert.deepEqual(failures.map((failure) => failure.check), ['proof-open-check']);
    assert.match(failures[0].message, /: bundle \(unreadable.*site-e2e \(unreadable/);
    assert.equal((await verify('release', ['--target', 'app', '--target', 'site'], repo.options)).status, 0);
    assert.deepEqual(guard(), []);
  });

  test('after an unreadable line, a skipped target-only or `when` check stays open until it really passes', async () => {
    const repo = makeRepository();
    repo.env.DB_AVAILABLE = '1';
    const head = repo.commit('site', { 'site/index.html': '<p>ok</p>\n' });
    repo.git(['push', '--quiet', 'origin', 'main']);
    const guard = (targets = []) => checkReleaseProof({ cwd: repo.work, env: repo.env, fetch: false, targets }).failures;
    const file = path.join(repo.work, '.git', 'verify-proofs', runLogName(head));
    const cut = () => { const text = readFileSync(file, 'utf8'); writeFileSync(file, text.slice(0, text.length - 40)); };
    const openNames = (targets) => {
      const failure = guard(targets).find((item) => item.check === 'proof-open-check');
      return failure ? failure.message : '';
    };
    // Target-only check: target-app pass, target-app fail, then the failure line is cut.
    assert.equal((await verify('release', ['--target', 'app'], repo.options)).status, 0);
    assert.equal((await verify('release', ['--target', 'app'], { ...repo.options, env: { ...repo.env, FAIL_BUNDLE: '1' } })).status, 1);
    cut();
    // A plain release skips bundle: it stays open, and the guard for target app refuses.
    assert.equal((await verify('release', [], repo.options)).status, 0);
    assert.match(openNames(['app']), /\bbundle \(unreadable/);
    // A real pass of bundle closes it.
    assert.equal((await verify('release', ['--target', 'app', '--target', 'site'], repo.options)).status, 0);
    assert.deepEqual(guard(['app']), []);

    // `when` check: db passes, then fails, then the failure line is cut. A
    // release always runs `when` checks, so the skip comes from a PR run here.
    assert.equal((await verify('release', [], { ...repo.options, env: { ...repo.env, FAIL_DB: '1' } })).status, 1);
    cut();
    repo.clearRuns();
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    assert.ok(!repo.runs().includes('db'), 'the PR run left db out of scope');
    assert.match(openNames([]), /\bdb \(unreadable/);
    repo.clearRuns();
    assert.equal((await verify('release', ['--target', 'app', '--target', 'site'], repo.options)).status, 0);
    assert.ok(repo.runs().includes('db'));
    assert.deepEqual(guard(['app']), []);
  });

  test('an unreadable line opens each known check; only its own real pass closes it', () => {
    const bad = { kind: 'unreadable', result: 'unreadable', line: 2, finishedAt: null, checks: [] };
    assert.deepEqual(openChecks([bad]).map((item) => item.check), [RUN_LOG_UNREADABLE], 'no check known yet');
    const log = [
      { kind: 'release', result: 'passed', finishedAt: 't1', known: ['a', 'b', 'c', 'd'], checks: [{ name: 'a', result: 'passed' }] },
      bad,
      { kind: 'pr', result: 'passed', finishedAt: 't2', checks: [{ name: 'a', result: 'passed' }, { name: 'b', result: 'passed', reused: true }, { name: 'c', result: 'skipped' }] },
    ];
    assert.deepEqual(openChecks(log).map((item) => item.check), ['b', 'c', 'd']);
    assert.deepEqual(openChecks(log, ['e']).map((item) => item.check).sort(), ['b', 'c', 'd', 'e']);
  });

  test('the proof lock waits, takes over a stale lock once, and a run that cannot get it fails without dropping its record', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const head = repo.commit('feature', { 'src/b.js': '1\n' });
    const commonDir = path.join(repo.work, '.git');
    const proofs = path.join(commonDir, 'verify-proofs');
    mkdirSync(proofs, { recursive: true });
    const lock = path.join(proofs, '.proof.lock');
    assert.ok(PROOF_LOCK_WAIT_MS > PROOF_LOCK_STALE_MS, 'a run waits longer than the stale age');
    // A live lock: no takeover; the run waits, then fails, and its result is in the run log.
    writeFileSync(lock, 'another run');
    assert.deepEqual(withProofLock(commonDir, () => 'x', { waitMs: 200 }), { locked: false });
    const run = await verify('pr', [], { ...repo.options, proofLock: { waitMs: 200 } });
    assert.equal(run.status, 1);
    assert.ok(repo.lines.some((line) => line.includes('the proof lock') && line.includes('counts as failed')), repo.lines.join('\n'));
    const tree = repo.git(['rev-parse', `${head}^{tree}`]);
    assert.equal(readProof(commonDir, tree), null, 'no proof was written without the lock');
    assert.equal(readRunLog(commonDir, head).at(-1).proofLock, 'timeout');
    // A stale lock is taken over.
    utimesSync(lock, new Date('2020-01-01'), new Date('2020-01-01'));
    assert.deepEqual(withProofLock(commonDir, () => 'x', { waitMs: 200 }), { locked: true, value: 'x' });
    assert.ok(!existsSync(lock));
    // Several waiters on one stale lock: never two holders at once.
    writeFileSync(lock, 'dead run');
    utimesSync(lock, new Date('2020-01-01'), new Date('2020-01-01'));
    const trace = path.join(repo.base, 'trace');
    const script = `import { withProofLock } from ${JSON.stringify(pathToFileURL(ENGINE).href)};
      import { appendFileSync } from 'node:fs';
      const pause = new Int32Array(new SharedArrayBuffer(4));
      const r = withProofLock(${JSON.stringify(commonDir)}, () => { appendFileSync(${JSON.stringify(trace)}, 'in\\n'); Atomics.wait(pause, 0, 0, 50); appendFileSync(${JSON.stringify(trace)}, 'out\\n'); });
      if (!r.locked) process.exit(3);`;
    const waiters = Array.from({ length: 4 }, () => new Promise((resolve) => {
      spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: 'ignore' }).on('exit', resolve);
    }));
    assert.deepEqual(await Promise.all(waiters), [0, 0, 0, 0]);
    assert.equal(readFileSync(trace, 'utf8'), 'in\nout\n'.repeat(4), 'the holders never overlapped');
  });

  test('a failed release that is the first run of a commit stays open under a later PR pass', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const head = repo.commit('feature', { 'src/b.js': '1\n' });
    assert.equal((await verify('release', [], { ...repo.options, env: { ...repo.env, DB_AVAILABLE: '1', FAIL_BUILD: '1' } })).status, 1);
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    repo.lines.length = 0;
    await proofBlock([], repo.options);
    const shown = repo.lines.join('\n');
    assert.match(shown, /^- Result: passed, pr proof/m);
    assert.match(shown, /^- Open on this commit: build \(release failed at [^)]+\); a run that really reruns them must pass$/m);
    repo.git(['checkout', '--quiet', 'main']);
    repo.git(['reset', '--quiet', '--hard', head]);
    repo.git(['push', '--quiet', 'origin', 'main']);
    const failures = checkReleaseProof({ cwd: repo.work, env: repo.env, fetch: false }).failures.map((failure) => failure.check);
    assert.deepEqual(failures, ['proof-kind', 'proof-latest-release', 'proof-open-check']);
  });

  test('a PR pass that ends while a release fails on the same commit does not erase the failure', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const config = readFileSync(path.join(repo.work, 'verify-local.config.mjs'), 'utf8');
    const flag = path.join(repo.base, 'go');
    // The PR run's lint waits (when asked) until the release run is over.
    const head = repo.commit('wait', {
      'src/b.js': '1\n',
      'verify-local.config.mjs': config.replace(`command: 'echo lint >> "$RUN_LOG"'`, () => `command: 'if [ -n "$WAIT_FLAG" ]; then touch "$WAIT_FLAG.started"; while [ ! -f "$WAIT_FLAG" ]; do sleep 0.05; done; fi; echo lint >> "$RUN_LOG"'`),
    });
    const pr = spawn(process.execPath, [ENGINE, 'pr'], {
      cwd: repo.work,
      env: { ...repo.env, WAIT_FLAG: flag, VERIFY_LOCAL_HEAVY_LOCK: path.join(repo.base, 'pr.lock') },
      stdio: 'ignore',
    });
    const exited = new Promise((resolve) => pr.on('exit', resolve));
    try {
      for (let i = 0; i < 400 && !existsSync(`${flag}.started`); i += 1) await new Promise((resolve) => setTimeout(resolve, 50));
      assert.ok(existsSync(`${flag}.started`), 'the PR run is in its lint step');
      assert.equal((await verify('release', [], { ...repo.options, env: { ...repo.env, DB_AVAILABLE: '1', FAIL_BUILD: '1' } })).status, 1);
      writeFileSync(flag, '');
      assert.equal(await exited, 0, 'the PR run passed');
    } finally {
      pr.kill('SIGKILL');
    }
    const runs = readRunLog(path.join(repo.work, '.git'), head);
    assert.deepEqual(runs.map((entry) => `${entry.kind} ${entry.result}`), ['release failed', 'pr passed']);
    repo.lines.length = 0;
    await status(['--json'], repo.options);
    const shown = JSON.parse(repo.lines.join('\n'));
    assert.equal(shown.kind, 'pr');
    assert.deepEqual(shown.openChecks.map((item) => `${item.check} ${item.kind} ${item.result}`), ['build release failed']);
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
    assert.deepEqual(before.failures.map((failure) => failure.check), ['proof-matches-head', 'proof-latest-release']);

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
    assert.deepEqual(refused.failures.map((failure) => failure.check), ['proof-kind', 'proof-latest-release']);

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
    // Its run log says the release passed, so only the proof itself is judged here.
    writeFileSync(path.join(commonDir, 'verify-proofs', runLogName(head)), `${JSON.stringify({ kind: 'release', sha: head, tree, result: 'passed', finishedAt: 'x', checks: [{ name: 'test', result: 'passed', external: true }] })}\n`);

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

  test('a weaker rerun of the same commit never replaces its passed run beside a release proof, and the proof block names what is open', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const released = repo.commit('migration', { 'db/1.sql': 'select 1;\n' });
    const withDb = { ...repo.options, env: { ...repo.env, DB_AVAILABLE: '1' } };
    assert.equal((await verify('release', [], withDb)).status, 0);
    const tree = repo.git(['rev-parse', `${released}^{tree}`]);
    const head = repo.git(['commit-tree', tree, '-p', released, '-m', 'same tree']);
    repo.git(['checkout', '--quiet', '-b', 'pr', head]);
    assert.equal((await verify('pr', [], withDb)).status, 0);
    const proofs = path.join(repo.work, '.git', 'verify-proofs');
    const block = async () => {
      repo.lines.length = 0;
      await proofBlock([], repo.options);
      return repo.lines.join('\n');
    };
    // Rerun without the database: incomplete. The passed run stays, and the
    // proof block shows what is open on this commit.
    assert.equal((await verify('pr', ['--force'], repo.options)).status, 2);
    assert.ok(repo.lines.some((line) => line.includes('the passed pr run of this commit is kept')), repo.lines.join('\n'));
    assert.equal(JSON.parse(readFileSync(path.join(proofs, attemptName(tree, 'pr', head)), 'utf8')).result, 'passed');
    let shown = await block();
    assert.match(shown, new RegExp(`^- Commit SHA: \`${head}\`$`, 'm'));
    assert.match(shown, /^- Result: passed, pr proof/m);
    assert.match(shown, /^- Open on this commit: db \(pr unavailable at /m);
    repo.lines.length = 0;
    await status([], repo.options);
    assert.ok(repo.lines.some((line) => line.includes('open on this commit: db (pr unavailable at')), repo.lines.join('\n'));
    repo.lines.length = 0;
    await status(['--json'], repo.options);
    assert.deepEqual(JSON.parse(repo.lines.join('\n')).openChecks.map((item) => item.check), ['db']);
    // A rerun that really runs the database check closes it.
    assert.equal((await verify('pr', ['--force'], withDb)).status, 0);
    shown = await block();
    assert.match(shown, /^- Result: passed, pr proof/m);
    assert.doesNotMatch(shown, /Open on/);
    // A release run of the same commit that fails in a release-only check shows too.
    assert.equal((await verify('release', [], { ...withDb, env: { ...withDb.env, FAIL_BUILD: '1' } })).status, 1);
    shown = await block();
    assert.match(shown, /^- Result: passed, pr proof/m);
    assert.match(shown, /^- Open on this commit: build \(release failed at /m);
    // A PR pass does not run that check, so it stays open; a release pass closes it.
    assert.equal((await verify('pr', ['--force'], withDb)).status, 0);
    assert.match(await block(), /^- Open on this commit: build \(release failed at /m);
    assert.equal((await verify('release', [], withDb)).status, 0);
    assert.doesNotMatch(await block(), /Open on/);
  });

  test('the TERM to KILL grace of a step is 5 s by default, clamped to 1 s to 30 s', () => {
    assert.equal(stepGrace({}), 5000);
    for (const [value, expected] of [['', 5000], [' ', 5000], ['abc', 5000], ['-1', 5000], ['Infinity', 5000], ['0', 1000], ['999', 1000], ['1000', 1000], ['2500', 2500], ['30000', 30000], ['99999999', 30000]]) {
      assert.equal(stepGrace({ VERIFY_LOCAL_STEP_GRACE_MS: value }), expected, JSON.stringify(value));
    }
  });

  test('a PR head with the tree of an earlier release proof gets its own proof block, and the release proof stays for a deploy', async () => {
    const repo = makeRepository();
    repo.env.DB_AVAILABLE = '1';
    const released = repo.commit('site', { 'site/index.html': '<p>ok</p>\n' });
    repo.git(['push', '--quiet', 'origin', 'main']);
    assert.equal((await verify('release', [], repo.options)).status, 0);
    // Another commit with the same tree (a squash or a rebase) as the PR head.
    const tree = repo.git(['rev-parse', `${released}^{tree}`]);
    const head = repo.git(['commit-tree', tree, '-p', released, '-m', 'same tree']);
    repo.git(['checkout', '--quiet', '-b', 'feature', head]);
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    assert.ok(repo.lines.some((line) => line.includes('the passed release proof of this tree is kept')), repo.lines.join('\n'));
    repo.lines.length = 0;
    assert.equal((await proofBlock([], repo.options)).status, 0);
    const block = repo.lines.join('\n');
    assert.match(block, new RegExp(`^- Commit SHA: \`${head}\`$`, 'm'), block);
    assert.match(block, /^- Result: passed, pr proof/m);
    repo.lines.length = 0;
    await status([], repo.options);
    assert.ok(repo.lines.some((line) => line.includes(`pr proof passed`) && line.includes(head.slice(0, 12))), repo.lines.join('\n'));
    // The tree's proof is still the release proof of the released commit: a
    // deploy of that commit passes, a deploy of the PR head does not.
    assert.equal(readProof(path.join(repo.work, '.git'), tree).sha, released);
    assert.ok(checkReleaseProof({ cwd: repo.work, env: repo.env, fetch: false }).failures.some((failure) => failure.check === 'head-is-origin-main'));
    repo.git(['checkout', '--quiet', 'main']);
    assert.deepEqual(checkReleaseProof({ cwd: repo.work, env: repo.env, fetch: false }).failures, []);
    repo.git(['checkout', '--quiet', 'feature']);
    // A second PR commit on the same tree keeps its own run: neither overwrites the other.
    const second = repo.git(['commit-tree', tree, '-p', released, '-m', 'same tree again']);
    repo.git(['checkout', '--quiet', '-b', 'second', second]);
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    for (const commit of [head, second]) {
      repo.lines.length = 0;
      await proofBlock(['--rev', commit], repo.options);
      assert.match(repo.lines.join('\n'), new RegExp(`^- Commit SHA: \`${commit}\`$`, 'm'), commit);
      assert.ok(existsSync(path.join(repo.work, '.git', 'verify-proofs', attemptName(tree, 'pr', commit))));
    }
    // With no run for the head, the block falls back to the tree's proof, whose SHA is not the head.
    const other = repo.git(['commit-tree', tree, '-p', released, '-m', 'unverified']);
    repo.lines.length = 0;
    await proofBlock(['--rev', other], repo.options);
    assert.match(repo.lines.join('\n'), new RegExp(`^- Commit SHA: \`${released}\`$`, 'm'));
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
    assert.match(before.output, /no proof yet; run npm run verify:pr before pushing\./);
    await verify('pr', [], repo.options);
    const afterProof = await hookRun(repo, line);
    assert.match(afterProof.output, /pr proof passed/);
    assert.doesNotMatch(afterProof.output, /open/);
    // A check of the same commit that is open shows on the hook line.
    assert.equal((await verify('release', [], { ...repo.options, env: { ...repo.env, DB_AVAILABLE: '1', FAIL_BUILD: '1' } })).status, 1);
    const afterFailure = await hookRun(repo, line);
    assert.match(afterFailure.output, /pr proof passed .*; open on this commit: build \(release failed at /);
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
