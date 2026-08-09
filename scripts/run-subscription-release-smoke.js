#!/usr/bin/env node
'use strict';
/* global __dirname */

const fs = require('fs');
const path = require('path');
const {
  checkPlayQaDevice,
} = require('./check-play-qa-device');
const {
  generateSubscriptionQaReport,
} = require('./subscription-qa-report');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const options = {
    json: false,
    reportOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--device') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('Missing value for --device.');
      options.device = value;
      index += 1;
      continue;
    }
    if (arg === '--version-code') {
      const value = argv[index + 1];
      if (!value || !/^[1-9]\d*$/.test(value)) {
        throw new Error('--version-code must be a positive integer.');
      }
      options.versionCode = value;
      index += 1;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--report-only') {
      options.reportOnly = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`
Usage:
  npm run subscription:qa:release-smoke -- [--device <adb-id>] [--version-code <code>] [--json] [--report-only]

Runs one final RevenueCat release verdict with three assertions:
1. the candidate is installed from Google Play and matches app.json versionCode
2. restore evidence is valid for the candidate
3. account isolation evidence is valid for the candidate

When --device is omitted, exactly one ready physical Android device must be visible.
This command never purchases, restores, clears app data, or changes an account. It only
checks the live Play-installed binary and the structured local evidence already recorded.

Use npm run subscription:qa:full-gate when Billing products, purchase/paywall wiring,
RevenueCat keys/SDK, or webhook lifecycle behavior changed.
`.trim());
}

function readAppIdentity(root = ROOT, readFile = fs.readFileSync) {
  const config = JSON.parse(readFile(path.join(root, 'app.json'), 'utf8'));
  const versionName = String(config?.expo?.version ?? '').trim();
  const packageName = String(config?.expo?.android?.package ?? '').trim();
  const versionCode = String(config?.expo?.android?.versionCode ?? '').trim();

  if (!versionName) throw new Error('app.json expo.version is required.');
  if (!packageName) throw new Error('app.json expo.android.package is required.');
  if (!/^[1-9]\d*$/.test(versionCode)) {
    throw new Error('app.json expo.android.versionCode must be a positive integer.');
  }

  return { packageName, versionCode, versionName };
}

function buildLivePlayAssertion({ identity, expectedVersionCode, deviceReport }) {
  const sourceMatches = expectedVersionCode === identity.versionCode;
  let detail;
  if (!sourceMatches) {
    detail = `Requested versionCode ${expectedVersionCode} does not match app.json ${identity.versionCode}.`;
  } else if (!deviceReport?.ok) {
    detail = deviceReport?.message || 'Play-installed candidate preflight failed.';
  } else {
    detail = `Google Play installed ${identity.versionName} (${expectedVersionCode}) on ${deviceReport.selectedDevice}.`;
  }

  return {
    key: 'play_candidate_identity',
    label: 'Play candidate identity',
    status: sourceMatches && Boolean(deviceReport?.ok) ? 'pass' : 'blocked',
    detail,
  };
}

function runReleaseSmoke(options = {}, dependencies = {}) {
  const root = options.root ?? ROOT;
  const env = dependencies.env ?? process.env;
  const identity = (dependencies.readAppIdentity ?? readAppIdentity)(root);
  const expectedVersionCode = String(options.versionCode ?? identity.versionCode);
  const deviceReport = (dependencies.checkPlayQaDevice ?? checkPlayQaDevice)({
    device: options.device,
    packageName: identity.packageName,
    expectedVersionCode,
    env,
    platform: dependencies.platform ?? process.platform,
  });
  const qaReport = (dependencies.generateSubscriptionQaReport ?? generateSubscriptionQaReport)({
    root,
    args: ['--require-release'],
    env,
  });
  const liveAssertion = buildLivePlayAssertion({
    identity,
    expectedVersionCode,
    deviceReport,
  });
  const evidenceAssertions = (qaReport.releaseSmoke?.assertions ?? []).map((assertion) => ({
    key: assertion.key,
    label: assertion.label,
    status: assertion.status,
    detail: assertion.scenario,
  }));
  const assertions = [liveAssertion, ...evidenceAssertions];
  const verified = assertions.filter((assertion) => assertion.status === 'pass').length;
  const ok =
    assertions.length === 3 &&
    verified === assertions.length &&
    qaReport.releaseSmoke?.status === 'pass';

  return {
    ok,
    candidate: identity,
    expectedVersionCode,
    selectedDevice: deviceReport?.selectedDevice ?? null,
    installerPackageName: deviceReport?.playInstallSource?.installerPackageName ?? null,
    assertions,
    verified,
    total: assertions.length,
  };
}

function formatReleaseSmoke(result) {
  const lines = [
    '[subscription-release-smoke] RevenueCat Play release smoke',
    `[subscription-release-smoke] candidate: ${result.candidate.versionName} (${result.candidate.versionCode})`,
    `[subscription-release-smoke] assertions: ${result.verified}/${result.total}`,
  ];

  for (const assertion of result.assertions) {
    lines.push(
      `[subscription-release-smoke] ${assertion.status === 'pass' ? 'PASS' : 'BLOCKED'} - ${assertion.label}: ${assertion.detail}`
    );
  }
  lines.push(
    `[subscription-release-smoke] ${result.ok ? 'PASS' : 'BLOCKED'} - final release smoke`
  );
  if (!result.ok) {
    lines.push(
      '  Next: use npm run subscription:qa:report for evidence diagnostics, then rerun this command on the Play-installed candidate.'
    );
  }
  return lines.join('\n');
}

function toJsonReceipt(result) {
  return {
    status: result.ok ? 'pass' : 'blocked',
    candidate: result.candidate,
    expectedVersionCode: result.expectedVersionCode,
    selectedDevice: result.selectedDevice,
    installerPackageName: result.installerPackageName,
    assertions: result.assertions,
    verified: result.verified,
    total: result.total,
  };
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
      return;
    }
    const result = runReleaseSmoke(options);
    process.stdout.write(
      options.json
        ? `${JSON.stringify(toJsonReceipt(result), null, 2)}\n`
        : `${formatReleaseSmoke(result)}\n`
    );
    if (!result.ok && !options.reportOnly) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  buildLivePlayAssertion,
  formatReleaseSmoke,
  parseArgs,
  readAppIdentity,
  runReleaseSmoke,
  toJsonReceipt,
};
