import { SUPPORTED_APP_LANGUAGES } from './language';
import type { AppLanguage } from './types';

/** BCP 47 tag used for each language the app ships. */
const APP_LANGUAGE_TAGS: Record<AppLanguage, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
  // Brazilian Portuguese: the only Portuguese variant the app ships.
  pt: 'pt-BR',
};

export function getTranscriptionLocale(language: AppLanguage): string {
  return APP_LANGUAGE_TAGS[language];
}

/**
 * Locale used to format dates, times and numbers. Formatting follows the
 * language selected in the app, not the device locale.
 */
export function getFormattingLocale(language: AppLanguage): string {
  return APP_LANGUAGE_TAGS[language];
}

/**
 * Transcription locales for every language the app ships. Used to offer an
 * offline alternative when the user's own language has no local speech model.
 */
export const APP_TRANSCRIPTION_LOCALES: readonly string[] =
  SUPPORTED_APP_LANGUAGES.map(getTranscriptionLocale);

