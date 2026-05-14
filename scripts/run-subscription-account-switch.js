#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APPROVAL = 'I_APPROVE_ACCOUNT_SWITCH_TEST';
const FLOW = 'maestro/subscription-teststore-account-switch-free-email-manual.yml';

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

function passthroughArgs(argv) {
  return argv.filter((arg) => arg !== '--preflight');
}

const argv = process.argv.slice(2);
const preflight = argv.includes('--preflight');
const freeEmail = process.env.REVENUECAT_QA_SWITCH_FREE_EMAIL;
const freePassword = process.env.REVENUECAT_QA_SWITCH_FREE_PASSWORD;
const approval = process.env.REVENUECAT_QA_SWITCH_APPROVAL;
const maestroArgs = passthroughArgs(argv);

if (!freeEmail) {
  fail('Missing REVENUECAT_QA_SWITCH_FREE_EMAIL for the second real account.');
}

if (!freePassword) {
  fail('Missing REVENUECAT_QA_SWITCH_FREE_PASSWORD for the second real account.');
}

if (preflight) {
  console.log('Account switch preflight passed.');
  console.log('Precondition: app is currently signed in as the paid Plus account.');
  console.log(`Second account: ${maskIdentity(freeEmail)}`);
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
    QA_SWITCH_FREE_EMAIL: freeEmail,
    QA_SWITCH_FREE_PASSWORD: freePassword,
  },
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
