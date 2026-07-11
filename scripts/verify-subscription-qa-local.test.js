const {
  checkNodeSyntaxFiles,
  commands,
  exitCodeForUnexpectedStatus,
  getResultError,
  runReportCommand,
  runCommands,
  syntaxFiles,
  unitTestFiles,
} = require('./verify-subscription-qa-local');

function memoryStream() {
  let value = '';
  return {
    write(chunk) {
      value += chunk;
    },
    value() {
      return value;
    },
  };
}

describe('subscription QA local verifier', () => {
  it('requires the QA report to surface current session readiness blockers', () => {
    const reportCommand = commands.find((command) => command.label === 'report: subscription QA coverage');

    expect(reportCommand.env).toMatchObject({
      REVENUECAT_PLAY_STORE_STATE_PATH: 'doc_web_interne/docs/revenuecat-play-store-state.example.json',
    });

    expect(reportCommand.expectedStdoutIncludes).toEqual(
      expect.arrayContaining([
        '## Evidence Commands',
        'OK | Authenticated Test Store paywall flow exists',
        'Authenticated Test Store paywall',
        'npm run subscription:qa:evidence -- --gate play_monthly',
        '--installer-package-name com.android.vending',
        '## Current Session Readiness',
        'Verified manual/external scenarios: 0',
        'Manual or external gates remaining: 7',
        'Account switch | Test Store or Play | Plus user logout does not leak to free user',
        'Test Store signed-in account env',
        'Account switch second account env',
        'Device app user id extraction',
        'Physical Android device visibility',
        'npm run android:device:physical',
        'checks USB and ADB Wireless Debugging mDNS visibility',
        'Play install source diagnostic exists',
        'npm run android:play-install-source -- --device <adb-id>',
        'Play QA device preflight exists',
        'npm run android:play-qa-device -- --device <adb-id>',
        'Play QA device wait helper exists',
        'npm run android:play-qa-device:wait',
        'npm run android:play-qa-device:wait while connecting one Play-installed tester phone',
        'add -- --device <adb-id> when multiple devices are ready',
        'Play QA device preflight',
        'after the device is ready',
        'Google Play monthly base plan snapshot',
        'Google Play annual base plan snapshot',
        'Google Play internal track snapshot',
        'Google Play track state updater exists',
        'RevenueCat subscriber expiry snapshot',
        'RevenueCat subscriber expiry state updater exists',
        'Play monthly base plan snapshot',
        'Play annual base plan snapshot',
        'Google OAuth Android client snapshot parses',
        'Google OAuth Android client state updater exists',
        'STALE',
        'refresh with npm run subscription:qa:play-state',
      ])
    );
  });

  it('includes the Play store state updater in local verification', () => {
    expect(commands.map((command) => command.label)).toEqual(
      expect.arrayContaining([
        'syntax: subscription QA scripts',
        'unit: subscription QA scripts',
      ])
    );
    expect(syntaxFiles).toEqual(
      expect.arrayContaining([
        'scripts/update-revenuecat-play-store-state.js',
        'scripts/update-revenuecat-subscriber-expiry-state.js',
        'scripts/update-google-play-subscription-state.js',
        'scripts/update-google-play-track-state.js',
        'scripts/update-google-cloud-project-state.js',
        'scripts/update-google-oauth-android-client-state.js',
        'scripts/android-tooling.js',
        'scripts/check-android-release-gates.js',
        'scripts/check-play-install-source.js',
        'scripts/check-play-qa-device.js',
        'scripts/wait-for-play-qa-device.js',
      ])
    );
    const unitCommand = commands.find((command) => command.label === 'unit: subscription QA scripts');
    expect(unitCommand.args).toEqual(expect.arrayContaining(unitTestFiles));
    expect(unitCommand.args).toEqual(
      expect.arrayContaining(['--runTestsByPath', '--selectProjects', 'node'])
    );
  });

  it('parses every CommonJS source in one process and reports syntax errors', () => {
    const valid = checkNodeSyntaxFiles(['valid.js'], {
      cwd: '/tmp',
      readFile: () => '#!/usr/bin/env node\n\'use strict\';\nconst value = 1;\n',
    });
    const invalid = checkNodeSyntaxFiles(['invalid.js'], {
      cwd: '/tmp',
      readFile: () => 'const value = ;',
    });

    expect(valid).toEqual({ status: 0, stdout: '', stderr: '' });
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain('Unexpected token');
  });

  it('runs report commands through the exported generator with the same args and env', () => {
    const generateReport = jest.fn(() => ({ exitCode: 1, stdout: 'strict report', stderr: '' }));
    const result = runReportCommand(
      {
        args: ['scripts/subscription-qa-report.js', '--require-full'],
      },
      {
        cwd: '/repo',
        env: { QA: 'isolated' },
        generateReport,
      }
    );

    expect(generateReport).toHaveBeenCalledWith({
      root: '/repo',
      args: ['--require-full'],
      env: { QA: 'isolated' },
    });
    expect(result).toEqual({ status: 1, stdout: 'strict report', stderr: '' });
  });

  it('returns a non-zero exit when a command expected to fail exits successfully', () => {
    expect(exitCodeForUnexpectedStatus({ status: 0 })).toBe(1);
    expect(
      getResultError({ label: 'expected failure', expectedStatus: 1 }, { status: 0, stdout: '', stderr: '' })
    ).toMatchObject({
      exitCode: 1,
      messages: ['Subscription QA local verification failed at: expected failure', 'Expected exit 1, got 0.'],
    });
  });

  it('requires expected output for commands with expectedStdoutIncludes', () => {
    expect(
      getResultError(
        { label: 'release gate', expectedStatus: 1, expectedStdoutIncludes: ['Manual or external gates remaining: 7'] },
        { status: 1, stdout: 'Full RevenueCat workflow is not complete', stderr: '' }
      )
    ).toMatchObject({
      exitCode: 1,
      messages: [
        'Subscription QA local verification failed at: release gate',
        'Missing expected output: Manual or external gates remaining: 7',
      ],
    });
  });

  it('rejects forbidden output even when the exit status matches', () => {
    expect(
      getResultError(
        { label: 'release gate', expectedStatus: 1, forbiddenStdoutIncludes: ['Blocked checks:'] },
        { status: 1, stdout: 'Blocked checks: 1', stderr: '' }
      )
    ).toMatchObject({
      exitCode: 1,
      messages: ['Subscription QA local verification failed at: release gate', 'Unexpected output: Blocked checks:'],
    });
  });

  it('runs injected commands and reports success without spawning real npm', () => {
    const stdout = memoryStream();
    const stderr = memoryStream();
    const status = runCommands(
      [
        {
          label: 'fake command',
          command: 'fake',
          args: ['ok'],
          expectedStdoutIncludes: ['done'],
        },
      ],
      {
        cwd: '/tmp',
        baseEnv: {},
        spawn: () => ({ status: 0, stdout: 'done', stderr: '' }),
        stdout,
        stderr,
      }
    );

    expect(status).toBe(0);
    expect(stdout.value()).toContain('Subscription QA local verification passed.');
    expect(stderr.value()).toBe('');
  });

  it('runs batched syntax and report checks without spawning subprocesses', () => {
    const stdout = memoryStream();
    const stderr = memoryStream();
    const spawn = jest.fn(() => {
      throw new Error('unexpected subprocess');
    });
    const syntaxCheck = jest.fn(() => ({ status: 0, stdout: '', stderr: '' }));
    const generateReport = jest.fn(() => ({ exitCode: 0, stdout: 'report ok', stderr: '' }));
    const status = runCommands(
      [
        { type: 'syntax-batch', label: 'syntax', files: ['one.js'] },
        {
          type: 'report',
          label: 'report',
          command: process.execPath,
          args: ['scripts/subscription-qa-report.js'],
          expectedStdoutIncludes: ['report ok'],
        },
      ],
      { cwd: '/repo', baseEnv: {}, spawn, syntaxCheck, generateReport, stdout, stderr }
    );

    expect(status).toBe(0);
    expect(syntaxCheck).toHaveBeenCalledWith(['one.js'], { cwd: '/repo' });
    expect(generateReport).toHaveBeenCalledTimes(1);
    expect(spawn).not.toHaveBeenCalled();
    expect(stderr.value()).toBe('');
  });
});
