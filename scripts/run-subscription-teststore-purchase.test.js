const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/run-subscription-teststore-purchase.js');
const APPROVAL = 'I_APPROVE_TEST_STORE_PURCHASE';

function runWrapper(args = [], env = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

function createFakeNpm() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-npm-'));
  const bin = path.join(dir, 'npm');
  fs.writeFileSync(
    bin,
    `#!/usr/bin/env node
const fs = require('fs');
const payload = {
  args: process.argv.slice(2),
  qaEmail: process.env.QA_EMAIL,
  qaPassword: process.env.QA_PASSWORD,
  qaAuth: process.env.QA_AUTH,
  qaPlan: process.env.QA_PLAN,
};
fs.writeFileSync(process.env.CAPTURE_PATH, JSON.stringify(payload, null, 2), 'utf8');
process.exit(Number(process.env.FAKE_NPM_STATUS || 0));
`,
    'utf8'
  );
  fs.chmodSync(bin, 0o755);
  return dir;
}

describe('guarded Test Store purchase runner', () => {
  it('refuses to launch the purchase flow without explicit approval', () => {
    const capturePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'purchase-capture-')), 'capture.json');
    const result = runWrapper(['--plan', 'monthly'], {
      REVENUECAT_QA_EMAIL: 'tester@example.com',
      REVENUECAT_QA_PASSWORD: 'password',
      CAPTURE_PATH: capturePath,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Refusing to start Test Store purchase');
    expect(fs.existsSync(capturePath)).toBe(false);
  });

  it('runs a purchase preflight without approval or launching Maestro', () => {
    const capturePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'purchase-capture-')), 'capture.json');
    const result = runWrapper(['--preflight', '--plan', 'monthly', '--device', 'emulator-5554'], {
      REVENUECAT_QA_EMAIL: 'tester@example.com',
      REVENUECAT_QA_PASSWORD: 'password',
      CAPTURE_PATH: capturePath,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Test Store purchase preflight passed');
    expect(result.stdout).toContain('Plan: monthly');
    expect(result.stdout).toContain('Auth mode: email');
    expect(result.stdout).toContain('Test account: te...@example.com');
    expect(result.stdout).not.toContain('tester@example.com');
    expect(result.stdout).toContain('Approval present: no');
    expect(fs.existsSync(capturePath)).toBe(false);
  });

  it('passes approval, credentials, plan and Maestro args to the guarded flow', () => {
    const fakeNpmDir = createFakeNpm();
    const capturePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'purchase-capture-')), 'capture.json');
    const result = runWrapper(['--plan', 'annual', '--device', 'emulator-5554', '--no-restart-metro'], {
      PATH: `${fakeNpmDir}${path.delimiter}${process.env.PATH}`,
      REVENUECAT_QA_APPROVAL: APPROVAL,
      REVENUECAT_QA_EMAIL: 'tester@example.com',
      REVENUECAT_QA_PASSWORD: 'password',
      CAPTURE_PATH: capturePath,
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(fs.readFileSync(capturePath, 'utf8'));
    expect(payload).toMatchObject({
      qaEmail: 'tester@example.com',
      qaPassword: 'password',
      qaAuth: 'email',
      qaPlan: 'annual',
    });
    expect(payload.args).toEqual([
      'run',
      'test:e2e:subscription-teststore',
      '--',
      '--flow',
      'maestro/subscription-teststore-purchase-manual.yml',
      '--retries',
      '0',
      '--device',
      'emulator-5554',
      '--no-restart-metro',
    ]);
  });

  it('runs the Google purchase flow without requiring an email password', () => {
    const fakeNpmDir = createFakeNpm();
    const capturePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'purchase-capture-')), 'capture.json');
    const result = runWrapper(['--plan', 'monthly', '--device', 'emulator-5554'], {
      PATH: `${fakeNpmDir}${path.delimiter}${process.env.PATH}`,
      REVENUECAT_QA_APPROVAL: APPROVAL,
      REVENUECAT_QA_AUTH: 'google',
      REVENUECAT_QA_EMAIL: 'tester@example.com',
      CAPTURE_PATH: capturePath,
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(fs.readFileSync(capturePath, 'utf8'));
    expect(payload).toMatchObject({
      qaEmail: 'tester@example.com',
      qaAuth: 'google',
      qaPlan: 'monthly',
    });
    expect(payload.qaPassword).toBeUndefined();
    expect(payload.args).toEqual([
      'run',
      'test:e2e:subscription-teststore',
      '--',
      '--flow',
      'maestro/subscription-teststore-purchase-google-manual.yml',
      '--retries',
      '0',
      '--device',
      'emulator-5554',
    ]);
  });
});
