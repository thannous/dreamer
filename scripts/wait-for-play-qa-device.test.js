const path = require('path');
const { spawnSync } = require('child_process');

const { parseArgs, waitForPlayQaDevice } = require('./wait-for-play-qa-device');

const SCRIPT = path.join(__dirname, 'wait-for-play-qa-device.js');

function stream() {
  let value = '';
  return {
    write(chunk) {
      value += chunk;
    },
    get value() {
      return value;
    },
  };
}

describe('Play RevenueCat QA device wait helper', () => {
  it('documents the wait helper usage', () => {
    const result = spawnSync(process.execPath, [SCRIPT, '--help'], {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('wait-for-play-qa-device');
    expect(result.stdout).toContain('play_* evidence commands');
    expect(result.stdout).toContain('--expected-version-code');
    expect(result.stdout).toContain('--require-ui-ready');
  });

  it('parses device, package, expected version, interval, timeout, and UI readiness options', () => {
    expect(
      parseArgs([
        '--device',
        '57275d36',
        '--package',
        'com.example.app',
        '--expected-version-code',
        '24',
        '--interval-ms',
        '1000',
        '--timeout-ms',
        '9000',
        '--require-ui-ready',
      ])
    ).toEqual({
      device: '57275d36',
      packageName: 'com.example.app',
      expectedVersionCode: '24',
      intervalMs: 1000,
      timeoutMs: 9000,
      requireUiReady: true,
    });
  });

  it('passes expected version code through to the Play QA preflight', async () => {
    const stdout = stream();
    const stderr = stream();
    let nowValue = 0;
    const check = jest.fn(() => ({
      ok: true,
      packageName: 'com.tanuki75.noctalia',
      selectedDevice: '57275d36',
      expectedVersionCode: '24',
      versionCodeMatches: true,
      physical: { ok: true, adb: { message: 'ready' } },
      playInstallSource: {
        ok: true,
        adbCommand: 'adb',
        packageName: 'com.tanuki75.noctalia',
        installerPackageName: 'com.android.vending',
        versionCode: '24',
        message: 'Play-installed',
      },
      evidenceArgs: '--device-id 57275d36 --installer-package-name com.android.vending --version-code 24',
      evidenceCommands: ['npm run subscription:qa:evidence -- --gate play_monthly --version-code 24'],
      message: '57275d36 is ready for Play RevenueCat QA.',
    }));

    const result = await waitForPlayQaDevice({
      device: '57275d36',
      expectedVersionCode: '24',
      intervalMs: 10,
      timeoutMs: 100,
      stdout,
      stderr,
      now: () => nowValue,
      sleepFn: async (ms) => {
        nowValue += ms;
      },
      check,
    });

    expect(result.ok).toBe(true);
    expect(check).toHaveBeenCalledWith({ device: '57275d36', expectedVersionCode: '24' });
    expect(stdout.value).toContain('expectedVersionCode: 24 - PASS');
  });

  it('keeps polling until the Play QA preflight is ready', async () => {
    const stdout = stream();
    const stderr = stream();
    const reports = [
      { ok: false, packageName: 'com.tanuki75.noctalia', selectedDevice: null, physical: { ok: false, adb: { message: 'missing' } }, message: 'missing' },
      { ok: false, packageName: 'com.tanuki75.noctalia', selectedDevice: '57275d36', physical: { ok: true, adb: { message: 'ready' } }, playInstallSource: { ok: false, adbCommand: 'adb', packageName: 'com.tanuki75.noctalia', installerPackageName: null, message: 'not installed' }, message: 'not installed' },
      { ok: true, packageName: 'com.tanuki75.noctalia', selectedDevice: '57275d36', physical: { ok: true, adb: { message: 'ready' } }, playInstallSource: { ok: true, adbCommand: 'adb', packageName: 'com.tanuki75.noctalia', installerPackageName: 'com.android.vending', versionCode: '24', message: 'Play-installed' }, evidenceArgs: '--device-id 57275d36 --installer-package-name com.android.vending --version-code 24', evidenceCommands: ['npm run subscription:qa:evidence -- --gate play_monthly --version-code 24'] },
    ];
    let index = 0;
    let nowValue = 0;

    const result = await waitForPlayQaDevice({
      intervalMs: 10,
      timeoutMs: 100,
      stdout,
      stderr,
      now: () => nowValue,
      sleepFn: async (ms) => {
        nowValue += ms;
      },
      check: () => reports[index++],
    });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(3);
    expect(stdout.value).toContain('[play-qa-device:wait] attempt 3');
    expect(stdout.value).toContain('evidenceCommands');
    expect(stderr.value).toBe('');
  });

  it('keeps polling with --require-ui-ready until the Play-ready phone is unlocked', async () => {
    const stdout = stream();
    const stderr = stream();
    const reports = [
      {
        ok: true,
        packageName: 'com.tanuki75.noctalia',
        selectedDevice: '57275d36',
        physical: { ok: true, adb: { message: 'ready' } },
        uiState: { ok: false, message: 'Device screen appears off or asleep.' },
        playInstallSource: {
          ok: true,
          adbCommand: 'adb',
          packageName: 'com.tanuki75.noctalia',
          installerPackageName: 'com.android.vending',
          versionCode: '24',
          message: 'Play-installed',
        },
        evidenceArgs: '--device-id 57275d36 --installer-package-name com.android.vending --version-code 24',
        evidenceCommands: ['npm run subscription:qa:evidence -- --gate play_monthly --version-code 24'],
        message: '57275d36 is ready for Play RevenueCat QA.',
      },
      {
        ok: true,
        packageName: 'com.tanuki75.noctalia',
        selectedDevice: '57275d36',
        physical: { ok: true, adb: { message: 'ready' } },
        uiState: { ok: true, message: 'Device screen appears awake and unlocked.' },
        playInstallSource: {
          ok: true,
          adbCommand: 'adb',
          packageName: 'com.tanuki75.noctalia',
          installerPackageName: 'com.android.vending',
          versionCode: '24',
          message: 'Play-installed',
        },
        evidenceArgs: '--device-id 57275d36 --installer-package-name com.android.vending --version-code 24',
        evidenceCommands: ['npm run subscription:qa:evidence -- --gate play_monthly --version-code 24'],
        message: '57275d36 is ready for Play RevenueCat QA.',
      },
    ];
    let index = 0;
    let nowValue = 0;

    const result = await waitForPlayQaDevice({
      intervalMs: 10,
      timeoutMs: 100,
      requireUiReady: true,
      stdout,
      stderr,
      now: () => nowValue,
      sleepFn: async (ms) => {
        nowValue += ms;
      },
      check: () => reports[index++],
    });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
    expect(stdout.value).toContain('waiting for unlocked awake phone');
    expect(stdout.value).toContain('[play-qa-device:wait] ready');
    expect(stderr.value).toBe('');
  });

  it('times out when the device never becomes ready', async () => {
    const stdout = stream();
    const stderr = stream();
    let nowValue = 0;

    const result = await waitForPlayQaDevice({
      intervalMs: 10,
      timeoutMs: 15,
      stdout,
      stderr,
      now: () => nowValue,
      sleepFn: async (ms) => {
        nowValue += ms;
      },
      check: () => ({
        ok: false,
        packageName: 'com.tanuki75.noctalia',
        selectedDevice: null,
        physical: { ok: false, adb: { message: 'missing' } },
        message: 'missing',
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(2);
    expect(stderr.value).toContain('timed out');
  });

  it('includes expected version and UI readiness criteria in timeout output', async () => {
    const stdout = stream();
    const stderr = stream();
    let nowValue = 0;

    const result = await waitForPlayQaDevice({
      intervalMs: 10,
      timeoutMs: 15,
      expectedVersionCode: '24',
      requireUiReady: true,
      stdout,
      stderr,
      now: () => nowValue,
      sleepFn: async (ms) => {
        nowValue += ms;
      },
      check: () => ({
        ok: false,
        packageName: 'com.tanuki75.noctalia',
        selectedDevice: '57275d36',
        expectedVersionCode: '24',
        physical: { ok: true, adb: { message: 'ready' } },
        uiState: { ok: true, message: 'Device screen appears awake and unlocked.' },
        playInstallSource: {
          ok: true,
          adbCommand: 'adb',
          packageName: 'com.tanuki75.noctalia',
          installerPackageName: 'com.android.vending',
          versionCode: '12',
          message: 'Play-installed',
        },
        versionCodeMatches: false,
        versionCodeMessage: 'Installed versionCode 12 does not match expected 24.',
        message: 'Installed versionCode 12 does not match expected 24.',
      }),
    });

    expect(result.ok).toBe(false);
    expect(stderr.value).toContain('Play-installed physical device (matching versionCode 24, UI ready)');
  });
});
