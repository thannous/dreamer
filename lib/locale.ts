import { SUPPORTED_APP_LANGUAGES } from './language';
import type { AppLanguage } from './types';

export function getTranscriptionLocale(language: AppLanguage): string {
  switch (language) {
    case 'fr':
      return 'fr-FR';
    case 'es':
      return 'es-ES';
    case 'de':
      return 'de-DE';
    case 'it':
      return 'it-IT';
    default:
      return 'en-US';
  }
}

/**
 * Transcription locales for every language the app ships. Used to offer an
 * offline alternative when the user's own language has no local speech model.
 */
export const APP_TRANSCRIPTION_LOCALES: readonly string[] =
  SUPPORTED_APP_LANGUAGES.map(getTranscriptionLocale);

