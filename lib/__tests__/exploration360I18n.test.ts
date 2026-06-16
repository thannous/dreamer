import { describe, expect, it } from '@jest/globals';

import { getTranslator, loadTranslations } from '../i18n';

const languages = ['en', 'fr', 'es', 'de', 'it'] as const;

const exploration360Keys = [
  'dream_categories.exploration360.eyebrow',
  'dream_categories.exploration360.title',
  'dream_categories.exploration360.body.incomplete',
  'dream_categories.exploration360.body.ready',
  'dream_categories.exploration360.body.done',
  'dream_categories.exploration360.progress',
  'dream_categories.exploration360.step.done',
  'dream_categories.exploration360.step.next',
  'dream_categories.exploration360.synthesis.cta',
  'dream_categories.exploration360.synthesis.done',
  'dream_chat.prompt.synthesis_360',
  'dream_chat.exploration360.synthesis.display',
] as const;

describe('exploration 360 i18n', () => {
  it('defines every guided synthesis key in supported languages', async () => {
    await Promise.all(languages.map((language) => loadTranslations(language)));

    for (const language of languages) {
      const t = getTranslator(language);

      for (const key of exploration360Keys) {
        expect(t(key)).not.toBe(key);
        expect(t(key).trim()).not.toBe('');
      }
    }
  });
});
