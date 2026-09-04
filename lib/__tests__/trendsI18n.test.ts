import { describe, expect, it } from '@jest/globals';

import { getTranslator, loadTranslations } from '../i18n';

const languages = ['en', 'fr', 'es', 'de', 'it', 'pt'] as const;

const TRENDS_PREFIX = 'trends.';
const EXPECTED_TRENDS_KEY_COUNT = 41;

const evolutionNextKeys = [
  'trends.evolution.next.capture_first',
  'trends.evolution.next.capture_this_week',
  'trends.evolution.next.keep_rhythm',
  'trends.evolution.next.wait_for_patterns',
  'trends.evolution.next.review_patterns',
] as const;

const ctaKeys = [
  'trends.cta.capture_first',
  'trends.cta.capture_this_week',
  'trends.cta.keep_rhythm',
  'trends.cta.wait_for_patterns',
  'trends.cta.review_patterns',
] as const;


const countedPairs = [
  ['trends.week.active_days.value_one', 'trends.week.active_days.value'],
  ['trends.patterns.recurrence_one', 'trends.patterns.recurrence'],
] as const;

const placeholdersOf = (value: string): string[] =>
  [...value.matchAll(/\{\{?\s*([a-zA-Z_]+)\s*\}?\}/g)].map((match) => match[1]).sort();

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
  it('defines every English trends key in supported languages without falling back to the key', async () => {
    const packs = await loadAllLanguages();
    const trendsKeys = trendsKeysFrom(packs.en);

    expect(trendsKeys).toHaveLength(EXPECTED_TRENDS_KEY_COUNT);
    expect(evolutionNextKeys).toHaveLength(5);
    expect(ctaKeys).toHaveLength(5);

    for (const key of evolutionNextKeys) {
      expect(trendsKeys).toContain(key);
    }

    for (const key of ctaKeys) {
      expect(trendsKeys).toContain(key);
    }

    for (const language of languages) {
      const pack = packs[language];
      const t = getTranslator(language);

      for (const key of trendsKeys) {
        expect({ language, key, value: pack[key] }).toEqual({
          language,
          key,
          value: expect.any(String),
        });
        expect(pack[key]).not.toBe(key);
        expect(pack[key].trim()).not.toBe('');
        expect(t(key)).not.toBe(key);
        expect(t(key).trim()).not.toBe('');
      }
    }
  });

  it('keeps trends placeholders identical to English for every key', async () => {
    const packs = await loadAllLanguages();
    const trendsKeys = trendsKeysFrom(packs.en);

    expect(trendsKeys).toHaveLength(EXPECTED_TRENDS_KEY_COUNT);

    for (const language of languages) {
      for (const key of trendsKeys) {
        expect({
          language,
          key,
          placeholders: placeholdersOf(packs[language][key] ?? ''),
        }).toEqual({
          language,
          key,
          placeholders: placeholdersOf(packs.en[key]),
        });
      }
    }
  });

  it('keeps a distinct singular form for counted trends strings', async () => {
    await Promise.all(languages.map((language) => loadTranslations(language)));

    for (const language of languages) {
      const t = getTranslator(language);

      for (const [singularKey, pluralKey] of countedPairs) {
        expect(t(singularKey, { count: 1 })).toContain('1');
        expect(t(pluralKey, { count: 0 })).toContain('0');
        expect(t(pluralKey, { count: 2 })).toContain('2');
        expect(t(singularKey, { count: 1 })).not.toBe(t(pluralKey, { count: 1 }));
        expect(t(pluralKey, { count: 0 })).not.toBe(t(singularKey, { count: 0 }));
      }
    }
  });
});
