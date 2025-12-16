import type { AppLanguage } from '@/lib/types';

import en from './i18n/en';

export type Translations = Record<string, string>;

const DEFAULT_LANGUAGE: AppLanguage = 'en';
const SUPPORTED_LANGUAGES: readonly AppLanguage[] = ['en', 'fr', 'es'] as const;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type PlaceholderPatterns = {
  doubleBracePattern: RegExp;
  singleBracePattern: RegExp;
};

const placeholderPatternCache = new Map<string, PlaceholderPatterns>();

function getPlaceholderPatterns(key: string): PlaceholderPatterns {
  const cached = placeholderPatternCache.get(key);
  if (cached) {
    return cached;
  }

  const escapedKey = escapeRegex(key);
  const patterns = {
    doubleBracePattern: new RegExp(`\\{\\{\\s*${escapedKey}\\s*\\}\\}`, 'g'),
    singleBracePattern: new RegExp(`\\{${escapedKey}\\}`, 'g'),
  };
  placeholderPatternCache.set(key, patterns);
  return patterns;
}

const loadedTranslations: Partial<Record<AppLanguage, Translations>> = {
  en,
};

const loadingPromises = new Map<AppLanguage, Promise<Translations>>();

const resolveLanguage = (lang?: string): AppLanguage => {
  if (!lang) {
    return DEFAULT_LANGUAGE;
  }

  const normalized = lang.toLowerCase();
  if (SUPPORTED_LANGUAGES.includes(normalized as AppLanguage)) {
    return normalized as AppLanguage;
  }

  const base = normalized.split(/[-_]/)[0];
  if (SUPPORTED_LANGUAGES.includes(base as AppLanguage)) {
    return base as AppLanguage;
  }

  return DEFAULT_LANGUAGE;
};

async function importLanguagePack(language: AppLanguage): Promise<Translations> {
  switch (language) {
    case 'en':
      return en;
    case 'fr':
      return (await import('./i18n/fr')).default;
    case 'es':
      return (await import('./i18n/es')).default;
    default:
      return en;
  }
}

export async function loadTranslations(lang?: string): Promise<Translations> {
  const language = resolveLanguage(lang);
  const existing = loadedTranslations[language];
  if (existing) {
    return existing;
  }

  const pending = loadingPromises.get(language);
  if (pending) {
    return pending;
  }

  const promise = importLanguagePack(language)
    .then((pack) => {
      loadedTranslations[language] = pack;
      loadingPromises.delete(language);
      return pack;
    })
    .catch((error) => {
      loadingPromises.delete(language);
      if (__DEV__) {
        console.warn('[i18n] failed to load translations, falling back to en', { language, error });
      }
      return loadedTranslations[DEFAULT_LANGUAGE] ?? en;
    });

  loadingPromises.set(language, promise);
  return promise;
}

export const getTranslator = (lang?: string) => {
  const language = resolveLanguage(lang);
  const fallbackTranslations = loadedTranslations[DEFAULT_LANGUAGE] ?? en;

  if (language !== DEFAULT_LANGUAGE && !loadedTranslations[language]) {
    void loadTranslations(language);
  }

  return (key: string, replacements?: Record<string, string | number>): string => {
    const languageTranslations = loadedTranslations[language] ?? fallbackTranslations;
    let s = languageTranslations[key] ?? fallbackTranslations[key] ?? key;

    if (replacements) {
      for (const [k, value] of Object.entries(replacements)) {
        const replacement = String(value);
        const { doubleBracePattern, singleBracePattern } = getPlaceholderPatterns(k);
        s = s.replace(doubleBracePattern, replacement).replace(singleBracePattern, replacement);
      }
    }

    return s;
  };
};

