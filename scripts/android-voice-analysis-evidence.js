#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const VOICE_ANALYSIS_FLOW = 'maestro/release-auth-voice-analysis.yml';
const VOICE_ANALYSIS_EVIDENCE =
  'doc_web_interne/docs/android-voice-analysis-evidence.local.json';
const VOICE_ANALYSIS_SCHEMA_VERSION = 1;

const REQUIRED_FLOW_TOKENS = Object.freeze([
  'id: btn.recordToggle',
  'forest|moon',
  'fox|door',
  'id: btn.saveDream',
  'id: component.transcriptCard',
  'Interpretation|Interprétation',
  'id: btn.auth.signOut',
]);

const sha256 = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');

function readExpectedBuildIdentity(rootDir, readFileSync = fs.readFileSync) {
  const appConfig = JSON.parse(
    readFileSync(path.join(rootDir, 'app.json'), 'utf8')
  );
  const packageName = String(appConfig?.expo?.android?.package || '').trim();
  const versionName = String(appConfig?.expo?.version || '').trim();
  const versionCode = Number(appConfig?.expo?.android?.versionCode);

  if (!packageName || !versionName || !Number.isInteger(versionCode) || versionCode < 1) {
    throw new Error('app.json does not define a complete Android build identity.');
  }

  return { packageName, versionName, versionCode };
}

function inspectVoiceAnalysisWiring(
  rootDir,
  { existsSync = fs.existsSync, readFileSync = fs.readFileSync } = {}
) {
  const flowPath = path.join(rootDir, VOICE_ANALYSIS_FLOW);
  const runnerPath = path.join(rootDir, 'scripts/run-maestro-android.js');
  const packagePath = path.join(rootDir, 'package.json');
  const missingFiles = [flowPath, runnerPath, packagePath]
    .filter((filePath) => !existsSync(filePath))
    .map((filePath) => path.relative(rootDir, filePath));

  if (missingFiles.length) {
    return {
      ok: false,
      details: `Missing voice qualification files: ${missingFiles.join(', ')}.`,
    };
  }

  const flowText = readFileSync(flowPath, 'utf8');
  const runnerText = readFileSync(runnerPath, 'utf8');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  const packageScript = String(
    packageJson?.scripts?.['test:e2e:release:voice-analysis:local'] || ''
  );
  const missingTokens = REQUIRED_FLOW_TOKENS.filter(
    (token) => !flowText.includes(token)
  );
  const issues = [];

  if (missingTokens.length) {
    issues.push(`flow semantic anchors missing: ${missingTokens.join(', ')}`);
  }
  if (flowText.includes('inputText:')) {
    issues.push('flow contains text injection instead of microphone-only input');
  }
  if (
    !runnerText.includes("'release-voice-analysis':") ||
    !runnerText.includes(`'${VOICE_ANALYSIS_FLOW}'`)
  ) {
    issues.push('Release voice suite is not registered in the Maestro runner');
  }
  if (
    !runnerText.includes('invalidateVoiceAnalysisEvidence') ||
    !runnerText.includes('writeVoiceAnalysisEvidence')
  ) {
    issues.push('Maestro runner does not invalidate and write the runtime receipt');
  }
  if (
    !packageScript.includes('--suite release-voice-analysis') ||
    !packageScript.includes('--no-start-metro')
  ) {
    issues.push('package script is not bound to the standalone Release voice suite');
  }

  return {
    ok: issues.length === 0,
    details: issues.length
      ? issues.join('; ')
      : 'Voice flow, semantic anchors, runner receipt hooks and package script are wired.',
    flowSha256: sha256(flowText),
  };
}

function pendingStatus(phase) {
  return phase === 'prebuild' ? 'manual' : 'blocked';
}

function evaluateVoiceAnalysisEvidence({
  rootDir,
  phase = 'qualification',
  existsSync = fs.existsSync,
  readFileSync = fs.readFileSync,
} = {}) {
  const wiring = inspectVoiceAnalysisWiring(rootDir, {
    existsSync,
    readFileSync,
  });
  const remediation =
    'Run npm run test:e2e:release:voice-analysis:local on one explicit Release target and complete the documented spoken sentinel.';

  if (!wiring.ok) {
    return { status: 'fail', details: wiring.details, remediation };
  }

  const evidencePath = path.join(rootDir, VOICE_ANALYSIS_EVIDENCE);
  if (!existsSync(evidencePath)) {
    return {
      status: pendingStatus(phase),
      details: 'No qualifying runtime receipt exists for the current voice flow.',
      remediation,
    };
  }

  let evidence;
  let expected;
  try {
    evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
    expected = readExpectedBuildIdentity(rootDir, readFileSync);
  } catch {
    return {
      status: pendingStatus(phase),
      details: 'The voice runtime receipt or Android build identity is unreadable.',
      remediation,
    };
  }

  const mismatches = [];
  if (evidence.schemaVersion !== VOICE_ANALYSIS_SCHEMA_VERSION) {
    mismatches.push('schemaVersion');
  }
  if (evidence.qualification !== true) mismatches.push('qualification');
  if (evidence.flow !== VOICE_ANALYSIS_FLOW) mismatches.push('flow');
  if (evidence.flowSha256 !== wiring.flowSha256) mismatches.push('flowSha256');
  if (evidence.packageName !== expected.packageName) mismatches.push('packageName');
  if (evidence.versionName !== expected.versionName) mismatches.push('versionName');
  if (evidence.versionCode !== expected.versionCode) mismatches.push('versionCode');
  if (evidence.nonDebuggable !== true) mismatches.push('nonDebuggable');
  if (!['emulator', 'physical'].includes(evidence.targetKind)) {
    mismatches.push('targetKind');
  }
  if (
    typeof evidence.verifiedAt !== 'string' ||
    !Number.isFinite(Date.parse(evidence.verifiedAt))
  ) {
    mismatches.push('verifiedAt');
  }

  if (mismatches.length) {
    return {
      status: pendingStatus(phase),
      details: `Voice runtime receipt does not match the current candidate: ${mismatches.join(', ')}.`,
      remediation,
    };
  }

  return {
    status: 'pass',
    details: `Microphone transcription, save and analysis receipt matches Android versionCode ${expected.versionCode} and the current flow hash.`,
    remediation,
  };
}

function invalidateVoiceAnalysisEvidence(
  rootDir,
  { existsSync = fs.existsSync, unlinkSync = fs.unlinkSync } = {}
) {
  const evidencePath = path.join(rootDir, VOICE_ANALYSIS_EVIDENCE);
  if (existsSync(evidencePath)) {
    unlinkSync(evidencePath);
    return true;
  }
  return false;
}

function writeVoiceAnalysisEvidence({
  rootDir,
  buildIdentity,
  targetKind,
  now = () => new Date(),
  fsImpl = fs,
} = {}) {
  const wiring = inspectVoiceAnalysisWiring(rootDir, {
    existsSync: fsImpl.existsSync,
    readFileSync: fsImpl.readFileSync,
  });
  if (!wiring.ok) {
    throw new Error(`Cannot write voice runtime evidence: ${wiring.details}`);
  }
  if (!['emulator', 'physical'].includes(targetKind)) {
    throw new Error('Voice runtime evidence requires an emulator or physical target kind.');
  }

  const expected = readExpectedBuildIdentity(rootDir, fsImpl.readFileSync);
  if (
    buildIdentity?.packageName !== expected.packageName ||
    buildIdentity?.versionName !== expected.versionName ||
    Number(buildIdentity?.versionCode) !== expected.versionCode
  ) {
    throw new Error('Installed Release identity does not match app.json.');
  }

  const evidence = {
    schemaVersion: VOICE_ANALYSIS_SCHEMA_VERSION,
    qualification: true,
    flow: VOICE_ANALYSIS_FLOW,
    flowSha256: wiring.flowSha256,
    packageName: expected.packageName,
    versionName: expected.versionName,
    versionCode: expected.versionCode,
    nonDebuggable: true,
    targetKind,
    verifiedAt: now().toISOString(),
  };
  const evidencePath = path.join(rootDir, VOICE_ANALYSIS_EVIDENCE);
  const temporaryPath = `${evidencePath}.${process.pid}.${Date.now()}.tmp`;
  fsImpl.mkdirSync(path.dirname(evidencePath), { recursive: true });
  try {
    fsImpl.writeFileSync(temporaryPath, `${JSON.stringify(evidence, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    fsImpl.renameSync(temporaryPath, evidencePath);
  } catch (error) {
    if (fsImpl.existsSync(temporaryPath)) fsImpl.unlinkSync(temporaryPath);
    throw error;
  }

  return evidence;
}

module.exports = {
  evaluateVoiceAnalysisEvidence,
  inspectVoiceAnalysisWiring,
  invalidateVoiceAnalysisEvidence,
  readExpectedBuildIdentity,
  sha256,
  VOICE_ANALYSIS_EVIDENCE,
  VOICE_ANALYSIS_FLOW,
  VOICE_ANALYSIS_SCHEMA_VERSION,
  writeVoiceAnalysisEvidence,
};
