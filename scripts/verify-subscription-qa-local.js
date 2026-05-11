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
    label: 'syntax: guarded purchase runner',
    command: process.execPath,
    args: ['--check', 'scripts/run-subscription-teststore-purchase.js'],
  },
  {
    label: 'syntax: Android ADB device diagnostic',
    command: process.execPath,
    args: ['--check', 'scripts/check-android-adb-device.js'],
  },
  {
    label: 'unit: subscription QA scripts',
    command: npmCommand,
    args: [
      'test',
      '--',
      'scripts/subscription-qa-report.test.js',
      'scripts/update-subscription-qa-evidence.test.js',
      'scripts/run-subscription-teststore-purchase.test.js',
      'scripts/verify-subscription-qa-local.test.js',
      'scripts/check-android-adb-device.test.js',
      '--runInBand',
      '--watchman=false',
    ],
  },
  {
    label: 'report: subscription QA coverage',
    command: npmCommand,
    args: ['run', 'subscription:qa:report'],
    expectedStdoutIncludes: [
      '## Current Session Readiness',
      'Test Store signed-in account env',
      'RevenueCat product prodfce10ef2a8 must expose billing period P1M',
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
