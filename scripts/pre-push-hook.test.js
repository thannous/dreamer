'use strict';

// Contract of the pre-push hook (common delivery rule v2, section 3), run with
// the real .githooks/pre-push, scripts/verify-local.mjs and
// verify-local.config.mjs in a fixture repository: a deletion or a push with no
// new commit runs nothing; a push takes a few seconds; forbidden files and
// secrets are blocked, the tracked public profiles are not; the proof of the
// pushed tree is reported and its absence does not block.

const { spawnSync } = require('node:child_process');
const { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SHIPPED = ['.githooks/pre-push', 'scripts/verify-local.mjs', 'verify-local.config.mjs'];
const ZERO = '0'.repeat(40);

jest.setTimeout(60_000);

let base;
beforeEach(() => {
  base = mkdtempSync(path.join(tmpdir(), 'noctalia-pre-push-'));
});
afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

function fixture() {
  const origin = path.join(base, 'origin.git');
  const work = path.join(base, 'work');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  Object.assign(env, {
    PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH}`,
    HOME: base,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Fixture',
    GIT_AUTHOR_EMAIL: 'fixture@noctalia.invalid',
    GIT_COMMITTER_NAME: 'Fixture',
    GIT_COMMITTER_EMAIL: 'fixture@noctalia.invalid',
  });
  const run = (command, args, options = {}) =>
    spawnSync(command, args, { cwd: work, env, encoding: 'utf8', ...options });
  const git = (...args) => {
    const result = run('git', args);
    if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
    return result.stdout.trim();
  };
  const write = (file, content) => {
    mkdirSync(path.dirname(path.join(work, file)), { recursive: true });
    writeFileSync(path.join(work, file), content);
  };
  const commit = (message, files) => {
    for (const [file, content] of Object.entries(files)) write(file, content);
    git('add', '-A');
    git('commit', '--quiet', '-m', message);
    return git('rev-parse', 'HEAD');
  };

  run('git', ['init', '--quiet', '--bare', '--initial-branch=master', origin], { cwd: base });
  run('git', ['clone', '--quiet', origin, work], { cwd: base });
  git('checkout', '--quiet', '-B', 'master');
  for (const file of SHIPPED) {
    mkdirSync(path.dirname(path.join(work, file)), { recursive: true });
    copyFileSync(path.join(ROOT, file), path.join(work, file));
  }
  commit('init', { 'lib/value.ts': 'export const value = 1;\n', '.env.mock': 'EXPO_PUBLIC_MOCK_MODE=true\n' });
  git('push', '--quiet', 'origin', 'master');
  git('config', 'core.hooksPath', '.githooks');
  const push = (...args) => {
    const started = Date.now();
    const result = run('git', ['push', ...args]);
    return { ...result, output: `${result.stdout}${result.stderr}`, elapsed: Date.now() - started };
  };
  return { work, env, run, git, commit, push };
}

describe('pre-push hook', () => {
  it('runs nothing for a branch deletion or a push without a new commit', () => {
    const repo = fixture();
    repo.git('push', '--quiet', 'origin', 'master:refs/heads/copy');

    const deletion = repo.push('origin', '--delete', 'copy');
    expect(deletion.status).toBe(0);
    expect(deletion.output).toContain('nothing new to send; no check run');

    const head = repo.git('rev-parse', 'HEAD');
    const known = repo.run('sh', ['.githooks/pre-push', 'origin'], {
      input: `refs/heads/again ${head} refs/heads/again ${ZERO}\n`,
    });
    expect(known.status).toBe(0);
    expect(known.stdout).toContain('nothing new to send; no check run');
  });

  it('sends a clean push in a few seconds and says the proof is still missing', () => {
    const repo = fixture();
    repo.git('checkout', '--quiet', '-b', 'feature');
    repo.commit('feature', { 'lib/value.ts': 'export const value = 2;\n' });

    const result = repo.push('--quiet', 'origin', 'feature');
    expect(result.status).toBe(0);
    expect(result.output).toContain('no proof yet; run npm run verify:pr before asking for a merge');
    expect(result.output).toContain('fast checks passed');
    expect(result.elapsed).toBeLessThan(10_000);
    expect(repo.git('ls-remote', 'origin', 'refs/heads/feature')).not.toBe('');
  });

  it('reports the proof of the pushed tree', () => {
    const repo = fixture();
    repo.git('checkout', '--quiet', '-b', 'feature');
    const sha = repo.commit('feature', { 'lib/value.ts': 'export const value = 3;\n' });
    const tree = repo.git('rev-parse', `${sha}^{tree}`);
    const proofs = path.join(repo.work, '.git', 'verify-proofs');
    mkdirSync(proofs, { recursive: true });
    writeFileSync(path.join(proofs, `${tree}.json`), JSON.stringify({
      version: 2,
      kind: 'pr',
      result: 'passed',
      sha,
      tree,
      finishedAt: '2026-10-09T12:00:00.000Z',
      checks: [{ name: 'lint', result: 'passed', durationMs: 1000 }],
    }));

    const result = repo.push('--quiet', 'origin', 'feature');
    expect(result.status).toBe(0);
    expect(result.output).toContain(`pr proof passed (1 run, 0 reused, 0 out of scope) on ${sha.slice(0, 12)}`);
  });

  it('blocks forbidden files and secrets but not the tracked public profiles', () => {
    const repo = fixture();
    repo.git('checkout', '--quiet', '-b', 'feature');
    repo.commit('mixed', {
      '.env.local': 'SUPABASE_SERVICE_ROLE_KEY=x\n',
      '.env.mock': 'EXPO_PUBLIC_MOCK_MODE=false\n',
      'lib/leak.ts': `export const key = '${['AKIA', 'ABCDEFGHIJKLMNOP'].join('')}';\n`,
      'supabase/functions/api/lib/playIntegrity.ts': `export const strip = (pem: string) => pem.replace('${['-----BEGIN', 'PRIVATE KEY-----'].join(' ')}', '');\n`,
    });

    const result = repo.push('--quiet', 'origin', 'feature');
    expect(result.status).not.toBe(0);
    expect(result.output).toContain('.env.local: forbidden file');
    expect(result.output).toContain('lib/leak.ts: looks like a AWS access key');
    expect(result.output).not.toContain('.env.mock');
    expect(result.output).not.toContain('playIntegrity.ts');
    expect(repo.git('ls-remote', 'origin', 'refs/heads/feature')).toBe('');
  });

  it('stops with the setup command when node is missing', () => {
    const repo = fixture();
    const bin = path.join(base, 'bin');
    mkdirSync(bin);
    const gitPath = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
    symlinkSync(gitPath, path.join(bin, 'git'));
    const result = spawnSync('/bin/sh', ['.githooks/pre-push', 'origin'], {
      cwd: repo.work,
      env: { ...repo.env, PATH: bin },
      input: `refs/heads/master ${repo.git('rev-parse', 'HEAD')} refs/heads/master ${ZERO}\n`,
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('node is not on PATH');
    expect(result.stderr).toContain('mise install');
  });
});
