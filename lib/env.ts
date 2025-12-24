/**
 * IMPORTANT: Expo injects `EXPO_PUBLIC_*` variables at bundle time when accessed
 * as `process.env.EXPO_PUBLIC_*`. Dynamic access like `process.env[key]` may be
 * undefined in production builds. Keep accesses explicit here.
 */
export type ExpoPublicEnvKey =
  | 'EXPO_PUBLIC_API_URL'
  | 'EXPO_PUBLIC_DEBUG_CHAT'
  | 'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'
  | 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'
  | 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'
  | 'EXPO_PUBLIC_MOCK_MODE'
  | 'EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER'
  | 'EXPO_PUBLIC_REFERENCE_IMAGES_ENABLED'
  | 'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY'
  | 'EXPO_PUBLIC_REVENUECAT_IOS_KEY'
  | 'EXPO_PUBLIC_REVENUECAT_WEB_KEY'
  | 'EXPO_PUBLIC_SUPABASE_ANON_KEY'
  | 'EXPO_PUBLIC_SUPABASE_FUNCTION_JWT'
  | 'EXPO_PUBLIC_SUPABASE_URL';

export function getExpoPublicEnvValue(key: ExpoPublicEnvKey): string | undefined {
  switch (key) {
    case 'EXPO_PUBLIC_API_URL':
      return process.env.EXPO_PUBLIC_API_URL;
    case 'EXPO_PUBLIC_DEBUG_CHAT':
      return process.env.EXPO_PUBLIC_DEBUG_CHAT;
    case 'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID':
      return process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
    case 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID':
      return process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    case 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID':
      return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    case 'EXPO_PUBLIC_MOCK_MODE':
      return process.env.EXPO_PUBLIC_MOCK_MODE;
    case 'EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER':
      return process.env.EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER;
    case 'EXPO_PUBLIC_REFERENCE_IMAGES_ENABLED':
      return process.env.EXPO_PUBLIC_REFERENCE_IMAGES_ENABLED;
    case 'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY':
      return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
    case 'EXPO_PUBLIC_REVENUECAT_IOS_KEY':
      return process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    case 'EXPO_PUBLIC_REVENUECAT_WEB_KEY':
      return process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY;
    case 'EXPO_PUBLIC_SUPABASE_ANON_KEY':
      return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    case 'EXPO_PUBLIC_SUPABASE_FUNCTION_JWT':
      return process.env.EXPO_PUBLIC_SUPABASE_FUNCTION_JWT;
    case 'EXPO_PUBLIC_SUPABASE_URL':
      return process.env.EXPO_PUBLIC_SUPABASE_URL;
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

export function isMockModeEnabled(): boolean {
  return (getExpoPublicEnvValue('EXPO_PUBLIC_MOCK_MODE') ?? '').toLowerCase() === 'true';
}

export function isChatDebugEnabled(): boolean {
  return (getExpoPublicEnvValue('EXPO_PUBLIC_DEBUG_CHAT') ?? '').toLowerCase() === 'true';
}

export function isReferenceImagesEnabled(): boolean {
  const value = getExpoPublicEnvValue('EXPO_PUBLIC_REFERENCE_IMAGES_ENABLED');
  return (value ?? '').toLowerCase() === 'true';
}
