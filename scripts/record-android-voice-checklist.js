#!/usr/bin/env node
'use strict';
/* global __dirname */

// Structured record of the manual voice checklist
// (doc_web_interne/docs/android-release-checklist.md#checklist-manuelle-voix).
// Real speech needs a person, so this is filled by the person who ran the
// checklist on the installed candidate; android:gates:strict stays blocked
// until a passing record exists for the candidate versionCode. The file is
// local and gitignored, like the subscription QA evidence.

const fs = require('fs');
const path = require('path');
const { readAppVersionCode } = require('./update-google-play-track-state');

const ROOT = path.resolve(__dirname, '..');
const VOICE_RECORD_PATH = 'doc_web_interne/docs/android-voice-analysis-evidence.local.json';
const VOICE_RECORD_KIND = 'android-voice-manual-checklist';
// One key per item of the checklist, in its order.
const VOICE_CHECKLIST_STEPS = [
  'french_language_selected',
  'microphone_permission',
  'sentinel_phrase_dictated',
  'transcript_anchors_in_order',
  'dream_saved_with_transcript',
  'analysis_shown',
  'sign_out_to_guest',
  'text_mode_keeps_transcript',
];
const PLAY_INSTALLER = 'com.android.vending';

// Why the record does not prove the checklist for this candidate, or null.
function voiceRecordProblem(record, versionCode) {
  if (!record || typeof record !== 'object') return 'no record';
  if (record.schemaVersion !== 1 || record.kind !== VOICE_RECORD_KIND) return 'not a voice checklist record';
  if (String(record.versionCode) !== String(versionCode)) {
    return `it is for versionCode ${record.versionCode}, not ${versionCode}`;
  }
  if (record.result !== 'pass') return `its result is ${record.result}`;
  if (typeof record.testedAt !== 'string' || !Number.isFinite(Date.parse(record.testedAt))) return 'testedAt is not a date';
  if (Date.parse(record.testedAt) > Date.now()) return 'testedAt is in the future';
  for (const key of ['tester', 'deviceId']) {
    if (typeof record[key] !== 'string' || !record[key].trim()) return `${key} is missing`;
  }
  if (record.installerPackageName !== PLAY_INSTALLER) return `the candidate was not installed from Play (${PLAY_INSTALLER})`;
  const steps = record.steps && typeof record.steps === 'object' ? record.steps : {};
  const missing = VOICE_CHECKLIST_STEPS.filter((step) => steps[step] !== true);
  if (missing.length) return `unchecked steps: ${missing.join(', ')}`;
  return null;
}

function buildVoiceRecord({ versionCode, tester, deviceId, installerPackageName, testedAt, notes }) {
  return {
    schemaVersion: 1,
    kind: VOICE_RECORD_KIND,
    checklist: 'doc_web_interne/docs/android-release-checklist.md#checklist-manuelle-voix',
    versionCode: String(versionCode),
    result: 'pass',
    testedAt,
    tester,
    deviceId,
    installerPackageName,
    steps: Object.fromEntries(VOICE_CHECKLIST_STEPS.map((step) => [step, true])),
    ...(notes ? { notes } : {}),
  };
}

function parseArgs(argv) {
  const options = { testedAt: new Date().toISOString(), confirmed: false };
  const values = {
    '--version-code': 'versionCode',
    '--tester': 'tester',
    '--device-id': 'deviceId',
    '--installer-package-name': 'installerPackageName',
    '--tested-at': 'testedAt',
    '--notes': 'notes',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--all-steps-passed') {
      options.confirmed = true;
    } else if (values[arg]) {
      options[values[arg]] = argv[i + 1];
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function printHelp() {
  console.log(`Usage:
  node scripts/record-android-voice-checklist.js --version-code <n> --tester <label> \\
    --device-id <adb-id> --installer-package-name ${PLAY_INSTALLER} --all-steps-passed [--notes <text>]

Records that every step of the manual voice checklist passed on the installed
candidate, in ${VOICE_RECORD_PATH} (gitignored). Steps:
  ${VOICE_CHECKLIST_STEPS.join('\n  ')}
--version-code must be the candidate's (QA_ANDROID_VERSION_CODE, else app.json).
Record nothing when a step failed: the release stays blocked.`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (!options.confirmed) throw new Error('Pass --all-steps-passed only after every checklist step passed.');
  const candidate = readAppVersionCode(ROOT, fs.readFileSync, process.env);
  const record = buildVoiceRecord(options);
  const problem = voiceRecordProblem(record, candidate);
  if (problem) throw new Error(`Refused: ${problem}.`);
  const target = path.join(ROOT, VOICE_RECORD_PATH);
  fs.writeFileSync(target, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`Voice checklist recorded for versionCode ${candidate}: ${VOICE_RECORD_PATH}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  VOICE_CHECKLIST_STEPS,
  VOICE_RECORD_PATH,
  buildVoiceRecord,
  voiceRecordProblem,
};
