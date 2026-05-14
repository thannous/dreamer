#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_EXAMPLE = path.join(ROOT, 'doc_web_interne/docs/revenuecat-qa-evidence.example.json');
const DEFAULT_TARGET = path.join(ROOT, 'doc_web_interne/docs/revenuecat-qa-evidence.local.json');

function parseArgs(argv) {
  const options = {
    file: process.env.REVENUECAT_QA_EVIDENCE_PATH
      ? path.resolve(ROOT, process.env.REVENUECAT_QA_EVIDENCE_PATH)
      : DEFAULT_TARGET,
    testedAt: new Date().toISOString(),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--file') {
      options.file = path.resolve(ROOT, argv[i + 1] ?? '');
      i += 1;
      continue;
    }
    if (arg === '--gate') {
      options.gate = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--tester') {
      options.tester = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--app-user-id') {
      options.appUserId = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--evidence') {
      options.evidence = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--eas-build-id') {
      options.easBuildId = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--device-id') {
      options.deviceId = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--tested-at') {
      options.testedAt = argv[i + 1];
      i += 1;
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
  node ./scripts/update-subscription-qa-evidence.js --gate <key> --tester <email-or-label> --app-user-id <id> --evidence <summary>

Options:
  --file <path>        Evidence file to update. Defaults to doc_web_interne/docs/revenuecat-qa-evidence.local.json
  --tested-at <iso>    Override timestamp. Defaults to now.
  --eas-build-id <id>  Required for play_* gates; records the installed EAS build id.
  --device-id <id>     Required for play_* gates; ADB serial of the physical tester device.
                       play_monthly evidence must also confirm base plan P1M.

Before recording play_* gates, run:
  npm run android:play-qa-device -- --device <adb-id>

Gate keys:
  test_store_monthly, test_store_annual, restore_after_reinstall, account_switch,
  play_monthly, play_annual, play_cancellation_and_expiry
`.trim());
}

function requireValue(options, key, label) {
  if (typeof options[key] !== 'string' || options[key].trim().length === 0) {
    throw new Error(`Missing ${label}.`);
  }
}

function requireValidDate(value, label) {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be a valid date.`);
  }
}

function requireUuid(value, label) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())) {
    throw new Error(`${label} must be a valid UUID.`);
  }
}

function requireNonTemplateEvidence(options) {
  const template = readJson(DEFAULT_EXAMPLE);
  const templateEvidence = template.gates?.[options.gate]?.evidence?.trim();
  if (typeof options.evidence === 'string' && options.evidence.trim() === templateEvidence) {
    throw new Error('Evidence must describe the observed test result, not reuse the template text.');
  }
}

function requirePlayMonthlyBasePlanEvidence(options) {
  if (options.gate !== 'play_monthly') return;
  if (!/\bP1M\b/i.test(options.evidence.trim())) {
    throw new Error('Play monthly evidence must confirm base plan P1M.');
  }
}

function requirePlayInstalledEvidence(options) {
  if (!options.gate?.startsWith('play_')) return;
  const evidence = options.evidence.trim();
  if (!/(com\.android\.vending|play-installed|installed from play|installation play)/i.test(evidence)) {
    throw new Error('Play evidence must confirm the app was installed from Play Internal Testing.');
  }
}

function requirePlayDeviceId(options) {
  if (!options.gate?.startsWith('play_')) return;
  requireValue(options, 'deviceId', '--device-id');
  const deviceId = options.deviceId.trim();
  if (/^emulator-\d+$/i.test(deviceId)) {
    throw new Error('Play evidence device id must be a physical Android device, not an emulator.');
  }
}

function requireAccountSwitchEvidence(options) {
  if (options.gate !== 'account_switch') return;
  const evidence = options.evidence.trim();
  if (!/second account/i.test(evidence)) {
    throw new Error('Account switch evidence must confirm the second account.');
  }
  if (!/\bfree\b/i.test(evidence)) {
    throw new Error('Account switch evidence must confirm the second account is free.');
  }
  if (!/\binactive\b/i.test(evidence)) {
    throw new Error('Account switch evidence must confirm the second account is inactive.');
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function loadEvidence(filePath) {
  if (fs.existsSync(filePath)) {
    return readJson(filePath);
  }
  return readJson(DEFAULT_EXAMPLE);
}

function updateEvidence(options) {
  requireValue(options, 'gate', '--gate');
  requireValue(options, 'tester', '--tester');
  requireValue(options, 'appUserId', '--app-user-id');
  requireUuid(options.appUserId, '--app-user-id');
  requireValue(options, 'evidence', '--evidence');
  requireValue(options, 'testedAt', '--tested-at');
  requireValidDate(options.testedAt, '--tested-at');
  if (options.gate?.startsWith('play_')) {
    requireValue(options, 'easBuildId', '--eas-build-id');
    requireUuid(options.easBuildId, '--eas-build-id');
  }

  const document = loadEvidence(options.file);
  const gate = document.gates?.[options.gate];
  if (!gate) {
    throw new Error(`Unknown gate "${options.gate}". Run with --help for valid keys.`);
  }
  requireNonTemplateEvidence(options);
  requirePlayMonthlyBasePlanEvidence(options);
  requirePlayInstalledEvidence(options);
  requirePlayDeviceId(options);
  requireAccountSwitchEvidence(options);

  document.gates[options.gate] = {
    ...gate,
    status: 'passed',
    testedAt: options.testedAt,
    tester: options.tester,
    appUserId: options.appUserId,
    evidence: options.evidence,
    ...(options.easBuildId ? { easBuildId: options.easBuildId } : {}),
    ...(options.deviceId ? { deviceId: options.deviceId } : {}),
  };

  writeJson(options.file, document);
  return document.gates[options.gate];
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const gate = updateEvidence(options);
    console.log(`Updated ${options.gate}: ${gate.status} at ${gate.testedAt}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
  updateEvidence,
};
