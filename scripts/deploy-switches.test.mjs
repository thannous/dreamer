// Production never follows a push: Git deployments stay off on Vercel, no
// hosted pipeline publishes, and Vercel's ignored-build step skips previews
// and documentation-only changes. Run by ci-contracts (verify-local.config.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vercel = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

function filesUnder(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name));
}

test('Git deployments are disabled and no hosted pipeline publishes production', () => {
  assert.equal(vercel.git.deploymentEnabled, false);
  const watched = [path.join(ROOT, '.circleci/config.yml'), ...filesUnder(path.join(ROOT, '.github'))];
  for (const file of watched) {
    const text = readFileSync(file, 'utf8');
    for (const forbidden of ['vercel deploy', 'vercel --prod', 'wrangler pages deploy', 'docs:deploy:prod']) {
      assert.ok(!text.includes(forbidden), `${path.relative(ROOT, file)} must not publish production`);
    }
  }
});

test('Vercel skips previews and builds only when an application file changed', () => {
  const repo = mkdtempSync(path.join(tmpdir(), 'noctalia-vercel-ignore-'));
  let revision = 0;
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  const commit = (...files) => {
    for (const file of files) {
      mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
      writeFileSync(path.join(repo, file), `${file} ${revision++}\n`);
    }
    git('add', '-A');
    git('commit', '-qm', 'fixture');
    return git('rev-parse', 'HEAD');
  };
  const run = (environment, previous) => {
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('VERCEL_')));
    env.VERCEL_ENV = environment;
    if (previous !== undefined) env.VERCEL_GIT_PREVIOUS_SHA = previous;
    return spawnSync('bash', ['-c', vercel.ignoreCommand], { cwd: repo, env, stdio: 'ignore' }).status;
  };
  try {
    git('init', '-q', '-b', 'master');
    git('config', 'user.email', 'ci-test@noctalia.invalid');
    git('config', 'user.name', 'CI fixture');
    mkdirSync(path.join(repo, 'scripts'));
    writeFileSync(path.join(repo, 'scripts/vercel-ignore-build.mjs'), readFileSync(path.join(ROOT, 'scripts/vercel-ignore-build.mjs')));
    const base = commit('app/index.ts');
    const docs = commit('doc_web_interne/x.md', 'tests/a.test.ts', '.circleci/config.yml', 'README.md', 'nested/notes.md',
      'components/chat/__tests__/Composer.test.tsx', 'lib/format.test.ts', 'services/guide.spec.tsx');
    for (const environment of ['production', '', 'development']) {
      assert.equal(run(environment), 0, 'docs-only push via HEAD^ fallback');
      assert.equal(run(environment, base), 0, 'docs-only push since last deployment');
      assert.equal(run(environment, 'f'.repeat(40)), 1, 'unknown previous deployment must build');
    }
    const app = commit('app/index.ts');
    commit('docs/after.md');
    assert.equal(run('production', docs), 1, 'docs commit must not hide an earlier app change');
    assert.equal(run('production'), 0, 'HEAD^ fallback only sees the last commit');
    git('mv', 'app/index.ts', 'docs/index.ts');
    git('commit', '-qm', 'move app file into docs');
    assert.equal(run('production'), 1, 'rename out of the app must build');
    for (const lookalike of ['docsx/a.ts', 'tools.ts', 'docs-src/static/data/curation-pages.json',
      'docs-src/static/img/onboarding.webp', 'docs-src/content/guide.md', 'app/__tests__/route.test.tsx',
      'app/settings.test.tsx', 'lib/test-utils.ts', 'lib/testing.ts']) {
      commit(lookalike);
      assert.equal(run('production'), 1, lookalike);
    }
    assert.equal(run('preview', app), 0, 'previews never build');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
