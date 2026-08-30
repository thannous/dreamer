/* global describe, it, expect */
const {
  collectLucidTestStoreGateChecks,
  evaluateLucidEasBillingIsolation,
  evaluateLucidQaProfile,
  isTestRevenueCatKey,
  parseDotEnv,
} = require('./lucid-teststore-profile');

const VALID_SCRIPT =
  'node ./scripts/expo-safe-runner.js --profile .env.lucid.teststore start';

function validQaEnv() {
  return {
    NOCTALIA_APP_VARIANT: 'lucid',
    EXPO_PUBLIC_APP_VARIANT: 'lucid',
    EXPO_PUBLIC_MOCK_MODE: 'false',
    EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'test_zqltcBoDiTWPWmuyXTXTbYkJPrz',
    EXPO_PUBLIC_REVENUECAT_WEB_KEY: 'test_zqltcBoDiTWPWmuyXTXTbYkJPrz',
  };
}

function labels(results) {
  return Object.fromEntries(results.map((result) => [result.label, result]));
}

describe('Lucid Trainer Test Store QA gates', () => {
  it('parses quoted and commented env profiles', () => {
    expect(
      parseDotEnv("A=one\n# nope\nB='two'\nC=\"three\"\nEXPO_PUBLIC_MOCK_MODE=false")
    ).toEqual({
      A: 'one',
      B: 'two',
      C: 'three',
      EXPO_PUBLIC_MOCK_MODE: 'false',
    });
  });

  it('accepts only RevenueCat test_ keys', () => {
    expect(isTestRevenueCatKey('test_zqltcBoDiTWPWmuyXTXTbYkJPrz')).toBe(true);
    expect(isTestRevenueCatKey('test_')).toBe(false);
    expect(isTestRevenueCatKey('goog_BFWJqTqAtQUnwYisczZcZrnsanw')).toBe(false);
    expect(isTestRevenueCatKey('mock_web_key')).toBe(false);
  });

  it('requires an explicit Lucid Test Store profile, test_ keys, and mock false', () => {
    const results = labels(
      evaluateLucidQaProfile({
        packageJson: { scripts: { 'start:lucid:teststore': VALID_SCRIPT } },
        testStoreEnv: {
          ...validQaEnv(),
          EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'test_zqltcBoDiTWPWmuyXTXTbYkJPrz',
        },
      })
    );

    expect(results['Explicit Lucid Test Store start script'].ok).toBe(true);
    expect(results['Lucid Test Store profile selects the companion variant'].ok).toBe(true);
    expect(results['Lucid Test Store profile keeps mock mode off'].ok).toBe(true);
    expect(results['Lucid Test Store profile uses RevenueCat test_ keys'].ok).toBe(true);
  });

  it('rejects mock mode, missing script, and inherited store keys', () => {
    const results = labels(
      evaluateLucidQaProfile({
        packageJson: {
          scripts: {
            'start:lucid:mock':
              'node ./scripts/expo-safe-runner.js --profile .env.lucid.mock start',
          },
        },
        testStoreEnv: {
          NOCTALIA_APP_VARIANT: 'lucid',
          EXPO_PUBLIC_APP_VARIANT: 'lucid',
          EXPO_PUBLIC_MOCK_MODE: 'true',
          EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'goog_BFWJqTqAtQUnwYisczZcZrnsanw',
          EXPO_PUBLIC_REVENUECAT_WEB_KEY: 'mock_web_key',
        },
      })
    );

    expect(results['Explicit Lucid Test Store start script'].ok).toBe(false);
    expect(results['Lucid Test Store profile keeps mock mode off'].ok).toBe(false);
    expect(results['Lucid Test Store profile uses RevenueCat test_ keys'].ok).toBe(false);
  });

  it('rejects lucid-preview and lucid-production RevenueCat inheritance', () => {
    const isolated = labels(
      evaluateLucidEasBillingIsolation({
        build: {
          'lucid-preview': { env: { NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE: 'false' } },
          'lucid-production': { env: { NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE: 'false' } },
        },
      })
    );
    expect(isolated['lucid-preview does not inherit RevenueCat or Test Store keys'].ok).toBe(true);
    expect(isolated['lucid-production does not inherit RevenueCat or Test Store keys'].ok).toBe(true);

    const inherited = labels(
      evaluateLucidEasBillingIsolation({
        build: {
          'lucid-preview': {
            env: {
              EXPO_PUBLIC_REVENUECAT_WEB_KEY: 'test_zqltcBoDiTWPWmuyXTXTbYkJPrz',
              NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE: 'true',
            },
          },
          'lucid-production': {
            env: {
              EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'goog_BFWJqTqAtQUnwYisczZcZrnsanw',
            },
          },
        },
      })
    );
    expect(inherited['lucid-preview does not inherit RevenueCat or Test Store keys'].ok).toBe(false);
    expect(inherited['lucid-production does not inherit RevenueCat or Test Store keys'].ok).toBe(false);
  });

  it('collects profile presence plus QA and EAS isolation checks', () => {
    const results = labels(
      collectLucidTestStoreGateChecks({
        rootDir: '/repo',
        packageJson: { scripts: { 'start:lucid:teststore': VALID_SCRIPT } },
        easJson: {
          build: {
            'lucid-preview': { env: { NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE: 'false' } },
            'lucid-production': { env: {} },
          },
        },
        existsSync: (filePath) => filePath === '/repo/.env.lucid.teststore',
        readFileSync: () =>
          [
            'NOCTALIA_APP_VARIANT=lucid',
            'EXPO_PUBLIC_APP_VARIANT=lucid',
            'EXPO_PUBLIC_MOCK_MODE=false',
            'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=test_zqltcBoDiTWPWmuyXTXTbYkJPrz',
            'EXPO_PUBLIC_REVENUECAT_WEB_KEY=test_zqltcBoDiTWPWmuyXTXTbYkJPrz',
          ].join('\n'),
      })
    );

    expect(results['Explicit Lucid Test Store profile is present'].ok).toBe(true);
    expect(results['Explicit Lucid Test Store start script'].ok).toBe(true);
    expect(results['Lucid Test Store profile keeps mock mode off'].ok).toBe(true);
    expect(results['lucid-preview does not inherit RevenueCat or Test Store keys'].ok).toBe(true);
  });
});
