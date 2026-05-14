#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const PLAY_INTEGRITY_PROJECT_NUMBER_KEY = 'EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER';
const EXPECTED_GOOGLE_CLOUD_PROJECT_ID = 'gen-lang-client-0336445544';
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

function getAdbCandidates(env = process.env) {
  const sdkRoots = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT].filter(Boolean);
  if (env.HOME) {
    sdkRoots.push(path.join(env.HOME, 'Library/Android/sdk'));
  }
  sdkRoots.push('/opt/android-sdk', '/usr/local/share/android-sdk');

  return Array.from(
    new Set(sdkRoots.map((sdkRoot) => path.join(sdkRoot, 'platform-tools', 'adb')))
  );
}

function getMaestroCandidates(env = process.env) {
  const candidates = [];
  if (env.MAESTRO_CLI_PATH) {
    candidates.push(env.MAESTRO_CLI_PATH);
  }
  candidates.push(
    '/opt/homebrew/opt/maestro/bin/maestro',
    '/usr/local/opt/maestro/bin/maestro'
  );
  return Array.from(new Set(candidates));
}

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

function resolveCommand(command, {
  spawn = spawnSync,
  existsSync = fs.existsSync,
  env = process.env,
} = {}) {
  const lookupCommand = process.platform === 'win32' ? 'where' : 'which';
  const result = spawn(lookupCommand, [command], { encoding: 'utf8' });
  if (result.status === 0) {
    return command;
  }

  if (command === 'adb') {
    return getAdbCandidates(env).find((candidate) => existsSync(candidate)) || null;
  }

  if (command === 'maestro') {
    return getMaestroCandidates(env).find((candidate) => existsSync(candidate)) || null;
  }

  return null;
}

function commandExists(command, spawn = spawnSync) {
  return Boolean(resolveCommand(command, { spawn }));
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
} = {}) {
  const checks = [];
  const easJson = readJson(rootDir, 'eas.json');
  const envPath = path.join(rootDir, '.env.teststore');
  const envValues = existsSync(envPath) ? parseDotEnv(readFileSync(envPath, 'utf8')) : {};
  const projectStateResult = readGoogleCloudProjectState({ rootDir, existsSync, readFileSync, env });

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
    'Run npm run subscription:qa:release-gate and close the remaining Test Store, account-switch, and Play evidence gates before Android production release.'
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
    const devices = listAdbDevices(spawn, adbCommand);
    addCheck(
      checks,
      devices.ok && devices.devices.length > 0 ? 'pass' : 'blocked',
      'Android emulator or physical device',
      devices.ok ? devices.message : devices.message || 'Unable to list adb devices.',
      'Start an Android emulator or connect/unlock a physical Android device.'
    );
  } else {
    addCheck(
      checks,
      'blocked',
      'Android emulator or physical device',
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
  addCheck(
    checks,
    'manual',
    'Supabase Play Integrity secrets',
    'Supabase Edge Function secrets are intentionally not stored in the repo.',
    'Verify PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64, PLAY_INTEGRITY_PACKAGE_NAME, and GUEST_SESSION_SECRET in Supabase.'
  );
  addCheck(
    checks,
    'manual',
    'Play payments profile for Billing',
    'Play Console payments profile and payment-method verification are external to the repo, and Play Console currently needs manual confirmation before monetization release.',
    'Resolve any Play Console payments profile warnings before relying on Google Play Billing in production.'
  );
  addCheck(
    checks,
    'manual',
    'Play App Signing SHA-1 for Google OAuth',
    'Play App Signing SHA-1 extracted from the Play-generated APK: BC:CF:C2:96:38:47:81:D6:8C:B7:B6:5A:BA:84:CB:B3:8C:85:E0:59.',
    'Verify this SHA-1 exists in the Android OAuth client in Google Cloud.'
  );
  addCheck(
    checks,
    'manual',
    'Play-installed RevenueCat purchase and restore',
    'Purchase/restore validation requires a physical Android device with a signed build installed from Play Internal Testing and installerPackageName=com.android.vending.',
    'Upload an AAB, connect a physical tester device, run npm run android:device:physical, install via Play Internal Testing, run npm run android:play-install-source -- --device <adb-id>, then test offering load, purchase, and restore.'
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
  getAdbCandidates,
  getMaestroCandidates,
  listAdbDevices,
  parseDotEnv,
  resolveCommand,
};
