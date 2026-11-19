#!/usr/bin/env node
'use strict';
/* global __dirname */

const fs = require('fs');
const path = require('path');
const { parseSnapshotArgs, readSnapshotInput, parseSnapshotJson, requireSnapshotDate, writeSnapshot } = require('./lib/qa-snapshot');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_TARGET = path.join(ROOT, 'doc_web_interne/docs/google-play-track-state.local.json');

function readAppVersionCode(
  rootDir = ROOT,
  readFileSync = fs.readFileSync,
  env = process.env
) {
  const remoteCandidateVersionCode = String(env?.QA_ANDROID_VERSION_CODE ?? '').trim();
  if (remoteCandidateVersionCode) {
    if (!/^[1-9]\d*$/.test(remoteCandidateVersionCode)) {
      throw new Error('QA_ANDROID_VERSION_CODE must be a positive integer.');
    }
    return remoteCandidateVersionCode;
  }

  const appJsonPath = path.join(rootDir, 'app.json');
  let appConfig;
  try {
    appConfig = JSON.parse(readFileSync(appJsonPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Unable to read app.json for the Android release candidate: ${
        error instanceof Error ? error.message : error
      }`
    );
  }

  const versionCode = String(appConfig?.expo?.android?.versionCode ?? '').trim();
  if (!/^[1-9]\d*$/.test(versionCode)) {
    throw new Error('app.json expo.android.versionCode must be a positive integer.');
  }
  return versionCode;
}

const EXPECTED = {
  packageName: 'com.tanuki75.noctalia',
  track: 'internal',
  get versionCode() {
    return readAppVersionCode();
  },
  status: 'completed',
};

function parseArgs(argv) {
  return parseSnapshotArgs(argv, {
    file: process.env.GOOGLE_PLAY_TRACK_STATE_PATH || DEFAULT_TARGET,
    source: 'Google Play Developer API edits.tracks.get',
    packageName: EXPECTED.packageName,
    track: EXPECTED.track,
    expectedVersionCode: EXPECTED.versionCode,
    expectedStatus: EXPECTED.status,
  }, printHelp, {
    '--input': 'input',
    '--package-name': 'packageName',
    '--track': 'track',
    '--expected-version-code': (options, value) => {
      options.expectedVersionCode = String(value ?? '');
    },
    '--expected-status': (options, value) => {
      options.expectedStatus = String(value ?? '').toLowerCase();
    },
  });
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
  --expected-version-code <code>  Expected versionCode. Defaults to QA_ANDROID_VERSION_CODE when set,
                                  otherwise app.json expo.android.versionCode (${EXPECTED.versionCode}).
  --expected-status <status>      Expected release status. Defaults to completed.
`.trim());
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
  requireSnapshotDate(options.checkedAt);
  if (!/^[1-9]\d*$/.test(String(options.expectedVersionCode || ''))) {
    throw new Error('--expected-version-code must be a positive integer.');
  }

  const snapshot = parseSnapshotJson(input, 'Google Play track');
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

function getExpectedRelease(document, expectedVersionCode = document?.expected_version_code) {
  return (
    document?.releases?.find((release) =>
      (release.version_codes ?? []).includes(String(expectedVersionCode))
    ) ?? null
  );
}

function getTrackStatus(document, expectedVersionCode = document?.expected_version_code) {
  const versionCode = String(expectedVersionCode ?? '').trim();
  const release = getExpectedRelease(document, versionCode);
  if (!release) {
    return {
      ready: false,
      summary: `${document.track || 'unknown'}/missing/${versionCode || 'missing'}`,
    };
  }
  return {
    ready: release.status === document.expected_status,
    summary: `${document.track}/${release.name || 'unnamed'}/${release.status}/versionCode=${versionCode}`,
  };
}

function updateGooglePlayTrackState(options, input) {
  const document = normalizeSnapshot(input, options);
  writeSnapshot(options.file, document);
  return document;
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const document = updateGooglePlayTrackState(options, readSnapshotInput(options, 'Google Play edits.tracks.get JSON'));
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
  readAppVersionCode,
  updateGooglePlayTrackState,
};
