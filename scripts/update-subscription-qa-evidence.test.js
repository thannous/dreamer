const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/update-subscription-qa-evidence.js');
const REPORT_SCRIPT = path.join(ROOT, 'scripts/subscription-qa-report.js');
const EXAMPLE = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'doc_web_interne/docs/revenuecat-qa-evidence.example.json'), 'utf8')
);

function tempFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'subscription-evidence-update-')), 'evidence.json');
}

function runUpdate(args = []) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

function runReport(evidencePath) {
  return spawnSync(process.execPath, [REPORT_SCRIPT], {
    cwd: ROOT,
    env: { ...process.env, REVENUECAT_QA_EVIDENCE_PATH: evidencePath },
    encoding: 'utf8',
  });
}

describe('subscription QA evidence updater', () => {
  it('documents the Play QA device preflight in help output', () => {
    const result = runUpdate(['--help']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('npm run android:play-qa-device -- --device <adb-id>');
  });

  it('creates a local evidence file from the example and marks one gate as passed', () => {
    const file = tempFile();
    const result = runUpdate([
      '--file',
      file,
      '--gate',
      'test_store_monthly',
      '--tester',
      'tester@example.com',
      '--app-user-id',
      '00000000-0000-4000-8000-000000000000',
      '--evidence',
      'monthly purchase completed in Test Store',
      '--tested-at',
      '2026-05-09T12:00:00.000Z',
    ]);

    expect(result.status).toBe(0);
    const evidence = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(evidence.gates.test_store_monthly).toMatchObject({
      status: 'passed',
      testedAt: '2026-05-09T12:00:00.000Z',
      tester: 'tester@example.com',
      appUserId: '00000000-0000-4000-8000-000000000000',
      evidence: 'monthly purchase completed in Test Store',
    });
    expect(evidence.gates.test_store_annual.status).toBe('pending');
  });

  it('rejects incomplete evidence before writing the file', () => {
    const file = tempFile();
    const result = runUpdate([
      '--file',
      file,
      '--gate',
      'test_store_monthly',
      '--tester',
      'tester@example.com',
      '--app-user-id',
      '00000000-0000-4000-8000-000000000000',
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Missing --evidence');
    expect(fs.existsSync(file)).toBe(false);
  });

  it('feeds the release report one verified gate after recording evidence', () => {
    const file = tempFile();
    const updateResult = runUpdate([
      '--file',
      file,
      '--gate',
      'test_store_monthly',
      '--tester',
      'tester@example.com',
      '--app-user-id',
      '00000000-0000-4000-8000-000000000000',
      '--evidence',
      'monthly purchase completed in Test Store',
      '--tested-at',
      '2026-05-09T12:00:00.000Z',
    ]);

    expect(updateResult.status).toBe(0);
    const reportResult = runReport(file);

    expect(reportResult.status).toBe(0);
    expect(reportResult.stdout).toContain('Manual evidence: local file present');
    expect(reportResult.stdout).toContain('Verified manual/external scenarios: 1');
    expect(reportResult.stdout).toContain('Manual or external gates remaining: 6');
    expect(reportResult.stdout).toContain('| Verified | Test Store monthly |');
  });

  it('requires an EAS build id for Play evidence', () => {
    const file = tempFile();
    const result = runUpdate([
      '--file',
      file,
      '--gate',
      'play_monthly',
      '--tester',
      'tester@example.com',
      '--app-user-id',
      '00000000-0000-4000-8000-000000000000',
      '--evidence',
      'monthly purchase completed through Play Internal Testing with base plan P1M confirmed',
      '--tested-at',
      '2026-05-09T12:00:00.000Z',
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Missing --eas-build-id');
    expect(fs.existsSync(file)).toBe(false);
  });

  it('rejects evidence text that still matches the template placeholder', () => {
    const file = tempFile();
    const result = runUpdate([
      '--file',
      file,
      '--gate',
      'test_store_monthly',
      '--tester',
      'tester@example.com',
      '--app-user-id',
      '00000000-0000-4000-8000-000000000000',
      '--evidence',
      EXAMPLE.gates.test_store_monthly.evidence,
      '--tested-at',
      '2026-05-09T12:00:00.000Z',
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Evidence must describe the observed test result');
    expect(fs.existsSync(file)).toBe(false);
  });

  it('rejects an invalid testedAt value before writing the file', () => {
    const file = tempFile();
    const result = runUpdate([
      '--file',
      file,
      '--gate',
      'test_store_monthly',
      '--tester',
      'tester@example.com',
      '--app-user-id',
      '00000000-0000-4000-8000-000000000000',
      '--evidence',
      'monthly purchase completed in Test Store',
      '--tested-at',
      'not-a-date',
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--tested-at must be a valid date');
    expect(fs.existsSync(file)).toBe(false);
  });

  it('rejects an app user id that is not a UUID before writing the file', () => {
    const file = tempFile();
    const result = runUpdate([
      '--file',
      file,
      '--gate',
      'test_store_monthly',
      '--tester',
      'tester@example.com',
      '--app-user-id',
      'tester@example.com',
      '--evidence',
      'monthly purchase completed in Test Store',
      '--tested-at',
      '2026-05-09T12:00:00.000Z',
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--app-user-id must be a valid UUID');
    expect(fs.existsSync(file)).toBe(false);
  });

  it('allows updating an existing custom evidence value without treating it as the template', () => {
    const file = tempFile();
    const args = [
      '--file',
      file,
      '--gate',
      'test_store_monthly',
      '--tester',
      'tester@example.com',
      '--app-user-id',
      '00000000-0000-4000-8000-000000000000',
      '--evidence',
      'monthly purchase completed in Test Store',
    ];

    const firstResult = runUpdate([...args, '--tested-at', '2026-05-09T12:00:00.000Z']);
    const secondResult = runUpdate([...args, '--tested-at', '2026-05-09T12:30:00.000Z']);

    expect(firstResult.status).toBe(0);
    expect(secondResult.status).toBe(0);
    const evidence = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(evidence.gates.test_store_monthly.testedAt).toBe('2026-05-09T12:30:00.000Z');
  });

  it('records the EAS build id for Play evidence', () => {
    const file = tempFile();
    const result = runUpdate([
      '--file',
      file,
      '--gate',
      'play_monthly',
      '--tester',
      'tester@example.com',
      '--app-user-id',
      '00000000-0000-4000-8000-000000000000',
      '--evidence',
      'monthly purchase completed through Play Internal Testing after installed from Play (com.android.vending) with base plan P1M confirmed',
      '--eas-build-id',
      '310244ed-027b-4028-8522-70c0f676a0e9',
      '--device-id',
      '57275d36',
      '--installer-package-name',
      'com.android.vending',
      '--tested-at',
      '2026-05-09T12:00:00.000Z',
    ]);

    expect(result.status).toBe(0);
    const evidence = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(evidence.gates.play_monthly).toMatchObject({
      status: 'passed',
      easBuildId: '310244ed-027b-4028-8522-70c0f676a0e9',
      deviceId: '57275d36',
      installerPackageName: 'com.android.vending',
      evidence:
        'monthly purchase completed through Play Internal Testing after installed from Play (com.android.vending) with base plan P1M confirmed',
    });
  });

  it('requires a physical device id for Play evidence', () => {
    const file = tempFile();
    const result = runUpdate([
      '--file',
      file,
      '--gate',
      'play_annual',
      '--tester',
      'tester@example.com',
      '--app-user-id',
      '00000000-0000-4000-8000-000000000000',
      '--evidence',
      'annual purchase completed through Play Internal Testing after installed from Play (com.android.vending)',
      '--eas-build-id',
      '310244ed-027b-4028-8522-70c0f676a0e9',
      '--tested-at',
      '2026-05-09T12:00:00.000Z',
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Missing --device-id');
    expect(fs.existsSync(file)).toBe(false);
  });

  it('rejects emulator ids for Play evidence', () => {
    const file = tempFile();
    const result = runUpdate([
      '--file',
      file,
      '--gate',
      'play_annual',
      '--tester',
      'tester@example.com',
      '--app-user-id',
      '00000000-0000-4000-8000-000000000000',
      '--evidence',
      'annual purchase completed through Play Internal Testing after installed from Play (com.android.vending)',
      '--eas-build-id',
      '310244ed-027b-4028-8522-70c0f676a0e9',
      '--device-id',
      'emulator-5554',
      '--installer-package-name',
      'com.android.vending',
      '--tested-at',
      '2026-05-09T12:00:00.000Z',
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('physical Android device');
    expect(fs.existsSync(file)).toBe(false);
  });

  it('rejects Play evidence that does not confirm the Play install source', () => {
    const file = tempFile();
    const result = runUpdate([
      '--file',
      file,
      '--gate',
      'play_annual',
      '--tester',
      'tester@example.com',
      '--app-user-id',
      '00000000-0000-4000-8000-000000000000',
      '--evidence',
      'annual purchase completed through Play Internal Testing and backend converged',
      '--eas-build-id',
      '310244ed-027b-4028-8522-70c0f676a0e9',
      '--device-id',
      '57275d36',
      '--installer-package-name',
      'com.android.vending',
      '--tested-at',
      '2026-05-09T12:00:00.000Z',
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Play evidence must confirm the app was installed from Play Internal Testing');
    expect(fs.existsSync(file)).toBe(false);
  });

  it('requires the Play installer package name for Play evidence', () => {
    const file = tempFile();
    const result = runUpdate([
      '--file',
      file,
      '--gate',
      'play_annual',
      '--tester',
      'tester@example.com',
      '--app-user-id',
      '00000000-0000-4000-8000-000000000000',
      '--evidence',
      'annual purchase completed through Play Internal Testing after installed from Play (com.android.vending)',
      '--eas-build-id',
      '310244ed-027b-4028-8522-70c0f676a0e9',
      '--device-id',
      '57275d36',
      '--tested-at',
      '2026-05-09T12:00:00.000Z',
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Missing --installer-package-name');
    expect(fs.existsSync(file)).toBe(false);
  });

  it('rejects non-Play installer package names for Play evidence', () => {
    const file = tempFile();
    const result = runUpdate([
      '--file',
      file,
      '--gate',
      'play_annual',
      '--tester',
      'tester@example.com',
      '--app-user-id',
      '00000000-0000-4000-8000-000000000000',
      '--evidence',
      'annual purchase completed through Play Internal Testing after installed from Play (com.android.vending)',
      '--eas-build-id',
      '310244ed-027b-4028-8522-70c0f676a0e9',
      '--device-id',
      '57275d36',
      '--installer-package-name',
      'com.android.shell',
      '--tested-at',
      '2026-05-09T12:00:00.000Z',
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('installer package name must be com.android.vending');
    expect(fs.existsSync(file)).toBe(false);
  });

  it('records account switch evidence only when the second free inactive account is explicit', () => {
    const file = tempFile();
    const result = runUpdate([
      '--file',
      file,
      '--gate',
      'account_switch',
      '--tester',
      'tester@example.com',
      '--app-user-id',
      '00000000-0000-4000-8000-000000000000',
      '--evidence',
      'paid account remains plus while second account remains free / inactive after logout and login',
      '--tested-at',
      '2026-05-09T12:00:00.000Z',
    ]);

    expect(result.status).toBe(0);
    const evidence = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(evidence.gates.account_switch).toMatchObject({
      status: 'passed',
      evidence: 'paid account remains plus while second account remains free / inactive after logout and login',
    });
  });

  it('rejects account switch evidence that does not prove the second account state', () => {
    const file = tempFile();
    const result = runUpdate([
      '--file',
      file,
      '--gate',
      'account_switch',
      '--tester',
      'tester@example.com',
      '--app-user-id',
      '00000000-0000-4000-8000-000000000000',
      '--evidence',
      'paid account logout and login verified by manual QA',
      '--tested-at',
      '2026-05-09T12:00:00.000Z',
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Account switch evidence must confirm the second account');
    expect(fs.existsSync(file)).toBe(false);
  });

  it('rejects Play monthly evidence that does not confirm base plan P1M', () => {
    const file = tempFile();
    const result = runUpdate([
      '--file',
      file,
      '--gate',
      'play_monthly',
      '--tester',
      'tester@example.com',
      '--app-user-id',
      '00000000-0000-4000-8000-000000000000',
      '--evidence',
      'monthly purchase completed through Play Internal Testing',
      '--eas-build-id',
      '310244ed-027b-4028-8522-70c0f676a0e9',
      '--tested-at',
      '2026-05-09T12:00:00.000Z',
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Play monthly evidence must confirm base plan P1M');
    expect(fs.existsSync(file)).toBe(false);
  });

  it('rejects a Play EAS build id that is not a UUID', () => {
    const file = tempFile();
    const result = runUpdate([
      '--file',
      file,
      '--gate',
      'play_monthly',
      '--tester',
      'tester@example.com',
      '--app-user-id',
      '00000000-0000-4000-8000-000000000000',
      '--evidence',
      'monthly purchase completed through Play Internal Testing',
      '--eas-build-id',
      'build-20',
      '--tested-at',
      '2026-05-09T12:00:00.000Z',
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--eas-build-id must be a valid UUID');
    expect(fs.existsSync(file)).toBe(false);
  });
});
