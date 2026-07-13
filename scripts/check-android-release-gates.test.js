/* global __dirname, describe, it, expect */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  checkAndroidReleaseGates,
  formatReport,
  parseDotEnv,
} = require('./check-android-release-gates');
const {
  VOICE_ANALYSIS_FLOW,
  writeVoiceAnalysisEvidence,
} = require('./android-voice-analysis-evidence');

const SCRIPT = path.join(__dirname, 'check-android-release-gates.js');

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
      NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE: 'false',
    },
  };
  return {
    build: {
      preview: profile,
      release: profile,
      'production-apk': profile,
      production: profile,
      'revenuecat-teststore': {
        env: {
          NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE: 'true',
        },
      },
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

function setupFixture({ versionCode = 33 } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'android-gates-'));
  writeJson(root, 'app.json', {
    expo: {
      version: '2.0.2',
      android: {
        package: 'com.tanuki75.noctalia',
        versionCode,
      },
    },
  });
  writeJson(root, 'eas.json', validEasJson());
  writeFile(root, '.env.teststore', validEnv());
  writeFile(root, 'maestro/recording-text-fallback.yml', 'appId: com.tanuki75.noctalia\n');
  writeFile(
    root,
    'scripts/run-maestro-android.js',
    [
      `const flows = ['maestro/recording-text-fallback.yml', '${VOICE_ANALYSIS_FLOW}'];`,
      "const suites = { 'release-voice-analysis': ['maestro/release-auth-voice-analysis.yml'] };",
      'invalidateVoiceAnalysisEvidence();',
      'writeVoiceAnalysisEvidence();',
      '',
    ].join('\n')
  );
  writeFile(
    root,
    VOICE_ANALYSIS_FLOW,
    [
      'appId: com.tanuki75.noctalia',
      '---',
      '- tapOn:',
      '    id: btn.recordToggle',
      '- assertVisible: forest|moon',
      '- assertVisible: fox|door',
      '- tapOn:',
      '    id: btn.saveDream',
      '- assertVisible:',
      '    id: component.transcriptCard',
      '- assertVisible: Interpretation|Interprétation',
      '- tapOn:',
      '    id: btn.auth.signOut',
      '',
    ].join('\n')
  );
  writeJson(root, 'package.json', {
    scripts: {
      'test:e2e:release:voice-analysis:local':
        'node scripts/run-maestro-android.js --suite release-voice-analysis --no-start-metro',
    },
  });
  writeFile(
    root,
    '.eas/workflows/android-release-qualification.yml',
    [
      'on:',
      '  push:',
      '    tags:',
      '      - v*',
      'jobs:',
      '  build_android:',
      '    type: build',
      '    params:',
      '      profile: production-apk',
      '  smoke_android:',
      '    type: maestro',
      '    params:',
      '      build_id: ${{ needs.build_android.outputs.build_id }}',
      '      flow_path: maestro/release-smoke.yml',
      '',
    ].join('\n')
  );
  writeVoiceAnalysisEvidence({
    rootDir: root,
    buildIdentity: {
      packageName: 'com.tanuki75.noctalia',
      versionName: '2.0.2',
      versionCode,
    },
    targetKind: 'emulator',
  });
  return root;
}

function writeGooglePlayTrackSnapshot(root, versionCode, status = 'completed') {
  writeJson(root, 'doc_web_interne/docs/google-play-track-state.local.json', {
    package_name: 'com.tanuki75.noctalia',
    track: 'internal',
    expected_version_code: String(versionCode),
    expected_status: 'completed',
    releases: [
      {
        name: `candidate-${versionCode}`,
        status,
        version_codes: [String(versionCode)],
      },
    ],
  });
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

function writeGoogleOAuthAndroidClientSnapshot(root, overrides = {}) {
  writeJson(root, 'doc_web_interne/docs/google-oauth-android-client-state.local.json', {
    client_id: '359653779023-5dhs012rh7l3cjf0leoknn7j0dlgq0ok.apps.googleusercontent.com',
    name: 'Noctalia Android Production',
    package_name: 'com.tanuki75.noctalia',
    sha1: 'BC:CF:C2:96:38:47:81:D6:8C:B7:B6:5A:BA:84:CB:B3:8C:85:E0:59',
    checked_at: '2026-05-14T12:00:00.000Z',
    source: 'test',
    ...overrides,
  });
}

function writeSupabasePlayIntegritySecretsSnapshot(root, overrides = {}) {
  writeJson(root, 'doc_web_interne/docs/supabase-play-integrity-secrets-state.local.json', {
    checked_at: '2026-05-14T21:30:00.000Z',
    source: 'test',
    project_ref: 'usuyppgsmmowzizhaoqj',
    secrets: {
      PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64: {
        label: 'Play Integrity service account JSON',
        status: 'present',
      },
      PLAY_INTEGRITY_PACKAGE_NAME: {
        label: 'Play Integrity package name',
        status: 'present',
        value: 'com.tanuki75.noctalia',
      },
      GUEST_SESSION_SECRET: {
        label: 'Guest session signing secret',
        status: 'present',
      },
    },
    ...overrides,
  });
}

describe('android release gate preflight', () => {
  function spawnWithTools({
    subscriptionGateStatus = 0,
    subscriptionReportStatus = 0,
    adbDevices = true,
    adbMdnsStdout = 'List of discovered mdns services\n',
    adbUsbStdout = '',
  } = {}) {
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
      if (command === 'adb' && args[0] === 'mdns') {
        return { status: 0, stdout: adbMdnsStdout, stderr: '' };
      }
      if (command === 'ioreg') {
        return { status: 0, stdout: adbUsbStdout, stderr: '' };
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
      if (/^npm(\.cmd)?$/.test(command) && args.join(' ') === 'run subscription:qa:report') {
        return {
          status: subscriptionReportStatus,
          stdout:
            subscriptionReportStatus === 0
              ? 'Subscription local/config checks passed.\n'
              : 'Blocked checks: 1\n',
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

  it('documents the two-phase prebuild and qualification modes', () => {
    const result = spawnSync(process.execPath, [SCRIPT, '--help'], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--prebuild');
    expect(result.stdout).toContain('defer candidate Play evidence and track readiness');
  });

  it('lets prebuild create a candidate before Play evidence exists', () => {
    const root = setupFixture({ versionCode: 41 });
    writeGooglePlayTrackSnapshot(root, 40);
    const calls = [];
    const baseSpawn = spawnWithTools({
      subscriptionGateStatus: 1,
      subscriptionReportStatus: 0,
    });
    const spawn = (command, args, options) => {
      calls.push([command, ...args]);
      return baseSpawn(command, args, options);
    };

    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn,
      phase: 'prebuild',
    });

    expect(report.ok).toBe(true);
    expect(report.phase).toBe('prebuild');
    expect(calls.some((call) => call.slice(1).join(' ') === 'run subscription:qa:report')).toBe(true);
    expect(
      calls.some((call) => call.slice(1).join(' ') === 'run subscription:qa:release-gate')
    ).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'manual' &&
          check.title === 'Google Play internal track release' &&
          check.details.includes('versionCode 41')
      )
    ).toBe(true);
    expect(formatReport(report)).toContain('Android release prebuild gate');
  });

  it('keeps prebuild fail-closed when subscription wiring checks fail', () => {
    const root = setupFixture();
    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn: spawnWithTools({ subscriptionReportStatus: 1 }),
      phase: 'prebuild',
    });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'fail' &&
          check.title === 'RevenueCat subscription QA prebuild wiring gate'
      )
    ).toBe(true);
  });

  it('fails prebuild when the Release build-to-smoke workflow is missing', () => {
    const root = setupFixture();
    fs.rmSync(path.join(root, '.eas/workflows/android-release-qualification.yml'));

    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn: spawnWithTools(),
      phase: 'prebuild',
    });

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'fail',
          title: 'EAS Android Release build and smoke workflow',
        }),
      ])
    );
  });

  it('passes prebuild local config checks without requiring Play-installed purchase evidence', () => {
    const root = setupFixture();
    const spawn = spawnWithTools();

    const report = checkAndroidReleaseGates({ rootDir: root, spawn, phase: 'prebuild' });

    expect(report.ok).toBe(true);
    expect(report.counts.fail || 0).toBe(0);
    expect(report.counts.blocked || 0).toBe(0);
    expect(report.checks.some((check) => check.title === 'Play payments profile for Billing')).toBe(true);
    expect(report.checks.some((check) => check.title === 'Supabase Play Integrity secrets')).toBe(true);
    expect(
      report.checks.some(
        (check) =>
          check.title === 'Play App Signing SHA-1 for Google OAuth' &&
          check.details.includes('BC:CF:C2:96:38:47:81:D6:8C:B7:B6:5A:BA:84:CB:B3:8C:85:E0:59') &&
          check.remediation.includes('Android OAuth client')
      )
    ).toBe(true);
    expect(report.checks.some((check) => check.title === 'Play-installed RevenueCat purchase and restore')).toBe(false);
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

  it('blocks a completed Play track snapshot for an older version than the app.json candidate', () => {
    const root = setupFixture({ versionCode: 41 });
    writeGooglePlayTrackSnapshot(root, 40);

    const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'blocked' &&
          check.title === 'Google Play internal track release' &&
          check.details.includes('internal/missing/41')
      )
    ).toBe(true);
  });

  it('keeps strict qualification blocked when the candidate Play track snapshot is missing', () => {
    const root = setupFixture({ versionCode: 41 });

    const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'blocked' &&
          check.title === 'Google Play internal track release' &&
          check.details.includes('has not been recorded for candidate versionCode 41')
      )
    ).toBe(true);
  });

  it('passes Play track readiness for the app.json candidate versionCode', () => {
    const root = setupFixture({ versionCode: 41 });
    writeGooglePlayTrackSnapshot(root, 41);

    const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

    expect(
      report.checks.some(
        (check) =>
          check.status === 'pass' &&
          check.title === 'Google Play internal track release' &&
          check.details.includes('internal/candidate-41/completed/versionCode=41')
      )
    ).toBe(true);
  });

  it('passes the Play App Signing OAuth SHA check from a local snapshot', () => {
    const root = setupFixture();
    writeGoogleOAuthAndroidClientSnapshot(root);

    const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

    expect(
      report.checks.some(
        (check) =>
          check.status === 'pass' &&
          check.title === 'Play App Signing SHA-1 for Google OAuth' &&
          check.details.includes('359653779023-5dhs012rh7l3cjf0leoknn7j0dlgq0ok') &&
          check.details.includes('BC:CF:C2:96:38:47:81:D6:8C:B7:B6:5A:BA:84:CB:B3:8C:85:E0:59')
      )
    ).toBe(true);
  });

  it('passes the Supabase Play Integrity secrets check from a local snapshot', () => {
    const root = setupFixture();
    writeSupabasePlayIntegritySecretsSnapshot(root);

    const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

    expect(
      report.checks.some(
        (check) =>
          check.status === 'pass' &&
          check.title === 'Supabase Play Integrity secrets' &&
          check.details.includes('Required Supabase Play Integrity secrets are present')
      )
    ).toBe(true);
  });

  it('blocks the Supabase Play Integrity secrets check when a required secret is missing', () => {
    const root = setupFixture();
    writeSupabasePlayIntegritySecretsSnapshot(root, {
      secrets: {
        PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64: {
          label: 'Play Integrity service account JSON',
          status: 'missing',
        },
        PLAY_INTEGRITY_PACKAGE_NAME: {
          label: 'Play Integrity package name',
          status: 'present',
          value: 'com.example.other',
        },
        GUEST_SESSION_SECRET: {
          label: 'Guest session signing secret',
          status: 'present',
        },
      },
    });

    const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'blocked' &&
          check.title === 'Supabase Play Integrity secrets' &&
          check.details.includes('PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64/missing') &&
          check.details.includes('PLAY_INTEGRITY_PACKAGE_NAME/value=com.example.other')
      )
    ).toBe(true);
  });

  it('blocks the Play App Signing OAuth SHA check when the snapshot disagrees', () => {
    const root = setupFixture();
    writeGoogleOAuthAndroidClientSnapshot(root, { sha1: 'AA:BB' });

    const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'blocked' &&
          check.title === 'Play App Signing SHA-1 for Google OAuth' &&
          check.details.includes('expected BC:CF:C2:96')
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
          check.details.includes('4 manual or external gate(s) still require evidence') &&
          check.remediation.includes('remaining evidence gates listed in the report')
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

  it('surfaces wireless debugging services when adb has no ready device', () => {
    const root = setupFixture();
    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn: spawnWithTools({
        adbDevices: false,
        adbMdnsStdout:
          'List of discovered mdns services\nadb-123._adb-tls-pairing._tcp.\t_adb-tls-pairing._tcp.\t192.168.1.24:37123\n',
        adbUsbStdout: '"USB Product Name" = "POCO F8 Ultra"\n"USB Vendor Name" = "Xiaomi"\n',
      }),
      platform: 'darwin',
    });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'blocked' &&
          check.title === 'Android ADB device visibility' &&
          check.details.includes('USB visible') &&
          check.details.includes('wireless debugging is visible') &&
          check.details.includes('192.168.1.24:37123') &&
          check.remediation.includes('adb pair')
      )
    ).toBe(true);
  });

  it('surfaces missing USB and missing wireless diagnostics when no adb device is ready', () => {
    const root = setupFixture();
    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn: spawnWithTools({
        adbDevices: false,
      }),
      platform: 'darwin',
    });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'blocked' &&
          check.title === 'Android ADB device visibility' &&
          check.details.includes('USB not visible') &&
          check.details.includes('ADB mDNS does not show wireless debugging services')
      )
    ).toBe(true);
  });

  it('prioritizes USB debugging authorization when macOS sees a phone but adb has no ready device', () => {
    const root = setupFixture();
    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn: spawnWithTools({
        adbDevices: false,
        adbUsbStdout: '"USB Product Name" = "POCO F8 Ultra"\n"USB Vendor Name" = "Xiaomi"\n',
      }),
      platform: 'darwin',
    });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'blocked' &&
          check.title === 'Android ADB device visibility' &&
          check.details.includes('USB visible') &&
          check.remediation.includes('accept the RSA fingerprint prompt') &&
          check.remediation.includes('revoke USB debugging authorizations')
      )
    ).toBe(true);
  });

  it('does not treat emulator mDNS as phone wireless debugging', () => {
    const root = setupFixture();
    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn: spawnWithTools({
        adbDevices: false,
        adbMdnsStdout:
          'List of discovered mdns services\nadb-EMULATOR36X5X11X0\t_adb._tcp\t10.0.2.16:5555\n',
      }),
      platform: 'darwin',
    });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'blocked' &&
          check.title === 'Android ADB device visibility' &&
          check.details.includes('ADB mDNS only sees 1 emulator service') &&
          !check.details.includes('wireless debugging is visible') &&
          check.remediation.includes('emulator mDNS services are ignored')
      )
    ).toBe(true);
  });

  it('uses adb from the standard macOS Android SDK location when PATH misses it', () => {
    const root = setupFixture();
    writeGooglePlayTrackSnapshot(root, 33);
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
    writeGooglePlayTrackSnapshot(root, 33);
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

  it('fails when Test Store debuggability is not isolated from Play profiles', () => {
    const root = setupFixture();
    const eas = validEasJson();
    eas.build.preview = {
      env: {
        ...eas.build.preview.env,
        NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE: 'true',
      },
    };
    writeJson(root, 'eas.json', eas);

    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn: spawnWithTools(),
    });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'fail' &&
          check.title === 'RevenueCat Test Store debuggability isolated in EAS profiles' &&
          check.details.includes('preview')
      )
    ).toBe(true);
  });

  it('fails when the Test Store profile is not explicitly debuggable', () => {
    const root = setupFixture();
    const eas = validEasJson();
    delete eas.build['revenuecat-teststore'].env.NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE;
    writeJson(root, 'eas.json', eas);

    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn: spawnWithTools(),
    });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'fail' &&
          check.title === 'RevenueCat Test Store debuggability isolated in EAS profiles' &&
          check.details.includes('revenuecat-teststore')
      )
    ).toBe(true);
  });
});
