#!/usr/bin/env node
'use strict';

const { checkPlayQaDevice, formatReport } = require('./check-play-qa-device');

const DEFAULT_INTERVAL_MS = 5000;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

function parsePositiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return number;
}

function parseArgs(argv) {
  const options = {
    intervalMs: DEFAULT_INTERVAL_MS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    requireUiReady: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--device') {
      options.device = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--package') {
      options.packageName = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--expected-version-code') {
      options.expectedVersionCode = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--interval-ms') {
      options.intervalMs = parsePositiveInteger(argv[i + 1], '--interval-ms');
      i += 1;
      continue;
    }
    if (arg === '--timeout-ms') {
      options.timeoutMs = parsePositiveInteger(argv[i + 1], '--timeout-ms');
      i += 1;
      continue;
    }
    if (arg === '--require-ui-ready') {
      options.requireUiReady = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`
Usage:
  node ./scripts/wait-for-play-qa-device.js [--device <adb-id>] [--package <application-id>] [--expected-version-code <code>] [--interval-ms <ms>] [--timeout-ms <ms>] [--require-ui-ready]

Polls the Play RevenueCat QA device preflight until a physical Android device
is visible and Noctalia is installed from Google Play. When ready, it prints the
play_* evidence commands.

Use --expected-version-code to wait for a specific Play build before recording
evidence.
Use --require-ui-ready before UI-driven purchase or restore flows to keep polling
until the tester phone also appears awake and unlocked.
`.trim());
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForPlayQaDevice(options = {}) {
  const {
    intervalMs = DEFAULT_INTERVAL_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    check = checkPlayQaDevice,
    sleepFn = sleep,
    now = Date.now,
    stdout = process.stdout,
    stderr = process.stderr,
    ...checkOptions
  } = options;
  const requireUiReady = Boolean(checkOptions.requireUiReady);
  const expectedVersionCode = checkOptions.expectedVersionCode;
  delete checkOptions.requireUiReady;

  const startedAt = now();
  let attempt = 0;
  let lastReport = null;

  while (now() - startedAt <= timeoutMs) {
    attempt += 1;
    stdout.write(`[play-qa-device:wait] attempt ${attempt}\n`);
    lastReport = check(checkOptions);
    stdout.write(`${formatReport(lastReport)}\n`);
    if (lastReport.ok && (!requireUiReady || lastReport.uiState?.ok)) {
      stdout.write('[play-qa-device:wait] ready\n');
      return { ok: true, attempts: attempt, report: lastReport };
    }
    if (lastReport.ok && requireUiReady && !lastReport.uiState?.ok) {
      stdout.write('[play-qa-device:wait] waiting for unlocked awake phone (--require-ui-ready)\n');
    }
    await sleepFn(intervalMs);
  }

  const criteria = [];
  if (expectedVersionCode !== undefined && expectedVersionCode !== null) {
    criteria.push(`matching versionCode ${String(expectedVersionCode).trim()}`);
  }
  if (requireUiReady) {
    criteria.push('UI ready');
  }
  stderr.write(
    `[play-qa-device:wait] timed out waiting for a Play-installed physical device${
      criteria.length > 0 ? ` (${criteria.join(', ')})` : ''
    }.\n`
  );
  return { ok: false, attempts: attempt, report: lastReport };
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await waitForPlayQaDevice(options);
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  DEFAULT_INTERVAL_MS,
  DEFAULT_TIMEOUT_MS,
  parseArgs,
  waitForPlayQaDevice,
};
