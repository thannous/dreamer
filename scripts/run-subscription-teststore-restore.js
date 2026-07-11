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
const APPROVAL = 'I_APPROVE_TEST_STORE_RESTORE';
const CLEAR_STATE_APPROVAL = 'I_APPROVE_CLEAR_NOCTALIA_APP_STATE';
const PHYSICAL_DEVICE_APPROVAL = 'I_APPROVE_TEST_STORE_RESTORE_CLEAR_STATE_ON_PHYSICAL_DEVICE';
const FLOW = 'maestro/subscription-teststore-restore-google-manual.yml';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function maskIdentity(value) {
  const at = value.indexOf('@');
  if (at > 1) return `${value.slice(0, 2)}...${value.slice(at)}`;
  return value.length <= 6 ? 'provided' : `${value.slice(0, 3)}...${value.slice(-2)}`;
}

function exactRegex(value) {
  return `^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
}

function readTargetArgs(argv) {
  let device = null;
  let allowPhysical = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--preflight') continue;
    if (arg === '--allow-physical') {
      if (allowPhysical) fail('Pass --allow-physical only once.');
      allowPhysical = true;
      continue;
    }
    if (arg === '--device') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) fail('Missing value for --device.');
      if (device || value.includes(',')) {
        fail('Pass exactly one QA target with --device <adb-id>.');
      }
      device = value;
      i += 1;
      continue;
    }
    fail(`Unsupported Maestro argument for guarded restore: ${arg}`);
  }
  if (!device) {
    fail('A specific QA target is required. Pass --device <adb-id>.');
  }
  return { allowPhysical, device, maestroArgs: ['--device', device] };
}

const argv = process.argv.slice(2);
const preflight = argv.includes('--preflight');
const qaEmail = process.env.REVENUECAT_QA_EMAIL;
const approval = process.env.REVENUECAT_QA_RESTORE_APPROVAL;
const clearStateApproval = process.env.REVENUECAT_QA_CLEAR_STATE_APPROVAL;
const physicalDeviceApproval = process.env.REVENUECAT_QA_PHYSICAL_DEVICE_APPROVAL;

if (!qaEmail) fail('Missing REVENUECAT_QA_EMAIL for the Test Store account to restore.');

const target = readTargetArgs(argv);
const isEmulator = /^emulator-\d+$/.test(target.device);

if (!isEmulator) {
  if (!target.allowPhysical) {
    fail('Restore clearState is emulator-only by default. Pass --allow-physical for an authorized QA phone.');
  }
  if (physicalDeviceApproval !== PHYSICAL_DEVICE_APPROVAL) {
    fail(
      `Refusing physical-device restore. Set REVENUECAT_QA_PHYSICAL_DEVICE_APPROVAL=${PHYSICAL_DEVICE_APPROVAL}.`
    );
  }
}

if (preflight) {
  console.log('Test Store restore preflight passed.');
  console.log(`Test account: ${maskIdentity(qaEmail)}`);
  console.log(`Approval present: ${approval === APPROVAL ? 'yes' : 'no'}`);
  console.log(`Clear-state approval present: ${clearStateApproval === CLEAR_STATE_APPROVAL ? 'yes' : 'no'}`);
  console.log(`Target: ${isEmulator ? 'emulator' : 'authorized physical device'} (${target.device})`);
  console.log(`Flow: ${FLOW}`);
  console.log(`Maestro args: ${target.maestroArgs.join(' ')}`);
  process.exit(0);
}

if (approval !== APPROVAL) {
  fail(`Refusing to start Test Store restore. Set REVENUECAT_QA_RESTORE_APPROVAL=${APPROVAL} after explicit approval.`);
}

if (clearStateApproval !== CLEAR_STATE_APPROVAL) {
  fail(
    `Refusing to clear Noctalia app state. Set REVENUECAT_QA_CLEAR_STATE_APPROVAL=${CLEAR_STATE_APPROVAL}.`
  );
}

const result = spawnSync(
  'npm',
  [
    'run',
    'test:e2e:release:teststore:local',
    '--',
    '--flow',
    TESTSTORE_READINESS_FLOW,
    '--flow',
    FLOW,
    ...target.maestroArgs,
  ],
  {
    cwd: ROOT,
    env: {
      ...process.env,
      [SENSITIVE_FLOW_GUARD_ENV]: getSensitiveFlowGuardToken(FLOW),
      QA_EMAIL_REGEX: exactRegex(qaEmail),
    },
    stdio: 'inherit',
  }
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
