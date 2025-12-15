import type { AppLanguage, LanguagePreference } from './types';
import { getTranscriptionLocale } from './locale';

type UpdateLanguagePreferenceParams = {
  preference: LanguagePreference;
  systemLanguage: AppLanguage;
  setPreference: (preference: LanguagePreference) => Promise<void>;
  ensureOfflineModel?: (locale: string) => Promise<unknown>;
  getLocale?: (language: AppLanguage) => string;
};

const resolveEffectiveLanguage = (preference: LanguagePreference, systemLanguage: AppLanguage) =>
  preference === 'auto' ? systemLanguage : preference;

/**
 * Shared logic for applying a language selection.
 * Returns the computed language + locale to make testing and UI flows easier.
 */
export const updateLanguagePreference = async ({
  preference,
  systemLanguage,
  setPreference,
  ensureOfflineModel,
  getLocale = getTranscriptionLocale,
}: UpdateLanguagePreferenceParams) => {
  const effectiveLanguage = resolveEffectiveLanguage(preference, systemLanguage);
  const locale = getLocale(effectiveLanguage);

  ensureOfflineModel?.(locale).catch(() => {
    // Best-effort offline model fetch; ignore failures.
  });

  await setPreference(preference);

  return { effectiveLanguage, locale };
};
