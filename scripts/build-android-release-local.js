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
  EXPO_PUBLIC_SUBSCRIPTION_QA_LAB: 'false',
});
const TESTSTORE_ENV_OVERRIDES = Object.freeze({
  ...COMMON_RELEASE_ENV_OVERRIDES,
  EXPO_PUBLIC_SUBSCRIPTION_QA_LAB: 'true',
});
const SUPPORTED_ABIS = new Set([
  'armeabi-v7a',
  'arm64-v8a',
  'x86',
  'x86_64',
]);

function parseArgs(argv) {
  const options = {
    abi: null,
    device: null,
    install: false,
    profile: RELEASE_BUILD_PROFILE,
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
  profileName = RELEASE_BUILD_PROFILE
) {
  const buildEnv = { ...env };
  if (!buildEnv.GRADLE_USER_HOME && buildEnv.CODEX_CI === '1') {
    buildEnv.GRADLE_USER_HOME = path.join(temporaryDirectory, 'noctalia-gradle-home');
  }

  return {
    ...buildEnv,
    ...releaseEnv,
    ...getProfileEnvOverrides(profileName),
  };
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
  profileName = RELEASE_BUILD_PROFILE
) {
  const normalizedProfile = normalizeBuildProfile(profileName);
  return path.join(
    rootDir,
    'dist',
    'android',
    `${normalizedProfile}-release.apk`
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

function printHelp() {
  process.stdout.write(
    [
      'Build a local Android Release APK for the ABI of a connected device.',
      '',
      'Usage:',
      '  npm run android:release:local -- [--profile <profile>] [--abi <abi> | --device <serial>] [--install]',
      '',
      `Profiles: ${[...SUPPORTED_BUILD_PROFILES].join(', ')} (default: ${RELEASE_BUILD_PROFILE}).`,
      `The ${TESTSTORE_BUILD_PROFILE} profile explicitly loads .env.teststore.`,
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

  const releaseEnv = loadReleaseBuildEnv(
    ROOT,
    fs.readFileSync,
    options.profile
  );
  const env = getBuildEnv(
    process.env,
    os.tmpdir(),
    releaseEnv,
    options.profile
  );
  const adbCommand = env.ADB_BIN || resolveCommand('adb', { env }) || 'adb';
  let device = options.device;
  let abi = options.abi;
  if (!abi || options.install || device) {
    device = resolveDevice(adbCommand, device, env);
    const deviceAbi = normalizeAbi(
      runAdb(adbCommand, ['-s', device, 'shell', 'getprop', 'ro.product.cpu.abi'], env)
    );
    if (abi && abi !== deviceAbi) {
      throw new Error(`Requested ABI ${abi} does not match ${device} ABI ${deviceAbi}`);
    }
    abi = abi ?? deviceAbi;
  }
  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  runChecked(npxCommand, getPrebuildArgs(), {
    cwd: ROOT,
    env,
    label: 'Expo Android prebuild',
  });

  const gradleWrapper = getGradleWrapper();
  const apkPath = getApkPath();
  const outputApkPath = getOutputApkPath(ROOT, options.profile);
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

  if (options.install) {
    const installOutput = runAdb(
      adbCommand,
      ['-s', device, 'install', '-r', outputApkPath],
      env
    ).trim();
    process.stdout.write(`Installed on ${device}: ${installOutput || 'success'}\n`);
  }

  process.stdout.write(
    `Release APK built for ${abi} (${options.profile}): ${path.relative(ROOT, outputApkPath)}\n`
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
  RELEASE_BUILD_PROFILE,
  RELEASE_ENV_OVERRIDES,
  SUPPORTED_BUILD_PROFILES,
  TESTSTORE_BUILD_PROFILE,
  TESTSTORE_ENV_OVERRIDES,
  copyReleaseApk,
  getApkPath,
  getBuildEnv,
  getGradleArgs,
  getGradleWrapper,
  getOutputApkPath,
  getPrebuildArgs,
  getProfileEnvOverrides,
  getReleaseBuildEnv,
  loadReleaseBuildEnv,
  normalizeBuildProfile,
  normalizeAbi,
  parseArgs,
  removeStaleApk,
  runChecked,
};
