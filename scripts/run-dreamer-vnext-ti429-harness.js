#!/usr/bin/env node
'use strict';
/* global __dirname */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = 'maestro/dreamer-vnext-ti429-matrix.json';
const EVIDENCE_DIR_RELATIVE = 'maestro-results/android/ti429';
const LOCAL_RECEIPT_RELATIVE = 'doc_web_interne/docs/android-ti429-evidence.local.json';
const SCHEMA_VERSION = 1;
const VALID_MODES = new Set(['automated', 'manual', 'blocked']);
const VALID_RUNTIMES = new Set(['release-native', 'mock-native', 'manual', 'web']);
const LONG_FRAGMENT_FLOW = 'maestro/release-long-fragment.yml';
const SHORT_FRAGMENT_FLOW = 'maestro/release-short-fragments.yml';
const GUEST_UNLIMITED_FLOW = 'maestro/release-guest-unlimited.yml';
const IMAGE_INDEPENDENT_FLOW = 'maestro/release-image-independent.yml';
const GUEST_REAL_ANALYSIS_FLOW = 'maestro/release-analysis.yml';
const GUEST_REAL_ANALYSIS_CHECK_ID = 'analysis-success';
const LONG_START_SENTINEL = 'LONG-START';
const LONG_END_SENTINEL = 'LONG-END';
const MIN_LONG_FRAGMENT_CHARS = 600;
const RELEASE_APP_ID_FALLBACK = 'appId: ${APP_ID || "com.tanuki75.noctalia"}';
const RELEASE_DEEP_LINK_FALLBACK = '${DEEP_LINK_SCHEME || "noctalia"}://';
const SEARCH_RECOVERY_CHECK_IDS = new Set([
  'offline-local',
  'analysis-interrupt',
  'journal-detail-trends-deeplinks',
]);
const SHORT_FRAGMENT_TOKENS = ['Porte rouge', 'maman', 'loup blanc'];
const GUEST_UNLIMITED_SENTINELS = [
  'Guest unlimited sentinel one',
  'Guest unlimited sentinel two',
  'Guest unlimited sentinel three',
];
const GUEST_TIER_REGEX = 'Guest|Invité|Gast|Invitado|Ospite|Visitante';
const BASE_ANDROID_APP_ID = 'com.tanuki75.noctalia';
const BASE_DEEP_LINK_SCHEME = 'noctalia';
const QA_ANDROID_APP_ID_TOKEN = 'com.tanuki75.noctalia.qa';
const QA_DEEP_LINK_SCHEME_TOKEN = 'noctalia-qa';

function inspectRunnerBaseIdentity(runnerText) {
  const issues = [];
  const text = typeof runnerText === 'string' ? runnerText : '';
  if (!text.includes(`const PRODUCTION_ANDROID_APP_ID = '${BASE_ANDROID_APP_ID}'`)) {
    issues.push(`Maestro runner is missing the exact base declaration const PRODUCTION_ANDROID_APP_ID = '${BASE_ANDROID_APP_ID}'`);
  }
  if (!text.includes(`const PRODUCTION_DEEP_LINK_SCHEME = '${BASE_DEEP_LINK_SCHEME}'`)) {
    issues.push(`Maestro runner is missing the exact base declaration const PRODUCTION_DEEP_LINK_SCHEME = '${BASE_DEEP_LINK_SCHEME}'`);
  }
  return issues;
}

function inspectBaseCommandIdentity(command) {
  const issues = [];
  const value = typeof command === 'string' ? command : '';
  if (!value) return issues;
  if (value.includes('--side-by-side-qa')) {
    issues.push('canonical command must not use --side-by-side-qa: base-only validation targets com.tanuki75.noctalia / noctalia');
  }
  if (value.includes('--app-id') || value.includes('--deep-link-scheme')) {
    issues.push('canonical command must not retarget the Android identity with --app-id/--deep-link-scheme: base-only validation runs without identity overrides');
  }
  if (value.includes(QA_ANDROID_APP_ID_TOKEN) || value.includes(QA_DEEP_LINK_SCHEME_TOKEN)) {
    issues.push('canonical command must not reference the QA identity com.tanuki75.noctalia.qa / noctalia-qa: base-only validation targets com.tanuki75.noctalia / noctalia');
  }
  return issues;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function fileSha256(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function isoNow(now = new Date()) {
  return now.toISOString();
}

function stampDir(now = new Date()) {
  return now.toISOString().replace(/[:.]/g, '-');
}

function parseArgs(argv) {
  const options = {
    command: 'plan',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.command = 'help';
      continue;
    }
    if (arg === 'plan' || arg === 'record' || arg === 'validate' || arg === 'help') {
      options.command = arg;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`Dreamer VNext TI-429 local device harness.

Commands:
  plan        Print the executable matrix without launching Maestro or ADB.
  validate    Check flow files, package scripts and evidence schema.
  record      Stamp a dated evidence directory from the current matrix.

This runner never starts Maestro, ADB, prebuild, install, commit or Linear.

  node ./scripts/run-dreamer-vnext-ti429-harness.js plan
  node ./scripts/run-dreamer-vnext-ti429-harness.js validate
  node ./scripts/run-dreamer-vnext-ti429-harness.js record
`);
}

function loadManifest(rootDir = ROOT) {
  const manifestPath = path.join(rootDir, MANIFEST_PATH);
  const manifest = readJson(manifestPath);
  if (manifest.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported TI-429 manifest schemaVersion: ${manifest.schemaVersion}`);
  }
  if (!Array.isArray(manifest.checks) || manifest.checks.length === 0) {
    throw new Error('TI-429 manifest has no checks.');
  }
  return { manifest, manifestPath };
}


function extractQuotedInputTexts(flowText) {
  return Array.from(flowText.matchAll(/inputText:\s*"([^"]*)"/g)).map((match) => match[1]);
}

function flowTapsId(flowText, testId) {
  return new RegExp(String.raw`-\s*tapOn:\s*\n\s*id:\s*${testId}(?:\n|$)`).test(flowText);
}

function inspectLongFragmentFlow(flowText, check) {
  const issues = [];
  const texts = extractQuotedInputTexts(flowText);
  const longest = texts.reduce((max, value) => (value.length > max.length ? value : max), '');
  const minLength = Number(check.minInputLength || MIN_LONG_FRAGMENT_CHARS);
  if (longest.length < minLength) {
    issues.push(`long fragment inputText is ${longest.length} characters; need >${minLength - 1}`);
  }
  if (!longest.includes(check.startSentinel || LONG_START_SENTINEL)) {
    issues.push('long fragment inputText is missing the start sentinel');
  }
  if (!longest.includes(check.endSentinel || LONG_END_SENTINEL)) {
    issues.push('long fragment inputText is missing the end sentinel');
  }
  const endSentinel = check.endSentinel || LONG_END_SENTINEL;
  const startSentinel = check.startSentinel || LONG_START_SENTINEL;
  if (!flowText.includes('id: component.transcriptCard')) {
    issues.push('long fragment flow does not assert the transcript card after save');
  }
  const startAssertNeedle = `assertVisible: ".*${startSentinel}.*"`;
  const endScrollNeedle = `text: ".*${endSentinel}.*"`;
  const endAssertNeedle = `assertVisible: ".*${endSentinel}.*"`;
  if (!flowText.includes(startAssertNeedle)) {
    issues.push('long fragment flow does not assert the start sentinel as a substring after save');
  }
  if (!flowText.includes(endScrollNeedle) || !flowText.includes('scrollUntilVisible:')) {
    issues.push('long fragment flow does not scroll to the end sentinel as a substring before asserting it');
  }
  const startAssert = flowText.indexOf(startAssertNeedle);
  const scrollEnd = flowText.indexOf(endScrollNeedle);
  const endAssert = flowText.indexOf(endAssertNeedle);
  if (startAssert === -1 || scrollEnd === -1 || endAssert === -1 || !(startAssert < scrollEnd && scrollEnd < endAssert)) {
    issues.push('long fragment flow must assert .*LONG-START.*, then scroll to .*LONG-END.*, then assert .*LONG-END.*');
  }
  return issues;
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  while (from <= haystack.length) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    count += 1;
    from = at + needle.length;
  }
  return count;
}

function inspectShortFragmentFlow(flowText) {
  const issues = [];
  const texts = extractQuotedInputTexts(flowText);
  for (const token of SHORT_FRAGMENT_TOKENS) {
    if (!texts.includes(token)) {
      issues.push(`short fragment flow must type the exact fragment "${token}"`);
    }
    if (countOccurrences(flowText, `assertVisible: "${token}"`) < 1) {
      issues.push(`short fragment flow must assert the saved fiche for "${token}"`);
    }
  }
  const firstSave = flowText.indexOf('inputText: "Porte rouge"');
  const secondSave = flowText.indexOf('inputText: "maman"');
  const thirdSave = flowText.indexOf('inputText: "loup blanc"');
  if (!(firstSave !== -1 && secondSave !== -1 && thirdSave !== -1 && firstSave < secondSave && secondSave < thirdSave)) {
    issues.push('short fragment flow must save Porte rouge, then maman, then loup blanc');
  }
  const firstAssert = flowText.indexOf('assertVisible: "Porte rouge"');
  const secondAssert = flowText.indexOf('assertVisible: "maman"');
  const thirdAssert = flowText.indexOf('assertVisible: "loup blanc"');
  if (!(firstAssert !== -1 && secondAssert !== -1 && thirdAssert !== -1
    && firstSave < firstAssert && firstAssert < secondSave
    && secondSave < secondAssert && secondAssert < thirdSave
    && thirdSave < thirdAssert)) {
    issues.push('short fragment flow must verify each fiche before typing the next fragment');
  }
  if (countOccurrences(flowText, 'id: component.transcriptCard') < 3) {
    issues.push('short fragment flow must wait for the transcript card after each save');
  }
  const journalAt = flowText.lastIndexOf('id: screen.journal');
  if (journalAt === -1) {
    issues.push('short fragment flow must finish on the Journal list');
  } else {
    const journalSlice = flowText.slice(journalAt);
    for (const token of SHORT_FRAGMENT_TOKENS) {
      if (!journalSlice.includes(`assertVisible: "${token}"`)) {
        issues.push(`short fragment flow must assert "${token}" on the final Journal list`);
      }
    }
  }
  if (flowText.includes('LONG-START') || flowText.includes('Release lifecycle sentinel')) {
    issues.push('short fragment flow still uses a generic long/lifecycle sentinel');
  }
  if ((flowText.match(/clearState:\s*true/g) || []).length !== 1) {
    issues.push('short fragment flow must clearState only at the beginning');
  }
  if (flowTapsId(flowText, 'btn.dream.primaryCta') || flowTapsId(flowText, 'btn.journal.illustrate') || flowTapsId(flowText, 'btn.paywall.purchase')) {
    issues.push('short fragment flow must not start analysis, generate an image or purchase');
  }
  return issues;
}

function inspectGuestUnlimitedFlow(flowText) {
  const issues = [];
  const texts = extractQuotedInputTexts(flowText);
  for (const sentinel of GUEST_UNLIMITED_SENTINELS) {
    if (!texts.includes(sentinel)) {
      issues.push(`guest-unlimited flow must type "${sentinel}"`);
    }
  }
  if (texts.filter((value) => GUEST_UNLIMITED_SENTINELS.includes(value)).length < 3) {
    issues.push('guest-unlimited flow must save at least three distinct guest dreams');
  }
  if (flowText.includes('id: btn.auth.google')) {
    issues.push('guest-unlimited flow must not use btn.auth.google as guest proof');
  }
  if (!flowText.includes(GUEST_TIER_REGEX) || !flowText.includes('id: btn.auth.signOut')) {
    issues.push('guest-unlimited flow must prove a guest session before the first save');
  }
  const guestProofAt = flowText.indexOf(GUEST_TIER_REGEX);
  const firstSaveAt = flowText.indexOf('inputText: "Guest unlimited sentinel one"');
  if (guestProofAt === -1 || firstSaveAt === -1 || !(guestProofAt < firstSaveAt)) {
    issues.push('guest-unlimited flow must assert guest identity before typing the first dream');
  }
  let previousTypedAt = 0;
  for (const sentinel of GUEST_UNLIMITED_SENTINELS) {
    const typedAt = flowText.indexOf(`inputText: "${sentinel}"`);
    if (typedAt === -1) continue;
    const window = flowText.slice(previousTypedAt, typedAt);
    const reentryAt = Math.max(
      window.lastIndexOf('id: screen.recording'),
      window.lastIndexOf('open-release-recording.yml'),
      window.lastIndexOf('ensure-recording-text.yml'),
    );
    const afterReentry = reentryAt === -1 ? window : window.slice(reentryAt);
    if (afterReentry.includes('id: btn.saveDream')) {
      issues.push(`guest-unlimited flow checks blockers after a previous save instead of before "${sentinel}"`);
    }
    if (!afterReentry.includes('id: screen.paywall') || !afterReentry.includes('id: btn.auth.signIn') || !afterReentry.includes('assertNotVisible')) {
      issues.push(`guest-unlimited flow must assert no account/paywall before saving "${sentinel}"`);
    }
    previousTypedAt = typedAt;
  }
  const journalAt = flowText.lastIndexOf('id: screen.journal');
  if (journalAt === -1) {
    issues.push('guest-unlimited flow must finish on the Journal list');
  } else {
    const journalSlice = flowText.slice(journalAt);
    for (const sentinel of GUEST_UNLIMITED_SENTINELS) {
      if (!journalSlice.includes(`assertVisible: "${sentinel}"`)) {
        issues.push(`guest-unlimited flow must assert "${sentinel}" on the final Journal list`);
      }
    }
  }
  if ((flowText.match(/clearState:\s*true/g) || []).length !== 1) {
    issues.push('guest-unlimited flow must clearState only at the beginning');
  }
  if (flowTapsId(flowText, 'btn.dream.primaryCta') || flowTapsId(flowText, 'btn.journal.illustrate') || flowTapsId(flowText, 'btn.paywall.purchase') || flowTapsId(flowText, 'btn.auth.signIn') || flowTapsId(flowText, 'btn.auth.signUp')) {
    issues.push('guest-unlimited flow must not start analysis, generate an image, sign in or purchase');
  }
  return issues;
}

function inspectImageIndependentFlow(flowText) {
  const issues = [];
  if (flowTapsId(flowText, 'btn.dream.primaryCta')) {
    issues.push('image flow starts analysis; it must only assert the analysis CTA');
  }
  if (flowTapsId(flowText, 'btn.journal.illustrate')) {
    issues.push('image flow generates an illustration; it must only assert the illustration CTA is absent');
  }
  if (flowTapsId(flowText, 'btn.dream.delete')) {
    issues.push('image flow must not tap delete; delete is only a lower-viewport anchor');
  }
  if (/Interpretation\|Interprétation/.test(flowText) || flowText.includes('Interpretation|Interprétation')) {
    issues.push('image flow waits for analysis output');
  }
  if (!flowText.includes('id: btn.dream.primaryCta') || !flowText.includes('id: component.transcriptCard')) {
    issues.push('image flow must assert the analysis CTA and transcript before looking for illustration');
  }
  if (!flowText.includes('id: btn.dream.delete')) {
    issues.push('image flow must scroll to btn.dream.delete before asserting illustration absence');
  }
  if (!flowText.includes('assertNotVisible') || !flowText.includes('id: btn.journal.illustrate')) {
    issues.push('image flow must assertNotVisible the illustration CTA after scrolling past the first viewport');
  }
  const primaryAt = flowText.indexOf('id: btn.dream.primaryCta');
  const transcriptAt = flowText.indexOf('id: component.transcriptCard');
  const deleteAt = flowText.indexOf('id: btn.dream.delete');
  const illustrateAt = flowText.indexOf('id: btn.journal.illustrate');
  if (!(primaryAt !== -1 && transcriptAt !== -1 && deleteAt !== -1 && illustrateAt !== -1
    && primaryAt < transcriptAt && transcriptAt < deleteAt && deleteAt < illustrateAt)) {
    issues.push('image flow must assert primaryCta+transcript, then scroll to delete, then assertNotVisible illustrate');
  }
  return issues;
}

function isGuestRealAnalysisCheck(check) {
  return (
    check.id === GUEST_REAL_ANALYSIS_CHECK_ID
    || check.flow === GUEST_REAL_ANALYSIS_FLOW
    || (typeof check.command === 'string' && check.command.includes('test:e2e:release:analysis'))
  );
}

function inspectGuestRealAnalysisSideloadBan(check) {
  const issues = [];
  if (!isGuestRealAnalysisCheck(check)) {
    return issues;
  }

  const command = typeof check.command === 'string' ? check.command : '';
  if (command.includes('--side-by-side-qa')) {
    issues.push(
      'guest real-analysis must not use --side-by-side-qa: base-only validation targets com.tanuki75.noctalia / noctalia; a sideloaded base build is not assumed integrity-recognized for PLAY_INTEGRITY_PACKAGE_NAME=com.tanuki75.noctalia'
    );
  }
  if (check.id !== GUEST_REAL_ANALYSIS_CHECK_ID) {
    return issues;
  }
  if (check.mode !== 'blocked') {
    issues.push(
      'analysis-success must stay blocked until Play Integrity status is verified on a Play-distributed recognized/allowlisted identity, or an authorized authenticated test account is used'
    );
  }
  if (command) {
    issues.push('analysis-success must not keep an executable command while blocked');
  }
  return issues;
}

function inspectAnalysisSuccessFlow(flowText) {
  const issues = [];
  if (flowTapsId(flowText, 'btn.journal.illustrate')) {
    issues.push('analysis flow must assert the illustration CTA without tapping it');
  }
  if (!flowText.includes('id: btn.journal.illustrate')) {
    issues.push('analysis flow must assert btn.journal.illustrate after a successful analysis');
  }
  const interpretationAt = flowText.search(/Interpretation\|Interprétation|Interpretation\|Interprétation/);
  const illustrateAt = flowText.indexOf('id: btn.journal.illustrate');
  if (interpretationAt === -1 || illustrateAt === -1 || !(interpretationAt < illustrateAt)) {
    issues.push('analysis flow must wait for interpretation before asserting the illustration CTA');
  }
  return issues;
}

function inspectNamedScreenshots(flowText, check) {
  const issues = [];
  const names = Array.from(flowText.matchAll(/takeScreenshot:\s*([^\n]+)/g)).map((match) => match[1].trim());
  const scoped = names.filter((name) => name.startsWith('ti429-'));
  if (scoped.length > 1) {
    issues.push(`${check.id} has ${scoped.length} TI-429 screenshots; keep at most one`);
  }
  return issues;
}

function inspectSearchRecovery(flowText, check) {
  const issues = [];
  if (!SEARCH_RECOVERY_CHECK_IDS.has(check.id)) {
    return issues;
  }
  if (!flowText.includes('input.searchDreams')) {
    return issues;
  }
  const searchAt = flowText.lastIndexOf('id: input.searchDreams');
  const hideAt = flowText.lastIndexOf('hideKeyboard');
  const itemAt = flowText.lastIndexOf('id: "dream.item.*"');
  if (hideAt === -1 || hideAt < searchAt) {
    issues.push(`${check.id} must hideKeyboard after journal search before tapping a dream item`);
  }
  if (itemAt !== -1 && hideAt !== -1 && hideAt > itemAt) {
    issues.push(`${check.id} hides the keyboard after tapping a dream item`);
  }
  if (!flowText.includes('id: component.transcriptCard')) {
    issues.push(`${check.id} must wait for the transcript card before asserting the recovered sentinel`);
  }
  return issues;
}

function inspectPermissionsVoiceMode(flowText) {
  const issues = [];
  const voiceAt = flowText.indexOf('id: btn.recording.inputMode.voice');
  const toggleAt = flowText.indexOf('id: btn.recordToggle');
  if (voiceAt === -1 || toggleAt === -1 || !(voiceAt < toggleAt)) {
    issues.push('permissions flow must tap voice input mode before looking for recordToggle');
  }
  const secondVoice = flowText.lastIndexOf('id: btn.recording.inputMode.voice');
  const secondToggle = flowText.lastIndexOf('id: btn.recordToggle');
  if (!(secondVoice > voiceAt && secondToggle > toggleAt && secondVoice < secondToggle)) {
    issues.push('permissions flow must enter voice mode before both recordToggle taps');
  }
  return issues;
}

function inspectNotificationSettingsResume(flowText) {
  const issues = [];
  const lastLaunch = flowText.lastIndexOf('- launchApp:');
  const lastOpenSettings = flowText.lastIndexOf('://settings');
  if (lastLaunch === -1 || lastOpenSettings === -1 || !(lastLaunch < lastOpenSettings)) {
    issues.push('final notification revocation must relaunch then open settings');
    return issues;
  }
  const resumeSlice = flowText.slice(lastLaunch, lastOpenSettings);
  if (!resumeSlice.includes('id: screen.recording')) {
    issues.push('after the final launchApp, wait for screen.recording before opening settings');
  }
  const afterOpen = flowText.slice(lastOpenSettings);
  const settingsAt = afterOpen.indexOf('id: screen.settings');
  const warningAt = afterOpen.indexOf('id: text.settings.notificationsPermissionWarning');
  if (settingsAt === -1 || warningAt === -1 || !(settingsAt < warningAt)) {
    issues.push('after the settings deep link, wait for screen.settings before asserting the notification warning');
  }
  return issues;
}

function inspectCheck(rootDir, check) {
  const issues = [];
  if (!check.id || !check.title || !check.criterion) {
    issues.push('missing id, title or criterion');
  }
  if (!VALID_MODES.has(check.mode)) {
    issues.push(`invalid mode ${check.mode}`);
  }
  if (check.mode === 'automated') {
    if (!check.flow) {
      issues.push('automated check is missing a Maestro flow');
    }
    if (!check.command) {
      issues.push('automated check is missing a canonical command');
    }
  }
  if (check.flow) {
    const flowPath = path.join(rootDir, check.flow);
    if (!fs.existsSync(flowPath)) {
      issues.push(`missing flow ${check.flow}`);
    }
  }
  if (!VALID_RUNTIMES.has(check.runtime)) {
    issues.push(`invalid runtime ${check.runtime}`);
  }
  issues.push(...inspectGuestRealAnalysisSideloadBan(check));
  if (check.flow && fs.existsSync(path.join(rootDir, check.flow))) {
    const flowText = fs.readFileSync(path.join(rootDir, check.flow), 'utf8');
    issues.push(...inspectReleaseIdentityAnchors(flowText, check));
    if (Array.isArray(check.requiredTokens)) {
      const missing = check.requiredTokens.filter((token) => !flowText.includes(token));
      if (missing.length) {
        issues.push(`flow semantic anchors missing: ${missing.join(', ')}`);
      }
    }
    if (check.flow === LONG_FRAGMENT_FLOW || check.id === 'long-fragment') {
      issues.push(...inspectLongFragmentFlow(flowText, check));
    }
    if (check.id === 'short-fragment' && check.flow !== SHORT_FRAGMENT_FLOW) {
      issues.push('short-fragment must use maestro/release-short-fragments.yml, not a generic long/lifecycle flow');
    }
    if (check.flow === SHORT_FRAGMENT_FLOW || check.id === 'short-fragment') {
      issues.push(...inspectShortFragmentFlow(flowText));
    }
    if (check.id === 'guest-unlimited' && check.flow !== GUEST_UNLIMITED_FLOW) {
      issues.push('guest-unlimited must use maestro/release-guest-unlimited.yml');
    }
    if (check.flow === GUEST_UNLIMITED_FLOW || check.id === 'guest-unlimited') {
      issues.push(...inspectGuestUnlimitedFlow(flowText));
    }
    if (check.flow === IMAGE_INDEPENDENT_FLOW || check.id === 'image-independent') {
      issues.push(...inspectImageIndependentFlow(flowText));
    }
    if (check.flow === 'maestro/release-analysis.yml' || check.id === 'analysis-success') {
      issues.push(...inspectAnalysisSuccessFlow(flowText));
    }
    if (check.flow === 'maestro/release-permissions.yml') {
      issues.push(...inspectPermissionsVoiceMode(flowText));
      issues.push(...inspectNotificationSettingsResume(flowText));
    }
    if (check.flow === 'maestro/release-notification-permission.yml') {
      issues.push(...inspectNotificationSettingsResume(flowText));
    }
    issues.push(...inspectNamedScreenshots(flowText, check));
    if (SEARCH_RECOVERY_CHECK_IDS.has(check.id)) {
      issues.push(...inspectSearchRecovery(flowText, check));
    }
  }
  return issues;
}

function inspectReleaseIdentityAnchors(flowText, check) {
  const issues = [];
  if (check.runtime !== 'release-native' || !check.flow) {
    return issues;
  }
  if (!flowText.includes(RELEASE_APP_ID_FALLBACK)) {
    issues.push('release-native flow must use appId: ${APP_ID || "com.tanuki75.noctalia"}');
  }
  if (/^\s*appId:\s*com\.tanuki75\.noctalia\s*$/m.test(flowText) || /^\s*appId:\s*\$\{APP_ID\}\s*$/m.test(flowText)) {
    issues.push('release-native flow still hardcodes the production appId');
  }
  if (check.mode === 'automated' && check.command) {
    issues.push(...inspectBaseCommandIdentity(check.command));
  }
  if (
    check.mode === 'automated'
    && check.command
    && check.command.includes('run-maestro-android.js')
    && !/--suite\s+release(?:-[\w]+)?(?:\s|$)/.test(check.command)
  ) {
    issues.push('canonical command must select a production Release suite for base proof');
  }
  if (
    /openLink:\s*noctalia:\/\//.test(flowText)
    || /openLink:\s*\$\{DEEP_LINK_SCHEME\}:\/\//.test(flowText)
  ) {
    issues.push('release-native flow still hardcodes noctalia:// instead of ${DEEP_LINK_SCHEME || "noctalia"}://');
  }
  if (/openLink:\s*.*:\/\//.test(flowText) && !flowText.includes(RELEASE_DEEP_LINK_FALLBACK)) {
    issues.push('release-native deep links must use ${DEEP_LINK_SCHEME || "noctalia"}://');
  }
  return issues;
}

function inspectPackageWiring(rootDir, manifest) {
  const packageJson = readJson(path.join(rootDir, 'package.json'));
  const runnerText = fs.readFileSync(path.join(rootDir, 'scripts/run-maestro-android.js'), 'utf8');
  const issues = [];
  const planScript = String(packageJson?.scripts?.['test:e2e:release:ti429:plan'] || '');
  const validateScript = String(packageJson?.scripts?.['test:e2e:release:ti429:validate'] || '');
  const recordScript = String(packageJson?.scripts?.['test:e2e:release:ti429:record'] || '');
  const executeScript = String(packageJson?.scripts?.['test:e2e:release:ti429:local'] || '');

  if (!planScript.includes('run-dreamer-vnext-ti429-harness.js plan')) {
    issues.push('package script test:e2e:release:ti429:plan is not bound to the TI-429 planner');
  }
  if (!validateScript.includes('run-dreamer-vnext-ti429-harness.js validate')) {
    issues.push('package script test:e2e:release:ti429:validate is not bound to the TI-429 validator');
  }
  if (!recordScript.includes('run-dreamer-vnext-ti429-harness.js record')) {
    issues.push('package script test:e2e:release:ti429:record is not bound to the TI-429 recorder');
  }
  if (
    !executeScript.includes('--suite release-ti429') ||
    !executeScript.includes('--no-start-metro')
  ) {
    issues.push('package script test:e2e:release:ti429:local is not bound to the standalone Release TI-429 suite');
  }
  if (!runnerText.includes("'release-ti429':")) {
    issues.push('Release TI-429 suite is not registered in the Maestro runner');
  }
  issues.push(...inspectRunnerBaseIdentity(runnerText));
  if (executeScript.includes('--app-id') || executeScript.includes('--deep-link-scheme') || executeScript.includes('com.tanuki75.noctalia.qa') || executeScript.includes('noctalia-qa')) {
    issues.push('package script test:e2e:release:ti429:local must not retarget the Android identity: base-only validation targets com.tanuki75.noctalia / noctalia without --app-id/--deep-link-scheme or QA identity');
  }
  if (executeScript.includes('--side-by-side-qa')) {
    issues.push('package script test:e2e:release:ti429:local must not use --side-by-side-qa: base-only validation targets com.tanuki75.noctalia / noctalia');
  }

  const suiteFlows = manifest.checks
    .filter((check) => check.mode === 'automated' && check.command && check.command.includes('--suite release-ti429') && check.flow)
    .map((check) => check.flow);
  for (const flow of suiteFlows) {
    if (!runnerText.includes(`'${flow}'`)) {
      issues.push(`Maestro runner does not register ${flow}`);
    }
  }

  return issues;
}

function inspectHarness(rootDir = ROOT) {
  const { manifest, manifestPath } = loadManifest(rootDir);
  const issues = [];
  const seen = new Set();

  for (const check of manifest.checks) {
    if (seen.has(check.id)) {
      issues.push(`duplicate check id ${check.id}`);
    }
    seen.add(check.id);
    issues.push(...inspectCheck(rootDir, check).map((issue) => `${check.id}: ${issue}`));
  }

  issues.push(...inspectPackageWiring(rootDir, manifest));

  const counts = {
    automated: manifest.checks.filter((check) => check.mode === 'automated').length,
    manual: manifest.checks.filter((check) => check.mode === 'manual').length,
    blocked: manifest.checks.filter((check) => check.mode === 'blocked').length,
  };

  return {
    ok: issues.length === 0,
    issues,
    counts,
    manifest,
    manifestPath,
    manifestSha256: fileSha256(manifestPath),
  };
}

function defaultEvidenceStatus(check) {
  if (check.mode === 'automated') return 'blocked';
  if (check.mode === 'manual') return 'manual';
  return 'blocked';
}

function buildPlan(rootDir = ROOT, now = new Date()) {
  const inspection = inspectHarness(rootDir);
  const checks = inspection.manifest.checks.map((check) => ({
    id: check.id,
    title: check.title,
    criterion: check.criterion,
    mode: check.mode,
    runtime: check.runtime || null,
    status: defaultEvidenceStatus(check),
    flow: check.flow || null,
    command: check.command || null,
    evidence: check.evidence || 'missing',
    humanRequired: check.mode !== 'automated',
    notes: check.notes || null,
  }));

  return {
    schemaVersion: SCHEMA_VERSION,
    ticket: 'TI-429',
    generatedAt: isoNow(now),
    ok: inspection.ok,
    issues: inspection.issues,
    counts: inspection.counts,
    manifestSha256: inspection.manifestSha256,
    evidenceDir: path.join(EVIDENCE_DIR_RELATIVE, stampDir(now)),
    checks,
    limits: inspection.manifest.limits,
  };
}

function writeEvidenceTree(rootDir, plan, now = new Date()) {
  const evidenceRoot = path.join(rootDir, plan.evidenceDir);
  fs.mkdirSync(path.join(evidenceRoot, 'automated'), { recursive: true });
  fs.mkdirSync(path.join(evidenceRoot, 'manual'), { recursive: true });
  fs.mkdirSync(path.join(evidenceRoot, 'blocked'), { recursive: true });

  const receipt = {
    schemaVersion: SCHEMA_VERSION,
    ticket: 'TI-429',
    generatedAt: isoNow(now),
    ok: plan.ok,
    issues: plan.issues,
    counts: plan.counts,
    manifestSha256: plan.manifestSha256,
    evidenceDir: plan.evidenceDir,
    maestroExecuted: false,
    adbUsed: false,
    checks: plan.checks,
    limits: plan.limits,
  };

  fs.writeFileSync(
    path.join(evidenceRoot, 'matrix.json'),
    `${JSON.stringify(receipt, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(evidenceRoot, 'README.md'),
    [
      '# TI-429 evidence',
      '',
      `Generated: ${receipt.generatedAt}`,
      `Manifest SHA-256: ${receipt.manifestSha256}`,
      '',
      'This directory is a dated local proof tree. Maestro was not launched by the planner.',
      'Copy screenshots, recordings and TalkBack notes into the matching `automated/`, `manual/` or `blocked/` folders, then keep statuses separate from Git, Linear and Store proof.',
      '',
    ].join('\n'),
    'utf8'
  );

  return receipt;
}

function writeLocalReceipt(rootDir, receipt) {
  const receiptPath = path.join(rootDir, LOCAL_RECEIPT_RELATIVE);
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.chmodSync(receiptPath, 0o600);
  return path.relative(rootDir, receiptPath);
}

function recordEvidence(rootDir = ROOT, now = new Date()) {
  const plan = buildPlan(rootDir, now);
  if (!plan.ok) {
    throw new Error(`TI-429 harness is not wired: ${plan.issues.join('; ')}`);
  }
  const receipt = writeEvidenceTree(rootDir, plan, now);
  const localReceipt = writeLocalReceipt(rootDir, receipt);
  return { ...receipt, localReceipt };
}

function yamlLooksParseable(filePath, check = {}) {
  const text = fs.readFileSync(filePath, 'utf8');
  const hasDynamicAppId = text.includes(RELEASE_APP_ID_FALLBACK);
  const hasProductionAppId = /^\s*appId:\s*com\.tanuki75\.noctalia\s*$/m.test(text);
  if (!hasDynamicAppId && !hasProductionAppId) {
    throw new Error(`${path.basename(filePath)} is missing appId`);
  }
  if (check.runtime === 'release-native' && !hasDynamicAppId) {
    throw new Error(`${path.basename(filePath)} is missing dynamic appId`);
  }
  if (check.runtime === 'release-native' && /openLink:\s*noctalia:\/\//.test(text) && !text.includes(RELEASE_DEEP_LINK_FALLBACK)) {
    throw new Error(`${path.basename(filePath)} still hardcodes noctalia://`);
  }
  if (!text.includes('\n---\n')) {
    throw new Error(`${path.basename(filePath)} is missing a Maestro document separator`);
  }
  return true;
}

function validateHarness(rootDir = ROOT) {
  const inspection = inspectHarness(rootDir);
  if (!inspection.ok) {
    throw new Error(inspection.issues.join('; '));
  }
  for (const check of inspection.manifest.checks) {
    if (check.flow) {
      yamlLooksParseable(path.join(rootDir, check.flow), check);
    }
  }
  return inspection;
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.command === 'help') {
    printHelp();
    return 0;
  }
  if (options.command === 'plan') {
    const plan = buildPlan();
    console.log(JSON.stringify(plan, null, 2));
    if (!plan.ok) {
      console.error(plan.issues.join('\n'));
      return 1;
    }
    return 0;
  }
  if (options.command === 'validate') {
    const inspection = validateHarness();
    console.log(
      `TI-429 harness OK: ${inspection.counts.automated} automated, ${inspection.counts.manual} manual, ${inspection.counts.blocked} blocked.`
    );
    return 0;
  }
  if (options.command === 'record') {
    const receipt = recordEvidence();
    console.log(`Wrote ${receipt.evidenceDir}`);
    console.log(`Local receipt ${receipt.localReceipt}`);
    return 0;
  }
  throw new Error(`Unknown command: ${options.command}`);
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

module.exports = {
  MANIFEST_PATH,
  LOCAL_RECEIPT_RELATIVE,
  SCHEMA_VERSION,
  MIN_LONG_FRAGMENT_CHARS,
  buildPlan,
  extractQuotedInputTexts,
  inspectHarness,
  inspectImageIndependentFlow,
  inspectAnalysisSuccessFlow,
  inspectGuestRealAnalysisSideloadBan,
  inspectLongFragmentFlow,
  inspectShortFragmentFlow,
  inspectGuestUnlimitedFlow,
  inspectNamedScreenshots,
  SHORT_FRAGMENT_FLOW,
  GUEST_UNLIMITED_FLOW,
  SHORT_FRAGMENT_TOKENS,
  GUEST_UNLIMITED_SENTINELS,
  GUEST_TIER_REGEX,
  inspectSearchRecovery,
  inspectPermissionsVoiceMode,
  inspectNotificationSettingsResume,
  inspectReleaseIdentityAnchors,
  inspectRunnerBaseIdentity,
  inspectBaseCommandIdentity,
  SEARCH_RECOVERY_CHECK_IDS,
  GUEST_REAL_ANALYSIS_FLOW,
  GUEST_REAL_ANALYSIS_CHECK_ID,
  isGuestRealAnalysisCheck,
  parseArgs,
  recordEvidence,
  validateHarness,
  yamlLooksParseable,
};
