'use strict';
/* global describe, expect, it, jest */

const {
  buildJestArgs,
  resolveChangedSince,
  runJestChanged,
} = require('./run-jest-changed');

describe('run-jest-changed', () => {
  it('uses the PR base SHA provided by the environment', () => {
    expect(resolveChangedSince({ JEST_CHANGED_SINCE: ' base-sha ' })).toBe(
      'base-sha'
    );
  });

  it('falls back to HEAD outside CI', () => {
    expect(resolveChangedSince({})).toBe('HEAD');
    expect(resolveChangedSince({ JEST_CHANGED_SINCE: '  ' })).toBe('HEAD');
  });

  it('builds a quiet, non-failing command when no related test exists', () => {
    expect(buildJestArgs(['--runInBand'], { JEST_CHANGED_SINCE: 'abc123' })).toEqual([
      '--changedSince=abc123',
      '--passWithNoTests',
      '--silent',
      '--runInBand',
    ]);
  });

  it('runs Jest directly and returns its exit status', () => {
    const spawnSyncImpl = jest.fn(() => ({ status: 7 }));
    const env = { JEST_CHANGED_SINCE: 'base' };

    expect(runJestChanged({
      argv: ['--runInBand'],
      env,
      execPath: '/node',
      jestBin: '/jest.js',
      spawnSyncImpl,
    })).toBe(7);
    expect(spawnSyncImpl).toHaveBeenCalledWith(
      '/node',
      [
        '/jest.js',
        '--changedSince=base',
        '--passWithNoTests',
        '--silent',
        '--runInBand',
      ],
      { env, stdio: 'inherit' }
    );
  });

  it('fails closed when Jest terminates without an exit status', () => {
    expect(runJestChanged({
      execPath: '/node',
      jestBin: '/jest.js',
      spawnSyncImpl: () => ({ status: null, signal: 'SIGTERM' }),
    })).toBe(1);
  });
});
