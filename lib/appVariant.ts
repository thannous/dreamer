import Constants from 'expo-constants';

export type AppVariant = 'noctalia' | 'lucid-trainer';

export interface AppVariantResolution {
  variant: AppVariant;
  configVariant: AppVariant;
  environmentVariant: AppVariant;
  mismatch: boolean;
}

export interface ResolveAppVariantInput {
  expoProduct: unknown;
  publicVariant: unknown;
  isDev: boolean;
}

function normalizeExpoProduct(value: unknown): AppVariant {
  if (value === undefined || value === null || value === '' || value === 'noctalia') {
    return 'noctalia';
  }
  if (value === 'lucid-trainer') return 'lucid-trainer';
  throw new Error(`[AppVariant] Unsupported expoConfig.extra.product: ${String(value)}`);
}

function normalizePublicVariant(value: unknown): AppVariant {
  if (value === undefined || value === null || value === '' || value === 'noctalia') {
    return 'noctalia';
  }
  if (value === 'lucid' || value === 'lucid-trainer') return 'lucid-trainer';
  throw new Error(`[AppVariant] Unsupported EXPO_PUBLIC_APP_VARIANT: ${String(value)}`);
}

function hasExplicitPublicVariant(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

export function resolveAppVariant(input: ResolveAppVariantInput): AppVariantResolution {
  const configVariant = normalizeExpoProduct(input.expoProduct);
  const environmentVariant = normalizePublicVariant(input.publicVariant);
  const mismatch = configVariant !== environmentVariant;

  if (mismatch && !input.isDev) {
    throw new Error(
      `[AppVariant] Production variant mismatch: expoConfig.extra.product resolves to ` +
        `${configVariant}, EXPO_PUBLIC_APP_VARIANT resolves to ${environmentVariant}`
    );
  }

  return {
    variant:
      input.isDev && mismatch && hasExplicitPublicVariant(input.publicVariant)
        ? environmentVariant
        : configVariant,
    configVariant,
    environmentVariant,
    mismatch,
  };
}

const runtimeIsDev =
  typeof __DEV__ === 'boolean' ? __DEV__ : process.env.NODE_ENV !== 'production';

export const appVariantResolution = resolveAppVariant({
  expoProduct: Constants.expoConfig?.extra?.product,
  publicVariant: process.env.EXPO_PUBLIC_APP_VARIANT,
  isDev: runtimeIsDev,
});

export const appVariant = appVariantResolution.variant;
export const appVariantMismatch = appVariantResolution.mismatch;
export const isLucidTrainer = appVariant === 'lucid-trainer';

if (runtimeIsDev && appVariantMismatch) {
  console.warn(
    `[AppVariant] QA mismatch allowed: expoConfig=${appVariantResolution.configVariant}, ` +
      `environment=${appVariantResolution.environmentVariant}; using ${appVariant}`
  );
}
