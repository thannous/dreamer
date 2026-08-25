import type { ThemeMode } from '@/lib/types';

export type ThemeAmbience = 'morning' | 'light' | 'afterglow' | 'dark';

export function isThemeAmbience(value: unknown): value is ThemeAmbience {
  return value === 'morning' || value === 'light' || value === 'afterglow' || value === 'dark';
}

/**
 * Local civil-time ambience. It is deterministic offline and deliberately
 * avoids location access: no sunrise API or location permission is required.
 */
export function resolveThemeAmbience(value: Date = new Date()): ThemeAmbience {
  const hour = value.getHours();

  if (hour >= 5 && hour < 9) return 'morning';
  if (hour >= 9 && hour < 17) return 'light';
  if (hour >= 17 && hour < 21) return 'afterglow';
  return 'dark';
}

export function getThemeModeForAmbience(ambience: ThemeAmbience): ThemeMode {
  return ambience === 'morning' || ambience === 'light' ? 'light' : 'dark';
}
