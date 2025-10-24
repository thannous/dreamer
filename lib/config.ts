import Constants from 'expo-constants';

export function getApiBaseUrl(): string {
  // Priority: EXPO_PUBLIC_API_URL env → app.json extra.apiUrl → default localhost
  const envUrl = (process?.env as any)?.EXPO_PUBLIC_API_URL as string | undefined;
  const extraUrl = (Constants?.expoConfig as any)?.extra?.apiUrl as string | undefined;
  const url = envUrl || extraUrl || 'http://localhost:3000';
  return url.replace(/\/$/, '');
}

