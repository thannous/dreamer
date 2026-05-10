#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APPROVAL = 'I_APPROVE_TEST_STORE_PURCHASE';
const FLOW = 'maestro/subscription-teststore-purchase-manual.yml';

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
const qaEmail = process.env.REVENUECAT_QA_EMAIL;
const qaPassword = process.env.REVENUECAT_QA_PASSWORD;
const approval = process.env.REVENUECAT_QA_APPROVAL;

if (!qaEmail || !qaPassword) {
  fail('Missing REVENUECAT_QA_EMAIL or REVENUECAT_QA_PASSWORD for the signed-in test account.');
}

const maestroArgs = passthroughArgs(argv);

if (preflight) {
  console.log('Test Store purchase preflight passed.');
  console.log(`Plan: ${plan}`);
  console.log(`Test account: ${maskIdentity(qaEmail)}`);
  console.log(`Approval present: ${approval === APPROVAL ? 'yes' : 'no'}`);
  console.log(`Flow: ${FLOW}`);
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
  FLOW,
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
    QA_PLAN: plan,
  },
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
