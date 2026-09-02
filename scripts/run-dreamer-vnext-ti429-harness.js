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
const IMAGE_INDEPENDENT_FLOW = 'maestro/release-image-independent.yml';
const LONG_START_SENTINEL = 'LONG-START';
const LONG_END_SENTINEL = 'LONG-END';
const MIN_LONG_FRAGMENT_CHARS = 600;
const RELEASE_APP_ID_FALLBACK = 'appId: ${APP_ID || "com.tanuki75.noctalia"}';
const RELEASE_DEEP_LINK_FALLBACK = '${DEEP_LINK_SCHEME || "noctalia"}://';

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
  if (!flowText.includes(`assertVisible: "${startSentinel}"`)) {
    issues.push('long fragment flow does not assert the start sentinel after save');
  }
  if (!flowText.includes(`text: "${endSentinel}"`) || !flowText.includes('scrollUntilVisible:')) {
    issues.push('long fragment flow does not scroll to the end sentinel before asserting it');
  }
  const startAssert = flowText.indexOf(`assertVisible: "${startSentinel}"`);
  const scrollEnd = flowText.indexOf(`text: "${endSentinel}"`);
  const endAssert = flowText.indexOf(`assertVisible: "${endSentinel}"`);
  if (startAssert === -1 || scrollEnd === -1 || endAssert === -1 || !(startAssert < scrollEnd && scrollEnd < endAssert)) {
    issues.push('long fragment flow must assert LONG-START, then scroll to LONG-END, then assert LONG-END');
  }
  return issues;
}

function inspectImageIndependentFlow(flowText) {
  const issues = [];
  if (flowTapsId(flowText, 'btn.dream.primaryCta')) {
    issues.push('image flow starts analysis; it must only assert the analysis CTA');
  }
  if (flowTapsId(flowText, 'btn.journal.illustrate')) {
    issues.push('image flow generates an illustration; it must only assert the illustration CTA');
  }
  if (/Interpretation\|Interprétation/.test(flowText) || flowText.includes('Interpretation|Interprétation')) {
    issues.push('image flow waits for analysis output');
  }
  if (!flowText.includes('id: btn.dream.primaryCta') || !flowText.includes('id: btn.journal.illustrate')) {
    issues.push('image flow must assert analysis and illustration CTAs separately');
  }
  const illustrateScroll = flowText.indexOf('id: btn.journal.illustrate');
  const afterIllustrate = illustrateScroll === -1 ? '' : flowText.slice(illustrateScroll);
  if (afterIllustrate.includes('id: btn.dream.primaryCta') || afterIllustrate.includes('id: component.transcriptCard')) {
    issues.push('image flow re-asserts analysis or transcript after scrolling to illustration');
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
    if (check.flow === IMAGE_INDEPENDENT_FLOW || check.id === 'image-independent') {
      issues.push(...inspectImageIndependentFlow(flowText));
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
  if (check.mode === 'automated' && check.command && !check.command.includes('--side-by-side-qa')) {
    issues.push('canonical command is missing --side-by-side-qa for physical QA proof');
  }
  if (
    check.mode === 'automated'
    && check.command
    && check.command.includes('run-maestro-android.js')
    && !/--suite\s+release(?:-[\w]+)?(?:\s|$)/.test(check.command)
  ) {
    issues.push('canonical command must select a production Release suite before --side-by-side-qa');
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
  if (!runnerText.includes('--side-by-side-qa') || !runnerText.includes('com.tanuki75.noctalia.qa')) {
    issues.push('Maestro runner is missing the side-by-side QA identity');
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
  inspectLongFragmentFlow,
  inspectReleaseIdentityAnchors,
  parseArgs,
  recordEvidence,
  validateHarness,
  yamlLooksParseable,
};
