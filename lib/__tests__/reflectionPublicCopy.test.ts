import { describe, expect, it } from '@jest/globals';

import de from '@/lib/i18n/de';
import en from '@/lib/i18n/en';
import es from '@/lib/i18n/es';
import fr from '@/lib/i18n/fr';
import italian from '@/lib/i18n/it';
import pt from '@/lib/i18n/pt';

import {
  getDreamDetailAction,
  getJournalDetailPrimaryFamily,
  getReflectionJourney,
} from '../dreamUsage';
import type { DreamAnalysis } from '../types';

const packs = { de, en, es, fr, it: italian, pt } as const;
type Language = keyof typeof packs;

const publicPostAnalysisKeys = [
  'home.today.optional_deepen.body',
  'home.today.rest.body',
  'inspiration.reading.next_explore',
  'inspiration.lastDream.subtitle',
  'inspiration.lastDream.chat_cta',
  'journal.filter.explored',
  'journal.filter.accessibility.explored',
  'journal.filter_sheet.status.explored',
  'journal.atlas.filter.to_explore',
  'journal.atlas.action.explore',
  'journal.badge.explored',
  'journal.detail.explore_button.new',
  'journal.detail.explore_button.continue',
  'journal.detail.action.explore.title',
  'journal.detail.action.continue.title',
  'journal.detail.zone.reflection',
  'stats.profile.metric.explored',
  'stats.profile.next_action.explore_more.cta',
  'stats.profile.readiness.living.body',
  'stats.insight.explore.body',
  'stats.insight.explore.cta',
  'stats.insight.metric.exploration',
  'stats.insight.steady.body',
  'stats.share.message',
  'weekly_recap.next.explore_title',
  'weekly_recap.next.explore_cta',
  'weekly_recap.next.all_done_body',
  'dream_categories.explore_title',
  'dream_categories.subtitle',
  'dream_categories.exploration360.eyebrow',
  'dream_categories.exploration360.progress',
  'dream_categories.exploration360.step.done',
  'dream_chat.exploration_limit.title',
  'dream_chat.exploration_limit.message_guest',
  'dream_chat.exploration_limit.message_free',
  'dream_chat.initial_greeting',
  'recording.quota.exploration_label',
  'recording.analysis_limit.feature_explorations',
  'settings.quota.exploration_label',
] as const;

const exploreLike = /(?<!\{)explor|erkund|erforsch|esplor/i;
const reflectionLike: Record<Language, RegExp> = {
  en: /reflect|deepen/i,
  fr: /r[ée]flex|approfond/i,
  es: /reflex|profund/i,
  de: /reflex|vertief/i,
  it: /rifless|approfond/i,
  pt: /reflex|aprofund/i,
};

const buildDream = (overrides: Partial<DreamAnalysis> = {}): DreamAnalysis => ({
  id: 21,
  title: 'Saved dream',
  transcript: 'A quiet city.',
  interpretation: 'A first reading.',
  shareableQuote: '',
  imageUrl: 'https://example.com/image.jpg',
  dreamType: 'Symbolic Dream',
  chatHistory: [],
  isAnalyzed: true,
  analysisStatus: 'done',
  analyzedAt: 1_700_000_000_000,
  ...overrides,
});

const analyzedDream = buildDream();

describe('public reflection copy', () => {
  it('keeps Analyze this dream as the first public action in every language', () => {
    const expected = {
      en: 'Analyze this dream',
      fr: 'Analyser ce rêve',
      es: 'Analizar este sueño',
      de: 'Diesen Traum analysieren',
      it: 'Analizza questo sogno',
      pt: 'Analisar este sonho',
    } as const;

    for (const [language, translations] of Object.entries(packs) as [Language, (typeof packs)[Language]][]) {
      expect(translations['journal.detail.analyze_button.default']).toBe(expected[language]);
      expect(translations['journal.detail.zone.reading']).toMatch(/Noctalia|Analyse|Análisis|Analisi|Análise/i);
    }
  });

  it('replaces public Explorer/Exploration copy with reflection or deepen on Dreamer surfaces', () => {
    for (const [language, translations] of Object.entries(packs) as [Language, (typeof packs)[Language]][]) {
      for (const key of publicPostAnalysisKeys) {
        const value = translations[key];
        expect({ language, key, value }).toEqual({
          language,
          key,
          value: expect.any(String),
        });
        expect(value.toLowerCase()).not.toMatch(exploreLike);
      }

      expect(translations['dream_categories.exploration360.eyebrow']).toMatch(reflectionLike[language]);
      expect(translations['stats.insight.metric.exploration']).toMatch(reflectionLike[language]);
      expect(translations['journal.detail.zone.reflection']).toMatch(reflectionLike[language]);
    }
  });

  it('keeps internal explore ids while exposing Approfondir then Conversation', () => {
    const start = getReflectionJourney(analyzedDream);
    expect(start.stage).toBe('approfondir');
    expect(start.primary.kind).toBe('start_approfondir');
    expect(getJournalDetailPrimaryFamily(start.primary.kind)).toBe('explore');
    expect(getDreamDetailAction(analyzedDream)).toBe('explore');

    const continued = buildDream({
      explorationStartedAt: 1_700_000_000_100,
      chatHistory: [
        { id: 'u1', role: 'user', text: 'symbols', meta: { category: 'symbols' } },
        { id: 'm1', role: 'model', text: 'A symbols reading.' },
      ],
    });
    const next = getReflectionJourney(continued);
    expect(next.stage).toBe('approfondir');
    expect(next.primary.kind).toBe('continue_axis');
    expect(getJournalDetailPrimaryFamily(next.primary.kind)).toBe('continue');

    const conversation = buildDream({
      explorationStartedAt: 1_700_000_000_200,
      chatHistory: [
        { id: 'u1', role: 'user', text: 'symbols', meta: { category: 'symbols' } },
        { id: 'm1', role: 'model', text: 'A symbols reading.' },
        { id: 'u2', role: 'user', text: 'emotions', meta: { category: 'emotions' } },
        { id: 'm2', role: 'model', text: 'An emotions reading.' },
        { id: 'u3', role: 'user', text: 'growth', meta: { category: 'growth' } },
        { id: 'm3', role: 'model', text: 'A growth reading.' },
        { id: 'syn-u', role: 'user', text: 'Synthesis', meta: { exploration360Synthesis: true } },
        { id: 'syn-m', role: 'model', text: 'Final synthesis' },
      ],
    });
    const open = getReflectionJourney(conversation);
    expect(open.stage).toBe('conversation');
    expect(open.primary.kind).toBe('continue_chat');
    expect(getJournalDetailPrimaryFamily(open.primary.kind)).toBe('continue');
  });
});
