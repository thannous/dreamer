'use strict';

const { execFileSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { buildJestArgs, resolveChangedSince, runJestChanged } = require('./run-jest-changed');

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
