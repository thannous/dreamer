#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STRICT = process.argv.includes('--strict');
const JSON_OUTPUT = process.argv.includes('--json');

const APP_CODE_DIRS = ['app', 'components', 'context', 'hooks', 'lib', 'services'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const EXPECTED_ANDROID_PERMISSIONS = new Set([
  'android.permission.MODIFY_AUDIO_SETTINGS',
  'android.permission.RECORD_AUDIO',
]);
const PUBLIC_CLIENT_KEYS = new Set([
  'apiUrl',
  'eas',
  'revenuecatAndroidKey',
  'revenuecatWebKey',
  'router',
  'supabaseAnonKey',
  'supabaseUrl',
]);

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readFile(relativePath));
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function walkFiles(relativeDir, extensions = SOURCE_EXTENSIONS) {
  const dir = path.join(ROOT, relativeDir);
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    const relative = path.relative(ROOT, absolute);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.expo' ||
        entry.name === 'coverage' ||
        entry.name === '__tests__'
      ) {
        return [];
      }
      return walkFiles(relative, extensions);
    }
    return extensions.has(path.extname(entry.name)) ? [relative] : [];
  });
}

function add(checks, status, area, check, details, remediation) {
  checks.push({ status, area, check, details, remediation });
}

function isJwt(value) {
  return typeof value === 'string' && /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

function flattenObject(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [{ key: prefix, value }];
  }
  return Object.entries(value).flatMap(([key, child]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    return flattenObject(child, nextPrefix);
  });
}

function getExpoConfig(checks) {
  try {
    return readJson('app.json').expo;
  } catch (error) {
    add(
      checks,
      'fail',
      'config',
      'Parse app.json',
      error instanceof Error ? error.message : String(error),
      'Fix app.json before running any release security audit.'
    );
    return null;
  }
}

function getEasConfig(checks) {
  try {
    return readJson('eas.json');
  } catch (error) {
    add(
      checks,
      'fail',
      'config',
      'Parse eas.json',
      error instanceof Error ? error.message : String(error),
      'Fix eas.json before running any release security audit.'
    );
    return null;
  }
}

function auditExpoConfig(checks, expo) {
  if (!expo) return;
  const android = expo.android || {};
  const ios = expo.ios || {};

  add(
    checks,
    android.allowBackup === false ? 'pass' : 'fail',
    'platform',
    'Android backup disabled',
    `android.allowBackup=${String(android.allowBackup)}`,
    'Set expo.android.allowBackup to false so app data is not included in Android Auto Backup.'
  );

  const permissions = Array.isArray(android.permissions) ? android.permissions : [];
  const unexpectedPermissions = permissions.filter((permission) => !EXPECTED_ANDROID_PERMISSIONS.has(permission));
  add(
    checks,
    unexpectedPermissions.length === 0 ? 'pass' : 'fail',
    'platform',
    'Android permissions are narrowly scoped',
    permissions.length > 0 ? permissions.join(', ') : 'No explicit Android permissions.',
    `Remove unexpected permissions: ${unexpectedPermissions.join(', ')}`
  );

  if (permissions.includes('android.permission.MODIFY_AUDIO_SETTINGS')) {
    add(
      checks,
      'warn',
      'platform',
      'Audio settings permission requires product justification',
      'MODIFY_AUDIO_SETTINGS is present alongside RECORD_AUDIO.',
      'Keep this permission only if speech/audio routing requires it on real Android devices; otherwise remove it.'
    );
  }

  const infoPlist = ios.infoPlist || {};
  const hasMicUsage = typeof infoPlist.NSMicrophoneUsageDescription === 'string';
  const hasSpeechUsage = typeof infoPlist.NSSpeechRecognitionUsageDescription === 'string';
  add(
    checks,
    hasMicUsage && hasSpeechUsage ? 'pass' : 'fail',
    'platform',
    'iOS microphone and speech usage strings are declared',
    `microphone=${hasMicUsage}, speech=${hasSpeechUsage}`,
    'Add explicit NSMicrophoneUsageDescription and NSSpeechRecognitionUsageDescription copy.'
  );

  const intentFilters = Array.isArray(android.intentFilters) ? android.intentFilters : [];
  const verifiedHttpsAppLink = intentFilters.some((filter) =>
    filter?.autoVerify === true &&
    Array.isArray(filter.data) &&
    filter.data.some((entry) => entry?.scheme === 'https' && entry?.host === 'dream.noctalia.app')
  );
  add(
    checks,
    verifiedHttpsAppLink ? 'pass' : 'warn',
    'platform',
    'Android App Link uses HTTPS with autoVerify',
    verifiedHttpsAppLink ? 'dream.noctalia.app is configured.' : 'No verified dream.noctalia.app HTTPS App Link found.',
    'Keep App Links HTTPS-only and verify assetlinks.json before release.'
  );

  const associatedDomains = Array.isArray(ios.associatedDomains) ? ios.associatedDomains : [];
  add(
    checks,
    associatedDomains.includes('applinks:dream.noctalia.app') ? 'pass' : 'warn',
    'platform',
    'iOS Associated Domain is declared',
    associatedDomains.join(', ') || 'No associated domains declared.',
    'Keep applinks:dream.noctalia.app aligned with apple-app-site-association.'
  );

  const extraEntries = flattenObject(expo.extra || {});
  const riskyExtra = extraEntries.filter(({ key, value }) => {
    const leafKey = key.split('.').pop();
    const lowerKey = key.toLowerCase();
    if (PUBLIC_CLIENT_KEYS.has(leafKey)) return false;
    return (
      typeof value === 'string' &&
      value.length > 0 &&
      (isJwt(value) || /secret|token|jwt|private|service_role/i.test(lowerKey))
    );
  });
  add(
    checks,
    riskyExtra.length === 0 ? 'pass' : 'warn',
    'config',
    'Client Expo extra values are treated as public',
    riskyExtra.length === 0
      ? 'No token-like non-allowlisted expo.extra values found.'
      : riskyExtra.map(({ key }) => key).join(', '),
    'Anything in expo.extra is readable from the app bundle. Move true secrets server-side, or document why public anon credentials are safe under RLS/function checks.'
  );

  const hasUpdatesUrl = Boolean(expo.updates?.url);
  const hasRuntimeVersion = Boolean(expo.runtimeVersion);
  add(
    checks,
    hasUpdatesUrl && hasRuntimeVersion ? 'pass' : 'warn',
    'release',
    'EAS Update has a runtime boundary',
    `updates.url=${hasUpdatesUrl}, runtimeVersion=${expo.runtimeVersion || 'missing'}`,
    'Keep runtimeVersion tied to native compatibility and verify update channel before release.'
  );
}

function auditEasConfig(checks, eas) {
  if (!eas) return;
  const build = eas.build || {};
  const productionProfiles = Object.entries(build).filter(([name, profile]) =>
    name.includes('production') || name === 'release' || profile?.channel === 'production'
  );

  if (productionProfiles.length === 0) {
    add(
      checks,
      'fail',
      'release',
      'Production EAS profiles exist',
      'No production or release EAS profile found.',
      'Define production/release build profiles before release.'
    );
    return;
  }

  const mockModeEnabled = productionProfiles.filter(([, profile]) => {
    const env = profile?.env || {};
    return String(env.EXPO_PUBLIC_MOCK_MODE || '').toLowerCase() === 'true';
  });
  add(
    checks,
    mockModeEnabled.length === 0 ? 'pass' : 'fail',
    'release',
    'Production profiles do not enable mock mode',
    mockModeEnabled.length === 0
      ? productionProfiles.map(([name]) => name).join(', ')
      : mockModeEnabled.map(([name]) => name).join(', '),
    'Remove EXPO_PUBLIC_MOCK_MODE=true from production/release profiles.'
  );

  const envBackedProfiles = productionProfiles.filter(([, profile]) => Boolean(profile?.environment));
  add(
    checks,
    envBackedProfiles.length === productionProfiles.length ? 'pass' : 'warn',
    'release',
    'Production profiles select an EAS environment',
    productionProfiles
      .map(([name, profile]) => `${name}:${profile?.environment || 'inline-only'}`)
      .join(', '),
    'Use EAS environment variables for production/preview separation and keep inline env values public-only.'
  );

  const apkProd = build['production-apk'];
  if (apkProd?.android?.credentialsSource === 'local') {
    add(
      checks,
      'manual',
      'release',
      'Production APK uses local credentials',
      'production-apk.credentialsSource=local',
      'Use only for local/security inspection builds; store releases should use remote credentials/AAB.'
    );
  }
}

function auditCode(checks) {
  const files = APP_CODE_DIRS.flatMap((dir) => walkFiles(dir));

  const asyncStorageFiles = files.filter((file) =>
    readFile(file).includes('@react-native-async-storage/async-storage')
  );
  add(
    checks,
    asyncStorageFiles.length === 0 ? 'pass' : 'warn',
    'storage',
    'AsyncStorage usage is reviewed for sensitive data',
    asyncStorageFiles.length === 0 ? 'No AsyncStorage imports in app code.' : asyncStorageFiles.join(', '),
    'AsyncStorage is unencrypted. Keep tokens, secrets, dreams, transcripts, and PII in SecureStore, encrypted storage, or server-side storage.'
  );

  const supabaseSource = exists('lib/supabase.ts') ? readFile('lib/supabase.ts') : '';
  add(
    checks,
    supabaseSource.includes('expo-secure-store') &&
      supabaseSource.includes('ExpoSecureStoreAdapter') &&
      supabaseSource.includes('persistSession: true')
      ? 'pass'
      : 'fail',
    'storage',
    'Supabase native session persistence uses SecureStore',
    'Checked lib/supabase.ts.',
    'Persist native Supabase sessions via expo-secure-store, not AsyncStorage.'
  );

  add(
    checks,
    supabaseSource.includes('SECURESTORE_SAFE_CHUNK_SIZE') && supabaseSource.includes('cleanupChunkedValue')
      ? 'pass'
      : 'warn',
    'storage',
    'SecureStore large-value handling is explicit',
    'Checked SecureStore chunking support.',
    'Handle SecureStore native value-size limits and cleanup stale chunks.'
  );

  const httpSource = exists('lib/http.ts') ? readFile('lib/http.ts') : '';
  add(
    checks,
    httpSource.includes('isSecureTransport') && httpSource.includes('Skipping Supabase auth headers for insecure URL')
      ? 'pass'
      : 'fail',
    'network',
    'Auth headers are not sent over non-local cleartext HTTP',
    'Checked lib/http.ts transport guard.',
    'Guard Authorization/apikey attachment so cleartext non-local hosts never receive auth headers.'
  );

  add(
    checks,
    httpSource.includes('intentionally excludes the response body') && httpSource.includes('HTTP ${options.status}')
      ? 'pass'
      : 'warn',
    'network',
    'HTTP errors avoid leaking response bodies by default',
    'Checked HttpError message construction.',
    'Keep response bodies out of user-visible or generic logged Error.message values.'
  );

  const guestSessionSource = exists('lib/guestSession.ts') ? readFile('lib/guestSession.ts') : '';
  add(
    checks,
    guestSessionSource.includes('@expo/app-integrity') &&
      guestSessionSource.includes('prepareIntegrityTokenProviderAsync') &&
      guestSessionSource.includes('requestIntegrityCheckAsync')
      ? 'pass'
      : 'warn',
    'auth',
    'Guest Android flow uses Play Integrity',
    'Checked lib/guestSession.ts.',
    'Keep costly guest actions bound to backend-issued guest sessions and Play Integrity on Android.'
  );

  const migrationFiles = walkFiles('supabase/migrations', new Set(['.sql']));
  const hasRlsMigration = migrationFiles.some((file) => {
    const source = readFile(file).toLowerCase();
    return source.includes('row level security') || source.includes('create policy') || source.includes('alter policy');
  });
  add(
    checks,
    hasRlsMigration ? 'pass' : 'warn',
    'backend',
    'Supabase RLS/policy migrations are present',
    hasRlsMigration ? 'RLS/policy SQL found in migrations.' : 'No RLS/policy SQL detected.',
    'Run a backend policy review for anon, authenticated, service-role, and webhook paths.'
  );

  const webhookSource = exists('supabase/functions/revenuecat-webhook/index.ts')
    ? readFile('supabase/functions/revenuecat-webhook/index.ts')
    : '';
  add(
    checks,
    webhookSource.includes('verifyWebhookAuthorization') && webhookSource.includes('SUPABASE_SERVICE_ROLE_KEY')
      ? 'pass'
      : 'warn',
    'backend',
    'RevenueCat webhook has explicit authorization',
    'Checked supabase/functions/revenuecat-webhook/index.ts.',
    'Keep webhook secrets server-side and require authorization for every non-OPTIONS webhook request.'
  );

  const consoleFindings = files.flatMap((file) => {
    const lines = readFile(file).split(/\r?\n/);
    return lines.flatMap((line, index) => {
      if (!/console\.(debug|log|warn|error)\(/.test(line)) return [];
      if (line.includes('__DEV__')) return [];
      return [`${file}:${index + 1}`];
    });
  });
  add(
    checks,
    consoleFindings.length === 0 ? 'pass' : 'warn',
    'privacy',
    'Production logging is reviewed for sensitive data',
    consoleFindings.length === 0
      ? 'No unconditional console calls found in app code.'
      : `${consoleFindings.length} unconditional console call(s); first entries: ${consoleFindings.slice(0, 12).join(', ')}`,
    'Wrap debug logs in __DEV__, route production diagnostics through a redacting logger, and avoid dream text, tokens, user IDs, or entitlement payloads in logs.'
  );
}

function auditTooling(checks) {
  add(
    checks,
    exists('package-lock.json') ? 'pass' : 'warn',
    'supply-chain',
    'Dependency lockfile is present',
    exists('package-lock.json') ? 'package-lock.json found.' : 'No package-lock.json found.',
    'Keep lockfiles committed and run npm audit / Expo dependency checks before release.'
  );

  add(
    checks,
    'manual',
    'supply-chain',
    'Dependency vulnerability scan',
    'Run npm audit --omit=dev --audit-level=high.',
    'Patch or document high/critical production dependency advisories.'
  );

  add(
    checks,
    'manual',
    'release',
    'Generated native manifest and release artifact inspection',
    'Requires npx expo prebuild/build artifact or EAS build output.',
    'Inspect AndroidManifest.xml, Info.plist, bundled strings, and release APK/AAB before production submission.'
  );

  add(
    checks,
    'manual',
    'dynamic',
    'Device-level dynamic security checks',
    'Requires emulator or physical Android/iOS device.',
    'Validate logs, deep links, local storage, network traffic, logout/session invalidation, and Play-installed RevenueCat/Play Integrity flows.'
  );
}

function formatMarkdown(checks) {
  const order = { fail: 0, warn: 1, manual: 2, pass: 3 };
  const sorted = [...checks].sort((a, b) => order[a.status] - order[b.status] || a.area.localeCompare(b.area));
  const counts = checks.reduce((acc, check) => {
    acc[check.status] = (acc[check.status] || 0) + 1;
    return acc;
  }, {});

  const lines = [];
  lines.push('# Mobile Security Audit Checks');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`Summary: ${counts.fail || 0} fail, ${counts.warn || 0} warn, ${counts.manual || 0} manual, ${counts.pass || 0} pass.`);
  lines.push('');
  lines.push('| Status | Area | Check | Details | Remediation |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const check of sorted) {
    lines.push(
      `| ${check.status.toUpperCase()} | ${escapeCell(check.area)} | ${escapeCell(check.check)} | ${escapeCell(check.details)} | ${escapeCell(check.remediation)} |`
    );
  }
  lines.push('');
  if (STRICT && (counts.fail || 0) > 0) {
    lines.push('Strict mode failed because at least one blocking security check failed.');
  }
  return lines.join('\n');
}

function escapeCell(value) {
  return String(value || '')
    .replace(/\r?\n/g, '<br>')
    .replace(/\|/g, '\\|');
}

function main() {
  const checks = [];
  const expo = getExpoConfig(checks);
  const eas = getEasConfig(checks);

  auditExpoConfig(checks, expo);
  auditEasConfig(checks, eas);
  auditCode(checks);
  auditTooling(checks);

  if (JSON_OUTPUT) {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), strict: STRICT, checks }, null, 2));
  } else {
    console.log(formatMarkdown(checks));
  }

  const hasFail = checks.some((check) => check.status === 'fail');
  if (STRICT && hasFail) {
    process.exitCode = 1;
  }
}

main();
