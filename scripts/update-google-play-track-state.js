#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_TARGET = path.join(ROOT, 'doc_web_interne/docs/google-play-track-state.local.json');
const EXPECTED = {
  packageName: 'com.tanuki75.noctalia',
  track: 'internal',
  versionCode: '24',
  status: 'completed',
};

function parseArgs(argv) {
  const options = {
    file: process.env.GOOGLE_PLAY_TRACK_STATE_PATH
      ? path.resolve(ROOT, process.env.GOOGLE_PLAY_TRACK_STATE_PATH)
      : DEFAULT_TARGET,
    checkedAt: new Date().toISOString(),
    source: 'Google Play Developer API edits.tracks.get',
    packageName: EXPECTED.packageName,
    track: EXPECTED.track,
    expectedVersionCode: EXPECTED.versionCode,
    expectedStatus: EXPECTED.status,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') {
      options.input = path.resolve(ROOT, argv[i + 1] ?? '');
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
    if (arg === '--package-name') {
      options.packageName = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--track') {
      options.track = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--expected-version-code') {
      options.expectedVersionCode = String(argv[i + 1] ?? '');
      i += 1;
      continue;
    }
    if (arg === '--expected-status') {
      options.expectedStatus = String(argv[i + 1] ?? '').toLowerCase();
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
  node ./scripts/update-google-play-track-state.js --input <edits.tracks.get.json>
  curl .../edits/<editId>/tracks/internal | node ./scripts/update-google-play-track-state.js

Options:
  --input <path>                  Google Play Developer API edits.tracks.get JSON. Defaults to stdin.
  --file <path>                   Snapshot file to update. Defaults to doc_web_interne/docs/google-play-track-state.local.json
  --checked-at <iso>              Override timestamp. Defaults to now.
  --source <label>                Snapshot source label.
  --package-name <name>           Package name recorded in the snapshot.
  --track <name>                  Expected track. Defaults to internal.
  --expected-version-code <code>  Expected versionCode. Defaults to 24.
  --expected-status <status>      Expected release status. Defaults to completed.
`.trim());
}

function readInput(options, stdin = process.stdin) {
  if (options.input) {
    return fs.readFileSync(options.input, 'utf8');
  }
  if (stdin.isTTY) {
    throw new Error('Missing --input. You can also pipe Google Play edits.tracks.get JSON through stdin.');
  }
  return fs.readFileSync(0, 'utf8');
}

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Google Play track input must be valid JSON: ${error instanceof Error ? error.message : error}`);
  }
}

function normalizeVersionCodes(release) {
  return (release?.versionCodes ?? release?.version_codes ?? [])
    .map((versionCode) => String(versionCode).trim())
    .filter(Boolean);
}

function normalizeRelease(release) {
  return {
    name: String(release?.name ?? '').trim(),
    status: String(release?.status ?? 'unknown').trim().toLowerCase(),
    version_codes: normalizeVersionCodes(release),
  };
}

function normalizeSnapshot(input, options) {
  if (Number.isNaN(Date.parse(options.checkedAt))) {
    throw new Error('--checked-at must be a valid date.');
  }
  if (!/^[1-9]\d*$/.test(String(options.expectedVersionCode || ''))) {
    throw new Error('--expected-version-code must be a positive integer.');
  }

  const snapshot = parseJson(input);
  if (snapshot.track !== options.track) {
    throw new Error(`Expected track ${options.track}, got ${snapshot.track ?? 'missing'}.`);
  }

  return {
    package_name: options.packageName,
    track: snapshot.track,
    expected_version_code: String(options.expectedVersionCode),
    expected_status: options.expectedStatus,
    releases: (snapshot.releases ?? []).map(normalizeRelease),
    checked_at: options.checkedAt,
    source: options.source,
  };
}

function getExpectedRelease(document) {
  return (
    document?.releases?.find((release) =>
      (release.version_codes ?? []).includes(String(document.expected_version_code))
    ) ?? null
  );
}

function getTrackStatus(document) {
  const release = getExpectedRelease(document);
  if (!release) {
    return {
      ready: false,
      summary: `${document.track || 'unknown'}/missing/${document.expected_version_code || 'missing'}`,
    };
  }
  return {
    ready: release.status === document.expected_status,
    summary: `${document.track}/${release.name || 'unnamed'}/${release.status}/versionCode=${document.expected_version_code}`,
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function updateGooglePlayTrackState(options, input) {
  const document = normalizeSnapshot(input, options);
  writeJson(options.file, document);
  return document;
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const document = updateGooglePlayTrackState(options, readInput(options));
    const status = getTrackStatus(document);
    console.log(`Updated ${path.relative(ROOT, options.file)}`);
    console.log(`${status.summary}; expected status ${document.expected_status}`);
    if (!status.ready) {
      console.log('Google Play track is not ready for the expected versionCode.');
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

module.exports = {
  EXPECTED,
  getExpectedRelease,
  getTrackStatus,
  normalizeSnapshot,
  parseArgs,
  updateGooglePlayTrackState,
};
