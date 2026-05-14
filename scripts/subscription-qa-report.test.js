const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/subscription-qa-report.js');
const EXAMPLE = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'doc_web_interne/docs/revenuecat-qa-evidence.example.json'), 'utf8')
);

const MANUAL_GATE_KEYS = [
  'test_store_monthly',
  'test_store_annual',
  'restore_after_reinstall',
  'account_switch',
  'play_monthly',
  'play_annual',
  'play_cancellation_and_expiry',
];

function evidenceForKey(key) {
  if (key === 'account_switch') {
    return 'paid account remains plus while second account remains free / inactive after logout and login';
  }
  if (key === 'play_monthly') {
    return 'play_monthly verified by manual QA with base plan P1M confirmed';
  }
  return `${key} verified by manual QA`;
}

function runReport(args = [], env = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    env: {
      ...process.env,
      REVENUECAT_PLAY_STORE_STATE_PATH: path.join(os.tmpdir(), 'missing-revenuecat-play-store-state.local.json'),
      GOOGLE_PLAY_SUBSCRIPTION_STATE_PATH: path.join(os.tmpdir(), 'missing-google-play-subscription-state.local.json'),
      ...env,
    },
    encoding: 'utf8',
  });
}

function writeEvidenceFile(gates) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'subscription-qa-evidence-'));
  const filePath = path.join(dir, 'evidence.json');
  fs.writeFileSync(filePath, JSON.stringify({ gates }, null, 2), 'utf8');
  return filePath;
}

function writeInvalidEvidenceFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'subscription-qa-evidence-invalid-'));
  const filePath = path.join(dir, 'evidence.json');
  fs.writeFileSync(filePath, '{ invalid json', 'utf8');
  return filePath;
}

function writePlayStoreStateSnapshot(storeState) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'revenuecat-play-store-state-'));
  const filePath = path.join(dir, 'snapshot.json');
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        project_id: 'proje6db7596',
        store_state: storeState,
      },
      null,
      2
    ),
    'utf8'
  );
  return filePath;
}

function writeInvalidPlayStoreStateSnapshot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'revenuecat-play-store-state-invalid-'));
  const filePath = path.join(dir, 'snapshot.json');
  fs.writeFileSync(filePath, '{ invalid json', 'utf8');
  return filePath;
}

function writeGooglePlaySubscriptionStateSnapshot(monthlyPlan = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'google-play-subscription-state-'));
  const filePath = path.join(dir, 'snapshot.json');
  fs.writeFileSync(
    filePath,
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
        },
      },
      null,
      2
    ),
    'utf8'
  );
  return filePath;
}

function writeInvalidGooglePlaySubscriptionStateSnapshot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'google-play-subscription-state-invalid-'));
  const filePath = path.join(dir, 'snapshot.json');
  fs.writeFileSync(filePath, '{ invalid json', 'utf8');
  return filePath;
}

describe('subscription QA report release gate', () => {
  it('keeps the full release gate blocked when manual evidence is missing', () => {
    const result = runReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: path.join(os.tmpdir(), 'missing-revenuecat-evidence.json'),
      REVENUECAT_QA_EMAIL: '',
      REVENUECAT_QA_PASSWORD: '',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('OK | EAS Play Store profiles use Google Play key');
    expect(result.stdout).toContain('preview:goog_B...sanw');
    expect(result.stdout).toContain('OK | Test Store purchase preflight exists');
    expect(result.stdout).toContain('npm run test:e2e:subscription-teststore:purchase:preflight');
    expect(result.stdout).toContain('OK | Google Test Store purchase flow exists');
    expect(result.stdout).toContain('REVENUECAT_QA_AUTH=google -> maestro/subscription-teststore-purchase-google-manual.yml');
    expect(result.stdout).toContain('OK | Test Store restore flow exists');
    expect(result.stdout).toContain('maestro/subscription-teststore-restore-google-manual.yml');
    expect(result.stdout).toContain('OK | Test Store signout guard exists');
    expect(result.stdout).toContain('maestro/subscription-teststore-signout-guard.yml');
    expect(result.stdout).toContain('OK | Account switch email flow exists');
    expect(result.stdout).toContain('REVENUECAT_QA_SWITCH_FREE_EMAIL -> maestro/subscription-teststore-account-switch-free-email-manual.yml');
    expect(result.stdout).toContain('OK | Local subscription QA verifier exists');
    expect(result.stdout).toContain('npm run subscription:qa:verify-local');
    expect(result.stdout).toContain('OK | Production APK build is gated by subscription QA');
    expect(result.stdout).toContain('build:apk:prod must run android:gates:strict before eas build');
    expect(result.stdout).toContain('OK | RevenueCat device app user id extractor exists');
    expect(result.stdout).toContain('npm run subscription:qa:device-app-user-id');
    expect(result.stdout).toContain('OK | Android device diagnostic exists');
    expect(result.stdout).toContain('npm run android:device');
    expect(result.stdout).toContain('## Current Session Readiness');
    expect(result.stdout).toContain('Test Store signed-in account env');
    expect(result.stdout).toContain('REVENUECAT_QA_EMAIL=missing, REVENUECAT_QA_PASSWORD=missing');
    expect(result.stdout).toContain('Account switch second account env');
    expect(result.stdout).toContain('REVENUECAT_QA_SWITCH_FREE_EMAIL=missing, REVENUECAT_QA_SWITCH_FREE_PASSWORD=missing');
    expect(result.stdout).toContain('Device app user id extraction');
    expect(result.stdout).toContain('Google Play monthly base plan snapshot');
    expect(result.stdout).toContain('Run npm run subscription:qa:google-play-state');
    expect(result.stdout).toContain('Play monthly base plan snapshot');
    expect(result.stdout).toContain('RevenueCat product prodfce10ef2a8 must expose billing period P1M');
    expect(result.stdout).toContain('OK | Play store state snapshot parses');
    expect(result.stdout).toContain('OK | Play store state snapshot updater exists');
    expect(result.stdout).toContain('npm run subscription:qa:play-state');
    expect(result.stdout).toContain('OK | Evidence template covers all release gates');
    expect(result.stdout).toContain('OK | Local evidence file is gitignored');
    expect(result.stdout).toContain('OK | Google Play subscription state snapshot is gitignored');
    expect(result.stdout).toContain('OK | Google Play subscription state updater exists');
    expect(result.stdout).toContain('npm run subscription:qa:google-play-state');
    expect(result.stdout).toContain('Manual or external gates remaining: 7');
    expect(result.stdout).toContain('Offering packages and prices load without purchase');
    expect(result.stdout).toContain('maestro/subscription-teststore-restore-google-manual.yml plus structured evidence');
    expect(result.stdout).toContain('run test:e2e:subscription-teststore:account-switch with a second real email account');
    expect(result.stdout).toContain('Full RevenueCat workflow is not complete');
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
    expect(result.stderr).toBe('');
  });

  it('surfaces a direct Google Play monthly snapshot that is ready', () => {
    const snapshotPath = writeGooglePlaySubscriptionStateSnapshot();
    const result = runReport([], {
      GOOGLE_PLAY_SUBSCRIPTION_STATE_PATH: snapshotPath,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Google Play subscription state snapshot: local file present');
    expect(result.stdout).toContain('READY | Google Play monthly base plan snapshot');
    expect(result.stdout).toContain('monthly/P1M/ACTIVE; expected monthly/P1M/ACTIVE with US+FR availability');
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
          ...(key.startsWith('play_') ? { easBuildId: '310244ed-027b-4028-8522-70c0f676a0e9' } : {}),
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
          ...(key.startsWith('play_') ? { easBuildId: '310244ed-027b-4028-8522-70c0f676a0e9' } : {}),
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
          ...(key.startsWith('play_') ? { easBuildId: '310244ed-027b-4028-8522-70c0f676a0e9' } : {}),
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
          ...(key.startsWith('play_') ? { easBuildId: '310244ed-027b-4028-8522-70c0f676a0e9' } : {}),
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
          ...(key.startsWith('play_') ? { easBuildId: '310244ed-027b-4028-8522-70c0f676a0e9' } : {}),
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

  it('keeps Play monthly blocked when base plan P1M is not confirmed', () => {
    const gates = Object.fromEntries(
      MANUAL_GATE_KEYS.map((key) => [
        key,
        {
          status: 'passed',
          testedAt: '2026-05-09T12:00:00.000Z',
          tester: 'tester@example.com',
          appUserId: '00000000-0000-4000-8000-000000000000',
          evidence: `${key} verified by manual QA`,
          ...(key.startsWith('play_') ? { easBuildId: '310244ed-027b-4028-8522-70c0f676a0e9' } : {}),
        },
      ])
    );
    const evidencePath = writeEvidenceFile(gates);

    const result = runReport(['--require-full'], {
      REVENUECAT_QA_EVIDENCE_PATH: evidencePath,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Verified manual/external scenarios: 5');
    expect(result.stdout).toContain('Manual or external gates remaining: 2');
    expect(result.stdout).toContain('Account switch: second account must be confirmed');
    expect(result.stdout).toContain('Play monthly: monthly base plan P1M must be confirmed');
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
          ...(key.startsWith('play_') ? { easBuildId: '310244ed-027b-4028-8522-70c0f676a0e9' } : {}),
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
          ...(key.startsWith('play_') ? { easBuildId: '310244ed-027b-4028-8522-70c0f676a0e9' } : {}),
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
