import { describe, expect, it } from 'vitest';

import { RITUALS } from '../inspirationRituals';
import { getTranslator } from '../i18n';

describe('Inspiration rituals configuration', () => {
  it('defines three rituals with four steps each', () => {
    expect(RITUALS).toHaveLength(3);

    for (const ritual of RITUALS) {
      expect(ritual.steps).toHaveLength(4);

      const ids = new Set(ritual.steps.map((s) => s.id));
      expect(ids.size).toBe(ritual.steps.length);
    }
  });

  it('has translations for ritual labels and descriptions in supported languages', () => {
    const languages: Array<'en' | 'fr' | 'es'> = ['en', 'fr', 'es'];

    for (const lang of languages) {
      const t = getTranslator(lang);

      for (const ritual of RITUALS) {
        const label = t(ritual.labelKey);
        const description = t(ritual.descriptionKey);

        expect(label).not.toBe(ritual.labelKey);
        expect(description).not.toBe(ritual.descriptionKey);

        for (const step of ritual.steps) {
          const title = t(step.titleKey);
          const body = t(step.bodyKey);

          expect(title).not.toBe(step.titleKey);
          expect(body).not.toBe(step.bodyKey);
        }
      }
    }
  });
});
