import { PRODUCTION_IDENTITIES } from './constants';
import type {
  AppProduct,
  IdentityEnvironment,
  NoctaliaIdentity,
  NoctaliaIdentityMatrix,
  StoreProviderBindings,
} from './types';

const DREAM_PRODUCTION_PROVIDERS = {
  google: {
    android: 'provisioned',
    ios: 'provisioned',
    web: 'provisioned',
  },
  revenueCat: {
    android: 'provisioned',
    ios: 'unprovisioned',
    web: 'unknown',
  },
  playIntegrity: {
    android: 'provisioned',
  },
} as const satisfies StoreProviderBindings;

const LUCID_PRODUCTION_PROVIDERS = {
  google: {
    android: 'unprovisioned',
    ios: 'unprovisioned',
    web: 'unprovisioned',
  },
  revenueCat: {
    android: 'unprovisioned',
    ios: 'unprovisioned',
    web: 'unprovisioned',
  },
  playIntegrity: {
    android: 'unknown',
  },
} as const satisfies StoreProviderBindings;

const MEDITATION_PRODUCTION_PROVIDERS = {
  google: {
    android: 'unprovisioned',
    ios: 'unprovisioned',
    web: 'unprovisioned',
  },
  revenueCat: {
    android: 'unprovisioned',
    ios: 'unprovisioned',
    web: 'unprovisioned',
  },
  playIntegrity: {
    android: 'unprovisioned',
  },
} as const satisfies StoreProviderBindings;

const LOCAL_PROVIDERS = {
  google: {
    android: 'unprovisioned',
    ios: 'unprovisioned',
    web: 'unprovisioned',
  },
  revenueCat: {
    android: 'unprovisioned',
    ios: 'unprovisioned',
    web: 'unprovisioned',
  },
  playIntegrity: {
    android: 'unprovisioned',
  },
} as const satisfies StoreProviderBindings;

function localIds(productionId: string, suffix: 'qa' | 'dev'): string {
  return `${productionId}.${suffix}`;
}

function localScheme(productionScheme: string, suffix: 'qa' | 'dev'): string {
  return `${productionScheme}-${suffix}`;
}

function localName(productionName: string, environment: 'qa' | 'development'): string {
  return environment === 'qa' ? `${productionName} QA` : `${productionName} Dev`;
}

function dreamRow(
  environment: IdentityEnvironment,
  overrides: Partial<NoctaliaIdentity>
): NoctaliaIdentity {
  const production = PRODUCTION_IDENTITIES.dream;
  return {
    product: 'dream',
    environment,
    name: production.name,
    slug: production.slug,
    androidApplicationId: production.androidApplicationId,
    iosBundleIdentifier: production.iosBundleIdentifier,
    scheme: production.scheme,
    host: production.host,
    easProjectId: production.easProjectId,
    ota: { enabled: false },
    providers: LOCAL_PROVIDERS,
    ...overrides,
  };
}

function lucidRow(
  environment: IdentityEnvironment,
  overrides: Partial<NoctaliaIdentity>
): NoctaliaIdentity {
  const production = PRODUCTION_IDENTITIES.lucid;
  return {
    product: 'lucid',
    environment,
    name: production.name,
    slug: production.slug,
    androidApplicationId: production.androidApplicationId,
    iosBundleIdentifier: production.iosBundleIdentifier,
    scheme: production.scheme,
    host: null,
    easProjectId: production.easProjectId,
    ota: { enabled: false },
    providers: LOCAL_PROVIDERS,
    ...overrides,
  };
}

function meditationRow(
  environment: IdentityEnvironment,
  overrides: Partial<NoctaliaIdentity>
): NoctaliaIdentity {
  const production = PRODUCTION_IDENTITIES.meditation;
  return {
    product: 'meditation',
    environment,
    name: production.name,
    slug: production.slug,
    androidApplicationId: production.androidApplicationId,
    iosBundleIdentifier: production.iosBundleIdentifier,
    scheme: production.scheme,
    host: null,
    easProjectId: production.easProjectId,
    ota: { enabled: false },
    providers: LOCAL_PROVIDERS,
    ...overrides,
  };
}

export const NOCTALIA_IDENTITY_MATRIX = {
  dream: {
    production: dreamRow('production', {
      ota: {
        enabled: true,
        reference: 'production',
        updatesUrl: PRODUCTION_IDENTITIES.dream.otaUpdatesUrl,
      },
      providers: DREAM_PRODUCTION_PROVIDERS,
    }),
    qa: dreamRow('qa', {
      name: localName(PRODUCTION_IDENTITIES.dream.name, 'qa'),
      androidApplicationId: localIds(PRODUCTION_IDENTITIES.dream.androidApplicationId, 'qa'),
      iosBundleIdentifier: localIds(PRODUCTION_IDENTITIES.dream.iosBundleIdentifier, 'qa'),
      scheme: localScheme(PRODUCTION_IDENTITIES.dream.scheme, 'qa'),
      host: null,
    }),
    development: dreamRow('development', {
      name: localName(PRODUCTION_IDENTITIES.dream.name, 'development'),
      androidApplicationId: localIds(PRODUCTION_IDENTITIES.dream.androidApplicationId, 'dev'),
      iosBundleIdentifier: localIds(PRODUCTION_IDENTITIES.dream.iosBundleIdentifier, 'dev'),
      scheme: localScheme(PRODUCTION_IDENTITIES.dream.scheme, 'dev'),
      host: null,
    }),
  },
  lucid: {
    production: lucidRow('production', {
      host: PRODUCTION_IDENTITIES.lucid.host,
      providers: LUCID_PRODUCTION_PROVIDERS,
    }),
    qa: lucidRow('qa', {
      name: localName(PRODUCTION_IDENTITIES.lucid.name, 'qa'),
      androidApplicationId: localIds(PRODUCTION_IDENTITIES.lucid.androidApplicationId, 'qa'),
      iosBundleIdentifier: localIds(PRODUCTION_IDENTITIES.lucid.iosBundleIdentifier, 'qa'),
      scheme: localScheme(PRODUCTION_IDENTITIES.lucid.scheme, 'qa'),
    }),
    development: lucidRow('development', {
      name: localName(PRODUCTION_IDENTITIES.lucid.name, 'development'),
      androidApplicationId: localIds(PRODUCTION_IDENTITIES.lucid.androidApplicationId, 'dev'),
      iosBundleIdentifier: localIds(PRODUCTION_IDENTITIES.lucid.iosBundleIdentifier, 'dev'),
      scheme: localScheme(PRODUCTION_IDENTITIES.lucid.scheme, 'dev'),
    }),
  },
  meditation: {
    production: meditationRow('production', {
      providers: MEDITATION_PRODUCTION_PROVIDERS,
    }),
    qa: meditationRow('qa', {
      name: localName(PRODUCTION_IDENTITIES.meditation.name, 'qa'),
      androidApplicationId: localIds(PRODUCTION_IDENTITIES.meditation.androidApplicationId, 'qa'),
      iosBundleIdentifier: localIds(PRODUCTION_IDENTITIES.meditation.iosBundleIdentifier, 'qa'),
      scheme: localScheme(PRODUCTION_IDENTITIES.meditation.scheme, 'qa'),
    }),
    development: meditationRow('development', {
      name: localName(PRODUCTION_IDENTITIES.meditation.name, 'development'),
      androidApplicationId: localIds(PRODUCTION_IDENTITIES.meditation.androidApplicationId, 'dev'),
      iosBundleIdentifier: localIds(PRODUCTION_IDENTITIES.meditation.iosBundleIdentifier, 'dev'),
      scheme: localScheme(PRODUCTION_IDENTITIES.meditation.scheme, 'dev'),
    }),
  },
} as const satisfies NoctaliaIdentityMatrix;

export const NOCTALIA_IDENTITY_ROWS: readonly NoctaliaIdentity[] = (
  Object.keys(NOCTALIA_IDENTITY_MATRIX) as AppProduct[]
).flatMap((product) =>
  (Object.keys(NOCTALIA_IDENTITY_MATRIX[product]) as IdentityEnvironment[]).map(
    (environment) => NOCTALIA_IDENTITY_MATRIX[product][environment]
  )
);
