import { getLocales } from 'expo-localization';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { translate, type TranslationKey, type TranslationValues } from '@/lib/i18n';
import type { AppLanguage } from '@/lib/types';
import { readJson, StorageKey, writeJson } from '@/services/storageService';

const ALL_LANGUAGES: AppLanguage[] = ['en', 'fr', 'es', 'de', 'it', 'pt'];

const isAppLanguage = (value: unknown): value is AppLanguage =>
  typeof value === 'string' && (ALL_LANGUAGES as string[]).includes(value);

function detectLanguage(): AppLanguage {
  const code = getLocales()[0]?.languageCode;
  return isAppLanguage(code) ? code : 'en';
}

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
  t: (key: TranslationKey, values?: TranslationValues) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>(detectLanguage);

  useEffect(() => {
    let mounted = true;

    readJson<AppLanguage | null>(StorageKey.language, null).then((stored) => {
      if (mounted && isAppLanguage(stored)) setLanguageState(stored);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = useCallback(async (next: AppLanguage) => {
    setLanguageState(next);
    await writeJson(StorageKey.language, next);
  }, []);

  const t = useCallback(
    (key: TranslationKey, values?: TranslationValues) => translate(language, key, values),
    [language]
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

/** Falls back to the device language when used outside the provider. */
export const useTranslation = (): LanguageContextValue => {
  const ctx = useContext(LanguageContext);
  const fallbackLanguage = detectLanguage();

  return (
    ctx ?? {
      language: fallbackLanguage,
      setLanguage: async () => {},
      t: (key, values) => translate(fallbackLanguage, key, values),
    }
  );
};
