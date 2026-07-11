'use strict';
/* global __dirname, describe, expect, it, jest */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  DEVICE_FINGERPRINT_SCHEME,
  assertInPlaceUpgrade,
  assertPhysicalDevice,
  assertQaDevice,
  assertReadOnlyAdbArgs,
  buildDeviceFingerprint,
  buildSentinel,
  captureSnapshot,
  parseArgs,
  parseAndroidId,
  parsePackageSnapshot,
  parseSigningCertificate,
  prepareUpgrade,
  readState,
  runMaestroFlow,
  verifyUpgrade,
} = require('./run-android-play-upgrade');

const ROOT = path.resolve(__dirname, '..');

function snapshot({
  versionCode = '33',
  versionName = '2.0.2',
  signature = 'play-signing-cert',
  firstInstallTime = '2026-06-09 16:00:00',
  lastUpdateTime = '2026-07-01 10:00:00',
  deviceKind = 'physical',
  deviceFingerprint = `sha256:${'a'.repeat(64)}`,
} = {}) {
  return {
    packageName: 'com.tanuki75.noctalia',
    versionCode,
    versionName,
    installerPackageName: 'com.android.vending',
    signature,
    deviceKind,
    deviceFingerprintScheme: DEVICE_FINGERPRINT_SCHEME,
    deviceFingerprint,
    firstInstallTime,
    lastUpdateTime,
    capturedAt: '2026-07-10T10:00:00.000Z',
  };
}

function createTempStatePath() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-upgrade-test-'));
  return {
    directory,
    statePath: path.join(directory, 'state.json'),
  };
}

describe('Android Play upgrade 33->34 harness', () => {
  it('parses the complete package identity and install history', () => {
    expect(parsePackageSnapshot(`
      Package [com.tanuki75.noctalia] (abc):
        versionCode=33 minSdk=33 targetSdk=36
        versionName=2.0.2
        installerPackageName=com.android.vending
        lastUpdateTime=2026-07-01 10:00:00
        signatures=PackageSignatures{abc version:2, signatures:[51ed3f60], past signatures:[]}
        firstInstallTime=2026-06-09 16:00:00
    `)).toEqual({
      packageName: 'com.tanuki75.noctalia',
      versionCode: '33',
      versionName: '2.0.2',
      installerPackageName: 'com.android.vending',
      signature: '51ed3f60',
      firstInstallTime: '2026-06-09 16:00:00',
      lastUpdateTime: '2026-07-01 10:00:00',
    });
    expect(parseSigningCertificate(`
      com.tanuki75.noctalia:
        Signatures: [BC:CF:C2:96:38:47:81:D6]
    `)).toBe('BC:CF:C2:96:38:47:81:D6');
  });

  it('accepts only the read-only adb commands used by the harness', () => {
    expect(() => assertReadOnlyAdbArgs(['devices', '-l'])).not.toThrow();
    expect(() => assertReadOnlyAdbArgs([
      '-s',
      'phone-1',
      'shell',
      'dumpsys',
      'package',
      'com.tanuki75.noctalia',
    ])).not.toThrow();
    expect(() => assertReadOnlyAdbArgs([
      '-s',
      'phone-1',
      'shell',
      'pm',
      'get-app-links',
      'com.tanuki75.noctalia',
    ])).not.toThrow();
    expect(() => assertReadOnlyAdbArgs([
      '-s',
      'phone-1',
      'shell',
      'settings',
      'get',
      'secure',
      'android_id',
    ])).not.toThrow();
    expect(() => assertReadOnlyAdbArgs([
      '-s',
      'phone-1',
      'install',
      '-r',
      'noctalia.apk',
    ])).toThrow('Refusing non-read-only adb command');
    expect(() => assertReadOnlyAdbArgs([
      '-s',
      'phone-1',
      'shell',
      'pm',
      'clear',
      'com.tanuki75.noctalia',
    ])).toThrow('Refusing non-read-only adb command');
    expect(() => assertReadOnlyAdbArgs([
      '-s',
      'phone-1',
      'shell',
      'settings',
      'put',
      'secure',
      'android_id',
    ])).toThrow('Refusing non-read-only adb command');
  });

  it('hashes a strict Android ID without retaining its raw value', () => {
    const rawAndroidId = '0123456789ABCDEF';
    expect(parseAndroidId(`${rawAndroidId}\n`)).toBe('0123456789abcdef');
    const fingerprint = buildDeviceFingerprint(rawAndroidId);
    expect(fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(fingerprint).not.toContain(rawAndroidId.toLowerCase());
    expect(buildDeviceFingerprint(rawAndroidId)).toBe(fingerprint);

    for (const invalid of ['', 'null', 'not-a-device-id', '0123456789abcde']) {
      expect(() => parseAndroidId(invalid)).toThrow('stable Android device fingerprint');
    }
  });

  it('refuses emulator devices before inspecting app state', () => {
    const spawn = jest.fn(() => ({
      status: 0,
      stdout: 'List of devices attached\nemulator-5554\tdevice product:sdk_gphone64_arm64 model:sdk_gphone64_arm64\n',
      stderr: '',
    }));

    expect(() => assertPhysicalDevice('emulator-5554', 'adb', spawn))
      .toThrow('Play upgrade evidence requires a physical device');
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(assertQaDevice('emulator-5554', 'adb', spawn, {
      allowEmulatorRehearsal: true,
    })).toMatchObject({
      id: 'emulator-5554',
      deviceKind: 'emulator',
    });
  });

  it('adds the selected device kind before validating a captured package snapshot', () => {
    const spawn = jest.fn((_command, args) => {
      const key = args.join(' ');
      if (key === 'devices -l') {
        return {
          status: 0,
          stdout: 'List of devices attached\nphone-1\tdevice product:scout model:motorola_edge device:scout\n',
          stderr: '',
        };
      }
      if (key.includes('dumpsys package')) {
        return {
          status: 0,
          stdout: `Package [com.tanuki75.noctalia] (abc):
            versionCode=33 minSdk=33 targetSdk=36
            versionName=2.0.1
            installerPackageName=com.android.vending
            firstInstallTime=2026-07-10 17:00:00
            lastUpdateTime=2026-07-10 17:00:00
            signatures=PackageSignatures{abc version:2, signatures:[play-cert]}`,
          stderr: '',
        };
      }
      if (key.includes('settings get secure android_id')) {
        return {
          status: 0,
          stdout: '0123456789abcdef\n',
          stderr: '',
        };
      }
      return {
        status: 0,
        stdout: 'Signatures: [PLAY:SHA256]',
        stderr: '',
      };
    });

    expect(captureSnapshot('phone-1', '33', {
      adbCommand: 'adb',
      spawn,
      now: () => '2026-07-10T17:00:00.000Z',
    })).toMatchObject({
      deviceKind: 'physical',
      versionCode: '33',
      signature: 'PLAY:SHA256',
      deviceFingerprintScheme: DEVICE_FINGERPRINT_SCHEME,
      deviceFingerprint: buildDeviceFingerprint('0123456789abcdef'),
    });
  });

  it('requires an unchanged first install, signer and a newer update timestamp', () => {
    const before = snapshot();
    const after = snapshot({
      versionCode: '34',
      versionName: '2.0.3',
      lastUpdateTime: '2026-07-10 11:00:00',
    });

    expect(assertInPlaceUpgrade(before, after)).toBe(true);
    expect(() => assertInPlaceUpgrade(before, {
      ...after,
      firstInstallTime: '2026-07-10 10:59:00',
    })).toThrow('Refusing reinstallation evidence');
    expect(() => assertInPlaceUpgrade(before, {
      ...after,
      signature: 'different-cert',
    })).toThrow('Signing certificate changed');
    expect(() => assertInPlaceUpgrade(before, {
      ...after,
      lastUpdateTime: before.lastUpdateTime,
    })).toThrow('No in-place update detected');
    expect(() => assertInPlaceUpgrade(before, {
      ...after,
      deviceFingerprint: `sha256:${'b'.repeat(64)}`,
    })).toThrow('does not belong to the device used during preparation');
    expect(() => assertInPlaceUpgrade(before, {
      ...after,
      deviceFingerprint: 'raw-device-id',
    })).toThrow('Invalid stable Android device fingerprint evidence');
  });

  it('prepares v33, runs the seed flow and persists the baseline only after it stays stable', () => {
    const { directory, statePath } = createTempStatePath();
    const rawAndroidId = '0123456789abcdef';
    const before = snapshot({
      deviceFingerprint: buildDeviceFingerprint(rawAndroidId),
    });
    const capture = jest.fn(() => ({ ...before }));
    const runFlow = jest.fn();
    const now = jest.fn(() => new Date('2026-07-10T10:00:00.000Z'));

    try {
      const state = prepareUpgrade({
        deviceId: 'physical-1',
        phase: 'prepare',
        statePath,
        sentinel: 'UPGRADE_TEST_SENTINEL',
        replace: false,
      }, { capture, runFlow, now });

      expect(capture).toHaveBeenNthCalledWith(1, 'physical-1', '33', {
        allowEmulatorRehearsal: false,
      });
      expect(capture).toHaveBeenNthCalledWith(2, 'physical-1', '33', {
        allowEmulatorRehearsal: false,
      });
      expect(runFlow).toHaveBeenCalledWith('prepare', 'physical-1', 'UPGRADE_TEST_SENTINEL');
      expect(state.before).toEqual(before);
      const persisted = fs.readFileSync(statePath, 'utf8');
      expect(persisted).not.toContain(rawAndroidId);
      expect(JSON.parse(persisted)).toMatchObject({
        schemaVersion: 2,
        transition: '33->34',
        deviceId: 'physical-1',
        deviceKind: 'physical',
        qualification: true,
        sentinel: 'UPGRADE_TEST_SENTINEL',
        before,
      });
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('resumes only from an explicit existing sentinel without creating another dream', () => {
    const { directory, statePath } = createTempStatePath();
    const before = snapshot();
    const capture = jest.fn(() => ({ ...before }));
    const runFlow = jest.fn();

    try {
      prepareUpgrade({
        deviceId: 'physical-1',
        phase: 'prepare',
        statePath,
        sentinel: 'EXISTING_SENTINEL',
        resume: true,
        replace: false,
      }, { capture, runFlow, now: () => new Date('2026-07-10T10:00:00.000Z') });

      expect(runFlow).toHaveBeenCalledWith('resume', 'physical-1', 'EXISTING_SENTINEL');
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('runs the real v33 prepare flow directly through Maestro without the app.json v34 preflight', () => {
    const spawn = jest.fn(() => ({ status: 0, stdout: '', stderr: '' }));
    const fsImpl = {
      existsSync: jest.fn(() => false),
      mkdirSync: jest.fn(),
    };

    runMaestroFlow(
      'prepare',
      'emulator-5554',
      'UPGRADE_DIRECT_MAESTRO',
      spawn,
      {
        env: { MAESTRO_RUNNER_HOME: '/tmp/noctalia-maestro-test' },
        fsImpl,
        invocation: { command: '/direct/maestro', baseArgs: [] },
      }
    );

    expect(spawn).toHaveBeenCalledTimes(1);
    const [command, args] = spawn.mock.calls[0];
    expect(command).toBe('/direct/maestro');
    expect(args).toEqual(expect.arrayContaining([
      'test',
      '-e',
      'UPGRADE_SENTINEL=UPGRADE_DIRECT_MAESTRO',
      'maestro/android-play-upgrade-seed-v33.yml',
      '--device',
      'emulator-5554',
    ]));
    expect(args.join(' ')).not.toContain('run-maestro-android.js');
    expect(args.join(' ')).not.toContain('app.json');
    expect(args.join(' ')).not.toContain('versionCode 34');
  });

  it('verifies v34 across a changed Wi-Fi transport and records the stable device evidence', () => {
    const { directory, statePath } = createTempStatePath();
    const before = snapshot();
    const after = snapshot({
      versionCode: '34',
      versionName: '2.0.3',
      lastUpdateTime: '2026-07-10 11:00:00',
    });
    fs.writeFileSync(statePath, JSON.stringify({
      schemaVersion: 2,
      transition: '33->34',
      deviceId: 'physical-1',
      deviceKind: 'physical',
      qualification: true,
      sentinel: 'UPGRADE_TEST_SENTINEL',
      preparedAt: '2026-07-10T10:00:00.000Z',
      before,
    }));
    const capture = jest.fn(() => ({ ...after }));
    const runFlow = jest.fn();
    const now = jest.fn(() => new Date('2026-07-10T11:05:00.000Z'));

    try {
      const state = verifyUpgrade({
        deviceId: 'wifi-transport-2',
        phase: 'verify',
        statePath,
      }, { capture, runFlow, now });

      expect(capture).toHaveBeenNthCalledWith(1, 'wifi-transport-2', '34', {
        allowEmulatorRehearsal: false,
      });
      expect(capture).toHaveBeenNthCalledWith(2, 'wifi-transport-2', '34', {
        allowEmulatorRehearsal: false,
      });
      expect(runFlow).toHaveBeenCalledWith(
        'verify',
        'wifi-transport-2',
        'UPGRADE_TEST_SENTINEL'
      );
      expect(state.after).toEqual(after);
      expect(JSON.parse(fs.readFileSync(statePath, 'utf8'))).toMatchObject({
        deviceId: 'physical-1',
        verifiedDeviceId: 'wifi-transport-2',
        verifiedAt: '2026-07-10T11:05:00.000Z',
        after,
      });
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('refuses a different physical device before running the v34 flow', () => {
    const { directory, statePath } = createTempStatePath();
    const before = snapshot();
    const differentDevice = snapshot({
      versionCode: '34',
      versionName: '2.0.3',
      lastUpdateTime: '2026-07-10 11:00:00',
      deviceFingerprint: `sha256:${'b'.repeat(64)}`,
    });
    fs.writeFileSync(statePath, JSON.stringify({
      schemaVersion: 2,
      transition: '33->34',
      deviceId: 'wifi-transport-1',
      deviceKind: 'physical',
      qualification: true,
      sentinel: 'UPGRADE_TEST_SENTINEL',
      preparedAt: '2026-07-10T10:00:00.000Z',
      before,
    }));
    const capture = jest.fn(() => ({ ...differentDevice }));
    const runFlow = jest.fn();

    try {
      expect(() => verifyUpgrade({
        deviceId: 'wifi-transport-2',
        phase: 'verify',
        statePath,
      }, { capture, runFlow })).toThrow(
        'does not belong to the device used during preparation'
      );
      expect(runFlow).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects a legacy state that cannot survive a Wi-Fi transport change', () => {
    const { directory, statePath } = createTempStatePath();
    fs.writeFileSync(statePath, JSON.stringify({
      schemaVersion: 1,
      transition: '33->34',
      deviceId: 'wifi-transport-1',
      deviceKind: 'physical',
      qualification: true,
      sentinel: 'EXISTING_SENTINEL',
      before: snapshot(),
    }));

    try {
      expect(() => readState(statePath)).toThrow(
        'rerun prepare with --resume --sentinel <existing-token> --replace'
      );
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('marks emulator preparation and verification as non-qualifying rehearsals', () => {
    const { directory, statePath } = createTempStatePath();
    const before = snapshot({ deviceKind: 'emulator' });
    const after = snapshot({
      versionCode: '34',
      versionName: '2.0.3',
      lastUpdateTime: '2026-07-10 11:00:00',
      deviceKind: 'emulator',
    });
    const prepareCapture = jest.fn(() => ({ ...before }));
    const verifyCapture = jest.fn(() => ({ ...after }));
    const runFlow = jest.fn();
    const now = jest.fn(() => new Date('2026-07-10T10:00:00.000Z'));

    try {
      const prepared = prepareUpgrade({
        deviceId: 'emulator-5556',
        phase: 'prepare',
        statePath,
        sentinel: 'UPGRADE_EMULATOR_REHEARSAL',
        replace: false,
        allowEmulatorRehearsal: true,
      }, { capture: prepareCapture, runFlow, now });

      expect(prepared).toMatchObject({
        deviceKind: 'emulator',
        qualification: false,
      });
      expect(() => verifyUpgrade({
        deviceId: 'emulator-5556',
        phase: 'verify',
        statePath,
        allowEmulatorRehearsal: false,
      }, { capture: verifyCapture, runFlow, now })).toThrow(
        'verify requires --allow-emulator-rehearsal'
      );

      const verified = verifyUpgrade({
        deviceId: 'emulator-5556',
        phase: 'verify',
        statePath,
        allowEmulatorRehearsal: true,
      }, { capture: verifyCapture, runFlow, now });

      expect(verified).toMatchObject({
        deviceKind: 'emulator',
        qualification: false,
        after: { deviceKind: 'emulator', versionCode: '34' },
      });
      expect(verifyCapture).toHaveBeenCalledWith('emulator-5556', '34', {
        allowEmulatorRehearsal: true,
      });
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('keeps both upgrade flows free of clear-state commands', () => {
    for (const flow of [
      'maestro/android-play-upgrade-seed-v33.yml',
      'maestro/android-play-upgrade-resume-v33.yml',
      'maestro/android-play-upgrade-verify-v34.yml',
      'maestro/subflows/ensure-settings-journal-layout-visible.yml',
    ]) {
      const content = fs.readFileSync(path.join(ROOT, flow), 'utf8');
      expect(content).not.toMatch(/clearState|clearKeychain|pm clear/);
      expect(content).not.toMatch(/openLink:/);
    }
    const seed = fs.readFileSync(
      path.join(ROOT, 'maestro/android-play-upgrade-seed-v33.yml'),
      'utf8'
    );
    expect(seed).toContain('id: component.recording.onboardingTour');
    expect(seed).toContain('id: btn.recording.onboarding.skip');
    expect(seed.indexOf('btn.recording.onboarding.skip'))
      .toBeLessThan(seed.indexOf('subflows/ensure-recording-text.yml'));
  });

  it('parses safe explicit commands and creates a Maestro-safe default sentinel', () => {
    expect(parseArgs(['prepare', '--device', 'physical-1', '--sentinel', 'SAFE_123']))
      .toMatchObject({ phase: 'prepare', deviceId: 'physical-1', sentinel: 'SAFE_123' });
    expect(parseArgs(['verify', '--device', 'physical-1']))
      .toMatchObject({ phase: 'verify', deviceId: 'physical-1' });
    expect(parseArgs([
      'prepare',
      '--device',
      'emulator-5556',
      '--allow-emulator-rehearsal',
    ])).toMatchObject({
      phase: 'prepare',
      deviceId: 'emulator-5556',
      allowEmulatorRehearsal: true,
    });
    expect(parseArgs([
      'prepare',
      '--device',
      'physical-1',
      '--resume',
      '--sentinel',
      'EXISTING_SENTINEL',
    ])).toMatchObject({ resume: true, sentinel: 'EXISTING_SENTINEL' });
    expect(() => parseArgs(['prepare', '--device', 'physical-1', '--resume']))
      .toThrow('--resume requires --sentinel');
    expect(() => parseArgs(['prepare', '--device', 'emulator-5554', '--sentinel', 'bad value']))
      .toThrow('only letters, numbers');
    expect(buildSentinel(new Date('2026-07-10T10:20:30.456Z')))
      .toBe('UPGRADE_V33_V34_20260710102030456');
  });
});
