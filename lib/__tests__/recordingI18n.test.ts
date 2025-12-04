import { describe, expect, it } from 'vitest';

import { getTranslator } from '../i18n';

const languages: ('en' | 'fr' | 'es')[] = ['en', 'fr', 'es'];

const firstDreamSheetKeys = [
  'guest.first_dream.sheet.title',
  'guest.first_dream.sheet.subtitle',
  'guest.first_dream.sheet.analyze',
  'guest.first_dream.sheet.journal',
  'guest.first_dream.sheet.dismiss',
] as const;

const analyzePromptSheetKeys = [
  'recording.analyze_prompt.sheet.title',
  'recording.analyze_prompt.sheet.subtitle',
  'recording.analyze_prompt.sheet.analyze',
  'recording.analyze_prompt.sheet.journal',
  'recording.analyze_prompt.sheet.dismiss',
] as const;

describe('Recording i18n - bottom sheets', () => {
  it('has translations for first-dream sheet in all supported languages', () => {
    for (const lang of languages) {
      const t = getTranslator(lang);

      for (const key of firstDreamSheetKeys) {
        const value = t(key);
        expect(value).not.toBe(key);
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it('has translations for analyze-prompt sheet in all supported languages', () => {
    for (const lang of languages) {
      const t = getTranslator(lang);

      for (const key of analyzePromptSheetKeys) {
        const value = t(key);
        expect(value).not.toBe(key);
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });
});
