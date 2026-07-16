import type { AudioSource } from 'expo-audio';

export type SleepSoundId = 'rain' | 'ocean' | 'brown-noise';
export type SleepTimerMinutes = 15 | 30 | 45;

export type SleepSoundConfig = {
  id: SleepSoundId;
  source: AudioSource;
  icon: 'cloud.rain.fill' | 'water.waves' | 'waveform';
};

export const SLEEP_SOUND_TRACK_SECONDS = 45 * 60;
export const SLEEP_SOUND_TIMER_OPTIONS: SleepTimerMinutes[] = [15, 30, 45];
export const DEFAULT_SLEEP_SOUND_ID: SleepSoundId = 'rain';
export const DEFAULT_SLEEP_TIMER_MINUTES: SleepTimerMinutes = 30;

export const SLEEP_SOUNDS: SleepSoundConfig[] = [
  {
    id: 'rain',
    source: require('@/assets/audio/sleep/rain.m4a'),
    icon: 'cloud.rain.fill',
  },
  {
    id: 'ocean',
    source: require('@/assets/audio/sleep/ocean-waves.m4a'),
    icon: 'water.waves',
  },
  {
    id: 'brown-noise',
    source: require('@/assets/audio/sleep/brown-noise.m4a'),
    icon: 'waveform',
  },
];

export function isSleepSoundId(value: unknown): value is SleepSoundId {
  return SLEEP_SOUNDS.some((sound) => sound.id === value);
}

export function isSleepTimerMinutes(value: unknown): value is SleepTimerMinutes {
  return SLEEP_SOUND_TIMER_OPTIONS.includes(value as SleepTimerMinutes);
}

export function getSleepSoundStartOffset(durationMinutes: SleepTimerMinutes): number {
  return SLEEP_SOUND_TRACK_SECONDS - durationMinutes * 60;
}
