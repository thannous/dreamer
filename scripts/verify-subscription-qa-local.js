#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const Module = require('module');
const os = require('os');
const path = require('path');
const vm = require('vm');

const { generateSubscriptionQaReport } = require('./subscription-qa-report');

const JEST_BIN = path.join('node_modules', 'jest', 'bin', 'jest.js');

const syntaxFiles = [
  'scripts/subscription-qa-report.js',
  'scripts/update-subscription-qa-evidence.js',
  'scripts/update-revenuecat-play-store-state.js',
  'scripts/update-revenuecat-subscriber-expiry-state.js',
  'scripts/update-google-play-subscription-state.js',
  'scripts/update-google-play-track-state.js',
  'scripts/update-google-cloud-project-state.js',
  'scripts/update-google-oauth-android-client-state.js',
  'scripts/update-google-play-payments-profile-state.js',
  'scripts/update-supabase-play-integrity-secrets-state.js',
  'scripts/android-tooling.js',
  'scripts/check-android-release-gates.js',
  'scripts/run-subscription-teststore-purchase.js',
  'scripts/run-subscription-teststore-restore.js',
  'scripts/run-subscription-account-switch.js',
  'scripts/check-android-adb-device.js',
  'scripts/check-play-install-source.js',
  'scripts/check-play-qa-device.js',
  'scripts/wait-for-play-qa-device.js',
  'scripts/extract-revenuecat-app-user-id.js',
];

const unitTestFiles = [
  'scripts/subscription-qa-report.test.js',
  'scripts/update-subscription-qa-evidence.test.js',
  'scripts/update-revenuecat-play-store-state.test.js',
  'scripts/update-revenuecat-subscriber-expiry-state.test.js',
  'scripts/update-google-play-subscription-state.test.js',
  'scripts/update-google-play-track-state.test.js',
  'scripts/update-google-cloud-project-state.test.js',
  'scripts/update-google-oauth-android-client-state.test.js',
  'scripts/update-google-play-payments-profile-state.test.js',
  'scripts/update-supabase-play-integrity-secrets-state.test.js',
  'scripts/run-subscription-teststore-purchase.test.js',
  'scripts/run-subscription-teststore-restore.test.js',
  'scripts/run-subscription-account-switch.test.js',
  'scripts/verify-subscription-qa-local.test.js',
  'scripts/check-android-release-gates.test.js',
  'scripts/check-android-adb-device.test.js',
  'scripts/check-play-install-source.test.js',
  'scripts/check-play-qa-device.test.js',
  'scripts/wait-for-play-qa-device.test.js',
  'scripts/extract-revenuecat-app-user-id.test.js',
];

const commands = [
  {
    type: 'syntax-batch',
    label: 'syntax: subscription QA scripts',
    files: syntaxFiles,
  },
  {
    label: 'unit: subscription QA scripts',
    command: process.execPath,
    args: [
      JEST_BIN,
      '--runTestsByPath',
      ...unitTestFiles,
      '--runInBand',
      '--watchman=false',
      '--selectProjects',
      'node',
    ],
  },
  {
    type: 'report',
    label: 'report: subscription QA coverage',
    command: process.execPath,
    args: ['scripts/subscription-qa-report.js'],
    env: {
      REVENUECAT_QA_EVIDENCE_PATH: path.join(os.tmpdir(), 'missing-revenuecat-qa-evidence.local.json'),
      REVENUECAT_PLAY_STORE_STATE_PATH: 'doc_web_interne/docs/revenuecat-play-store-state.example.json',
    },
    expectedStdoutIncludes: [
      '## Evidence Commands',
      'OK | Authenticated Test Store paywall flow exists',
      'Authenticated Test Store paywall',
      'npm run subscription:qa:evidence -- --gate play_monthly',
      '--installer-package-name com.android.vending',
      '## Current Session Readiness',
      'Verified manual/external scenarios: 0',
      'Manual or external gates remaining: 7',
      'Account switch | Test Store or Play | Plus user logout does not leak to free user',
      'Test Store signed-in account env',
      'Account switch second account env',
      'Device app user id extraction',
      'Physical Android device visibility',
      'npm run android:device:physical',
      'checks USB and ADB Wireless Debugging mDNS visibility',
      'Play install source diagnostic exists',
      'npm run android:play-install-source -- --device <adb-id>',
      'Play QA device preflight exists',
      'npm run android:play-qa-device -- --device <adb-id>',
      'Play QA device wait helper exists',
      'npm run android:play-qa-device:wait',
      'npm run android:play-qa-device:wait while connecting one Play-installed tester phone',
      'add -- --device <adb-id> when multiple devices are ready',
      'Play QA device preflight',
      'after the device is ready',
      'Google Play monthly base plan snapshot',
      'Google Play annual base plan snapshot',
      'Google Play internal track snapshot',
      'Google Play track state updater exists',
      'RevenueCat subscriber expiry snapshot',
      'RevenueCat subscriber expiry state updater exists',
      'Play monthly base plan snapshot',
      'Play annual base plan snapshot',
      'Google OAuth Android client snapshot parses',
      'Google OAuth Android client state updater exists',
      'Google Play payments profile snapshot parses',
      'Google Play payments profile state updater exists',
      'Google Play payments profile snapshot',
      'Supabase Play Integrity secrets snapshot parses',
      'Supabase Play Integrity secrets state updater exists',
      'Supabase Play Integrity secrets snapshot',
      'STALE',
      'refresh with npm run subscription:qa:play-state',
    ],
  },
  {
    type: 'report',
    label: 'guard: release gate blocks missing manual evidence',
    command: process.execPath,
    args: ['scripts/subscription-qa-report.js', '--require-full'],
    env: {
      REVENUECAT_QA_EVIDENCE_PATH: path.join(os.tmpdir(), 'missing-revenuecat-qa-evidence.local.json'),
    },
    expectedStatus: 1,
    expectedStdoutIncludes: [
      'Manual or external gates remaining: 7',
      'Full RevenueCat workflow is not complete: 7 manual or external gate(s) still require evidence.',
    ],
    forbiddenStdoutIncludes: ['Blocked checks:'],
  },
  {
    label: 'preflight: guarded Test Store monthly purchase CLI',
    command: process.execPath,
    args: ['scripts/run-subscription-teststore-purchase.js', '--preflight', '--plan', 'monthly', '--device', 'emulator-5554'],
    env: {
      REVENUECAT_QA_EMAIL: 'tester@example.com',
      REVENUECAT_QA_PASSWORD: 'password',
    },
  },
  {
    label: 'preflight: guarded Test Store annual purchase CLI',
    command: process.execPath,
    args: ['scripts/run-subscription-teststore-purchase.js', '--preflight', '--plan', 'annual', '--device', 'emulator-5554'],
    env: {
      REVENUECAT_QA_EMAIL: 'tester@example.com',
      REVENUECAT_QA_PASSWORD: 'password',
    },
  },
  {
    label: 'preflight: guarded Test Store restore CLI',
    command: process.execPath,
    args: ['scripts/run-subscription-teststore-restore.js', '--preflight', '--device', 'emulator-5554'],
    env: {
      REVENUECAT_QA_EMAIL: 'tester@example.com',
    },
  },
  {
    label: 'preflight: account switch CLI',
    command: process.execPath,
    args: ['scripts/run-subscription-account-switch.js', '--preflight', '--device', 'emulator-5554'],
    env: {
      REVENUECAT_QA_EMAIL: 'paid@example.com',
      REVENUECAT_QA_SWITCH_FREE_EMAIL: 'free@example.com',
      REVENUECAT_QA_SWITCH_FREE_PASSWORD: 'password',
    },
  },
];

function stripNodePreamble(source) {
  return String(source)
    .replace(/^\uFEFF/, '')
    .replace(/^#![^\r\n]*(?:\r?\n|$)/, '');
}

function checkNodeSyntaxFiles(files, options = {}) {
  const {
    cwd = process.cwd(),
    readFile = fs.readFileSync,
    compile = (source, filename) => new vm.Script(Module.wrap(source), { filename }),
  } = options;

  try {
    for (const file of files) {
      const filename = path.resolve(cwd, file);
      const source = stripNodePreamble(readFile(filename, 'utf8'));
      compile(source, filename);
    }
    return { status: 0, stdout: '', stderr: '' };
  } catch (error) {
    return {
      status: 1,
      stdout: '',
      stderr: `${error instanceof Error ? error.message : String(error)}\n`,
    };
  }
}

function runReportCommand(item, options = {}) {
  const {
    cwd = process.cwd(),
    env = process.env,
    generateReport = generateSubscriptionQaReport,
  } = options;
  const result = generateReport({
    root: cwd,
    args: item.args.slice(1),
    env,
  });
  return {
    status: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function exitCodeForUnexpectedStatus(result) {
  return result.status && result.status !== 0 ? result.status : 1;
}

function getResultError(item, result) {
  const expectedStatus = item.expectedStatus ?? 0;
  if (result.status !== expectedStatus) {
    return {
      exitCode: exitCodeForUnexpectedStatus(result),
      messages: [
        `Subscription QA local verification failed at: ${item.label}`,
        `Expected exit ${expectedStatus}, got ${result.status ?? 'unknown'}.`,
      ],
    };
  }
  for (const expectedOutput of item.expectedStdoutIncludes ?? []) {
    if (!result.stdout?.includes(expectedOutput)) {
      return {
        exitCode: 1,
        messages: [
          `Subscription QA local verification failed at: ${item.label}`,
          `Missing expected output: ${expectedOutput}`,
        ],
      };
    }
  }
  for (const forbiddenOutput of item.forbiddenStdoutIncludes ?? []) {
    if (result.stdout?.includes(forbiddenOutput)) {
      return {
        exitCode: 1,
        messages: [
          `Subscription QA local verification failed at: ${item.label}`,
          `Unexpected output: ${forbiddenOutput}`,
        ],
      };
    }
  }
  return null;
}

function runCommands(commandList = commands, options = {}) {
  const {
    cwd = process.cwd(),
    baseEnv = process.env,
    spawn = spawnSync,
    syntaxCheck = checkNodeSyntaxFiles,
    generateReport = generateSubscriptionQaReport,
    stdout = process.stdout,
    stderr = process.stderr,
  } = options;

  for (const item of commandList) {
    stdout.write(`\n> ${item.label}\n`);
    const itemEnv = {
      ...baseEnv,
      ...(item.env ?? {}),
    };
    let result;
    if (item.type === 'syntax-batch') {
      stdout.write(`$ syntax-check ${item.files.length} CommonJS files\n`);
      result = syntaxCheck(item.files, { cwd });
    } else if (item.type === 'report') {
      stdout.write(`$ ${[item.command, ...item.args].join(' ')}\n`);
      result = runReportCommand(item, { cwd, env: itemEnv, generateReport });
    } else {
      stdout.write(`$ ${[item.command, ...item.args].join(' ')}\n`);
      result = spawn(item.command, item.args, {
        cwd,
        env: itemEnv,
        encoding: 'utf8',
      });
    }
    if (result.stdout) stdout.write(result.stdout);
    if (result.stderr) stderr.write(result.stderr);

    const error = getResultError(item, result);
    if (error) {
      stderr.write(`\n${error.messages.join('\n')}\n`);
      return error.exitCode;
    }
  }

  stdout.write('\nSubscription QA local verification passed.\n');
  return 0;
}

if (require.main === module) {
  process.exitCode = runCommands();
}

module.exports = {
  checkNodeSyntaxFiles,
  commands,
  exitCodeForUnexpectedStatus,
  getResultError,
  runReportCommand,
  runCommands,
  syntaxFiles,
  unitTestFiles,
};
