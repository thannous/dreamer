import {
  APP_TRANSCRIPTION_LOCALES,
  getFormattingLocale,
  getTranscriptionLocale,
} from '../locale';
import { SUPPORTED_APP_LANGUAGES } from '../language';

describe('locale mappings', () => {
  it.each([
    ['en', 'en-US'],
    ['fr', 'fr-FR'],
    ['es', 'es-ES'],
    ['de', 'de-DE'],
    ['it', 'it-IT'],
    ['pt', 'pt-BR'],
  ] as const)('maps %s to %s for formatting', (language, tag) => {
    expect(getFormattingLocale(language)).toBe(tag);
    expect(getTranscriptionLocale(language)).toBe(tag);
  });

  it('ships Brazilian Portuguese as the only Portuguese variant', () => {
    expect(getFormattingLocale('pt')).toBe('pt-BR');
    expect(APP_TRANSCRIPTION_LOCALES).toContain('pt-BR');
  });

  it('covers every supported app language', () => {
    for (const language of SUPPORTED_APP_LANGUAGES) {
      expect(getFormattingLocale(language)).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    }
  });

  it('formats numbers and dates with the selected language conventions', () => {
    expect(new Intl.NumberFormat(getFormattingLocale('pt')).format(1234.56)).toBe('1.234,56');
    expect(new Intl.NumberFormat(getFormattingLocale('fr')).format(1234.56)).not.toBe('1,234.56');
  });
});
