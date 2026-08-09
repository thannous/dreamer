import { describe, expect, it } from '@jest/globals';

import { EMOTION_FAMILY_IDS } from '@/lib/dreamEmotions';

import { getTranslator, loadTranslations } from '../i18n';

const languages = ['en', 'fr', 'es', 'de', 'it'] as const;

const recurrencePatternByLanguage = {
  en: /repeat|recurr|coming back/i,
  fr: /revien|r[ée]p[èe]t|r[ée]curr/i,
  es: /repit|repet|recurr/i,
  de: /wiederkehr|wiederhol/i,
  it: /torn|ripet|ricorr/i,
} as const;

const familyPatternByLanguage = {
  en: /famil/i,
  fr: /famill/i,
  es: /famil/i,
  de: /famil/i,
  it: /famigli/i,
} as const;

// Declared `readonly string[]` rather than `as const` because the family keys are DERIVED
// from EMOTION_FAMILY_IDS. Hand-listing them would let a renamed family quietly leave a dead
// key behind in all five packs.
const statsScreenKeys: readonly string[] = [
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
  ...EMOTION_FAMILY_IDS.map((id) => `stats.emotion.family.${id}`),
  'stats.section.dreams_by_day',
  'stats.section.emotion_families',
  'stats.section.emotion_families.subtitle',
  'stats.section.theme_timeline',
  'stats.section.theme_timeline.subtitle',
  'stats.not_enough.title',
  'stats.locked.cta',
  'stats.emotions.not_enough.body',
  'stats.emotions.not_enough.body_one',
  'stats.emotions.locked.count',
  'stats.emotions.locked.count_one',
  'stats.emotions.locked.body',
  'stats.theme_timeline.not_enough.dreams',
  'stats.theme_timeline.not_enough.dreams_one',
  'stats.theme_timeline.not_enough.days',
  'stats.theme_timeline.not_enough.days_one',
  'stats.theme_timeline.locked.count',
  'stats.theme_timeline.locked.count_one',
  'stats.theme_timeline.locked.body',
  'stats.theme_timeline.a11y_range',
  // S3's legend is the first stats-screen consumer of the ungloss dream.theme.* copy; Top
  // Themes keeps the glossed stats.theme.* strings above.
  'dream.theme.surreal',
  'dream.theme.mystical',
  'dream.theme.calm',
  'dream.theme.noir',
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
  ['stats.emotions.not_enough.body_one', 'stats.emotions.not_enough.body'],
  ['stats.emotions.locked.count_one', 'stats.emotions.locked.count'],
  ['stats.theme_timeline.not_enough.dreams_one', 'stats.theme_timeline.not_enough.dreams'],
  ['stats.theme_timeline.not_enough.days_one', 'stats.theme_timeline.not_enough.days'],
  ['stats.theme_timeline.locked.count_one', 'stats.theme_timeline.locked.count'],
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

  it('describes detected emotion families without promising recurrence', async () => {
    await Promise.all(languages.map((language) => loadTranslations(language)));

    const honestCopyKeys = [
      'stats.section.emotion_families.subtitle',
      'stats.emotions.locked.count',
      'stats.emotions.locked.count_one',
    ];

    for (const language of languages) {
      const t = getTranslator(language);
      const recurrencePattern = recurrencePatternByLanguage[language];

      for (const key of honestCopyKeys) {
        expect({ language, key, value: t(key, { count: 4 }) }).toEqual({
          language,
          key,
          value: expect.not.stringMatching(recurrencePattern),
        });
      }

      expect(t('stats.emotions.locked.count_one', { count: 1 })).toMatch(
        familyPatternByLanguage[language],
      );
      expect(t('stats.emotions.locked.count', { count: 4 })).toMatch(
        familyPatternByLanguage[language],
      );
    }
  });

  it('leaves no placeholder uninterpolated in multi-parameter stats strings', async () => {
    // `countedPairs` only ever supplies `{ count }`, so it under-checks every key that takes
    // a second parameter. Revert this kills: a translator writing '{jours}' instead of
    // '{days}' in fr — invisible to every other assertion in the repo.
    await Promise.all(languages.map((language) => loadTranslations(language)));

    for (const language of languages) {
      const t = getTranslator(language);

      for (const key of ['stats.theme_timeline.locked.count', 'stats.theme_timeline.locked.count_one']) {
        const label = t(key, { count: 3, days: 20 });

        expect(label).toContain('3');
        expect(label).toContain('20');
        expect(label).not.toMatch(/\{[a-z_]+\}/);
      }

      const range = t('stats.theme_timeline.a11y_range', { from: 'A', to: 'B' });

      expect(range).toContain('A');
      expect(range).toContain('B');
      expect(range).not.toMatch(/\{[a-z_]+\}/);
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
