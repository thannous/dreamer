const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { collectLucidTestStoreGateChecks } = require('./lucid-teststore-profile');

const root = path.resolve(__dirname, '..');
const expoCli = path.join(root, 'node_modules', 'expo', 'bin', 'cli');

function runExpoConfig(markerEnvironment = {}) {
  const env = { ...process.env, EXPO_NO_DOTENV: '1' };
  delete env.NOCTALIA_APP_VARIANT;
  delete env.EXPO_PUBLIC_APP_VARIANT;
  delete env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  delete env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  delete env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  delete env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  delete env.EXPO_PUBLIC_REVENUECAT_WEB_KEY;
  Object.assign(env, markerEnvironment);
  return spawnSync(process.execPath, [expoCli, 'config', '--json'], {
    cwd: root,
    encoding: 'utf8',
    env,
  });
}

function parseConfig(result) {
  if (result.status !== 0) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

function resultOutput(result) {
  return `${result.stderr || ''}\n${result.stdout || ''}`;
}

const result = runExpoConfig({
  NOCTALIA_APP_VARIANT: 'lucid',
  EXPO_PUBLIC_APP_VARIANT: 'lucid',
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || '[lucid-gates] Expo config failed.\n');
  process.exit(result.status || 1);
}

const config = parseConfig(result);
if (!config) {
  process.stderr.write('[lucid-gates] Expo config returned invalid JSON.\n');
  process.exit(1);
}
const failures = [];

function check(label, condition, detail) {
  const passed = Boolean(condition);
  process.stdout.write(`[lucid-gates] ${passed ? 'PASS' : 'FAIL'} ${label}\n`);
  if (detail) process.stdout.write(`  ${detail}\n`);
  if (!passed) failures.push(label);
}

function pluginName(plugin) {
  return Array.isArray(plugin) ? plugin[0] : plugin;
}

function pluginOptions(name) {
  const plugin = (config.plugins || []).find((entry) => pluginName(entry) === name);
  return Array.isArray(plugin) ? plugin[1] : undefined;
}

function resolveProjectFile(relativePath) {
  return path.resolve(root, relativePath.replace(/^\.\//, ''));
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function pngSize(filePath) {
  const header = fs.readFileSync(filePath).subarray(0, 24);
  if (header.toString('hex', 0, 8) !== '89504e470d0a1a0a') return null;
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

const plugins = (config.plugins || []).map(pluginName);
const notificationOptions = pluginOptions('expo-notifications');
const cueSounds = Array.isArray(notificationOptions?.sounds) ? notificationOptions.sounds : [];
const iconPath = resolveProjectFile(config.icon || '');
const baseIconPath = resolveProjectFile('./assets/images/icon.png');
const iconSize = fs.existsSync(iconPath) ? pngSize(iconPath) : null;
const envProfile = fs.readFileSync(path.join(root, '.env.lucid'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const easJson = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
const baseResult = runExpoConfig();
const baseConfig = parseConfig(baseResult);
const nativeOnlyResult = runExpoConfig({ NOCTALIA_APP_VARIANT: 'lucid' });
const publicOnlyResult = runExpoConfig({ EXPO_PUBLIC_APP_VARIANT: 'lucid' });
const googleOnlyResult = runExpoConfig({
  NOCTALIA_APP_VARIANT: 'lucid',
  EXPO_PUBLIC_APP_VARIANT: 'lucid',
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'web-client.apps.googleusercontent.com',
});
const googleConfiguredResult = runExpoConfig({
  NOCTALIA_APP_VARIANT: 'lucid',
  EXPO_PUBLIC_APP_VARIANT: 'lucid',
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'web-client.apps.googleusercontent.com',
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: 'lucid-ios-client.apps.googleusercontent.com',
});
const googleConfiguredConfig = parseConfig(googleConfiguredResult);

check('Base identity remains Noctalia without variant markers',
  baseResult.status === 0 &&
    baseConfig?.name === 'Noctalia' &&
    baseConfig?.slug === 'noctalia' &&
    baseConfig?.scheme === 'noctalia' &&
    baseConfig?.android?.package === 'com.tanuki75.noctalia' &&
    baseConfig?.ios?.bundleIdentifier === 'com.tanuki75.noctalia' &&
    baseConfig?.extra?.product !== 'lucid-trainer'
);
check('Native-only Lucid marker is rejected clearly',
  nativeOnlyResult.status !== 0 &&
    resultOutput(nativeOnlyResult).includes('Partial Lucid Trainer configuration')
);
check('Public-only Lucid marker is rejected clearly',
  publicOnlyResult.status !== 0 &&
    resultOutput(publicOnlyResult).includes('Partial Lucid Trainer configuration')
);
check('Partial companion Google configuration is rejected clearly',
  googleOnlyResult.status !== 0 &&
    resultOutput(googleOnlyResult).includes('Partial Lucid Trainer Google configuration')
);

check('Companion identity',
  config.name === 'Noctalia Lucid Trainer' &&
    config.slug === 'noctalia-lucid-trainer' &&
    config.scheme === 'noctalia-lucid' &&
    config.extra?.product === 'lucid-trainer',
  `${config.name} · ${config.android?.package} · ${config.ios?.bundleIdentifier}`
);
check('Canonical Android Lucid script and identity',
  packageJson.scripts?.['android:lucid'] ===
      'node ./scripts/expo-safe-runner.js --profile .env.lucid run:android' &&
    config.android?.package === 'com.tanuki75.noctalia.lucid',
  `${packageJson.scripts?.['android:lucid']} · ${config.android?.package}`
);
check('Canonical iOS Lucid script and identity',
  packageJson.scripts?.['ios:lucid'] ===
      'node ./scripts/expo-safe-runner.js --profile .env.lucid run:ios' &&
    config.ios?.bundleIdentifier === 'com.tanuki75.noctalia.lucid',
  `${packageJson.scripts?.['ios:lucid']} · ${config.ios?.bundleIdentifier}`
);
check('Runtime and native variant markers',
  /^NOCTALIA_APP_VARIANT=lucid$/m.test(envProfile) &&
    /^EXPO_PUBLIC_APP_VARIANT=lucid$/m.test(envProfile)
);
check('Distinct 1024px icon',
  iconSize?.width === 1024 &&
    iconSize?.height === 1024 &&
    sha256(iconPath) !== sha256(baseIconPath),
  config.icon
);
check('Microphone and speech collection removed',
  config.android?.blockedPermissions?.includes('android.permission.RECORD_AUDIO') &&
    !config.ios?.infoPlist?.NSMicrophoneUsageDescription &&
    !config.ios?.infoPlist?.NSSpeechRecognitionUsageDescription &&
    !plugins.includes('expo-speech-recognition')
);
check('Nine bundled prudent cue sounds',
  cueSounds.length === 9 && cueSounds.every((sound) => fs.existsSync(resolveProjectFile(sound))),
  `${cueSounds.length} configured sound files`
);
check('Android reboot restoration kept',
  plugins.includes('expo-notifications') &&
    !plugins.includes('./plugins/withDisableNotificationsBootActions')
);
check('Narrow Noctalia package query', plugins.includes('./plugins/withLucidNoctaliaQueries'));
check('Companion app-link host declarations',
  config.android?.intentFilters?.some((filter) =>
    filter.data?.some((data) => data.scheme === 'https' && data.host === 'lucid.noctalia.app')
  ) && config.ios?.associatedDomains?.includes('applinks:lucid.noctalia.app')
);
check('Companion uses its own EAS project and does not inherit Noctalia OTA',
  !config.updates &&
    config.extra?.eas?.projectId === 'd210576f-5dc4-4f7a-a5e1-a407c209c3a2' &&
    config.extra?.eas?.projectId !== baseConfig?.extra?.eas?.projectId &&
    baseConfig?.extra?.eas?.projectId === 'cfd1b275-9dad-40d7-9d9a-147c7bb38415'
);
check('Shared Supabase identity remains configured',
  config.extra?.supabaseUrl === baseConfig?.extra?.supabaseUrl &&
    config.extra?.supabaseAnonKey === baseConfig?.extra?.supabaseAnonKey
);
check('Companion billing keys are never inherited from Noctalia',
  !config.extra?.revenuecatAndroidKey &&
    !config.extra?.revenuecatIosKey &&
    !config.extra?.revenuecatWebKey
);
check('Google provider is disabled until both companion clients are configured',
  !plugins.includes('@react-native-google-signin/google-signin') &&
    googleConfiguredResult.status === 0 &&
    googleConfiguredConfig?.plugins?.some((plugin) =>
      pluginName(plugin) === '@react-native-google-signin/google-signin' &&
      Array.isArray(plugin) &&
      plugin[1]?.iosUrlScheme === 'com.googleusercontent.apps.lucid-ios-client'
    )
);
check('Release documentation and additive migrations present',
  [
    'doc_web_interne/docs/LUCID_TRAINER_ARCHITECTURE.md',
    'doc_web_interne/docs/LUCID_TRAINER_RELEASE.md',
    'doc_web_interne/docs/LUCID_TRAINER_SHARED_IDENTITY_ADR.md',
    'supabase/migrations/20260813010000_lucid_trainer_sync.sql',
    'supabase/migrations/20260813011000_product_analytics_lucid_events.sql',
    'supabase/migrations/20260817012000_product_analytics_events_platform_ios.sql',
  ].every((file) => fs.existsSync(path.join(root, file)))
);

for (const resultCheck of collectLucidTestStoreGateChecks({ rootDir: root, packageJson, easJson })) {
  check(resultCheck.label, resultCheck.ok, resultCheck.detail);
}

process.stdout.write(
  `[lucid-gates] Summary: ${failures.length === 0 ? 'all checks passed' : `${failures.length} failed`}\n`
);
process.exitCode = failures.length === 0 ? 0 : 1;
