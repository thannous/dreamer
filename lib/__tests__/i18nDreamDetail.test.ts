import de from '@/lib/i18n/de';
import en from '@/lib/i18n/en';
import es from '@/lib/i18n/es';
import fr from '@/lib/i18n/fr';
import italian from '@/lib/i18n/it';

const dreamImageProgressKeys = [
  'journal.detail.image.preparing_title',
  'journal.detail.image.preparing_subtitle',
  'journal.detail.image.generating_title',
  'journal.detail.image.queued_subtitle',
  'journal.detail.image.running_subtitle',
] as const;

describe('dream detail i18n', () => {
  it('has localized image generation progress labels in every supported language', () => {
    const packs = { de, en, es, fr, it: italian };

    for (const translations of Object.values(packs)) {
      for (const key of dreamImageProgressKeys) {
        expect(translations[key]).toEqual(expect.any(String));
        expect(translations[key]).not.toBe(key);
        expect(translations[key].trim()).not.toBe('');
      }
    }
  });
});
