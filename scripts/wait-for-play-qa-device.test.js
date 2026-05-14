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
  });

  it('parses device, package, interval, and timeout options', () => {
    expect(
      parseArgs([
        '--device',
        '57275d36',
        '--package',
        'com.example.app',
        '--interval-ms',
        '1000',
        '--timeout-ms',
        '9000',
      ])
    ).toEqual({
      device: '57275d36',
      packageName: 'com.example.app',
      intervalMs: 1000,
      timeoutMs: 9000,
    });
  });

  it('keeps polling until the Play QA preflight is ready', async () => {
    const stdout = stream();
    const stderr = stream();
    const reports = [
      { ok: false, packageName: 'com.tanuki75.noctalia', selectedDevice: null, physical: { ok: false, adb: { message: 'missing' } }, message: 'missing' },
      { ok: false, packageName: 'com.tanuki75.noctalia', selectedDevice: '57275d36', physical: { ok: true, adb: { message: 'ready' } }, playInstallSource: { ok: false, adbCommand: 'adb', packageName: 'com.tanuki75.noctalia', installerPackageName: null, message: 'not installed' }, message: 'not installed' },
      { ok: true, packageName: 'com.tanuki75.noctalia', selectedDevice: '57275d36', physical: { ok: true, adb: { message: 'ready' } }, playInstallSource: { ok: true, adbCommand: 'adb', packageName: 'com.tanuki75.noctalia', installerPackageName: 'com.android.vending', message: 'Play-installed' }, evidenceArgs: '--device-id 57275d36 --installer-package-name com.android.vending', evidenceCommands: ['npm run subscription:qa:evidence -- --gate play_monthly'] },
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
});
