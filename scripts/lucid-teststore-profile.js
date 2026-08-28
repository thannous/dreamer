const fs = require('node:fs');
const path = require('node:path');

const LUCID_EAS_PROFILES = ['lucid-preview', 'lucid-production'];
const REVENUECAT_PUBLIC_KEYS = [
  'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY',
  'EXPO_PUBLIC_REVENUECAT_IOS_KEY',
  'EXPO_PUBLIC_REVENUECAT_WEB_KEY',
];
const REQUIRED_TESTSTORE_REVENUECAT_KEYS = [
  'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY',
  'EXPO_PUBLIC_REVENUECAT_WEB_KEY',
];

function parseDotEnv(content) {
  const values = {};
  String(content || '')
    .split(/\r?\n/)
    .forEach((line) => {
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

function isTestRevenueCatKey(value) {
  return typeof value === 'string' && value.startsWith('test_') && value.length > 5;
}

function evaluateLucidQaProfile({ packageJson, testStoreEnv }) {
  const results = [];

  function add(label, condition, detail) {
    results.push({ label, ok: Boolean(condition), detail });
  }

  add(
    'Explicit Lucid Test Store start script',
    packageJson?.scripts?.['start:lucid:teststore'] ===
      'node ./scripts/expo-safe-runner.js --profile .env.lucid.teststore start',
    packageJson?.scripts?.['start:lucid:teststore']
  );
  add(
    'Lucid Test Store profile selects the companion variant',
    testStoreEnv?.NOCTALIA_APP_VARIANT === 'lucid' &&
      testStoreEnv?.EXPO_PUBLIC_APP_VARIANT === 'lucid',
    `native=${testStoreEnv?.NOCTALIA_APP_VARIANT ?? '<unset>'} public=${testStoreEnv?.EXPO_PUBLIC_APP_VARIANT ?? '<unset>'}`
  );
  add(
    'Lucid Test Store profile keeps mock mode off',
    testStoreEnv?.EXPO_PUBLIC_MOCK_MODE === 'false',
    `EXPO_PUBLIC_MOCK_MODE=${testStoreEnv?.EXPO_PUBLIC_MOCK_MODE ?? '<unset>'}`
  );

  const presentKeys = REVENUECAT_PUBLIC_KEYS.filter((key) => testStoreEnv?.[key]);
  const missingRequired = REQUIRED_TESTSTORE_REVENUECAT_KEYS.filter(
    (key) => !isTestRevenueCatKey(testStoreEnv?.[key])
  );
  const nonTestKeys = presentKeys.filter((key) => !isTestRevenueCatKey(testStoreEnv?.[key]));

  add(
    'Lucid Test Store profile uses RevenueCat test_ keys',
    missingRequired.length === 0 && nonTestKeys.length === 0,
    presentKeys.length === 0
      ? 'no RevenueCat keys'
      : presentKeys
          .map((key) => `${key}=${isTestRevenueCatKey(testStoreEnv[key]) ? 'test_' : 'not-test_'}`)
          .join(', ')
  );

  return results;
}

function evaluateLucidEasBillingIsolation(easJson) {
  const results = [];

  for (const profileName of LUCID_EAS_PROFILES) {
    const env = easJson?.build?.[profileName]?.env || {};
    const inheritedKeys = REVENUECAT_PUBLIC_KEYS.filter((key) => Boolean(env[key]));
    const testLikeEntries = Object.entries(env).filter(
      ([key, value]) => /REVENUECAT/i.test(key) && String(value).startsWith('test_')
    );
    const testStoreDebuggable = env.NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE;

    results.push({
      label: `${profileName} does not inherit RevenueCat or Test Store keys`,
      ok:
        inheritedKeys.length === 0 &&
        testLikeEntries.length === 0 &&
        testStoreDebuggable !== 'true',
      detail:
        inheritedKeys.length === 0 && testLikeEntries.length === 0
          ? `NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE=${testStoreDebuggable ?? '<unset>'}`
          : [...inheritedKeys, ...testLikeEntries.map(([key]) => key)].join(', '),
    });
  }

  return results;
}

function collectLucidTestStoreGateChecks({
  rootDir,
  packageJson,
  easJson,
  readFileSync = fs.readFileSync,
  existsSync = fs.existsSync,
} = {}) {
  const testStoreProfilePath = path.join(rootDir, '.env.lucid.teststore');
  const exists = existsSync(testStoreProfilePath);
  const testStoreEnv = exists ? parseDotEnv(readFileSync(testStoreProfilePath, 'utf8')) : {};

  return [
    {
      label: 'Explicit Lucid Test Store profile is present',
      ok: exists,
      detail: testStoreProfilePath,
    },
    ...evaluateLucidQaProfile({ packageJson, testStoreEnv }),
    ...evaluateLucidEasBillingIsolation(easJson),
  ];
}

module.exports = {
  collectLucidTestStoreGateChecks,
  evaluateLucidEasBillingIsolation,
  evaluateLucidQaProfile,
  isTestRevenueCatKey,
  parseDotEnv,
};
