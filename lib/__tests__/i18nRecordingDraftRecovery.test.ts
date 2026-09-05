import { beforeAll, describe, expect, it } from '@jest/globals';

import { getTranslator, loadTranslations } from '../i18n';

const LANGUAGES = ['en', 'fr', 'es', 'de', 'it', 'pt'] as const;
const RECOVERY_STATES = ['loading', 'error', 'retry'] as const;
const EXPECTED_COPY = {
  en: {
    loading: 'Restoring your draft…',
    error: 'Your draft could not be restored. Try again before continuing.',
    retry: 'Try again',
  },
  fr: {
    loading: 'Restauration de ton brouillon…',
    error: 'Ton brouillon n’a pas pu être restauré. Réessaie avant de continuer.',
    retry: 'Réessayer',
  },
  es: {
    loading: 'Restaurando tu borrador…',
    error: 'No se ha podido restaurar tu borrador. Inténtalo de nuevo antes de continuar.',
    retry: 'Reintentar',
  },
  de: {
    loading: 'Dein Entwurf wird wiederhergestellt…',
    error: 'Dein Entwurf konnte nicht wiederhergestellt werden. Versuche es erneut, bevor du fortfährst.',
    retry: 'Erneut versuchen',
  },
  it: {
    loading: 'Ripristino della tua bozza…',
    error: 'Non è stato possibile ripristinare la tua bozza. Riprova prima di continuare.',
    retry: 'Riprova',
  },
  pt: {
    loading: 'Restaurando seu rascunho…',
    error: 'Não foi possível restaurar seu rascunho. Tente novamente antes de continuar.',
    retry: 'Tentar novamente',
  },
} as const;

describe('recording draft recovery copy', () => {
  beforeAll(async () => {
    await Promise.all(LANGUAGES.map((language) => loadTranslations(language)));
  });

  it.each(LANGUAGES)(
    'resolves localized recovery messages in %s',
    (language: (typeof LANGUAGES)[number]) => {
      const t = getTranslator(language);

      for (const state of RECOVERY_STATES) {
        expect(t(`recording.draft_restore.${state}`)).toBe(EXPECTED_COPY[language][state]);
      }
    }
  );
});
