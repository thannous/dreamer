const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  checkAndroidReleaseGates,
  formatReport,
  parseDotEnv,
} = require('./check-android-release-gates');

function writeJson(root, relativePath, value) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function writeFile(root, relativePath, value) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function validEasJson() {
  const profile = {
    env: {
      EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER: '359653779023',
    },
  };
  return {
    build: {
      preview: profile,
      release: profile,
      'production-apk': profile,
      production: profile,
    },
    submit: {
      internal: {
        android: {
          track: 'internal',
        },
      },
    },
  };
}

function validEnv() {
  return [
    'EXPO_PUBLIC_API_URL=https://example.test/api',
    'EXPO_PUBLIC_SUPABASE_URL=https://example.test',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_test',
    'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=test_key',
    'EXPO_PUBLIC_ANALYTICS_DEBUG=false',
    'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=web.apps.googleusercontent.com',
    'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=android.apps.googleusercontent.com',
    'EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER=359653779023',
  ].join('\n');
}

function setupFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'android-gates-'));
  writeJson(root, 'eas.json', validEasJson());
  writeFile(root, '.env.teststore', validEnv());
  writeFile(root, 'maestro/recording-text-fallback.yml', 'appId: com.tanuki75.noctalia\n');
  writeFile(
    root,
    'scripts/run-maestro-android.js',
    "const flows = ['maestro/recording-text-fallback.yml'];\n"
  );
  return root;
}

function writeGoogleCloudProjectSnapshot(root, overrides = {}) {
  writeJson(root, 'doc_web_interne/docs/google-cloud-project-state.local.json', {
    project_number: '359653779023',
    project_id: 'gen-lang-client-0336445544',
    name: 'dreamweaver',
    lifecycle_state: 'ACTIVE',
    checked_at: '2026-05-14T12:00:00.000Z',
    source: 'test',
    ...overrides,
  });
}

describe('android release gate preflight', () => {
  function spawnWithTools({ subscriptionGateStatus = 0, adbDevices = true } = {}) {
    return (command, args) => {
      if (command === 'which' && args[0] === 'adb') return { status: 0 };
      if (command === 'which' && args[0] === 'maestro') return { status: 0 };
      if (command === 'adb' && args[0] === 'devices') {
        return {
          status: 0,
          stdout: adbDevices
            ? 'List of devices attached\nemulator-5554\tdevice\n'
            : 'List of devices attached\n',
        };
      }
      if (/^npm(\.cmd)?$/.test(command) && args.join(' ') === 'run subscription:qa:release-gate') {
        return {
          status: subscriptionGateStatus,
          stdout:
            subscriptionGateStatus === 0
              ? 'Full RevenueCat workflow is complete.\n'
              : 'Manual or external gates remaining: 4\nFull RevenueCat workflow is not complete: 4 manual or external gate(s) still require evidence.\n',
          stderr: '',
        };
      }
      return { status: 1, stdout: '', stderr: '' };
    };
  }

  it('parses dotenv values without exposing comments or quotes', () => {
    expect(parseDotEnv("A=one\n# nope\nB='two'\nC=\"three\"")).toEqual({
      A: 'one',
      B: 'two',
      C: 'three',
    });
  });

  it('passes local config checks and keeps manual gates non-fatal', () => {
    const root = setupFixture();
    const spawn = spawnWithTools();

    const report = checkAndroidReleaseGates({ rootDir: root, spawn });

    expect(report.ok).toBe(true);
    expect(report.counts.fail || 0).toBe(0);
    expect(report.counts.blocked || 0).toBe(0);
    expect(report.counts.manual).toBeGreaterThan(0);
    expect(report.checks.some((check) => check.title === 'Play payments profile for Billing')).toBe(true);
    expect(
      report.checks.some(
        (check) =>
          check.title === 'Play App Signing SHA-1 for Google OAuth' &&
          check.details.includes('BC:CF:C2:96:38:47:81:D6:8C:B7:B6:5A:BA:84:CB:B3:8C:85:E0:59') &&
          check.remediation.includes('Android OAuth client')
      )
    ).toBe(true);
    expect(
      report.checks.some(
        (check) =>
          check.title === 'Play-installed RevenueCat purchase and restore' &&
          check.details.includes('physical Android device') &&
          check.details.includes('installerPackageName=com.android.vending') &&
          check.remediation.includes('android:device:physical') &&
          check.remediation.includes('android:play-install-source')
      )
    ).toBe(true);
  });

  it('passes the Google Cloud project number check from a local snapshot', () => {
    const root = setupFixture();
    writeGoogleCloudProjectSnapshot(root);

    const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

    expect(
      report.checks.some(
        (check) =>
          check.status === 'pass' &&
          check.title === 'Google Cloud project number confirmation' &&
          check.details.includes('359653779023 -> gen-lang-client-0336445544/ACTIVE')
      )
    ).toBe(true);
  });

  it('blocks the Google Cloud project number check when the snapshot disagrees with env', () => {
    const root = setupFixture();
    writeGoogleCloudProjectSnapshot(root, { project_number: '000000000000' });

    const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'blocked' &&
          check.title === 'Google Cloud project number confirmation' &&
          check.details.includes('does not match')
      )
    ).toBe(true);
  });

  it('fails when the RevenueCat subscription release gate is still red', () => {
    const root = setupFixture();
    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn: spawnWithTools({ subscriptionGateStatus: 1 }),
    });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'fail' &&
          check.title === 'RevenueCat subscription QA release gate' &&
          check.details.includes('4 manual or external gate(s) still require evidence')
      )
    ).toBe(true);
  });

  it('blocks when Android CLI tooling is unavailable', () => {
    const root = setupFixture();
    const spawn = () => ({ status: 1, stdout: '', stderr: '' });

    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn,
      env: { HOME: path.join(root, 'missing-home') },
      existsSync: () => false,
    });

    expect(report.ok).toBe(false);
    expect(report.checks.some((check) => check.status === 'blocked' && check.title.includes('adb'))).toBe(true);
    expect(formatReport(report)).toContain('BLOCKED');
  });

  it('uses adb from the standard macOS Android SDK location when PATH misses it', () => {
    const root = setupFixture();
    const fakeHome = path.join(root, 'home');
    const adbPath = path.join(fakeHome, 'Library/Android/sdk/platform-tools/adb');
    writeFile(root, 'home/Library/Android/sdk/platform-tools/adb', '');
    const spawn = (command, args) => {
      if (command === 'which' && args[0] === 'adb') return { status: 1 };
      if (command === 'which' && args[0] === 'maestro') return { status: 0 };
      if (/^npm(\.cmd)?$/.test(command) && args.join(' ') === 'run subscription:qa:release-gate') {
        return { status: 0, stdout: 'ok\n', stderr: '' };
      }
      if (command === adbPath && args[0] === 'devices') {
        return {
          status: 0,
          stdout: 'List of devices attached\nemulator-5554\tdevice\n',
        };
      }
      return { status: 1, stdout: '', stderr: '' };
    };

    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn,
      env: { HOME: fakeHome },
    });

    expect(report.ok).toBe(true);
    expect(
      report.checks.some(
        (check) => check.status === 'pass' && check.details.includes(adbPath)
      )
    ).toBe(true);
  });

  it('uses Maestro from an explicit CLI path when PATH misses it', () => {
    const root = setupFixture();
    const maestroPath = path.join(root, 'maestro', 'bin', 'maestro');
    writeFile(root, 'maestro/bin/maestro', '');
    const spawn = (command, args) => {
      if (command === 'which' && args[0] === 'maestro') return { status: 1 };
      if (command === 'which' && args[0] === 'adb') return { status: 0 };
      if (/^npm(\.cmd)?$/.test(command) && args.join(' ') === 'run subscription:qa:release-gate') {
        return { status: 0, stdout: 'ok\n', stderr: '' };
      }
      if (command === 'adb' && args[0] === 'devices') {
        return {
          status: 0,
          stdout: 'List of devices attached\nemulator-5554\tdevice\n',
        };
      }
      return { status: 1, stdout: '', stderr: '' };
    };

    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn,
      env: { MAESTRO_CLI_PATH: maestroPath },
    });

    expect(report.ok).toBe(true);
    expect(
      report.checks.some(
        (check) => check.status === 'pass' && check.details.includes(maestroPath)
      )
    ).toBe(true);
  });

  it('fails when Play Integrity env is missing from an EAS profile', () => {
    const root = setupFixture();
    const eas = validEasJson();
    delete eas.build.production.env.EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER;
    writeJson(root, 'eas.json', eas);

    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn: spawnWithTools(),
    });

    expect(report.ok).toBe(false);
    expect(report.checks.some((check) => check.status === 'fail' && check.details.includes('production'))).toBe(true);
  });
});
