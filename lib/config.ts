import Constants from 'expo-constants';

interface ExpoConfig {
  extra?: {
    apiUrl?: string;
  };
}

export function getApiBaseUrl(): string {
  // Priority: EXPO_PUBLIC_API_URL env → app.json extra.apiUrl → default localhost
  // Keep the direct access: Expo inlines it into the native Release bundle.
  const envUrl = process.env.EXPO_PUBLIC_API_URL;

  const config = Constants?.expoConfig as ExpoConfig | undefined;
  const extraUrl = config?.extra?.apiUrl;

  const url = envUrl || extraUrl || 'http://localhost:3000';
  return url.replace(/\/$/, '');
}

