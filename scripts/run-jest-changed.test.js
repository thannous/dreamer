'use strict';

const { execFileSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { buildJestArgs, resolveChangedSince, runJestChanged, runPrePush } = require('./run-jest-changed');

describe('run-jest-changed', () => {
  it('keeps the explicit CI base and allows an explicit HEAD for a working-tree delta', () => {
    const git = jest.fn();
    expect(resolveChangedSince({ JEST_CHANGED_SINCE: ' base-sha ' }, git)).toBe('base-sha');
    expect(resolveChangedSince({ JEST_CHANGED_SINCE: 'HEAD' }, git)).toBe('HEAD');
    expect(git).not.toHaveBeenCalled();
  });

  it('selects committed changes since master, including both levels of a stacked branch', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'noctalia-jest-base-'));
    const git = args => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
    try {
      git(['init', '-q', '-b', 'master']);
      git(['config', 'user.name', 'Fixture']);
      git(['config', 'user.email', 'fixture@noctalia.invalid']);
      git(['config', 'gc.auto', '0']);
      git(['config', 'maintenance.auto', 'false']);
      git(['commit', '--allow-empty', '-qm', 'base']);
      const base = git(['rev-parse', 'HEAD']);
      git(['update-ref', 'refs/remotes/origin/master', base]);
      git(['checkout', '-qb', 'parent']);
      writeFileSync(path.join(directory, 'parent.ts'), 'export const parent = 1;');
      git(['add', '.']);
      git(['commit', '-qm', 'parent']);
      git(['checkout', '-qb', 'child']);
      writeFileSync(path.join(directory, 'child.ts'), 'export const child = 1;');
      git(['add', '.']);
      git(['commit', '-qm', 'child']);
      expect(git(['status', '--porcelain'])).toBe('');
      expect(resolveChangedSince({}, git)).toBe(base);
      expect(resolveChangedSince({ JEST_CHANGED_SINCE: ' ' }, git)).toBe(base);
      expect(git(['diff', '--name-only', resolveChangedSince({}, git), 'HEAD']).split('\n')).toEqual(['child.ts', 'parent.ts']);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('does not hide a missing master ref with a successful empty HEAD comparison', () => {
    expect(() => resolveChangedSince({}, () => { throw new Error('missing ref'); })).toThrow('missing ref');
  });

  it('keeps quiet execution and permits a legitimate empty related-test set', () => {
    expect(buildJestArgs(['--runInBand'], { JEST_CHANGED_SINCE: 'abc123' })).toEqual([
      '--changedSince=abc123', '--passWithNoTests', '--silent', '--runInBand',
    ]);
  });

  it('returns the Jest failure status', () => {
    const spawnSyncImpl = jest.fn(() => ({ status: 7 }));
    expect(runJestChanged({ env: { JEST_CHANGED_SINCE: 'base' }, execPath: '/node', jestBin: '/jest.js', spawnSyncImpl })).toBe(7);
  });

  it('fails when Jest terminates without an exit status', () => {
    expect(runJestChanged({ env: { JEST_CHANGED_SINCE: 'base' }, jestBin: '/jest.js', spawnSyncImpl: () => ({ status: null, signal: 'SIGTERM' }) })).toBe(1);
  });
});

function prepushFixture(parameters = {}) {
  const gitImpl = jest.fn(args => {
    if (args[0] === 'status' || args[0] === 'fetch') return '';
    if (args[1] === '--abbrev-ref') return 'codex/feature';
    if (args[0] === 'rev-parse') return 'final-head';
    if (args[0] === 'merge-base') return 'fresh-master-base';
    throw new Error(`Unexpected Git command: ${args}`);
  });
  return {
    env: { JEST_CHANGED_SINCE: 'HEAD' }, gitImpl,
    classifyImpl: jest.fn(() => ({ run_noctalia: true, run_changed_tests: true, run_full_tests: false, run_site: false, ...parameters })),
    runTypesImpl: jest.fn(() => 0), runJestImpl: jest.fn(() => 0), log: jest.fn(),
  };
}

describe('pre-push guard', () => {
  it('refreshes master and checks app/test types plus all impacted tests on the committed revision', () => {
    const options = prepushFixture();
    expect(runPrePush(options)).toBe(0);
    expect(options.gitImpl).toHaveBeenCalledWith(['fetch', '--no-tags', 'origin', 'master:refs/remotes/origin/master']);
    expect(options.classifyImpl).toHaveBeenCalledWith('fresh-master-base', 'final-head');
    expect(options.runTypesImpl.mock.calls).toEqual([['typecheck:app'], ['typecheck:tests']]);
    expect(options.runJestImpl).toHaveBeenCalledWith({ argv: ['--runInBand', '--watchman=false'], env: { JEST_CHANGED_SINCE: 'fresh-master-base' } });
  });

  it.each([' M lib/i18n/fr.ts', '?? hooks/newHook.ts'])('refuses an uncommitted input (%s) before fetching or running checks', status => {
    const options = prepushFixture();
    options.gitImpl.mockReturnValueOnce(status);
    expect(() => runPrePush(options)).toThrow('clean worktree');
    expect(options.classifyImpl).not.toHaveBeenCalled();
    expect(options.runJestImpl).not.toHaveBeenCalled();
    expect(options.gitImpl).toHaveBeenCalledTimes(1);
  });

  it.each(['release', 'release/3.2'])('refuses the lightweight path for %s branches', branch => {
    const options = prepushFixture();
    const original = options.gitImpl.getMockImplementation();
    options.gitImpl.mockImplementation(args => args[1] === '--abbrev-ref' ? branch : original(args));
    expect(() => runPrePush(options)).toThrow('complete release validation');
    expect(options.classifyImpl).not.toHaveBeenCalled();
  });

  it('does not qualify a tag pipeline with an affected-only check', () => {
    const options = prepushFixture();
    expect(() => runPrePush({ ...options, env: { CIRCLE_TAG: 'v3.2' } })).toThrow('complete release validation');
  });

  it('refuses partial test filters', () => {
    const options = prepushFixture();
    expect(() => runPrePush({ ...options, argv: ['--testNamePattern=easy'] })).toThrow('does not accept test filters');
    expect(options.gitImpl).not.toHaveBeenCalled();
  });

  it('does not run application checks for internal documentation classified as a no-op', () => {
    const options = prepushFixture({ run_noctalia: false, run_changed_tests: false });
    expect(runPrePush(options)).toBe(0);
    expect(options.runJestImpl).not.toHaveBeenCalled();
    expect(options.runTypesImpl).not.toHaveBeenCalled();
    expect(options.log).toHaveBeenLastCalledWith(expect.stringContaining('Jest not applicable'));
  });

  it('keeps affected tooling tests for a site-only change without app typechecks', () => {
    const options = prepushFixture({ run_noctalia: false, run_changed_tests: false, run_site: true });
    expect(runPrePush(options)).toBe(0);
    expect(options.runJestImpl).toHaveBeenCalledTimes(1);
    expect(options.runTypesImpl).not.toHaveBeenCalled();
  });

  it('stops on a type error before running Jest', () => {
    const options = prepushFixture();
    options.runTypesImpl.mockReturnValue(2);
    expect(runPrePush(options)).toBe(2);
    expect(options.runJestImpl).not.toHaveBeenCalled();
  });

  it('propagates a failing test without reporting success', () => {
    const options = prepushFixture();
    options.runJestImpl.mockReturnValue(1);
    expect(runPrePush(options)).toBe(1);
    expect(options.log).not.toHaveBeenCalledWith(expect.stringContaining('tests passed'));
  });

  it('refuses a failed fetch instead of selecting tests from stale refs', () => {
    const options = prepushFixture();
    const original = options.gitImpl.getMockImplementation();
    options.gitImpl.mockImplementation(args => {
      if (args[0] === 'fetch') throw new Error('offline');
      return original(args);
    });
    expect(() => runPrePush(options)).toThrow('offline');
    expect(options.classifyImpl).not.toHaveBeenCalled();
  });

  it.each(['HEAD', 'base', 'worktree'])('invalidates a passing result if %s changes during checks', kind => {
    const options = prepushFixture();
    const original = options.gitImpl.getMockImplementation();
    let finished = false;
    options.runJestImpl.mockImplementation(() => { finished = true; return 0; });
    options.gitImpl.mockImplementation(args => {
      if (finished && kind === 'HEAD' && args[0] === 'rev-parse') return 'new-head';
      if (finished && kind === 'base' && args[0] === 'merge-base') return 'new-base';
      if (finished && kind === 'worktree' && args[0] === 'status') return ' M app/recording.tsx';
      return original(args);
    });
    expect(() => runPrePush(options)).toThrow();
    expect(options.log).not.toHaveBeenCalledWith(expect.stringContaining('tests passed'));
  });

  it('fails closed on an incomplete classifier response', () => {
    const options = prepushFixture({ run_changed_tests: undefined });
    expect(() => runPrePush(options)).toThrow('Missing CI classification');
  });

  it('does not silently replace an unreliable diff with a lightweight success', () => {
    const options = prepushFixture({ run_full_tests: true });
    expect(() => runPrePush(options)).toThrow('No reliable affected-test selection');
    expect(options.runJestImpl).not.toHaveBeenCalled();
  });
});
