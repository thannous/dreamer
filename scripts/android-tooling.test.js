'use strict';
/* global describe, expect, it, jest */

const path = require('node:path');

const {
  getAdbCandidates,
  resolveCommand,
  resolveNpmInvocation,
} = require('./android-tooling');

describe('Android command resolution', () => {
  it('includes the standard Windows Android SDK adb executable', () => {
    expect(
      getAdbCandidates(
        { LOCALAPPDATA: 'C:\\Users\\tester\\AppData\\Local' },
        'win32'
      )
    ).toContain(
      path.join(
        'C:\\Users\\tester\\AppData\\Local',
        'Android',
        'Sdk',
        'platform-tools',
        'adb.exe'
      )
    );
  });

  it('uses the platform lookup command supplied by the caller', () => {
    const spawn = jest.fn(() => ({ status: 0, stdout: '', stderr: '' }));

    expect(resolveCommand('adb', { spawn, platform: 'win32' })).toBe('adb');
    expect(spawn).toHaveBeenCalledWith('where', ['adb'], { encoding: 'utf8' });
  });

  it('falls back to the Windows SDK when adb is absent from PATH', () => {
    const env = { LOCALAPPDATA: 'C:\\Users\\tester\\AppData\\Local' };
    const expected = path.join(
      env.LOCALAPPDATA,
      'Android',
      'Sdk',
      'platform-tools',
      'adb.exe'
    );

    expect(
      resolveCommand('adb', {
        env,
        platform: 'win32',
        spawn: () => ({ status: 1, stdout: '', stderr: '' }),
        existsSync: (candidate) => candidate === expected,
      })
    ).toBe(expected);
  });
});

describe('npm command resolution', () => {
  it('runs npm through Node when npm_execpath is available', () => {
    expect(
      resolveNpmInvocation({
        env: { npm_execpath: 'C:\\tools\\npm-cli.js' },
        execPath: 'C:\\node\\node.exe',
        existsSync: (candidate) => candidate === 'C:\\tools\\npm-cli.js',
        platform: 'win32',
      })
    ).toEqual({
      command: 'C:\\node\\node.exe',
      baseArgs: ['C:\\tools\\npm-cli.js'],
    });
  });

  it('uses the npm CLI bundled beside Node on direct Windows invocation', () => {
    const execPath = 'C:\\Program Files\\nodejs\\node.exe';
    const bundledCli = path.join(
      path.dirname(execPath),
      'node_modules',
      'npm',
      'bin',
      'npm-cli.js'
    );

    expect(
      resolveNpmInvocation({
        env: {},
        execPath,
        existsSync: (candidate) => candidate === bundledCli,
        platform: 'win32',
      })
    ).toEqual({ command: execPath, baseArgs: [bundledCli] });
  });

  it('fails closed when a direct Windows invocation cannot find npm', () => {
    expect(
      resolveNpmInvocation({
        env: {},
        execPath: 'C:\\node\\node.exe',
        existsSync: () => false,
        platform: 'win32',
      })
    ).toBeNull();
  });
});
