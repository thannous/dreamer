const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/run-subscription-account-switch.js');
const APPROVAL = 'I_APPROVE_ACCOUNT_SWITCH_TEST';

function runWrapper(args = [], env = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
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
  freePassword: process.env.QA_SWITCH_FREE_PASSWORD,
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
    const result = runWrapper(['--preflight']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Missing REVENUECAT_QA_SWITCH_FREE_EMAIL');
  });

  it('runs a preflight without approval or launching Maestro', () => {
    const capturePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'account-switch-capture-')), 'capture.json');
    const result = runWrapper(['--preflight', '--device', 'emulator-5554'], {
      REVENUECAT_QA_SWITCH_FREE_EMAIL: 'free@example.com',
      REVENUECAT_QA_SWITCH_FREE_PASSWORD: 'password',
      CAPTURE_PATH: capturePath,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Account switch preflight passed');
    expect(result.stdout).toContain('Precondition: app is currently signed in as the paid Plus account.');
    expect(result.stdout).toContain('Second account: fr...@example.com');
    expect(result.stdout).not.toContain('free@example.com');
    expect(result.stdout).toContain('Approval present: no');
    expect(fs.existsSync(capturePath)).toBe(false);
  });

  it('refuses to launch without explicit approval', () => {
    const capturePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'account-switch-capture-')), 'capture.json');
    const result = runWrapper(['--device', 'emulator-5554'], {
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
    const result = runWrapper(['--device', 'emulator-5554', '--no-restart-metro'], {
      PATH: `${fakeNpmDir}${path.delimiter}${process.env.PATH}`,
      REVENUECAT_QA_SWITCH_APPROVAL: APPROVAL,
      REVENUECAT_QA_SWITCH_FREE_EMAIL: 'free@example.com',
      REVENUECAT_QA_SWITCH_FREE_PASSWORD: 'password',
      CAPTURE_PATH: capturePath,
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(fs.readFileSync(capturePath, 'utf8'));
    expect(payload).toMatchObject({
      freeEmail: 'free@example.com',
      freePassword: 'password',
    });
    expect(payload.args).toEqual([
      'run',
      'test:e2e:subscription-teststore',
      '--',
      '--flow',
      'maestro/subscription-teststore-account-switch-free-email-manual.yml',
      '--retries',
      '0',
      '--device',
      'emulator-5554',
      '--no-restart-metro',
    ]);
  });
});
