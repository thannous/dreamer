#!/usr/bin/env node
'use strict';
/* global __dirname */

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const { resolveCommand } = require('./android-tooling');
const { isLikelyEmulator, parseAdbDevices } = require('./check-android-adb-device');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_MAESTRO_BIN_WINDOWS = 'C:\\Users\\thann\\maestro\\maestro\\bin\\maestro.bat';
const PACKAGE_NAME = 'com.tanuki75.noctalia';
const PLAY_INSTALLER = 'com.android.vending';
const FROM_VERSION_CODE = '33';
const TO_VERSION_CODE = '34';
const DEVICE_FINGERPRINT_SCHEME = 'adb-shell-secure-android-id-sha256-v1';
const DEFAULT_STATE_PATH = path.join(
  ROOT,
  'doc_web_interne/docs/android-play-upgrade-33-to-34.local.json'
);
const FLOW_BY_PHASE = {
  prepare: 'maestro/android-play-upgrade-seed-v33.yml',
  resume: 'maestro/android-play-upgrade-resume-v33.yml',
  verify: 'maestro/android-play-upgrade-verify-v34.yml',
};

function printHelp() {
  process.stdout.write(`
Usage:
  npm run android:play-upgrade:prepare -- --device <physical-adb-id> [--state <path>] [--sentinel <token>] [--replace]
  npm run android:play-upgrade:prepare -- --device <physical-adb-id> --resume --sentinel <existing-token>
  npm run android:play-upgrade:prepare -- --device <play-emulator-id> --allow-emulator-rehearsal [--state <path>]
  npm run android:play-upgrade:verify -- --device <adb-id> [--state <path>] [--allow-emulator-rehearsal]

The prepare phase requires a Play-installed versionCode 33 and seeds data without
clearing app state. After the tester updates Noctalia from Google Play, verify
requires versionCode 34 on the same device and proves an in-place update by
comparing the installer, signing certificate, firstInstallTime and lastUpdateTime.

This harness never installs, uninstalls, replaces or clears the application.
Emulator rehearsal is fail-closed unless --allow-emulator-rehearsal is explicit,
and its evidence is always marked qualification=false.
`.trimStart());
}

function parseArgs(argv) {
  const phase = argv[0];
  if (phase === '--help' || phase === '-h') {
    return { help: true };
  }
  if (phase !== 'prepare' && phase !== 'verify') {
    throw new Error('First argument must be prepare or verify.');
  }

  const options = {
    phase,
    statePath: DEFAULT_STATE_PATH,
    replace: false,
    resume: false,
    allowEmulatorRehearsal: false,
  };

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--device') {
      options.deviceId = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--state') {
      options.statePath = path.resolve(ROOT, argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (arg === '--sentinel') {
      options.sentinel = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--replace') {
      options.replace = true;
      continue;
    }
    if (arg === '--resume') {
      options.resume = true;
      continue;
    }
    if (arg === '--allow-emulator-rehearsal') {
      options.allowEmulatorRehearsal = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      return { help: true };
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.deviceId?.trim()) {
    throw new Error('--device <physical-adb-id> is required.');
  }
  options.deviceId = options.deviceId.trim();

  if (phase === 'verify' && options.sentinel) {
    throw new Error('--sentinel is only accepted during prepare.');
  }
  if (phase === 'verify' && options.replace) {
    throw new Error('--replace is only accepted during prepare.');
  }
  if (phase === 'verify' && options.resume) {
    throw new Error('--resume is only accepted during prepare.');
  }
  if (options.resume && !options.sentinel) {
    throw new Error('--resume requires --sentinel <existing-token>.');
  }
  if (options.sentinel && !/^[A-Za-z0-9_-]+$/.test(options.sentinel)) {
    throw new Error('--sentinel must contain only letters, numbers, underscores or hyphens.');
  }

  return options;
}

function normalizePackageValue(value) {
  if (!value || value === 'null') return null;
  return value.trim();
}

function parsePackageSnapshot(output, packageName = PACKAGE_NAME) {
  const text = String(output || '');
  if (!text.includes(`Package [${packageName}]`)) {
    throw new Error(`${packageName} is not installed on the selected device.`);
  }

  const signature =
    text.match(/\bsignatures:\[([^\]]+)\]/)?.[1]?.trim() ||
    text.match(/\bsignatures=\[([^\]]+)\]/)?.[1]?.trim() ||
    null;

  return {
    packageName,
    versionCode: text.match(/\bversionCode=(\d+)/)?.[1] || null,
    versionName: normalizePackageValue(text.match(/\bversionName=([^\s]+)/)?.[1]),
    installerPackageName: normalizePackageValue(
      text.match(/\binstallerPackageName=([^\s]+)/)?.[1]
    ),
    signature,
    firstInstallTime: normalizePackageValue(
      text.match(/\bfirstInstallTime=([^\r\n]+)/)?.[1]
    ),
    lastUpdateTime: normalizePackageValue(
      text.match(/\blastUpdateTime=([^\r\n]+)/)?.[1]
    ),
  };
}

function parseSigningCertificate(output) {
  const signature = String(output || '')
    .match(/\bSignatures:\s*\[([^\]]+)\]/)?.[1]
    ?.trim();
  if (!signature) {
    throw new Error('Unable to read the installed signing certificate SHA-256 digest.');
  }
  return signature;
}

function parseAndroidId(output) {
  const value = String(output || '').trim().toLowerCase();
  if (!/^[0-9a-f]{16}$/.test(value)) {
    throw new Error('Unable to obtain a stable Android device fingerprint.');
  }
  return value;
}

function buildDeviceFingerprint(output) {
  const androidId = parseAndroidId(output);
  const digest = createHash('sha256')
    .update(`${DEVICE_FINGERPRINT_SCHEME}\0${androidId}`, 'utf8')
    .digest('hex');
  return `sha256:${digest}`;
}

function assertSnapshotForVersion(snapshot, expectedVersionCode) {
  const missing = [
    'versionCode',
    'versionName',
    'installerPackageName',
    'signature',
    'deviceKind',
    'deviceFingerprintScheme',
    'deviceFingerprint',
    'firstInstallTime',
    'lastUpdateTime',
  ].filter((key) => !snapshot[key]);

  if (missing.length > 0) {
    throw new Error(`Incomplete Android package snapshot: missing ${missing.join(', ')}.`);
  }
  if (
    snapshot.deviceFingerprintScheme !== DEVICE_FINGERPRINT_SCHEME ||
    !/^sha256:[0-9a-f]{64}$/.test(snapshot.deviceFingerprint)
  ) {
    throw new Error('Invalid stable Android device fingerprint evidence.');
  }
  if (snapshot.versionCode !== String(expectedVersionCode)) {
    throw new Error(
      `Installed versionCode ${snapshot.versionCode} does not match required ${expectedVersionCode}.`
    );
  }
  if (snapshot.installerPackageName !== PLAY_INSTALLER) {
    throw new Error(
      `Refusing non-Play build: installerPackageName=${snapshot.installerPackageName || 'missing'}.`
    );
  }
  return snapshot;
}

function assertSameSnapshot(left, right, label) {
  const keys = [
    'packageName',
    'versionCode',
    'versionName',
    'installerPackageName',
    'signature',
    'deviceFingerprintScheme',
    'deviceFingerprint',
    'firstInstallTime',
    'lastUpdateTime',
  ];
  const changed = keys.filter((key) => left[key] !== right[key]);
  if (changed.length > 0) {
    throw new Error(`${label} changed package state during the QA flow: ${changed.join(', ')}.`);
  }
}

function assertInPlaceUpgrade(before, after) {
  assertSnapshotForVersion(before, FROM_VERSION_CODE);
  assertSnapshotForVersion(after, TO_VERSION_CODE);

  if (before.packageName !== after.packageName) {
    throw new Error('Package name changed across the upgrade.');
  }
  if (before.signature !== after.signature) {
    throw new Error('Signing certificate changed across the upgrade.');
  }
  if (
    before.deviceFingerprintScheme !== after.deviceFingerprintScheme ||
    before.deviceFingerprint !== after.deviceFingerprint
  ) {
    throw new Error(
      'Selected ADB transport does not belong to the device used during preparation.'
    );
  }
  if (before.firstInstallTime !== after.firstInstallTime) {
    throw new Error(
      'Refusing reinstallation evidence: firstInstallTime changed instead of remaining stable.'
    );
  }
  if (after.lastUpdateTime <= before.lastUpdateTime) {
    throw new Error(
      'No in-place update detected: lastUpdateTime must be strictly newer than the v33 snapshot.'
    );
  }
  return true;
}

function assertReadOnlyAdbArgs(args) {
  const listDevices = args.length === 2 && args[0] === 'devices' && args[1] === '-l';
  const inspectPackage =
    args.length === 6 &&
    args[0] === '-s' &&
    args[2] === 'shell' &&
    args[3] === 'dumpsys' &&
    args[4] === 'package' &&
    args[5] === PACKAGE_NAME;

  const inspectSigningCertificate =
    args.length === 6 &&
    args[0] === '-s' &&
    args[2] === 'shell' &&
    args[3] === 'pm' &&
    args[4] === 'get-app-links' &&
    args[5] === PACKAGE_NAME;

  const inspectDeviceFingerprint =
    args.length === 7 &&
    args[0] === '-s' &&
    args[2] === 'shell' &&
    args[3] === 'settings' &&
    args[4] === 'get' &&
    args[5] === 'secure' &&
    args[6] === 'android_id';

  if (
    !listDevices &&
    !inspectPackage &&
    !inspectSigningCertificate &&
    !inspectDeviceFingerprint
  ) {
    throw new Error(`Refusing non-read-only adb command: ${args.join(' ')}`);
  }
}

function runReadOnlyAdb(adbCommand, args, spawn = spawnSync) {
  assertReadOnlyAdbArgs(args);
  const result = spawn(adbCommand, args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 15000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `adb exited ${result.status}`).trim());
  }
  return result.stdout || '';
}

function assertQaDevice(
  deviceId,
  adbCommand,
  spawn = spawnSync,
  { allowEmulatorRehearsal = false } = {}
) {
  const devices = parseAdbDevices(runReadOnlyAdb(adbCommand, ['devices', '-l'], spawn));
  const selected = devices.find((device) => device.id === deviceId && device.state === 'device');
  if (!selected) {
    throw new Error(`${deviceId} is not a ready ADB device.`);
  }
  const deviceKind = isLikelyEmulator(selected) ? 'emulator' : 'physical';
  if (deviceKind === 'emulator' && !allowEmulatorRehearsal) {
    throw new Error(`Refusing emulator ${deviceId}; Play upgrade evidence requires a physical device.`);
  }
  return { ...selected, deviceKind };
}

function assertPhysicalDevice(deviceId, adbCommand, spawn = spawnSync) {
  return assertQaDevice(deviceId, adbCommand, spawn);
}

function captureSnapshot(deviceId, expectedVersionCode, {
  adbCommand = resolveCommand('adb') || 'adb',
  spawn = spawnSync,
  now = () => new Date().toISOString(),
  allowEmulatorRehearsal = false,
} = {}) {
  const device = assertQaDevice(deviceId, adbCommand, spawn, {
    allowEmulatorRehearsal,
  });
  const output = runReadOnlyAdb(
    adbCommand,
    ['-s', deviceId, 'shell', 'dumpsys', 'package', PACKAGE_NAME],
    spawn
  );
  const signingOutput = runReadOnlyAdb(
    adbCommand,
    ['-s', deviceId, 'shell', 'pm', 'get-app-links', PACKAGE_NAME],
    spawn
  );
  const androidIdOutput = runReadOnlyAdb(
    adbCommand,
    ['-s', deviceId, 'shell', 'settings', 'get', 'secure', 'android_id'],
    spawn
  );
  const snapshot = assertSnapshotForVersion(
    {
      ...parsePackageSnapshot(output),
      signature: parseSigningCertificate(signingOutput),
      deviceKind: device.deviceKind,
      deviceFingerprintScheme: DEVICE_FINGERPRINT_SCHEME,
      deviceFingerprint: buildDeviceFingerprint(androidIdOutput),
    },
    expectedVersionCode
  );
  return {
    ...snapshot,
    capturedAt: now(),
  };
}

function buildSentinel(now = new Date()) {
  return `UPGRADE_V33_V34_${now.toISOString().replace(/[-:.TZ]/g, '')}`;
}

function resolveMaestroInvocation({
  env = process.env,
  platform = process.platform,
  existsSync = fs.existsSync,
  resolve = resolveCommand,
} = {}) {
  if (env.MAESTRO_BIN) {
    return platform === 'win32'
      ? { command: 'cmd.exe', baseArgs: ['/c', env.MAESTRO_BIN] }
      : { command: env.MAESTRO_BIN, baseArgs: [] };
  }
  if (platform === 'win32' && existsSync(DEFAULT_MAESTRO_BIN_WINDOWS)) {
    return { command: 'cmd.exe', baseArgs: ['/c', DEFAULT_MAESTRO_BIN_WINDOWS] };
  }
  return { command: resolve('maestro', { env }) || 'maestro', baseArgs: [] };
}

function buildMaestroEnvironment(sentinel, env = process.env) {
  const maestroHome = env.MAESTRO_RUNNER_HOME || path.resolve(ROOT, '.maestro-home');
  return {
    ...env,
    HOME: maestroHome,
    JAVA_TOOL_OPTIONS: [
      env.JAVA_TOOL_OPTIONS,
      `-Duser.home=${maestroHome}`,
    ].filter(Boolean).join(' '),
    MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true',
    MAESTRO_CLI_NO_ANALYTICS: '1',
    UPGRADE_SENTINEL: sentinel,
  };
}

function runMaestroFlow(
  phase,
  deviceId,
  sentinel,
  spawn = spawnSync,
  {
    env = process.env,
    fsImpl = fs,
    invocation,
  } = {}
) {
  const flow = FLOW_BY_PHASE[phase];
  if (!flow) {
    throw new Error(`Unknown upgrade Maestro phase: ${phase}`);
  }
  const maestro = invocation || resolveMaestroInvocation({ env, existsSync: fsImpl.existsSync });
  const outputRoot = path.join(
    ROOT,
    'maestro-results/android/play-upgrade',
    deviceId,
    phase
  );
  fsImpl.mkdirSync(path.join(env.MAESTRO_RUNNER_HOME || path.resolve(ROOT, '.maestro-home'), '.maestro'), {
    recursive: true,
  });
  fsImpl.mkdirSync(outputRoot, { recursive: true });
  const result = spawn(
    maestro.command,
    [
      ...maestro.baseArgs,
      'test',
      '-e',
      `UPGRADE_SENTINEL=${sentinel}`,
      flow,
      '--device',
      deviceId,
      '--format',
      'NOOP',
      '--test-output-dir',
      outputRoot,
      '--debug-output',
      outputRoot,
      '--flatten-debug-output',
    ],
    {
      cwd: ROOT,
      env: buildMaestroEnvironment(sentinel, env),
      stdio: 'inherit',
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${phase} Maestro flow failed with exit ${result.status}.`);
  }
}

function writeJsonAtomic(filePath, value, fsImpl = fs) {
  fsImpl.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  fsImpl.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fsImpl.renameSync(temporaryPath, filePath);
}

function readState(filePath, fsImpl = fs) {
  if (!fsImpl.existsSync(filePath)) {
    throw new Error(`Missing v33 prepare state: ${filePath}`);
  }
  const state = JSON.parse(fsImpl.readFileSync(filePath, 'utf8'));
  if (state.schemaVersion === 1) {
    throw new Error(
      'Legacy upgrade state schemaVersion 1 cannot prove stable Wi-Fi device identity; rerun prepare with --resume --sentinel <existing-token> --replace before the Play update.'
    );
  }
  const validDeviceKind = state.deviceKind === 'physical' || state.deviceKind === 'emulator';
  const validFingerprint =
    state.before?.deviceFingerprintScheme === DEVICE_FINGERPRINT_SCHEME &&
    /^sha256:[0-9a-f]{64}$/.test(state.before?.deviceFingerprint || '');
  const validQualification =
    typeof state.qualification === 'boolean' &&
    state.qualification === (state.deviceKind === 'physical') &&
    state.before?.deviceKind === state.deviceKind;
  if (
    state.schemaVersion !== 2 ||
    !state.before ||
    !state.sentinel ||
    !state.deviceId ||
    !validDeviceKind ||
    !validFingerprint ||
    !validQualification
  ) {
    throw new Error(`Invalid upgrade state file: ${filePath}`);
  }
  return state;
}

function prepareUpgrade(options, {
  fsImpl = fs,
  capture = captureSnapshot,
  runFlow = runMaestroFlow,
  now = () => new Date(),
} = {}) {
  if (fsImpl.existsSync(options.statePath) && !options.replace) {
    throw new Error(
      `Prepare state already exists at ${options.statePath}; preserve it or rerun with --replace explicitly.`
    );
  }

  const sentinel = options.sentinel || buildSentinel(now());
  const captureOptions = {
    allowEmulatorRehearsal: options.allowEmulatorRehearsal === true,
  };
  const preflight = capture(options.deviceId, FROM_VERSION_CODE, captureOptions);
  if (options.allowEmulatorRehearsal === true && preflight.deviceKind !== 'emulator') {
    throw new Error('--allow-emulator-rehearsal is only valid for an emulator rehearsal.');
  }
  runFlow(options.resume ? 'resume' : 'prepare', options.deviceId, sentinel);
  const before = capture(options.deviceId, FROM_VERSION_CODE, captureOptions);
  assertSameSnapshot(preflight, before, 'Prepare');

  if (before.deviceKind !== 'physical' && before.deviceKind !== 'emulator') {
    throw new Error('Prepare snapshot is missing a valid deviceKind.');
  }
  const state = {
    schemaVersion: 2,
    transition: `${FROM_VERSION_CODE}->${TO_VERSION_CODE}`,
    deviceId: options.deviceId,
    deviceKind: before.deviceKind,
    qualification: before.deviceKind === 'physical',
    sentinel,
    preparedAt: now().toISOString(),
    before,
  };
  writeJsonAtomic(options.statePath, state, fsImpl);
  return state;
}

function verifyUpgrade(options, {
  fsImpl = fs,
  capture = captureSnapshot,
  runFlow = runMaestroFlow,
  now = () => new Date(),
} = {}) {
  const state = readState(options.statePath, fsImpl);
  if (state.after) {
    throw new Error('Upgrade state already contains a completed v34 verification.');
  }

  const emulatorRehearsal = state.deviceKind === 'emulator';
  if (emulatorRehearsal && options.allowEmulatorRehearsal !== true) {
    throw new Error(
      'This state is an emulator rehearsal; verify requires --allow-emulator-rehearsal and remains non-qualifying.'
    );
  }
  if (!emulatorRehearsal && options.allowEmulatorRehearsal === true) {
    throw new Error('--allow-emulator-rehearsal cannot be used with a physical qualification state.');
  }

  const captureOptions = {
    allowEmulatorRehearsal: emulatorRehearsal,
  };

  const postUpdate = capture(options.deviceId, TO_VERSION_CODE, captureOptions);
  if (postUpdate.deviceKind !== state.deviceKind) {
    throw new Error(
      `Prepared deviceKind ${state.deviceKind} does not match verify deviceKind ${postUpdate.deviceKind}.`
    );
  }
  assertInPlaceUpgrade(state.before, postUpdate);
  runFlow('verify', options.deviceId, state.sentinel);
  const after = capture(options.deviceId, TO_VERSION_CODE, captureOptions);
  assertSameSnapshot(postUpdate, after, 'Verify');
  assertInPlaceUpgrade(state.before, after);

  const completed = {
    ...state,
    qualification: state.deviceKind === 'physical',
    verifiedDeviceId: options.deviceId,
    verifiedAt: now().toISOString(),
    after,
  };
  writeJsonAtomic(options.statePath, completed, fsImpl);
  return completed;
}

function formatSummary(state) {
  if (!state.after) {
    return [
      state.qualification
        ? '[play-upgrade] PREPARED'
        : '[play-upgrade] REHEARSAL PREPARED - qualification=false',
      `[play-upgrade] device: ${state.deviceId}`,
      `[play-upgrade] deviceKind: ${state.deviceKind}`,
      `[play-upgrade] before: ${state.before.versionName} (${state.before.versionCode})`,
      `[play-upgrade] installer: ${state.before.installerPackageName}`,
      `[play-upgrade] firstInstallTime: ${state.before.firstInstallTime}`,
      `[play-upgrade] lastUpdateTime: ${state.before.lastUpdateTime}`,
      '[play-upgrade] Next: update Noctalia from Google Play to versionCode 34, without uninstalling, then run verify.',
    ].join('\n');
  }
  return [
    state.qualification
      ? '[play-upgrade] PASS - Play update 33->34 preserved app identity and seeded data.'
      : '[play-upgrade] REHEARSAL PASS - qualification=false; not a physical release qualification.',
    `[play-upgrade] device: ${state.verifiedDeviceId || state.deviceId}`,
    `[play-upgrade] deviceKind: ${state.deviceKind}`,
    `[play-upgrade] before: ${state.before.versionName} (${state.before.versionCode})`,
    `[play-upgrade] after: ${state.after.versionName} (${state.after.versionCode})`,
    `[play-upgrade] installer: ${state.after.installerPackageName}`,
    `[play-upgrade] signature: ${state.after.signature}`,
    `[play-upgrade] firstInstallTime: ${state.after.firstInstallTime}`,
    `[play-upgrade] lastUpdateTime: ${state.after.lastUpdateTime}`,
  ].join('\n');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  const state = options.phase === 'prepare'
    ? prepareUpgrade(options)
    : verifyUpgrade(options);
  process.stdout.write(`${formatSummary(state)}\n`);
  process.stdout.write(`[play-upgrade] evidence: ${options.statePath}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[play-upgrade] FAIL - ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

module.exports = {
  DEFAULT_STATE_PATH,
  DEVICE_FINGERPRINT_SCHEME,
  FROM_VERSION_CODE,
  PACKAGE_NAME,
  PLAY_INSTALLER,
  TO_VERSION_CODE,
  assertInPlaceUpgrade,
  assertPhysicalDevice,
  assertQaDevice,
  assertReadOnlyAdbArgs,
  assertSameSnapshot,
  assertSnapshotForVersion,
  buildDeviceFingerprint,
  buildMaestroEnvironment,
  buildSentinel,
  captureSnapshot,
  formatSummary,
  parseArgs,
  parseAndroidId,
  parsePackageSnapshot,
  parseSigningCertificate,
  prepareUpgrade,
  readState,
  resolveMaestroInvocation,
  runMaestroFlow,
  verifyUpgrade,
  writeJsonAtomic,
};
