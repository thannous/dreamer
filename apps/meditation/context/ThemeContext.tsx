import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Uniwind, useUniwind } from 'uniwind';

import {
  Atmosphere,
  PaperTheme,
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
  const [preference, setPreferenceState] = useState<ThemePreference>('auto');
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
    mode: 'light',
    colors: PaperTheme,
    atmosphere: Atmosphere.light,
    preference: 'auto',
    setPreference: async () => {},
    loaded: false,
  };
};
