// The noctalia.app production publish guard (scripts/check-site-publish-proof.mjs)
// against proofs written by the real engine (scripts/verify-local.mjs) in
// scratch repositories, the way the sibling repositories test their deploy
// guards: only a passed `release` proof of HEAD = origin/master on a clean
// checkout unlocks a production publish, and nothing overrides that.
// Run: node --test scripts/test-check-site-publish-proof.mjs

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  SITE_PUBLISH_PROOF_CHECKS,
  assertSitePublishProof,
  checkSitePublishProof,
  formatRefusal,
} from './check-site-publish-proof.mjs';
import { PROOF_FORMAT_VERSION, verify } from './verify-local.mjs';

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const guardScript = path.join(scriptsRoot, 'check-site-publish-proof.mjs');

const SCRATCH_CONFIG = `export default {
  mainBranch: 'master',
  commands: { pr: 'npm run verify:pr', release: 'npm run verify:release' },
  deps: { mode: 'link' },
  externalSources: [],
  checks: [
    { name: 'suite', command: 'echo suite >> "$RUN_LOG"' },
    {
      name: 'site-e2e',
      command: 'echo site-e2e >> "$RUN_LOG"',
      kinds: ['release'],
      specialised: true,
      requires: { command: 'test -z "$SITE_E2E_UNAVAILABLE"', hint: 'run it locally or pass owner-machine evidence' },
    },
  ],
};
`;

// verify:pr runs this test in an isolated copy; the scratch repositories must
// not inherit GIT_* variables.
function withoutGitVariables() {
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
}

/** A work clone whose `master` is pushed to a bare `origin`, with helpers that run the real engine on it. */
async function withRepository(run) {
  const root = mkdtempSync(path.join(tmpdir(), 'dreamer-site-publish-proof-'));
  try {
    const globalConfig = path.join(root, 'gitconfig');
    writeFileSync(globalConfig, '');
    const runLog = path.join(root, 'run.log');
    const env = {
      ...withoutGitVariables(),
      GIT_AUTHOR_EMAIL: 'proof@example.test',
      GIT_AUTHOR_NAME: 'Proof Test',
      GIT_COMMITTER_EMAIL: 'proof@example.test',
      GIT_COMMITTER_NAME: 'Proof Test',
      GIT_CONFIG_GLOBAL: globalConfig,
      GIT_CONFIG_NOSYSTEM: '1',
      RUN_LOG: runLog,
      // Each scratch repository takes its own heavy-check lock, never the
      // machine-wide /tmp/fleet-verify-heavy.lock of scripts/verify-local.mjs.
      VERIFY_LOCAL_HEAVY_LOCK: path.join(root, 'heavy.lock'),
    };
    delete env.SITE_E2E_UNAVAILABLE;
    const remote = path.join(root, 'remote.git');
    const work = path.join(root, 'work');
    execFileSync('git', ['init', '-q', '--bare', '-b', 'master', remote], { env });
    execFileSync('git', ['init', '-q', '-b', 'master', work], { env });
    const git = (args, cwd = work) => execFileSync('git', args, { cwd, encoding: 'utf8', env }).trim();
    writeFileSync(path.join(work, 'verify-local.config.mjs'), SCRATCH_CONFIG);
    writeFileSync(path.join(work, '.gitignore'), 'docs/\n');
    writeFileSync(path.join(work, 'tracked.txt'), 'one\n');
    git(['add', '.']);
    git(['commit', '-q', '-m', 'base']);
    git(['remote', 'add', 'origin', remote]);
    git(['push', '-q', 'origin', 'master']);
    git(['fetch', '-q', 'origin']);

    const engine = (kind, args = [], { extraEnv = {} } = {}) =>
      verify(kind, args, { cwd: work, env: { ...env, ...extraEnv }, log: () => {}, worktreeRoot: path.join(root, 'copies') });
    const runs = () => (existsSync(runLog) ? readFileSync(runLog, 'utf8').split('\n').filter(Boolean) : []);
    const check = async ({ cwd = work, fetch = true } = {}) => {
      const result = await checkSitePublishProof({ root: cwd, gitEnv: env, fetch });
      for (const failure of result.failures) {
        assert.ok(SITE_PUBLISH_PROOF_CHECKS.includes(failure.check), `${failure.check} is listed in SITE_PUBLISH_PROOF_CHECKS`);
      }
      return result;
    };
    return await run({ check, engine, env, git, remote, root, runs, work });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const failedChecks = (result) => result.failures.map((failure) => failure.check);

test('a release proof of HEAD = origin/master on a clean checkout passes', async () => {
  await withRepository(async ({ check, engine, env, git, runs, work }) => {
    assert.equal((await engine('release')).status, 0);
    assert.deepEqual(runs(), ['suite', 'site-e2e']);
    const tree = git(['rev-parse', 'HEAD^{tree}']);
    const proof = JSON.parse(readFileSync(path.join(work, '.git', 'verify-proofs', `${tree}.json`), 'utf8'));
    assert.equal(proof.version, PROOF_FORMAT_VERSION);
    assert.equal(proof.kind, 'release');
    assert.equal(proof.sha, git(['rev-parse', 'HEAD']));

    const result = await check();
    assert.deepEqual(result.failures, []);
    assert.equal(result.ok, true);
    const accepted = await assertSitePublishProof({ root: work, gitEnv: env });
    assert.equal(accepted.head, git(['rev-parse', 'HEAD']));
    assert.equal(accepted.tree, tree);
    assert.match(accepted.message, /OK: HEAD [0-9a-f]{40} is origin\/master/);
  });
});

test('HEAD ahead of origin/master is refused, even with a release proof for it', async () => {
  await withRepository(async ({ check, engine, git, work }) => {
    writeFileSync(path.join(work, 'tracked.txt'), 'local\n');
    git(['commit', '-q', '-am', 'local only']);
    assert.equal((await engine('release')).status, 0);
    const result = await check();
    assert.deepEqual(failedChecks(result), ['head-is-origin-main']);
    assert.match(result.failures[0].message, /is not origin\/master/);
  });
});

test('the guard fetches master, so a stale origin/master does not hide a newer master', async () => {
  await withRepository(async ({ check, engine, env, git, remote, root }) => {
    assert.equal((await engine('release')).status, 0);
    const other = path.join(root, 'other');
    execFileSync('git', ['clone', '-q', remote, other], { env });
    writeFileSync(path.join(other, 'tracked.txt'), 'pushed elsewhere\n');
    git(['commit', '-q', '-am', 'newer master'], other);
    git(['push', '-q', 'origin', 'master'], other);
    assert.deepEqual(failedChecks(await check()), ['head-is-origin-main']);
  });
});

test('modified or untracked files are refused, ignored build output is not', async () => {
  await withRepository(async ({ check, engine, work }) => {
    assert.equal((await engine('release')).status, 0);
    execFileSync('mkdir', ['-p', path.join(work, 'docs')]);
    writeFileSync(path.join(work, 'docs', 'index.html'), '<html></html>\n');
    assert.equal((await check()).ok, true);

    writeFileSync(path.join(work, 'stray.txt'), 'new\n');
    assert.deepEqual(failedChecks(await check()), ['clean-tree']);
    rmSync(path.join(work, 'stray.txt'));

    writeFileSync(path.join(work, 'tracked.txt'), 'two\n');
    assert.deepEqual(failedChecks(await check()), ['clean-tree']);
  });
});

test('a missing proof is refused', async () => {
  await withRepository(async ({ check }) => {
    const result = await check();
    assert.deepEqual(failedChecks(result), ['proof-present']);
    assert.match(result.failures[0].message, /no proof for tree [0-9a-f]{40}/);
  });
});

test('a pr proof never unlocks a production publish', async () => {
  await withRepository(async ({ check, engine }) => {
    assert.equal((await engine('pr')).status, 0);
    assert.deepEqual(failedChecks(await check()), ['proof-kind']);
  });
});

test('an incomplete release is refused until the missing check has owner-machine evidence', async () => {
  await withRepository(async ({ check, engine, git }) => {
    const unavailable = { extraEnv: { SITE_E2E_UNAVAILABLE: '1' } };
    assert.equal((await engine('release', [], unavailable)).status, 2);
    assert.deepEqual(failedChecks(await check()), ['proof-passed']);

    const head = git(['rev-parse', 'HEAD']);
    assert.equal((await engine('release', ['--external', `site-e2e=owner-machine: tanuki site-e2e on ${head}`], unavailable)).status, 0);
    assert.deepEqual((await check()).failures, []);
  });
});

test('a stale proof (written for another commit of the same tree) is refused', async () => {
  await withRepository(async ({ check, engine, git, work }) => {
    git(['switch', '-q', '-c', 'feature']);
    writeFileSync(path.join(work, 'tracked.txt'), 'feature\n');
    git(['commit', '-q', '-am', 'feature change']);
    assert.equal((await engine('release')).status, 0);

    const squash = git(['commit-tree', 'HEAD^{tree}', '-p', 'master', '-m', 'squash']);
    git(['switch', '-q', 'master']);
    git(['reset', '-q', '--hard', squash]);
    git(['push', '-q', 'origin', 'master']);
    assert.deepEqual(failedChecks(await check()), ['proof-matches-head']);

    assert.equal((await engine('release')).status, 0);
    assert.deepEqual((await check()).failures, []);
  });
});

test('a proof left from the previous master commit is refused after master moves', async () => {
  await withRepository(async ({ check, engine, git, work }) => {
    assert.equal((await engine('release')).status, 0);
    writeFileSync(path.join(work, 'tracked.txt'), 'next\n');
    git(['commit', '-q', '-am', 'next master']);
    git(['push', '-q', 'origin', 'master']);
    assert.deepEqual(failedChecks(await check()), ['proof-present']);
  });
});

test('there is no override: no environment variable lets a refused publish through', async () => {
  await withRepository(async ({ env, work }) => {
    const extra = {
      SITE_PUBLISH_PROOF_OVERRIDE: 'rollback',
      SHAPIER_DEPLOY_PROOF_OVERRIDE: 'rollback',
      DEPLOY_PROOF_OVERRIDE: 'rollback',
      FORCE: '1',
    };
    const refused = spawnSync(process.execPath, [guardScript, '--root', work], { encoding: 'utf8', env: { ...env, ...extra } });
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /production publish of noctalia\.app refused: no proof for tree [0-9a-f]{40}/);
    assert.match(refused.stderr, /npm run verify:release/);
    assert.match(refused.stderr, /There is no override\./);
    assert.equal(refused.stderr.trim().split('\n').length, 1, 'the refusal is one paragraph');
    await assert.rejects(assertSitePublishProof({ root: work, gitEnv: { ...env, ...extra } }), /refused: no proof/);
    assert.doesNotMatch(readFileSync(guardScript, 'utf8'), /process\.env\.[A-Z_]*OVERRIDE|--force|--override/);
  });
});

test('the refusal names the publish target it guards', async () => {
  await withRepository(async ({ env, work }) => {
    await assert.rejects(
      assertSitePublishProof({ root: work, gitEnv: env, label: 'the Vercel web app (dream.noctalia.app)' }),
      /production publish of the Vercel web app \(dream\.noctalia\.app\) refused: no proof/,
    );
  });
});

test('the refusal message names every failure', () => {
  const message = formatRefusal({ failures: [{ check: 'clean-tree', message: 'the checkout has changes (2 paths)' }, { check: 'proof-present', message: 'no proof for tree abc' }] });
  assert.match(message, /the checkout has changes \(2 paths\); no proof for tree abc/);
});

test('outside a git checkout the guard refuses', async () => {
  const plain = mkdtempSync(path.join(tmpdir(), 'dreamer-site-publish-no-git-'));
  try {
    const result = spawnSync(process.execPath, [guardScript, '--root', plain], {
      encoding: 'utf8',
      env: { ...withoutGitVariables(), GIT_CEILING_DIRECTORIES: path.dirname(plain) },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /refused: the guard could not run/);
  } finally {
    rmSync(plain, { recursive: true, force: true });
  }
});
