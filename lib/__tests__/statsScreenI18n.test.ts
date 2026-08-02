import { describe, expect, it } from '@jest/globals';

import { getTranslator, loadTranslations } from '../i18n';

const languages = ['en', 'fr', 'es', 'de', 'it'] as const;

const statsScreenKeys = [
  'stats.empty.title',
  'stats.empty.body',
  'stats.loading',
  'stats.header.period',
  'stats.header.share',
  'stats.period.title',
  'stats.period.all',
  'stats.period.week',
  'stats.period.month',
  'stats.period.year',
  'stats.period.indicator',
  'stats.period.reset',
  'stats.period.empty.title',
  'stats.period.empty.body',
  'stats.share.title',
  'stats.share.message',
  'stats.share.error',
  'stats.legend.count',
  'stats.legend.count_one',
  'stats.engagement.messages',
  'stats.engagement.messages_one',
  'stats.engagement.most_discussed',
  'stats.engagement.most_discussed.open',
  'stats.theme.surreal',
  'stats.theme.mystical',
  'stats.theme.calm',
  'stats.theme.noir',
  'dream.type.lucid',
  'dream.type.recurring',
  'dream.type.nightmare',
  'dream.type.symbolic',
  'dream.type.unknown',
] as const;

// Selection is manual at the call site (`count === 1 ? _one : base`), mirroring the
// existing stats.card.day / stats.card.days handling. The base key is the plural.
const countedPairs = [
  ['stats.legend.count_one', 'stats.legend.count'],
  ['stats.engagement.messages_one', 'stats.engagement.messages'],
] as const;

describe('stats screen i18n', () => {
  it('defines every stats screen key in supported languages', async () => {
    await Promise.all(languages.map((language) => loadTranslations(language)));

    for (const language of languages) {
      const t = getTranslator(language);

      for (const key of statsScreenKeys) {
        expect(t(key)).not.toBe(key);
        expect(t(key).trim()).not.toBe('');
      }
    }
  });

  it('keeps a distinct singular form for counted stats strings', async () => {
    await Promise.all(languages.map((language) => loadTranslations(language)));

    for (const language of languages) {
      const t = getTranslator(language);

      for (const [singularKey, pluralKey] of countedPairs) {
        // Both forms must interpolate the count, and they must not be the same
        // string — otherwise "1 rêves" survives the fix unnoticed.
        expect(t(singularKey, { count: 1 })).toContain('1');
        expect(t(pluralKey, { count: 4 })).toContain('4');
        expect(t(singularKey, { count: 1 })).not.toBe(t(pluralKey, { count: 1 }));
      }
    }
  });

  it('interpolates the active period into the period indicator', async () => {
    await Promise.all(languages.map((language) => loadTranslations(language)));

    for (const language of languages) {
      const t = getTranslator(language);
      const label = t('stats.period.indicator', { period: t('stats.period.week') });

      expect(label).toContain(t('stats.period.week'));
      expect(label).not.toContain('{period}');
    }
  });
});
