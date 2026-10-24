'use strict';
/* global afterEach, beforeEach, describe, expect, it */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const CLI = path.join(__dirname, 'local-workspace.js');
let base, projects, repo, env;
function git(args, cwd = repo) {
  const result = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}
function write(file, data) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); }
function invoke(command, { extra = [], task = 'qa', ownerPid = process.pid } = {}) {
  return spawnSync(process.execPath, [CLI, command, '--repo', repo, '--projects', projects,
    '--task', task, '--owner-pid', String(ownerPid), ...extra], { env, encoding: 'utf8' });
}
function passed(result) {
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout);
}
beforeEach(() => {
  base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'local-workspace-test-')));
  projects = path.join(base, 'Projects');
  repo = path.join(projects, 'sample');
  fs.mkdirSync(repo, { recursive: true });
  env = { ...process.env, GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.test',
    GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.test', PYTHONDONTWRITEBYTECODE: '1' };
  git(['init', '--quiet']);
  write(path.join(repo, '.gitignore'), 'node_modules/\n.secret.local\noutputs/\n');
  write(path.join(repo, 'source.txt'), 'preserved source\n');
  for (const name of ['package.json', 'package-lock.json', 'apps/site/package.json', 'apps/site/package-lock.json']) write(path.join(repo, name), '{}\n');
  git(['add', '.']);
  git(['commit', '--quiet', '-m', 'fixture']);
});
afterEach(() => fs.rmSync(base, { recursive: true, force: true }));

describe('local workspace CLI failure and recovery journeys', () => {
  it('reuses one path, acknowledges release twice and starts the next revision there', () => {
    const first = passed(invoke('prepare'));
    expect(first.path).toBe(path.join(projects, '.workspaces/sample/qa'));
    expect(first.reused).toBe(false);
    expect(passed(invoke('prepare')).reused).toBe(true);
    expect(passed(invoke('release')).released).toBe(true);
    expect(passed(invoke('release')).reused).toBe(true);
    write(path.join(repo, 'source.txt'), 'next source\n');
    git(['commit', '--quiet', '-am', 'next']);
    const next = passed(invoke('prepare'));
    expect(next.path).toBe(first.path);
    expect(next.revision).not.toBe(first.revision);
    passed(invoke('release'));
    expect(fs.existsSync(first.path)).toBe(false);
  });

  it('preserves tracked/untracked WIP and ignored files that were not declared disposable', () => {
    const current = passed(invoke('prepare', { extra: ['--regenerable', 'node_modules'] }));
    write(path.join(current.path, 'source.txt'), 'work in progress\n');
    write(path.join(current.path, 'new.txt'), 'new work\n');
    expect(invoke('release').stderr).toContain('WORKSPACE_HAS_WIP');
    expect(invoke('prepare').stderr).toContain('WORKSPACE_HAS_WIP');
    expect(fs.readFileSync(path.join(current.path, 'new.txt'), 'utf8')).toBe('new work\n');
    git(['restore', 'source.txt'], current.path);
    fs.rmSync(path.join(current.path, 'new.txt'));
    write(path.join(current.path, 'node_modules/cache.bin'), 'regenerable');
    write(path.join(current.path, '.secret.local'), 'private fixture');
    expect(invoke('release').stderr).toContain('WORKSPACE_HAS_PRESERVED_FILES');
    expect(fs.readFileSync(path.join(current.path, '.secret.local'), 'utf8')).toBe('private fixture');
    expect(fs.existsSync(path.join(current.path, 'node_modules/cache.bin'))).toBe(true);
    fs.rmSync(path.join(current.path, '.secret.local'));
    passed(invoke('release'));
  });

  it('keeps a new detached commit and rejects an unmanaged path collision', () => {
    const current = passed(invoke('prepare'));
    write(path.join(current.path, 'source.txt'), 'new commit\n');
    git(['commit', '--quiet', '-am', 'saved only here'], current.path);
    expect(invoke('release').stderr).toContain('WORKSPACE_HEAD_CHANGED');
    expect(git(['log', '-1', '--format=%s'], current.path)).toBe('saved only here');
    const collision = path.join(projects, '.workspaces/sample/foreign');
    write(path.join(collision, 'unique.txt'), 'do not remove');
    expect(invoke('prepare', { task: 'foreign' }).stderr).toContain('WORKSPACE_PATH_COLLISION');
    expect(fs.readFileSync(path.join(collision, 'unique.txt'), 'utf8')).toBe('do not remove');
  });

  it.each(['--assume-unchanged', '--skip-worktree'])('preserves WIP hidden from git status by %s', (flag) => {
    const current = passed(invoke('prepare'));
    git(['update-index', flag, 'source.txt'], current.path);
    write(path.join(current.path, 'source.txt'), 'hidden work in progress\n');
    expect(git(['status', '--porcelain=v1'], current.path)).toBe('');
    expect(invoke('release').stderr).toContain('WORKSPACE_INDEX_FLAGS');
    expect(fs.readFileSync(path.join(current.path, 'source.txt'), 'utf8')).toBe('hidden work in progress\n');
  });

  it.each(['scratch', 'prepare'])('refuses reuse and release after the %s directory was replaced', (command) => {
    const current = passed(invoke(command, { extra: ['--regenerable', 'node_modules'] }));
    fs.renameSync(current.path, current.path + '-preserved');
    fs.cpSync(current.path + '-preserved', current.path, { recursive: true });
    const foreign = path.join(current.path, 'node_modules/unique-input.txt');
    write(foreign, 'foreign input must survive\n');
    if (command === 'prepare') expect(git(['status', '--porcelain=v1'], current.path)).toBe('');
    expect(invoke('release').stderr).toContain('WORKSPACE_DIRECTORY_REPLACED');
    expect(invoke(command).stderr).toContain('WORKSPACE_DIRECTORY_REPLACED');
    expect(fs.readFileSync(foreign, 'utf8')).toBe('foreign input must survive\n');
    expect(fs.existsSync(current.path + '-preserved')).toBe(true);
  });

  it('names an ownerless writer lock explicitly and preserves it for inspected recovery', () => {
    const current = passed(invoke('prepare'));
    const lock = path.join(path.dirname(current.path), '.qa.lock');
    fs.mkdirSync(lock);
    expect(invoke('prepare').stderr).toContain('WORKSPACE_LOCK_OWNER_MISSING');
    expect(fs.existsSync(lock)).toBe(true);
    expect(fs.readFileSync(path.join(current.path, 'source.txt'), 'utf8')).toBe('preserved source\n');
    fs.rmdirSync(lock);
    passed(invoke('release'));
  });

  it('refuses a live competing owner and recovers its lease and a dead writer lock', async () => {
    const owner = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
    let closed = false;
    const stopped = new Promise((resolve) => owner.once('exit', () => { closed = true; resolve(); }));
    try {
      const current = passed(invoke('prepare', { ownerPid: owner.pid }));
      expect(invoke('prepare').stderr).toContain('WORKSPACE_BUSY');
      expect(invoke('release').stderr).toContain('WORKSPACE_BUSY');
      owner.kill();
      await stopped;
      expect(passed(invoke('prepare')).reused).toBe(true);
      const lock = path.join(path.dirname(current.path), '.qa.lock');
      fs.mkdirSync(lock);
      write(path.join(lock, 'owner.json'), JSON.stringify({ schema: 'noctalia.local-workspace/1', pid: owner.pid }));
      expect(passed(invoke('prepare')).reused).toBe(true);
      expect(fs.existsSync(lock)).toBe(false);
      passed(invoke('release'));
    } finally { if (!closed) { owner.kill(); await stopped; } }
  });

  it('refuses symlink destinations and a different revision without touching the existing checkout', () => {
    const current = passed(invoke('prepare'));
    write(path.join(repo, 'source.txt'), 'next source\n');
    git(['commit', '--quiet', '-am', 'next']);
    expect(invoke('prepare').stderr).toContain('WORKSPACE_IDENTITY_COLLISION');
    expect(fs.readFileSync(path.join(current.path, 'source.txt'), 'utf8')).toBe('preserved source\n');
    fs.symlinkSync(repo, path.join(projects, '.workspaces/sample/link'), process.platform === 'win32' ? 'junction' : 'dir');
    expect(invoke('prepare', { task: 'link' }).stderr).toContain('WORKSPACE_PATH_COLLISION');
    expect(fs.readFileSync(path.join(repo, 'source.txt'), 'utf8')).toBe('next source\n');
  });
});
