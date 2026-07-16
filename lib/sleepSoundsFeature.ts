import { getExpoPublicEnvValue } from '@/lib/env';

export function isSleepSoundsEnabled(): boolean {
  return (
    getExpoPublicEnvValue('EXPO_PUBLIC_SLEEP_SOUNDS_ENABLED') ?? ''
  ).toLowerCase() === 'true';
}

export function isSleepSoundsAvailable(
  platform: string | undefined = process.env.EXPO_OS,
): boolean {
  return (
    isSleepSoundsEnabled() &&
    (platform === 'android' || platform === 'ios')
  );
}
