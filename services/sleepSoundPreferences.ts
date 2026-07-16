import Storage from 'expo-sqlite/kv-store';

import {
  DEFAULT_SLEEP_SOUND_ID,
  DEFAULT_SLEEP_TIMER_MINUTES,
  isSleepSoundId,
  isSleepTimerMinutes,
  type SleepSoundId,
  type SleepTimerMinutes,
} from '@/lib/sleepSounds';

const SLEEP_SOUND_PREFERENCES_KEY = 'noctalia_sleep_sound_preferences_v1';

export type SleepSoundPreferences = {
  soundId: SleepSoundId;
  durationMinutes: SleepTimerMinutes;
};

export const DEFAULT_SLEEP_SOUND_PREFERENCES: SleepSoundPreferences = {
  soundId: DEFAULT_SLEEP_SOUND_ID,
  durationMinutes: DEFAULT_SLEEP_TIMER_MINUTES,
};

export async function getSleepSoundPreferences(): Promise<SleepSoundPreferences> {
  try {
    const raw = await Storage.getItem(SLEEP_SOUND_PREFERENCES_KEY);
    if (!raw) return DEFAULT_SLEEP_SOUND_PREFERENCES;

    const value = JSON.parse(raw) as Partial<SleepSoundPreferences>;
    return {
      soundId: isSleepSoundId(value.soundId)
        ? value.soundId
        : DEFAULT_SLEEP_SOUND_PREFERENCES.soundId,
      durationMinutes: isSleepTimerMinutes(value.durationMinutes)
        ? value.durationMinutes
        : DEFAULT_SLEEP_SOUND_PREFERENCES.durationMinutes,
    };
  } catch (error) {
    if (__DEV__) {
      console.warn('[SleepSounds] Failed to read preferences', error);
    }
    return DEFAULT_SLEEP_SOUND_PREFERENCES;
  }
}

export async function saveSleepSoundPreferences(
  preferences: SleepSoundPreferences,
): Promise<void> {
  try {
    await Storage.setItem(SLEEP_SOUND_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch (error) {
    if (__DEV__) {
      console.warn('[SleepSounds] Failed to save preferences', error);
    }
  }
}
