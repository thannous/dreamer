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
const APPROVAL = 'I_APPROVE_TEST_STORE_PURCHASE';
const EMAIL_FLOW = 'maestro/subscription-teststore-purchase-manual.yml';
const GOOGLE_FLOW = 'maestro/subscription-teststore-purchase-google-manual.yml';
const TEST_STORE_PRODUCT_IDS = Object.freeze({
  monthly: 'monthly',
  annual: 'yearly',
});

function fail(message) {
  console.error(message);
  process.exit(1);
}

function exactRegex(value) {
  return `^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
}

function readPlan(argv) {
  const index = argv.indexOf('--plan');
  const plan = index === -1 ? 'monthly' : argv[index + 1];
  if (plan !== 'monthly' && plan !== 'annual') {
    fail('Invalid --plan. Use "monthly" or "annual".');
  }
  return plan;
}

function readAuthMode() {
  const authMode = process.env.REVENUECAT_QA_AUTH || 'email';
  if (authMode !== 'email' && authMode !== 'google') {
    fail('Invalid REVENUECAT_QA_AUTH. Use "email" or "google".');
  }
  return authMode;
}

function passthroughArgs(argv) {
  const out = [];
  let hasDevice = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--plan') {
      i += 1;
      continue;
    }
    if (argv[i] === '--preflight') {
      continue;
    }
    if (argv[i] === '--device') {
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
    fail(`Unsupported Maestro argument for guarded purchase: ${argv[i]}`);
  }
  if (!hasDevice) {
    fail('A specific QA target is required. Pass --device <adb-id>.');
  }
  return out;
}

const argv = process.argv.slice(2);
const preflight = argv.includes('--preflight');
const plan = readPlan(argv);
const authMode = readAuthMode();
const qaEmail = process.env.REVENUECAT_QA_EMAIL;
const qaPassword = process.env.REVENUECAT_QA_PASSWORD;
const approval = process.env.REVENUECAT_QA_APPROVAL;
const flow = authMode === 'google' ? GOOGLE_FLOW : EMAIL_FLOW;
const productId = TEST_STORE_PRODUCT_IDS[plan];

if (!qaEmail) {
  fail('Missing REVENUECAT_QA_EMAIL for the signed-in test account.');
}

if (authMode === 'email' && !qaPassword) {
  fail('Missing REVENUECAT_QA_PASSWORD for email/password auth.');
}

const maestroArgs = passthroughArgs(argv);
const targetDevice = maestroArgs[maestroArgs.indexOf('--device') + 1];
if (!/^emulator-\d+$/.test(targetDevice)) {
  fail('RevenueCat Test Store purchases are emulator-only; refusing a physical Play device.');
}

if (preflight) {
  console.log('Test Store purchase preflight passed.');
  console.log(`Plan: ${plan}`);
  console.log(`Auth mode: ${authMode}`);
  console.log('Test account: configured');
  console.log(`Approval present: ${approval === APPROVAL ? 'yes' : 'no'}`);
  console.log(`Flow: ${flow}`);
  console.log(`Maestro args: ${maestroArgs.length > 0 ? maestroArgs.join(' ') : 'none'}`);
  process.exit(0);
}

if (approval !== APPROVAL) {
  fail(`Refusing to start Test Store purchase. Set REVENUECAT_QA_APPROVAL=${APPROVAL} after explicit approval.`);
}

const args = [
  'run',
  'test:e2e:release:teststore:local',
  '--',
  '--flow',
  TESTSTORE_READINESS_FLOW,
  '--flow',
  flow,
  ...maestroArgs,
];

const result = spawnSync('npm', args, {
  cwd: ROOT,
  env: {
    ...process.env,
    [SENSITIVE_FLOW_GUARD_ENV]: getSensitiveFlowGuardToken(flow),
    QA_EMAIL_REGEX: exactRegex(qaEmail),
    QA_PLAN: plan,
    QA_PRODUCT_ID: productId,
    ...(authMode === 'email'
      ? { QA_EMAIL: qaEmail, QA_PASSWORD: qaPassword }
      : {}),
  },
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
