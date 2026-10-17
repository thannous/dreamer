import { describe, expect, it } from '@jest/globals';

import { getTranslator, loadTranslations } from '../i18n';

const languages = ['en', 'fr', 'es', 'de', 'it', 'pt'] as const;

const TRENDS_PREFIX = 'trends.';

// Counted strings whose singular form must not read as the plural.
const countedPairs = [
  ['trends.nights.summary_one', 'trends.nights.summary'],
  ['trends.seal.medal_one', 'trends.seal.medal'],
  ['trends.returns.basis_one', 'trends.returns.basis'],
  ['trends.nights.month_one', 'trends.nights.month'],
] as const;

const placeholders = (value: string) => (value.match(/\{[a-z]+\}/g) ?? []).sort();

async function loadAllLanguages() {
  const packs = await Promise.all(
    languages.map(async (language) => [language, await loadTranslations(language)] as const),
  );

  return Object.fromEntries(packs) as Record<(typeof languages)[number], Awaited<ReturnType<typeof loadTranslations>>>;
}

function trendsKeysFrom(pack: Record<string, string>): string[] {
  return Object.keys(pack)
    .filter((key) => key.startsWith(TRENDS_PREFIX))
    .sort();
}

describe('trends i18n', () => {
  it('defines every English trends key in supported languages, with the same placeholders', async () => {
    const packs = await loadAllLanguages();
    const trendsKeys = trendsKeysFrom(packs.en);

    for (const language of languages) {
      const pack = packs[language];
      const t = getTranslator(language);
      // No language keeps a key the screen no longer reads.
      expect(trendsKeysFrom(pack)).toEqual(trendsKeys);

      for (const key of trendsKeys) {
        expect({ language, key, value: pack[key] }).toEqual({
          language,
          key,
          value: expect.any(String),
        });
        expect(pack[key]).not.toBe(key);
        expect(pack[key].trim()).not.toBe('');
        expect(t(key)).not.toBe(key);
        // A missing placeholder would print a raw count or theme on screen.
        expect({ language, key, placeholders: placeholders(pack[key]) })
          .toEqual({ language, key, placeholders: placeholders(packs.en[key]) });
        expect(pack[key]).not.toContain('—');
      }
    }
  });

  it('keeps a distinct singular form for counted trends strings', async () => {
    await Promise.all(languages.map((language) => loadTranslations(language)));

    for (const language of languages) {
      const t = getTranslator(language);

      for (const [singularKey, pluralKey] of countedPairs) {
        const params = (count: number) => ({ count, total: 30, theme: 'X', month: 'M', date: 'D' });
        expect(t(singularKey, params(1))).toContain('1');
        expect(t(pluralKey, params(2))).toContain('2');
        expect(t(singularKey, params(1))).not.toBe(t(pluralKey, params(1)));
      }
    }
  });
});
