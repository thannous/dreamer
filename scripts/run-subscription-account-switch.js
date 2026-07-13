#!/usr/bin/env node
'use strict';
/* global __dirname */

const { spawnSync } = require('child_process');
const path = require('path');
const {
  getSensitiveFlowGuardToken,
  SENSITIVE_FLOW_GUARD_ENV,
  TESTSTORE_READINESS_FLOW,
} = require('./run-maestro-android');

const ROOT = path.resolve(__dirname, '..');
const APPROVAL = 'I_APPROVE_ACCOUNT_SWITCH_TEST';
const FLOW = 'maestro/subscription-teststore-account-switch-free-email-manual.yml';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function exactRegex(value) {
  return `^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
}

function passthroughArgs(argv) {
  const out = [];
  let hasDevice = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--preflight') continue;
    if (arg === '--device') {
      const device = argv[i + 1];
      if (!device || device.startsWith('--')) {
        fail('Missing value for --device.');
      }
      if (hasDevice || device.includes(',')) {
        fail('Pass exactly one QA target with --device <adb-id>.');
      }
      out.push('--device', device);
      hasDevice = true;
      i += 1;
      continue;
    }
    fail(`Unsupported Maestro argument for guarded account switch: ${arg}`);
  }
  if (!hasDevice) {
    fail('A specific QA target is required. Pass --device <adb-id>.');
  }
  return out;
}

const argv = process.argv.slice(2);
const preflight = argv.includes('--preflight');
const paidEmail = process.env.REVENUECAT_QA_EMAIL;
const freeEmail = process.env.REVENUECAT_QA_SWITCH_FREE_EMAIL;
const freePassword = process.env.REVENUECAT_QA_SWITCH_FREE_PASSWORD;
const approval = process.env.REVENUECAT_QA_SWITCH_APPROVAL;

if (!paidEmail) {
  fail('Missing REVENUECAT_QA_EMAIL for the currently signed-in paid account.');
}

if (!freeEmail) {
  fail('Missing REVENUECAT_QA_SWITCH_FREE_EMAIL for the second real account.');
}

if (!freePassword) {
  fail('Missing REVENUECAT_QA_SWITCH_FREE_PASSWORD for the second real account.');
}

if (paidEmail.trim().toLowerCase() === freeEmail.trim().toLowerCase()) {
  fail('Paid and free QA accounts must be different identities.');
}

const maestroArgs = passthroughArgs(argv);
const targetDevice = maestroArgs[maestroArgs.indexOf('--device') + 1];
if (!/^emulator-\d+$/.test(targetDevice)) {
  fail('RevenueCat Test Store account switching is emulator-only; refusing a physical Play device.');
}

if (preflight) {
  console.log('Account switch preflight passed.');
  console.log('Precondition: app is currently signed in as the paid Plus account.');
  console.log('Paid account: configured');
  console.log('Second account: configured and distinct');
  console.log(`Approval present: ${approval === APPROVAL ? 'yes' : 'no'}`);
  console.log(`Flow: ${FLOW}`);
  console.log(`Maestro args: ${maestroArgs.length > 0 ? maestroArgs.join(' ') : 'none'}`);
  process.exit(0);
}

if (approval !== APPROVAL) {
  fail(`Refusing to start account switch test. Set REVENUECAT_QA_SWITCH_APPROVAL=${APPROVAL} after confirming the app is signed in as the paid Plus account.`);
}

const args = [
  'run',
  'test:e2e:release:teststore:local',
  '--',
  '--flow',
  TESTSTORE_READINESS_FLOW,
  '--flow',
  FLOW,
  ...maestroArgs,
];

const result = spawnSync('npm', args, {
  cwd: ROOT,
  env: {
    ...process.env,
    [SENSITIVE_FLOW_GUARD_ENV]: getSensitiveFlowGuardToken(FLOW),
    QA_PAID_EMAIL_REGEX: exactRegex(paidEmail),
    QA_SWITCH_FREE_EMAIL: freeEmail,
    QA_SWITCH_FREE_EMAIL_REGEX: exactRegex(freeEmail),
    QA_SWITCH_FREE_PASSWORD: freePassword,
  },
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
