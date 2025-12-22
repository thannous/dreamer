export type ExpoPublicEnv = Record<string, string>;

export function getExpoPublicEnv(): ExpoPublicEnv {
  return ((process?.env ?? {}) as ExpoPublicEnv);
}

export function getExpoPublicEnvValue(key: string): string | undefined {
  const env = process?.env as ExpoPublicEnv | undefined;
  const value = env?.[key];
  return typeof value === 'string' ? value : undefined;
}

export function isMockModeEnabled(): boolean {
  return (getExpoPublicEnvValue('EXPO_PUBLIC_MOCK_MODE') ?? '').toLowerCase() === 'true';
}

export function isReferenceImagesEnabled(): boolean {
  const value = getExpoPublicEnvValue('EXPO_PUBLIC_REFERENCE_IMAGES_ENABLED');
  if (!value) {
    return true;
  }
  return value.toLowerCase() === 'true';
}
