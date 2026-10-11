import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ScopedTheme, Uniwind, useUniwind } from 'uniwind';

import {
  Atmosphere,
  DEFAULT_THEME_PREFERENCE,
  NightTheme,
  Themes,
  type ThemeColors,
  type ThemeMode,
  type ThemePreference,
} from '@/constants/theme';
import { getThemePreference, saveThemePreference } from '@/services/storageService';

type Atmospherics = (typeof Atmosphere)[ThemeMode];

export type ThemeContextValue = {
  mode: ThemeMode;
  colors: ThemeColors;
  atmosphere: Atmospherics;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => Promise<void>;
  loaded: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Uniwind resolves `system` itself and reports the RESOLVED theme back through
 * `useUniwind()`, so `auto` is handed straight to the library — no manual
 * Appearance listener, unlike the NativeWind build.
 */
const applyTheme = (preference: ThemePreference) => {
  Uniwind.setTheme(preference === 'auto' ? 'system' : preference);
};

export const ThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { theme } = useUniwind();
  const [preference, setPreferenceState] = useState<ThemePreference>(DEFAULT_THEME_PREFERENCE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    getThemePreference()
      .then((stored) => {
        if (!mounted) return;
        applyTheme(stored);
        setPreferenceState(stored);
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const setPreference = useCallback(async (next: ThemePreference) => {
    applyTheme(next);
    setPreferenceState(next);
    await saveThemePreference(next);
  }, []);

  const mode: ThemeMode = theme === 'dark' ? 'dark' : 'light';

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors: Themes[mode],
      atmosphere: Atmosphere[mode],
      preference,
      setPreference,
      loaded,
    }),
    [mode, preference, setPreference, loaded]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;

  return {
    mode: 'dark',
    colors: NightTheme,
    atmosphere: Atmosphere.dark,
    preference: DEFAULT_THEME_PREFERENCE,
    setPreference: async () => {},
    loaded: false,
  };
};

/** A surface's CSS colours, native props and atmosphere must share one palette. */
export function ThemeScope({
  mode,
  children,
}: React.PropsWithChildren<{ mode: ThemeMode }>) {
  const inherited = useTheme();
  const value = useMemo<ThemeContextValue>(
    () => ({ ...inherited, mode, colors: Themes[mode], atmosphere: Atmosphere[mode] }),
    [inherited, mode]
  );

  return (
    <ThemeContext.Provider value={value}>
      <ScopedTheme theme={mode}>{children}</ScopedTheme>
    </ThemeContext.Provider>
  );
}
