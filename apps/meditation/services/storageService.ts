import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ThemePreference } from '@/constants/theme';

const PREFIX = '@noctalia-med/';

export const StorageKey = {
  profile: `${PREFIX}profile`,
  onboarding: `${PREFIX}onboarding`,
  favorites: `${PREFIX}favorites`,
  progress: `${PREFIX}progress`,
  practiceLog: `${PREFIX}practice-log`,
  streak: `${PREFIX}streak`,
  theme: `${PREFIX}theme`,
  language: `${PREFIX}language`,
  world: `${PREFIX}world`,
  purchasedWorlds: `${PREFIX}purchased-worlds`,
  reminders: `${PREFIX}reminders`,
  playerPrefs: `${PREFIX}player-prefs`,
} as const;

export type StorageKeyName = (typeof StorageKey)[keyof typeof StorageKey];

/** Reads and parses a JSON value. Returns `fallback` on any failure. */
export async function readJson<T>(key: StorageKeyName, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch (error) {
    if (__DEV__) console.warn(`[storage] read failed for ${key}`, error);
    return fallback;
  }
}

export async function writeJson<T>(key: StorageKeyName, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    if (__DEV__) console.warn(`[storage] write failed for ${key}`, error);
  }
}

export async function remove(key: StorageKeyName): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    if (__DEV__) console.warn(`[storage] remove failed for ${key}`, error);
  }
}

const THEME_PREFERENCES: ThemePreference[] = ['light', 'dark', 'auto'];

export async function getThemePreference(): Promise<ThemePreference> {
  const stored = await readJson<ThemePreference>(StorageKey.theme, 'auto');
  return THEME_PREFERENCES.includes(stored) ? stored : 'auto';
}

export async function saveThemePreference(preference: ThemePreference): Promise<void> {
  await writeJson(StorageKey.theme, preference);
}

/** Wipes every key owned by the app. Used by "reset my data" in settings. */
export async function clearAll(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(StorageKey));
}
