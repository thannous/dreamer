import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, LightTheme, type ThemeColors } from '@/constants/journalTheme';
import { getThemePreference, saveThemePreference } from '@/services/storageService';
import type { ThemePreference, ThemeMode } from '@/lib/types';

export type ThemeContextValue = {
  /** Current theme colors (DarkTheme or LightTheme) */
  colors: ThemeColors;
  /** Current effective theme mode ('light' or 'dark') */
  mode: ThemeMode;
  /** Current system-derived theme mode */
  systemMode: ThemeMode;
  /** User's theme preference ('light', 'dark', or 'auto') */
  preference: ThemePreference;
  /** Update the user's theme preference */
  setPreference: (preference: ThemePreference) => Promise<void>;
  /** Whether theme has been loaded from storage */
  loaded: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('auto');
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

  // Calculate effective theme mode based on preference and system
  const mode: ThemeMode = useMemo(() => {
    if (preference === 'auto') {
      // Follow system preference
      return systemMode;
    }
    return preference;
  }, [preference, systemMode]);

  // Select theme colors based on mode
  const colors = useMemo(() => {
    return mode === 'dark' ? DarkTheme : LightTheme;
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
      mode,
      systemMode,
      preference,
      setPreference,
      loaded,
    }),
    [colors, mode, systemMode, preference, setPreference, loaded]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

/**
 * Hook to access theme context
 * @returns Current theme colors, mode, preference, and setter
 * @throws Error if used outside ThemeProvider
 */
export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
};
