import type { AppLanguage } from './types';

export function getTranscriptionLocale(language: AppLanguage): string {
  switch (language) {
    case 'fr':
      return 'fr-FR';
    case 'es':
      return 'es-ES';
    default:
      return 'en-US';
  }
}

