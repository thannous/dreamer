import { describe, expect, it } from 'vitest';

import { getTranslator } from '@/lib/i18n';

const languages: ('en' | 'fr' | 'es')[] = ['en', 'fr', 'es'];

const badgeKeys = [
  'journal.badge.favorite',
  'journal.badge.analyzed',
  'journal.badge.explored',
] as const;

const filterAccessibilityKeys = [
  'journal.filter.accessibility.analyzed',
  'journal.filter.accessibility.explored',
] as const;

describe('Journal i18n - badges & filter accessibility', () => {
  it('has translations for badge labels in all supported languages', () => {
    for (const lang of languages) {
      const t = getTranslator(lang);

      for (const key of badgeKeys) {
        const value = t(key);
        expect(value).not.toBe(key);
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it('has translations for analyzed/explored filter accessibility labels', () => {
    for (const lang of languages) {
      const t = getTranslator(lang);

      for (const key of filterAccessibilityKeys) {
        const value = t(key);
        expect(value).not.toBe(key);
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });
});
