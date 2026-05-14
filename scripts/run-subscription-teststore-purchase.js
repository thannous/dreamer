#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APPROVAL = 'I_APPROVE_TEST_STORE_PURCHASE';
const EMAIL_FLOW = 'maestro/subscription-teststore-purchase-manual.yml';
const GOOGLE_FLOW = 'maestro/subscription-teststore-purchase-google-manual.yml';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function maskIdentity(value) {
  const at = value.indexOf('@');
  if (at > 1) {
    return `${value.slice(0, 2)}...${value.slice(at)}`;
  }
  if (value.length <= 6) {
    return 'provided';
  }
  return `${value.slice(0, 3)}...${value.slice(-2)}`;
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
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--plan') {
      i += 1;
      continue;
    }
    if (argv[i] === '--preflight') {
      continue;
    }
    out.push(argv[i]);
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

if (!qaEmail) {
  fail('Missing REVENUECAT_QA_EMAIL for the signed-in test account.');
}

if (authMode === 'email' && !qaPassword) {
  fail('Missing REVENUECAT_QA_PASSWORD for email/password auth.');
}

const maestroArgs = passthroughArgs(argv);

if (preflight) {
  console.log('Test Store purchase preflight passed.');
  console.log(`Plan: ${plan}`);
  console.log(`Auth mode: ${authMode}`);
  console.log(`Test account: ${maskIdentity(qaEmail)}`);
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
  'test:e2e:subscription-teststore',
  '--',
  '--flow',
  flow,
  '--retries',
  '0',
  ...maestroArgs,
];

const result = spawnSync('npm', args, {
  cwd: ROOT,
  env: {
    ...process.env,
    QA_EMAIL: qaEmail,
    QA_PASSWORD: qaPassword,
    QA_AUTH: authMode,
    QA_PLAN: plan,
  },
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
