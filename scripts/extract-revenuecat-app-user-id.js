#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { parseDotEnv, resolveCommand } = require('./check-android-release-gates');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_APP_ID = 'com.tanuki75.noctalia';
const DEFAULT_ENV_FILE = '.env.teststore';
const RC_PREFS_FILE = 'shared_prefs/com_revenuecat_purchases_preferences.xml';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function usage() {
  return `
Usage:
  node ./scripts/extract-revenuecat-app-user-id.js [--device emulator-5554] [--env-file .env.teststore]
  node ./scripts/extract-revenuecat-app-user-id.js --source logcat [--device <adb-id>]

Options:
  --app-id <id>       Android application id. Defaults to ${DEFAULT_APP_ID}.
  --device <serial>   ADB device serial passed to adb -s.
  --env-file <path>   Env file containing EXPO_PUBLIC_REVENUECAT_ANDROID_KEY. Defaults to ${DEFAULT_ENV_FILE}.
  --source <source>   prefs reads RevenueCat shared_prefs via run-as; logcat reads the latest app user id
                      from subscription logs. Defaults to prefs.
  --json              Print machine-readable JSON.
`.trim();
}

function parseArgs(argv) {
  const options = {
    appId: DEFAULT_APP_ID,
    device: null,
    envFile: DEFAULT_ENV_FILE,
    source: 'prefs',
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--app-id' || arg === '--device' || arg === '--env-file' || arg === '--source') {
      const next = argv[index + 1];
      if (!next || next.startsWith('--')) {
        throw new Error(`Missing value for ${arg}`);
      }
      if (arg === '--app-id') options.appId = next;
      if (arg === '--device') options.device = next;
      if (arg === '--env-file') options.envFile = next;
      if (arg === '--source') {
        if (next !== 'prefs' && next !== 'logcat') {
          throw new Error(`Invalid --source value: ${next}. Expected prefs or logcat.`);
        }
        options.source = next;
      }
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function mask(value) {
  if (!value) return 'missing';
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeXmlText(value) {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function getRevenueCatKey(envFilePath, readFile = fs.readFileSync) {
  const raw = readFile(envFilePath, 'utf8');
  const env = parseDotEnv(raw);
  const key = env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY?.trim();
  if (!key) {
    throw new Error(`Missing EXPO_PUBLIC_REVENUECAT_ANDROID_KEY in ${envFilePath}`);
  }
  return key;
}

function parseAppUserIdFromPrefsXml(xml, revenueCatKey) {
  const escapedKey = escapeRegExp(revenueCatKey);
  const exactPattern = new RegExp(
    `<string\\s+name="com\\.revenuecat\\.purchases\\.${escapedKey}\\.new">([^<]+)</string>`
  );
  const exactMatch = String(xml).match(exactPattern);
  const value = exactMatch?.[1]?.trim();
  if (value && UUID_RE.test(value)) return decodeXmlText(value);

  const fallbackPattern = /<string\s+name="com\.revenuecat\.purchases\.[^"]+\.new">([^<]+)<\/string>/g;
  const candidates = [];
  let match = fallbackPattern.exec(String(xml));
  while (match) {
    const candidate = decodeXmlText(match[1].trim());
    if (UUID_RE.test(candidate)) candidates.push(candidate);
    match = fallbackPattern.exec(String(xml));
  }
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    throw new Error(
      `Found ${candidates.length} RevenueCat app user ids, but none matched key ${mask(revenueCatKey)}`
    );
  }
  throw new Error(`No RevenueCat app user id found for key ${mask(revenueCatKey)}`);
}

function parseAppUserIdFromLogcat(output) {
  const matches = [];
  const pattern = /userId:\s*['"]([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})['"]/gi;
  let match = pattern.exec(String(output));
  while (match) {
    matches.push(match[1]);
    match = pattern.exec(String(output));
  }

  if (!matches.length) {
    throw new Error('No subscription userId UUID found in logcat. Clear logcat, trigger Restore or Refresh, then retry.');
  }
  return matches[matches.length - 1];
}

function readPrefsXmlFromDevice({
  adbCommand,
  appId,
  device,
  spawn = spawnSync,
}) {
  const args = [];
  if (device) args.push('-s', device);
  args.push('shell', 'run-as', appId, 'cat', RC_PREFS_FILE);

  const result = spawn(adbCommand, args, {
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: 1024 * 1024 * 4,
  });
  if (result.status !== 0) {
    throw new Error(
      (result.stderr || result.stdout || `Unable to read ${RC_PREFS_FILE} from ${appId}`).trim()
    );
  }
  return result.stdout;
}

function readLogcatFromDevice({
  adbCommand,
  device,
  spawn = spawnSync,
}) {
  const args = [];
  if (device) args.push('-s', device);
  args.push('logcat', '-d', '-v', 'time', 'ReactNativeJS:I', '*:S');

  const result = spawn(adbCommand, args, {
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: 1024 * 1024 * 4,
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'Unable to read logcat').trim());
  }
  return result.stdout;
}

function extractRevenueCatAppUserId({
  appId = DEFAULT_APP_ID,
  device = null,
  envFile = DEFAULT_ENV_FILE,
  source = 'prefs',
  env = process.env,
  existsSync = fs.existsSync,
  readFile = fs.readFileSync,
  spawn = spawnSync,
} = {}) {
  const adbCommand = resolveCommand('adb', { spawn, existsSync, env });
  if (!adbCommand) {
    throw new Error('adb is not available in PATH or common Android SDK locations.');
  }

  let appUserId;
  let envFileValue = 'not-read';
  let revenueCatKeyMasked = 'not-read';

  if (source === 'prefs') {
    const envPath = path.resolve(ROOT, envFile);
    if (!existsSync(envPath)) {
      throw new Error(`Env file not found: ${envPath}`);
    }

    const revenueCatKey = getRevenueCatKey(envPath, readFile);
    const xml = readPrefsXmlFromDevice({ adbCommand, appId, device, spawn });
    appUserId = parseAppUserIdFromPrefsXml(xml, revenueCatKey);
    envFileValue = path.relative(ROOT, envPath);
    revenueCatKeyMasked = mask(revenueCatKey);
  } else if (source === 'logcat') {
    const output = readLogcatFromDevice({ adbCommand, device, spawn });
    appUserId = parseAppUserIdFromLogcat(output);
  } else {
    throw new Error(`Invalid source: ${source}`);
  }

  return {
    appId,
    appUserId,
    device: device || 'default',
    envFile: envFileValue,
    revenueCatKeyMasked,
    source,
  };
}

function formatReport(report) {
  return [
    '[revenuecat-app-user-id] Device RevenueCat identity',
    `[revenuecat-app-user-id] app: ${report.appId}`,
    `[revenuecat-app-user-id] device: ${report.device}`,
    `[revenuecat-app-user-id] env: ${report.envFile}`,
    `[revenuecat-app-user-id] sdk key: ${report.revenueCatKeyMasked}`,
    `[revenuecat-app-user-id] appUserId: ${report.appUserId}`,
  ].join('\n');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const report = extractRevenueCatAppUserId(options);
  process.stdout.write(options.json ? `${JSON.stringify(report, null, 2)}\n` : `${formatReport(report)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `[revenuecat-app-user-id] ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_APP_ID,
  DEFAULT_ENV_FILE,
  RC_PREFS_FILE,
  extractRevenueCatAppUserId,
  formatReport,
  getRevenueCatKey,
  mask,
  parseAppUserIdFromLogcat,
  parseAppUserIdFromPrefsXml,
  parseArgs,
  readLogcatFromDevice,
  readPrefsXmlFromDevice,
};
