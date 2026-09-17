'use strict';
/* global describe, expect, it, jest */

const path = require('node:path');

const {
  DEFAULT_GRADLE_JVM_ARGS,
  DREAMER_QA_ANDROID_PACKAGE,
  DREAMER_QA_BUILD_ENV,
  PRODUCTION_ANDROID_PACKAGE,
  RELEASE_BUILD_PROFILE,
  TESTSTORE_BUILD_PROFILE,
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
  getReleaseBuildEnv,
  inspectApkApplicationId,
  loadReleaseBuildEnv,
  normalizeBuildProfile,
  normalizeAbi,
  parseApkApplicationId,
  parseArgs,
  removeStaleApk,
  prepareInstallDeviceLocks,
  shouldInspectApkIdentity,
} = require('./build-android-release-local');

describe('build-android-release-local', () => {
  it('keeps Test Store installation emulator-only', () => {
    expect(() => assertTestStoreInstallTarget(
      TESTSTORE_BUILD_PROFILE,
      true,
      'physical-device'
    )).toThrow('emulator-only');
    expect(() => assertTestStoreInstallTarget(
      TESTSTORE_BUILD_PROFILE,
      true,
      'emulator-5554'
    )).not.toThrow();
    expect(() => assertTestStoreInstallTarget(
      RELEASE_BUILD_PROFILE,
      true,
      'physical-device'
    )).not.toThrow();
  });

  it('parses an optional device serial', () => {
    expect(parseArgs(['--device', 'emulator-5554'])).toEqual({
      abi: null,
      device: 'emulator-5554',
      install: false,
      profileable: false,
      profile: RELEASE_BUILD_PROFILE,
      reuseNativeProject: false,
      sideBySideQa: false,
      lockOwner: 'dreamer',
      stealLock: false,
    });
  });

  it('makes installation explicit', () => {
    expect(parseArgs(['--install'])).toEqual({
      abi: null,
      device: null,
      install: true,
      profileable: false,
      profile: RELEASE_BUILD_PROFILE,
      reuseNativeProject: false,
      sideBySideQa: false,
      lockOwner: 'dreamer',
      stealLock: false,
    });
  });

  it('supports a device-independent build ABI', () => {
    expect(parseArgs(['--abi', 'arm64-v8a'])).toEqual({
      abi: 'arm64-v8a',
      device: null,
      install: false,
      profileable: false,
      profile: RELEASE_BUILD_PROFILE,
      reuseNativeProject: false,
      sideBySideQa: false,
      lockOwner: 'dreamer',
      stealLock: false,
    });
  });

  it('uses production by default and accepts only the Test Store alternative', () => {
    expect(parseArgs(['--profile', TESTSTORE_BUILD_PROFILE])).toEqual({
      abi: null,
      device: null,
      install: false,
      profileable: false,
      profile: TESTSTORE_BUILD_PROFILE,
      reuseNativeProject: false,
      sideBySideQa: false,
      lockOwner: 'dreamer',
      stealLock: false,
    });
    expect(normalizeBuildProfile(RELEASE_BUILD_PROFILE)).toBe(
      RELEASE_BUILD_PROFILE
    );
    expect(() => normalizeBuildProfile('preview')).toThrow(
      'Unsupported build profile'
    );
  });

  it('keeps profileable Release builds explicit and production-like', () => {
    expect(parseArgs(['--profileable', '--reuse-native-project'])).toEqual({
      abi: null,
      device: null,
      install: false,
      profileable: true,
      profile: RELEASE_BUILD_PROFILE,
      reuseNativeProject: true,
      sideBySideQa: false,
      lockOwner: 'dreamer',
      stealLock: false,
    });
    expect(() =>
      assertProfileableBuildProfile(RELEASE_BUILD_PROFILE, true)
    ).not.toThrow();
    expect(() =>
      assertProfileableBuildProfile(TESTSTORE_BUILD_PROFILE, true)
    ).toThrow('only with the production-apk profile');
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
      EXPO_PUBLIC_PERFORMANCE_TRACING: 'false',
      NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE: 'true',
      NOCTALIA_ANDROID_PERFORMANCE_PROFILEABLE: 'false',
    });
  });

  it('enables profileability without making the production bundle debuggable', () => {
    expect(
      getBuildEnv(
        {},
        '/tmp',
        { NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE: 'false' },
        RELEASE_BUILD_PROFILE,
        true
      )
    ).toMatchObject({
      NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE: 'false',
      EXPO_PUBLIC_PERFORMANCE_TRACING: 'true',
      NOCTALIA_ANDROID_PERFORMANCE_PROFILEABLE: 'true',
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
      NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE: 'false',
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
      NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE: 'true',
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
    expect(getOutputApkPath('/repo', RELEASE_BUILD_PROFILE, true)).toBe(
      path.join(
        '/repo',
        'dist',
        'android',
        'production-apk-profileable-release.apk'
      )
    );
  });

  it('fails closed when a reusable native project lacks profileable support', () => {
    const existsSync = jest.fn(() => true);
    expect(() =>
      assertReusableNativeProject(
        '/repo',
        true,
        existsSync,
        () => 'android { buildTypes { release {} } }'
      )
    ).toThrow('lacks the profileable Release configuration');
    expect(() =>
      assertReusableNativeProject(
        '/repo',
        true,
        existsSync,
        () => 'profileable isAndroidPerformanceProfileableBuild'
      )
    ).not.toThrow();
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

  it('parses an explicit side-by-side QA flag', () => {
    expect(parseArgs(['--side-by-side-qa'])).toEqual({
      abi: null,
      device: null,
      install: false,
      profileable: false,
      profile: RELEASE_BUILD_PROFILE,
      reuseNativeProject: false,
      sideBySideQa: true,
      lockOwner: 'dreamer',
      stealLock: false,
    });
    expect(parseArgs(['--side-by-side-qa', '--profileable', '--install'])).toEqual({
      abi: null,
      device: null,
      install: true,
      profileable: true,
      profile: RELEASE_BUILD_PROFILE,
      reuseNativeProject: false,
      sideBySideQa: true,
      lockOwner: 'dreamer',
      stealLock: false,
    });
  });

  it('keeps side-by-side QA on the production-apk profile only', () => {
    expect(() =>
      assertSideBySideQaProfile(RELEASE_BUILD_PROFILE, true)
    ).not.toThrow();
    expect(() =>
      assertSideBySideQaProfile(TESTSTORE_BUILD_PROFILE, true)
    ).toThrow('only with the production-apk profile');
  });

  it('sets the native QA marker only for side-by-side builds', () => {
    expect(
      getBuildEnv({}, '/tmp', {}, RELEASE_BUILD_PROFILE, false, true)
    ).toMatchObject({
      [DREAMER_QA_BUILD_ENV]: '1',
      EXPO_PUBLIC_MOCK_MODE: 'false',
      EXPO_PUBLIC_SUBSCRIPTION_QA_LAB: 'false',
    });
    expect(
      getBuildEnv(
        { [DREAMER_QA_BUILD_ENV]: '1' },
        '/tmp',
        {},
        RELEASE_BUILD_PROFILE
      )
    ).not.toHaveProperty(DREAMER_QA_BUILD_ENV);
    expect(() =>
      getBuildEnv(
        { NOCTALIA_APP_VARIANT: 'lucid', EXPO_PUBLIC_APP_VARIANT: 'lucid' },
        '/tmp',
        {},
        RELEASE_BUILD_PROFILE,
        false,
        true
      )
    ).toThrow('cannot be combined with Lucid Trainer');
  });

  it('emits a distinct QA APK path, including profileable builds', () => {
    expect(getOutputApkPath('/repo', RELEASE_BUILD_PROFILE, false, true)).toBe(
      path.join('/repo', 'dist', 'android', 'production-apk-qa-release.apk')
    );
    expect(getOutputApkPath('/repo', RELEASE_BUILD_PROFILE, true, true)).toBe(
      path.join(
        '/repo',
        'dist',
        'android',
        'production-apk-qa-profileable-release.apk'
      )
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

  it('parses APK application ids from aapt and apkanalyzer output', () => {
    expect(
      parseApkApplicationId("package: name='com.tanuki75.noctalia.qa' versionCode='54'")
    ).toBe(DREAMER_QA_ANDROID_PACKAGE);
    expect(parseApkApplicationId('com.tanuki75.noctalia.qa\n')).toBe(
      DREAMER_QA_ANDROID_PACKAGE
    );
    expect(() => parseApkApplicationId('not-an-id')).toThrow(
      'Unable to parse APK applicationId'
    );
  });

  it('inspects APK identity through mocked Android tooling', () => {
    const spawn = jest.fn(() => ({
      status: 0,
      stdout: "package: name='com.tanuki75.noctalia.qa' versionCode='54'\n",
      stderr: '',
    }));
    const resolveCommandFn = jest.fn((command) =>
      command === 'aapt' ? '/sdk/build-tools/aapt' : null
    );

    expect(
      inspectApkApplicationId('/repo/dist/android/production-apk-qa-release.apk', {
        spawn,
        resolveCommandFn,
        existsSync: () => false,
      })
    ).toBe(DREAMER_QA_ANDROID_PACKAGE);
    expect(spawn).toHaveBeenCalledWith(
      '/sdk/build-tools/aapt',
      ['dump', 'badging', '/repo/dist/android/production-apk-qa-release.apk'],
      expect.objectContaining({ encoding: 'utf8' })
    );

    spawn.mockImplementation(() => ({
      status: 0,
      stdout: 'com.tanuki75.noctalia.qa\n',
      stderr: '',
    }));
    resolveCommandFn.mockImplementation((command) =>
      command === 'apkanalyzer' ? 'apkanalyzer' : null
    );
    expect(
      inspectApkApplicationId('/repo/app.apk', {
        spawn,
        resolveCommandFn,
        existsSync: () => false,
      })
    ).toBe(DREAMER_QA_ANDROID_PACKAGE);
    expect(spawn).toHaveBeenLastCalledWith(
      'apkanalyzer',
      ['manifest', 'application-id', '/repo/app.apk'],
      expect.objectContaining({ encoding: 'utf8' })
    );
  });

  it('refuses install when the QA flag and APK package disagree', () => {
    expect(
      assertInstallableApkIdentity(DREAMER_QA_ANDROID_PACKAGE, true)
    ).toBe(DREAMER_QA_ANDROID_PACKAGE);
    expect(() =>
      assertInstallableApkIdentity(PRODUCTION_ANDROID_PACKAGE, true)
    ).toThrow('side-by-side QA requires com.tanuki75.noctalia.qa');
    expect(() =>
      assertInstallableApkIdentity(DREAMER_QA_ANDROID_PACKAGE, false)
    ).toThrow('without --side-by-side-qa');
    expect(
      assertInstallableApkIdentity(PRODUCTION_ANDROID_PACKAGE, false, {
        install: true,
        device: 'emulator-5554',
        profile: RELEASE_BUILD_PROFILE,
      })
    ).toBe(PRODUCTION_ANDROID_PACKAGE);
  });

  it('inspects APK identity before every install and for QA builds', () => {
    expect(shouldInspectApkIdentity(parseArgs(['--install']))).toBe(true);
    expect(shouldInspectApkIdentity(parseArgs(['--side-by-side-qa']))).toBe(true);
    expect(
      shouldInspectApkIdentity(parseArgs(['--reuse-native-project', '--install']))
    ).toBe(true);
    expect(shouldInspectApkIdentity(parseArgs(['--abi', 'arm64-v8a']))).toBe(false);

    expect(
      guardReleaseApkIdentity(PRODUCTION_ANDROID_PACKAGE, {
        ...parseArgs(['--install', '--device', 'emulator-5554']),
      })
    ).toBe(PRODUCTION_ANDROID_PACKAGE);
    expect(
      guardReleaseApkIdentity(
        DREAMER_QA_ANDROID_PACKAGE,
        parseArgs(['--side-by-side-qa'])
      )
    ).toBe(DREAMER_QA_ANDROID_PACKAGE);
    expect(guardReleaseApkIdentity(DREAMER_QA_ANDROID_PACKAGE, parseArgs([]))).toBe(
      null
    );
  });

  it('refuses a stale QA APK on --reuse-native-project --install before ADB', () => {
    const adbInstall = jest.fn();
    const options = parseArgs(['--reuse-native-project', '--install']);

    expect(shouldInspectApkIdentity(options)).toBe(true);
    expect(() =>
      guardReleaseApkIdentity(DREAMER_QA_ANDROID_PACKAGE, options)
    ).toThrow('without --side-by-side-qa');
    expect(adbInstall).not.toHaveBeenCalled();
  });

  it('refuses the production Store package on a physical device without the QA flag', () => {
    const adbInstall = jest.fn();
    const physicalInstall = parseArgs(['--install', '--device', '57275d36']);

    expect(() =>
      guardReleaseApkIdentity(PRODUCTION_ANDROID_PACKAGE, physicalInstall)
    ).toThrow('on a physical device');
    expect(adbInstall).not.toHaveBeenCalled();

    expect(
      guardReleaseApkIdentity(PRODUCTION_ANDROID_PACKAGE, {
        ...parseArgs(['--install', '--device', 'emulator-5554']),
      })
    ).toBe(PRODUCTION_ANDROID_PACKAGE);

    expect(
      guardReleaseApkIdentity(DREAMER_QA_ANDROID_PACKAGE, {
        ...parseArgs(['--side-by-side-qa', '--install', '--device', '57275d36']),
      })
    ).toBe(DREAMER_QA_ANDROID_PACKAGE);

    expect(() =>
      assertTestStoreInstallTarget(TESTSTORE_BUILD_PROFILE, true, '57275d36')
    ).toThrow('emulator-only');
  });

  it('locks a physical install and skips emulator or build-only runs', () => {
    expect(prepareInstallDeviceLocks(parseArgs(['--abi', 'arm64-v8a']), null))
      .toEqual({ locks: [], skipped: 'no-install' });
    expect(prepareInstallDeviceLocks(
      parseArgs(['--install', '--device', 'emulator-5554']),
      'emulator-5554'
    )).toEqual({ locks: [], skipped: 'emulator-only' });

    expect(() => prepareInstallDeviceLocks(
      parseArgs(['--install']),
      '192.168.1.176:40537'
    )).toThrow('explicit --device');

    expect(parseArgs(['--install', '--lock-owner', 'meditation', '--steal-lock'])).toMatchObject({
      install: true,
      lockOwner: 'meditation',
      stealLock: true,
    });
  });
});
