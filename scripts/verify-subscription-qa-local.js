#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const os = require('os');
const path = require('path');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const commands = [
  {
    label: 'syntax: subscription QA report',
    command: process.execPath,
    args: ['--check', 'scripts/subscription-qa-report.js'],
  },
  {
    label: 'syntax: evidence updater',
    command: process.execPath,
    args: ['--check', 'scripts/update-subscription-qa-evidence.js'],
  },
  {
    label: 'syntax: Play store state updater',
    command: process.execPath,
    args: ['--check', 'scripts/update-revenuecat-play-store-state.js'],
  },
  {
    label: 'syntax: Google Play subscription state updater',
    command: process.execPath,
    args: ['--check', 'scripts/update-google-play-subscription-state.js'],
  },
  {
    label: 'syntax: Google Cloud project state updater',
    command: process.execPath,
    args: ['--check', 'scripts/update-google-cloud-project-state.js'],
  },
  {
    label: 'syntax: Android tooling resolver',
    command: process.execPath,
    args: ['--check', 'scripts/android-tooling.js'],
  },
  {
    label: 'syntax: Android release gates',
    command: process.execPath,
    args: ['--check', 'scripts/check-android-release-gates.js'],
  },
  {
    label: 'syntax: guarded purchase runner',
    command: process.execPath,
    args: ['--check', 'scripts/run-subscription-teststore-purchase.js'],
  },
  {
    label: 'syntax: account switch runner',
    command: process.execPath,
    args: ['--check', 'scripts/run-subscription-account-switch.js'],
  },
  {
    label: 'syntax: Android ADB device diagnostic',
    command: process.execPath,
    args: ['--check', 'scripts/check-android-adb-device.js'],
  },
  {
    label: 'syntax: Play install source diagnostic',
    command: process.execPath,
    args: ['--check', 'scripts/check-play-install-source.js'],
  },
  {
    label: 'syntax: Play QA device preflight',
    command: process.execPath,
    args: ['--check', 'scripts/check-play-qa-device.js'],
  },
  {
    label: 'syntax: Play QA device wait helper',
    command: process.execPath,
    args: ['--check', 'scripts/wait-for-play-qa-device.js'],
  },
  {
    label: 'syntax: RevenueCat device app user id extractor',
    command: process.execPath,
    args: ['--check', 'scripts/extract-revenuecat-app-user-id.js'],
  },
  {
    label: 'unit: subscription QA scripts',
    command: npmCommand,
    args: [
      'test',
      '--',
      'scripts/subscription-qa-report.test.js',
      'scripts/update-subscription-qa-evidence.test.js',
      'scripts/update-revenuecat-play-store-state.test.js',
      'scripts/update-google-play-subscription-state.test.js',
      'scripts/update-google-cloud-project-state.test.js',
      'scripts/run-subscription-teststore-purchase.test.js',
      'scripts/run-subscription-account-switch.test.js',
      'scripts/verify-subscription-qa-local.test.js',
      'scripts/check-android-release-gates.test.js',
      'scripts/check-android-adb-device.test.js',
      'scripts/check-play-install-source.test.js',
      'scripts/check-play-qa-device.test.js',
      'scripts/wait-for-play-qa-device.test.js',
      'scripts/extract-revenuecat-app-user-id.test.js',
      '--runInBand',
      '--watchman=false',
    ],
  },
  {
    label: 'report: subscription QA coverage',
    command: npmCommand,
    args: ['run', 'subscription:qa:report'],
    expectedStdoutIncludes: [
      '## Evidence Commands',
      'npm run subscription:qa:evidence -- --gate play_monthly',
      '--installer-package-name com.android.vending',
      '## Current Session Readiness',
      'Verified manual/external scenarios: 4',
      'Manual or external gates remaining: 3',
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
      'Play monthly base plan snapshot',
      'Play annual base plan snapshot',
      'expected P1M',
      'expected P1Y',
    ],
  },
  {
    label: 'guard: release gate blocks missing manual evidence',
    command: npmCommand,
    args: ['run', 'subscription:qa:release-gate'],
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
    command: npmCommand,
    args: ['run', 'test:e2e:subscription-teststore:purchase:preflight', '--', '--plan', 'monthly'],
    env: {
      REVENUECAT_QA_EMAIL: 'tester@example.com',
      REVENUECAT_QA_PASSWORD: 'password',
    },
  },
  {
    label: 'preflight: guarded Test Store annual purchase CLI',
    command: npmCommand,
    args: ['run', 'test:e2e:subscription-teststore:purchase:preflight', '--', '--plan', 'annual'],
    env: {
      REVENUECAT_QA_EMAIL: 'tester@example.com',
      REVENUECAT_QA_PASSWORD: 'password',
    },
  },
  {
    label: 'preflight: account switch CLI',
    command: npmCommand,
    args: ['run', 'test:e2e:subscription-teststore:account-switch:preflight', '--', '--device', 'emulator-5554'],
    env: {
      REVENUECAT_QA_SWITCH_FREE_EMAIL: 'free@example.com',
      REVENUECAT_QA_SWITCH_FREE_PASSWORD: 'password',
    },
  },
];

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
    stdout = process.stdout,
    stderr = process.stderr,
  } = options;

  for (const item of commandList) {
    stdout.write(`\n> ${item.label}\n`);
    stdout.write(`$ ${[item.command, ...item.args].join(' ')}\n`);
    const result = spawn(item.command, item.args, {
      cwd,
      env: {
        ...baseEnv,
        ...(item.env ?? {}),
      },
      encoding: 'utf8',
    });
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
  commands,
  exitCodeForUnexpectedStatus,
  getResultError,
  runCommands,
};
