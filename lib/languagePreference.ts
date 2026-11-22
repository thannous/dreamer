import type { AppLanguage, LanguagePreference } from './types';
import { resolveEffectiveLanguage } from './language';
import { getTranscriptionLocale } from './locale';

type UpdateLanguagePreferenceParams = {
  preference: LanguagePreference;
  systemLanguage: AppLanguage;
  setPreference: (preference: LanguagePreference) => Promise<void>;
  ensureOfflineModel?: (locale: string) => Promise<unknown>;
  onOfflineModelPendingChange?: (pending: boolean) => void;
};

export const updateLanguagePreference = async ({
  preference,
  systemLanguage,
  setPreference,
  ensureOfflineModel,
  onOfflineModelPendingChange,
}: UpdateLanguagePreferenceParams) => {
  const effectiveLanguage = resolveEffectiveLanguage(preference, systemLanguage);
  const locale = getTranscriptionLocale(effectiveLanguage);

  if (ensureOfflineModel) {
    onOfflineModelPendingChange?.(true);
    void Promise.resolve().then(() => ensureOfflineModel(locale)).catch(() => {
      // Best-effort offline model fetch; ignore failures.
    }).finally(() => onOfflineModelPendingChange?.(false));
  }

  await setPreference(preference);

  return { effectiveLanguage, locale };
};
