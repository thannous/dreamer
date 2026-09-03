#!/usr/bin/env node
'use strict';
/* global __dirname */

const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseEnv: parseExpoEnv } = require('@expo/env');

const { resolveCommand } = require('./android-tooling');
const { parseAdbDevices } = require('./check-android-adb-device');
const {
  parseLockOwner,
  prepareAndroidDeviceLocks,
  attachDeviceLockSignals,
} = require('./android-device-lock');

const ROOT = path.resolve(__dirname, '..');
const RELEASE_BUILD_PROFILE = 'production-apk';
const TESTSTORE_BUILD_PROFILE = 'revenuecat-teststore';
const SUPPORTED_BUILD_PROFILES = new Set([
  RELEASE_BUILD_PROFILE,
  TESTSTORE_BUILD_PROFILE,
]);
const DEFAULT_GRADLE_JVM_ARGS =
  '-Xmx4g -XX:MaxMetaspaceSize=1g -Dfile.encoding=UTF-8';
const COMMON_RELEASE_ENV_OVERRIDES = Object.freeze({
  EXPO_NO_DOTENV: '1',
  EXPO_PUBLIC_MOCK_MODE: 'false',
  EXPO_PUBLIC_REFERENCE_IMAGES_ENABLED: 'false',
});
const RELEASE_ENV_OVERRIDES = Object.freeze({
  ...COMMON_RELEASE_ENV_OVERRIDES,
  NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE: 'false',
  NOCTALIA_ANDROID_PERFORMANCE_PROFILEABLE: 'false',
  EXPO_PUBLIC_SUBSCRIPTION_QA_LAB: 'false',
});
const TESTSTORE_ENV_OVERRIDES = Object.freeze({
  ...COMMON_RELEASE_ENV_OVERRIDES,
  NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE: 'true',
  NOCTALIA_ANDROID_PERFORMANCE_PROFILEABLE: 'false',
  EXPO_PUBLIC_SUBSCRIPTION_QA_LAB: 'true',
});
const SUPPORTED_ABIS = new Set([
  'armeabi-v7a',
  'arm64-v8a',
  'x86',
  'x86_64',
]);
const DREAMER_QA_BUILD_ENV = 'NOCTALIA_DREAMER_QA_BUILD';
const DREAMER_QA_ANDROID_PACKAGE = 'com.tanuki75.noctalia.qa';
const PRODUCTION_ANDROID_PACKAGE = 'com.tanuki75.noctalia';
const EMULATOR_SERIAL = /^emulator-\d+$/;

function parseArgs(argv) {
  const options = {
    abi: null,
    device: null,
    install: false,
    profileable: false,
    profile: RELEASE_BUILD_PROFILE,
    reuseNativeProject: false,
    sideBySideQa: false,
    lockOwner: 'dreamer',
    stealLock: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--device') {
      const device = argv[index + 1];
      if (!device || device.startsWith('--')) {
        throw new Error('Missing value for --device');
      }
      options.device = device.trim();
      index += 1;
      continue;
    }

    if (arg === '--abi') {
      const abi = argv[index + 1];
      if (!abi || abi.startsWith('--')) {
        throw new Error('Missing value for --abi');
      }
      options.abi = normalizeAbi(abi);
      index += 1;
      continue;
    }

    if (arg === '--profile') {
      const profile = argv[index + 1];
      if (!profile || profile.startsWith('--')) {
        throw new Error('Missing value for --profile');
      }
      options.profile = normalizeBuildProfile(profile);
      index += 1;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--install') {
      options.install = true;
      continue;
    }

    if (arg === '--profileable') {
      options.profileable = true;
      continue;
    }

    if (arg === '--reuse-native-project') {
      options.reuseNativeProject = true;
      continue;
    }

    if (arg === '--side-by-side-qa') {
      options.sideBySideQa = true;
      continue;
    }

    if (arg === '--lock-owner') {
      options.lockOwner = parseLockOwner(argv[index + 1], '--lock-owner');
      index += 1;
      continue;
    }

    if (arg === '--steal-lock') {
      options.stealLock = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.device !== null && options.device === '') {
    throw new Error('Missing value for --device');
  }

  return options;
}

function normalizeBuildProfile(value) {
  const profile = value.trim();
  if (!SUPPORTED_BUILD_PROFILES.has(profile)) {
    throw new Error(
      `Unsupported build profile "${profile || '(empty)'}". Expected one of: ${[...SUPPORTED_BUILD_PROFILES].join(', ')}`
    );
  }
  return profile;
}

function normalizeAbi(value) {
  const abi = value.trim();
  if (!SUPPORTED_ABIS.has(abi)) {
    throw new Error(
      `Unsupported Android ABI "${abi || '(empty)'}". Expected one of: ${[...SUPPORTED_ABIS].join(', ')}`
    );
  }
  return abi;
}

function getGradleWrapper(rootDir = ROOT, platform = process.platform) {
  return path.join(
    rootDir,
    'android',
    platform === 'win32' ? 'gradlew.bat' : 'gradlew'
  );
}

function getGradleArgs(abi, jvmArgs = DEFAULT_GRADLE_JVM_ARGS) {
  return [
    ':app:clean',
    ':app:assembleRelease',
    `-PreactNativeArchitectures=${normalizeAbi(abi)}`,
    '-Pkotlin.compiler.execution.strategy=in-process',
    `-Dorg.gradle.jvmargs=${jvmArgs}`,
    '--no-build-cache',
    '--no-daemon',
    '--stacktrace',
    '--console=plain',
  ];
}

function getProfileEnvOverrides(profileName) {
  return normalizeBuildProfile(profileName) === TESTSTORE_BUILD_PROFILE
    ? TESTSTORE_ENV_OVERRIDES
    : RELEASE_ENV_OVERRIDES;
}

function getReleaseBuildEnv(
  easConfig,
  profileName = RELEASE_BUILD_PROFILE,
  profileFileEnv = {}
) {
  const normalizedProfile = normalizeBuildProfile(profileName);
  const profileEnv = easConfig?.build?.[normalizedProfile]?.env;
  if (!profileEnv || typeof profileEnv !== 'object') {
    throw new Error(`Missing eas.json build profile env: ${normalizedProfile}`);
  }

  const releaseEnv = {
    ...profileEnv,
    ...(normalizedProfile === TESTSTORE_BUILD_PROFILE ? profileFileEnv : {}),
    ...getProfileEnvOverrides(normalizedProfile),
  };

  if (!String(releaseEnv.EXPO_PUBLIC_API_URL || '').startsWith('https://')) {
    throw new Error(
      `${normalizedProfile} must define an HTTPS EXPO_PUBLIC_API_URL`
    );
  }
  const expectedRevenueCatPrefix =
    normalizedProfile === TESTSTORE_BUILD_PROFILE ? 'test_' : 'goog_';
  if (
    !String(releaseEnv.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '').startsWith(
      expectedRevenueCatPrefix
    )
  ) {
    throw new Error(
      `${normalizedProfile} must use a ${expectedRevenueCatPrefix} RevenueCat key`
    );
  }

  return releaseEnv;
}

function loadReleaseBuildEnv(
  rootDir = ROOT,
  readFileSync = fs.readFileSync,
  profileName = RELEASE_BUILD_PROFILE,
  parseEnvFile = parseExpoEnv
) {
  const easConfig = JSON.parse(readFileSync(path.join(rootDir, 'eas.json'), 'utf8'));
  const normalizedProfile = normalizeBuildProfile(profileName);
  const profileFileEnv =
    normalizedProfile === TESTSTORE_BUILD_PROFILE
      ? parseEnvFile(
          readFileSync(path.join(rootDir, '.env.teststore'), 'utf8'),
          process.env
        )
      : {};
  return getReleaseBuildEnv(easConfig, normalizedProfile, profileFileEnv);
}

function getBuildEnv(
  env = process.env,
  temporaryDirectory = os.tmpdir(),
  releaseEnv = {},
  profileName = RELEASE_BUILD_PROFILE,
  profileable = false,
  sideBySideQa = false
) {
  const buildEnv = { ...env };
  if (!buildEnv.GRADLE_USER_HOME && buildEnv.CODEX_CI === '1') {
    buildEnv.GRADLE_USER_HOME = path.join(temporaryDirectory, 'noctalia-gradle-home');
  }

  const nextEnv = {
    ...buildEnv,
    ...releaseEnv,
    ...getProfileEnvOverrides(profileName),
    EXPO_PUBLIC_PERFORMANCE_TRACING: profileable ? 'true' : 'false',
    NOCTALIA_ANDROID_PERFORMANCE_PROFILEABLE: profileable ? 'true' : 'false',
  };

  if (sideBySideQa) {
    if (
      nextEnv.NOCTALIA_APP_VARIANT === 'lucid' ||
      nextEnv.EXPO_PUBLIC_APP_VARIANT === 'lucid' ||
      nextEnv.EXPO_PUBLIC_APP_VARIANT === 'lucid-trainer'
    ) {
      throw new Error(
        'Dreamer QA build cannot be combined with Lucid Trainer.'
      );
    }
    nextEnv[DREAMER_QA_BUILD_ENV] = '1';
  } else {
    delete nextEnv[DREAMER_QA_BUILD_ENV];
  }

  return nextEnv;
}

function getPrebuildArgs() {
  return ['expo', 'prebuild', '--platform', 'android', '--no-install'];
}

function getApkPath(rootDir = ROOT) {
  return path.join(
    rootDir,
    'android',
    'app',
    'build',
    'outputs',
    'apk',
    'release',
    'app-release.apk'
  );
}

function getOutputApkPath(
  rootDir = ROOT,
  profileName = RELEASE_BUILD_PROFILE,
  profileable = false,
  sideBySideQa = false
) {
  const normalizedProfile = normalizeBuildProfile(profileName);
  const qa = sideBySideQa ? '-qa' : '';
  const variant = profileable ? '-profileable' : '';
  return path.join(
    rootDir,
    'dist',
    'android',
    `${normalizedProfile}${qa}${variant}-release.apk`
  );
}

function copyReleaseApk(
  sourcePath,
  outputPath,
  mkdirSync = fs.mkdirSync,
  copyFileSync = fs.copyFileSync
) {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  copyFileSync(sourcePath, outputPath);
  return outputPath;
}

function removeStaleApk(
  apkPath = getApkPath(),
  existsSync = fs.existsSync,
  rmSync = fs.rmSync
) {
  if (!existsSync(apkPath)) {
    return false;
  }

  rmSync(apkPath, { force: true });
  return true;
}

function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    env: options.env ?? process.env,
    shell: options.shell ?? false,
    stdio: options.stdio ?? 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${options.label ?? command} failed with exit ${result.status ?? 1}`);
  }
}

function runAdb(adbCommand, args, env) {
  const result = spawnSync(adbCommand, args, {
    encoding: 'utf8',
    env,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`;
    throw new Error(`ADB failed: ${detail}`);
  }

  return result.stdout;
}

function resolveDevice(adbCommand, requestedDevice, env) {
  if (requestedDevice) {
    return requestedDevice;
  }

  const devices = parseAdbDevices(runAdb(adbCommand, ['devices', '-l'], env))
    .filter((device) => device.state === 'device');

  if (devices.length !== 1) {
    throw new Error(
      `Expected exactly one ready Android device, found ${devices.length}. Pass --device <serial>.`
    );
  }

  return devices[0].id;
}

function isEmulatorDevice(device) {
  return EMULATOR_SERIAL.test(String(device || ''));
}

function assertTestStoreInstallTarget(profileName, install, device) {
  if (
    normalizeBuildProfile(profileName) === TESTSTORE_BUILD_PROFILE &&
    install &&
    !isEmulatorDevice(device)
  ) {
    throw new Error(
      'RevenueCat Test Store APK installation is emulator-only; refusing to replace a physical Play installation.'
    );
  }
}

function assertProfileableBuildProfile(profileName, profileable) {
  if (profileable && normalizeBuildProfile(profileName) !== RELEASE_BUILD_PROFILE) {
    throw new Error(
      'The profileable Release mode is available only with the production-apk profile.'
    );
  }
}

function assertSideBySideQaProfile(profileName, sideBySideQa) {
  if (sideBySideQa && normalizeBuildProfile(profileName) !== RELEASE_BUILD_PROFILE) {
    throw new Error(
      'Side-by-side QA is available only with the production-apk profile.'
    );
  }
}

function parseApkApplicationId(output) {
  const text = String(output || '');
  const badging = text.match(/package: name='([^']+)'/);
  if (badging) {
    return badging[1];
  }

  const lines = text.trim().split(/\n/);
  const lastLine = lines[lines.length - 1]?.trim() ?? '';
  if (/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(lastLine)) {
    return lastLine;
  }

  throw new Error('Unable to parse APK applicationId');
}

function findSdkAapt({
  env = process.env,
  platform = process.platform,
  existsSync = fs.existsSync,
  readdirSync = fs.readdirSync,
} = {}) {
  const sdkRoots = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT].filter(Boolean);
  const executable = platform === 'win32' ? 'aapt.exe' : 'aapt';

  for (const sdkRoot of sdkRoots) {
    const buildTools = path.join(sdkRoot, 'build-tools');
    if (!existsSync(buildTools)) {
      continue;
    }

    let versions = [];
    try {
      versions = readdirSync(buildTools);
    } catch {
      continue;
    }

    for (const version of [...versions].sort().reverse()) {
      const candidate = path.join(buildTools, version, executable);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function resolveApkInspector({
  env = process.env,
  platform = process.platform,
  spawn = spawnSync,
  existsSync = fs.existsSync,
  readdirSync = fs.readdirSync,
  resolveCommandFn = resolveCommand,
} = {}) {
  const analyzer = resolveCommandFn('apkanalyzer', {
    spawn,
    existsSync,
    env,
    platform,
  });
  if (analyzer) {
    return { command: analyzer, kind: 'apkanalyzer' };
  }

  const aapt = resolveCommandFn('aapt', {
    spawn,
    existsSync,
    env,
    platform,
  }) || findSdkAapt({ env, platform, existsSync, readdirSync });
  if (aapt) {
    return { command: aapt, kind: 'aapt' };
  }

  throw new Error(
    'Unable to inspect APK identity: aapt or apkanalyzer is required'
  );
}

function inspectApkApplicationId(
  apkPath,
  {
    env = process.env,
    platform = process.platform,
    spawn = spawnSync,
    existsSync = fs.existsSync,
    readdirSync = fs.readdirSync,
    resolveCommandFn = resolveCommand,
  } = {}
) {
  const inspector = resolveApkInspector({
    env,
    platform,
    spawn,
    existsSync,
    readdirSync,
    resolveCommandFn,
  });
  const args =
    inspector.kind === 'apkanalyzer'
      ? ['manifest', 'application-id', apkPath]
      : ['dump', 'badging', apkPath];
  const result = spawn(inspector.command, args, {
    encoding: 'utf8',
    env,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const detail =
      result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`;
    throw new Error(`Unable to inspect APK identity: ${detail}`);
  }

  return parseApkApplicationId(result.stdout);
}

function assertInstallableApkIdentity(
  applicationId,
  sideBySideQa,
  { install = false, device = null, profile = RELEASE_BUILD_PROFILE } = {}
) {
  if (sideBySideQa) {
    if (applicationId !== DREAMER_QA_ANDROID_PACKAGE) {
      throw new Error(
        `Refusing to install ${applicationId || 'unknown'}; side-by-side QA requires ${DREAMER_QA_ANDROID_PACKAGE}.`
      );
    }
    return applicationId;
  }

  if (applicationId === DREAMER_QA_ANDROID_PACKAGE) {
    throw new Error(
      `Refusing to install ${DREAMER_QA_ANDROID_PACKAGE} without --side-by-side-qa.`
    );
  }

  if (
    install &&
    applicationId === PRODUCTION_ANDROID_PACKAGE &&
    !isEmulatorDevice(device)
  ) {
    throw new Error(
      `Refusing to install ${PRODUCTION_ANDROID_PACKAGE} from ${profile} on a physical device; the production Store package is emulator-only without --side-by-side-qa.`
    );
  }

  return applicationId;
}

function shouldInspectApkIdentity({ install = false, sideBySideQa = false } = {}) {
  return Boolean(install || sideBySideQa);
}

function prepareInstallDeviceLocks(options, device, extras = {}) {
  if (!options.install || !device) {
    return { locks: [], skipped: 'no-install' };
  }
  return prepareAndroidDeviceLocks({
    devices: [device],
    owner: options.lockOwner || 'dreamer',
    stealLock: Boolean(options.stealLock),
    explicitDevices: Boolean(options.device),
    command: extras.command || `android:release:local --install --device ${device}`,
    ...extras,
  });
}

function guardReleaseApkIdentity(
  applicationId,
  {
    install = false,
    sideBySideQa = false,
    device = null,
    profile = RELEASE_BUILD_PROFILE,
  } = {}
) {
  if (!shouldInspectApkIdentity({ install, sideBySideQa })) {
    return null;
  }

  return assertInstallableApkIdentity(applicationId, sideBySideQa, {
    install,
    device,
    profile,
  });
}

function assertReusableNativeProject(
  rootDir = ROOT,
  profileable = false,
  existsSync = fs.existsSync,
  readFileSync = fs.readFileSync
) {
  const gradleWrapper = getGradleWrapper(rootDir);
  const buildGradle = path.join(rootDir, 'android', 'app', 'build.gradle');
  if (!existsSync(gradleWrapper) || !existsSync(buildGradle)) {
    throw new Error(
      'Cannot reuse the native project because the generated Android project is missing.'
    );
  }
  if (
    profileable &&
    !readFileSync(buildGradle, 'utf8').includes(
      'profileable isAndroidPerformanceProfileableBuild'
    )
  ) {
    throw new Error(
      'The generated Android project lacks the profileable Release configuration; regenerate it before using --reuse-native-project.'
    );
  }
}

function printHelp() {
  process.stdout.write(
    [
      'Build a local Android Release APK for the ABI of a connected device.',
      '',
      'Usage:',
      '  npm run android:release:local -- [--profile <profile>] [--abi <abi> | --device <serial>] [--install] [--profileable] [--reuse-native-project] [--side-by-side-qa]',
      '    [--lock-owner dreamer|lucid|meditation] [--steal-lock]',
      '',
      `Profiles: ${[...SUPPORTED_BUILD_PROFILES].join(', ')} (default: ${RELEASE_BUILD_PROFILE}).`,
      `The ${TESTSTORE_BUILD_PROFILE} profile explicitly loads .env.teststore.`,
      '--profileable enables low-overhead local profiling only for production-apk.',
      '--reuse-native-project skips Expo prebuild and requires an already-generated compatible Android project.',
      '--side-by-side-qa builds a distinct Dreamer QA package that can sit beside Play.',
      '--lock-owner and --steal-lock apply only to --install on a physical phone.',
      'Automatic dotenv loading remains disabled for every profile.',
      'This is a debug-signed emulator/device validation build. Distribution builds remain multi-ABI.',
      '',
    ].join('\n')
  );
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  assertProfileableBuildProfile(options.profile, options.profileable);
  assertSideBySideQaProfile(options.profile, options.sideBySideQa);

  const releaseEnv = loadReleaseBuildEnv(
    ROOT,
    fs.readFileSync,
    options.profile
  );
  const env = getBuildEnv(
    process.env,
    os.tmpdir(),
    releaseEnv,
    options.profile,
    options.profileable,
    options.sideBySideQa
  );
  const adbCommand = env.ADB_BIN || resolveCommand('adb', { env }) || 'adb';
  let device = options.device;
  let abi = options.abi;
  if (!abi || options.install || device) {
    device = resolveDevice(adbCommand, device, env);
    assertTestStoreInstallTarget(options.profile, options.install, device);
    const deviceAbi = normalizeAbi(
      runAdb(adbCommand, ['-s', device, 'shell', 'getprop', 'ro.product.cpu.abi'], env)
    );
    if (abi && abi !== deviceAbi) {
      throw new Error(`Requested ABI ${abi} does not match ${device} ABI ${deviceAbi}`);
    }
    abi = abi ?? deviceAbi;
  }
  if (options.reuseNativeProject) {
    assertReusableNativeProject(ROOT, options.profileable);
  } else {
    const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    runChecked(npxCommand, getPrebuildArgs(), {
      cwd: ROOT,
      env,
      label: 'Expo Android prebuild',
    });
  }

  const gradleWrapper = getGradleWrapper();
  const apkPath = getApkPath();
  const outputApkPath = getOutputApkPath(
    ROOT,
    options.profile,
    options.profileable,
    options.sideBySideQa
  );
  removeStaleApk(apkPath);
  removeStaleApk(outputApkPath);
  runChecked(
    gradleWrapper,
    getGradleArgs(abi, env.ANDROID_RELEASE_GRADLE_JVMARGS || DEFAULT_GRADLE_JVM_ARGS),
    {
      cwd: path.join(ROOT, 'android'),
      env,
      shell: process.platform === 'win32',
      label: 'Android Release build',
    }
  );

  if (!fs.existsSync(apkPath)) {
    throw new Error(`Release APK was not produced: ${apkPath}`);
  }
  copyReleaseApk(apkPath, outputApkPath);

  if (shouldInspectApkIdentity(options)) {
    const applicationId = inspectApkApplicationId(outputApkPath, { env });
    guardReleaseApkIdentity(applicationId, {
      ...options,
      device,
    });
    if (options.sideBySideQa) {
      process.stdout.write(`Package identity: ${applicationId}\n`);
    }
  }

  if (options.install) {
    const deviceLocks = prepareInstallDeviceLocks(options, device, {
      adbCommand,
      env,
    });
    const releaseOnce = attachDeviceLockSignals(deviceLocks.locks);
    try {
      const installOutput = runAdb(
        adbCommand,
        ['-s', device, 'install', '-r', outputApkPath],
        env
      ).trim();
      process.stdout.write(`Installed on ${device}: ${installOutput || 'success'}\n`);
    } finally {
      releaseOnce();
    }
  }

  process.stdout.write(
    `Release APK built for ${abi} (${options.profile}${options.profileable ? ', profileable' : ''}${options.sideBySideQa ? ', side-by-side QA' : ''}): ${path.relative(ROOT, outputApkPath)}\n`
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[android-release-local] ${message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_GRADLE_JVM_ARGS,
  DREAMER_QA_ANDROID_PACKAGE,
  DREAMER_QA_BUILD_ENV,
  PRODUCTION_ANDROID_PACKAGE,
  RELEASE_BUILD_PROFILE,
  RELEASE_ENV_OVERRIDES,
  SUPPORTED_BUILD_PROFILES,
  TESTSTORE_BUILD_PROFILE,
  TESTSTORE_ENV_OVERRIDES,
  assertInstallableApkIdentity,
  assertProfileableBuildProfile,
  assertReusableNativeProject,
  assertSideBySideQaProfile,
  assertTestStoreInstallTarget,
  copyReleaseApk,
  guardReleaseApkIdentity,
  getApkPath,
  getBuildEnv,
  getGradleArgs,
  getGradleWrapper,
  getOutputApkPath,
  getPrebuildArgs,
  getProfileEnvOverrides,
  getReleaseBuildEnv,
  inspectApkApplicationId,
  loadReleaseBuildEnv,
  normalizeBuildProfile,
  normalizeAbi,
  parseApkApplicationId,
  parseArgs,
  removeStaleApk,
  prepareInstallDeviceLocks,
  runChecked,
  shouldInspectApkIdentity,
};
