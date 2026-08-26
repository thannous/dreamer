import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Uniwind } from 'uniwind';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  AfterglowTheme,
  DarkTheme,
  LightTheme,
  MorningTheme,
  Shadows,
  type ThemeColors,
} from '@/constants/journalTheme';
import { getThemePreference, saveThemePreference } from '@/services/storageService';
import {
  getThemeModeForAmbience,
  resolveThemeAmbience,
  type ThemeAmbience,
} from '@/lib/themeAmbience';
import type { ThemePreference, ThemeMode } from '@/lib/types';

export type ThemeContextValue = {
  /** Current theme colors (DarkTheme or LightTheme) */
  colors: ThemeColors;
  /** Current theme shadows (dark or light) */
  shadows: typeof Shadows.dark | typeof Shadows.light;
  /** Current effective theme mode ('light' or 'dark') */
  mode: ThemeMode;
  /** Current visual ambience, including the two time-aware palettes. */
  ambience: ThemeAmbience;
  /** Current system-derived theme mode */
  systemMode: ThemeMode;
  /** User's theme preference ('dynamic', 'light', 'dark', or 'auto') */
  preference: ThemePreference;
  /** Update the user's theme preference */
  setPreference: (preference: ThemePreference) => Promise<void>;
  /** Whether theme has been loaded from storage */
  loaded: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const defaultThemeContextValue: ThemeContextValue = {
  colors: LightTheme,
  shadows: Shadows.light,
  mode: 'light',
  ambience: 'light',
  systemMode: 'light',
  preference: 'dynamic',
  setPreference: async () => {
    // No-op fallback to keep hooks functional when the provider is missing.
    if (__DEV__) {
      console.warn('[ThemeContext] setPreference called without a ThemeProvider in the tree.');
    }
  },
  loaded: false,
};

let hasWarnedMissingThemeProvider = false;

export const ThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('dynamic');
  const [localTime, setLocalTime] = useState(() => new Date());
  const [loaded, setLoaded] = useState(false);
  const systemMode: ThemeMode = systemColorScheme === 'dark' ? 'dark' : 'light';

  // Load theme preference from storage on mount
  useEffect(() => {
    let mounted = true;

    async function loadPreference() {
      try {
        const savedPreference = await getThemePreference();
        if (mounted) {
          setPreferenceState(savedPreference);
          setLoaded(true);
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[ThemeContext] Failed to load theme preference:', error);
        }
        if (mounted) {
          setLoaded(true);
        }
      }
    }

    loadPreference();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setLocalTime(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const ambience = useMemo<ThemeAmbience>(() => {
    if (preference === 'dynamic') return resolveThemeAmbience(localTime);
    if (preference === 'auto') return systemMode;
    return preference;
  }, [localTime, preference, systemMode]);

  // Calculate effective theme mode based on preference and system
  const mode: ThemeMode = useMemo(() => {
    return getThemeModeForAmbience(ambience);
  }, [ambience]);

  // Keep Uniwind and StyleSheet consumers on the same four-theme contract.
  // `system` remains available as an explicit legacy-compatible preference.
  useEffect(() => {
    Uniwind.setTheme(preference === 'auto' ? 'system' : ambience);
  }, [ambience, preference]);

  // Select the complete app palette. Features may retain their own brand
  // vocabulary while reading `colors.ambience` for morning/afterglow variants.
  const colors = useMemo(() => {
    if (ambience === 'morning') return MorningTheme;
    if (ambience === 'afterglow') return AfterglowTheme;
    return ambience === 'dark' ? DarkTheme : LightTheme;
  }, [ambience]);

  // Select theme shadows based on mode
  const shadows = useMemo(() => {
    return mode === 'dark' ? Shadows.dark : Shadows.light;
  }, [mode]);

  // Update preference and save to storage
  const setPreference = useCallback(async (newPreference: ThemePreference) => {
    try {
      await saveThemePreference(newPreference);
      setPreferenceState(newPreference);
    } catch (error) {
      if (__DEV__) {
        console.error('[ThemeContext] Failed to save theme preference:', error);
      }
      throw error;
    }
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      colors,
      shadows,
      mode,
      ambience,
      systemMode,
      preference,
      setPreference,
      loaded,
    }),
    [colors, shadows, mode, ambience, systemMode, preference, setPreference, loaded]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

/**
 * Hook to access theme context
 * @returns Current theme colors, shadows, mode, preference, and setter
 * Falls back to a light theme snapshot if the provider is missing.
 */
export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  useEffect(() => {
    if (__DEV__ && !ctx && !hasWarnedMissingThemeProvider) {
      console.warn('[ThemeContext] useTheme called outside of ThemeProvider. Falling back to defaults.');
      hasWarnedMissingThemeProvider = true;
    }
  }, [ctx]);

  if (!ctx) {
    return defaultThemeContextValue;
  }
  return ctx;
};

/**
 * Keeps a fixed-artwork subtree on one audited palette without changing the
 * user's saved theme preference or the rest of the application chrome.
 */
export function ThemeModeScope({
  children,
  mode,
}: React.PropsWithChildren<{ mode: ThemeMode }>) {
  const parent = useTheme();
  const value = useMemo<ThemeContextValue>(
    () => ({
      ...parent,
      colors: mode === 'dark' ? DarkTheme : LightTheme,
      shadows: mode === 'dark' ? Shadows.dark : Shadows.light,
      mode,
      ambience: mode,
    }),
    [mode, parent]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Development previews and fixed-artwork audits can scope one ambience without persisting it. */
export function ThemeAmbienceScope({
  ambience,
  children,
}: React.PropsWithChildren<{ ambience: ThemeAmbience }>) {
  const parent = useTheme();
  const mode = getThemeModeForAmbience(ambience);

  useEffect(() => {
    Uniwind.setTheme(ambience);
    return () => {
      Uniwind.setTheme(parent.preference === 'auto' ? 'system' : parent.ambience);
    };
  }, [ambience, parent.ambience, parent.preference]);

  const value = useMemo<ThemeContextValue>(() => {
    const colors = ambience === 'morning'
      ? MorningTheme
      : ambience === 'afterglow'
        ? AfterglowTheme
        : ambience === 'dark'
          ? DarkTheme
          : LightTheme;

    return {
      ...parent,
      ambience,
      colors,
      mode,
      shadows: mode === 'dark' ? Shadows.dark : Shadows.light,
    };
  }, [ambience, mode, parent]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
