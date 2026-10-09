'use strict';

// Contract of the `prepare` step (common delivery rule v2, section 3): it
// installs the tracked hooks in the repository that owns the package, never
// fails an install, and does nothing outside a Git work tree (EAS, archives),
// for a package nested in another repository, or over a customized hooks path.

const { spawnSync } = require('node:child_process');
const { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const INSTALLER = path.join(__dirname, 'install-git-hooks.js');

let base;
beforeEach(() => {
  base = mkdtempSync(path.join(tmpdir(), 'noctalia-hooks-install-'));
});
afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

const env = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
  GIT_CONFIG_NOSYSTEM: '1',
};

function makePackage(directory) {
  mkdirSync(path.join(directory, 'scripts'), { recursive: true });
  mkdirSync(path.join(directory, '.githooks'), { recursive: true });
  copyFileSync(INSTALLER, path.join(directory, 'scripts', 'install-git-hooks.js'));
  writeFileSync(path.join(directory, '.githooks', 'pre-push'), '#!/bin/sh\n', { mode: 0o755 });
  return directory;
}

function install(directory, extraEnv = {}) {
  return spawnSync(process.execPath, [path.join(directory, 'scripts', 'install-git-hooks.js')], {
    cwd: directory,
    env: { ...env, HOME: base, ...extraEnv },
    encoding: 'utf8',
  });
}

function git(directory, ...args) {
  return spawnSync('git', args, { cwd: directory, env: { ...env, HOME: base }, encoding: 'utf8' });
}

const hooksPath = (directory) => git(directory, 'config', '--get', 'core.hooksPath').stdout.trim();

describe('install-git-hooks', () => {
  it('points the owning repository at .githooks and names the fast checks, not a suite', () => {
    const directory = makePackage(path.join(base, 'repo'));
    git(directory, 'init', '--quiet');
    const result = install(directory);
    expect(result.status).toBe(0);
    expect(hooksPath(directory)).toBe('.githooks');
    expect(result.stdout).toContain('fast pre-push checks');
    expect(result.stdout).toContain('npm run verify:pr');
    expect(result.stdout).not.toContain('verify:fast');
    expect(install(directory).stdout).toBe('');
  });

  it('does nothing and succeeds outside a Git work tree or without git', () => {
    const directory = makePackage(path.join(base, 'archive'));
    const outside = install(directory);
    expect(outside.status).toBe(0);
    expect(outside.stdout + outside.stderr).toBe('');

    const withoutGit = install(directory, { PATH: path.join(base, 'empty-bin') });
    expect(withoutGit.status).toBe(0);
    expect(withoutGit.stdout + withoutGit.stderr).toBe('');
  });

  it('leaves a parent repository alone when the package is not its root', () => {
    git(base, 'init', '--quiet');
    const directory = makePackage(path.join(base, 'vendor', 'package'));
    const result = install(directory);
    expect(result.status).toBe(0);
    expect(hooksPath(base)).toBe('');
  });

  it('keeps a customized hooks path and still succeeds', () => {
    const directory = makePackage(path.join(base, 'custom'));
    git(directory, 'init', '--quiet');
    git(directory, 'config', 'core.hooksPath', 'my-hooks');
    const result = install(directory);
    expect(result.status).toBe(0);
    expect(hooksPath(directory)).toBe('my-hooks');
    expect(result.stderr).toContain('left unchanged');
  });
});
