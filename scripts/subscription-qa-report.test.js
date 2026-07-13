/* global __dirname, describe, it, expect */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  createOverlayFileSystem,
  generateSubscriptionQaReport,
} = require('./subscription-qa-report');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/subscription-qa-report.js');
const ANDROID_CANDIDATE_VERSION_CODE = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')
).expo.android.versionCode;
const EXAMPLE = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'doc_web_interne/docs/revenuecat-qa-evidence.example.json'), 'utf8')
);
const ISOLATED_QA_ENV = {
  REVENUECAT_QA_SWITCH_FREE_EMAIL: '',
  REVENUECAT_QA_SWITCH_FREE_PASSWORD: '',
};

const MANUAL_GATE_KEYS = [
  'test_store_monthly',
  'test_store_annual',
  'restore_after_reinstall',
  'account_switch',
  'play_monthly',
  'play_annual',
  'play_cancellation_and_expiry',
];

const virtualFiles = {};
let virtualFileIndex = 0;

function playEvidenceFields(overrides = {}) {
  return {
    easBuildId: '310244ed-027b-4028-8522-70c0f676a0e9',
    deviceId: '57275d36',
    installerPackageName: 'com.android.vending',
    versionCode: ANDROID_CANDIDATE_VERSION_CODE,
    ...overrides,
  };
}

function evidenceForKey(key) {
  if (key === 'account_switch') {
    return 'paid account remains plus while second account remains free / inactive after logout and login';
  }
  if (key === 'play_monthly') {
    return 'play_monthly verified by manual QA after installed from Play (com.android.vending) with base plan P1M confirmed';
  }
  if (key === 'play_annual') {
    return 'play_annual verified by manual QA after installed from Play (com.android.vending) with base plan P1Y confirmed';
  }
  if (key === 'play_cancellation_and_expiry') {
    return 'play_cancellation_and_expiry verified by manual QA after installed from Play (com.android.vending); cancellation observed; RevenueCat webhook and backend state converged';
  }
  return `${key} verified by manual QA`;
}

function runReport(args = [], env = {}) {
  const result = generateSubscriptionQaReport({
    args,
    root: ROOT,
    env: {
      ...process.env,
      ...ISOLATED_QA_ENV,
      REVENUECAT_PLAY_STORE_STATE_PATH: path.join(os.tmpdir(), 'missing-revenuecat-play-store-state.local.json'),
      GOOGLE_PLAY_SUBSCRIPTION_STATE_PATH: path.join(os.tmpdir(), 'missing-google-play-subscription-state.local.json'),
      GOOGLE_PLAY_TRACK_STATE_PATH: path.join(os.tmpdir(), 'missing-google-play-track-state.local.json'),
      ...env,
    },
    fs: createOverlayFileSystem(virtualFiles),
    now: () => new Date('2026-01-01T00:00:00.000Z'),
  });
  return { status: result.exitCode, stdout: result.stdout, stderr: result.stderr };
}

function runCliReport(args = [], env = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    env: {
      ...process.env,
      ...ISOLATED_QA_ENV,
      REVENUECAT_PLAY_STORE_STATE_PATH: path.join(os.tmpdir(), 'missing-revenuecat-play-store-state.local.json'),
      GOOGLE_PLAY_SUBSCRIPTION_STATE_PATH: path.join(os.tmpdir(), 'missing-google-play-subscription-state.local.json'),
      GOOGLE_PLAY_TRACK_STATE_PATH: path.join(os.tmpdir(), 'missing-google-play-track-state.local.json'),
      ...env,
    },
    encoding: 'utf8',
  });
}

function writeVirtualFile(prefix, contents) {
  const filePath = path.join(os.tmpdir(), `${prefix}-${virtualFileIndex}.json`);
  virtualFileIndex += 1;
  virtualFiles[filePath] = contents;
  return filePath;
}

function writeEvidenceFile(gates) {
  const candidateBoundGates = Object.fromEntries(
    Object.entries(gates).map(([key, gate]) => [
      key,
      gate.status === 'passed' && !Object.prototype.hasOwnProperty.call(gate, 'versionCode')
        ? { ...gate, versionCode: ANDROID_CANDIDATE_VERSION_CODE }
        : gate,
    ])
  );
  return writeVirtualFile(
    'subscription-qa-evidence',
    JSON.stringify({ gates: candidateBoundGates }, null, 2)
  );
}

function writeInvalidEvidenceFile() {
  return writeVirtualFile('subscription-qa-evidence-invalid', '{ invalid json');
}

function writePlayStoreStateSnapshot(storeState, checkedAt = '2026-01-01T00:00:00.000Z') {
  return writeVirtualFile(
    'revenuecat-play-store-state',
    JSON.stringify(
      {
        project_id: 'proje6db7596',
        store_state: storeState,
        checked_at: checkedAt,
      },
      null,
      2
    )
  );
}

function writeInvalidPlayStoreStateSnapshot() {
  return writeVirtualFile('revenuecat-play-store-state-invalid', '{ invalid json');
}

function writeGooglePlaySubscriptionStateSnapshot(monthlyPlan = {}, annualPlan = {}) {
  return writeVirtualFile(
    'google-play-subscription-state',
    JSON.stringify(
      {
        package_name: 'com.tanuki75.noctalia',
        product_id: 'noctalia_plus',
        base_plans: {
          monthly: {
            state: 'ACTIVE',
            billing_period_duration: 'P1M',
            new_subscriber_availability: { US: true, FR: true },
            ...monthlyPlan,
          },
          annual: {
            state: 'ACTIVE',
            billing_period_duration: 'P1Y',
            new_subscriber_availability: { US: true, FR: true },
            ...annualPlan,
          },
        },
      },
      null,
      2
    )
  );
}

function writeInvalidGooglePlaySubscriptionStateSnapshot() {
  return writeVirtualFile('google-play-subscription-state-invalid', '{ invalid json');
}

function writeGooglePlayTrackStateSnapshot(versionCode, status = 'completed') {
  return writeVirtualFile(
    'google-play-track-state',
    JSON.stringify(
      {
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
      },
      null,
      2
    )
  );
}

describe('subscription QA report release gate', () => {
  it('keeps the full release gate blocked when manual evidence is missing', () => {
    const result = runCliReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: path.join(os.tmpdir(), 'missing-revenuecat-evidence.json'),
      REVENUECAT_QA_EMAIL: '',
      REVENUECAT_QA_PASSWORD: '',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('OK | EAS Play Store profiles use Google Play key');
    expect(result.stdout).toContain('preview:goog_B...sanw');
    expect(result.stdout).toContain('OK | Test Store purchase preflight exists');
    expect(result.stdout).toContain('npm run test:e2e:subscription-teststore:purchase:preflight');
    expect(result.stdout).toContain('OK | Authenticated Test Store paywall flow exists');
    expect(result.stdout).toContain('maestro/subscription-teststore-paywall-auth.yml');
    expect(result.stdout).toContain('| Automated | Authenticated Test Store paywall |');
    expect(result.stdout).toContain('without a transaction');
    expect(result.stdout).toContain('OK | Google Test Store purchase flow exists');
    expect(result.stdout).toContain('REVENUECAT_QA_AUTH=google -> maestro/subscription-teststore-purchase-google-manual.yml');
    expect(result.stdout).toContain('OK | Test Store restore flow exists');
    expect(result.stdout).toContain('guarded standalone Release restore runner');
    expect(result.stdout).toContain('OK | Test Store signout guard exists');
    expect(result.stdout).toContain('maestro/subscription-teststore-signout-guard.yml');
    expect(result.stdout).toContain('OK | Account switch email flow exists');
    expect(result.stdout).toContain('REVENUECAT_QA_SWITCH_FREE_EMAIL -> maestro/subscription-teststore-account-switch-free-email-manual.yml');
    expect(result.stdout).toContain('OK | Transactional Test Store flows use standalone Release');
    expect(result.stdout).toContain('purchase, restore and account-switch run from an installed Release bundle with Metro disabled');
    expect(result.stdout).toContain('OK | Local subscription QA verifier exists');
    expect(result.stdout).toContain('npm run subscription:qa:verify-local');
    expect(result.stdout).toContain('OK | Production APK build is gated by subscription QA');
    expect(result.stdout).toContain(
      'build:apk:prod preserves .env.local, disables dotenv, and runs android:gates:prebuild; android:gates:strict qualifies the candidate after Play upload'
    );
    expect(result.stdout).toContain('OK | RevenueCat device app user id extractor exists');
    expect(result.stdout).toContain('npm run subscription:qa:device-app-user-id');
    expect(result.stdout).toContain('OK | Android device diagnostic exists');
    expect(result.stdout).toContain('npm run android:device');
    expect(result.stdout).toContain('OK | Physical Android device diagnostic exists');
    expect(result.stdout).toContain('npm run android:device:physical');
    expect(result.stdout).toContain('OK | Play install source diagnostic exists');
    expect(result.stdout).toContain('npm run android:play-install-source -- --device <adb-id>');
    expect(result.stdout).toContain('OK | Play QA device preflight exists');
    expect(result.stdout).toContain('npm run android:play-qa-device -- --device <adb-id>');
    expect(result.stdout).toContain('OK | Play QA device wait helper exists');
    expect(result.stdout).toContain('npm run android:play-qa-device:wait');
    expect(result.stdout).toContain('## Current Session Readiness');
    expect(result.stdout).toContain('Test Store signed-in account env');
    expect(result.stdout).toContain('REVENUECAT_QA_EMAIL=missing, REVENUECAT_QA_PASSWORD=missing');
    expect(result.stdout).toContain('Account switch second account env');
    expect(result.stdout).toContain('REVENUECAT_QA_SWITCH_FREE_EMAIL=missing, REVENUECAT_QA_SWITCH_FREE_PASSWORD=missing');
    expect(result.stdout).toContain('Device app user id extraction');
    expect(result.stdout).toContain('Physical Android device visibility');
    expect(result.stdout).toContain('before recording play_monthly, play_annual, or play_cancellation_and_expiry evidence');
    expect(result.stdout).toContain('checks USB and ADB Wireless Debugging mDNS visibility');
    expect(result.stdout).toContain('Play QA device preflight');
    expect(result.stdout).toContain('npm run android:play-qa-device:wait while connecting one Play-installed tester phone');
    expect(result.stdout).toContain('add -- --device <adb-id> when multiple devices are ready');
    expect(result.stdout).toContain(
      'npm run android:play-qa-device:wait -- --device <adb-id> --expected-version-code <code> --require-ui-ready'
    );
    expect(result.stdout).toContain('after the device is ready');
    expect(result.stdout).toContain('Google Play monthly base plan snapshot');
    expect(result.stdout).toContain('Google Play annual base plan snapshot');
    expect(result.stdout).toContain('Run npm run subscription:qa:google-play-state');
    expect(result.stdout).toContain('Play monthly base plan snapshot');
    expect(result.stdout).toContain('Play annual base plan snapshot');
    expect(result.stdout).toContain('RevenueCat product prodfce10ef2a8 must expose billing period P1M');
    expect(result.stdout).toContain('OK | Play store state snapshot parses');
    expect(result.stdout).toContain('OK | Google OAuth Android client snapshot parses');
    expect(result.stdout).toContain('OK | Supabase Play Integrity secrets snapshot parses');
    expect(result.stdout).toContain('OK | Play store state snapshot updater exists');
    expect(result.stdout).toContain('npm run subscription:qa:play-state');
    expect(result.stdout).toContain('OK | Evidence template covers all release gates');
    expect(result.stdout).toContain('OK | Local evidence file is gitignored');
    expect(result.stdout).toContain('OK | Google Play subscription state snapshot is gitignored');
    expect(result.stdout).toContain('OK | Google Play subscription state updater exists');
    expect(result.stdout).toContain('npm run subscription:qa:google-play-state');
    expect(result.stdout).toContain('OK | Google OAuth Android client state updater exists');
    expect(result.stdout).toContain('npm run android:google-oauth-android-client-state');
    expect(result.stdout).toContain('OK | Supabase Play Integrity secrets state updater exists');
    expect(result.stdout).toContain('npm run android:supabase-play-integrity-secrets-state');
    expect(result.stdout).toContain('Supabase Play Integrity secrets snapshot');
    expect(result.stdout).toContain('Manual or external gates remaining: 7');
    expect(result.stdout).toContain('Offering packages and prices load without purchase');
    expect(result.stdout).toContain('maestro/subscription-teststore-restore-google-manual.yml plus structured evidence');
    expect(result.stdout).toContain('run test:e2e:subscription-teststore:account-switch with a second real email account');
    expect(result.stdout).toContain('## Evidence Commands');
    expect(result.stdout).toContain(
      `npm run subscription:qa:evidence -- --gate account_switch --tester <tester-email> --app-user-id <revenuecat-app-user-uuid> --version-code ${ANDROID_CANDIDATE_VERSION_CODE} --evidence "paid account remains plus while second account remains free / inactive after logout and login"`
    );
    expect(result.stdout).toContain(
      `npm run subscription:qa:evidence -- --gate play_monthly --tester <tester-email> --app-user-id <revenuecat-app-user-uuid> --version-code ${ANDROID_CANDIDATE_VERSION_CODE} --eas-build-id <eas-build-uuid> --device-id <physical-adb-id> --installer-package-name com.android.vending --evidence "Play monthly purchase completed after installed from Play (com.android.vending), product noctalia_plus:monthly, base plan P1M confirmed, backend converged"`
    );
    expect(result.stdout).toContain(
      `npm run subscription:qa:evidence -- --gate play_annual --tester <tester-email> --app-user-id <revenuecat-app-user-uuid> --version-code ${ANDROID_CANDIDATE_VERSION_CODE} --eas-build-id <eas-build-uuid> --device-id <physical-adb-id> --installer-package-name com.android.vending --evidence "Play annual purchase completed after installed from Play (com.android.vending), product noctalia_plus:annual, base plan P1Y confirmed, backend converged"`
    );
    expect(result.stdout).toContain(
      `npm run subscription:qa:evidence -- --gate play_cancellation_and_expiry --tester <tester-email> --app-user-id <revenuecat-app-user-uuid> --version-code ${ANDROID_CANDIDATE_VERSION_CODE} --eas-build-id <eas-build-uuid> --device-id <physical-adb-id> --installer-package-name com.android.vending --evidence "Play cancellation or expiry observed after installed from Play (com.android.vending), RevenueCat webhook and backend state converged"`
    );
    expect(result.stdout).toContain('Full RevenueCat workflow is not complete');
    expect(result.stderr).toBe('');
  });

  it('keeps the non-strict CLI contract successful while manual gates remain', () => {
    const result = runCliReport([], {
      REVENUECAT_QA_EVIDENCE_PATH: path.join(os.tmpdir(), 'missing-revenuecat-evidence.json'),
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('# Subscription QA Report');
    expect(result.stdout).toContain(
      '| OK | Subscription QA report CLIs are wired | npm run subscription:qa:report and npm run subscription:qa:release-gate |'
    );
    expect(result.stdout).toContain('Manual or external gates remaining: 7');
    expect(result.stdout).toContain('## Current Session Readiness');
    expect(result.stderr).toBe('');
  });

  it('marks Google auth ready with an email and no password', () => {
    const result = runReport([], {
      REVENUECAT_QA_AUTH: 'google',
      REVENUECAT_QA_EMAIL: 'tester@example.com',
      REVENUECAT_QA_PASSWORD: '',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      '| READY | Test Store signed-in account env | REVENUECAT_QA_AUTH=google, REVENUECAT_QA_EMAIL=set, REVENUECAT_QA_PASSWORD=missing |'
    );
  });

  it('keeps email auth missing until both email and password are present', () => {
    const missingPassword = runReport([], {
      REVENUECAT_QA_AUTH: 'email',
      REVENUECAT_QA_EMAIL: 'tester@example.com',
      REVENUECAT_QA_PASSWORD: '',
    });
    const completeCredentials = runReport([], {
      REVENUECAT_QA_AUTH: 'email',
      REVENUECAT_QA_EMAIL: 'tester@example.com',
      REVENUECAT_QA_PASSWORD: 'password',
    });

    expect(missingPassword.status).toBe(0);
    expect(missingPassword.stdout).toContain(
      '| MISSING | Test Store signed-in account env | REVENUECAT_QA_AUTH=email, REVENUECAT_QA_EMAIL=set, REVENUECAT_QA_PASSWORD=missing |'
    );
    expect(completeCredentials.stdout).toContain(
      '| READY | Test Store signed-in account env | REVENUECAT_QA_AUTH=email, REVENUECAT_QA_EMAIL=set, REVENUECAT_QA_PASSWORD=set |'
    );
  });

  it('keeps the full release gate blocked when the local evidence file is invalid JSON', () => {
    const evidencePath = writeInvalidEvidenceFile();
    const result = runReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('BLOCKED | Local evidence file parses');
    expect(result.stdout).toContain('Manual evidence: local file present');
    expect(result.stdout).toContain('Manual or external gates remaining: 7');
    expect(result.stderr).toBe('');
  });

  it('blocks on an invalid Play store state snapshot file', () => {
    const snapshotPath = writeInvalidPlayStoreStateSnapshot();
    const result = runReport([], {
      REVENUECAT_PLAY_STORE_STATE_PATH: snapshotPath,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('BLOCKED | Play store state snapshot parses');
    expect(result.stdout).toContain('Play monthly base plan snapshot');
    expect(result.stderr).toBe('');
  });

  it('blocks on an invalid Google Play subscription state snapshot file', () => {
    const snapshotPath = writeInvalidGooglePlaySubscriptionStateSnapshot();
    const result = runReport([], {
      GOOGLE_PLAY_SUBSCRIPTION_STATE_PATH: snapshotPath,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('BLOCKED | Google Play subscription state snapshot parses');
    expect(result.stdout).toContain('Google Play monthly base plan snapshot');
    expect(result.stdout).toContain('Google Play annual base plan snapshot');
    expect(result.stderr).toBe('');
  });

  it('surfaces direct Google Play monthly and annual snapshots that are ready', () => {
    const snapshotPath = writeGooglePlaySubscriptionStateSnapshot();
    const result = runReport([], {
      GOOGLE_PLAY_SUBSCRIPTION_STATE_PATH: snapshotPath,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Google Play subscription state snapshot: local file present');
    expect(result.stdout).toContain('READY | Google Play monthly base plan snapshot');
    expect(result.stdout).toContain('monthly/P1M/ACTIVE; expected monthly/P1M/ACTIVE with US+FR availability');
    expect(result.stdout).toContain('READY | Google Play annual base plan snapshot');
    expect(result.stdout).toContain('annual/P1Y/ACTIVE; expected annual/P1Y/ACTIVE with US+FR availability');
  });

  it('surfaces a direct Google Play monthly snapshot that is not P1M', () => {
    const snapshotPath = writeGooglePlaySubscriptionStateSnapshot({ billing_period_duration: 'P1Y' });
    const result = runReport([], {
      GOOGLE_PLAY_SUBSCRIPTION_STATE_PATH: snapshotPath,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('BLOCKED | Google Play monthly base plan snapshot');
    expect(result.stdout).toContain('monthly/P1Y/ACTIVE; expected monthly/P1M/ACTIVE with US+FR availability');
  });

  it('surfaces a direct Google Play annual snapshot that is not P1Y', () => {
    const snapshotPath = writeGooglePlaySubscriptionStateSnapshot({}, { billing_period_duration: 'P1M' });
    const result = runReport([], {
      GOOGLE_PLAY_SUBSCRIPTION_STATE_PATH: snapshotPath,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('BLOCKED | Google Play annual base plan snapshot');
    expect(result.stdout).toContain('annual/P1M/ACTIVE; expected annual/P1Y/ACTIVE with US+FR availability');
  });

  it('surfaces a Play monthly snapshot that still points at the annual base plan', () => {
    const snapshotPath = writePlayStoreStateSnapshot({
      prodfce10ef2a8: {
        store: 'play_store',
        status: 'ok',
        base_plans: [{ base_plan_id: 'annual', billing_period_duration: 'P1Y' }],
      },
      prod98337b31be: {
        store: 'play_store',
        status: 'ok',
        base_plans: [{ base_plan_id: 'annual', billing_period_duration: 'P1Y' }],
      },
    });
    const result = runReport([], {
      REVENUECAT_PLAY_STORE_STATE_PATH: snapshotPath,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Play Store state snapshot: local file present');
    expect(result.stdout).toContain('BLOCKED | Play monthly base plan snapshot');
    expect(result.stdout).toContain('prodfce10ef2a8: annual/P1Y; expected P1M');
    expect(result.stdout).toContain('READY | Play annual base plan snapshot');
    expect(result.stdout).toContain('prod98337b31be: annual/P1Y; expected P1Y');
  });

  it('accepts a Play monthly snapshot with a P1M base plan', () => {
    const snapshotPath = writePlayStoreStateSnapshot({
      prodfce10ef2a8: {
        store: 'play_store',
        status: 'ok',
        base_plans: [{ base_plan_id: 'monthly', billing_period_duration: 'P1M' }],
      },
    });
    const result = runReport([], {
      REVENUECAT_PLAY_STORE_STATE_PATH: snapshotPath,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('READY | Play monthly base plan snapshot');
    expect(result.stdout).toContain('prodfce10ef2a8: monthly/P1M; expected P1M');
  });

  it('blocks a Play annual snapshot that does not expose P1Y', () => {
    const snapshotPath = writePlayStoreStateSnapshot({
      prod98337b31be: {
        store: 'play_store',
        status: 'ok',
        base_plans: [{ base_plan_id: 'monthly', billing_period_duration: 'P1M' }],
      },
    });
    const result = runReport([], {
      REVENUECAT_PLAY_STORE_STATE_PATH: snapshotPath,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('BLOCKED | Play annual base plan snapshot');
    expect(result.stdout).toContain('prod98337b31be: monthly/P1M; expected P1Y');
  });

  it('passes the full release gate when every manual and external gate has evidence', () => {
    const gates = Object.fromEntries(
      MANUAL_GATE_KEYS.map((key) => [
        key,
        {
          status: 'passed',
          testedAt: '2026-05-09T12:00:00.000Z',
          tester: 'tester@example.com',
          appUserId: '00000000-0000-4000-8000-000000000000',
          evidence: evidenceForKey(key),
          ...(key.startsWith('play_') ? playEvidenceFields() : {}),
        },
      ])
    );
    const evidencePath = writeEvidenceFile(gates);

    const result = runReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Manual evidence: local file present');
    expect(result.stdout).toContain('Verified manual/external scenarios: 7');
    expect(result.stdout).toContain('Manual or external gates remaining: 0');
    expect(result.stdout).not.toContain('Full RevenueCat workflow is not complete');
  });

  it('redacts identities and device endpoints from rendered evidence', () => {
    const tester = 'tester@example.com';
    const appUserId = '00000000-0000-4000-8000-000000000000';
    const easBuildId = '310244ed-027b-4028-8522-70c0f676a0e9';
    const deviceId = `${['192', '168', '1', '10'].join('.')}:43210`;
    const gates = Object.fromEntries(
      MANUAL_GATE_KEYS.map((key) => [
        key,
        {
          status: 'passed',
          testedAt: '2026-05-09T12:00:00.000Z',
          tester,
          appUserId,
          evidence: key === 'play_monthly'
            ? `${evidenceForKey(key)}; ${tester}; ${appUserId}; ${easBuildId}; ${deviceId}`
            : evidenceForKey(key),
          ...(key.startsWith('play_')
            ? playEvidenceFields({ deviceId, easBuildId })
            : {}),
        },
      ])
    );
    const evidencePath = writeEvidenceFile(gates);

    const result = runReport([], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain(tester);
    expect(result.stdout).not.toContain(appUserId);
    expect(result.stdout).not.toContain(easBuildId);
    expect(result.stdout).not.toContain(deviceId);
    expect(result.stdout).toContain('<redacted:tester>');
    expect(result.stdout).toContain('<redacted:device>');
  });

  it('does not reuse Play evidence recorded for an older Android versionCode', () => {
    const staleVersionCode = ANDROID_CANDIDATE_VERSION_CODE - 1;
    const gates = Object.fromEntries(
      MANUAL_GATE_KEYS.map((key) => [
        key,
        {
          status: 'passed',
          testedAt: '2026-05-09T12:00:00.000Z',
          tester: 'tester@example.com',
          appUserId: '00000000-0000-4000-8000-000000000000',
          evidence: evidenceForKey(key),
          ...(key.startsWith('play_')
            ? playEvidenceFields({ versionCode: staleVersionCode })
            : {}),
        },
      ])
    );
    const evidencePath = writeEvidenceFile(gates);

    const result = runReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Verified manual/external scenarios: 4');
    expect(result.stdout).toContain('Manual or external gates remaining: 3');
    expect(result.stdout).toContain(
      `Play monthly: versionCode ${staleVersionCode} does not match Android release candidate ${ANDROID_CANDIDATE_VERSION_CODE} from app.json`
    );
  });

  it('shows older manual evidence as historical but rejects it for strict qualification', () => {
    const staleVersionCode = ANDROID_CANDIDATE_VERSION_CODE - 1;
    const gates = Object.fromEntries(
      MANUAL_GATE_KEYS.map((key) => [
        key,
        {
          status: 'passed',
          testedAt: '2026-05-09T12:00:00.000Z',
          tester: 'tester@example.com',
          appUserId: '00000000-0000-4000-8000-000000000000',
          evidence: evidenceForKey(key),
          versionCode: staleVersionCode,
          ...(key.startsWith('play_') ? playEvidenceFields({ versionCode: staleVersionCode }) : {}),
        },
      ])
    );
    const evidencePath = writeEvidenceFile(gates);

    const historicalReport = runReport([], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
    });
    const strictReport = runReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
    });

    expect(historicalReport.status).toBe(0);
    expect(historicalReport.stdout).toContain('Historical manual/external scenarios: 7');
    expect(historicalReport.stdout).toContain('| Historical | Test Store monthly |');
    expect(strictReport.status).toBe(1);
    expect(strictReport.stdout).toContain('Verified manual/external scenarios: 0');
    expect(strictReport.stdout).toContain('Manual or external gates remaining: 7');
    expect(strictReport.stdout).toContain(
      `Test Store monthly: versionCode ${staleVersionCode} does not match Android release candidate ${ANDROID_CANDIDATE_VERSION_CODE} from app.json`
    );
  });

  it('requires the app.json Android candidate in Google Play track readiness', () => {
    const staleVersionCode = ANDROID_CANDIDATE_VERSION_CODE - 1;
    const trackStatePath = writeGooglePlayTrackStateSnapshot(staleVersionCode);

    const result = runReport([], {
      GOOGLE_PLAY_TRACK_STATE_PATH: trackStatePath,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('BLOCKED | Google Play internal track snapshot');
    expect(result.stdout).toContain(`internal/missing/${ANDROID_CANDIDATE_VERSION_CODE}`);
  });

  it('marks the Google Play track ready when it contains the app.json Android candidate', () => {
    const trackStatePath = writeGooglePlayTrackStateSnapshot(ANDROID_CANDIDATE_VERSION_CODE);

    const result = runReport([], {
      GOOGLE_PLAY_TRACK_STATE_PATH: trackStatePath,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('READY | Google Play internal track snapshot');
    expect(result.stdout).toContain(
      `internal/candidate-${ANDROID_CANDIDATE_VERSION_CODE}/completed/versionCode=${ANDROID_CANDIDATE_VERSION_CODE}`
    );
  });

  it('keeps the full release gate blocked when identity evidence is incomplete', () => {
    const gates = Object.fromEntries(
      MANUAL_GATE_KEYS.map((key) => [
        key,
        {
          status: 'passed',
          testedAt: '2026-05-09T12:00:00.000Z',
          evidence: `${key} verified by manual QA`,
        },
      ])
    );
    const evidencePath = writeEvidenceFile(gates);

    const result = runReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Verified manual/external scenarios: 0');
    expect(result.stdout).toContain('Manual or external gates remaining: 7');
    expect(result.stdout).toContain('## Evidence Diagnostics');
    expect(result.stdout).toContain('Test Store monthly: tester is missing');
  });

  it('keeps the full release gate blocked when identity evidence is whitespace only', () => {
    const gates = Object.fromEntries(
      MANUAL_GATE_KEYS.map((key) => [
        key,
        {
          status: 'passed',
          testedAt: '2026-05-09T12:00:00.000Z',
          tester: '   ',
          appUserId: '   ',
          evidence: `${key} verified by manual QA`,
          ...(key.startsWith('play_') ? playEvidenceFields() : {}),
        },
      ])
    );
    const evidencePath = writeEvidenceFile(gates);

    const result = runReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Verified manual/external scenarios: 0');
    expect(result.stdout).toContain('Manual or external gates remaining: 7');
    expect(result.stdout).toContain('Test Store monthly: tester is missing');
  });

  it('keeps the full release gate blocked when appUserId is not a UUID', () => {
    const gates = Object.fromEntries(
      MANUAL_GATE_KEYS.map((key) => [
        key,
        {
          status: 'passed',
          testedAt: '2026-05-09T12:00:00.000Z',
          tester: 'tester@example.com',
          appUserId: 'tester@example.com',
          evidence: `${key} verified by manual QA`,
          ...(key.startsWith('play_') ? playEvidenceFields() : {}),
        },
      ])
    );
    const evidencePath = writeEvidenceFile(gates);

    const result = runReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Verified manual/external scenarios: 0');
    expect(result.stdout).toContain('Manual or external gates remaining: 7');
    expect(result.stdout).toContain('Test Store monthly: appUserId must be a UUID');
  });

  it('keeps the full release gate blocked when testedAt is not a valid date', () => {
    const gates = Object.fromEntries(
      MANUAL_GATE_KEYS.map((key) => [
        key,
        {
          status: 'passed',
          testedAt: 'not-a-date',
          tester: 'tester@example.com',
          appUserId: '00000000-0000-4000-8000-000000000000',
          evidence: `${key} verified by manual QA`,
          ...(key.startsWith('play_') ? playEvidenceFields() : {}),
        },
      ])
    );
    const evidencePath = writeEvidenceFile(gates);

    const result = runReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Verified manual/external scenarios: 0');
    expect(result.stdout).toContain('Manual or external gates remaining: 7');
    expect(result.stdout).toContain('Test Store monthly: testedAt is not a valid date');
  });

  it('keeps Play gates blocked when EAS build evidence is missing', () => {
    const gates = Object.fromEntries(
      MANUAL_GATE_KEYS.map((key) => [
        key,
        {
          status: 'passed',
          testedAt: '2026-05-09T12:00:00.000Z',
          tester: 'tester@example.com',
          appUserId: '00000000-0000-4000-8000-000000000000',
          evidence: `${key} verified by manual QA`,
        },
      ])
    );
    const evidencePath = writeEvidenceFile(gates);

    const result = runReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Verified manual/external scenarios: 3');
    expect(result.stdout).toContain('Manual or external gates remaining: 4');
    expect(result.stdout).toContain('Account switch: second account must be confirmed');
    expect(result.stdout).toContain('Play monthly');
    expect(result.stdout).toContain('Play monthly: easBuildId must be an EAS build UUID');
  });

  it('keeps Play gates blocked when EAS build evidence is not a UUID', () => {
    const gates = Object.fromEntries(
      MANUAL_GATE_KEYS.map((key) => [
        key,
        {
          status: 'passed',
          testedAt: '2026-05-09T12:00:00.000Z',
          tester: 'tester@example.com',
          appUserId: '00000000-0000-4000-8000-000000000000',
          evidence: `${key} verified by manual QA`,
          ...(key.startsWith('play_') ? { easBuildId: 'build-20' } : {}),
        },
      ])
    );
    const evidencePath = writeEvidenceFile(gates);

    const result = runReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Verified manual/external scenarios: 3');
    expect(result.stdout).toContain('Manual or external gates remaining: 4');
    expect(result.stdout).toContain('Account switch: second account must be confirmed');
    expect(result.stdout).toContain('Play monthly');
    expect(result.stdout).toContain('Play monthly: easBuildId must be an EAS build UUID');
  });

  it('keeps Play gates blocked when physical device evidence is missing', () => {
    const gates = Object.fromEntries(
      MANUAL_GATE_KEYS.map((key) => [
        key,
        {
          status: 'passed',
          testedAt: '2026-05-09T12:00:00.000Z',
          tester: 'tester@example.com',
          appUserId: '00000000-0000-4000-8000-000000000000',
          evidence: evidenceForKey(key),
          ...(key.startsWith('play_') ? playEvidenceFields({ deviceId: undefined, installerPackageName: undefined }) : {}),
        },
      ])
    );
    const evidencePath = writeEvidenceFile(gates);

    const result = runReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Verified manual/external scenarios: 4');
    expect(result.stdout).toContain('Manual or external gates remaining: 3');
    expect(result.stdout).toContain('Play monthly: deviceId is required for Play evidence');
  });

  it('keeps Play gates blocked when the device evidence is an emulator', () => {
    const gates = Object.fromEntries(
      MANUAL_GATE_KEYS.map((key) => [
        key,
        {
          status: 'passed',
          testedAt: '2026-05-09T12:00:00.000Z',
          tester: 'tester@example.com',
          appUserId: '00000000-0000-4000-8000-000000000000',
          evidence: evidenceForKey(key),
          ...(key.startsWith('play_')
            ? playEvidenceFields({ deviceId: 'emulator-5554' })
            : {}),
        },
      ])
    );
    const evidencePath = writeEvidenceFile(gates);

    const result = runReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Verified manual/external scenarios: 4');
    expect(result.stdout).toContain('Manual or external gates remaining: 3');
    expect(result.stdout).toContain('Play monthly: deviceId must be a physical Android device, not an emulator');
  });

  it('keeps Play gates blocked when installer package evidence is missing', () => {
    const gates = Object.fromEntries(
      MANUAL_GATE_KEYS.map((key) => [
        key,
        {
          status: 'passed',
          testedAt: '2026-05-09T12:00:00.000Z',
          tester: 'tester@example.com',
          appUserId: '00000000-0000-4000-8000-000000000000',
          evidence: evidenceForKey(key),
          ...(key.startsWith('play_') ? playEvidenceFields({ installerPackageName: undefined }) : {}),
        },
      ])
    );
    const evidencePath = writeEvidenceFile(gates);

    const result = runReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Verified manual/external scenarios: 4');
    expect(result.stdout).toContain('Manual or external gates remaining: 3');
    expect(result.stdout).toContain('Play monthly: installerPackageName is required for Play evidence');
  });

  it('keeps Play gates blocked when installer package evidence is not Google Play', () => {
    const gates = Object.fromEntries(
      MANUAL_GATE_KEYS.map((key) => [
        key,
        {
          status: 'passed',
          testedAt: '2026-05-09T12:00:00.000Z',
          tester: 'tester@example.com',
          appUserId: '00000000-0000-4000-8000-000000000000',
          evidence: evidenceForKey(key),
          ...(key.startsWith('play_') ? playEvidenceFields({ installerPackageName: 'com.android.shell' }) : {}),
        },
      ])
    );
    const evidencePath = writeEvidenceFile(gates);

    const result = runReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Verified manual/external scenarios: 4');
    expect(result.stdout).toContain('Manual or external gates remaining: 3');
    expect(result.stdout).toContain('Play monthly: installerPackageName must be com.android.vending');
  });

  it('keeps Play gates blocked when installed versionCode evidence is missing', () => {
    const gates = Object.fromEntries(
      MANUAL_GATE_KEYS.map((key) => [
        key,
        {
          status: 'passed',
          testedAt: '2026-05-09T12:00:00.000Z',
          tester: 'tester@example.com',
          appUserId: '00000000-0000-4000-8000-000000000000',
          evidence: evidenceForKey(key),
          ...(key.startsWith('play_') ? playEvidenceFields({ versionCode: undefined }) : {}),
        },
      ])
    );
    const evidencePath = writeEvidenceFile(gates);

    const result = runReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Verified manual/external scenarios: 4');
    expect(result.stdout).toContain('Manual or external gates remaining: 3');
    expect(result.stdout).toContain('Play monthly: versionCode is required for Play evidence');
  });

  it('keeps account switch blocked when the second free inactive account is not explicit', () => {
    const gates = Object.fromEntries(
      MANUAL_GATE_KEYS.map((key) => [
        key,
        {
          status: 'passed',
          testedAt: '2026-05-09T12:00:00.000Z',
          tester: 'tester@example.com',
          appUserId: '00000000-0000-4000-8000-000000000000',
          evidence: evidenceForKey(key),
          ...(key.startsWith('play_') ? playEvidenceFields() : {}),
        },
      ])
    );
    gates.account_switch.evidence = 'paid account logout and login verified by manual QA';
    const evidencePath = writeEvidenceFile(gates);

    const result = runReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Verified manual/external scenarios: 6');
    expect(result.stdout).toContain('Manual or external gates remaining: 1');
    expect(result.stdout).toContain('Account switch: second account must be confirmed');
  });

  it('keeps Play monthly and annual blocked when base plan durations are not confirmed', () => {
    const gates = Object.fromEntries(
      MANUAL_GATE_KEYS.map((key) => [
        key,
        {
          status: 'passed',
          testedAt: '2026-05-09T12:00:00.000Z',
          tester: 'tester@example.com',
          appUserId: '00000000-0000-4000-8000-000000000000',
          evidence:
            key === 'play_cancellation_and_expiry'
              ? evidenceForKey(key)
              : key.startsWith('play_')
                ? `${key} verified by manual QA after installed from Play (com.android.vending)`
                : `${key} verified by manual QA`,
          ...(key.startsWith('play_') ? playEvidenceFields() : {}),
        },
      ])
    );
    const evidencePath = writeEvidenceFile(gates);

    const result = runReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Verified manual/external scenarios: 4');
    expect(result.stdout).toContain('Manual or external gates remaining: 3');
    expect(result.stdout).toContain('Account switch: second account must be confirmed');
    expect(result.stdout).toContain('Play monthly: monthly base plan P1M must be confirmed');
    expect(result.stdout).toContain('Play annual: annual base plan P1Y must be confirmed');
  });

  it('keeps Play gates blocked when the Play install source is not confirmed', () => {
    const gates = Object.fromEntries(
      MANUAL_GATE_KEYS.map((key) => [
        key,
        {
          status: 'passed',
          testedAt: '2026-05-09T12:00:00.000Z',
          tester: 'tester@example.com',
          appUserId: '00000000-0000-4000-8000-000000000000',
          evidence: key === 'play_monthly'
            ? 'play_monthly verified by manual QA with base plan P1M confirmed'
            : `${key} verified by manual QA`,
          ...(key.startsWith('play_') ? playEvidenceFields() : {}),
        },
      ])
    );
    const evidencePath = writeEvidenceFile(gates);

    const result = runReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Verified manual/external scenarios: 3');
    expect(result.stdout).toContain('Manual or external gates remaining: 4');
    expect(result.stdout).toContain('Play monthly: Play Internal Testing install source must be confirmed');
  });

  it('keeps Play cancellation blocked when cancellation or expiry is not observed', () => {
    const gates = Object.fromEntries(
      MANUAL_GATE_KEYS.map((key) => [
        key,
        {
          status: 'passed',
          testedAt: '2026-05-09T12:00:00.000Z',
          tester: 'tester@example.com',
          appUserId: '00000000-0000-4000-8000-000000000000',
          evidence:
            key === 'play_cancellation_and_expiry'
              ? 'Play purchase verified after installed from Play (com.android.vending); RevenueCat webhook and backend state converged'
              : evidenceForKey(key),
          ...(key.startsWith('play_') ? playEvidenceFields() : {}),
        },
      ])
    );
    const evidencePath = writeEvidenceFile(gates);

    const result = runReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Verified manual/external scenarios: 6');
    expect(result.stdout).toContain('Manual or external gates remaining: 1');
    expect(result.stdout).toContain('Play cancellation and expiry: cancellation or expiry must be observed');
  });

  it('keeps Play cancellation blocked when webhook and backend convergence are not confirmed', () => {
    const gates = Object.fromEntries(
      MANUAL_GATE_KEYS.map((key) => [
        key,
        {
          status: 'passed',
          testedAt: '2026-05-09T12:00:00.000Z',
          tester: 'tester@example.com',
          appUserId: '00000000-0000-4000-8000-000000000000',
          evidence:
            key === 'play_cancellation_and_expiry'
              ? 'Play cancellation observed after installed from Play (com.android.vending)'
              : evidenceForKey(key),
          ...(key.startsWith('play_') ? playEvidenceFields() : {}),
        },
      ])
    );
    const evidencePath = writeEvidenceFile(gates);

    const result = runReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Verified manual/external scenarios: 6');
    expect(result.stdout).toContain('Manual or external gates remaining: 1');
    expect(result.stdout).toContain('Play cancellation and expiry: RevenueCat webhook must be confirmed');
  });

  it('keeps Play monthly blocked when evidence says P1M but the live snapshot still says P1Y', () => {
    const gates = Object.fromEntries(
      MANUAL_GATE_KEYS.map((key) => [
        key,
        {
          status: 'passed',
          testedAt: '2026-05-09T12:00:00.000Z',
          tester: 'tester@example.com',
          appUserId: '00000000-0000-4000-8000-000000000000',
          evidence: evidenceForKey(key),
          ...(key.startsWith('play_') ? playEvidenceFields() : {}),
        },
      ])
    );
    const evidencePath = writeEvidenceFile(gates);
    const snapshotPath = writePlayStoreStateSnapshot({
      prodfce10ef2a8: {
        store: 'play_store',
        status: 'ok',
        base_plans: [{ base_plan_id: 'annual', billing_period_duration: 'P1Y' }],
      },
      prod98337b31be: {
        store: 'play_store',
        status: 'ok',
        base_plans: [{ base_plan_id: 'annual', billing_period_duration: 'P1Y' }],
      },
    });

    const result = runReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
      REVENUECAT_PLAY_STORE_STATE_PATH: snapshotPath,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Verified manual/external scenarios: 6');
    expect(result.stdout).toContain('Manual or external gates remaining: 1');
    expect(result.stdout).toContain('Play monthly: live snapshot still reports base plans annual/P1Y; expected P1M');
  });

  it('accepts Play monthly P1M evidence when Google Play direct snapshot is ready even if RevenueCat store state lags', () => {
    const gates = Object.fromEntries(
      MANUAL_GATE_KEYS.map((key) => [
        key,
        {
          status: 'passed',
          testedAt: '2026-05-09T12:00:00.000Z',
          tester: 'tester@example.com',
          appUserId: '00000000-0000-4000-8000-000000000000',
          evidence: evidenceForKey(key),
          ...(key.startsWith('play_') ? playEvidenceFields() : {}),
        },
      ])
    );
    const evidencePath = writeEvidenceFile(gates);
    const revenueCatSnapshotPath = writePlayStoreStateSnapshot({
      prodfce10ef2a8: {
        store: 'play_store',
        status: 'ok',
        base_plans: [{ base_plan_id: 'annual', billing_period_duration: 'P1Y' }],
      },
    });
    const googlePlaySnapshotPath = writeGooglePlaySubscriptionStateSnapshot();

    const result = runReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
      REVENUECAT_PLAY_STORE_STATE_PATH: revenueCatSnapshotPath,
      GOOGLE_PLAY_SUBSCRIPTION_STATE_PATH: googlePlaySnapshotPath,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Verified manual/external scenarios: 7');
    expect(result.stdout).toContain('Manual or external gates remaining: 0');
    expect(result.stdout).toContain('READY | Google Play monthly base plan snapshot');
    expect(result.stdout).toContain('LAGGING | Play monthly base plan snapshot');
    expect(result.stdout).toContain('Google Play direct snapshot is ready');
    expect(result.stdout).not.toContain('Play monthly: live snapshot still reports base plans annual/P1Y; expected P1M');
  });

  it('reports an expired RevenueCat Play snapshot as stale instead of lagging', () => {
    const revenueCatSnapshotPath = writePlayStoreStateSnapshot(
      {
        prodfce10ef2a8: {
          store: 'play_store',
          status: 'ok',
          base_plans: [{ base_plan_id: 'annual', billing_period_duration: 'P1Y' }],
        },
      },
      '2025-12-29T00:00:00.000Z'
    );
    const googlePlaySnapshotPath = writeGooglePlaySubscriptionStateSnapshot();

    const result = runReport([], {
      REVENUECAT_PLAY_STORE_STATE_PATH: revenueCatSnapshotPath,
      GOOGLE_PLAY_SUBSCRIPTION_STATE_PATH: googlePlaySnapshotPath,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('STALE | Play monthly base plan snapshot');
    expect(result.stdout).toContain(
      'checked_at 2025-12-29T00:00:00.000Z is 72h old; maximum age is 24h'
    );
    expect(result.stdout).not.toContain('LAGGING | Play monthly base plan snapshot');
  });

  it('keeps gates blocked when evidence text is still the example placeholder', () => {
    const gates = Object.fromEntries(
      MANUAL_GATE_KEYS.map((key) => [
        key,
        {
          ...EXAMPLE.gates[key],
          status: 'passed',
          testedAt: '2026-05-09T12:00:00.000Z',
          tester: 'tester@example.com',
          appUserId: '00000000-0000-4000-8000-000000000000',
          ...(key.startsWith('play_') ? playEvidenceFields() : {}),
        },
      ])
    );
    const evidencePath = writeEvidenceFile(gates);

    const result = runReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Verified manual/external scenarios: 0');
    expect(result.stdout).toContain('Manual or external gates remaining: 7');
    expect(result.stdout).toContain('Test Store monthly: evidence still uses the template text');
  });
});
