export type SleepSoundId = 'rain' | 'ocean' | 'brown-noise';
export type SleepTimerMinutes = 15 | 30 | 45;

export type SleepSoundConfig = {
  id: SleepSoundId;
  // Published by the marketing site (docs-src/static/audio/sleep). The app
  // downloads each loop on first play instead of shipping ~4.7 MB of audio.
  remoteUrl: string;
  icon: 'cloud.rain.fill' | 'water.waves' | 'waveform';
};

export const SLEEP_SOUND_LOOP_SECONDS = 5 * 60;
export const SLEEP_SOUND_TIMER_OPTIONS: SleepTimerMinutes[] = [15, 30, 45];
export const DEFAULT_SLEEP_SOUND_ID: SleepSoundId = 'rain';
export const DEFAULT_SLEEP_TIMER_MINUTES: SleepTimerMinutes = 30;

const SLEEP_SOUND_BASE_URL = 'https://noctalia.app/audio/sleep';

export const SLEEP_SOUNDS: SleepSoundConfig[] = [
  {
    id: 'rain',
    remoteUrl: `${SLEEP_SOUND_BASE_URL}/rain.m4a`,
    icon: 'cloud.rain.fill',
  },
  {
    id: 'ocean',
    remoteUrl: `${SLEEP_SOUND_BASE_URL}/ocean-waves.m4a`,
    icon: 'water.waves',
  },
  {
    id: 'brown-noise',
    remoteUrl: `${SLEEP_SOUND_BASE_URL}/brown-noise.m4a`,
    icon: 'waveform',
  },
];

export function isSleepSoundId(value: unknown): value is SleepSoundId {
  return SLEEP_SOUNDS.some((sound) => sound.id === value);
}

export function isSleepTimerMinutes(value: unknown): value is SleepTimerMinutes {
  return SLEEP_SOUND_TIMER_OPTIONS.includes(value as SleepTimerMinutes);
}
