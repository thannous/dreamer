'use strict';
/* global __dirname, describe, expect, it */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/run-subscription-teststore-restore.js');
const APPROVAL = 'I_APPROVE_TEST_STORE_RESTORE';
const CLEAR_STATE_APPROVAL = 'I_APPROVE_CLEAR_NOCTALIA_APP_STATE';
const PHYSICAL_DEVICE_APPROVAL = 'I_APPROVE_TEST_STORE_RESTORE_CLEAR_STATE_ON_PHYSICAL_DEVICE';

function runWrapper(args = [], env = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

function createFakeNpm() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-npm-restore-'));
  const bin = path.join(dir, 'npm');
  fs.writeFileSync(
    bin,
    `#!/usr/bin/env node
const fs = require('fs');
fs.writeFileSync(process.env.CAPTURE_PATH, JSON.stringify({
  args: process.argv.slice(2),
  qaEmail: process.env.QA_EMAIL,
  qaEmailRegex: process.env.QA_EMAIL_REGEX,
  sensitiveGuard: process.env.NOCTALIA_INTERNAL_SENSITIVE_FLOW_GUARD,
}, null, 2), 'utf8');
`,
    'utf8'
  );
  fs.chmodSync(bin, 0o755);
  return dir;
}

describe('guarded Test Store restore runner', () => {
  it('runs an identity-free preflight without approval or Maestro', () => {
    const result = runWrapper(['--preflight', '--device', 'emulator-5554'], {
      REVENUECAT_QA_EMAIL: 'tester+restore@example.com',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Test Store restore preflight passed');
    expect(result.stdout).toContain('Test account: configured');
    expect(result.stdout).not.toContain('tester+restore@example.com');
    expect(result.stdout).not.toContain('@example.com');
    expect(result.stdout).toContain('Approval present: no');
    expect(result.stdout).toContain('Clear-state approval present: no');
    expect(result.stdout).toContain('Target: emulator (emulator-5554)');
  });

  it('refuses to restore without explicit approval', () => {
    const result = runWrapper(['--device', 'emulator-5554'], {
      REVENUECAT_QA_EMAIL: 'tester@example.com',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Refusing to start Test Store restore');
  });

  it('runs only the guarded standalone Release flow', () => {
    const fakeNpmDir = createFakeNpm();
    const capturePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'restore-capture-')), 'capture.json');
    const result = runWrapper(['--device', 'emulator-5554'], {
      PATH: `${fakeNpmDir}${path.delimiter}${process.env.PATH}`,
      CAPTURE_PATH: capturePath,
      REVENUECAT_QA_EMAIL: 'tester+restore@example.com',
      REVENUECAT_QA_RESTORE_APPROVAL: APPROVAL,
      REVENUECAT_QA_CLEAR_STATE_APPROVAL: CLEAR_STATE_APPROVAL,
    });

    expect(result.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(capturePath, 'utf8'))).toEqual({
      args: [
        'run',
        'test:e2e:release:teststore:local',
        '--',
        '--flow',
        'maestro/subscription-teststore-release-readiness.yml',
        '--flow',
        'maestro/subscription-teststore-restore-google-manual.yml',
        '--device',
        'emulator-5554',
      ],
      qaEmailRegex: '^tester\\+restore@example\\.com$',
      sensitiveGuard: 'restore-google:v1',
    });
  });

  it('requires a separate destructive approval before clearState', () => {
    const result = runWrapper(['--device', 'emulator-5554'], {
      REVENUECAT_QA_EMAIL: 'tester@example.com',
      REVENUECAT_QA_RESTORE_APPROVAL: APPROVAL,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Refusing to clear Noctalia app state');
  });

  it('rejects physical targets unless both the option and dedicated token are present', () => {
    const ambiguous = runWrapper(['--preflight', '--device', 'emulator-5554,device-123'], {
      REVENUECAT_QA_EMAIL: 'tester@example.com',
    });
    expect(ambiguous.status).toBe(1);
    expect(ambiguous.stderr).toContain('exactly one QA target');

    const withoutOption = runWrapper(['--preflight', '--device', 'device-123'], {
      REVENUECAT_QA_EMAIL: 'tester@example.com',
    });
    expect(withoutOption.status).toBe(1);
    expect(withoutOption.stderr).toContain('emulator-only by default');

    const withoutToken = runWrapper(['--preflight', '--device', 'device-123', '--allow-physical'], {
      REVENUECAT_QA_EMAIL: 'tester@example.com',
    });
    expect(withoutToken.status).toBe(1);
    expect(withoutToken.stderr).toContain('Refusing physical-device restore');

    const authorized = runWrapper(['--preflight', '--device', 'device-123', '--allow-physical'], {
      REVENUECAT_QA_EMAIL: 'tester@example.com',
      REVENUECAT_QA_PHYSICAL_DEVICE_APPROVAL: PHYSICAL_DEVICE_APPROVAL,
    });
    expect(authorized.status).toBe(0);
    expect(authorized.stdout).toContain('Target: authorized physical device (device-123)');
    expect(authorized.stdout).toContain('Maestro args: --device device-123');
  });

  it('rejects arguments that could bypass the Release suite', () => {
    const result = runWrapper(['--device', 'emulator-5554', '--suite', 'core'], {
      REVENUECAT_QA_EMAIL: 'tester@example.com',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unsupported Maestro argument for guarded restore: --suite');
  });

  it('keeps clearState limited to the guarded restore flow', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'maestro/subscription-teststore-restore-google-manual.yml'),
      'utf8'
    );
    expect(source).toContain('subflows/open-release-app-clear-state.yml');

    const readiness = fs.readFileSync(
      path.join(ROOT, 'maestro/subscription-teststore-release-readiness.yml'),
      'utf8'
    );
    expect(readiness).toContain('subflows/open-release-app-preserve-state.yml');
    expect(readiness).not.toContain('clearState: true');
  });
});
