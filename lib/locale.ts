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

