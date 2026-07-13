/* global __dirname, describe, expect, it */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/run-subscription-account-switch.js');
const APPROVAL = 'I_APPROVE_ACCOUNT_SWITCH_TEST';
const ISOLATED_QA_ENV = {
  REVENUECAT_QA_SWITCH_FREE_EMAIL: '',
  REVENUECAT_QA_SWITCH_FREE_PASSWORD: '',
};

function runWrapper(args = [], env = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    env: { ...process.env, ...ISOLATED_QA_ENV, ...env },
    encoding: 'utf8',
  });
}

function createFakeNpm() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-npm-account-switch-'));
  const bin = path.join(dir, 'npm');
  fs.writeFileSync(
    bin,
    `#!/usr/bin/env node
const fs = require('fs');
const payload = {
  args: process.argv.slice(2),
  freeEmail: process.env.QA_SWITCH_FREE_EMAIL,
  paidEmailRegex: process.env.QA_PAID_EMAIL_REGEX,
  freeEmailRegex: process.env.QA_SWITCH_FREE_EMAIL_REGEX,
  freePassword: process.env.QA_SWITCH_FREE_PASSWORD,
  sensitiveGuard: process.env.NOCTALIA_INTERNAL_SENSITIVE_FLOW_GUARD,
};
fs.writeFileSync(process.env.CAPTURE_PATH, JSON.stringify(payload, null, 2), 'utf8');
process.exit(Number(process.env.FAKE_NPM_STATUS || 0));
`,
    'utf8'
  );
  fs.chmodSync(bin, 0o755);
  return dir;
}

describe('account switch runner', () => {
  it('requires a second real email account', () => {
    const result = runWrapper(['--preflight', '--device', 'emulator-5554'], {
      REVENUECAT_QA_EMAIL: 'paid@example.com',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Missing REVENUECAT_QA_SWITCH_FREE_EMAIL');
  });

  it('runs a preflight without approval or launching Maestro', () => {
    const capturePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'account-switch-capture-')), 'capture.json');
    const result = runWrapper(['--preflight', '--device', 'emulator-5554'], {
      REVENUECAT_QA_SWITCH_FREE_EMAIL: 'free@example.com',
      REVENUECAT_QA_SWITCH_FREE_PASSWORD: 'password',
      REVENUECAT_QA_EMAIL: 'paid@example.com',
      CAPTURE_PATH: capturePath,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Account switch preflight passed');
    expect(result.stdout).toContain('Precondition: app is currently signed in as the paid Plus account.');
    expect(result.stdout).toContain('Paid account: configured');
    expect(result.stdout).toContain('Second account: configured and distinct');
    expect(result.stdout).not.toContain('free@example.com');
    expect(result.stdout).not.toContain('@example.com');
    expect(result.stdout).toContain('Approval present: no');
    expect(fs.existsSync(capturePath)).toBe(false);
  });

  it('refuses to launch without explicit approval', () => {
    const capturePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'account-switch-capture-')), 'capture.json');
    const result = runWrapper(['--device', 'emulator-5554'], {
      REVENUECAT_QA_EMAIL: 'paid@example.com',
      REVENUECAT_QA_SWITCH_FREE_EMAIL: 'free@example.com',
      REVENUECAT_QA_SWITCH_FREE_PASSWORD: 'password',
      CAPTURE_PATH: capturePath,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Refusing to start account switch test');
    expect(fs.existsSync(capturePath)).toBe(false);
  });

  it('passes second account credentials and Maestro args to the flow', () => {
    const fakeNpmDir = createFakeNpm();
    const capturePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'account-switch-capture-')), 'capture.json');
    const result = runWrapper(['--device', 'emulator-5554'], {
      PATH: `${fakeNpmDir}${path.delimiter}${process.env.PATH}`,
      REVENUECAT_QA_SWITCH_APPROVAL: APPROVAL,
      REVENUECAT_QA_EMAIL: 'paid@example.com',
      REVENUECAT_QA_SWITCH_FREE_EMAIL: 'free@example.com',
      REVENUECAT_QA_SWITCH_FREE_PASSWORD: 'password',
      CAPTURE_PATH: capturePath,
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(fs.readFileSync(capturePath, 'utf8'));
    expect(payload).toMatchObject({
      freeEmail: 'free@example.com',
      freePassword: 'password',
      paidEmailRegex: '^paid@example\\.com$',
      freeEmailRegex: '^free@example\\.com$',
      sensitiveGuard: 'account-switch-email:v1',
    });
    expect(payload.args).toEqual([
      'run',
      'test:e2e:release:teststore:local',
      '--',
      '--flow',
      'maestro/subscription-teststore-release-readiness.yml',
      '--flow',
      'maestro/subscription-teststore-account-switch-free-email-manual.yml',
      '--device',
      'emulator-5554',
    ]);
  });

  it('rejects arguments that could bypass the Release Test Store suite', () => {
    const result = runWrapper(['--device', 'emulator-5554', '--flow', 'maestro/smoke.yml'], {
      REVENUECAT_QA_EMAIL: 'paid@example.com',
      REVENUECAT_QA_SWITCH_FREE_EMAIL: 'free@example.com',
      REVENUECAT_QA_SWITCH_FREE_PASSWORD: 'password',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unsupported Maestro argument for guarded account switch: --flow');
  });

  it('rejects identical or ambiguous account/device identities', () => {
    const sameAccount = runWrapper(['--preflight', '--device', 'emulator-5554'], {
      REVENUECAT_QA_EMAIL: 'same@example.com',
      REVENUECAT_QA_SWITCH_FREE_EMAIL: 'SAME@example.com',
      REVENUECAT_QA_SWITCH_FREE_PASSWORD: 'password',
    });
    expect(sameAccount.status).toBe(1);
    expect(sameAccount.stderr).toContain('must be different identities');

    const multipleDevices = runWrapper(['--preflight', '--device', 'emulator-5554,device-1'], {
      REVENUECAT_QA_EMAIL: 'paid@example.com',
      REVENUECAT_QA_SWITCH_FREE_EMAIL: 'free@example.com',
      REVENUECAT_QA_SWITCH_FREE_PASSWORD: 'password',
    });
    expect(multipleDevices.status).toBe(1);
    expect(multipleDevices.stderr).toContain('exactly one QA target');
  });

  it('rejects a physical device before account-switch preflight', () => {
    const result = runWrapper(['--preflight', '--device', 'physical-device'], {
      REVENUECAT_QA_EMAIL: 'paid@example.com',
      REVENUECAT_QA_SWITCH_FREE_EMAIL: 'free@example.com',
      REVENUECAT_QA_SWITCH_FREE_PASSWORD: 'password',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('emulator-only');
  });

  it('rejects an approved account switch on a physical device without launching Maestro', () => {
    const capturePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'account-switch-capture-')), 'capture.json');
    const result = runWrapper(['--device', 'physical-device'], {
      REVENUECAT_QA_SWITCH_APPROVAL: APPROVAL,
      REVENUECAT_QA_EMAIL: 'paid@example.com',
      REVENUECAT_QA_SWITCH_FREE_EMAIL: 'free@example.com',
      REVENUECAT_QA_SWITCH_FREE_PASSWORD: 'password',
      CAPTURE_PATH: capturePath,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('emulator-only');
    expect(fs.existsSync(capturePath)).toBe(false);
  });

  it('scopes Test Store mode and paid status before logout', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'maestro/subscription-teststore-account-switch-free-email-manual.yml'),
      'utf8'
    );
    const modeIndex = source.indexOf('id: text.subscription.qa.mode');
    const paidStatusIndex = source.indexOf('text: ".*plus / active.*"');
    const logoutIndex = source.indexOf('id: btn.auth.signOut');

    expect(modeIndex).toBeGreaterThan(-1);
    expect(paidStatusIndex).toBeGreaterThan(modeIndex);
    expect(logoutIndex).toBeGreaterThan(paidStatusIndex);
  });
});
