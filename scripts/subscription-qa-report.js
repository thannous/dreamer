#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));
const requireFullCoverage = args.has('--require-full');
const evidencePath = process.env.REVENUECAT_QA_EVIDENCE_PATH
  ? path.resolve(ROOT, process.env.REVENUECAT_QA_EVIDENCE_PATH)
  : path.join(ROOT, 'doc_web_interne/docs/revenuecat-qa-evidence.local.json');

if (args.has('--help') || args.has('-h')) {
  console.log(`
Usage:
  node ./scripts/subscription-qa-report.js [--require-full]

Options:
  --require-full  Exit non-zero while Test Store purchase or Play Internal Testing gates remain manual.
`.trim());
  process.exit(0);
}

const unknownArgs = [...args].filter((arg) => arg !== '--require-full');
if (unknownArgs.length > 0) {
  throw new Error(`Unknown argument: ${unknownArgs.join(', ')}`);
}

const EXPECTED = {
  testStoreKey: 'test_zqltcBoDiTWPWmuyXTXTbYkJPrz',
  playStoreKey: 'goog_BFWJqTqAtQUnwYisczZcZrnsanw',
  entitlement: 'Noctalia Plus',
  offering: 'default',
  testStoreProducts: ['monthly', 'yearly'],
  playProducts: ['noctalia_plus:monthly', 'noctalia_plus:annual'],
  manualGateKeys: [
    'test_store_monthly',
    'test_store_annual',
    'restore_after_reinstall',
    'account_switch',
    'play_monthly',
    'play_annual',
    'play_cancellation_and_expiry',
  ],
};

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function readJson(file) {
  return JSON.parse(read(file));
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readEnv(file) {
  const out = {};
  for (const rawLine of read(file).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    out[line.slice(0, eq)] = line.slice(eq + 1);
  }
  return out;
}

function mask(value) {
  if (!value) return 'missing';
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function versionAtLeast(range, minimum) {
  const found = String(range ?? '').match(/\d+\.\d+\.\d+/)?.[0];
  if (!found) return false;
  const a = found.split('.').map(Number);
  const b = minimum.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}

function check(label, ok, detail) {
  return { label, ok, detail };
}

function renderCheck(item) {
  return `| ${item.ok ? 'OK' : 'BLOCKED'} | ${item.label} | ${item.detail} |`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function readEvidenceResult() {
  if (!fs.existsSync(evidencePath)) {
    return { evidence: {}, error: null };
  }
  try {
    return { evidence: readJsonFile(evidencePath), error: null };
  } catch (error) {
    return {
      evidence: {},
      error: error instanceof Error ? error.message.replace(/\r?\n/g, ' ') : String(error),
    };
  }
}

function getGateEvidenceIssue(evidence, scenario) {
  const key = slugify(scenario);
  const gate = evidence.gates?.[key];
  const requiresEasBuild = key.startsWith('play_');
  const evidenceText = typeof gate?.evidence === 'string' ? gate.evidence.trim() : '';
  const templateEvidence = evidenceExample.gates?.[key]?.evidence?.trim();
  const testedAt = typeof gate?.testedAt === 'string' ? gate.testedAt.trim() : '';
  const easBuildId = typeof gate?.easBuildId === 'string' ? gate.easBuildId.trim() : '';
  const tester = typeof gate?.tester === 'string' ? gate.tester.trim() : '';
  const appUserId = typeof gate?.appUserId === 'string' ? gate.appUserId.trim() : '';

  if (!gate) return 'evidence gate is missing';
  if (gate.status !== 'passed') return `status is ${gate.status || 'missing'}`;
  if (testedAt.length === 0) return 'testedAt is missing';
  if (Number.isNaN(Date.parse(testedAt))) return 'testedAt is not a valid date';
  if (tester.length === 0) return 'tester is missing';
  if (appUserId.length === 0) return 'appUserId is missing';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appUserId)) {
    return 'appUserId must be a UUID';
  }
  if (evidenceText.length === 0) return 'evidence is missing';
  if (evidenceText === templateEvidence) return 'evidence still uses the template text';
  if (
    requiresEasBuild &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(easBuildId)
  ) {
    return 'easBuildId must be an EAS build UUID';
  }
  if (key === 'play_monthly' && !/\bP1M\b/i.test(evidenceText)) {
    return 'monthly base plan P1M must be confirmed';
  }

  return null;
}

function hasGateEvidence(evidence, scenario) {
  return getGateEvidenceIssue(evidence, scenario) === null;
}

const pkg = readJson('package.json');
const eas = readJson('eas.json');
const mockEnv = readEnv('.env.mock');
const testStoreEnv = readEnv('.env.teststore');
const playStoreEnv = fs.existsSync(path.join(ROOT, '.env.playstore')) ? readEnv('.env.playstore') : {};
const subscriptionConstants = read('constants/subscription.ts');
const purchaseRunner = read('scripts/run-subscription-teststore-purchase.js');
const evidenceExample = readJson('doc_web_interne/docs/revenuecat-qa-evidence.example.json');
const gitignore = read('.gitignore');
const evidenceResult = readEvidenceResult();
const evidence = evidenceResult.evidence;

const checks = [
  check(
    'React Native RevenueCat SDK',
    versionAtLeast(pkg.dependencies['react-native-purchases'], '9.5.4'),
    `${pkg.dependencies['react-native-purchases']} installed; Test Store requires React Native SDK 9.5.4 or newer`
  ),
  check(
    '.env.mock exposes QA Lab',
    mockEnv.EXPO_PUBLIC_MOCK_MODE === 'true' && mockEnv.EXPO_PUBLIC_SUBSCRIPTION_QA_LAB === 'true',
    `mock=${mockEnv.EXPO_PUBLIC_MOCK_MODE}, qa=${mockEnv.EXPO_PUBLIC_SUBSCRIPTION_QA_LAB}`
  ),
  check(
    '.env.teststore uses RevenueCat Test Store key',
    testStoreEnv.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY === EXPECTED.testStoreKey,
    mask(testStoreEnv.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY)
  ),
  check(
    '.env.playstore uses Google Play key',
    playStoreEnv.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY === EXPECTED.playStoreKey,
    mask(playStoreEnv.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY)
  ),
  check(
    'EAS revenuecat-teststore profile is isolated',
    eas.build?.['revenuecat-teststore']?.env?.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY === EXPECTED.testStoreKey &&
      eas.build?.['revenuecat-teststore']?.env?.EXPO_PUBLIC_SUBSCRIPTION_QA_LAB === 'true',
    mask(eas.build?.['revenuecat-teststore']?.env?.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY)
  ),
  check(
    'EAS Play Store profiles use Google Play key',
    ['release', 'preview', 'production', 'production-apk'].every(
      (profile) => eas.build?.[profile]?.env?.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY === EXPECTED.playStoreKey
    ),
    ['release', 'preview', 'production', 'production-apk']
      .map((profile) => `${profile}:${mask(eas.build?.[profile]?.env?.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY)}`)
      .join(', ')
  ),
  check(
    'Entitlement constant matches RevenueCat',
    subscriptionConstants.includes(`REVENUECAT_ENTITLEMENT_ID = '${EXPECTED.entitlement}'`),
    EXPECTED.entitlement
  ),
  check(
    'Offering constant matches RevenueCat',
    subscriptionConstants.includes(`REVENUECAT_OFFERING_ID = '${EXPECTED.offering}'`),
    EXPECTED.offering
  ),
  check(
    'Subscription QA Maestro flow exists',
    fs.existsSync(path.join(ROOT, 'maestro/subscription-qa-lab.yml')),
    'maestro/subscription-qa-lab.yml'
  ),
  check(
    'Test Store readiness Maestro flow exists',
    fs.existsSync(path.join(ROOT, 'maestro/subscription-teststore-readiness.yml')),
    'maestro/subscription-teststore-readiness.yml'
  ),
  check(
    'Guarded Test Store purchase flow exists',
    fs.existsSync(path.join(ROOT, 'maestro/subscription-teststore-purchase-manual.yml')) &&
      fs.existsSync(path.join(ROOT, 'scripts/run-subscription-teststore-purchase.js')),
    'maestro/subscription-teststore-purchase-manual.yml via scripts/run-subscription-teststore-purchase.js'
  ),
  check(
    'Test Store purchase preflight exists',
    purchaseRunner.includes('--preflight') &&
      purchaseRunner.includes('Test Store purchase preflight passed') &&
      pkg.scripts['test:e2e:subscription-teststore:purchase:preflight']?.includes('--preflight'),
    'npm run test:e2e:subscription-teststore:purchase:preflight'
  ),
  check(
    'Local subscription QA verifier exists',
    fs.existsSync(path.join(ROOT, 'scripts/verify-subscription-qa-local.js')) &&
      pkg.scripts['subscription:qa:verify-local'] === 'node ./scripts/verify-subscription-qa-local.js',
    'npm run subscription:qa:verify-local'
  ),
  check(
    'Android device diagnostic exists',
    fs.existsSync(path.join(ROOT, 'scripts/check-android-adb-device.js')) &&
      pkg.scripts['android:device'] === 'node ./scripts/check-android-adb-device.js --report-only',
    'npm run android:device'
  ),
  check(
    'Evidence template covers all release gates',
    EXPECTED.manualGateKeys.every((key) => evidenceExample.gates?.[key]),
    EXPECTED.manualGateKeys.join(', ')
  ),
  check(
    'Local evidence file is gitignored',
    gitignore.includes('doc_web_interne/docs/revenuecat-qa-evidence.local.json'),
    'doc_web_interne/docs/revenuecat-qa-evidence.local.json'
  ),
  check(
    'Local evidence file parses',
    !fs.existsSync(evidencePath) || !evidenceResult.error,
    fs.existsSync(evidencePath) ? evidenceResult.error || evidencePath : 'not provided'
  ),
  check(
    'Completion audit exists',
    fs.existsSync(path.join(ROOT, 'doc_web_interne/docs/revenuecat-workflow-completion-audit.md')),
    'doc_web_interne/docs/revenuecat-workflow-completion-audit.md'
  ),
];

const scenarios = [
  [
    'Automated',
    'Mock guest',
    'No account',
    'Guest quotas, paywall CTA to auth',
    'maestro/subscription-qa-lab.yml',
  ],
  [
    'Automated',
    'Mock new free',
    'Mock service',
    'Free tier, no entitlement, quota-limited',
    'maestro/subscription-qa-lab.yml',
  ],
  [
    'Automated',
    'Mock existing free',
    'Mock service',
    'Dream history, quota-limited, paywall opens',
    'maestro/subscription-qa-lab.yml',
  ],
  [
    'Automated',
    'Mock monthly',
    'Mock service',
    'Plus active, product mock_monthly, unlimited quotas',
    'maestro/subscription-qa-lab.yml',
  ],
  [
    'Automated',
    'Mock annual',
    'Mock service',
    'Plus active, product mock_annual, unlimited quotas',
    'maestro/subscription-qa-lab.yml',
  ],
  [
    'Automated',
    'Mock cancelled',
    'Mock service',
    'Plus active, willRenew=false, expiry visible',
    'maestro/subscription-qa-lab.yml',
  ],
  [
    'Automated',
    'Mock expired',
    'Mock service',
    'Free inactive, expired date visible',
    'maestro/subscription-qa-lab.yml',
  ],
  [
    'Automated',
    'Test Store readiness',
    'RevenueCat Test Store',
    'SDK probe loads offering packages without purchase',
    'maestro/subscription-teststore-readiness.yml',
  ],
  [
    'Manual purchase gate',
    'Test Store monthly',
    'RevenueCat Test Store',
    'Package $rc_monthly -> product monthly',
    'Requires signed-in test user and explicit purchase approval',
  ],
  [
    'Manual purchase gate',
    'Test Store annual',
    'RevenueCat Test Store',
    'Package $rc_annual -> product yearly',
    'Requires signed-in test user and explicit purchase approval',
  ],
  [
    'Manual purchase gate',
    'Restore after reinstall',
    'Test Store or Play',
    'Same app user id restores entitlement',
    'Requires a completed purchase first',
  ],
  [
    'Manual purchase gate',
    'Account switch',
    'Test Store or Play',
    'Plus user logout does not leak to free user',
    'Requires two real auth accounts after purchase',
  ],
  [
    'External store gate',
    'Play monthly',
    'Google Play Internal Testing',
    'Product noctalia_plus:monthly with base plan P1M',
    'Requires corrected Play monthly base plan and Play-installed internal testing build',
  ],
  [
    'External store gate',
    'Play annual',
    'Google Play Internal Testing',
    'Product noctalia_plus:annual',
    'Requires Play-installed internal testing build',
  ],
  [
    'External store gate',
    'Play cancellation and expiry',
    'Google Play Console',
    'RevenueCat webhook and backend state converge after store changes',
    'Requires tester subscription controls in Play Console',
  ],
];

console.log('# Subscription QA Report');
console.log('');
console.log(`Generated: ${new Date().toISOString()}`);
console.log('');
console.log('## RevenueCat Wiring');
console.log('');
console.log(`- Entitlement: ${EXPECTED.entitlement}`);
console.log(`- Offering: ${EXPECTED.offering}`);
console.log(`- Test Store products: ${EXPECTED.testStoreProducts.join(', ')}`);
console.log(`- Google Play products: ${EXPECTED.playProducts.join(', ')}`);
console.log(`- Manual evidence: ${fs.existsSync(evidencePath) ? 'local file present' : 'not provided'}`);
console.log('');
console.log('## Local Checks');
console.log('');
console.log('| Status | Check | Detail |');
console.log('| --- | --- | --- |');
checks.forEach((item) => console.log(renderCheck(item)));
console.log('');
console.log('## Coverage Matrix');
console.log('');
console.log('| Coverage | Scenario | Layer | Expected proof | Evidence / next gate |');
console.log('| --- | --- | --- | --- | --- |');
const scenarioRows = scenarios.map(([coverage, scenario, layer, proof, nextGate]) => {
  if (coverage !== 'Automated' && hasGateEvidence(evidence, scenario)) {
    return ['Verified', scenario, layer, proof, evidence.gates[slugify(scenario)].evidence];
  }
  return [coverage, scenario, layer, proof, nextGate];
});
scenarioRows.forEach(([coverage, scenario, layer, proof, nextGate]) => {
  console.log(`| ${coverage} | ${scenario} | ${layer} | ${proof} | ${nextGate} |`);
});

const manualGates = scenarioRows.filter(([coverage]) => coverage !== 'Automated' && coverage !== 'Verified');
console.log('');
console.log(`Automated scenarios: ${scenarioRows.filter(([coverage]) => coverage === 'Automated').length}`);
console.log(`Verified manual/external scenarios: ${scenarioRows.filter(([coverage]) => coverage === 'Verified').length}`);
console.log(`Manual or external gates remaining: ${manualGates.length}`);
if (manualGates.length > 0) {
  console.log('');
  console.log('## Next Gates');
  console.log('');
  manualGates.forEach(([, scenario, layer, proof, evidence]) => {
    console.log(`- ${scenario} (${layer}): ${proof}; ${evidence}`);
  });
}

const evidenceIssues = fs.existsSync(evidencePath)
  ? scenarios
      .filter(([coverage]) => coverage !== 'Automated')
      .map(([, scenario]) => [scenario, getGateEvidenceIssue(evidence, scenario)])
      .filter(([, issue]) => issue)
  : [];
if (evidenceIssues.length > 0) {
  console.log('');
  console.log('## Evidence Diagnostics');
  console.log('');
  evidenceIssues.forEach(([scenario, issue]) => {
    console.log(`- ${scenario}: ${issue}`);
  });
}

const failed = checks.filter((item) => !item.ok);
if (failed.length > 0) {
  console.log('');
  console.log(`Blocked checks: ${failed.length}`);
  process.exitCode = 1;
}

if (requireFullCoverage && manualGates.length > 0) {
  console.log('');
  console.log(
    `Full RevenueCat workflow is not complete: ${manualGates.length} manual or external gate(s) still require evidence.`
  );
  process.exitCode = 1;
}
