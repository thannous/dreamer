import type { AppLanguage, LanguagePreference } from './types';
import { getTranscriptionLocale } from './locale';

type UpdateLanguagePreferenceParams = {
  preference: LanguagePreference;
  systemLanguage: AppLanguage;
  setPreference: (preference: LanguagePreference) => Promise<void>;
  ensureOfflineModel?: (locale: string) => Promise<unknown>;
  onOfflineModelPendingChange?: (pending: boolean) => void;
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
  onOfflineModelPendingChange,
  getLocale = getTranscriptionLocale,
}: UpdateLanguagePreferenceParams) => {
  const effectiveLanguage = resolveEffectiveLanguage(preference, systemLanguage);
  const locale = getLocale(effectiveLanguage);

  if (ensureOfflineModel) {
    onOfflineModelPendingChange?.(true);
    void Promise.resolve().then(() => ensureOfflineModel(locale)).catch(() => {
      // Best-effort offline model fetch; ignore failures.
    }).finally(() => onOfflineModelPendingChange?.(false));
  }

  await setPreference(preference);

  return { effectiveLanguage, locale };
};
