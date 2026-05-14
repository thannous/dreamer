#!/usr/bin/env node

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
const { getOpenPaymentProfileRequirements } = require('./update-google-play-payments-profile-state');
const {
  getSupabasePlayIntegritySecretIssues,
} = require('./update-supabase-play-integrity-secrets-state');

const ROOT = path.resolve(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const PLAY_INTEGRITY_PROJECT_NUMBER_KEY = 'EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER';
const EXPECTED_GOOGLE_CLOUD_PROJECT_ID = 'gen-lang-client-0336445544';
const EXPECTED_GOOGLE_OAUTH_ANDROID_CLIENT_ID = '359653779023-5dhs012rh7l3cjf0leoknn7j0dlgq0ok.apps.googleusercontent.com';
const EXPECTED_GOOGLE_OAUTH_ANDROID_SHA1 = 'BC:CF:C2:96:38:47:81:D6:8C:B7:B6:5A:BA:84:CB:B3:8C:85:E0:59';
const EXPECTED_ANDROID_PACKAGE_NAME = 'com.tanuki75.noctalia';
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
      mdns.supported && mdns.next
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

function checkSubscriptionQaReleaseGate(rootDir, spawn = spawnSync, env = process.env) {
  const result = spawn(npmCommand, ['run', 'subscription:qa:release-gate'], {
    cwd: rootDir,
    env,
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 1024 * 1024 * 4,
  });
  if (result.status === 0) {
    return {
      ok: true,
      details: 'subscription:qa:release-gate passed.',
    };
  }
  const summary = summarizeCommandOutput(`${result.stdout || ''}\n${result.stderr || ''}`);
  return {
    ok: false,
    details: summary || `subscription:qa:release-gate exited with status ${result.status ?? 'unknown'}.`,
  };
}

function checkAndroidReleaseGates({
  rootDir = ROOT,
  spawn = spawnSync,
  existsSync = fs.existsSync,
  readFileSync = fs.readFileSync,
  env = process.env,
  platform = process.platform,
} = {}) {
  const checks = [];
  const easJson = readJson(rootDir, 'eas.json');
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

  const subscriptionGate = checkSubscriptionQaReleaseGate(rootDir, spawn, env);
  addCheck(
    checks,
    subscriptionGate.ok ? 'pass' : 'fail',
    'RevenueCat subscription QA release gate',
    subscriptionGate.details,
    'Run npm run subscription:qa:release-gate and close the remaining evidence gates listed in the report before Android production release.'
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
  addCheck(
    checks,
    'manual',
    'Play-installed RevenueCat purchase and restore',
    'Purchase/restore validation requires a physical Android device with a signed build installed from Play Internal Testing and installerPackageName=com.android.vending.',
    'Upload an AAB, connect a physical tester device, install via Play Internal Testing, then run npm run android:play-qa-device:wait for one device, npm run android:play-qa-device:wait -- --device <adb-id> when multiple devices are ready, or npm run android:play-qa-device -- --device <adb-id>. After the preflight passes, test offering load, purchase, and restore.'
  );

  return {
    ok: checks.every((check) => check.status === 'pass' || check.status === 'manual'),
    counts: checks.reduce((acc, check) => {
      acc[check.status] = (acc[check.status] || 0) + 1;
      return acc;
    }, {}),
    checks,
  };
}

function formatReport(report) {
  const lines = ['[android-gates] Android release gate preflight'];
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

function main() {
  const args = process.argv.slice(2);
  const reportOnly = args.includes('--report-only');
  const json = args.includes('--json');
  const report = checkAndroidReleaseGates();
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
  getSupabasePlayIntegritySecretsCheck,
};
