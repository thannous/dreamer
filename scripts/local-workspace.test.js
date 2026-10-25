'use strict';
/* global afterEach, beforeEach, describe, expect, it */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const CLI = path.join(__dirname, 'local-workspace.js');
const BENCHMARK = path.join(__dirname, 'site-performance/measure-install.py');
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

function benchmark(extra = [], failure = '') {
  const executable = path.join(base, 'fake-npm');
  const trace = path.join(base, 'npm-calls.jsonl');
  write(executable, `#!/usr/bin/env python3
import json, os, pathlib, sys
cache = pathlib.Path(sys.argv[sys.argv.index('--cache') + 1])
trace = pathlib.Path(os.environ['INSTALL_TEST_TRACE'])
count = len(trace.read_text().splitlines()) if trace.exists() else 0
with trace.open('a') as stream: stream.write(json.dumps({'cache':str(cache),'warm':(cache/'populated').exists()})+'\\n')
(cache/'populated').write_text('download fixture')
pathlib.Path('node_modules').mkdir(exist_ok=True)
sys.exit(23 if str(count + 1) == os.environ.get('INSTALL_TEST_FAIL_AT') else 0)
`);
  fs.chmodSync(executable, 0o755);
  const output = path.join(repo, 'outputs/benchmark');
  const result = spawnSync('python3', [BENCHMARK, output, '--repository', repo, '--projects', projects, '--npm', executable, ...extra], {
    env: { ...env, INSTALL_TEST_TRACE: trace, INSTALL_TEST_FAIL_AT: failure }, encoding: 'utf8',
  });
  const calls = fs.existsSync(trace) ? fs.readFileSync(trace, 'utf8').trim().split('\n').map(JSON.parse) : [];
  return { ...result, output, calls, receipt: JSON.parse(fs.readFileSync(path.join(output, 'workspace-receipt.json'), 'utf8')) };
}

describe('install benchmark CLI lifecycle without real package installs', () => {
  it('refuses external output and symlink escapes before creating any report or workspace', () => {
    const external = path.join(base, 'external');
    const run = (output) => spawnSync('python3', [BENCHMARK, output, '--repository', repo, '--projects', projects,
      '--npm', path.join(base, 'must-not-run')], { env, encoding: 'utf8' });
    const direct = run(path.join(external, 'report'));
    expect(direct.status).toBe(1);
    expect(direct.stderr).toContain('Use outputs/');
    expect(fs.existsSync(external)).toBe(false);
    expect(fs.existsSync(path.join(projects, '.workspaces'))).toBe(false);
    fs.mkdirSync(external);
    fs.symlinkSync(external, path.join(repo, 'outputs'), process.platform === 'win32' ? 'junction' : 'dir');
    const escaped = run(path.join(repo, 'outputs/escaped-report'));
    expect(escaped.status).toBe(1);
    expect(escaped.stderr).toContain('Use outputs/');
    expect(fs.existsSync(path.join(external, 'escaped-report'))).toBe(false);
    expect(fs.existsSync(path.join(projects, '.workspaces'))).toBe(false);
  });

  it('keeps six distinct cold caches and their warm pairs, then removes scratch', () => {
    const result = benchmark();
    expect(result.status).toBe(0);
    expect(result.calls).toHaveLength(12);
    expect(new Set(result.calls.map((call) => call.cache)).size).toBe(6);
    result.calls.forEach((call, index) => {
      expect(call.warm).toBe(index % 2 === 1);
      expect(call.cache.startsWith(path.join(projects, '.workspaces/sample/measure-install') + path.sep)).toBe(true);
    });
    expect(result.receipt.cleanup).toBe('released');
    expect(fs.existsSync(result.receipt.workspace)).toBe(false);
  });

  it('preserves the primary npm failure, partial report and logs while releasing scratch', () => {
    const result = benchmark([], '3');
    expect(result.status).toBe(23);
    expect(result.calls).toHaveLength(3);
    expect(result.receipt.result).toBe('failed');
    expect(result.receipt.cleanup).toBe('released');
    expect(fs.existsSync(result.receipt.workspace)).toBe(false);
    expect(JSON.parse(fs.readFileSync(path.join(result.output, 'install-summary.json'), 'utf8'))[2].exit).toBe(23);
    expect(fs.existsSync(path.join(result.output, 'root-2-cold.log'))).toBe(true);
  });

  it('retains scratch only on explicit request and refuses overwriting it on a later run', () => {
    const first = benchmark(['--keep-workspace']);
    expect(first.status).toBe(0);
    expect(first.receipt.cleanup).toBe('retained');
    expect(fs.existsSync(first.receipt.workspace)).toBe(true);
    const retry = benchmark();
    expect(retry.status).toBe(1);
    expect(retry.stderr).toContain('WORKSPACE_RETAINED_FOR_INSPECTION');
    expect(retry.calls).toHaveLength(12);
    passed(invoke('release', { task: 'measure-install' }));
  });
});
