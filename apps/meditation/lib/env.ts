/**
 * `EXPO_PUBLIC_*` values are inlined at bundle time ONLY when read statically.
 * Dynamic access (`process.env[key]`) silently breaks in release builds, so
 * every read goes through the switch below.
 *
 * Everything here ships to the client: never put a secret in an EXPO_PUBLIC_ var.
 */
export type ExpoPublicEnvKey =
  | 'EXPO_PUBLIC_MOCK_MODE'
  | 'EXPO_PUBLIC_ACCOUNTS_ENABLED'
  | 'EXPO_PUBLIC_MEDIA_BASE_URL'
  | 'EXPO_PUBLIC_REVENUECAT_IOS_KEY'
  | 'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY';

export function getExpoPublicEnvValue(key: ExpoPublicEnvKey): string | undefined {
  switch (key) {
    case 'EXPO_PUBLIC_MOCK_MODE':
      return process.env.EXPO_PUBLIC_MOCK_MODE;
    case 'EXPO_PUBLIC_ACCOUNTS_ENABLED':
      return process.env.EXPO_PUBLIC_ACCOUNTS_ENABLED;
    case 'EXPO_PUBLIC_MEDIA_BASE_URL':
      return process.env.EXPO_PUBLIC_MEDIA_BASE_URL;
    case 'EXPO_PUBLIC_REVENUECAT_IOS_KEY':
      return process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    case 'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY':
      return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
    default:
      return undefined;
  }
}

const isTrue = (value: string | undefined): boolean => value === 'true' || value === '1';

export const isMockModeEnabled = (): boolean =>
  isTrue(getExpoPublicEnvValue('EXPO_PUBLIC_MOCK_MODE'));

/**
 * Accounts are OFF for v1.0 store builds: the auth screens exist but must stay
 * unreachable. Never ship a sign-in button that does nothing (App Store 2.1).
 */
export const areAccountsEnabled = (): boolean =>
  isTrue(getExpoPublicEnvValue('EXPO_PUBLIC_ACCOUNTS_ENABLED'));

export const getMediaBaseUrl = (): string | undefined =>
  getExpoPublicEnvValue('EXPO_PUBLIC_MEDIA_BASE_URL');
