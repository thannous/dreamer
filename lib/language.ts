import type { AppLanguage, LanguagePreference } from './types';

export const SUPPORTED_APP_LANGUAGES: readonly AppLanguage[] = ['en', 'fr', 'es'] as const;

export function normalizeAppLanguage(code?: string | null): AppLanguage {
  if (code && SUPPORTED_APP_LANGUAGES.includes(code as AppLanguage)) {
    return code as AppLanguage;
  }

  return 'en';
}

export function resolveEffectiveLanguage(preference: LanguagePreference, systemLanguage: AppLanguage): AppLanguage {
  return preference === 'auto' ? systemLanguage : (preference as AppLanguage);
}

