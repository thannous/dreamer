import { describe, expect, it } from '@jest/globals';

import { getTranslator, loadTranslations } from '../i18n';

const languages = ['en', 'fr', 'es', 'de', 'it'] as const;

const statsProfileKeys = [
  'stats.profile.eyebrow',
  'stats.profile.title',
  'stats.profile.readiness.empty.label',
  'stats.profile.readiness.empty.body',
  'stats.profile.readiness.seeded.label',
  'stats.profile.readiness.seeded.body',
  'stats.profile.readiness.forming.label',
  'stats.profile.readiness.forming.body',
  'stats.profile.readiness.living.label',
  'stats.profile.readiness.living.body',
  'stats.profile.metric.anchor',
  'stats.profile.metric.remembered',
  'stats.profile.metric.recurring',
  'stats.profile.metric.explored',
  'stats.profile.signal.type',
  'stats.profile.signal.theme',
  'stats.profile.signal.fragment',
  'stats.profile.signal.period',
  'stats.profile.signal.none',
  'stats.profile.plus_preview.title',
  'stats.profile.plus_preview.body',
  'stats.profile.plus_preview.locked_value',
  'stats.profile.plus_preview.cta',
  'stats.profile.fragment.place',
  'stats.profile.fragment.person',
  'stats.profile.fragment.sensation',
  'stats.profile.fragment.image',
  'stats.profile.fragment.fear',
  'stats.profile.fragment.color',
  'stats.profile.fragment.other',
  'stats.profile.period.childhood',
  'stats.profile.period.teen_years',
  'stats.profile.period.years_ago',
  'stats.profile.period.months_ago',
  'stats.profile.period.recent',
  'stats.profile.period.unknown',
  'stats.profile.next_action.add_anchor.cta',
  'stats.profile.next_action.capture_more.cta',
  'stats.profile.next_action.analyze_unanalyzed.cta',
  'stats.profile.next_action.explore_more.cta',
  'stats.profile.next_action.review_patterns.cta',
] as const;

describe('stats profile i18n', () => {
  it('defines every living profile key in supported languages', async () => {
    await Promise.all(languages.map((language) => loadTranslations(language)));

    for (const language of languages) {
      const t = getTranslator(language);

      for (const key of statsProfileKeys) {
        expect(t(key)).not.toBe(key);
        expect(t(key).trim()).not.toBe('');
      }
    }
  });
});
