#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_TARGET = path.join(ROOT, 'doc_web_interne/docs/google-oauth-android-client-state.local.json');
const EXPECTED = {
  clientId: '359653779023-5dhs012rh7l3cjf0leoknn7j0dlgq0ok.apps.googleusercontent.com',
  packageName: 'com.tanuki75.noctalia',
  sha1: 'BC:CF:C2:96:38:47:81:D6:8C:B7:B6:5A:BA:84:CB:B3:8C:85:E0:59',
};

function normalizeSha1(value) {
  return String(value || '').trim().toUpperCase();
}

function parseArgs(argv) {
  const options = {
    file: process.env.GOOGLE_OAUTH_ANDROID_CLIENT_STATE_PATH
      ? path.resolve(ROOT, process.env.GOOGLE_OAUTH_ANDROID_CLIENT_STATE_PATH)
      : DEFAULT_TARGET,
    checkedAt: new Date().toISOString(),
    source: 'Google Cloud Console Auth Platform client read-only check',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--client-id') {
      options.clientId = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--name') {
      options.name = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--package-name') {
      options.packageName = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--sha1') {
      options.sha1 = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--file') {
      options.file = path.resolve(ROOT, argv[i + 1] ?? '');
      i += 1;
      continue;
    }
    if (arg === '--checked-at') {
      options.checkedAt = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--source') {
      options.source = argv[i + 1];
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
  node ./scripts/update-google-oauth-android-client-state.js \\
    --client-id 359653779023-5dhs012rh7l3cjf0leoknn7j0dlgq0ok.apps.googleusercontent.com \\
    --name "Noctalia Android Production" \\
    --package-name com.tanuki75.noctalia \\
    --sha1 BC:CF:C2:96:38:47:81:D6:8C:B7:B6:5A:BA:84:CB:B3:8C:85:E0:59

Options:
  --client-id <id>       Android OAuth client ID from Google Cloud Console.
  --name <label>         Client display name.
  --package-name <pkg>   Android package name.
  --sha1 <fingerprint>   Certificate SHA-1 fingerprint.
  --file <path>          Snapshot file to update. Defaults to doc_web_interne/docs/google-oauth-android-client-state.local.json
  --checked-at <iso>     Override timestamp. Defaults to now.
  --source <label>       Snapshot source label.
`.trim());
}

function normalizeSnapshot(options) {
  if (Number.isNaN(Date.parse(options.checkedAt))) {
    throw new Error('--checked-at must be a valid date.');
  }
  if (options.clientId !== EXPECTED.clientId) {
    throw new Error(`Expected client ID ${EXPECTED.clientId}, got ${options.clientId || 'missing'}.`);
  }
  if (options.packageName !== EXPECTED.packageName) {
    throw new Error(`Expected package name ${EXPECTED.packageName}, got ${options.packageName || 'missing'}.`);
  }
  const sha1 = normalizeSha1(options.sha1);
  if (sha1 !== EXPECTED.sha1) {
    throw new Error(`Expected SHA-1 ${EXPECTED.sha1}, got ${sha1 || 'missing'}.`);
  }

  return {
    client_id: options.clientId,
    name: options.name || '',
    package_name: options.packageName,
    sha1,
    checked_at: options.checkedAt,
    source: options.source,
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function updateGoogleOAuthAndroidClientState(options) {
  const document = normalizeSnapshot(options);
  writeJson(options.file, document);
  return document;
}

function isOAuthAndroidClientSnapshotReady(snapshot) {
  return (
    snapshot?.client_id === EXPECTED.clientId &&
    snapshot?.package_name === EXPECTED.packageName &&
    normalizeSha1(snapshot?.sha1) === EXPECTED.sha1
  );
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const document = updateGoogleOAuthAndroidClientState(options);
    console.log(`Updated ${path.relative(ROOT, options.file)}`);
    console.log(`${document.client_id}: ${document.package_name}/${document.sha1}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

module.exports = {
  EXPECTED,
  isOAuthAndroidClientSnapshotReady,
  normalizeSnapshot,
  parseArgs,
  updateGoogleOAuthAndroidClientState,
};
