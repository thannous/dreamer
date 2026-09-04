export const APP_PRODUCTS = ['dream', 'lucid', 'meditation'] as const;
export type AppProduct = (typeof APP_PRODUCTS)[number];

export const IDENTITY_ENVIRONMENTS = ['production', 'qa', 'development'] as const;
export type IdentityEnvironment = (typeof IDENTITY_ENVIRONMENTS)[number];

/** Binding evidence only. Never encode client secrets, API keys, or store credentials. */
export const PROVIDER_BINDING_STATUSES = [
  'provisioned',
  'unprovisioned',
  'unknown',
] as const;
export type ProviderBindingStatus = (typeof PROVIDER_BINDING_STATUSES)[number];

export type StoreProviderBindings = Readonly<{
  google: Readonly<{
    android: ProviderBindingStatus;
    ios: ProviderBindingStatus;
    web: ProviderBindingStatus;
  }>;
  revenueCat: Readonly<{
    android: ProviderBindingStatus;
    ios: ProviderBindingStatus;
    web: ProviderBindingStatus;
  }>;
  playIntegrity: Readonly<{
    android: ProviderBindingStatus;
  }>;
}>;

export type OtaIdentity =
  | Readonly<{
      enabled: true;
      reference: 'production';
      updatesUrl: string;
    }>
  | Readonly<{
      enabled: false;
    }>;

export type NoctaliaIdentity = Readonly<{
  product: AppProduct;
  environment: IdentityEnvironment;
  name: string;
  slug: string;
  androidApplicationId: string;
  iosBundleIdentifier: string;
  scheme: string;
  host: string | null;
  easProjectId: string;
  ota: OtaIdentity;
  providers: StoreProviderBindings;
}>;

export type NoctaliaIdentityMatrix = Readonly<{
  [Product in AppProduct]: Readonly<{
    [Environment in IdentityEnvironment]: NoctaliaIdentity;
  }>;
}>;

export type IdentityValidationCode =
  | 'duplicate-android-id'
  | 'duplicate-ios-id'
  | 'duplicate-scheme'
  | 'missing-row'
  | 'non-production-has-production-host'
  | 'non-production-ota-enabled'
  | 'production-constant-mismatch'
  | 'row-key-mismatch';

export type IdentityValidationIssue = Readonly<{
  code: IdentityValidationCode;
  message: string;
}>;

export type IdentityValidationResult =
  | Readonly<{
      ok: true;
      issues: readonly [];
    }>
  | Readonly<{
      ok: false;
      issues: readonly IdentityValidationIssue[];
    }>;
