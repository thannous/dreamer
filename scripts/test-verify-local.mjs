// Tests of scripts/verify-local.mjs, the engine of the common delivery rule.
// Each repository keeps and pins its own copy. Run: node --test scripts/test-verify-local.mjs

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';

import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { pathToFileURL } from 'node:url';

import { PROOF_FORMAT_VERSION, ENGINE_FILE_SHA256, closeUnended, attemptName, checkFingerprint, checkReleaseProof, cleanGitEnv, normaliseConfig, externalEvidenceIssue, loadExternalSources, globToRegExp, prePush, readBlobs, proofBlock, readProof, PROOF_LOCK_STALE_MS, PROOF_LOCK_WAIT_MS, readRunLog, posixShell, windowsLocalPath, absolutePathEntry, repositoryDirs, createGit, probeShell, takeOverStale, lockIsStale, RUN_MAX_MS, openChecks, RUN_LOG_UNREADABLE, withProofLock, runLogName, stepGrace, status, sweepStaleCopies, claimCopy, COPY_SLOTS, matchesAny, pastDurations, writeProof, verify, githubSlug, commitStatusFor, statusRefusal, STATUS_DESCRIPTION_MAX, STATUS_NOT_POSTED } from './verify-local.mjs';

import { ENGINE, CONFIG_PATH, scratch, CONFIG, makeRepository } from './test-support/verify-fixture.mjs';

describe('engine pin', () => {
  test('the engine matches the ENGINE_SHA256 pinned in this repository config', async () => {
    const {
  ENGINE_SHA256
} = await import(pathToFileURL(CONFIG_PATH).href);
    assert.match(ENGINE_SHA256 ?? '', /^[0-9a-f]{64}$/, 'verify-local.config.mjs exports ENGINE_SHA256');
    const actual = createHash('sha256').update(readFileSync(ENGINE)).digest('hex');
    assert.equal(actual, ENGINE_SHA256, 'scripts/verify-local.mjs differs from the ENGINE_SHA256 pin of verify-local.config.mjs; update the pin after a deliberate engine edit');
  });

  test('the pin is the hash of the committed (LF) engine blob, and .gitattributes keeps the engine files LF', async () => {
    const {
  ENGINE_SHA256
} = await import(pathToFileURL(CONFIG_PATH).href);
    const root = path.dirname(CONFIG_PATH);
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));
    const blob = spawnSync('git', ['show', 'HEAD:scripts/verify-local.mjs'], { cwd: root, env, maxBuffer: 64 * 1024 * 1024 });
    assert.equal(blob.status, 0, String(blob.stderr));
    assert.equal(createHash('sha256').update(blob.stdout).digest('hex'), ENGINE_SHA256, 'commit the engine, then pin the hash of its blob');
    const attributes = readFileSync(path.join(root, '.gitattributes'), 'utf8').split(/\r?\n/);
    for (const line of ['scripts/verify-local*.mjs text eol=lf', 'verify-local.config.mjs text eol=lf']) assert.ok(attributes.includes(line), line);
    const eol = spawnSync('git', ['check-attr', 'eol', '--', 'scripts/verify-local.mjs', 'verify-local.config.mjs'], { cwd: root, env, encoding: 'utf8' });
    assert.equal(eol.stdout.trim().split('\n').filter((line) => line.endsWith(': eol: lf')).length, 2, eol.stdout);
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

  test('a ! glob takes files back, and the last glob that matches a file decides', () => {
    const scope = ['**', '!docs/', 'docs/api.ts', '!**/*.md'];
    assert.ok(matchesAny('src/a.ts', scope));
    assert.ok(!matchesAny('docs/guide.txt', scope));
    assert.ok(matchesAny('docs/api.ts', scope));
    assert.ok(!matchesAny('src/README.md', scope));
    assert.ok(!matchesAny('src/a.ts', ['!docs/']), 'negations alone take nothing');
    for (const field of ['when', 'inputs', 'exclude']) {
      assert.throws(() => normaliseConfig({ checks: [{ name: 'x', command: 'true', [field]: ['!docs/', '**'] }] }), /takes back nothing/);
    }
  });
});

describe('parallel checks', () => {
  const parallelConfig = (lint, testCommand) => CONFIG
    .replace(`{ name: 'lint', command: 'echo lint >> "$RUN_LOG"', inputs: ['src/**'] }`,
      () => `{ name: 'lint', command: ${JSON.stringify(lint)}, inputs: ['src/**'], parallel: true, env: { ONLY_LINT: 'yes' } }`)
    .replace(`{ name: 'test', command: 'echo test >> "$RUN_LOG" && grep -q ok src/a.js && test -z "$GIT_DIR" && test -z "$FAIL_TEST"' }`,
      () => `{ name: 'test', command: ${JSON.stringify(testCommand)}, parallel: true, env: { ONLY_TEST: 'yes' } }`);

  test('checks really overlap, keep their own environment and have individual receipts', async () => {
    const repo = makeRepository();
    // Each waits for its sibling: sequential execution cannot pass. The bound
    // avoids hanging on a scheduler regression; no performance threshold here.
    const wait = (other) => `n=0; until test -f "$RUN_LOG.${other}"; do n=$((n+1)); test "$n" -lt 100 || exit 9; sleep 0.05; done; `;
    repo.commit('parallel', { 'verify-local.config.mjs': parallelConfig(
      `touch "$RUN_LOG.lint"; ${wait('test')}test "$ONLY_LINT" = yes && test -z "$ONLY_TEST" && echo lint >> "$RUN_LOG"`,
      `touch "$RUN_LOG.test"; ${wait('lint')}test "$ONLY_TEST" = yes && test -z "$ONLY_LINT" && echo test >> "$RUN_LOG"`,
    ) });
    const {
  status,
  proof
} = await verify('pr', [], repo.options);
    assert.equal(status, 0, repo.lines.join('\n'));
    assert.deepEqual(repo.runs().sort(), ['lint', 'test']);
    for (const name of ['lint', 'test']) {
      const check = proof.checks.find((entry) => entry.name === name);
      assert.equal(check.result, 'passed');
      assert.ok(check.durationMs >= 0);
    }
    assert.equal(repo.lines.filter((line) => line.includes('one heavy step')).length, 1);
  });

  test('a failing child keeps its passing sibling, stops later checks, and reruns the failure', async () => {
    const repo = makeRepository();
    repo.commit('parallel', { 'site/index.html': 'site', 'verify-local.config.mjs': parallelConfig(
      'echo lint >> "$RUN_LOG"; test -z "$FAIL_TEST"', 'echo test >> "$RUN_LOG"',
    ) });
    const failed = await verify('pr', [], { ...repo.options, env: { ...repo.env, FAIL_TEST: '1' } });
    assert.equal(failed.status, 1);
    assert.equal(failed.proof.checks.find((entry) => entry.name === 'lint').result, 'failed');
    assert.equal(failed.proof.checks.find((entry) => entry.name === 'test').result, 'passed');
    assert.ok(!repo.runs().includes('site-check'), 'the serial stage after the batch cannot run');
    repo.clearRuns();
    const retry = await verify('pr', [], repo.options);
    assert.equal(retry.status, 0);
    assert.deepEqual(repo.runs(), ['lint', 'site-check']);
    assert.equal(retry.proof.checks.find((entry) => entry.name === 'test').reused, true);
  });

  test('a killed child fails even when its sibling passes', async () => {
    const repo = makeRepository();
    repo.commit('parallel kill', { 'verify-local.config.mjs': parallelConfig('kill -KILL $$', 'echo test >> "$RUN_LOG"') });
    const {
  status,
  proof
} = await verify('pr', [], repo.options);
    assert.equal(status, 1);
    assert.equal(proof.checks.find((entry) => entry.name === 'test').result, 'passed');
    assert.match(proof.checks.find((entry) => entry.name === 'lint').reason, /killed/);
  });

  test('--plan counts consecutive parallel checks as their longest one', async () => {
    const repo = makeRepository();
    repo.commit('parallel', { 'verify-local.config.mjs': parallelConfig('sleep 1; echo lint >> "$RUN_LOG"', 'echo test >> "$RUN_LOG"') });
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    const { plan } = await verify('pr', ['--plan', '--force'], repo.options);
    const [lint, test] = plan.checks;
    assert.deepEqual([lint.action, lint.parallel, test.action, test.parallel], ['run', true, 'run', true]);
    assert.ok(lint.estimateMs >= 1000);
    assert.equal(plan.estimateMs, Math.max(lint.estimateMs, test.estimateMs));
  });

  test('parallel checks cannot mutate the shared dependency installation', () => {
    assert.throws(() => normaliseConfig({ checks: [{ name: 'install', command: 'npm ci', parallel: true, install: true }] }), /parallel checks cannot install/);
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

    const {
  status,
  proof
} = await verify('pr', [], repo.options);
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
    const {
  status,
  proof
} = await verify('pr', ['--rev', squash], repo.options);
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

    const {
  status,
  proof
} = await verify('pr', [], repo.options);
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

  test('--plan says what each check would do, with past times, and runs nothing', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    repo.commit('feature', { 'src/b.js': '1\n' });
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    // Outside src/, so lint can be reused; test reads the whole tree.
    repo.commit('notes', { 'notes.txt': '1\n' });
    repo.clearRuns();
    const proofs = path.join(repo.work, '.git', 'verify-proofs');
    const before = readdirSync(proofs).sort();
    repo.lines.length = 0;

    const { status, plan } = await verify('pr', ['--plan'], repo.options);
    assert.equal(status, 0);
    assert.deepEqual(repo.runs(), []);
    assert.deepEqual(readdirSync(proofs).sort(), before, 'no proof, no run log entry');
    assert.equal(repo.git(['worktree', 'list']).split('\n').length, 1, 'no isolated copy');
    assert.deepEqual(plan.checks.map(({ name, action }) => [name, action]), [['lint', 'reused'], ['test', 'run'], ['db', 'skipped'], ['site', 'skipped']]);
    assert.equal(plan.checks[1].pastRuns, 1);
    assert.equal(plan.estimateMs, plan.checks[1].estimateMs);
    assert.match(repo.lines.join('\n'), /test: runs \(about \d+ s, median of 1 run\)/);
    assert.match(repo.lines.join('\n'), /db: out of scope \(no change in its paths since origin\/main\)/);
    assert.match(repo.lines.at(-1), /plan: 1 to run, 1 reused, 2 out of scope; about \d+ s of checks/);

    // A release reuses nothing and runs every check; a probe that fails here shows.
    const release = await verify('release', ['--plan'], repo.options);
    assert.deepEqual(release.plan.checks.map(({ name, action }) => [name, action]), [['lint', 'run'], ['test', 'run'], ['db', 'unavailable'], ['site', 'run'], ['build', 'run']]);
    assert.match(release.plan.checks[2].reason, /start the database/);
    assert.deepEqual(release.plan.untimed, ['site', 'build'], 'never run here: no time to give');

    repo.lines.length = 0;
    const json = await verify('pr', ['--plan', '--json'], repo.options);
    assert.equal(repo.lines.length, 1, 'the plan alone');
    assert.deepEqual(JSON.parse(repo.lines[0]), json.plan);
    await assert.rejects(verify('pr', ['--plan', '--keep'], repo.options), /no isolated copy to keep/);
    assert.deepEqual(repo.runs(), []);
    assert.deepEqual(readdirSync(proofs).sort(), before);
  });

  test('the time of a check is the median of its real passed runs, whatever engine wrote them', () => {
    const commonDir = mkdtempSync(path.join(os.tmpdir(), 'verify-durations-'));
    const proof = (tree, checks) => writeProof(commonDir, { version: 1, engine: 'older', tree, checks });
    proof('a', [{ name: 'x', result: 'passed', durationMs: 3000 }, { name: 'y', result: 'failed', durationMs: 9000 }]);
    proof('b', [{ name: 'x', result: 'passed', durationMs: 1000 }, { name: 'y', result: 'passed', reused: true, durationMs: 9000 }]);
    proof('c', [{ name: 'x', result: 'passed', durationMs: 2000 }, { name: 'y', result: 'passed', external: 'owner-machine: elsewhere' }]);
    writeFileSync(path.join(commonDir, 'verify-proofs', 'torn.json'), '{');
    assert.deepEqual([...pastDurations(commonDir)], [['x', { ms: 2000, runs: 3 }]]);
    rmSync(commonDir, { recursive: true, force: true });
  });

  test('without a known base, a check limited by when runs rather than being skipped', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    repo.commit('feature', { 'src/b.js': '1\n' });
    // No origin/main (a fresh clone of another remote, or a missing fetch):
    // the changed files are unknown, so nothing is out of scope.
    repo.git(['update-ref', '-d', 'refs/remotes/origin/main']);

    const {
  status,
  proof
} = await verify('pr', [], { ...repo.options, env: { ...repo.env, DB_AVAILABLE: '1' } });
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
    // A result is reused only from a run in the same shell.
    assert.notEqual(checkFingerprint({ ...args, check: plain, environment: { shell: { path: '/bin/sh', sha256: 'a' } } }), checkFingerprint({ ...args, check: plain, environment: { shell: { path: '/bin/sh', sha256: 'b' } } }), 'same path, other bytes');
  });

  test('a check killed by a signal fails and is never passed', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const config = readFileSync(path.join(repo.work, 'verify-local.config.mjs'), 'utf8');
    repo.commit('killed', { 'verify-local.config.mjs': config.replace(`command: 'echo lint >> "$RUN_LOG"'`, () => `command: 'kill -KILL $$'`) });
    const {
  status,
  proof
} = await verify('pr', [], repo.options);
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

describe('verify:pr --post-status', () => {
  // gh is never run: a fake records each call and answers like gh would.
  // `calls` holds the status POSTs, `lookups` the "does github.com know the
  // commit" requests that come first.
  const ok = { status: 0, stdout: '', stderr: '' };
  const fakeGh = ({ post = ok, known = ok } = {}) => {
    const calls = [];
    const lookups = [];
    const execute = (program, args) => {
      if (args.includes('POST')) {
        calls.push({ program, args });
        return post;
      }
      lookups.push({ program, args });
      return known;
    };
    return { calls, lookups, execute };
  };
  const field = (call, name) => call.args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
  const githubRepository = () => {
    const repo = makeRepository();
    repo.git(['config', 'remote.origin.url', 'https://github.com/acme/fixture.git']);
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    return repo;
  };
  const withLint = (command) => CONFIG.replace(`{ name: 'lint', command: 'echo lint >> "$RUN_LOG"', inputs: ['src/**'] }`,
    () => `{ name: 'lint', command: ${JSON.stringify(command)}, inputs: ['src/**'] }`);

  test('the owner/repo comes from a github.com URL only, credentials never kept', () => {
    assert.equal(githubSlug('https://github.com/thannous/dreamer.git'), 'thannous/dreamer');
    assert.equal(githubSlug('https://github.com/thannous/dreamer'), 'thannous/dreamer');
    assert.equal(githubSlug('git@github.com:thannous/dreamer.git'), 'thannous/dreamer');
    assert.equal(githubSlug('ssh://git@github.com/thannous/dreamer.git'), 'thannous/dreamer');
    assert.equal(githubSlug('https://x-access-token:abc@github.com/thannous/dreamer.git'), 'thannous/dreamer');
    for (const url of ['https://gitlab.com/a/b.git', 'https://github.com.evil.example/a/b', '/srv/origin.git', 'https://github.com/a/b/c', '', null]) {
      assert.equal(githubSlug(url), null, String(url));
    }
  });

  test('state mapping: success only for a pass; a failure or an incomplete run is a failure', () => {
    const sha = 'a'.repeat(40);
    const proof = { result: 'passed', checks: [
      { name: 'lint', result: 'passed' }, { name: 'test', result: 'passed', reused: true }, { name: 'db', result: 'skipped' },
    ] };
    assert.deepEqual(commitStatusFor('pr', { status: 0, proof }, sha), {
      state: 'success', context: 'verify-local/pr', description: 'verify:pr passed on aaaaaaaaaaaa: 1 ran, 1 reused, 1 skipped',
    });
    const failed = commitStatusFor('pr', { status: 1, proof: { checks: [{ name: 'lint', result: 'passed' }, { name: 'test', result: 'failed' }] } }, sha);
    assert.equal(failed.state, 'failure');
    assert.equal(failed.description, 'verify:pr failed on aaaaaaaaaaaa: test');
    const incomplete = commitStatusFor('pr', { status: 2, proof: { checks: [{ name: 'db', result: 'unavailable' }] } }, sha);
    assert.equal(incomplete.state, 'failure');
    assert.equal(incomplete.description, 'verify:pr incomplete on aaaaaaaaaaaa: could not run here: db');
    assert.equal(commitStatusFor('pr', { status: 1, proof: null }, sha).description, 'verify:pr failed on aaaaaaaaaaaa: no proof written');
    // Exit 0 alone is not enough: success needs a passed proof too.
    assert.equal(commitStatusFor('pr', { status: 0, proof: null }, sha).state, 'failure');
    assert.equal(commitStatusFor('pr', { status: 0, proof: { result: 'failed', checks: [{ name: 'lint', result: 'failed' }] } }, sha).state, 'failure');
    assert.equal(commitStatusFor('pr', { status: 0, proof: { result: 'incomplete', checks: [] } }, sha).state, 'failure');
    const long = commitStatusFor('pr', { status: 1, proof: { checks: Array.from({ length: 40 }, (_, i) => ({ name: `check-${i}`, result: 'failed' })) } }, sha);
    assert.equal(long.description.length, STATUS_DESCRIPTION_MAX);
    assert.ok(long.description.endsWith('...'));
  });

  test('the checkout must be at the verified commit and clean', () => {
    const sha = 'b'.repeat(40);
    assert.equal(statusRefusal({ head: sha, dirty: 0 }, sha), null);
    assert.match(statusRefusal({ head: 'c'.repeat(40), dirty: 0 }, sha), /not at the verified bbbbbbbbbbbb/);
    assert.match(statusRefusal({ head: sha, dirty: 2 }, sha), /has changes \(2 paths\)/);
    assert.match(statusRefusal({ head: sha, dirty: null }, sha), /git status failed/);
  });

  test('a pass of the clean HEAD posts success for that exact SHA, with only owner/repo and the SHA', async () => {
    const repo = githubRepository();
    const sha = repo.commit('feature', { 'src/b.js': 'export const b = 1;\n' });
    const gh = fakeGh();
    const result = await verify('pr', ['--post-status'], { ...repo.options, postStatusExecute: gh.execute });
    assert.equal(result.status, 0, repo.lines.join('\n'));
    assert.equal(result.proof.sha, sha);
    assert.equal(gh.calls.length, 1);
    const [call] = gh.calls;
    assert.equal(call.program, 'gh');
    assert.deepEqual(call.args.slice(0, 6), ['api', '--hostname', 'github.com', '-X', 'POST', `repos/acme/fixture/statuses/${sha}`], 'github.com explicitly, whatever GH_HOST says');
    assert.deepEqual(gh.lookups.map((lookup) => lookup.args.slice(0, 4)), [['api', '--hostname', 'github.com', `repos/acme/fixture/commits/${sha}`]], 'the commit is looked up on github.com first');
    assert.equal(field(call, 'state'), 'success');
    assert.equal(field(call, 'context'), 'verify-local/pr');
    assert.match(field(call, 'description'), new RegExp(`^verify:pr passed on ${sha.slice(0, 12)}: `));
    assert.ok(!call.args.join(' ').includes(os.hostname()), 'no host name is sent');
    assert.ok(!call.args.join(' ').includes(repo.base), 'no local path is sent');
    assert.equal(result.commitStatus.state, 'success');
  });

  test('a failed run posts failure and keeps its exit status', async () => {
    const repo = githubRepository();
    repo.commit('break', { 'src/a.js': 'nope\n' });
    const gh = fakeGh();
    const result = await verify('pr', ['--post-status'], { ...repo.options, postStatusExecute: gh.execute });
    assert.equal(result.status, 1);
    assert.equal(field(gh.calls[0], 'state'), 'failure');
    assert.match(field(gh.calls[0], 'description'), /: test$/);
  });

  test('a dirty checkout or another commit than HEAD is refused before anything runs', async () => {
    const repo = githubRepository();
    const sha = repo.commit('feature', { 'src/b.js': 'export const b = 1;\n' });
    const gh = fakeGh();
    repo.write('scratch.txt', 'untracked\n');
    await assert.rejects(verify('pr', ['--post-status'], { ...repo.options, postStatusExecute: gh.execute }), /has changes \(1 path\); commit or stash first, nothing runs/);
    rmSync(path.join(repo.work, 'scratch.txt'));
    await assert.rejects(verify('pr', ['--post-status', '--rev', 'HEAD^'], { ...repo.options, postStatusExecute: gh.execute }), new RegExp(`at ${sha.slice(0, 12)}, not at the verified`));
    assert.deepEqual(repo.runs(), [], 'no check ran');
    assert.equal(gh.calls.length, 0);
    assert.equal(existsSync(path.join(repo.work, '.git', 'verify-proofs', runLogName(sha))), false, 'no run was logged');
  });

  test('a checkout that changes or moves during the run posts nothing, and a pass then exits 3', async () => {
    const repo = githubRepository();
    repo.commit('dirty during run', { 'verify-local.config.mjs': withLint('echo lint >> "$RUN_LOG" && touch "$VERIFY_LOCAL_ROOT/late.txt"') });
    const gh = fakeGh();
    const dirty = await verify('pr', ['--post-status'], { ...repo.options, postStatusExecute: gh.execute });
    assert.equal(dirty.status, STATUS_NOT_POSTED, repo.lines.join('\n'));
    assert.equal(dirty.proof.result, 'passed', 'the proof itself stands');
    assert.ok(repo.lines.some((line) => /no commit status posted for [0-9a-f]{12}: the checkout has changes \(1 path\) at the end of the run/.test(line)), repo.lines.join('\n'));
    rmSync(path.join(repo.work, 'late.txt'));

    repo.commit('moves during run', { 'verify-local.config.mjs': withLint('echo lint >> "$RUN_LOG" && git -C "$VERIFY_LOCAL_ROOT" checkout --quiet main') });
    const moved = await verify('pr', ['--post-status', '--force'], { ...repo.options, postStatusExecute: gh.execute });
    assert.equal(moved.status, STATUS_NOT_POSTED, repo.lines.join('\n'));
    assert.ok(repo.lines.some((line) => /not at the verified [0-9a-f]{12} at the end of the run/.test(line)), repo.lines.join('\n'));
    assert.equal(gh.calls.length, 0);
  });

  test('a gh failure posts nothing, exits 3 after a pass, and never prints what gh said', async () => {
    const repo = githubRepository();
    repo.commit('feature', { 'src/b.js': 'export const b = 1;\n' });
    const gh = fakeGh({ post: { status: 1, stdout: '{"creator":{"login":"someone"}}', stderr: 'gh: Not Found (HTTP 404) secret-detail' } });
    const result = await verify('pr', ['--post-status'], { ...repo.options, postStatusExecute: gh.execute });
    assert.equal(result.status, STATUS_NOT_POSTED);
    assert.equal(gh.calls.length, 1);
    const text = repo.lines.join('\n');
    assert.match(text, /no commit status posted for [0-9a-f]{12}: gh api exited 1 \(HTTP 404\)/);
    assert.ok(!text.includes('secret-detail') && !text.includes('someone'), 'gh output stays out of the log');
  });

  test('a killed check or a run that throws never posts success', async () => {
    const repo = githubRepository();
    repo.commit('killed', { 'verify-local.config.mjs': withLint('kill -KILL $$') });
    const gh = fakeGh();
    const killed = await verify('pr', ['--post-status'], { ...repo.options, postStatusExecute: gh.execute });
    assert.equal(killed.status, 1);
    assert.equal(gh.calls.length, 1);
    assert.equal(field(gh.calls[0], 'state'), 'failure');
    assert.match(field(gh.calls[0], 'description'), /failed on [0-9a-f]{12}: lint$/);

    repo.commit('broken config', { 'verify-local.config.mjs': 'export default { checks: [ { name: 1 } ] };\n' });
    const thrown = fakeGh();
    await assert.rejects(verify('pr', ['--post-status'], { ...repo.options, postStatusExecute: thrown.execute }));
    assert.equal(thrown.calls.length, 0, 'a run that throws posts nothing');
  });

  test('a commit github.com does not know yet posts nothing, and says to push then run again', async () => {
    const repo = githubRepository();
    const sha = repo.commit('feature', { 'src/b.js': 'export const b = 1;\n' });
    const gh = fakeGh({ known: { status: 1, stdout: '', stderr: 'gh: No commit found for SHA (HTTP 422)' } });
    const result = await verify('pr', ['--post-status'], { ...repo.options, postStatusExecute: gh.execute });
    assert.equal(result.status, STATUS_NOT_POSTED);
    assert.equal(result.proof.result, 'passed', 'the proof itself stands');
    assert.equal(gh.lookups.length, 1);
    assert.equal(gh.calls.length, 0, 'no status POST');
    assert.ok(repo.lines.some((line) => line.includes(`no commit status posted for ${sha.slice(0, 12)}: github.com does not know the commit yet (gh api exited 1 (HTTP 422)); push it, then run again`)), repo.lines.join('\n'));
  });

  test('pr only, never with --plan, and only for a github.com origin; without the flag nothing is posted', async () => {
    const repo = githubRepository();
    repo.commit('feature', { 'src/b.js': 'export const b = 1;\n' });
    const gh = fakeGh();
    const options = { ...repo.options, postStatusExecute: gh.execute };
    await assert.rejects(verify('release', ['--post-status'], options), /applies to pr only/);
    await assert.rejects(verify('pr', ['--post-status', '--plan'], options), /--plan posts no status/);
    repo.git(['config', 'remote.origin.url', '/srv/origin.git']);
    await assert.rejects(verify('pr', ['--post-status'], options), /needs a github.com origin remote/);
    const plain = await verify('pr', [], options);
    assert.equal(plain.status, 0);
    assert.equal(plain.commitStatus, undefined);
    assert.equal(gh.calls.length, 0);
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
    const {
  status,
  proof
} = await verify('release', [], repo.options);
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
      .replace("command: 'echo lint >> \"$RUN_LOG\"'", `command: ${JSON.stringify("node -e \"const f=require('fs'),o=require('os');const t=o.tmpdir();if(!f.existsSync(t))process.exit(1);f.appendFileSync(process.env.RUN_LOG,'lint:'+t+'\\n')\"")} `);
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
    // Garbage, then a later entry that closes nothing: the garbage is in the middle.
    ['garbage JSON in the middle', (text, sha) => `${text}{not json\n${JSON.stringify({ kind: 'pr', sha, result: 'passed', checks: [] })}\n`],
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
    writeFileSync(file, spoil(readFileSync(file, 'utf8'), head));
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
    assert.match(openNames(['app']), /\bbundle \((unreadable|release interrupted)/);
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
    assert.match(openNames([]), /\bdb \((unreadable|release interrupted)/);
    repo.clearRuns();
    assert.equal((await verify('release', ['--target', 'app', '--target', 'site'], repo.options)).status, 0);
    assert.ok(repo.runs().includes('db'));
    assert.deepEqual(guard(['app']), []);
  });

  test('an unreadable line opens each known check; only its own real pass closes it', () => {
    const bad = { kind: 'unreadable', result: 'unreadable', line: 2, finishedAt: null, checks: [] };
    assert.deepEqual(openChecks([bad]).map((item) => item.check), [RUN_LOG_UNREADABLE], 'no check known yet');
    const log = [
      { kind: 'release', result: 'passed', finishedAt: 't1', engine: ENGINE_FILE_SHA256, known: ['a', 'b', 'c', 'd'], checks: [{ name: 'a', result: 'passed' }] },
      bad,
      { kind: 'pr', result: 'passed', finishedAt: 't2', engine: ENGINE_FILE_SHA256, checks: [{ name: 'a', result: 'passed' }, { name: 'b', result: 'passed', reused: true }, { name: 'c', result: 'skipped' }] },
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
    assert.equal(readRunLog(commonDir, head).at(-1).result, 'failed', 'checks that passed, but no lock: logged as not passed');
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

    // A waiter that judged a lock stale never removes the fresh lock that
    // replaced it (another waiter took it over and holds it).
    writeFileSync(lock, 'dead run');
    utimesSync(lock, new Date('2020-01-01'), new Date('2020-01-01'));
    takeOverStale(lock, PROOF_LOCK_STALE_MS, { onJudged: () => writeFileSync(lock, 'fresh holder') });
    assert.equal(readFileSync(lock, 'utf8'), 'fresh holder');
    assert.ok(!existsSync(`${lock}.takeover`));
    // A stale takeover guard is removed only if it is still the one judged
    // stale: one replaced meanwhile by a live waiter's guard is kept.
    const guard = `${lock}.takeover`;
    const dead = `${spawnSync(process.execPath, ['-e', '']).pid} ${os.hostname()} x`;
    writeFileSync(lock, dead);
    writeFileSync(guard, dead);
    takeOverStale(lock, PROOF_LOCK_STALE_MS, { onGuardJudged: () => writeFileSync(guard, `${process.pid} ${os.hostname()} fresh`) });
    assert.equal(readFileSync(guard, 'utf8'), `${process.pid} ${os.hostname()} fresh`);
    writeFileSync(guard, dead);
    takeOverStale(lock, PROOF_LOCK_STALE_MS);
    assert.ok(!existsSync(guard), 'a stale guard is removed');
    assert.deepEqual(readdirSync(proofs).filter((name) => name.includes('.stale.')), [], 'nothing left aside');
    rmSync(lock);

    // Three racers, each taking the lock five times, starting on a stale lock.
    writeFileSync(lock, 'dead run');
    utimesSync(lock, new Date('2020-01-01'), new Date('2020-01-01'));
    rmSync(trace, { force: true });
    const loop = script.replace('const r = withProofLock', 'for (let i = 0; i < 5; i += 1) { const r = withProofLock').replace('if (!r.locked) process.exit(3);', 'if (!r.locked) process.exit(3); }').replace('Atomics.wait(pause, 0, 0, 50)', 'Atomics.wait(pause, 0, 0, 5)');
    const racers = Array.from({ length: 3 }, () => new Promise((resolve) => {
      spawn(process.execPath, ['--input-type=module', '-e', loop], { stdio: 'ignore' }).on('exit', resolve);
    }));
    assert.deepEqual(await Promise.all(racers), [0, 0, 0]);
    assert.equal(readFileSync(trace, 'utf8'), 'in\nout\n'.repeat(15), 'the three racers never overlapped');
  });

  // Fixtures describe an install; the executable boundary is simulated on every OS.
  const selectShell = (env, platform, options = {}) => posixShell(env, platform, {
    ...options,
    run: (program, args, options) => {
      assert.deepEqual(args, ['--exec-path']);
      assert.ok(!Object.keys(options.env).some(name => /^GIT_/i.test(name)));
      return { status: 0, stdout: JSON.parse(readFileSync(program, 'utf8')).reported };
    },
  });

  test('the shell for config commands: /bin/sh, the sh of Git for Windows on Windows, never from the environment', () => {
    assert.equal(selectShell({ PATH: process.env.PATH }, 'linux'), '/bin/sh');
    assert.equal(selectShell({ PATH: process.env.PATH, VERIFY_LOCAL_SHELL: '/bin/true' }, 'linux'), '/bin/sh', 'VERIFY_LOCAL_SHELL is ignored');
    // A Git for Windows install: <root>/<gitDir>/git.exe, whose --exec-path is
    // <root>/mingw64/libexec/git-core unless GIT_EXEC_PATH says otherwise (as real git).
    const fakeGit = (name, shells, { gitDir = 'cmd', execPath = null } = {}) => {
      const root = mkdtempSync(path.join(scratch, `${name}-`));
      for (const shell of shells) {
        mkdirSync(path.dirname(path.join(root, shell)), { recursive: true });
        writeFileSync(path.join(root, shell), '');
      }
      const bin = path.join(root, gitDir);
      mkdirSync(bin, { recursive: true });
      mkdirSync(path.join(root, 'mingw64', 'libexec', 'git-core'), { recursive: true });
      const reported = execPath ?? path.join(root, 'mingw64', 'libexec', 'git-core');
      writeFileSync(path.join(bin, 'git.exe'), JSON.stringify({ reported }), { mode: 0o755 });
      return { root, env: { Path: `${bin};${path.join(scratch, 'elsewhere')}` } };
    };
    const both = fakeGit('both', ['bin/sh.exe', 'usr/bin/sh.exe']);
    assert.equal(selectShell(both.env, 'win32'), realpathSync(path.join(both.root, 'bin', 'sh.exe')));
    const usr = fakeGit('usr', ['usr/bin/sh.exe'], { gitDir: 'mingw64/bin' });
    assert.equal(selectShell(usr.env, 'win32'), realpathSync(path.join(usr.root, 'usr', 'bin', 'sh.exe')));
    // GIT_EXEC_PATH (and any GIT_* variable) of the caller is ignored.
    const evil = mkdtempSync(path.join(scratch, 'evil-'));
    mkdirSync(path.join(evil, 'mingw64', 'libexec', 'git-core'), { recursive: true });
    mkdirSync(path.join(evil, 'bin'));
    writeFileSync(path.join(evil, 'bin', 'sh.exe'), '');
    const saved = process.env.GIT_EXEC_PATH;
    process.env.GIT_EXEC_PATH = path.join(evil, 'mingw64', 'libexec', 'git-core');
    try {
      const ignored = fakeGit('ignored', ['bin/sh.exe']);
      assert.equal(selectShell({ ...ignored.env, GIT_EXEC_PATH: process.env.GIT_EXEC_PATH }, 'win32'), realpathSync(path.join(ignored.root, 'bin', 'sh.exe')));
    } finally {
      if (saved === undefined) delete process.env.GIT_EXEC_PATH;
      else process.env.GIT_EXEC_PATH = saved;
    }
    // An sh outside the root of the git.exe on PATH is refused.
    const outside = fakeGit('outside', [], { execPath: path.join(evil, 'mingw64', 'libexec', 'git-core') });
    assert.equal(selectShell(outside.env, 'win32'), null, 'exec path outside the git root');
    const odd = fakeGit('odd', ['bin/sh.exe'], { gitDir: 'tools' });
    assert.equal(selectShell(odd.env, 'win32'), null, 'git.exe outside the standard layout');
    // No sh: refused, with no fallback to a bare sh on PATH.
    const none = fakeGit('none', []);
    assert.equal(selectShell(none.env, 'win32'), null);
    assert.equal(selectShell({ Path: '' }, 'win32'), null, 'no git.exe on PATH');
  });

  test('Windows: only an absolute PATH entry counts, and a Git root inside the repository is refused', () => {
    for (const entry of ['C:\\Git\\cmd', 'c:/Git/cmd', '\\\\server\\share\\Git\\cmd']) assert.equal(absolutePathEntry(entry, 'win32'), true, entry);
    for (const entry of ['cmd', '.\\cmd', '..\\Git\\cmd', 'C:cmd', '\\Git\\cmd', '/Git/cmd']) assert.equal(absolutePathEntry(entry, 'win32'), false, entry);
    assert.equal(absolutePathEntry('cmd', 'linux'), false);
    // A complete fake Git for Windows layout at <root>.
    const layout = (root) => {
      mkdirSync(path.join(root, 'cmd'), { recursive: true });
      mkdirSync(path.join(root, 'bin'), { recursive: true });
      mkdirSync(path.join(root, 'mingw64', 'libexec', 'git-core'), { recursive: true });
      writeFileSync(path.join(root, 'bin', 'sh.exe'), '');
      writeFileSync(path.join(root, 'cmd', 'git.exe'), JSON.stringify({ reported: path.join(root, 'mingw64', 'libexec', 'git-core') }), { mode: 0o755 });
    };
    const repo = makeRepository();
    const git = createGit(repo.work, repo.env);
    const repoDirs = repositoryDirs(git, repo.work, path.join(repo.work, '.git'));
    assert.ok(repoDirs.includes(repo.work) && repoDirs.includes(path.join(repo.work, '.git')), repoDirs.join(','));
    layout(repo.work);
    const inGitDir = path.join(repo.work, '.git', 'fake-git');
    layout(inGitDir);
    // The layouts are complete: only the repository rule refuses them.
    assert.equal(selectShell({ Path: path.join(inGitDir, 'cmd') }, 'win32'), realpathSync(path.join(inGitDir, 'bin', 'sh.exe')));
    const cwd = process.cwd();
    process.chdir(repo.work);
    try {
      for (const entry of ['cmd', './cmd', path.join(repo.work, 'cmd'), path.join(inGitDir, 'cmd')]) {
        assert.equal(selectShell({ Path: entry }, 'win32', { repoDirs }), null, entry);
      }
      // Through a symlink, the realpath still lands in the repository.
      const link = path.join(scratch, `repo-link-${process.pid}`);
      symlinkSync(repo.work, link);
      assert.equal(selectShell({ Path: path.join(link, 'cmd') }, 'win32', { repoDirs }), null, 'symlink into the repository');
    } finally {
      process.chdir(cwd);
    }
    // Another worktree of the repository is refused too.
    const other = path.join(repo.base, 'other-worktree');
    git(['worktree', 'add', '--quiet', '--detach', other]);
    layout(other);
    const withWorktree = repositoryDirs(git, repo.work, path.join(repo.work, '.git'));
    assert.equal(selectShell({ Path: path.join(other, 'cmd') }, 'win32', { repoDirs: withWorktree }), null, 'another worktree');
    // A valid layout outside the repository is accepted.
    const outside = mkdtempSync(path.join(scratch, 'real-git-'));
    layout(outside);
    assert.equal(selectShell({ Path: `cmd;${path.join(outside, 'cmd')}` }, 'win32', { repoDirs: withWorktree }), realpathSync(path.join(outside, 'bin', 'sh.exe')));

    // A checkout folder named bin on PATH, with a committed git.exe and sh.exe:
    // the computed root is its parent, outside the repository, but the entry,
    // git.exe and sh.exe are inside it.
    const parent = path.join(repo.base, 'checkouts');
    const binCheckout = path.join(parent, 'bin');
    mkdirSync(parent);
    git(['worktree', 'add', '--quiet', '--detach', binCheckout]);
    mkdirSync(path.join(parent, 'mingw64', 'libexec', 'git-core'), { recursive: true });
    writeFileSync(path.join(binCheckout, 'sh.exe'), '');
    writeFileSync(path.join(binCheckout, 'git.exe'), JSON.stringify({ reported: path.join(parent, 'mingw64', 'libexec', 'git-core') }), { mode: 0o755 });
    const binDirs = repositoryDirs(git, repo.work, path.join(repo.work, '.git'));
    assert.equal(selectShell({ Path: binCheckout }, 'win32'), realpathSync(path.join(binCheckout, 'sh.exe')), 'the layout is complete: only the repository rule refuses it');
    assert.equal(selectShell({ Path: binCheckout }, 'win32', { repoDirs: binDirs }), null, 'a checkout named bin on PATH');
    // git.exe outside, but a symlinked sh.exe that points into the repository.
    const linked = mkdtempSync(path.join(scratch, 'linked-sh-'));
    layout(linked);
    rmSync(path.join(linked, 'bin', 'sh.exe'));
    symlinkSync(path.join(repo.work, 'bin', 'sh.exe'), path.join(linked, 'bin', 'sh.exe'));
    assert.equal(selectShell({ Path: path.join(linked, 'cmd') }, 'win32', { repoDirs: binDirs }), null, 'sh.exe resolves into the repository');
    // A git.exe symlinked into the repository, and an exec path that does not exist.
    const linkedGit = mkdtempSync(path.join(scratch, 'linked-git-'));
    layout(linkedGit);
    rmSync(path.join(linkedGit, 'cmd', 'git.exe'));
    symlinkSync(path.join(repo.work, 'cmd', 'git.exe'), path.join(linkedGit, 'cmd', 'git.exe'));
    assert.equal(selectShell({ Path: path.join(linkedGit, 'cmd') }, 'win32', { repoDirs: binDirs }), null, 'git.exe resolves into the repository');
    const noExec = mkdtempSync(path.join(scratch, 'no-exec-'));
    layout(noExec);
    rmSync(path.join(noExec, 'mingw64'), { recursive: true });
    assert.equal(selectShell({ Path: path.join(noExec, 'cmd') }, 'win32', { repoDirs: binDirs }), null, 'the exec path must exist');
    assert.equal(selectShell({ Path: path.join(outside, 'cmd') }, 'win32', { repoDirs: binDirs }), realpathSync(path.join(outside, 'bin', 'sh.exe')), 'a valid outside layout still passes');
  });

  test('the shell probe rejects a fixed answer, wrong arithmetic, a false success and a launch error', () => {
    const execute = (_program, [, script]) => {
      const [, token, a, b, c, code = '0'] = / ([0-9a-f]{16}) \$\(\((\d+)\*(\d+)\+(\d+)\)\)(?:; exit (\d+))?/.exec(script);
      return { status: Number(code), stdout: token + ' ' + (Number(a) * Number(b) + Number(c)) };
    };
    for (const platform of ['linux', 'darwin', 'win32']) {
      const shell = platform === 'win32' ? 'C:/Git/bin/sh.exe' : '/bin/sh';
      assert.equal(probeShell(shell, {}, execute).ok, true);
      for (const fake of [
        () => ({ status: 37, stdout: '0123456789abcdef 42' }),
        (p, a) => ({ ...execute(p, a), stdout: execute(p, a).stdout.split(' ')[0] }),
        (p, a) => ({ ...execute(p, a), status: 0 }),
        () => ({ error: new Error('ENOENT') }),
      ]) assert.equal(probeShell(shell, {}, fake).ok, false);
    }
    assert.equal(probeShell(null).ok, false);
  });

  test('a shell that fails its sanity probe runs no check and records no pass; the environment cannot pick the shell', async () => {
    const selected = posixShell();
    assert.equal(probeShell(selected).ok, true);
    const repo = makeRepository();
    repo.env.DB_AVAILABLE = '1';
    const head = repo.commit('site', { 'site/index.html': '<p>ok</p>\n' });
    repo.git(['push', '--quiet', 'origin', 'main']);
    const commonDir = path.join(repo.work, '.git');
    const tree = repo.git(['rev-parse', `${head}^{tree}`]);
    repo.lines.length = 0;
    assert.equal((await verify('pr', ['--force'], { ...repo.options, shell: '' })).status, 1, 'no shell found');
    assert.ok(repo.lines.some((line) => line.includes('no sh.exe of Git for Windows')), repo.lines.join('\n'));
    for (const fake of ['/bin/true', '/bin/false']) {
      for (const kind of ['pr', 'release']) {
        repo.clearRuns();
        repo.lines.length = 0;
        const run = await verify(kind, ['--force'], { ...repo.options, shell: fake, shellProbeFn: () => ({ ok: false, detail: 'simulated invalid shell' }) });
        assert.equal(run.status, 1, `${fake} ${kind}`);
        assert.ok(repo.lines.some((line) => line.includes(`the shell ${fake} failed its sanity probe`)), repo.lines.join('\n'));
        assert.deepEqual(repo.runs(), [], 'no check ran');
      }
    }
    assert.equal(readProof(commonDir, tree), null, 'no proof');
    assert.deepEqual(readRunLog(commonDir, head), [], 'no run recorded');
    assert.deepEqual(checkReleaseProof({ cwd: repo.work, env: repo.env, fetch: false }).failures.map((failure) => failure.check), ['proof-present']);
    // VERIFY_LOCAL_SHELL in the environment is ignored: the checks really run in /bin/sh.
    repo.clearRuns();
    const env = { ...repo.env, VERIFY_LOCAL_SHELL: '/bin/true' };
    assert.equal((await verify('release', ['--force'], { ...repo.options, env })).status, 0);
    assert.ok(repo.runs().includes('lint') && repo.runs().includes(`build:${head}`), repo.runs().join(','));
    const shell = { path: selected, probe: 'random token, sum and exit code as asked' };
    assert.deepEqual(readProof(commonDir, tree).shell, shell);
    assert.deepEqual(readRunLog(commonDir, head).at(-1).shell, shell);
    // A failing release in /bin/sh still fails with that variable set.
    assert.equal((await verify('release', ['--force'], { ...repo.options, env: { ...env, FAIL_BUILD: '1' } })).status, 1);
    assert.deepEqual(checkReleaseProof({ cwd: repo.work, env: repo.env, fetch: false }).failures.map((failure) => failure.check), ['proof-latest-release', 'proof-open-check']);
  });

  test('a release that times out on the proof lock is logged as not passed and stops a deploy', async () => {
    const repo = makeRepository();
    repo.env.DB_AVAILABLE = '1';
    repo.commit('site', { 'site/index.html': '<p>ok</p>\n' });
    repo.git(['push', '--quiet', 'origin', 'main']);
    const guard = () => checkReleaseProof({ cwd: repo.work, env: repo.env, fetch: false }).failures.map((failure) => failure.check);
    assert.equal((await verify('release', [], repo.options)).status, 0);
    assert.deepEqual(guard(), []);
    const lock = path.join(repo.work, '.git', 'verify-proofs', '.proof.lock');
    writeFileSync(lock, 'another run');
    assert.equal((await verify('release', [], { ...repo.options, proofLock: { waitMs: 200 } })).status, 1);
    rmSync(lock);
    assert.deepEqual(guard(), ['proof-latest-release']);
    assert.equal((await verify('release', [], repo.options)).status, 0);
    assert.deepEqual(guard(), []);
  });

  test('a lock or a run whose process still runs here is not stale until RUN_MAX_MS', async () => {
    const old = Date.now() - 120000;
    const host = os.hostname();
    assert.equal(lockIsStale(`${process.pid} ${host} x`, old, 1000), false, 'live holder, old lock');
    const dead = spawnSync(process.execPath, ['-e', '']).pid;
    assert.equal(lockIsStale(`${dead} ${host} x`, Date.now(), 1000), true, 'dead holder, fresh lock');
    assert.equal(lockIsStale(`${process.pid} other-host x`, old, 1000), true, 'another machine: by age');
    assert.equal(lockIsStale(`${process.pid} other-host x`, Date.now(), 1000), false);
    assert.equal(lockIsStale('unreadable', Date.now(), 1000), false);
    assert.equal(lockIsStale(`${process.pid} ${host} x`, Date.now() - RUN_MAX_MS - 1000, 1000), true, 'past RUN_MAX_MS a live pid is a recycled one');
    const repo = makeRepository();
    repo.env.DB_AVAILABLE = '1';
    const head = repo.commit('site', { 'site/index.html': '<p>ok</p>\n' });
    repo.git(['push', '--quiet', 'origin', 'main']);
    const commonDir = path.join(repo.work, '.git');
    const proofs = path.join(commonDir, 'verify-proofs');
    mkdirSync(proofs, { recursive: true });
    const lock = path.join(proofs, '.proof.lock');
    writeFileSync(lock, `${process.pid} ${host} live`);
    utimesSync(lock, new Date(old), new Date(old));
    assert.deepEqual(withProofLock(commonDir, () => 'x', { waitMs: 200, staleMs: 10 }), { locked: false }, 'a live holder past the stale age keeps it');
    rmSync(lock);

    // Release A starts and still runs while release B starts and passes; then A dies.
    const guard = () => checkReleaseProof({ cwd: repo.work, env: repo.env, fetch: false }).failures.map((failure) => failure.check);
    const a = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });
    const tree = repo.git(['rev-parse', `${head}^{tree}`]);
    appendFileSync(path.join(proofs, `${head}.runs.jsonl`), `${JSON.stringify({ kind: 'release', sha: head, tree, runId: 'a', result: 'started', startedAt: new Date().toISOString(), pid: a.pid, host, selected: ['lint', 'build'], checks: [] })}\n`);
    // A start older than RUN_MAX_MS whose pid is alive again is a recycled pid: it is over.
    appendFileSync(path.join(proofs, `${head}.runs.jsonl`), `${JSON.stringify({ kind: 'release', sha: head, tree, runId: 'old', result: 'started', startedAt: '2020-01-01T00:00:00.000Z', pid: a.pid, host, selected: ['lint'], checks: [] })}\n`);
    assert.equal((await verify('release', [], repo.options)).status, 0, 'B passes');
    assert.ok(readRunLog(commonDir, head).some((entry) => entry.runId === 'old' && entry.closedBy === 'a later run'), 'the recycled pid does not keep it open');
    assert.equal(readRunLog(commonDir, head).at(-1).runId, 'a', 'A, unended, counts as the newest run');
    assert.deepEqual(guard(), ['proof-latest-release', 'proof-open-check']);
    a.kill('SIGKILL');
    await new Promise((resolve) => a.on('exit', resolve));
    assert.deepEqual(guard(), ['proof-latest-release', 'proof-open-check'], 'A died after B: still refused');
    assert.equal((await verify('release', [], repo.options)).status, 0, 'C closes A and passes');
    assert.ok(readRunLog(commonDir, head).some((entry) => entry.runId === 'a' && entry.closedBy === 'a later run'));
    assert.deepEqual(guard(), []);
  });

  test('a dead run is closed once, under the proof lock, and never after a pass that followed its closure', async () => {
    const repo = makeRepository();
    repo.env.DB_AVAILABLE = '1';
    const head = repo.commit('site', { 'site/index.html': '<p>ok</p>\n' });
    repo.git(['push', '--quiet', 'origin', 'main']);
    const commonDir = path.join(repo.work, '.git');
    const proofs = path.join(commonDir, 'verify-proofs');
    mkdirSync(proofs, { recursive: true });
    const tree = repo.git(['rev-parse', `${head}^{tree}`]);
    const dead = spawnSync(process.execPath, ['-e', '']).pid;
    appendFileSync(path.join(proofs, runLogName(head)), `${JSON.stringify({ kind: 'release', sha: head, tree, runId: 'dead', result: 'started', startedAt: new Date().toISOString(), pid: dead, host: os.hostname(), selected: ['lint'], checks: [] })}\n`);
    const closures = () => readFileSync(path.join(proofs, runLogName(head)), 'utf8').split('\n').filter((line) => line.includes('"closedBy"'));
    // Two verifiers that both saw it unended: the second, on its fresh read under the lock, finds it closed.
    closeUnended(commonDir, head, new Date().toISOString());
    closeUnended(commonDir, head, new Date().toISOString());
    assert.equal(closures().length, 1, 'closed once');
    // A release pass after the closure: a later close appends nothing, so the pass stays the latest release.
    assert.equal((await verify('release', [], repo.options)).status, 0);
    closeUnended(commonDir, head, new Date().toISOString());
    assert.equal(closures().length, 1);
    assert.equal(readRunLog(commonDir, head).at(-1).result, 'passed');
    assert.deepEqual(checkReleaseProof({ cwd: repo.work, env: repo.env, fetch: false }).failures, []);
    // Without the lock nothing is closed, and the dead run still counts as the newest.
    appendFileSync(path.join(proofs, runLogName(head)), `${JSON.stringify({ kind: 'release', sha: head, tree, runId: 'dead2', result: 'started', startedAt: new Date().toISOString(), pid: dead, host: os.hostname(), selected: ['lint'], checks: [] })}\n`);
    writeFileSync(path.join(proofs, '.proof.lock'), `${process.pid} ${os.hostname()} held`);
    closeUnended(commonDir, head, new Date().toISOString(), { waitMs: 100 });
    rmSync(path.join(proofs, '.proof.lock'));
    assert.equal(closures().length, 1);
    assert.equal(readRunLog(commonDir, head).at(-1).runId, 'dead2');
  });

  test('results are never reused across an engine change', async () => {
    assert.equal(ENGINE_FILE_SHA256, createHash('sha256').update(readFileSync(ENGINE)).digest('hex'), 'the hash of the running file');
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const head = repo.commit('feature', { 'src/b.js': '1\n' });
    const commonDir = path.join(repo.work, '.git');
    const tree = repo.git(['rev-parse', `${head}^{tree}`]);
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    const file = path.join(commonDir, 'verify-proofs', `${tree}.json`);
    assert.equal(JSON.parse(readFileSync(file, 'utf8')).engine, ENGINE_FILE_SHA256);
    assert.ok(readRunLog(commonDir, head).every((entry) => entry.engine === ENGINE_FILE_SHA256), 'every run log entry names the engine');
    // A squash (same tree) reuses everything from the same engine...
    const squash = (message) => repo.git(['commit-tree', tree, '-p', 'origin/main', '-m', message]);
    repo.clearRuns();
    assert.equal((await verify('pr', ['--rev', squash('same engine')], repo.options)).status, 0);
    assert.deepEqual(repo.runs(), [], 'same engine: reused');
    // ...and nothing from a proof another engine wrote.
    writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), engine: 'f'.repeat(64) }));
    // Status and the proof block do not trust it either.
    const lines = [];
    assert.equal((await proofBlock(['--rev', head], { cwd: repo.work, env: repo.env, log: (line) => lines.push(line) })).status, 1);
    assert.match(lines.join('\n'), /no proof for tree/);
    assert.equal((await status(['--rev', head], { cwd: repo.work, env: repo.env, log: (line) => lines.push(line) })).proof, null);
    repo.clearRuns();
    const rerun = await verify('pr', ['--rev', squash('other engine')], repo.options);
    assert.equal(rerun.status, 0);
    assert.ok(repo.runs().includes('lint') && repo.runs().includes('test'), repo.runs().join(','));
    assert.ok(!rerun.proof.checks.some((check) => check.reused), 'another engine: rerun');
  });

  test('only a pass logged by the pinned engine closes a check; a failure of any engine opens one', async () => {
    const other = 'f'.repeat(64);
    const fail = (engine) => ({ kind: 'pr', result: 'failed', finishedAt: 't', engine, checks: [{ name: 'a', result: 'failed' }] });
    const pass = (engine) => ({ kind: 'pr', result: 'passed', finishedAt: 't', engine, checks: [{ name: 'a', result: 'passed' }] });
    assert.deepEqual(openChecks([fail(ENGINE_FILE_SHA256), pass(other)]).map((item) => item.check), ['a'], 'a foreign pass closes nothing');
    assert.deepEqual(openChecks([fail(ENGINE_FILE_SHA256), pass(undefined)]).map((item) => item.check), ['a'], 'nor one with no engine');
    assert.deepEqual(openChecks([pass(ENGINE_FILE_SHA256), fail(other)]).map((item) => item.check), ['a'], 'a foreign failure opens it');
    assert.deepEqual(openChecks([fail(other), pass(ENGINE_FILE_SHA256)]), [], 'a pinned pass closes it');
    assert.deepEqual(openChecks([fail(other), pass(other)], [], other), [], 'the engine given is the one that closes');

    // The #210 repro: release pass, PR fail, then a PR pass logged by another engine.
    const repo = makeRepository();
    repo.env.DB_AVAILABLE = '1';
    const head = repo.commit('site', { 'site/index.html': '<p>ok</p>\n' });
    repo.git(['push', '--quiet', 'origin', 'main']);
    const commonDir = path.join(repo.work, '.git');
    const guard = () => checkReleaseProof({ cwd: repo.work, env: repo.env, fetch: false }).failures.map((failure) => failure.check);
    assert.equal((await verify('release', [], repo.options)).status, 0);
    assert.equal((await verify('pr', ['--force'], { ...repo.options, env: { ...repo.env, FAIL_TEST: '1' } })).status, 1);
    assert.deepEqual(guard(), ['proof-open-check']);
    const names = readRunLog(commonDir, head).at(-1).checks.map((check) => check.name);
    appendFileSync(path.join(commonDir, 'verify-proofs', runLogName(head)), `${JSON.stringify({ kind: 'pr', sha: head, tree: repo.git(['rev-parse', `${head}^{tree}`]), runId: 'old', result: 'passed', finishedAt: 'x', engine: other, checks: names.map((name) => ({ name, result: 'passed' })) })}\n`);
    assert.deepEqual(guard(), ['proof-open-check'], 'the foreign pass does not close the failure');
    // It is not reused either: the next PR run reruns the open check.
    repo.clearRuns();
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    assert.ok(repo.runs().includes('test'), repo.runs().join(','));
    assert.deepEqual(guard(), []);
  });

  test('the proof block fails while a check is open, for example after an interrupted later PR run', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const head = repo.commit('feature', { 'src/b.js': '1\n' });
    const commonDir = path.join(repo.work, '.git');
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    assert.equal((await proofBlock([], { ...repo.options, log: () => {} })).status, 0);
    const dead = spawnSync(process.execPath, ['-e', '']).pid;
    appendFileSync(path.join(commonDir, 'verify-proofs', runLogName(head)), `${JSON.stringify({ kind: 'pr', sha: head, tree: repo.git(['rev-parse', `${head}^{tree}`]), runId: 'cut', result: 'started', startedAt: new Date().toISOString(), pid: dead, host: os.hostname(), selected: ['lint'], checks: [] })}\n`);
    const lines = [];
    assert.equal((await proofBlock([], { ...repo.options, log: (line) => lines.push(line) })).status, 1);
    assert.match(lines.join('\n'), /^- Result: not passed \(checks open on this commit\), pr proof/m);
    assert.match(lines.join('\n'), /^- Open on this commit: lint \(pr interrupted at /m);
  });

  test('proof-block --rev binds the pass to that commit: a same-tree commit whose run was killed is not passed', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const a = repo.commit('feature', { 'src/b.js': '1\n' });
    const tree = repo.git(['rev-parse', `${a}^{tree}`]);
    const commonDir = path.join(repo.work, '.git');
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    const b = repo.git(['commit-tree', tree, '-p', 'origin/main', '-m', 'same tree']);
    const block = async (rev) => {
      const lines = [];
      const {
  status: code
} = await proofBlock(['--rev', rev], { ...repo.options, log: (line) => lines.push(line) });
      return { code, text: lines.join('\n') };
    };
    assert.equal((await block(a)).code, 0);
    // B has no run of its own: A's pass does not count for it.
    let shown = await block(b);
    assert.equal(shown.code, 1);
    assert.match(shown.text, new RegExp(`^- Commit SHA: \`${b}\`$`, 'm'));
    assert.match(shown.text, new RegExp(`^- Result: not passed \\(no run of this commit; the proof is for ${a}\\)`, 'm'));
    // B's run was killed (a start with no end).
    const dead = spawnSync(process.execPath, ['-e', '']).pid;
    appendFileSync(path.join(commonDir, 'verify-proofs', runLogName(b)), `${JSON.stringify({ kind: 'pr', sha: b, tree, runId: 'killed', result: 'started', startedAt: new Date().toISOString(), pid: dead, host: os.hostname(), selected: ['lint', 'test'], checks: [] })}\n`);
    shown = await block(b);
    assert.equal(shown.code, 1);
    assert.match(shown.text, new RegExp(`^- Commit SHA: \`${b}\`$`, 'm'));
    assert.match(shown.text, /^- Result: not passed \(checks open on this commit\)/m);
    assert.equal((await block(a)).code, 0, 'A itself still passes');
  });

  test('Windows: an admin-share spelling of a local path compares as its drive path', () => {
    for (const [given, wanted] of [
      ['\\\\localhost\\c$\\repo', 'c:\\repo'],
      ['\\\\127.0.0.1\\C$\\repo', 'C:\\repo'],
      [`\\\\${os.hostname()}\\d$\\x`, 'd:\\x'],
      ['\\\\?\\UNC\\localhost\\c$\\x', 'c:\\x'],
      ['\\\\?\\C:\\x', 'C:\\x'],
      ['\\\\.\\c:\\x', 'c:\\x'],
      ['\\\\server\\c$\\x', '\\\\server\\c$\\x'],
      ['\\\\localhost\\share\\x', '\\\\localhost\\share\\x'],
    ]) assert.equal(windowsLocalPath(given), wanted, given);
  });

  test('a failed release that is the first run of a commit stays open under a later PR pass', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const head = repo.commit('feature', { 'src/b.js': '1\n' });
    assert.equal((await verify('release', [], { ...repo.options, env: { ...repo.env, DB_AVAILABLE: '1', FAIL_BUILD: '1' } })).status, 1);
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    repo.lines.length = 0;
    assert.equal((await proofBlock([], repo.options)).status, 1, 'a check is open: the proof block fails');
    const shown = repo.lines.join('\n');
    assert.match(shown, /^- Result: not passed \(checks open on this commit\), pr proof/m);
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
      version, engine: ENGINE_FILE_SHA256, rule: 'regle-commune-livraison v2', kind: 'release', sha: head, tree, clean: true, result: 'passed',
      startedAt: 'x', finishedAt: 'x', command: 'x', node: process.version, packageManager: null, targets: [],
      checks: [{ name: 'test', result: 'passed', external, specialised: false }],
    });
    mkdirSync(path.join(commonDir, 'verify-proofs'), { recursive: true });
    const file = path.join(commonDir, 'verify-proofs', `${tree}.json`);
    // Its run log says the release passed, so only the proof itself is judged here.
    const logLine = (engine) => `${JSON.stringify({ kind: 'release', sha: head, tree, result: 'passed', finishedAt: 'x', engine, checks: [{ name: 'test', result: 'passed', external: true }] })}\n`;
    writeFileSync(path.join(commonDir, 'verify-proofs', runLogName(head)), logLine(ENGINE_FILE_SHA256));

    writeFileSync(file, JSON.stringify(forged(2, 'x')));
    const older = checkReleaseProof({ cwd: repo.work, env: repo.env, fetch: false }).failures;
    assert.deepEqual(older.map((failure) => failure.check), ['proof-present']);
    assert.match(older[0].message, new RegExp(`has format 2, older than ${PROOF_FORMAT_VERSION}`));

    // Format 3 (the previous engine's) is refused for a deploy.
    writeFileSync(file, JSON.stringify(forged(3, undefined)));
    const v3 = checkReleaseProof({ cwd: repo.work, env: repo.env, fetch: false }).failures;
    assert.deepEqual(v3.map((failure) => failure.check), ['proof-present']);
    assert.match(v3[0].message, /has format 3, older than 4/);
    // A v4 proof, or a run log entry, from another engine (or none) is refused.
    const other = 'f'.repeat(64);
    const guardChecks = () => checkReleaseProof({ cwd: repo.work, env: repo.env, fetch: false }).failures;
    writeFileSync(file, JSON.stringify({ ...forged(PROOF_FORMAT_VERSION, undefined), engine: other }));
    assert.deepEqual(guardChecks().map((failure) => failure.check), ['proof-engine']);
    assert.match(guardChecks()[0].message, /written by engine ffffffffffff, not .* pinned at HEAD/);
    const {
  engine,
  ...noEngine
} = forged(PROOF_FORMAT_VERSION, undefined);
    assert.equal(engine, ENGINE_FILE_SHA256);
    writeFileSync(file, JSON.stringify(noEngine));
    assert.deepEqual(guardChecks().map((failure) => failure.check), ['proof-engine']);
    writeFileSync(file, JSON.stringify(forged(PROOF_FORMAT_VERSION, undefined)));
    writeFileSync(path.join(commonDir, 'verify-proofs', runLogName(head)), logLine(other));
    assert.deepEqual(guardChecks().map((failure) => failure.check), ['proof-latest-release'], 'a run logged by another engine');
    writeFileSync(path.join(commonDir, 'verify-proofs', runLogName(head)), logLine(ENGINE_FILE_SHA256));
    assert.deepEqual(guardChecks(), [], 'a fresh v4 proof of the pinned engine is accepted');

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
    assert.match(shown, /^- Result: not passed \(checks open on this commit\), pr proof/m);
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
    assert.match(shown, /^- Result: not passed \(checks open on this commit\), pr proof/m);
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
    // With no run for the head, the tree's proof (of another commit) does not pass it.
    const other = repo.git(['commit-tree', tree, '-p', released, '-m', 'unverified']);
    repo.lines.length = 0;
    assert.equal((await proofBlock(['--rev', other], repo.options)).status, 1);
    assert.match(repo.lines.join('\n'), new RegExp(`^- Commit SHA: \`${other}\`$`, 'm'));
    assert.match(repo.lines.join('\n'), new RegExp(`^- Result: not passed \\(no run of this commit; the proof is for ${released}\\)`, 'm'));
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

  test('a ! glob of the config never takes back one of the engine delivery files', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    const config = readFileSync(path.join(repo.work, 'verify-local.config.mjs'), 'utf8')
      .replace("mainBranch: 'main',", "mainBranch: 'main',\n  deliveryFiles: ['scripts/', '!verify-local.config.mjs'],");
    repo.commit('hide', { 'verify-local.config.mjs': config });
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

describe('cleanup of the isolated copy', () => {
  const left = (dir) => (existsSync(dir) ? readdirSync(dir) : []);

  test('the copy, its .tmp directory and its owner file are removed after a pass and after a failure', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    repo.commit('feature', { 'src/b.js': '1\n' });
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    assert.deepEqual(left(repo.options.worktreeRoot), []);
    const config = readFileSync(path.join(repo.work, 'verify-local.config.mjs'), 'utf8');
    repo.commit('fail', { 'verify-local.config.mjs': config.replace(`command: 'echo lint >> "$RUN_LOG"'`, `command: 'exit 3'`) });
    assert.notEqual((await verify('pr', [], repo.options)).status, 0);
    assert.deepEqual(left(repo.options.worktreeRoot), []);
  });

  test('consecutive runs check their commit out at the same path', async () => {
    const repo = makeRepository();
    repo.git(['checkout', '--quiet', '-b', 'feature']);
    repo.commit('feature', { 'src/b.js': '1\n' });
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    repo.commit('more', { 'src/b.js': '2\n' });
    assert.equal((await verify('pr', [], repo.options)).status, 0);
    const copies = repo.lines.map((line) => /isolated copy (\S+): /.exec(line)?.[1]).filter(Boolean);
    assert.equal(copies.length, 2);
    assert.equal(copies[1], copies[0]);
    assert.equal(path.basename(copies[0]), `${path.basename(repo.work)}-0`);
    assert.deepEqual(left(repo.options.worktreeRoot), []);
  });

  test('a copy takes the lowest slot no run holds, past the last slot a random name', () => {
    const base = mkdtempSync(path.join(scratch, 'slots-'));
    assert.equal(path.basename(claimCopy(base, 'repo')), 'repo-0');
    // A live run owns slot 0.
    assert.equal(path.basename(claimCopy(base, 'repo')), 'repo-1');
    // A kept copy keeps its slot without an owner; a slot its run has left is free again.
    mkdirSync(path.join(base, 'repo-1'));
    rmSync(path.join(base, 'repo-1.owner'));
    rmSync(path.join(base, 'repo-0.owner'));
    assert.equal(path.basename(claimCopy(base, 'repo')), 'repo-0');
    // A .tmp directory alone (its copy being removed) also keeps the slot: TMPDIR is never reused.
    mkdirSync(path.join(base, 'repo-2.tmp'));
    assert.equal(path.basename(claimCopy(base, 'repo')), 'repo-3');
    for (let slot = 4; slot < COPY_SLOTS; slot++) claimCopy(base, 'repo');
    assert.match(path.basename(claimCopy(base, 'repo')), /^repo-[0-9a-f]{6}$/);
  });

  test('a later run sweeps copies whose owner is gone, and keeps those of a live run', () => {
    const base = mkdtempSync(path.join(scratch, 'copies-'));
    const dead = spawnSync(process.execPath, ['-e', '']).pid;
    const make = (name, owner) => {
      mkdirSync(path.join(base, name, 'node_modules'), { recursive: true });
      mkdirSync(path.join(base, `${name}.tmp`));
      if (owner) writeFileSync(path.join(base, `${name}.owner`), `${owner} ${os.hostname()} 0123456789abcdef`);
    };
    make('dead-aaaaaa', dead);
    make('live-bbbbbb', process.pid);
    make('legacy-cccccc', null);
    make('fresh-dddddd', null);
    const old = new Date(Date.now() - RUN_MAX_MS - 60_000);
    for (const name of ['legacy-cccccc', 'legacy-cccccc.tmp']) utimesSync(path.join(base, name), old, old);
    const lines = [];
    const swept = sweepStaleCopies(base, (line) => lines.push(line)).map((dir) => path.basename(dir)).sort();
    assert.deepEqual(swept, ['dead-aaaaaa', 'legacy-cccccc']);
    assert.deepEqual(readdirSync(base).sort(), ['fresh-dddddd', 'fresh-dddddd.tmp', 'live-bbbbbb', 'live-bbbbbb.owner', 'live-bbbbbb.tmp']);
    assert.match(lines.join('\n'), /removed 2 isolated copies left by runs that are gone/);
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
    assert.equal(
      realpathSync(readlinkSync(path.join(copy, 'node_modules', 'ext'))),
      realpathSync(path.join(repo.work, 'node_modules', 'ext')),
    );
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

  for (const mode of ['fail', 'short']) {
    test(`the hook blocks a push when cat-file ${mode === 'fail' ? 'fails' : 'answers short'}`, async () => {
      const repo = makeRepository();
      repo.git(['checkout', '--quiet', '-b', 'feature']);
      const fake = ['AKIA', 'ABCDEFGHIJKLMNOP'].join('');
      const sha = repo.commit('key', { 'src/config.js': `${'// padding\n'.repeat(20)}const key = "${fake}";\n` });
      const output = [];
      const result = await prePush('origin', `refs/heads/feature ${sha} refs/heads/feature ${ZERO}\n`, {
        cwd: repo.work, env: repo.env,
        readObjects: (root, env, entries) => readBlobs(root, env, entries, () => ({
          status: mode === 'fail' ? 1 : 0,
          stdout: Buffer.from(entries[0].object + ' blob 900\nshort'),
        })), log: (line) => output.push(line), error: (line) => output.push(line),
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
