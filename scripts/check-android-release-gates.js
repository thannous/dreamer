#!/usr/bin/env node
/* global __dirname */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  commandExists,
  getAdbCandidates,
  getMaestroCandidates,
  resolveCommand,
} = require('./android-tooling');
const {
  detectAdbMdnsServices,
  detectUsbAndroidDevice,
} = require('./check-android-adb-device');
const {
  evaluateVoiceAnalysisEvidence,
} = require('./android-voice-analysis-evidence');
const { getOpenPaymentProfileRequirements } = require('./update-google-play-payments-profile-state');
const {
  getTrackStatus,
  readAppVersionCode,
} = require('./update-google-play-track-state');
const {
  getSupabasePlayIntegritySecretIssues,
} = require('./update-supabase-play-integrity-secrets-state');

const ROOT = path.resolve(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const PLAY_INTEGRITY_PROJECT_NUMBER_KEY = 'EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER';
const REVENUECAT_TEST_STORE_DEBUGGABLE_KEY =
  'NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE';
const EXPECTED_GOOGLE_CLOUD_PROJECT_ID = 'gen-lang-client-0336445544';
const EXPECTED_GOOGLE_OAUTH_ANDROID_CLIENT_ID = '359653779023-5dhs012rh7l3cjf0leoknn7j0dlgq0ok.apps.googleusercontent.com';
const EXPECTED_GOOGLE_OAUTH_ANDROID_SHA1 = 'BC:CF:C2:96:38:47:81:D6:8C:B7:B6:5A:BA:84:CB:B3:8C:85:E0:59';
const EXPECTED_ANDROID_PACKAGE_NAME = 'com.tanuki75.noctalia';
const RELEASE_QUALIFICATION_WORKFLOW =
  '.eas/workflows/android-release-qualification.yml';
const REQUIRED_EAS_PROFILES = ['preview', 'release', 'production-apk', 'production'];
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

function summarizeCommandOutput(output) {
  const lines = String(output || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
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
  env = process.env
) {
  const result = spawn(npmCommand, ['run', scriptName], {
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

function checkAndroidReleaseGates({
  rootDir = ROOT,
  spawn = spawnSync,
  existsSync = fs.existsSync,
  readFileSync = fs.readFileSync,
  env = process.env,
  platform = process.platform,
  phase = 'qualification',
} = {}) {
  const checks = [];
  const prebuild = phase === 'prebuild';
  const easJson = readJson(rootDir, 'eas.json');
  let androidCandidateVersionCode = null;
  try {
    androidCandidateVersionCode = readAppVersionCode(rootDir, readFileSync);
    addCheck(
      checks,
      'pass',
      'Android release candidate versionCode',
      `app.json expo.android.versionCode=${androidCandidateVersionCode}.`,
      'Increment expo.android.versionCode for every Android store candidate.'
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
    releaseWorkflow.includes('type: maestro') &&
    releaseWorkflow.includes('build_id: ${{ needs.build_android.outputs.build_id }}') &&
    releaseWorkflow.includes('flow_path: maestro/release-smoke.yml') &&
    releaseWorkflow.includes('tags:') &&
    releaseWorkflow.includes('- v*');
  addCheck(
    checks,
    releaseWorkflowReady ? 'pass' : 'fail',
    'EAS Android Release build and smoke workflow',
    releaseWorkflowReady
      ? `${RELEASE_QUALIFICATION_WORKFLOW} builds production-apk and runs release-smoke.yml.`
      : `${RELEASE_QUALIFICATION_WORKFLOW} is missing or does not chain production-apk to the Release smoke flow.`,
    'Add a validated EAS workflow that builds production-apk and passes its build_id to maestro/release-smoke.yml.'
  );

  const subscriptionScript = prebuild
    ? 'subscription:qa:report'
    : 'subscription:qa:release-gate';
  const subscriptionGate = checkSubscriptionQaGate(
    rootDir,
    subscriptionScript,
    spawn,
    env
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
      : 'Run npm run subscription:qa:release-gate and close the remaining evidence gates listed in the report before Android production release.'
  );

  const fallbackFlowPath = path.join(rootDir, 'maestro/recording-text-fallback.yml');
  const runMaestroPath = path.join(rootDir, 'scripts/run-maestro-android.js');
  const suiteText = existsSync(runMaestroPath) ? readFileSync(runMaestroPath, 'utf8') : '';
  const hasFallbackFlow = existsSync(fallbackFlowPath);
  const suiteReferencesFallback = suiteText.includes('maestro/recording-text-fallback.yml');
  addCheck(
    checks,
    hasFallbackFlow && suiteReferencesFallback ? 'pass' : 'fail',
    'Recording text fallback E2E flow registered',
    hasFallbackFlow && suiteReferencesFallback
      ? 'maestro/recording-text-fallback.yml exists and is listed in the Android suites.'
      : 'Fallback flow file or suite registration is missing.',
    'Add the flow file and include it in scripts/run-maestro-android.js.'
  );

  const voiceEvidenceCheck = evaluateVoiceAnalysisEvidence({
    rootDir,
    phase,
    existsSync,
    readFileSync,
  });
  addCheck(
    checks,
    voiceEvidenceCheck.status,
    'Release voice transcription, save and analysis evidence',
    voiceEvidenceCheck.details,
    voiceEvidenceCheck.remediation
  );

  const adbCommand = resolveCommand('adb', { spawn, existsSync, env });
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

  const maestroCommand = resolveCommand('maestro', { spawn, existsSync, env });
  const maestroAvailable = Boolean(maestroCommand);
  addCheck(
    checks,
    maestroAvailable ? 'pass' : 'blocked',
    'Maestro CLI',
    maestroAvailable
      ? maestroCommand === 'maestro'
        ? 'maestro is available in PATH.'
        : `maestro was found at ${maestroCommand}, but it is not available in PATH.`
      : 'maestro is not available in PATH or common Homebrew formula locations.',
    'Install Maestro CLI and make maestro available in PATH.'
  );

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
  commandExists,
  formatReport,
  getAdbDeviceVisibilityCheck,
  getAdbCandidates,
  getMaestroCandidates,
  listAdbDevices,
  parseDotEnv,
  resolveCommand,
  getPlayPaymentsProfileCheck,
  getGooglePlayInternalTrackCheck,
  getSupabasePlayIntegritySecretsCheck,
};
