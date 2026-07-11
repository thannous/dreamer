'use strict';
/* global describe, expect, it, jest */

const path = require('node:path');

const {
  DEFAULT_GRADLE_JVM_ARGS,
  RELEASE_BUILD_PROFILE,
  TESTSTORE_BUILD_PROFILE,
  copyReleaseApk,
  getApkPath,
  getBuildEnv,
  getGradleArgs,
  getGradleWrapper,
  getOutputApkPath,
  getPrebuildArgs,
  getReleaseBuildEnv,
  loadReleaseBuildEnv,
  normalizeBuildProfile,
  normalizeAbi,
  parseArgs,
  removeStaleApk,
} = require('./build-android-release-local');

describe('build-android-release-local', () => {
  it('parses an optional device serial', () => {
    expect(parseArgs(['--device', 'emulator-5554'])).toEqual({
      abi: null,
      device: 'emulator-5554',
      install: false,
      profile: RELEASE_BUILD_PROFILE,
    });
  });

  it('makes installation explicit', () => {
    expect(parseArgs(['--install'])).toEqual({
      abi: null,
      device: null,
      install: true,
      profile: RELEASE_BUILD_PROFILE,
    });
  });

  it('supports a device-independent build ABI', () => {
    expect(parseArgs(['--abi', 'arm64-v8a'])).toEqual({
      abi: 'arm64-v8a',
      device: null,
      install: false,
      profile: RELEASE_BUILD_PROFILE,
    });
  });

  it('uses production by default and accepts only the Test Store alternative', () => {
    expect(parseArgs(['--profile', TESTSTORE_BUILD_PROFILE])).toEqual({
      abi: null,
      device: null,
      install: false,
      profile: TESTSTORE_BUILD_PROFILE,
    });
    expect(normalizeBuildProfile(RELEASE_BUILD_PROFILE)).toBe(
      RELEASE_BUILD_PROFILE
    );
    expect(() => normalizeBuildProfile('preview')).toThrow(
      'Unsupported build profile'
    );
  });

  it('rejects a missing device serial', () => {
    expect(() => parseArgs(['--device'])).toThrow('Missing value for --device');
    expect(() => parseArgs(['--device', '--help'])).toThrow(
      'Missing value for --device'
    );
    expect(() => parseArgs(['--abi'])).toThrow('Missing value for --abi');
    expect(() => parseArgs(['--profile'])).toThrow(
      'Missing value for --profile'
    );
  });

  it('rejects unsupported ABIs', () => {
    expect(() => normalizeAbi('riscv64')).toThrow('Unsupported Android ABI');
  });

  it('limits the Release build to one ABI and keeps Kotlin in-process', () => {
    expect(getGradleArgs('arm64-v8a')).toEqual([
      ':app:clean',
      ':app:assembleRelease',
      '-PreactNativeArchitectures=arm64-v8a',
      '-Pkotlin.compiler.execution.strategy=in-process',
      `-Dorg.gradle.jvmargs=${DEFAULT_GRADLE_JVM_ARGS}`,
      '--no-build-cache',
      '--no-daemon',
      '--stacktrace',
      '--console=plain',
    ]);
  });

  it('removes a previous Release APK before Gradle rebuilds it', () => {
    const rmSync = jest.fn();
    const apkPath = '/repo/android/app/build/outputs/apk/release/app-release.apk';

    expect(removeStaleApk(apkPath, () => true, rmSync)).toBe(true);
    expect(rmSync).toHaveBeenCalledWith(apkPath, { force: true });
    expect(removeStaleApk(apkPath, () => false, rmSync)).toBe(false);
    expect(rmSync).toHaveBeenCalledTimes(1);
  });

  it('selects the platform Gradle wrapper', () => {
    expect(getGradleWrapper('/repo', 'darwin')).toBe(
      path.join('/repo', 'android', 'gradlew')
    );
    expect(getGradleWrapper('/repo', 'win32')).toBe(
      path.join('/repo', 'android', 'gradlew.bat')
    );
  });

  it('uses a temporary Gradle home only in Codex CI', () => {
    expect(getBuildEnv({ CODEX_CI: '1' }, '/tmp')).toMatchObject({
      GRADLE_USER_HOME: path.join('/tmp', 'noctalia-gradle-home'),
    });
    expect(getBuildEnv({ CODEX_CI: '1', GRADLE_USER_HOME: '/custom' }, '/tmp'))
      .toMatchObject({ GRADLE_USER_HOME: '/custom' });
    expect(getBuildEnv({}, '/tmp')).not.toHaveProperty('GRADLE_USER_HOME');
  });

  it('forces Test Store mode without automatic dotenv loading', () => {
    expect(
      getBuildEnv(
        { EXPO_NO_DOTENV: '0' },
        '/tmp',
        {
          EXPO_PUBLIC_MOCK_MODE: 'true',
          EXPO_PUBLIC_SUBSCRIPTION_QA_LAB: 'false',
        },
        TESTSTORE_BUILD_PROFILE
      )
    ).toMatchObject({
      EXPO_NO_DOTENV: '1',
      EXPO_PUBLIC_MOCK_MODE: 'false',
      EXPO_PUBLIC_SUBSCRIPTION_QA_LAB: 'true',
    });
  });

  it('loads a fail-closed production APK environment', () => {
    const releaseEnv = getReleaseBuildEnv({
      build: {
        [RELEASE_BUILD_PROFILE]: {
          env: {
            EXPO_PUBLIC_API_URL: 'https://example.test/api',
            EXPO_PUBLIC_MOCK_MODE: 'true',
            EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'goog_live',
          },
        },
      },
    });

    expect(releaseEnv).toMatchObject({
      EXPO_NO_DOTENV: '1',
      EXPO_PUBLIC_MOCK_MODE: 'false',
      EXPO_PUBLIC_SUBSCRIPTION_QA_LAB: 'false',
      EXPO_PUBLIC_REFERENCE_IMAGES_ENABLED: 'false',
    });
  });

  it('rejects an unsafe production APK environment', () => {
    expect(() => getReleaseBuildEnv({ build: {} })).toThrow(
      'Missing eas.json build profile env'
    );
    expect(() => getReleaseBuildEnv({
      build: {
        [RELEASE_BUILD_PROFILE]: {
          env: {
            EXPO_PUBLIC_API_URL: 'http://localhost:3000',
            EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'test_store',
          },
        },
      },
    })).toThrow('must define an HTTPS EXPO_PUBLIC_API_URL');
    expect(() => getReleaseBuildEnv({
      build: {
        [RELEASE_BUILD_PROFILE]: {
          env: {
            EXPO_PUBLIC_API_URL: 'https://example.test/api',
            EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'test_store',
          },
        },
      },
    })).toThrow('must use a goog_ RevenueCat key');
  });

  it('loads and validates the explicit Test Store environment', () => {
    const releaseEnv = getReleaseBuildEnv(
      {
        build: {
          [TESTSTORE_BUILD_PROFILE]: {
            env: {
              EXPO_PUBLIC_MOCK_MODE: 'true',
              EXPO_PUBLIC_SUBSCRIPTION_QA_LAB: 'false',
            },
          },
        },
      },
      TESTSTORE_BUILD_PROFILE,
      {
        EXPO_PUBLIC_API_URL: 'https://example.test/api',
        EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'test_store',
      }
    );

    expect(releaseEnv).toMatchObject({
      EXPO_NO_DOTENV: '1',
      EXPO_PUBLIC_MOCK_MODE: 'false',
      EXPO_PUBLIC_SUBSCRIPTION_QA_LAB: 'true',
      EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'test_store',
    });
    expect(() =>
      getReleaseBuildEnv(
        {
          build: {
            [TESTSTORE_BUILD_PROFILE]: { env: {} },
          },
        },
        TESTSTORE_BUILD_PROFILE,
        {
          EXPO_PUBLIC_API_URL: 'https://example.test/api',
          EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'goog_live',
        }
      )
    ).toThrow('must use a test_ RevenueCat key');
  });

  it('reads .env.teststore only for the Test Store profile', () => {
    const easConfig = {
      build: {
        [RELEASE_BUILD_PROFILE]: {
          env: {
            EXPO_PUBLIC_API_URL: 'https://example.test/api',
            EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'goog_live',
          },
        },
        [TESTSTORE_BUILD_PROFILE]: { env: {} },
      },
    };
    const readFileSync = jest.fn((filePath) => {
      if (filePath === path.join('/repo', 'eas.json')) {
        return JSON.stringify(easConfig);
      }
      if (filePath === path.join('/repo', '.env.teststore')) {
        return 'teststore contents';
      }
      throw new Error(`Unexpected file: ${filePath}`);
    });
    const parseEnvFile = jest.fn(() => ({
      EXPO_PUBLIC_API_URL: 'https://teststore.example.test/api',
      EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'test_store',
    }));

    expect(
      loadReleaseBuildEnv(
        '/repo',
        readFileSync,
        TESTSTORE_BUILD_PROFILE,
        parseEnvFile
      )
    ).toMatchObject({
      EXPO_PUBLIC_API_URL: 'https://teststore.example.test/api',
      EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'test_store',
    });
    expect(readFileSync).toHaveBeenCalledWith(
      path.join('/repo', '.env.teststore'),
      'utf8'
    );
    expect(parseEnvFile).toHaveBeenCalledWith(
      'teststore contents',
      process.env
    );

    readFileSync.mockClear();
    parseEnvFile.mockClear();
    loadReleaseBuildEnv('/repo', readFileSync, RELEASE_BUILD_PROFILE, parseEnvFile);
    expect(readFileSync).not.toHaveBeenCalledWith(
      path.join('/repo', '.env.teststore'),
      'utf8'
    );
    expect(parseEnvFile).not.toHaveBeenCalled();
  });

  it('prebuilds Android before resolving the Release APK path', () => {
    expect(getPrebuildArgs()).toEqual([
      'expo',
      'prebuild',
      '--platform',
      'android',
      '--no-install',
    ]);
    expect(getApkPath('/repo')).toBe(
      path.join('/repo', 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk')
    );
    expect(getOutputApkPath('/repo', RELEASE_BUILD_PROFILE)).toBe(
      path.join('/repo', 'dist', 'android', 'production-apk-release.apk')
    );
    expect(getOutputApkPath('/repo', TESTSTORE_BUILD_PROFILE)).toBe(
      path.join(
        '/repo',
        'dist',
        'android',
        'revenuecat-teststore-release.apk'
      )
    );
  });

  it('copies the Gradle APK into a profile-specific output directory', () => {
    const mkdirSync = jest.fn();
    const copyFileSync = jest.fn();
    const outputPath = path.join(
      '/repo',
      'dist',
      'android',
      'revenuecat-teststore-release.apk'
    );

    expect(
      copyReleaseApk('/repo/android/app-release.apk', outputPath, mkdirSync, copyFileSync)
    ).toBe(outputPath);
    expect(mkdirSync).toHaveBeenCalledWith(path.dirname(outputPath), {
      recursive: true,
    });
    expect(copyFileSync).toHaveBeenCalledWith(
      '/repo/android/app-release.apk',
      outputPath
    );
  });
});
