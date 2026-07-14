#!/usr/bin/env node
/* global __dirname, __filename, Buffer */

const nodeFs = require('fs');
const path = require('path');

const nodeProcess = process;
const DEFAULT_ROOT = path.resolve(__dirname, '..');

function createOverlayFileSystem(files = {}, fallback = nodeFs) {
  const entries = new Map(
    Object.entries(files).map(([filePath, contents]) => [path.resolve(filePath), String(contents)])
  );

  return {
    existsSync(filePath) {
      return entries.has(path.resolve(filePath)) || fallback.existsSync(filePath);
    },
    readFileSync(filePath, encoding) {
      const contents = entries.get(path.resolve(filePath));
      if (contents !== undefined) {
        return encoding ? contents : Buffer.from(contents);
      }
      return fallback.readFileSync(filePath, encoding);
    },
  };
}

function generateSubscriptionQaReport(options = {}) {
const ROOT = options.root ?? DEFAULT_ROOT;
const fs = options.fs ?? nodeFs;
const lines = [];
const console = {
  log(...values) {
    lines.push(values.map(String).join(' '));
  },
};
const process = {
  argv: [nodeProcess.execPath, __filename, ...(options.args ?? [])],
  env: options.env ?? nodeProcess.env,
  exitCode: 0,
};
const reportNow = options.now ? options.now() : new Date();
const PLAY_STORE_STATE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const args = new Set(process.argv.slice(2));
const requireFullCoverage = args.has('--require-full');
const evidencePath = process.env.REVENUECAT_QA_EVIDENCE_PATH
  ? path.resolve(ROOT, process.env.REVENUECAT_QA_EVIDENCE_PATH)
  : path.join(ROOT, 'doc_web_interne/docs/revenuecat-qa-evidence.local.json');
const playStoreStatePath = process.env.REVENUECAT_PLAY_STORE_STATE_PATH
  ? path.resolve(ROOT, process.env.REVENUECAT_PLAY_STORE_STATE_PATH)
  : path.join(ROOT, 'doc_web_interne/docs/revenuecat-play-store-state.local.json');
const revenueCatSubscriberExpiryStatePath = process.env.REVENUECAT_SUBSCRIBER_EXPIRY_STATE_PATH
  ? path.resolve(ROOT, process.env.REVENUECAT_SUBSCRIBER_EXPIRY_STATE_PATH)
  : path.join(ROOT, 'doc_web_interne/docs/revenuecat-subscriber-expiry-state.local.json');
const googlePlaySubscriptionStatePath = process.env.GOOGLE_PLAY_SUBSCRIPTION_STATE_PATH
  ? path.resolve(ROOT, process.env.GOOGLE_PLAY_SUBSCRIPTION_STATE_PATH)
  : path.join(ROOT, 'doc_web_interne/docs/google-play-subscription-state.local.json');
const googlePlayTrackStatePath = process.env.GOOGLE_PLAY_TRACK_STATE_PATH
  ? path.resolve(ROOT, process.env.GOOGLE_PLAY_TRACK_STATE_PATH)
  : path.join(ROOT, 'doc_web_interne/docs/google-play-track-state.local.json');
const googleOAuthAndroidClientStatePath = process.env.GOOGLE_OAUTH_ANDROID_CLIENT_STATE_PATH
  ? path.resolve(ROOT, process.env.GOOGLE_OAUTH_ANDROID_CLIENT_STATE_PATH)
  : path.join(ROOT, 'doc_web_interne/docs/google-oauth-android-client-state.local.json');
const googlePlayPaymentsProfileStatePath = process.env.GOOGLE_PLAY_PAYMENTS_PROFILE_STATE_PATH
  ? path.resolve(ROOT, process.env.GOOGLE_PLAY_PAYMENTS_PROFILE_STATE_PATH)
  : path.join(ROOT, 'doc_web_interne/docs/google-play-payments-profile-state.local.json');
const supabasePlayIntegritySecretsStatePath = process.env.SUPABASE_PLAY_INTEGRITY_SECRETS_STATE_PATH
  ? path.resolve(ROOT, process.env.SUPABASE_PLAY_INTEGRITY_SECRETS_STATE_PATH)
  : path.join(ROOT, 'doc_web_interne/docs/supabase-play-integrity-secrets-state.local.json');

if (args.has('--help') || args.has('-h')) {
  console.log(`
Usage:
  node ./scripts/subscription-qa-report.js [--require-full]

Options:
  --require-full  Exit non-zero while Test Store purchase or Play Internal Testing gates remain manual.
`.trim());
  return { stdout: `${lines.join('\n')}\n`, stderr: '', exitCode: 0 };
}

const unknownArgs = [...args].filter((arg) => arg !== '--require-full');
if (unknownArgs.length > 0) {
  throw new Error(`Unknown argument: ${unknownArgs.join(', ')}`);
}

const EXPECTED = {
  purchaseApproval: 'I_APPROVE_TEST_STORE_PURCHASE',
  testStoreKey: 'test_zqltcBoDiTWPWmuyXTXTbYkJPrz',
  playStoreKey: 'goog_BFWJqTqAtQUnwYisczZcZrnsanw',
  entitlement: 'Noctalia Plus',
  offering: 'default',
  testStoreProducts: ['monthly', 'yearly'],
  playProducts: ['noctalia_plus:monthly', 'noctalia_plus:annual'],
  playProductIds: {
    monthly: 'prodfce10ef2a8',
    annual: 'prod98337b31be',
  },
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

const appConfig = readJson('app.json');
const androidCandidateVersionCode = String(appConfig?.expo?.android?.versionCode ?? '').trim();
if (!/^[1-9]\d*$/.test(androidCandidateVersionCode)) {
  throw new Error('app.json expo.android.versionCode must be a positive integer.');
}

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

function redactEvidenceForOutput(gate) {
  let value = String(gate?.evidence ?? '');
  const sensitiveFields = [
    ['tester', gate?.tester],
    ['device', gate?.deviceId],
    ['app-user-id', gate?.appUserId],
    ['build-id', gate?.easBuildId],
  ];

  for (const [label, raw] of sensitiveFields) {
    const literal = typeof raw === 'string' ? raw.trim() : '';
    if (literal) {
      value = value.split(literal).join(`<redacted:${label}>`);
    }
  }

  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '<redacted:email>')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, '<redacted:network>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, '<redacted:id>')
    .replace(/\|/g, '\\|');
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

function envState(name) {
  return process.env[name] ? 'set' : 'missing';
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

function readPlayStoreStateResult() {
  if (!fs.existsSync(playStoreStatePath)) {
    return { snapshot: null, error: null };
  }
  try {
    return { snapshot: readJsonFile(playStoreStatePath), error: null };
  } catch (error) {
    return {
      snapshot: null,
      error: error instanceof Error ? error.message.replace(/\r?\n/g, ' ') : String(error),
    };
  }
}

function getPlayStoreStateFreshnessIssue(snapshot) {
  const checkedAt = snapshot?.checked_at ?? snapshot?.checkedAt;
  const checkedAtMs = Date.parse(String(checkedAt ?? ''));
  if (!Number.isFinite(checkedAtMs)) {
    return 'checked_at is missing or invalid';
  }
  const ageMs = reportNow.getTime() - checkedAtMs;
  if (ageMs < 0) {
    return `checked_at ${checkedAt} is in the future`;
  }
  if (ageMs > PLAY_STORE_STATE_MAX_AGE_MS) {
    const ageHours = Math.floor(ageMs / (60 * 60 * 1000));
    return `checked_at ${checkedAt} is ${ageHours}h old; maximum age is 24h`;
  }
  return null;
}

function readRevenueCatSubscriberExpiryStateResult() {
  if (!fs.existsSync(revenueCatSubscriberExpiryStatePath)) {
    return { snapshot: null, error: null };
  }
  try {
    return { snapshot: readJsonFile(revenueCatSubscriberExpiryStatePath), error: null };
  } catch (error) {
    return {
      snapshot: null,
      error: error instanceof Error ? error.message.replace(/\r?\n/g, ' ') : String(error),
    };
  }
}

function readGooglePlaySubscriptionStateResult() {
  if (!fs.existsSync(googlePlaySubscriptionStatePath)) {
    return { snapshot: null, error: null };
  }
  try {
    return { snapshot: readJsonFile(googlePlaySubscriptionStatePath), error: null };
  } catch (error) {
    return {
      snapshot: null,
      error: error instanceof Error ? error.message.replace(/\r?\n/g, ' ') : String(error),
    };
  }
}

function readGooglePlayTrackStateResult() {
  if (!fs.existsSync(googlePlayTrackStatePath)) {
    return { snapshot: null, error: null };
  }
  try {
    return { snapshot: readJsonFile(googlePlayTrackStatePath), error: null };
  } catch (error) {
    return {
      snapshot: null,
      error: error instanceof Error ? error.message.replace(/\r?\n/g, ' ') : String(error),
    };
  }
}

function readGoogleOAuthAndroidClientStateResult() {
  if (!fs.existsSync(googleOAuthAndroidClientStatePath)) {
    return { snapshot: null, error: null };
  }
  try {
    return { snapshot: readJsonFile(googleOAuthAndroidClientStatePath), error: null };
  } catch (error) {
    return {
      snapshot: null,
      error: error instanceof Error ? error.message.replace(/\r?\n/g, ' ') : String(error),
    };
  }
}

function readGooglePlayPaymentsProfileStateResult() {
  if (!fs.existsSync(googlePlayPaymentsProfileStatePath)) {
    return { snapshot: null, error: null };
  }
  try {
    return { snapshot: readJsonFile(googlePlayPaymentsProfileStatePath), error: null };
  } catch (error) {
    return {
      snapshot: null,
      error: error instanceof Error ? error.message.replace(/\r?\n/g, ' ') : String(error),
    };
  }
}

function readSupabasePlayIntegritySecretsStateResult() {
  if (!fs.existsSync(supabasePlayIntegritySecretsStatePath)) {
    return { snapshot: null, error: null };
  }
  try {
    return { snapshot: readJsonFile(supabasePlayIntegritySecretsStatePath), error: null };
  } catch (error) {
    return {
      snapshot: null,
      error: error instanceof Error ? error.message.replace(/\r?\n/g, ' ') : String(error),
    };
  }
}

function normalizeRequirementStatus(value) {
  return String(value || 'missing').trim().toLowerCase().replace(/\s+/g, '_');
}

function getOpenPaymentRequirements(snapshot) {
  return Object.entries(snapshot?.requirements ?? {})
    .map(([key, requirement]) => ({
      key,
      status: normalizeRequirementStatus(requirement?.status),
      severity: requirement?.severity || 'warning',
    }))
    .filter((requirement) => !['complete', 'completed', 'valid', 'resolved', 'not_required', 'not-applicable'].includes(requirement.status));
}

function getPaymentsProfileReadinessRow() {
  if (!fs.existsSync(googlePlayPaymentsProfileStatePath)) {
    return [
      'CHECK LIVE',
      'Google Play payments profile snapshot',
      'Run npm run android:google-play-payments-profile-state from the current Play Console payments profile status',
    ];
  }
  if (googlePlayPaymentsProfileStateResult.error) {
    return ['BLOCKED', 'Google Play payments profile snapshot', googlePlayPaymentsProfileStateResult.error];
  }
  const openRequirements = getOpenPaymentRequirements(googlePlayPaymentsProfileStateResult.snapshot);
  if (openRequirements.length > 0) {
    return [
      'BLOCKED',
      'Google Play payments profile snapshot',
      `${openRequirements.length} open requirement(s): ${openRequirements
        .map((item) => `${item.key}/${item.status}/${item.severity}`)
        .join(', ')}`,
    ];
  }
  return ['READY', 'Google Play payments profile snapshot', 'No open payments profile requirements recorded'];
}

function getSupabaseSecretsReadinessRow() {
  if (!fs.existsSync(supabasePlayIntegritySecretsStatePath)) {
    return [
      'CHECK LIVE',
      'Supabase Play Integrity secrets snapshot',
      'Run npm run android:supabase-play-integrity-secrets-state after confirming the three required Supabase Edge Function secrets',
    ];
  }
  if (supabasePlayIntegritySecretsStateResult.error) {
    return ['BLOCKED', 'Supabase Play Integrity secrets snapshot', supabasePlayIntegritySecretsStateResult.error];
  }
  const secrets = supabasePlayIntegritySecretsStateResult.snapshot?.secrets ?? {};
  const issues = [
    ['PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64', 'present'],
    ['PLAY_INTEGRITY_PACKAGE_NAME', 'com.tanuki75.noctalia'],
    ['GUEST_SESSION_SECRET', 'present'],
  ]
    .map(([name, expected]) => {
      const secret = secrets[name];
      if (secret?.status !== 'present') return `${name}/${secret?.status || 'missing'}`;
      if (expected !== 'present' && secret?.value !== expected) {
        return `${name}/value=${secret?.value || 'missing'} expected ${expected}`;
      }
      return null;
    })
    .filter(Boolean);
  if (issues.length > 0) {
    return ['BLOCKED', 'Supabase Play Integrity secrets snapshot', issues.join(', ')];
  }
  return ['READY', 'Supabase Play Integrity secrets snapshot', 'Required secret names are present; values are not stored'];
}

function getRevenueCatSubscriberExpiryReadinessRow() {
  if (!fs.existsSync(revenueCatSubscriberExpiryStatePath)) {
    return [
      'CHECK LIVE',
      'RevenueCat subscriber expiry snapshot',
      'Run npm run subscription:qa:revenuecat-subscriber-expiry with RevenueCat subscriber API JSON after Play expiry; this does not replace webhook evidence',
    ];
  }
  if (revenueCatSubscriberExpiryStateResult.error) {
    return ['BLOCKED', 'RevenueCat subscriber expiry snapshot', revenueCatSubscriberExpiryStateResult.error];
  }
  const snapshot = revenueCatSubscriberExpiryStateResult.snapshot;
  const entitlement = snapshot?.entitlement ?? {};
  const playSubscription = snapshot?.play_subscription ?? {};
  const ready =
    entitlement.id === EXPECTED.entitlement &&
    entitlement.product_identifier === 'noctalia_plus' &&
    entitlement.is_active_at_check === false &&
    playSubscription.product_identifier === 'noctalia_plus' &&
    playSubscription.store === 'play_store' &&
    playSubscription.is_sandbox === true &&
    playSubscription.is_active_at_check === false;
  const summary = `${playSubscription.product_identifier || 'missing'}/${playSubscription.store || 'missing'}/sandbox=${
    playSubscription.is_sandbox === true
  }/active=${playSubscription.is_active_at_check === true}`;
  return [
    ready ? 'READY' : 'BLOCKED',
    'RevenueCat subscriber expiry snapshot',
    `${summary}; direct RevenueCat subscriber state only, webhook/backend convergence still required separately`,
  ];
}

function getSnapshotProductState(snapshot, productId) {
  if (!snapshot) return null;
  if (Array.isArray(snapshot)) {
    return snapshot.find((item) => item?.product_id === productId || item?.productId === productId) ?? null;
  }
  return snapshot.store_state?.[productId] ?? snapshot.storeState?.[productId] ?? snapshot.products?.[productId] ?? null;
}

function getSnapshotBasePlans(productState) {
  if (!productState) return [];
  if (Array.isArray(productState.base_plans)) {
    return productState.base_plans.map((plan) => ({
      id: plan?.base_plan_id ?? plan?.basePlanId ?? 'unknown',
      duration: plan?.billing_period_duration ?? plan?.billingPeriodDuration ?? 'unknown',
    }));
  }
  const ids = productState.base_plan_ids ?? productState.basePlanIds ?? [];
  const durations = productState.billing_period_duration_values ?? productState.billingPeriodDurationValues ?? [];
  return ids.map((id, index) => ({
    id,
    duration: durations[index] ?? 'unknown',
  }));
}

function summarizeSnapshotBasePlans(productState) {
  const plans = getSnapshotBasePlans(productState);
  if (plans.length === 0) return 'none';
  return plans.map((plan) => `${plan.id}/${plan.duration}`).join(', ');
}

function snapshotHasBillingPeriod(productState, expectedDuration) {
  return getSnapshotBasePlans(productState).some((plan) => plan.duration === expectedDuration);
}

function getGooglePlayBasePlan(snapshot, basePlanId) {
  return snapshot?.base_plans?.[basePlanId] ?? snapshot?.basePlans?.[basePlanId] ?? null;
}

function summarizeGooglePlayBasePlan(plan, basePlanId) {
  if (!plan) return `${basePlanId}/missing`;
  const duration = plan.billing_period_duration ?? plan.billingPeriodDuration ?? 'unknown';
  const state = plan.state ?? 'unknown';
  return `${basePlanId}/${duration}/${state}`;
}

function getGooglePlayBasePlanReadinessRow({ basePlanId, expectedDuration, label, followup }) {
  if (!fs.existsSync(googlePlaySubscriptionStatePath)) {
    return ['CHECK LIVE', label, followup];
  }
  if (googlePlaySubscriptionStateResult.error) {
    return ['BLOCKED', label, googlePlaySubscriptionStateResult.error];
  }

  const plan = getGooglePlayBasePlan(googlePlaySubscriptionStateResult.snapshot, basePlanId);
  const summary = summarizeGooglePlayBasePlan(plan, basePlanId);
  const isReady =
    plan?.billing_period_duration === expectedDuration &&
    plan?.state === 'ACTIVE' &&
    plan?.new_subscriber_availability?.US === true &&
    plan?.new_subscriber_availability?.FR === true;
  return [
    isReady ? 'READY' : 'BLOCKED',
    label,
    `${summary}; expected ${basePlanId}/${expectedDuration}/ACTIVE with US+FR availability`,
  ];
}

function getGooglePlayMonthlyReadinessRow() {
  return getGooglePlayBasePlanReadinessRow({
    basePlanId: 'monthly',
    expectedDuration: 'P1M',
    label: 'Google Play monthly base plan snapshot',
    followup: 'Run npm run subscription:qa:google-play-state with subscriptions.get JSON to confirm noctalia_plus monthly P1M',
  });
}

function getGooglePlayAnnualReadinessRow() {
  return getGooglePlayBasePlanReadinessRow({
    basePlanId: 'annual',
    expectedDuration: 'P1Y',
    label: 'Google Play annual base plan snapshot',
    followup: 'Run npm run subscription:qa:google-play-state with subscriptions.get JSON to confirm noctalia_plus annual P1Y',
  });
}

function isGooglePlayBasePlanReady(basePlanId, expectedDuration) {
  if (!fs.existsSync(googlePlaySubscriptionStatePath) || googlePlaySubscriptionStateResult.error) return false;
  const plan = getGooglePlayBasePlan(googlePlaySubscriptionStateResult.snapshot, basePlanId);
  return (
    plan?.billing_period_duration === expectedDuration &&
    plan?.state === 'ACTIVE' &&
    plan?.new_subscriber_availability?.US === true &&
    plan?.new_subscriber_availability?.FR === true
  );
}

function isGooglePlayMonthlyReady() {
  return isGooglePlayBasePlanReady('monthly', 'P1M');
}

function isGooglePlayAnnualReady() {
  return isGooglePlayBasePlanReady('annual', 'P1Y');
}

function getGooglePlayTrackReadinessRow() {
  if (!fs.existsSync(googlePlayTrackStatePath)) {
    return [
      'CHECK LIVE',
      'Google Play internal track snapshot',
      `Run npm run android:google-play-track-state with edits.tracks.get JSON to confirm internal/versionCode=${androidCandidateVersionCode}/completed`,
    ];
  }
  if (googlePlayTrackStateResult.error) {
    return ['BLOCKED', 'Google Play internal track snapshot', googlePlayTrackStateResult.error];
  }
  const snapshot = googlePlayTrackStateResult.snapshot;
  const expectedStatus = String(snapshot?.expected_status || 'completed').toLowerCase();
  const release = (snapshot?.releases ?? []).find((item) =>
    (item?.version_codes ?? [])
      .map((versionCode) => String(versionCode))
      .includes(androidCandidateVersionCode)
  );
  const summary = release
    ? `${snapshot.track}/${release.name || 'unnamed'}/${release.status}/versionCode=${androidCandidateVersionCode}`
    : `${snapshot?.track || 'internal'}/missing/${androidCandidateVersionCode}`;
  return [
    release?.status === expectedStatus ? 'READY' : 'BLOCKED',
    'Google Play internal track snapshot',
    `${summary}; expected status ${expectedStatus}`,
  ];
}

function getPlaySnapshotIssue({ productId, expectedDuration, googlePlayReady }) {
  if (googlePlayReady) return null;
  if (!fs.existsSync(playStoreStatePath)) return null;
  if (playStoreStateResult.error) return 'play store state snapshot is invalid';

  const productState = getSnapshotProductState(playStoreStateResult.snapshot, productId);
  if (!productState) return `live snapshot missing product ${productId}`;
  if (!snapshotHasBillingPeriod(productState, expectedDuration)) {
    return `live snapshot still reports base plans ${summarizeSnapshotBasePlans(productState)}; expected ${expectedDuration}`;
  }
  return null;
}

function getPlayMonthlySnapshotIssue() {
  return getPlaySnapshotIssue({
    productId: EXPECTED.playProductIds.monthly,
    expectedDuration: 'P1M',
    googlePlayReady: isGooglePlayMonthlyReady(),
  });
}

function getPlayAnnualSnapshotIssue() {
  return getPlaySnapshotIssue({
    productId: EXPECTED.playProductIds.annual,
    expectedDuration: 'P1Y',
    googlePlayReady: isGooglePlayAnnualReady(),
  });
}

function getPlayBasePlanReadinessRow({ productId, expectedDuration, label, followup, googlePlayReady }) {
  if (!fs.existsSync(playStoreStatePath)) {
    return ['CHECK LIVE', label, followup];
  }
  if (playStoreStateResult.error) {
    return ['BLOCKED', label, playStoreStateResult.error];
  }
  if (playStoreStateFreshnessIssue) {
    return [
      'STALE',
      label,
      `${playStoreStateFreshnessIssue}; refresh with npm run subscription:qa:play-state`,
    ];
  }

  const productState = getSnapshotProductState(playStoreStateResult.snapshot, productId);
  if (!productState) {
    return ['MISSING', label, `Snapshot does not contain ${productId}`];
  }

  const summary = summarizeSnapshotBasePlans(productState);
  const hasExpectedBasePlan = snapshotHasBillingPeriod(productState, expectedDuration);
  return [
    hasExpectedBasePlan ? 'READY' : googlePlayReady ? 'LAGGING' : 'BLOCKED',
    label,
    `${productId}: ${summary}; expected ${expectedDuration}${
      !hasExpectedBasePlan && googlePlayReady ? '; Google Play direct snapshot is ready' : ''
    }`,
  ];
}

function getPlayMonthlyReadinessRow() {
  return getPlayBasePlanReadinessRow({
    productId: EXPECTED.playProductIds.monthly,
    expectedDuration: 'P1M',
    label: 'Play monthly base plan snapshot',
    followup: `RevenueCat product ${EXPECTED.playProductIds.monthly} must expose billing period P1M before play_monthly evidence`,
    googlePlayReady: isGooglePlayMonthlyReady(),
  });
}

function getPlayAnnualReadinessRow() {
  return getPlayBasePlanReadinessRow({
    productId: EXPECTED.playProductIds.annual,
    expectedDuration: 'P1Y',
    label: 'Play annual base plan snapshot',
    followup: `RevenueCat product ${EXPECTED.playProductIds.annual} must expose billing period P1Y before play_annual evidence`,
    googlePlayReady: isGooglePlayAnnualReady(),
  });
}

function getCandidateVersionCodeIssue(gate) {
  const versionCodeText =
    typeof gate?.versionCode === 'number' || typeof gate?.versionCode === 'string'
      ? String(gate.versionCode).trim()
      : '';
  if (!/^[1-9]\d*$/.test(versionCodeText)) {
    return `versionCode is required for Android release candidate ${androidCandidateVersionCode}`;
  }
  if (versionCodeText !== androidCandidateVersionCode) {
    return `versionCode ${versionCodeText} does not match Android release candidate ${androidCandidateVersionCode} from app.json`;
  }
  return null;
}

function getGateEvidenceIssue(evidence, scenario) {
  const key = slugify(scenario);
  const gate = evidence.gates?.[key];
  const requiresEasBuild = key.startsWith('play_');
  const evidenceText = typeof gate?.evidence === 'string' ? gate.evidence.trim() : '';
  const templateEvidence = evidenceExample.gates?.[key]?.evidence?.trim();
  const testedAt = typeof gate?.testedAt === 'string' ? gate.testedAt.trim() : '';
  const easBuildId = typeof gate?.easBuildId === 'string' ? gate.easBuildId.trim() : '';
  const deviceId = typeof gate?.deviceId === 'string' ? gate.deviceId.trim() : '';
  const installerPackageName =
    typeof gate?.installerPackageName === 'string' ? gate.installerPackageName.trim() : '';
  const versionCodeText =
    typeof gate?.versionCode === 'number' || typeof gate?.versionCode === 'string'
      ? String(gate.versionCode).trim()
      : '';
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
  if (requiresEasBuild && deviceId.length === 0) {
    return 'deviceId is required for Play evidence';
  }
  if (requiresEasBuild && /^emulator-\d+$/i.test(deviceId)) {
    return 'deviceId must be a physical Android device, not an emulator';
  }
  if (requiresEasBuild && installerPackageName.length === 0) {
    return 'installerPackageName is required for Play evidence';
  }
  if (requiresEasBuild && installerPackageName !== 'com.android.vending') {
    return 'installerPackageName must be com.android.vending';
  }
  if (requiresEasBuild && !/^[1-9]\d*$/.test(versionCodeText)) {
    return 'versionCode is required for Play evidence';
  }
  if (requireFullCoverage) {
    const candidateVersionIssue = getCandidateVersionCodeIssue(gate);
    if (candidateVersionIssue) return candidateVersionIssue;
  }
  if (
    requiresEasBuild &&
    !/(com\.android\.vending|play-installed|installed from play|installation play)/i.test(evidenceText)
  ) {
    return 'Play Internal Testing install source must be confirmed';
  }
  if (key === 'play_monthly' && !/\bP1M\b/i.test(evidenceText)) {
    return 'monthly base plan P1M must be confirmed';
  }
  if (key === 'play_monthly') {
    const snapshotIssue = getPlayMonthlySnapshotIssue();
    if (snapshotIssue) return snapshotIssue;
  }
  if (key === 'play_annual' && !/\bP1Y\b/i.test(evidenceText)) {
    return 'annual base plan P1Y must be confirmed';
  }
  if (key === 'play_annual') {
    const snapshotIssue = getPlayAnnualSnapshotIssue();
    if (snapshotIssue) return snapshotIssue;
  }
  if (key === 'play_cancellation_and_expiry' && !/(cancel|cancellation|cancelled|canceled|expiry|expired)/i.test(evidenceText)) {
    return 'cancellation or expiry must be observed';
  }
  if (key === 'play_cancellation_and_expiry' && !/\bwebhook\b/i.test(evidenceText)) {
    return 'RevenueCat webhook must be confirmed';
  }
  if (key === 'play_cancellation_and_expiry' && !(/\bbackend\b/i.test(evidenceText) && /converg|sync/i.test(evidenceText))) {
    return 'backend convergence must be confirmed';
  }
  if (key === 'account_switch' && !/second account/i.test(evidenceText)) {
    return 'second account must be confirmed';
  }
  if (key === 'account_switch' && !/\bfree\b/i.test(evidenceText)) {
    return 'second account free state must be confirmed';
  }
  if (key === 'account_switch' && !/\binactive\b/i.test(evidenceText)) {
    return 'second account inactive state must be confirmed';
  }

  return null;
}

function hasGateEvidence(evidence, scenario) {
  return getGateEvidenceIssue(evidence, scenario) === null;
}

function getEvidenceCommand(scenario) {
  const gate = slugify(scenario);
  const baseArgs = [
    'npm run subscription:qa:evidence --',
    `--gate ${gate}`,
    '--tester <tester-email>',
    '--app-user-id <revenuecat-app-user-uuid>',
    `--version-code ${androidCandidateVersionCode}`,
  ];

  if (gate === 'account_switch') {
    return [
      ...baseArgs,
      '--evidence "paid account remains plus while second account remains free / inactive after logout and login"',
    ].join(' ');
  }

  if (gate === 'play_monthly') {
    return [
      ...baseArgs,
      '--eas-build-id <eas-build-uuid>',
      '--device-id <physical-adb-id>',
      '--installer-package-name com.android.vending',
      '--evidence "Play monthly purchase completed after installed from Play (com.android.vending), product noctalia_plus:monthly, base plan P1M confirmed, backend converged"',
    ].join(' ');
  }

  if (gate === 'play_annual') {
    return [
      ...baseArgs,
      '--eas-build-id <eas-build-uuid>',
      '--device-id <physical-adb-id>',
      '--installer-package-name com.android.vending',
      '--evidence "Play annual purchase completed after installed from Play (com.android.vending), product noctalia_plus:annual, base plan P1Y confirmed, backend converged"',
    ].join(' ');
  }

  if (gate === 'play_cancellation_and_expiry') {
    return [
      ...baseArgs,
      '--eas-build-id <eas-build-uuid>',
      '--device-id <physical-adb-id>',
      '--installer-package-name com.android.vending',
      '--evidence "Play cancellation or expiry observed after installed from Play (com.android.vending), RevenueCat webhook and backend state converged"',
    ].join(' ');
  }

  return [...baseArgs, '--evidence "<observed result>"'].join(' ');
}

const pkg = readJson('package.json');
const eas = readJson('eas.json');
const mockEnv = readEnv('.env.mock');
const testStoreEnv = readEnv('.env.teststore');
const playStoreEnv = fs.existsSync(path.join(ROOT, '.env.playstore')) ? readEnv('.env.playstore') : {};
const subscriptionConstants = read('constants/subscription.ts');
const purchaseRunner = read('scripts/run-subscription-teststore-purchase.js');
const apkBuildRunner = read('scripts/build-android-apk.js');
const restoreRunner = fs.existsSync(path.join(ROOT, 'scripts/run-subscription-teststore-restore.js'))
  ? read('scripts/run-subscription-teststore-restore.js')
  : '';
const accountSwitchRunner = fs.existsSync(path.join(ROOT, 'scripts/run-subscription-account-switch.js'))
  ? read('scripts/run-subscription-account-switch.js')
  : '';
const authenticatedTestStorePaywallFlowPath =
  'maestro/subscription-teststore-paywall-auth.yml';
const authenticatedTestStorePaywallFlow = fs.existsSync(
  path.join(ROOT, authenticatedTestStorePaywallFlowPath)
)
  ? read(authenticatedTestStorePaywallFlowPath)
  : '';
const maestroRunner = read('scripts/run-maestro-android.js');
const evidenceExample = readJson('doc_web_interne/docs/revenuecat-qa-evidence.example.json');
const gitignore = read('.gitignore');
const evidenceResult = readEvidenceResult();
const evidence = evidenceResult.evidence;
const playStoreStateResult = readPlayStoreStateResult();
const playStoreStateFreshnessIssue = playStoreStateResult.snapshot
  ? getPlayStoreStateFreshnessIssue(playStoreStateResult.snapshot)
  : null;
const revenueCatSubscriberExpiryStateResult = readRevenueCatSubscriberExpiryStateResult();
const googlePlaySubscriptionStateResult = readGooglePlaySubscriptionStateResult();
const googlePlayTrackStateResult = readGooglePlayTrackStateResult();
const googleOAuthAndroidClientStateResult = readGoogleOAuthAndroidClientStateResult();
const googlePlayPaymentsProfileStateResult = readGooglePlayPaymentsProfileStateResult();
const supabasePlayIntegritySecretsStateResult = readSupabasePlayIntegritySecretsStateResult();

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
    'Authenticated Test Store paywall flow exists',
    Boolean(authenticatedTestStorePaywallFlow) &&
      pkg.scripts['test:e2e:release:teststore:paywall:local'] ===
        'node ./scripts/run-maestro-android.js --suite release-teststore-paywall --retries 0 --no-start-metro' &&
      maestroRunner.includes("'release-teststore-paywall':") &&
      maestroRunner.includes(authenticatedTestStorePaywallFlowPath) &&
      authenticatedTestStorePaywallFlow.includes('text.subscription.qa.mode') &&
      authenticatedTestStorePaywallFlow.includes('packages 2.*') &&
      authenticatedTestStorePaywallFlow.includes('btn.paywall.selectMonthly') &&
      authenticatedTestStorePaywallFlow.includes('btn.paywall.selectAnnual') &&
      authenticatedTestStorePaywallFlow.includes('btn.paywall.purchase') &&
      authenticatedTestStorePaywallFlow.includes('btn.paywall.restore') &&
      !/- tapOn:\s*\n\s+id: btn\.paywall\.(?:purchase|restore)/.test(
        authenticatedTestStorePaywallFlow
      ),
    `${authenticatedTestStorePaywallFlowPath} verifies Test Store mode, two packages and the real paywall without a transaction`
  ),
  check(
    'Guarded Test Store purchase flow exists',
    fs.existsSync(path.join(ROOT, 'maestro/subscription-teststore-purchase-manual.yml')) &&
      fs.existsSync(path.join(ROOT, 'scripts/run-subscription-teststore-purchase.js')) &&
      purchaseRunner.includes('test:e2e:release:teststore:local') &&
      purchaseRunner.includes('A specific QA target is required'),
    'maestro/subscription-teststore-purchase-manual.yml via scripts/run-subscription-teststore-purchase.js'
  ),
  check(
    'Google Test Store purchase flow exists',
    fs.existsSync(path.join(ROOT, 'maestro/subscription-teststore-purchase-google-manual.yml')) &&
      purchaseRunner.includes('REVENUECAT_QA_AUTH') &&
      purchaseRunner.includes('subscription-teststore-purchase-google-manual.yml') &&
      read('maestro/subscription-teststore-purchase-google-manual.yml').includes('QA_EMAIL_REGEX') &&
      !read('maestro/subscription-teststore-purchase-google-manual.yml').includes('QA_EMAIL}.*'),
    'REVENUECAT_QA_AUTH=google -> maestro/subscription-teststore-purchase-google-manual.yml'
  ),
  check(
    'Test Store restore flow exists',
    fs.existsSync(path.join(ROOT, 'maestro/subscription-teststore-restore-google-manual.yml')) &&
      fs.existsSync(path.join(ROOT, 'scripts/run-subscription-teststore-restore.js')) &&
      restoreRunner.includes('I_APPROVE_TEST_STORE_RESTORE') &&
      restoreRunner.includes('test:e2e:release:teststore:local') &&
      pkg.scripts['test:e2e:subscription-teststore:restore:preflight']?.includes('--preflight'),
    'maestro/subscription-teststore-restore-google-manual.yml via guarded standalone Release restore runner'
  ),
  check(
    'Test Store signout guard exists',
    fs.existsSync(path.join(ROOT, 'maestro/subscription-teststore-signout-guard.yml')),
    'maestro/subscription-teststore-signout-guard.yml'
  ),
  check(
    'Account switch email flow exists',
    fs.existsSync(path.join(ROOT, 'maestro/subscription-teststore-account-switch-free-email-manual.yml')) &&
      fs.existsSync(path.join(ROOT, 'scripts/run-subscription-account-switch.js')) &&
      accountSwitchRunner.includes('REVENUECAT_QA_SWITCH_FREE_EMAIL') &&
      accountSwitchRunner.includes('REVENUECAT_QA_EMAIL') &&
      accountSwitchRunner.includes('test:e2e:release:teststore:local') &&
      pkg.scripts['test:e2e:subscription-teststore:account-switch:preflight']?.includes('--preflight'),
    'REVENUECAT_QA_SWITCH_FREE_EMAIL -> maestro/subscription-teststore-account-switch-free-email-manual.yml'
  ),
  check(
    'Transactional Test Store flows use standalone Release',
    [
      'maestro/subscription-teststore-purchase-manual.yml',
      'maestro/subscription-teststore-purchase-google-manual.yml',
      'maestro/subscription-teststore-restore-google-manual.yml',
      'maestro/subscription-teststore-account-switch-free-email-manual.yml',
    ].every((flow) => {
      const source = read(flow);
      return !source.includes('open-mock-app.yml') &&
        !source.includes('expo-development-client') &&
        !source.includes('10.0.2.2') &&
        source.includes('open-release-app-');
    }),
    'purchase, restore and account-switch run from an installed Release bundle with Metro disabled'
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
    'Subscription QA report CLIs are wired',
    pkg.scripts['subscription:qa:report'] === 'node ./scripts/subscription-qa-report.js' &&
      pkg.scripts['subscription:qa:release-gate'] ===
        'node ./scripts/subscription-qa-report.js --require-full',
    'npm run subscription:qa:report and npm run subscription:qa:release-gate'
  ),
  check(
    'Production APK build is gated by subscription QA',
    pkg.scripts['android:gates:prebuild'] ===
      'node ./scripts/check-android-release-gates.js --prebuild' &&
      pkg.scripts['build:apk:prod'] === 'node ./scripts/build-android-apk.js prod' &&
      apkBuildRunner.includes("'check-android-release-gates.js'") &&
      apkBuildRunner.includes("'--prebuild'") &&
      apkBuildRunner.includes("EXPO_NO_DOTENV: '1'") &&
      apkBuildRunner.includes("const EAS_CLI_SPEC = 'eas-cli@21.0.0'") &&
      apkBuildRunner.includes("platform === 'win32' ? 'npx.cmd' : 'npx'") &&
      !apkBuildRunner.includes('rmSync') &&
      pkg.scripts['android:gates:strict'] ===
        'node ./scripts/check-android-release-gates.js',
    'build:apk:prod uses exact EAS CLI 21.0.0 via npx, preserves .env.local, disables dotenv, and runs the prebuild release gates; android:gates:strict qualifies the candidate after Play upload'
  ),
  check(
    'RevenueCat device app user id extractor exists',
    fs.existsSync(path.join(ROOT, 'scripts/extract-revenuecat-app-user-id.js')) &&
      pkg.scripts['subscription:qa:device-app-user-id'] === 'node ./scripts/extract-revenuecat-app-user-id.js',
    'npm run subscription:qa:device-app-user-id -- --device emulator-5554 --env-file .env.teststore'
  ),
  check(
    'Android device diagnostic exists',
    fs.existsSync(path.join(ROOT, 'scripts/check-android-adb-device.js')) &&
      pkg.scripts['android:device'] === 'node ./scripts/check-android-adb-device.js --report-only',
    'npm run android:device'
  ),
  check(
    'Physical Android device diagnostic exists',
    fs.existsSync(path.join(ROOT, 'scripts/check-android-adb-device.js')) &&
      pkg.scripts['android:device:physical'] === 'node ./scripts/check-android-adb-device.js --require-physical',
    'npm run android:device:physical'
  ),
  check(
    'Play install source diagnostic exists',
    fs.existsSync(path.join(ROOT, 'scripts/check-play-install-source.js')) &&
      pkg.scripts['android:play-install-source'] === 'node ./scripts/check-play-install-source.js',
    'npm run android:play-install-source -- --device <adb-id>'
  ),
  check(
    'Play QA device preflight exists',
    fs.existsSync(path.join(ROOT, 'scripts/check-play-qa-device.js')) &&
      pkg.scripts['android:play-qa-device'] === 'node ./scripts/check-play-qa-device.js',
    'npm run android:play-qa-device -- --device <adb-id>'
  ),
  check(
    'Play QA device wait helper exists',
    fs.existsSync(path.join(ROOT, 'scripts/wait-for-play-qa-device.js')) &&
      pkg.scripts['android:play-qa-device:wait'] === 'node ./scripts/wait-for-play-qa-device.js',
    'npm run android:play-qa-device:wait'
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
    'Google Play subscription state snapshot is gitignored',
    gitignore.includes('doc_web_interne/docs/google-play-subscription-state.local.json'),
    'doc_web_interne/docs/google-play-subscription-state.local.json'
  ),
  check(
    'RevenueCat subscriber expiry snapshot is gitignored',
    gitignore.includes('doc_web_interne/docs/revenuecat-subscriber-expiry-state.local.json'),
    'doc_web_interne/docs/revenuecat-subscriber-expiry-state.local.json'
  ),
  check(
    'Google Play track state snapshot is gitignored',
    gitignore.includes('doc_web_interne/docs/google-play-track-state.local.json'),
    'doc_web_interne/docs/google-play-track-state.local.json'
  ),
  check(
    'Local evidence file parses',
    !fs.existsSync(evidencePath) || !evidenceResult.error,
    fs.existsSync(evidencePath) ? evidenceResult.error || evidencePath : 'not provided'
  ),
  check(
    'Google Play subscription state snapshot parses',
    !fs.existsSync(googlePlaySubscriptionStatePath) || !googlePlaySubscriptionStateResult.error,
    fs.existsSync(googlePlaySubscriptionStatePath)
      ? googlePlaySubscriptionStateResult.error || googlePlaySubscriptionStatePath
      : 'not provided'
  ),
  check(
    'Google Play track state snapshot parses',
    !fs.existsSync(googlePlayTrackStatePath) || !googlePlayTrackStateResult.error,
    fs.existsSync(googlePlayTrackStatePath)
      ? googlePlayTrackStateResult.error || googlePlayTrackStatePath
      : 'not provided'
  ),
  check(
    'Play store state snapshot parses',
    !fs.existsSync(playStoreStatePath) || !playStoreStateResult.error,
    fs.existsSync(playStoreStatePath) ? playStoreStateResult.error || playStoreStatePath : 'not provided'
  ),
  check(
    'RevenueCat subscriber expiry snapshot parses',
    !fs.existsSync(revenueCatSubscriberExpiryStatePath) || !revenueCatSubscriberExpiryStateResult.error,
    fs.existsSync(revenueCatSubscriberExpiryStatePath)
      ? revenueCatSubscriberExpiryStateResult.error || revenueCatSubscriberExpiryStatePath
      : 'not provided'
  ),
  check(
    'Google OAuth Android client snapshot parses',
    !fs.existsSync(googleOAuthAndroidClientStatePath) || !googleOAuthAndroidClientStateResult.error,
    fs.existsSync(googleOAuthAndroidClientStatePath)
      ? googleOAuthAndroidClientStateResult.error || googleOAuthAndroidClientStatePath
      : 'not provided'
  ),
  check(
    'Google Play payments profile snapshot parses',
    !fs.existsSync(googlePlayPaymentsProfileStatePath) || !googlePlayPaymentsProfileStateResult.error,
    fs.existsSync(googlePlayPaymentsProfileStatePath)
      ? googlePlayPaymentsProfileStateResult.error || googlePlayPaymentsProfileStatePath
      : 'not provided'
  ),
  check(
    'Supabase Play Integrity secrets snapshot parses',
    !fs.existsSync(supabasePlayIntegritySecretsStatePath) || !supabasePlayIntegritySecretsStateResult.error,
    fs.existsSync(supabasePlayIntegritySecretsStatePath)
      ? supabasePlayIntegritySecretsStateResult.error || supabasePlayIntegritySecretsStatePath
      : 'not provided'
  ),
  check(
    'Play store state snapshot updater exists',
    fs.existsSync(path.join(ROOT, 'scripts/update-revenuecat-play-store-state.js')) &&
      pkg.scripts['subscription:qa:play-state'] === 'node ./scripts/update-revenuecat-play-store-state.js',
    'npm run subscription:qa:play-state -- --input revenuecat-store-state.json'
  ),
  check(
    'Google Play subscription state updater exists',
    fs.existsSync(path.join(ROOT, 'scripts/update-google-play-subscription-state.js')) &&
      pkg.scripts['subscription:qa:google-play-state'] === 'node ./scripts/update-google-play-subscription-state.js',
    'npm run subscription:qa:google-play-state -- --input google-play-subscription.json'
  ),
  check(
    'RevenueCat subscriber expiry state updater exists',
    fs.existsSync(path.join(ROOT, 'scripts/update-revenuecat-subscriber-expiry-state.js')) &&
      pkg.scripts['subscription:qa:revenuecat-subscriber-expiry'] ===
        'node ./scripts/update-revenuecat-subscriber-expiry-state.js',
    'npm run subscription:qa:revenuecat-subscriber-expiry -- --input revenuecat-subscriber.json --app-user-id <uuid>'
  ),
  check(
    'Google Play track state updater exists',
    fs.existsSync(path.join(ROOT, 'scripts/update-google-play-track-state.js')) &&
      pkg.scripts['android:google-play-track-state'] === 'node ./scripts/update-google-play-track-state.js',
    'npm run android:google-play-track-state -- --input google-play-track.json'
  ),
  check(
    'Google OAuth Android client state updater exists',
    fs.existsSync(path.join(ROOT, 'scripts/update-google-oauth-android-client-state.js')) &&
      pkg.scripts['android:google-oauth-android-client-state'] ===
        'node ./scripts/update-google-oauth-android-client-state.js',
    'npm run android:google-oauth-android-client-state -- --client-id <id> --package-name com.tanuki75.noctalia --sha1 <sha1>'
  ),
  check(
    'Google Play payments profile state updater exists',
    fs.existsSync(path.join(ROOT, 'scripts/update-google-play-payments-profile-state.js')) &&
      pkg.scripts['android:google-play-payments-profile-state'] ===
        'node ./scripts/update-google-play-payments-profile-state.js',
    'npm run android:google-play-payments-profile-state -- --tax-information <status> --payout-method <status>'
  ),
  check(
    'Supabase Play Integrity secrets state updater exists',
    fs.existsSync(path.join(ROOT, 'scripts/update-supabase-play-integrity-secrets-state.js')) &&
      pkg.scripts['android:supabase-play-integrity-secrets-state'] ===
        'node ./scripts/update-supabase-play-integrity-secrets-state.js',
    'npm run android:supabase-play-integrity-secrets-state -- --PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64 present --PLAY_INTEGRITY_PACKAGE_NAME present --PLAY_INTEGRITY_PACKAGE_NAME-value com.tanuki75.noctalia --GUEST_SESSION_SECRET present'
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
    'Offering packages and prices load without purchase',
    'maestro/subscription-teststore-readiness.yml',
  ],
  [
    'Automated',
    'Authenticated Test Store paywall',
    'RevenueCat Test Store',
    'Test Store mode, two packages, monthly/annual and purchase/restore controls without a transaction',
    authenticatedTestStorePaywallFlowPath,
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
    'maestro/subscription-teststore-restore-google-manual.yml plus structured evidence',
  ],
  [
    'Manual purchase gate',
    'Account switch',
    'Test Store or Play',
    'Plus user logout does not leak to free user',
    'maestro/subscription-teststore-signout-guard.yml covers logout/no-leak; run test:e2e:subscription-teststore:account-switch with a second real email account to close this gate',
  ],
  [
    'External store gate',
    'Play monthly',
    'Google Play Internal Testing',
    'Product noctalia_plus:monthly with base plan P1M',
    'Google Play API confirms monthly/P1M/ACTIVE; requires Play-installed internal testing purchase and backend convergence',
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
console.log(`Generated: ${reportNow.toISOString()}`);
console.log('');
console.log('## RevenueCat Wiring');
console.log('');
console.log(`- Entitlement: ${EXPECTED.entitlement}`);
console.log(`- Offering: ${EXPECTED.offering}`);
console.log(`- Test Store products: ${EXPECTED.testStoreProducts.join(', ')}`);
console.log(`- Google Play products: ${EXPECTED.playProducts.join(', ')}`);
console.log(`- Manual evidence: ${fs.existsSync(evidencePath) ? 'local file present' : 'not provided'}`);
console.log(
  `- Google Play subscription state snapshot: ${
    fs.existsSync(googlePlaySubscriptionStatePath) ? 'local file present' : 'not provided'
  }`
);
console.log(
  `- Google Play internal track snapshot: ${
    fs.existsSync(googlePlayTrackStatePath) ? 'local file present' : 'not provided'
  }`
);
console.log(`- Play Store state snapshot: ${fs.existsSync(playStoreStatePath) ? 'local file present' : 'not provided'}`);
console.log(
  `- RevenueCat subscriber expiry snapshot: ${
    fs.existsSync(revenueCatSubscriberExpiryStatePath) ? 'local file present' : 'not provided'
  }`
);
console.log(
  `- Google OAuth Android client snapshot: ${
    fs.existsSync(googleOAuthAndroidClientStatePath) ? 'local file present' : 'not provided'
  }`
);
console.log(
  `- Google Play payments profile snapshot: ${
    fs.existsSync(googlePlayPaymentsProfileStatePath) ? 'local file present' : 'not provided'
  }`
);
console.log(
  `- Supabase Play Integrity secrets snapshot: ${
    fs.existsSync(supabasePlayIntegritySecretsStatePath) ? 'local file present' : 'not provided'
  }`
);
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
    const gate = evidence.gates[slugify(scenario)];
    const safeEvidence = redactEvidenceForOutput(gate);
    const candidateVersionIssue = getCandidateVersionCodeIssue(gate);
    if (candidateVersionIssue) {
      return [
        'Historical',
        scenario,
        layer,
        proof,
        `${safeEvidence} (${candidateVersionIssue})`,
      ];
    }
    return ['Verified', scenario, layer, proof, safeEvidence];
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
console.log(`Historical manual/external scenarios: ${scenarioRows.filter(([coverage]) => coverage === 'Historical').length}`);
console.log(`Manual or external gates remaining: ${manualGates.length}`);
if (manualGates.length > 0) {
  console.log('');
  console.log('## Next Gates');
  console.log('');
  manualGates.forEach(([, scenario, layer, proof, evidence]) => {
    console.log(`- ${scenario} (${layer}): ${proof}; ${evidence}`);
  });
  console.log('');
  console.log('## Evidence Commands');
  console.log('');
  manualGates.forEach(([, scenario]) => {
    console.log(`- ${scenario}: \`${getEvidenceCommand(scenario)}\``);
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
const testStoreAuthMode = process.env.REVENUECAT_QA_AUTH || 'email';
const testStoreAccountEnvReady = Boolean(
  process.env.REVENUECAT_QA_EMAIL &&
    (testStoreAuthMode === 'google' || process.env.REVENUECAT_QA_PASSWORD)
);

const runtimeReadiness = [
  [
    testStoreAccountEnvReady ? 'READY' : 'MISSING',
    'Test Store signed-in account env',
    `REVENUECAT_QA_AUTH=${testStoreAuthMode}, REVENUECAT_QA_EMAIL=${envState('REVENUECAT_QA_EMAIL')}, REVENUECAT_QA_PASSWORD=${envState(
      'REVENUECAT_QA_PASSWORD'
    )}`,
  ],
  [
    process.env.REVENUECAT_QA_APPROVAL === EXPECTED.purchaseApproval ? 'READY' : 'NOT SET',
    'Test Store purchase approval',
    'Required only before a guarded Test Store purchase; preflight must not require approval',
  ],
  [
    process.env.REVENUECAT_QA_SWITCH_FREE_EMAIL && process.env.REVENUECAT_QA_SWITCH_FREE_PASSWORD
      ? 'READY'
      : 'MISSING',
    'Account switch second account env',
    `REVENUECAT_QA_SWITCH_FREE_EMAIL=${envState('REVENUECAT_QA_SWITCH_FREE_EMAIL')}, REVENUECAT_QA_SWITCH_FREE_PASSWORD=${envState(
      'REVENUECAT_QA_SWITCH_FREE_PASSWORD'
    )}`,
  ],
  [
    'CHECK',
    'Device app user id extraction',
    'Run npm run subscription:qa:device-app-user-id -- --device emulator-5554 --env-file .env.teststore before recording manual evidence',
  ],
  ['CHECK', 'Android device visibility', 'Run npm run android:device and require ADB: READY before device flows'],
  [
    'CHECK',
    'Physical Android device visibility',
    'Run npm run android:device:physical before recording play_monthly, play_annual, or play_cancellation_and_expiry evidence; this checks USB and ADB Wireless Debugging mDNS visibility',
  ],
  [
    'CHECK',
    'Play QA device preflight',
    'Run npm run android:play-qa-device:wait while connecting one Play-installed tester phone, add -- --device <adb-id> when multiple devices are ready, or run npm run android:play-qa-device -- --device <adb-id> after the device is ready. Before UI-driven purchase or restore flows, run npm run android:play-qa-device:wait -- --device <adb-id> --expected-version-code <code> --require-ui-ready.',
  ],
  getGooglePlayMonthlyReadinessRow(),
  getGooglePlayAnnualReadinessRow(),
  getGooglePlayTrackReadinessRow(),
  getRevenueCatSubscriberExpiryReadinessRow(),
  getPaymentsProfileReadinessRow(),
  getSupabaseSecretsReadinessRow(),
  getPlayMonthlyReadinessRow(),
  getPlayAnnualReadinessRow(),
];

console.log('');
console.log('## Current Session Readiness');
console.log('');
console.log('| Status | Gate | Detail |');
console.log('| --- | --- | --- |');
runtimeReadiness.forEach(([status, label, detail]) => {
  console.log(`| ${status} | ${label} | ${detail} |`);
});

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

return {
  stdout: lines.length > 0 ? `${lines.join('\n')}\n` : '',
  stderr: '',
  exitCode: process.exitCode,
};
}

module.exports = {
  createOverlayFileSystem,
  generateSubscriptionQaReport,
};

if (require.main === module) {
  const result = generateSubscriptionQaReport({
    args: nodeProcess.argv.slice(2),
    env: nodeProcess.env,
  });
  nodeProcess.stdout.write(result.stdout);
  if (result.stderr) nodeProcess.stderr.write(result.stderr);
  nodeProcess.exitCode = result.exitCode;
}
