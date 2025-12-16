import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useLocales } from 'expo-localization';
import { getLanguagePreference, saveLanguagePreference } from '@/services/storageService';
import { normalizeAppLanguage, resolveEffectiveLanguage } from '@/lib/language';
import type { AppLanguage, LanguagePreference } from '@/lib/types';

const DEFAULT_LOCALE = {
  languageTag: 'en-US',
  regionCode: 'US',
  textDirection: 'ltr' as const,
};

type LocaleMetadata = {
  languageTag: string;
  regionCode: string | null;
  textDirection: 'ltr' | 'rtl';
};

export type LanguageContextValue = {
  /** Current effective language ('en', 'fr', or 'es') */
  language: AppLanguage;
  /** Current system language derived from device settings */
  systemLanguage: AppLanguage;
  /** Snapshot of primary locale metadata reported by the OS */
  locale: LocaleMetadata;
  /** User's language preference ('auto', 'en', 'fr', or 'es') */
  preference: LanguagePreference;
  /** Update the user's language preference */
  setPreference: (preference: LanguagePreference) => Promise<void>;
  /** Whether language preference has been loaded from storage */
  loaded: boolean;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

type LanguageProviderProps = React.PropsWithChildren<{
  initialPreference?: LanguagePreference;
}>;

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children, initialPreference }) => {
  const [preference, setPreferenceState] = useState<LanguagePreference>(initialPreference ?? 'auto');
  const [loaded, setLoaded] = useState(() => initialPreference !== undefined);
  const locales = useLocales();
  const primaryLocale = locales[0];

  // Load language preference from storage on mount
  useEffect(() => {
    if (initialPreference !== undefined) {
      return;
    }

    let mounted = true;

    async function loadPreference() {
      try {
        const savedPreference = await getLanguagePreference();
        if (mounted) {
          setPreferenceState(savedPreference);
          setLoaded(true);
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[LanguageContext] Failed to load language preference:', error);
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
  }, [initialPreference]);

  // Detect system language
  const systemLanguage: AppLanguage = useMemo(
    () => normalizeAppLanguage(primaryLocale?.languageCode),
    [primaryLocale?.languageCode]
  );

  const locale: LocaleMetadata = useMemo(
    () => ({
      languageTag: primaryLocale?.languageTag ?? DEFAULT_LOCALE.languageTag,
      regionCode: primaryLocale?.regionCode ?? DEFAULT_LOCALE.regionCode,
      textDirection: (primaryLocale?.textDirection ?? DEFAULT_LOCALE.textDirection) as 'ltr' | 'rtl',
    }),
    [primaryLocale?.languageTag, primaryLocale?.regionCode, primaryLocale?.textDirection]
  );

  // Calculate effective language based on preference and system
  const language: AppLanguage = useMemo(() => {
    return resolveEffectiveLanguage(preference, systemLanguage);
  }, [preference, systemLanguage]);

  // Update preference and save to storage
  const setPreference = useCallback(async (newPreference: LanguagePreference) => {
    try {
      await saveLanguagePreference(newPreference);
      setPreferenceState(newPreference);
    } catch (error) {
      if (__DEV__) {
        console.error('[LanguageContext] Failed to save language preference:', error);
      }
      throw error;
    }
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      language,
      preference,
      systemLanguage,
      locale,
      setPreference,
      loaded,
    }),
    [language, preference, systemLanguage, locale, setPreference, loaded]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

/**
 * Hook to access language context
 * @returns Current language, preference, and setter
 * @throws Error if used outside LanguageProvider
 */
export const useLanguage = (): LanguageContextValue => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
};
