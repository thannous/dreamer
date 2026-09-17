import {
  APP_PRODUCTS,
  IDENTITY_ENVIRONMENTS,
  NOCTALIA_IDENTITY_MATRIX,
  NOCTALIA_IDENTITY_ROWS,
  PRODUCTION_IDENTITIES,
  assertValidNoctaliaIdentityMatrix,
  getNoctaliaIdentity,
  validateNoctaliaIdentityMatrix,
} from '@/identity';
import type {
  AppProduct,
  IdentityEnvironment,
  NoctaliaIdentity,
} from '@/identity';

const EXPECTED_ROWS: readonly {
  product: AppProduct;
  environment: IdentityEnvironment;
  name: string;
  slug: string;
  androidApplicationId: string;
  iosBundleIdentifier: string;
  scheme: string;
  host: string | null;
  easProjectId: string;
  otaEnabled: boolean;
}[] = [
  {
    product: 'dream',
    environment: 'production',
    name: 'Noctalia',
    slug: 'noctalia',
    androidApplicationId: 'com.tanuki75.noctalia',
    iosBundleIdentifier: 'com.tanuki75.noctalia',
    scheme: 'noctalia',
    host: 'dream.noctalia.app',
    easProjectId: 'cfd1b275-9dad-40d7-9d9a-147c7bb38415',
    otaEnabled: true,
  },
  {
    product: 'dream',
    environment: 'qa',
    name: 'Noctalia QA',
    slug: 'noctalia',
    androidApplicationId: 'com.tanuki75.noctalia.qa',
    iosBundleIdentifier: 'com.tanuki75.noctalia.qa',
    scheme: 'noctalia-qa',
    host: null,
    easProjectId: 'cfd1b275-9dad-40d7-9d9a-147c7bb38415',
    otaEnabled: false,
  },
  {
    product: 'dream',
    environment: 'development',
    name: 'Noctalia Dev',
    slug: 'noctalia',
    androidApplicationId: 'com.tanuki75.noctalia.dev',
    iosBundleIdentifier: 'com.tanuki75.noctalia.dev',
    scheme: 'noctalia-dev',
    host: null,
    easProjectId: 'cfd1b275-9dad-40d7-9d9a-147c7bb38415',
    otaEnabled: false,
  },
  {
    product: 'lucid',
    environment: 'production',
    name: 'Noctalia Lucid Trainer',
    slug: 'noctalia-lucid-trainer',
    androidApplicationId: 'com.tanuki75.noctalia.lucid',
    iosBundleIdentifier: 'com.tanuki75.noctalia.lucid',
    scheme: 'noctalia-lucid',
    host: 'lucid.noctalia.app',
    easProjectId: 'd210576f-5dc4-4f7a-a5e1-a407c209c3a2',
    otaEnabled: false,
  },
  {
    product: 'lucid',
    environment: 'qa',
    name: 'Noctalia Lucid Trainer QA',
    slug: 'noctalia-lucid-trainer',
    androidApplicationId: 'com.tanuki75.noctalia.lucid.qa',
    iosBundleIdentifier: 'com.tanuki75.noctalia.lucid.qa',
    scheme: 'noctalia-lucid-qa',
    host: null,
    easProjectId: 'd210576f-5dc4-4f7a-a5e1-a407c209c3a2',
    otaEnabled: false,
  },
  {
    product: 'lucid',
    environment: 'development',
    name: 'Noctalia Lucid Trainer Dev',
    slug: 'noctalia-lucid-trainer',
    androidApplicationId: 'com.tanuki75.noctalia.lucid.dev',
    iosBundleIdentifier: 'com.tanuki75.noctalia.lucid.dev',
    scheme: 'noctalia-lucid-dev',
    host: null,
    easProjectId: 'd210576f-5dc4-4f7a-a5e1-a407c209c3a2',
    otaEnabled: false,
  },
  {
    product: 'meditation',
    environment: 'production',
    name: 'Noctalia Meditation',
    slug: 'noctalia-meditation',
    androidApplicationId: 'com.noctalia.meditation',
    iosBundleIdentifier: 'com.noctalia.meditation',
    scheme: 'noctaliameditation',
    host: null,
    easProjectId: '8bd251b4-f3ed-4ae4-a73b-e2cc6c9d30c7',
    otaEnabled: false,
  },
  {
    product: 'meditation',
    environment: 'qa',
    name: 'Noctalia Meditation QA',
    slug: 'noctalia-meditation',
    androidApplicationId: 'com.noctalia.meditation.qa',
    iosBundleIdentifier: 'com.noctalia.meditation.qa',
    scheme: 'noctaliameditation-qa',
    host: null,
    easProjectId: '8bd251b4-f3ed-4ae4-a73b-e2cc6c9d30c7',
    otaEnabled: false,
  },
  {
    product: 'meditation',
    environment: 'development',
    name: 'Noctalia Meditation Dev',
    slug: 'noctalia-meditation',
    androidApplicationId: 'com.noctalia.meditation.dev',
    iosBundleIdentifier: 'com.noctalia.meditation.dev',
    scheme: 'noctaliameditation-dev',
    host: null,
    easProjectId: '8bd251b4-f3ed-4ae4-a73b-e2cc6c9d30c7',
    otaEnabled: false,
  },
];

type MutableIdentityMatrix = {
  [Product in AppProduct]: {
    [Environment in IdentityEnvironment]: NoctaliaIdentity;
  };
};

function cloneMatrix(): MutableIdentityMatrix {
  return JSON.parse(JSON.stringify(NOCTALIA_IDENTITY_MATRIX)) as MutableIdentityMatrix;
}

function identitySummary(row: NoctaliaIdentity) {
  return {
    product: row.product,
    environment: row.environment,
    name: row.name,
    slug: row.slug,
    androidApplicationId: row.androidApplicationId,
    iosBundleIdentifier: row.iosBundleIdentifier,
    scheme: row.scheme,
    host: row.host,
    easProjectId: row.easProjectId,
    otaEnabled: row.ota.enabled,
  };
}

describe('Noctalia identity matrix', () => {
  it('exposes every product/environment row with frozen production values', () => {
    expect(APP_PRODUCTS).toEqual(['dream', 'lucid', 'meditation']);
    expect(IDENTITY_ENVIRONMENTS).toEqual(['production', 'qa', 'development']);
    expect(NOCTALIA_IDENTITY_ROWS).toHaveLength(9);
    expect(NOCTALIA_IDENTITY_ROWS.map(identitySummary)).toEqual(EXPECTED_ROWS);

    for (const expected of EXPECTED_ROWS) {
      expect(identitySummary(getNoctaliaIdentity(expected.product, expected.environment))).toEqual(
        expected
      );
    }
  });

  it('keeps Android IDs, iOS IDs, and schemes globally unique', () => {
    const androidIds = NOCTALIA_IDENTITY_ROWS.map((row) => row.androidApplicationId);
    const iosIds = NOCTALIA_IDENTITY_ROWS.map((row) => row.iosBundleIdentifier);
    const schemes = NOCTALIA_IDENTITY_ROWS.map((row) => row.scheme);

    expect(new Set(androidIds).size).toBe(androidIds.length);
    expect(new Set(iosIds).size).toBe(iosIds.length);
    expect(new Set(schemes).size).toBe(schemes.length);
    expect(validateNoctaliaIdentityMatrix(NOCTALIA_IDENTITY_MATRIX)).toEqual({
      ok: true,
      issues: [],
    });
    expect(() => assertValidNoctaliaIdentityMatrix(NOCTALIA_IDENTITY_MATRIX)).not.toThrow();
  });

  it('keeps production OTA and hosts frozen, and disables both for local rows', () => {
    const dreamProduction = getNoctaliaIdentity('dream', 'production');
    expect(dreamProduction.ota).toEqual({
      enabled: true,
      reference: 'production',
      updatesUrl: PRODUCTION_IDENTITIES.dream.otaUpdatesUrl,
    });
    expect(getNoctaliaIdentity('lucid', 'production').ota).toEqual({ enabled: false });
    expect(getNoctaliaIdentity('meditation', 'production').ota).toEqual({ enabled: false });

    for (const row of NOCTALIA_IDENTITY_ROWS) {
      if (row.environment === 'production') {
        continue;
      }
      expect(row.host).toBeNull();
      expect(row.ota.enabled).toBe(false);
    }
  });

  it('makes unknown and unprovisioned provider bindings explicit without secrets', () => {
    const serialized = JSON.stringify(NOCTALIA_IDENTITY_MATRIX);
    expect(serialized).not.toMatch(/goog_|test_|apps\.googleusercontent|BEGIN |secret/i);

    expect(getNoctaliaIdentity('dream', 'production').providers).toEqual({
      google: { android: 'provisioned', ios: 'provisioned', web: 'provisioned' },
      revenueCat: { android: 'provisioned', ios: 'unprovisioned', web: 'unknown' },
      playIntegrity: { android: 'provisioned' },
    });
    expect(getNoctaliaIdentity('lucid', 'production').providers).toEqual({
      google: { android: 'unprovisioned', ios: 'unprovisioned', web: 'unprovisioned' },
      revenueCat: { android: 'unprovisioned', ios: 'unprovisioned', web: 'unprovisioned' },
      playIntegrity: { android: 'unknown' },
    });
    expect(getNoctaliaIdentity('meditation', 'production').providers).toEqual({
      google: { android: 'unprovisioned', ios: 'unprovisioned', web: 'unprovisioned' },
      revenueCat: { android: 'unprovisioned', ios: 'unprovisioned', web: 'unprovisioned' },
      playIntegrity: { android: 'unprovisioned' },
    });
  });

  it('rejects unsupported resolver inputs instead of guessing a product', () => {
    expect(() => getNoctaliaIdentity('other' as AppProduct, 'production')).toThrow(
      'unsupported product'
    );
    expect(() => getNoctaliaIdentity('dream', 'staging' as IdentityEnvironment)).toThrow(
      'unsupported environment'
    );
  });

  it('exposes uniqueness and production-constant failures deterministically', () => {
    const duplicateAndroid = cloneMatrix();
    duplicateAndroid.lucid.qa = {
      ...duplicateAndroid.lucid.qa,
      androidApplicationId: duplicateAndroid.dream.production.androidApplicationId,
    };

    const duplicateAndroidResult = validateNoctaliaIdentityMatrix(duplicateAndroid);
    expect(duplicateAndroidResult.ok).toBe(false);
    if (duplicateAndroidResult.ok) {
      throw new Error('expected duplicate Android validation to fail');
    }
    expect(duplicateAndroidResult.issues).toEqual([
      {
        code: 'duplicate-android-id',
        message:
          'androidApplicationId com.tanuki75.noctalia is used by dream/production and lucid/qa',
      },
    ]);

    const productionDrift = cloneMatrix();
    productionDrift.dream.production = {
      ...productionDrift.dream.production,
      androidApplicationId: 'com.tanuki75.noctalia.wrong',
      scheme: 'noctalia-wrong',
    };
    const productionResult = validateNoctaliaIdentityMatrix(productionDrift);
    expect(productionResult.ok).toBe(false);
    if (productionResult.ok) {
      throw new Error('expected production constant validation to fail');
    }
    expect(productionResult.issues.map((issue) => issue.code)).toEqual([
      'production-constant-mismatch',
      'production-constant-mismatch',
    ]);

    const localHost = cloneMatrix();
    localHost.meditation.development = {
      ...localHost.meditation.development,
      host: 'dream.noctalia.app',
      ota: {
        enabled: true,
        reference: 'production',
        updatesUrl: PRODUCTION_IDENTITIES.dream.otaUpdatesUrl,
      },
    };
    const localResult = validateNoctaliaIdentityMatrix(localHost);
    expect(localResult.ok).toBe(false);
    if (localResult.ok) {
      throw new Error('expected local host/OTA validation to fail');
    }
    expect(localResult.issues.map((issue) => issue.code).sort()).toEqual([
      'non-production-has-production-host',
      'non-production-ota-enabled',
    ]);

    expect(() => assertValidNoctaliaIdentityMatrix(duplicateAndroid)).toThrow(
      'duplicate-android-id'
    );
  });
});
