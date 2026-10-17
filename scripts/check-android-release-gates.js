#!/usr/bin/env node
/* global __dirname */

const { createHash } = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const {
  commandExists,
  getAdbCandidates,
  resolveCommand,
  resolveNpmInvocation,
} = require('./android-tooling');
const {
  detectAdbMdnsServices,
  detectUsbAndroidDevice,
} = require('./check-android-adb-device');
const { getOpenPaymentProfileRequirements } = require('./update-google-play-payments-profile-state');
const {
  getTrackStatus,
  readAppVersionCode,
} = require('./update-google-play-track-state');
const {
  getSupabasePlayIntegritySecretIssues,
} = require('./update-supabase-play-integrity-secrets-state');

const ROOT = path.resolve(__dirname, '..');
const PLAY_INTEGRITY_PROJECT_NUMBER_KEY = 'EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER';
const REVENUECAT_TEST_STORE_DEBUGGABLE_KEY =
  'NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE';
const ANALYSIS_JOBS_ENABLED_KEY = 'EXPO_PUBLIC_ANALYSIS_JOBS_ENABLED';
const EXPECTED_GOOGLE_CLOUD_PROJECT_ID = 'gen-lang-client-0336445544';
const EXPECTED_GOOGLE_OAUTH_ANDROID_CLIENT_ID = '359653779023-5dhs012rh7l3cjf0leoknn7j0dlgq0ok.apps.googleusercontent.com';
const EXPECTED_GOOGLE_OAUTH_ANDROID_SHA1 = 'BC:CF:C2:96:38:47:81:D6:8C:B7:B6:5A:BA:84:CB:B3:8C:85:E0:59';
const EXPECTED_ANDROID_PACKAGE_NAME = 'com.tanuki75.noctalia';
const RELEASE_QUALIFICATION_WORKFLOW =
  '.eas/workflows/android-release-qualification.yml';
// Owner decision 2026-10-14: the Android release journeys run locally with
// TesterArmy on an emulator, against a production-apk Release build, instead of
// a Maestro EAS job. tools/e2e/run.mjs writes one immutable folder per run here.
const TESTERARMY_ANDROID_RUNS = 'tools/e2e/.e2e/dreamer-android';
const TESTERARMY_RELEASE_PROFILE = 'production-apk';
const TESTERARMY_RELEASE_COMMANDS =
  'build production-apk with `node tools/e2e/run.mjs dreamer android build` (E2E_BUILD_PROFILE=production-apk), then run `E2E_DEVICE=<emulator-serial> E2E_RELEASE_RECEIPT=<its release.json> npm run test:testerarmy:mobile -- dreamer android run --install-release` (tools/e2e/README.md)';
const VOICE_MANUAL_CHECKLIST = 'doc_web_interne/docs/android-release-checklist.md';
const REQUIRED_EAS_PROFILES = ['preview', 'release', 'production-apk', 'production'];
const ANALYSIS_BUNDLE_EAS_PROFILES = ['release', 'production-apk', 'production'];
const REQUIRED_TESTSTORE_PUBLIC_ENV = [
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY',
  'EXPO_PUBLIC_ANALYTICS_DEBUG',
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
  PLAY_INTEGRITY_PROJECT_NUMBER_KEY,
];

function parseDotEnv(content) {
  const values = {};
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  });
  return values;
}

function listAdbDevices(spawn = spawnSync, adbCommand = 'adb') {
  const result = spawn(adbCommand, ['devices'], {
    encoding: 'utf8',
    timeout: 8000,
  });
  if (result.status !== 0) {
    return { ok: false, devices: [], message: (result.stderr || result.stdout || '').trim() };
  }
  const devices = String(result.stdout || '')
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, state] = line.split(/\s+/);
      return { id, state };
    })
    .filter((device) => device.id && device.state === 'device');
  return { ok: true, devices, message: `${devices.length} Android device(s) ready` };
}

function getAdbDeviceVisibilityCheck(spawn = spawnSync, adbCommand = 'adb', platform = process.platform) {
  const devices = listAdbDevices(spawn, adbCommand);
  if (devices.ok && devices.devices.length > 0) {
    return {
      status: 'pass',
      details: devices.message,
      remediation:
        'Start an Android emulator for local checks, or connect/unlock a physical Android device for Play QA.',
    };
  }

  const mdns = detectAdbMdnsServices(spawn, adbCommand);
  const usb = detectUsbAndroidDevice(spawn, platform);
  const baseDetails = devices.ok ? devices.message : devices.message || 'Unable to list adb devices.';
  const usbDetail = usb.supported
    ? `USB ${usb.visible ? 'visible' : 'not visible'}: ${usb.message}`
    : null;
  if (mdns.supported && mdns.visible) {
    const serviceList = (mdns.phoneServices || mdns.services)
      .map((service) => service.address || service.instance)
      .filter(Boolean)
      .join(', ');
    return {
      status: 'blocked',
      details: [baseDetails, usbDetail, `wireless debugging is visible (${serviceList}).`]
        .filter(Boolean)
        .join('; '),
      remediation: mdns.next,
    };
  }

  return {
    status: 'blocked',
    details: [baseDetails, usbDetail, mdns.supported && mdns.message ? mdns.message : null]
      .filter(Boolean)
      .join('; '),
    remediation:
      usb.supported && usb.visible
        ? 'Unlock the phone, enable USB debugging, select File transfer / Android Auto USB mode, and accept the RSA fingerprint prompt. If no prompt appears, toggle USB debugging or revoke USB debugging authorizations, then reconnect.'
        : mdns.supported && mdns.next
          ? mdns.next
          : 'Start an Android emulator for local checks, connect/unlock a physical Android device for Play QA, or enable Wireless debugging on the phone and keep the pairing screen open.',
  };
}

function readJson(rootDir, relativePath) {
  const filePath = path.join(rootDir, relativePath);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function addCheck(checks, status, title, details, remediation) {
  checks.push({ status, title, details, remediation });
}

function getAndroidReleaseOptimizationCheck(appConfig) {
  const plugins = Array.isArray(appConfig?.expo?.plugins)
    ? appConfig.expo.plugins
    : [];
  const buildPropertiesPlugin = plugins.find(
    (plugin) =>
      plugin === 'expo-build-properties' ||
      (Array.isArray(plugin) && plugin[0] === 'expo-build-properties')
  );
  const androidConfig = Array.isArray(buildPropertiesPlugin)
    ? buildPropertiesPlugin[1]?.android
    : undefined;
  const minify = androidConfig?.enableMinifyInReleaseBuilds;
  const shrinkResources =
    androidConfig?.enableShrinkResourcesInReleaseBuilds;
  const enabled = minify === true && shrinkResources === true;
  const describe = (value) =>
    value === true ? 'true' : value === false ? 'false' : 'missing';

  return {
    status: enabled ? 'pass' : 'fail',
    details: buildPropertiesPlugin
      ? [
          'expo-build-properties Android:',
          `enableMinifyInReleaseBuilds=${describe(minify)},`,
          `enableShrinkResourcesInReleaseBuilds=${describe(shrinkResources)}.`,
        ].join(' ')
      : 'expo-build-properties is not registered in app.json expo.plugins.',
    remediation:
      'Set expo-build-properties android.enableMinifyInReleaseBuilds and android.enableShrinkResourcesInReleaseBuilds to true in app.json.',
  };
}

function summarizeCommandOutput(output) {
  const lines = String(output || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const releaseSmoke = lines.filter((line) =>
    /subscription-release-smoke.*(?:assertions:|BLOCKED - final release smoke)/i.test(line)
  );
  if (releaseSmoke.length > 0) return releaseSmoke.join(' ');
  const important = lines.filter((line) =>
    /Full RevenueCat workflow is not complete|Manual or external gates remaining|Blocked checks:/i.test(line)
  );
  return (important.length > 0 ? important : lines.slice(-3)).join(' ');
}

function readGoogleCloudProjectState({
  rootDir = ROOT,
  existsSync = fs.existsSync,
  readFileSync = fs.readFileSync,
  env = process.env,
} = {}) {
  const filePath = env.GOOGLE_CLOUD_PROJECT_STATE_PATH
    ? path.resolve(rootDir, env.GOOGLE_CLOUD_PROJECT_STATE_PATH)
    : path.join(rootDir, 'doc_web_interne/docs/google-cloud-project-state.local.json');
  if (!existsSync(filePath)) {
    return { snapshot: null, error: null, filePath };
  }
  try {
    return { snapshot: JSON.parse(readFileSync(filePath, 'utf8')), error: null, filePath };
  } catch (error) {
    return {
      snapshot: null,
      error: error instanceof Error ? error.message.replace(/\r?\n/g, ' ') : String(error),
      filePath,
    };
  }
}

function readGoogleOAuthAndroidClientState({
  rootDir = ROOT,
  existsSync = fs.existsSync,
  readFileSync = fs.readFileSync,
  env = process.env,
} = {}) {
  const filePath = env.GOOGLE_OAUTH_ANDROID_CLIENT_STATE_PATH
    ? path.resolve(rootDir, env.GOOGLE_OAUTH_ANDROID_CLIENT_STATE_PATH)
    : path.join(rootDir, 'doc_web_interne/docs/google-oauth-android-client-state.local.json');
  if (!existsSync(filePath)) {
    return { snapshot: null, error: null, filePath };
  }
  try {
    return { snapshot: JSON.parse(readFileSync(filePath, 'utf8')), error: null, filePath };
  } catch (error) {
    return {
      snapshot: null,
      error: error instanceof Error ? error.message.replace(/\r?\n/g, ' ') : String(error),
      filePath,
    };
  }
}

function readGooglePlayPaymentsProfileState({
  rootDir = ROOT,
  existsSync = fs.existsSync,
  readFileSync = fs.readFileSync,
  env = process.env,
} = {}) {
  const filePath = env.GOOGLE_PLAY_PAYMENTS_PROFILE_STATE_PATH
    ? path.resolve(rootDir, env.GOOGLE_PLAY_PAYMENTS_PROFILE_STATE_PATH)
    : path.join(rootDir, 'doc_web_interne/docs/google-play-payments-profile-state.local.json');
  if (!existsSync(filePath)) {
    return { snapshot: null, error: null, filePath };
  }
  try {
    return { snapshot: JSON.parse(readFileSync(filePath, 'utf8')), error: null, filePath };
  } catch (error) {
    return {
      snapshot: null,
      error: error instanceof Error ? error.message.replace(/\r?\n/g, ' ') : String(error),
      filePath,
    };
  }
}

function readGooglePlayTrackState({
  rootDir = ROOT,
  existsSync = fs.existsSync,
  readFileSync = fs.readFileSync,
  env = process.env,
} = {}) {
  const filePath = env.GOOGLE_PLAY_TRACK_STATE_PATH
    ? path.resolve(rootDir, env.GOOGLE_PLAY_TRACK_STATE_PATH)
    : path.join(rootDir, 'doc_web_interne/docs/google-play-track-state.local.json');
  if (!existsSync(filePath)) {
    return { snapshot: null, error: null, filePath };
  }
  try {
    return { snapshot: JSON.parse(readFileSync(filePath, 'utf8')), error: null, filePath };
  } catch (error) {
    return {
      snapshot: null,
      error: error instanceof Error ? error.message.replace(/\r?\n/g, ' ') : String(error),
      filePath,
    };
  }
}

function readSupabasePlayIntegritySecretsState({
  rootDir = ROOT,
  existsSync = fs.existsSync,
  readFileSync = fs.readFileSync,
  env = process.env,
} = {}) {
  const filePath = env.SUPABASE_PLAY_INTEGRITY_SECRETS_STATE_PATH
    ? path.resolve(rootDir, env.SUPABASE_PLAY_INTEGRITY_SECRETS_STATE_PATH)
    : path.join(rootDir, 'doc_web_interne/docs/supabase-play-integrity-secrets-state.local.json');
  if (!existsSync(filePath)) {
    return { snapshot: null, error: null, filePath };
  }
  try {
    return { snapshot: JSON.parse(readFileSync(filePath, 'utf8')), error: null, filePath };
  } catch (error) {
    return {
      snapshot: null,
      error: error instanceof Error ? error.message.replace(/\r?\n/g, ' ') : String(error),
      filePath,
    };
  }
}

function getGoogleCloudProjectCheck(envProjectNumber, projectStateResult) {
  const snapshot = projectStateResult.snapshot;
  if (projectStateResult.error) {
    return {
      status: 'blocked',
      details: `Google Cloud project snapshot is invalid: ${projectStateResult.error}`,
      remediation: 'Regenerate doc_web_interne/docs/google-cloud-project-state.local.json from gcloud projects list.',
    };
  }
  if (!snapshot) {
    return {
      status: 'manual',
      details: `${PLAY_INTEGRITY_PROJECT_NUMBER_KEY} is locally configured, but no Google Cloud project snapshot is present.`,
      remediation:
        "Run gcloud projects list --filter='PROJECT_NUMBER=359653779023' --format=json | npm run android:google-cloud-project-state, then verify Play Console / Google Cloud before release.",
    };
  }
  if (snapshot.project_number !== envProjectNumber) {
    return {
      status: 'blocked',
      details: `Google Cloud project snapshot project_number=${snapshot.project_number || 'missing'} does not match ${PLAY_INTEGRITY_PROJECT_NUMBER_KEY}=${envProjectNumber || 'missing'}.`,
      remediation: 'Regenerate the Google Cloud project snapshot for the configured Play Integrity project number.',
    };
  }
  if (snapshot.project_id !== EXPECTED_GOOGLE_CLOUD_PROJECT_ID || snapshot.lifecycle_state !== 'ACTIVE') {
    return {
      status: 'blocked',
      details: `Google Cloud project snapshot is ${snapshot.project_id || 'missing'}/${snapshot.lifecycle_state || 'missing'}; expected ${EXPECTED_GOOGLE_CLOUD_PROJECT_ID}/ACTIVE.`,
      remediation: 'Verify the Google Cloud project number and regenerate the snapshot from the correct project.',
    };
  }
  return {
    status: 'pass',
    details: `${envProjectNumber} -> ${snapshot.project_id}/${snapshot.lifecycle_state} from ${path.relative(ROOT, projectStateResult.filePath)}.`,
    remediation: 'Keep the Google Cloud project snapshot fresh before release.',
  };
}

function normalizeSha1(value) {
  return String(value || '').trim().toUpperCase();
}

function getGoogleOAuthAndroidClientCheck(oauthStateResult) {
  const snapshot = oauthStateResult.snapshot;
  if (oauthStateResult.error) {
    return {
      status: 'blocked',
      details: `Google OAuth Android client snapshot is invalid: ${oauthStateResult.error}`,
      remediation: 'Regenerate doc_web_interne/docs/google-oauth-android-client-state.local.json from Google Cloud Console.',
    };
  }
  if (!snapshot) {
    return {
      status: 'manual',
      details: `Play App Signing SHA-1 extracted from the Play-generated APK: ${EXPECTED_GOOGLE_OAUTH_ANDROID_SHA1}.`,
      remediation: 'Verify this SHA-1 exists in the Android OAuth client in Google Cloud.',
    };
  }
  if (snapshot.client_id !== EXPECTED_GOOGLE_OAUTH_ANDROID_CLIENT_ID) {
    return {
      status: 'blocked',
      details: `Google OAuth Android client snapshot client_id=${snapshot.client_id || 'missing'}; expected ${EXPECTED_GOOGLE_OAUTH_ANDROID_CLIENT_ID}.`,
      remediation: 'Regenerate the OAuth Android client snapshot from the Noctalia Android Production client.',
    };
  }
  if (snapshot.package_name !== EXPECTED_ANDROID_PACKAGE_NAME) {
    return {
      status: 'blocked',
      details: `Google OAuth Android client snapshot package_name=${snapshot.package_name || 'missing'}; expected ${EXPECTED_ANDROID_PACKAGE_NAME}.`,
      remediation: 'Verify the Android OAuth client package name in Google Cloud Console.',
    };
  }
  if (normalizeSha1(snapshot.sha1) !== EXPECTED_GOOGLE_OAUTH_ANDROID_SHA1) {
    return {
      status: 'blocked',
      details: `Google OAuth Android client snapshot SHA-1=${snapshot.sha1 || 'missing'}; expected ${EXPECTED_GOOGLE_OAUTH_ANDROID_SHA1}.`,
      remediation: 'Add the Play App Signing SHA-1 to the Android OAuth client in Google Cloud, then regenerate the snapshot.',
    };
  }
  return {
    status: 'pass',
    details: `${snapshot.client_id} contains ${snapshot.package_name} / ${EXPECTED_GOOGLE_OAUTH_ANDROID_SHA1} from ${path.relative(ROOT, oauthStateResult.filePath)}.`,
    remediation: 'Keep the OAuth Android client snapshot fresh after Play App Signing changes.',
  };
}

function getPlayPaymentsProfileCheck(paymentsProfileStateResult) {
  const snapshot = paymentsProfileStateResult.snapshot;
  if (paymentsProfileStateResult.error) {
    return {
      status: 'blocked',
      details: `Google Play payments profile snapshot is invalid: ${paymentsProfileStateResult.error}`,
      remediation: 'Regenerate doc_web_interne/docs/google-play-payments-profile-state.local.json from Play Console.',
    };
  }
  if (!snapshot) {
    return {
      status: 'manual',
      details:
        'Play Console payments profile and payment-method verification are external to the repo, and Play Console currently needs manual confirmation before monetization release.',
      remediation:
        'Inspect Play Console payments settings, then run npm run android:google-play-payments-profile-state with the observed profile status.',
    };
  }

  let openRequirements;
  try {
    openRequirements = getOpenPaymentProfileRequirements(snapshot);
  } catch (error) {
    return {
      status: 'blocked',
      details: `Google Play payments profile snapshot contains unsupported status data: ${
        error instanceof Error ? error.message.replace(/\r?\n/g, ' ') : String(error)
      }`,
      remediation: 'Regenerate the payments profile snapshot from the current Play Console status.',
    };
  }

  if (openRequirements.length > 0) {
    const summary = openRequirements
      .map((item) => `${item.key}/${item.status}/${item.severity}`)
      .join(', ');
    return {
      status: 'blocked',
      details: `${openRequirements.length} open payments profile requirement(s): ${summary}.`,
      remediation:
        'Complete the Play Console payments profile requirements, then regenerate the payments profile snapshot before Android production release.',
    };
  }

  return {
    status: 'pass',
    details: `No open payments profile requirements in ${path.relative(ROOT, paymentsProfileStateResult.filePath)}.`,
    remediation: 'Keep the payments profile snapshot fresh before release.',
  };
}

function getGooglePlayInternalTrackCheck(trackStateResult, candidateVersionCode) {
  if (!/^[1-9]\d*$/.test(String(candidateVersionCode ?? ''))) {
    return {
      status: 'blocked',
      details: 'Android release candidate versionCode could not be read from app.json.',
      remediation: 'Set expo.android.versionCode to a positive integer in app.json.',
    };
  }
  const snapshot = trackStateResult.snapshot;
  if (trackStateResult.error) {
    return {
      status: 'blocked',
      details: `Google Play internal track snapshot is invalid: ${trackStateResult.error}`,
      remediation: 'Regenerate doc_web_interne/docs/google-play-track-state.local.json from Google Play Developer API edits.tracks.get.',
    };
  }
  if (!snapshot) {
    return {
      status: 'blocked',
      details:
        `Google Play internal track release state has not been recorded for candidate versionCode ${candidateVersionCode}.`,
      remediation:
        'Read the internal track with Google Play Developer API edits.tracks.get, then run npm run android:google-play-track-state with the JSON output.',
    };
  }

  const status = getTrackStatus(snapshot, candidateVersionCode);
  if (!status.ready) {
    return {
      status: 'blocked',
      details: `${status.summary}; expected status ${snapshot.expected_status || 'completed'}.`,
      remediation:
        'Submit or complete the expected Internal Testing release in Play Console, then regenerate the track snapshot.',
    };
  }

  return {
    status: 'pass',
    details: `${status.summary} from ${path.relative(ROOT, trackStateResult.filePath)}.`,
    remediation: 'Keep the Google Play internal track snapshot fresh after Play submissions.',
  };
}

function getSupabasePlayIntegritySecretsCheck(secretsStateResult) {
  const snapshot = secretsStateResult.snapshot;
  if (secretsStateResult.error) {
    return {
      status: 'blocked',
      details: `Supabase Play Integrity secrets snapshot is invalid: ${secretsStateResult.error}`,
      remediation: 'Regenerate doc_web_interne/docs/supabase-play-integrity-secrets-state.local.json from Supabase.',
    };
  }
  if (!snapshot) {
    return {
      status: 'manual',
      details: 'Supabase Edge Function secrets are intentionally not stored in the repo.',
      remediation:
        'Verify PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64, PLAY_INTEGRITY_PACKAGE_NAME, and GUEST_SESSION_SECRET in Supabase, then record only their presence with npm run android:supabase-play-integrity-secrets-state.',
    };
  }
  let issues;
  try {
    issues = getSupabasePlayIntegritySecretIssues(snapshot);
  } catch (error) {
    return {
      status: 'blocked',
      details: `Supabase Play Integrity secrets snapshot contains unsupported status data: ${
        error instanceof Error ? error.message.replace(/\r?\n/g, ' ') : String(error)
      }`,
      remediation: 'Regenerate the Supabase secrets snapshot from the current dashboard or CLI status.',
    };
  }
  if (issues.length > 0) {
    return {
      status: 'blocked',
      details: `Supabase Play Integrity secret issue(s): ${issues.join(', ')}.`,
      remediation:
        'Set or correct the Supabase Edge Function secrets, then regenerate the local secrets snapshot before Android production release.',
    };
  }
  return {
    status: 'pass',
    details: `Required Supabase Play Integrity secrets are present in ${path.relative(ROOT, secretsStateResult.filePath)}.`,
    remediation: 'Keep the Supabase secrets snapshot fresh after rotating secrets.',
  };
}

function checkSubscriptionQaGate(
  rootDir,
  scriptName,
  spawn = spawnSync,
  env = process.env,
  platform = process.platform,
  existsSync = fs.existsSync
) {
  const npm = resolveNpmInvocation({ env, platform, existsSync });
  if (!npm) {
    return {
      ok: false,
      details: 'npm CLI is unavailable from npm_execpath and the bundled Windows Node.js installation.',
    };
  }
  const result = spawn(npm.command, [...npm.baseArgs, 'run', scriptName], {
    cwd: rootDir,
    env,
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 1024 * 1024 * 4,
  });
  if (result.status === 0) {
    return {
      ok: true,
      details: `${scriptName} passed.`,
    };
  }
  const summary = summarizeCommandOutput(`${result.stdout || ''}\n${result.stderr || ''}`);
  return {
    ok: false,
    details: summary || `${scriptName} exited with status ${result.status ?? 'unknown'}.`,
  };
}

// EAS workflows run on demand only: every EAS workflow's `on:` mapping holds workflow_dispatch and
// nothing else (no push, tag, pull_request, pull_request_comment,
// pull_request_labeled, app_store_connect, schedule or any other trigger). The
// two release workflows also require the release_tag input, and pass it to a
// job that runs check-android-release-ref.js before every build.
//
// This gate catches honest mistakes; the real control is the owner's review of
// any .eas/workflows or eas.json change (deliveryFiles in verify-local.config.mjs).
const EAS_WORKFLOWS_DIR = '.eas/workflows';
const RELEASE_REF_CHECK = 'node ./scripts/check-android-release-ref.js';
const RELEASE_TAG_FROM_INPUT = '${{ inputs.release_tag }}';
const RELEASE_TAG_WORKFLOWS = {
  'android-release-qualification.yml': 'build_android',
  'android-release-smoke.yml': 'build_android_release_smoke',
};
// The EAS workflow top-level keys (docs.expo.dev/eas/workflows/syntax),
// compared by exact case, the same approach as shapier's workflow-triggers.mjs.
const EAS_TOP_LEVEL_KEYS = ['name', 'run_name', 'on', 'jobs', 'defaults', 'concurrency'];
// Keys that switch a job or step off or let it fail without stopping the run.
const BYPASS_KEYS = ['if', 'continue-on-error', 'continue_on_error'];

// Read the file the way any YAML reader would, failing closed where readers
// could disagree:
// - a `%` directive line (under `%YAML 1.1` a plain `on` is the boolean true);
// - a top-level key outside EAS_TOP_LEVEL_KEYS, so `On`, `ON`, `yes`, `true`,
//   any key a YAML 1.1 reader takes as a boolean, any non-string key and the
//   `<<` merge key all fail;
// - a duplicate key, a second document or any parse error.
// Returns { workflow, issue }: exactly one of them is null.
function parseWorkflowDocument(workflowText) {
  const text = String(workflowText ?? '');
  const directive = /^%.*$/m.exec(text);
  if (directive) {
    return { workflow: null, issue: `has a YAML directive (${directive[0].trim()}); remove it so every YAML reader sees the same keys` };
  }
  let doc;
  try {
    doc = require('yaml').parseDocument(text, { version: '1.2', uniqueKeys: true, merge: false, prettyErrors: false });
  } catch (error) {
    return { workflow: null, issue: `is not valid YAML (${String(error?.message || error).split('\n')[0]})` };
  }
  if (doc.errors.length > 0) return { workflow: null, issue: `is not valid YAML (${doc.errors[0].message.split('\n')[0]})` };
  const { isMap, isScalar } = require('yaml');
  if (!isMap(doc.contents)) return { workflow: null, issue: 'is not a YAML mapping' };
  for (const pair of doc.contents.items) {
    const key = pair.key;
    if (!isScalar(key) || typeof key.value !== 'string') {
      return {
        workflow: null,
        issue: `has a top-level key that is not a plain string (${String(isScalar(key) ? key.value : key)}); allowed keys: ${EAS_TOP_LEVEL_KEYS.join(', ')}`,
      };
    }
    if (!EAS_TOP_LEVEL_KEYS.includes(key.value)) {
      return {
        workflow: null,
        issue: `has the top-level key "${key.value}", which is not an EAS workflow key; allowed keys: ${EAS_TOP_LEVEL_KEYS.join(', ')}`,
      };
    }
  }
  return { workflow: doc.toJS(), issue: null };
}

function parseWorkflow(workflowText) {
  return parseWorkflowDocument(workflowText).workflow;
}

function hasOnlyDispatchTrigger(workflow) {
  const triggers = workflow?.on;
  if (!triggers || typeof triggers !== 'object' || Array.isArray(triggers)) return false;
  const keys = Object.keys(triggers);
  return keys.length === 1 && keys[0] === 'workflow_dispatch';
}

function requiresReleaseTagInput(workflow) {
  const releaseTag = workflow?.on?.workflow_dispatch?.inputs?.release_tag;
  return Boolean(releaseTag && releaseTag.required === true && releaseTag.type === 'string');
}

function jobNeeds(job) {
  const needs = job?.needs;
  if (typeof needs === 'string') return [needs];
  return Array.isArray(needs) ? needs : [];
}

function bypassKeys(node) {
  return node && typeof node === 'object' ? BYPASS_KEYS.filter((key) => Object.hasOwn(node, key)) : [];
}

function isReleaseRefStep(step) {
  return typeof step?.run === 'string' && step.run.trim() === RELEASE_REF_CHECK;
}

// Read from the parsed YAML, so a comment or a stray string never counts:
// - a check job: a step that runs the release ref check, and RELEASE_TAG taken
//   from the release_tag input in the job env;
// - no `if` or continue-on-error (either spelling) on the check job, the check
//   step or any build job, and no step env setting RELEASE_TAG;
// - the named build job exists, and every `type: build` job lists a check job
//   directly in its own needs: no path through an intermediate job, whose
//   `if: failure()` or `always()` could run after a failed check.
// Returns the problems, empty when the workflow is guarded.
function releaseTagCheckProblems(workflow, buildJobName) {
  const jobs = workflow?.jobs;
  if (!jobs || typeof jobs !== 'object' || Array.isArray(jobs)) return ['has no jobs mapping'];
  const problems = [];
  const entries = Object.entries(jobs).filter(([, job]) => job && typeof job === 'object');

  for (const [name, job] of entries) {
    for (const [index, step] of (Array.isArray(job.steps) ? job.steps : []).entries()) {
      if (step?.env && typeof step.env === 'object' && Object.hasOwn(step.env, 'RELEASE_TAG')) {
        problems.push(`step ${index + 1} of ${name} sets RELEASE_TAG in its env; only the job env may, from ${RELEASE_TAG_FROM_INPUT}`);
      }
    }
  }

  const checkJobs = [];
  for (const [name, job] of entries) {
    const steps = Array.isArray(job.steps) ? job.steps : [];
    const checkSteps = steps.filter(isReleaseRefStep);
    if (checkSteps.length === 0) continue;
    let valid = job.env?.RELEASE_TAG === RELEASE_TAG_FROM_INPUT;
    if (!valid) problems.push(`${name} runs ${RELEASE_REF_CHECK} without RELEASE_TAG: ${RELEASE_TAG_FROM_INPUT} in its env`);
    const jobBypass = bypassKeys(job);
    if (jobBypass.length > 0) {
      valid = false;
      problems.push(`the check job ${name} must not set ${jobBypass.join(', ')}`);
    }
    for (const step of checkSteps) {
      const stepBypass = bypassKeys(step);
      if (stepBypass.length > 0) {
        valid = false;
        problems.push(`the ${RELEASE_REF_CHECK} step of ${name} must not set ${stepBypass.join(', ')}`);
      }
    }
    if (valid) checkJobs.push(name);
  }
  if (checkJobs.length === 0) problems.push(`no valid job runs ${RELEASE_REF_CHECK} with RELEASE_TAG: ${RELEASE_TAG_FROM_INPUT}`);

  const buildJob = jobs[buildJobName];
  if (!buildJob || buildJob.type !== 'build') problems.push(`${buildJobName} must be a type: build job`);
  for (const [name, job] of entries.filter(([, entry]) => entry.type === 'build')) {
    const buildBypass = bypassKeys(job);
    if (buildBypass.length > 0) problems.push(`the build job ${name} must not set ${buildBypass.join(', ')}`);
    const needs = jobNeeds(job);
    if (!checkJobs.some((checkJob) => needs.includes(checkJob))) {
      problems.push(`the build job ${name} must list the release ref check job directly in its needs`);
    }
  }
  return problems;
}

function releaseTagCheckGuardsBuild(workflow, buildJobName) {
  return releaseTagCheckProblems(workflow, buildJobName).length === 0;
}

function isDispatchOnlyReleaseWorkflow(workflowText, buildJobName = 'build_android') {
  const workflow = parseWorkflow(workflowText);
  return Boolean(
    workflow &&
      hasOnlyDispatchTrigger(workflow) &&
      requiresReleaseTagInput(workflow) &&
      releaseTagCheckGuardsBuild(workflow, buildJobName)
  );
}

// Every file of .eas/workflows, so a new workflow is held to the same rule.
function checkEasWorkflowTriggers(
  rootDir,
  { existsSync = fs.existsSync, readFileSync = fs.readFileSync, readdirSync = fs.readdirSync } = {}
) {
  const dir = path.join(rootDir, EAS_WORKFLOWS_DIR);
  const files = existsSync(dir)
    ? readdirSync(dir).filter((name) => /\.ya?ml$/.test(name)).sort()
    : [];
  const problems = [];
  for (const name of Object.keys(RELEASE_TAG_WORKFLOWS)) {
    if (!files.includes(name)) problems.push(`${name} is missing`);
  }
  for (const name of files) {
    const { workflow, issue } = parseWorkflowDocument(readFileSync(path.join(dir, name), 'utf8'));
    if (!workflow) {
      problems.push(`${name} ${issue}`);
      continue;
    }
    if (!hasOnlyDispatchTrigger(workflow)) problems.push(`${name}: workflow_dispatch must be the only key under on:`);
    const buildJobName = RELEASE_TAG_WORKFLOWS[name];
    if (buildJobName) {
      if (!requiresReleaseTagInput(workflow)) problems.push(`${name}: workflow_dispatch needs a required string release_tag input`);
      for (const problem of releaseTagCheckProblems(workflow, buildJobName)) problems.push(`${name}: ${problem}`);
    }
  }
  return { files, problems };
}

function readRunJson(runDir, name, { existsSync, readFileSync }) {
  const filePath = path.join(runDir, name);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

// Files a native TesterArmy run writes before files.json; files.json lists the
// sha256 of every file of the run folder except itself and end.json.
const TESTERARMY_RUN_FILES = [
  'evidence.json',
  'release-used.json',
  'source-start.json',
  'source-end.json',
  'collection.json',
  'report.json',
  'qualification.json',
  'installed-start.json',
  'installed-end.json',
];
// The selection flags of tools/e2e/run.mjs: any of them narrows the collection,
// so such a run is not the full release suite.
const TESTERARMY_SELECTION_FLAGS = new Set([
  '--grep',
  '--grep-invert',
  '--tag',
  '--exclude-tag',
  '--tag-mode',
  '--shard',
]);
const FULL_SHA = /^[a-f0-9]{40}$/;
const CANDIDATE_APK_ENV = 'QA_ANDROID_RELEASE_APK';

// The engine's own checks, in a child Node because tools/e2e/qualification.mjs
// is ESM: verifyEvidenceFiles (files.json must list the sha256 of every file of
// the run folder except itself and end.json), then compareSnapshots on
// source-start.json and source-end.json. end.json is not covered by files.json,
// so the gate derives stability and cleanliness from the snapshots itself.
const EVIDENCE_ENGINE = path.join(ROOT, 'tools/e2e/qualification.mjs');
function verifyRunWithEngine(runDir) {
  const script =
    `import { verifyEvidenceFiles, compareSnapshots } from ${JSON.stringify(pathToFileURL(EVIDENCE_ENGINE).href)};\n` +
    "import { readFileSync } from 'fs';\n" +
    "import { join } from 'path';\n" +
    'const dir = process.argv[1];\n' +
    'try { verifyEvidenceFiles(dir); } catch (error) { console.error(error.message); process.exit(1); }\n' +
    "const read = (name) => JSON.parse(readFileSync(join(dir, name), 'utf8'));\n" +
    "try { process.stdout.write(JSON.stringify(compareSnapshots(read('source-start.json'), read('source-end.json')))); }\n" +
    "catch { console.error('SOURCE_SNAPSHOT_UNREADABLE'); process.exit(1); }";
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script, runDir], {
    encoding: 'utf8',
    timeout: 60000,
  });
  if (result.status !== 0) {
    const code = String(result.stderr || '').trim().split('\n').pop() || 'unknown error';
    return { problem: `its manifest check failed (${code})` };
  }
  try {
    return { stability: JSON.parse(result.stdout) };
  } catch {
    return { problem: 'its manifest check failed (no snapshot comparison)' };
  }
}

// Why the source snapshots the runner wrote around the run do not prove a
// clean, unchanged checkout of the release commit, or null when they do.
function sourceSnapshotProblem({ runDir, stability, revision, io }) {
  const start = readRunJson(runDir, 'source-start.json', io);
  const end = readRunJson(runDir, 'source-end.json', io);
  for (const [name, snapshot] of [['source-start.json', start], ['source-end.json', end]]) {
    if (!snapshot || typeof snapshot !== 'object') return `${name} is unreadable`;
    if (snapshot.revision !== revision) {
      return `${name} names ${String(snapshot.revision).slice(0, 12)}, not ${revision.slice(0, 12)}`;
    }
    if (snapshot.workingTree !== '') return `${name} records a dirty working tree`;
    if (!snapshot.files || typeof snapshot.files !== 'object' || !Object.keys(snapshot.files).length) {
      return `${name} has no source file map`;
    }
  }
  if (stability?.sourceStable !== true) return 'its source file map changed during the run (source-start.json and source-end.json differ)';
  if (stability.sourceClean !== true) return 'its source snapshots record a dirty working tree';
  return null;
}

const SHA256 = /^[a-f0-9]{64}$/;
function fileSha256(filePath, readFileSync) {
  try {
    return createHash('sha256').update(readFileSync(filePath)).digest('hex');
  } catch {
    return null;
  }
}

// Why a run folder does not prove the full release suite on this revision, or
// null when it does. The runner already re-verified the SDK report, artifacts
// and collection when it wrote qualification.json; this checks that the folder
// is complete and unchanged since, that it ran unfiltered and that every
// receipt names the same commit as the checkout under qualification.
function testerArmyRunProblem({ runDir, end, evidence, release, revision, candidateApkSha256, io }) {
  const { existsSync } = io;
  for (const name of TESTERARMY_RUN_FILES) {
    if (!existsSync(path.join(runDir, name))) return `${name} is missing`;
  }
  if (!existsSync(path.join(runDir, 'files.json'))) return 'files.json is missing';
  const engine = verifyRunWithEngine(runDir);
  if (engine.problem) return engine.problem;
  const command = Array.isArray(evidence.command) ? evidence.command.map(String) : null;
  if (!command || command[4] !== 'run') return 'evidence.json does not record a run command';
  const filter = command.find((arg) => TESTERARMY_SELECTION_FLAGS.has(arg));
  if (filter) return `the run was filtered with ${filter}`;
  if (!revision) return 'the current commit cannot be read';
  if (evidence.revision !== revision) return `it ran on ${String(evidence.revision).slice(0, 12)}, not ${revision.slice(0, 12)}`;
  if (evidence.workingTree !== '') return 'it ran on a modified working tree';
  const snapshotProblem = sourceSnapshotProblem({ runDir, stability: engine.stability, revision, io });
  if (snapshotProblem) return snapshotProblem;
  // end.json is not in files.json: its stability is an extra condition only.
  if (end.stability?.sourceStable !== true || end.stability.sourceClean !== true) {
    return 'its source changed or was not clean during the run';
  }
  if (release.source?.revision !== revision) {
    return `its build came from ${String(release.source?.revision).slice(0, 12)}, not ${revision.slice(0, 12)}`;
  }
  if (!candidateApkSha256) return 'the candidate APK cannot be read';
  const installedStart = readRunJson(runDir, 'installed-start.json', io);
  const installedEnd = readRunJson(runDir, 'installed-end.json', io);
  const testedHashes = [
    release.binary?.sha256,
    evidence.binary?.sha256,
    installedStart?.binarySha256,
    installedEnd?.binarySha256,
  ];
  if (testedHashes.some((hash) => !SHA256.test(String(hash)) || hash !== candidateApkSha256)) {
    return `the tested APK is not the candidate APK (sha256 ${candidateApkSha256.slice(0, 12)})`;
  }
  const qualification = readRunJson(runDir, 'qualification.json', io);
  if (
    qualification?.revision !== revision ||
    qualification.target !== 'dreamer-android' ||
    !Array.isArray(qualification.passed) ||
    !qualification.passed.length
  ) {
    return 'qualification.json does not qualify dreamer-android on this commit';
  }
  const report = readRunJson(runDir, 'report.json', io);
  if (
    report?.run?.vcs?.commit !== revision ||
    report.run.status !== 'passed' ||
    report.run.exitCode !== 0 ||
    report.run.summary?.failed !== 0 ||
    report.run.summary?.interrupted !== 0
  ) {
    return 'report.json does not record a passed run of this commit';
  }
  return null;
}

function readCurrentRevision(rootDir, spawn) {
  try {
    const result = spawn('git', ['rev-parse', 'HEAD'], { cwd: rootDir, encoding: 'utf8' });
    const revision = String(result?.stdout ?? '').trim();
    return result?.status === 0 && FULL_SHA.test(revision) ? revision : null;
  } catch {
    return null;
  }
}

// The newest TesterArmy run that qualified the installed production-apk build of
// the candidate on the current commit. end.json is the runner's final verdict
// (applicationQualified is false on any SDK, install, identity or cleanup
// failure); release-used.json is the build receipt the runner validated against
// that commit's inputs and installed.
function findTesterArmyReleaseRun({
  rootDir,
  versionCode,
  revision,
  candidateApkSha256,
  existsSync,
  readFileSync,
  readdirSync,
}) {
  const runsDir = path.join(rootDir, TESTERARMY_ANDROID_RUNS);
  if (!existsSync(runsDir)) return { run: null, runs: 0, rejected: [] };
  let names;
  try {
    names = readdirSync(runsDir).map(String).sort().reverse();
  } catch {
    return { run: null, runs: 0, rejected: [] };
  }
  const rejected = [];
  for (const name of names) {
    const runDir = path.join(runsDir, name);
    const io = { existsSync, readFileSync, readdirSync };
    const end = readRunJson(runDir, 'end.json', io);
    if (end?.applicationQualified !== true || end.exitCode !== 0) continue;
    const evidence = readRunJson(runDir, 'evidence.json', io);
    if (evidence?.product !== 'dreamer' || evidence.platform !== 'android') continue;
    const release = readRunJson(runDir, 'release-used.json', io);
    if (
      release?.profile?.name !== TESTERARMY_RELEASE_PROFILE ||
      release.binary?.bundle !== EXPECTED_ANDROID_PACKAGE_NAME ||
      String(release.binary?.build) !== String(versionCode)
    ) {
      continue;
    }
    const problem = testerArmyRunProblem({ runDir, end, evidence, release, revision, candidateApkSha256, io });
    if (problem) {
      rejected.push(`${name}: ${problem}`);
      continue;
    }
    return {
      run: `${TESTERARMY_ANDROID_RUNS}/${name}`,
      runs: names.length,
      rejected,
      finishedAt: end.finishedAt,
      revision: evidence.revision,
    };
  }
  return { run: null, runs: names.length, rejected };
}

function getTesterArmyReleaseCheck({ prebuild, versionCode, spawn, env, ...io }) {
  if (prebuild) {
    return {
      status: 'manual',
      details: `Deferred until the production-apk candidate (versionCode ${versionCode || 'missing'}) is built.`,
      remediation: `Before Android production release, ${TESTERARMY_RELEASE_COMMANDS}.`,
    };
  }
  if (!versionCode) {
    return {
      status: 'blocked',
      details: 'No candidate versionCode to match a TesterArmy run against.',
      remediation: 'Fix the Android release candidate versionCode check first.',
    };
  }
  const apk = env?.[CANDIDATE_APK_ENV];
  if (!apk) {
    return {
      status: 'blocked',
      details: `${CANDIDATE_APK_ENV} is not set, so the tested APK cannot be compared with the release candidate.`,
      remediation: `Set ${CANDIDATE_APK_ENV} to the candidate production-apk file (the release.apk of its build receipt).`,
    };
  }
  const candidateApkSha256 = fileSha256(path.resolve(io.rootDir, apk), io.readFileSync);
  const revision = readCurrentRevision(io.rootDir, spawn);
  const found = findTesterArmyReleaseRun({ versionCode, revision, candidateApkSha256, ...io });
  if (found.run) {
    return {
      status: 'pass',
      details: `${found.run} qualified the installed ${TESTERARMY_RELEASE_PROFILE} build ${EXPECTED_ANDROID_PACKAGE_NAME} versionCode ${versionCode}${found.revision ? ` from ${String(found.revision).slice(0, 12)}` : ''}${found.finishedAt ? ` (${found.finishedAt})` : ''}.`,
      remediation: 'None.',
    };
  }
  return {
    status: 'blocked',
    details: `No TesterArmy run under ${TESTERARMY_ANDROID_RUNS} (${found.runs} run(s) found) qualified an installed ${TESTERARMY_RELEASE_PROFILE} build of ${EXPECTED_ANDROID_PACKAGE_NAME} versionCode ${versionCode} on ${revision ? revision.slice(0, 12) : 'the current commit'}.${found.rejected.length ? ` Rejected: ${found.rejected.join('; ')}.` : ''}`,
    remediation: `On an emulator, on this commit with a clean working tree and without --grep, --tag or --shard, ${TESTERARMY_RELEASE_COMMANDS}; the run must end with applicationQualified true and test the APK named by ${CANDIDATE_APK_ENV}.`,
  };
}

function checkAndroidReleaseGates({
  rootDir = ROOT,
  spawn = spawnSync,
  existsSync = fs.existsSync,
  readFileSync = fs.readFileSync,
  readdirSync = fs.readdirSync,
  env = process.env,
  platform = process.platform,
  phase = 'qualification',
} = {}) {
  const checks = [];
  const prebuild = phase === 'prebuild';
  const easJson = readJson(rootDir, 'eas.json');
  try {
    const optimizationCheck = getAndroidReleaseOptimizationCheck(
      readJson(rootDir, 'app.json')
    );
    addCheck(
      checks,
      optimizationCheck.status,
      'Android Release R8 minification and resource shrinking',
      optimizationCheck.details,
      optimizationCheck.remediation
    );
  } catch (error) {
    addCheck(
      checks,
      'fail',
      'Android Release R8 minification and resource shrinking',
      `Unable to read app.json: ${
        error instanceof Error ? error.message : String(error)
      }`,
      'Restore a valid app.json and enable both Android Release optimization properties.'
    );
  }
  let androidCandidateVersionCode = null;
  try {
    androidCandidateVersionCode = readAppVersionCode(rootDir, readFileSync, env);
    const versionCodeSource = env.QA_ANDROID_VERSION_CODE
      ? 'QA_ANDROID_VERSION_CODE'
      : 'app.json expo.android.versionCode';
    addCheck(
      checks,
      'pass',
      'Android release candidate versionCode',
      `${versionCodeSource}=${androidCandidateVersionCode}.`,
      'Set QA_ANDROID_VERSION_CODE to the installed EAS/Play candidate when appVersionSource is remote.'
    );
  } catch (error) {
    addCheck(
      checks,
      'fail',
      'Android release candidate versionCode',
      error instanceof Error ? error.message : String(error),
      'Set expo.android.versionCode to a positive integer in app.json.'
    );
  }
  const envPath = path.join(rootDir, '.env.teststore');
  const envValues = existsSync(envPath) ? parseDotEnv(readFileSync(envPath, 'utf8')) : {};
  const projectStateResult = readGoogleCloudProjectState({ rootDir, existsSync, readFileSync, env });
  const oauthStateResult = readGoogleOAuthAndroidClientState({ rootDir, existsSync, readFileSync, env });
  const paymentsProfileStateResult = readGooglePlayPaymentsProfileState({
    rootDir,
    existsSync,
    readFileSync,
    env,
  });
  const googlePlayTrackStateResult = readGooglePlayTrackState({
    rootDir,
    existsSync,
    readFileSync,
    env,
  });
  const supabaseSecretsStateResult = readSupabasePlayIntegritySecretsState({
    rootDir,
    existsSync,
    readFileSync,
    env,
  });

  const profilesMissingProjectNumber = REQUIRED_EAS_PROFILES.filter((profile) => {
    const value = easJson.build?.[profile]?.env?.[PLAY_INTEGRITY_PROJECT_NUMBER_KEY];
    return typeof value !== 'string' || value.trim().length === 0;
  });
  addCheck(
    checks,
    profilesMissingProjectNumber.length === 0 ? 'pass' : 'fail',
    'Play Integrity project number in EAS profiles',
    profilesMissingProjectNumber.length === 0
      ? `Present in ${REQUIRED_EAS_PROFILES.join(', ')}.`
      : `Missing from ${profilesMissingProjectNumber.join(', ')}.`,
    `Add ${PLAY_INTEGRITY_PROJECT_NUMBER_KEY} to each Android release profile env.`
  );

  const profilesWithoutAnalysisBundles = ANALYSIS_BUNDLE_EAS_PROFILES.filter(
    (profile) => easJson.build?.[profile]?.env?.[ANALYSIS_JOBS_ENABLED_KEY] !== 'true'
  );
  addCheck(
    checks,
    profilesWithoutAnalysisBundles.length === 0 ? 'pass' : 'fail',
    'Monthly analysis and image bundles enabled in EAS profiles',
    profilesWithoutAnalysisBundles.length === 0
      ? `Enabled in ${ANALYSIS_BUNDLE_EAS_PROFILES.join(', ')}.`
      : `Disabled or missing from ${profilesWithoutAnalysisBundles.join(', ')}.`,
    `Set ${ANALYSIS_JOBS_ENABLED_KEY}=true so each admitted analysis can enqueue its bundled image.`
  );

  const releaseProfilesWithUnsafeTestStoreDebugging = REQUIRED_EAS_PROFILES.filter(
    (profile) =>
      easJson.build?.[profile]?.env?.[REVENUECAT_TEST_STORE_DEBUGGABLE_KEY] !== 'false'
  );
  const testStoreDebuggingEnabled =
    easJson.build?.['revenuecat-teststore']?.env?.[
      REVENUECAT_TEST_STORE_DEBUGGABLE_KEY
    ] === 'true';
  const testStoreDebuggingIsolated =
    releaseProfilesWithUnsafeTestStoreDebugging.length === 0 &&
    testStoreDebuggingEnabled;
  addCheck(
    checks,
    testStoreDebuggingIsolated ? 'pass' : 'fail',
    'RevenueCat Test Store debuggability isolated in EAS profiles',
    testStoreDebuggingIsolated
      ? `Enabled only in revenuecat-teststore; disabled in ${REQUIRED_EAS_PROFILES.join(', ')}.`
      : [
          releaseProfilesWithUnsafeTestStoreDebugging.length > 0
            ? `Not explicitly disabled in ${releaseProfilesWithUnsafeTestStoreDebugging.join(', ')}.`
            : null,
          testStoreDebuggingEnabled
            ? null
            : 'Not explicitly enabled in revenuecat-teststore.',
        ]
          .filter(Boolean)
          .join(' '),
    `Set ${REVENUECAT_TEST_STORE_DEBUGGABLE_KEY}=false in every Play profile and true only in revenuecat-teststore.`
  );

  const missingEnvKeys = REQUIRED_TESTSTORE_PUBLIC_ENV.filter((key) => !envValues[key]);
  addCheck(
    checks,
    missingEnvKeys.length === 0 ? 'pass' : 'fail',
    '.env.teststore Android public env',
    missingEnvKeys.length === 0
      ? 'Required public Android env keys are present. Values are intentionally not printed.'
      : `Missing keys: ${missingEnvKeys.join(', ')}.`,
    'Fill the missing public env keys in .env.teststore or the matching EAS environment.'
  );

  const internalTrack = easJson.submit?.internal?.android?.track;
  addCheck(
    checks,
    internalTrack === 'internal' ? 'pass' : 'fail',
    'EAS submit internal track',
    internalTrack === 'internal'
      ? 'submit.internal.android.track is configured as internal.'
      : 'submit.internal.android.track is not configured as internal.',
    'Set submit.internal.android.track to internal in eas.json.'
  );

  const releaseWorkflowPath = path.join(rootDir, RELEASE_QUALIFICATION_WORKFLOW);
  const releaseWorkflow = existsSync(releaseWorkflowPath)
    ? readFileSync(releaseWorkflowPath, 'utf8')
    : '';
  const releaseWorkflowReady =
    releaseWorkflow.includes('type: build') &&
    releaseWorkflow.includes('profile: production-apk') &&
    isDispatchOnlyReleaseWorkflow(releaseWorkflow, RELEASE_TAG_WORKFLOWS['android-release-qualification.yml']);
  addCheck(
    checks,
    releaseWorkflowReady ? 'pass' : 'fail',
    'EAS Android Release build workflow',
    releaseWorkflowReady
      ? `${RELEASE_QUALIFICATION_WORKFLOW} builds production-apk on dispatch only, after the release tag check.`
      : `${RELEASE_QUALIFICATION_WORKFLOW} is missing, does not build production-apk, does not check the release tag, or has a trigger other than workflow_dispatch with a required release_tag input.`,
    'Add a validated EAS workflow whose only trigger is workflow_dispatch with a required release_tag input, that runs scripts/check-android-release-ref.js before building production-apk.'
  );

  const easWorkflows = checkEasWorkflowTriggers(rootDir, { existsSync, readFileSync });
  addCheck(
    checks,
    easWorkflows.problems.length === 0 ? 'pass' : 'fail',
    'EAS workflows dispatch only',
    easWorkflows.problems.length === 0
      ? `${easWorkflows.files.join(', ')}: workflow_dispatch only; the release workflows check release_tag before their build.`
      : easWorkflows.problems.join('; '),
    'Keep workflow_dispatch as the only trigger of every .eas/workflows file; the release workflows need a required release_tag input passed as RELEASE_TAG to a job running scripts/check-android-release-ref.js that their build job needs.'
  );

  const subscriptionScript = prebuild
    ? 'subscription:qa:report'
    : 'subscription:qa:release-gate';
  const subscriptionGate = checkSubscriptionQaGate(
    rootDir,
    subscriptionScript,
    spawn,
    env,
    platform,
    existsSync
  );
  addCheck(
    checks,
    subscriptionGate.ok ? 'pass' : 'fail',
    prebuild
      ? 'RevenueCat subscription QA prebuild wiring gate'
      : 'RevenueCat subscription QA release gate',
    subscriptionGate.details,
    prebuild
      ? 'Run npm run subscription:qa:report and fix its blocked local/config checks before building the Android candidate.'
      : 'Run npm run subscription:qa:release-smoke on the Play-installed candidate and close its single final verdict before Android production release.'
  );

  const testerArmyCheck = getTesterArmyReleaseCheck({
    prebuild,
    versionCode: androidCandidateVersionCode,
    spawn,
    env,
    rootDir,
    existsSync,
    readFileSync,
    readdirSync,
  });
  addCheck(
    checks,
    testerArmyCheck.status,
    'TesterArmy Android Release journeys (production-apk)',
    testerArmyCheck.details,
    testerArmyCheck.remediation
  );

  // Real speech needs a person: the automated voice receipt went with Maestro
  // (owner decision 2026-10-14). The manual checklist is an optional test and
  // does not block the release gate (owner decision 2026-10-17).
  addCheck(
    checks,
    'manual',
    'Release voice transcription, save and analysis',
    `No automated check: real speech recognition needs a person speaking to the installed candidate (versionCode ${androidCandidateVersionCode || 'missing'}). Optional manual test, not blocking.`,
    `Optionally run the manual voice checklist of ${VOICE_MANUAL_CHECKLIST} on the candidate and note its result with the release evidence.`
  );

  const adbCommand = resolveCommand('adb', { spawn, existsSync, env, platform });
  const adbAvailable = Boolean(adbCommand);
  addCheck(
    checks,
    adbAvailable ? 'pass' : 'blocked',
    'Android SDK platform-tools / adb',
    adbAvailable
      ? adbCommand === 'adb'
        ? 'adb is available in PATH.'
        : `adb was found at ${adbCommand}, but it is not available in PATH.`
      : 'adb is not available in PATH or common Android SDK locations.',
    'Install Android SDK platform-tools and make adb available in PATH.'
  );

  if (adbAvailable) {
    const deviceVisibility = getAdbDeviceVisibilityCheck(spawn, adbCommand, platform);
    addCheck(
      checks,
      deviceVisibility.status,
      'Android ADB device visibility',
      deviceVisibility.details,
      deviceVisibility.remediation
    );
  } else {
    addCheck(
      checks,
      'blocked',
      'Android ADB device visibility',
      'Device check skipped because adb is unavailable.',
      'Install adb, then run this check again with an emulator/device connected.'
    );
  }

  const projectCheck = getGoogleCloudProjectCheck(envValues[PLAY_INTEGRITY_PROJECT_NUMBER_KEY], projectStateResult);
  addCheck(checks, projectCheck.status, 'Google Cloud project number confirmation', projectCheck.details, projectCheck.remediation);
  const oauthCheck = getGoogleOAuthAndroidClientCheck(oauthStateResult);
  addCheck(checks, oauthCheck.status, 'Play App Signing SHA-1 for Google OAuth', oauthCheck.details, oauthCheck.remediation);
  const googlePlayTrackCheck = prebuild
    ? {
        status: 'manual',
        details: `Deferred until candidate versionCode ${androidCandidateVersionCode || 'missing'} has been uploaded to Google Play Internal Testing.`,
        remediation:
          'After upload, regenerate the Play track snapshot and run npm run android:gates:strict for release qualification.',
      }
    : getGooglePlayInternalTrackCheck(
        googlePlayTrackStateResult,
        androidCandidateVersionCode
      );
  addCheck(
    checks,
    googlePlayTrackCheck.status,
    'Google Play internal track release',
    googlePlayTrackCheck.details,
    googlePlayTrackCheck.remediation
  );
  const supabaseSecretsCheck = getSupabasePlayIntegritySecretsCheck(supabaseSecretsStateResult);
  addCheck(
    checks,
    supabaseSecretsCheck.status,
    'Supabase Play Integrity secrets',
    supabaseSecretsCheck.details,
    supabaseSecretsCheck.remediation
  );
  const paymentsProfileCheck = getPlayPaymentsProfileCheck(paymentsProfileStateResult);
  addCheck(
    checks,
    paymentsProfileCheck.status,
    'Play payments profile for Billing',
    paymentsProfileCheck.details,
    paymentsProfileCheck.remediation
  );

  return {
    phase,
    ok: checks.every((check) => check.status === 'pass' || check.status === 'manual'),
    counts: checks.reduce((acc, check) => {
      acc[check.status] = (acc[check.status] || 0) + 1;
      return acc;
    }, {}),
    checks,
  };
}

function formatReport(report) {
  const lines = [
    report.phase === 'prebuild'
      ? '[android-gates] Android release prebuild gate'
      : '[android-gates] Android release qualification gate',
  ];
  for (const check of report.checks) {
    const label = check.status.toUpperCase().padEnd(7);
    lines.push(`[android-gates] ${label} ${check.title}`);
    lines.push(`  ${check.details}`);
    if (check.status !== 'pass') {
      lines.push(`  Next: ${check.remediation}`);
    }
  }
  const counts = report.counts;
  lines.push(
    `[android-gates] Summary: ${counts.pass || 0} pass, ${counts.fail || 0} fail, ${counts.blocked || 0} blocked, ${counts.manual || 0} manual.`
  );
  return lines.join('\n');
}

function printHelp() {
  process.stdout.write(
    `Usage: node ./scripts/check-android-release-gates.js [--prebuild] [--report-only] [--json]\n\n` +
      `Options:\n` +
      `  --prebuild     Enforce local/config gates before building; defer candidate Play evidence and track readiness.\n` +
      `  --report-only  Always exit zero after printing the report.\n` +
      `  --json         Print machine-readable JSON.\n` +
      `  --help, -h     Show this help.\n`
  );
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }
  const reportOnly = args.includes('--report-only');
  const json = args.includes('--json');
  const phase = args.includes('--prebuild') ? 'prebuild' : 'qualification';
  const report = checkAndroidReleaseGates({ phase });
  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatReport(report)}\n`);
  }
  if (!report.ok && !reportOnly) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkAndroidReleaseGates,
  checkEasWorkflowTriggers,
  commandExists,
  formatReport,
  getAdbDeviceVisibilityCheck,
  getAdbCandidates,
  getAndroidReleaseOptimizationCheck,
  findTesterArmyReleaseRun,
  listAdbDevices,
  parseDotEnv,
  resolveCommand,
  getPlayPaymentsProfileCheck,
  getGooglePlayInternalTrackCheck,
  getSupabasePlayIntegritySecretsCheck,
};
