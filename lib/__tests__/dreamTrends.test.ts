import { describe, expect, it } from '@jest/globals';

import { buildDreamTrends } from '../dreamTrends';
import type { DreamAnalysis } from '../types';

// Thursday 29 October 2026, evening.
const NOW = new Date(2026, 9, 29, 18, 0, 0).getTime();

const localDay = (year: number, monthIndex: number, day: number, hour = 9): number =>
  new Date(year, monthIndex, day, hour, 0, 0).getTime();

/** `daysAgo` local days before NOW, at the given hour. */
const nightsAgo = (daysAgo: number, hour = 7): number => localDay(2026, 9, 29 - daysAgo, hour);

const analyzed = (id: number, overrides: Partial<DreamAnalysis> = {}): DreamAnalysis => ({
  id,
  transcript: 'I walked through a quiet hallway.',
  title: 'Quiet hallway',
  interpretation: 'A complete reading.',
  shareableQuote: '',
  imageUrl: '',
  chatHistory: [],
  dreamType: 'Symbolic Dream',
  isAnalyzed: true,
  analysisStatus: 'done',
  analyzedAt: id,
  ...overrides,
});

const draft = (id: number, overrides: Partial<DreamAnalysis> = {}): DreamAnalysis => analyzed(id, {
  interpretation: '',
  isAnalyzed: false,
  analyzedAt: undefined,
  ...overrides,
});

const fear = [{ name: 'fear', insight: '' }];
const joy = [{ name: 'joy', insight: '' }];

describe('buildDreamTrends', () => {
  it('reads an empty journal as empty, with no comparison, theme or pattern', () => {
    const trends = buildDreamTrends([], { now: NOW });

    expect(trends.empty).toBe(true);
    expect(trends.period).toBe('30');
    expect(trends.count).toBe(0);
    expect(trends.countDelta).toBeNull();
    expect(trends.activeNightsDelta).toBeNull();
    expect(trends.themes.dominant).toBeNull();
    expect(trends.patterns.ready).toBe(false);
    expect(trends.averagePerWeek).toBeNull();
    expect(trends.lastActivityAt).toBeNull();
    expect(trends.streak).toEqual({ current: 0, longest: 0, dreamedToday: false });
  });

  it('ignores invalid timestamps and dreams dated after now', () => {
    const trends = buildDreamTrends([
      analyzed(Number.NaN),
      analyzed(NOW + 60_000),
      analyzed(nightsAgo(1)),
    ], { now: NOW });

    expect(trends.count).toBe(1);
    expect(trends.lastActivityAt).toBe(nightsAgo(1));
  });

  it('counts the 30 nights ending today and compares them with the 30 before', () => {
    const trends = buildDreamTrends([
      analyzed(nightsAgo(0)),
      analyzed(nightsAgo(0, 8)),
      analyzed(nightsAgo(10)),
      analyzed(nightsAgo(29)),
      // The previous 30 nights: two dreams on one night.
      analyzed(nightsAgo(30)),
      analyzed(nightsAgo(30, 8)),
      // Beyond both periods.
      analyzed(nightsAgo(90)),
    ], { now: NOW, period: '30' });

    expect(trends.range).toEqual({ start: localDay(2026, 8, 30, 0), end: localDay(2026, 9, 29, 0), nights: 30 });
    expect(trends.count).toBe(4);
    expect(trends.countDelta).toBe(2);
    expect(trends.activeNights).toBe(3);
    expect(trends.activeNightsDelta).toBe(2);
  });

  it('withholds the comparison when the previous period holds no dream', () => {
    const trends = buildDreamTrends([analyzed(nightsAgo(2)), analyzed(nightsAgo(40))], { now: NOW, period: '7' });

    expect(trends.count).toBe(1);
    expect(trends.countDelta).toBeNull();
    expect(trends.activeNightsDelta).toBeNull();
    expect(trends.themes.previousCounts).toBeNull();
  });

  it('lays the 30 nights out in whole weeks from Monday, and the 7 nights as they are', () => {
    const month = buildDreamTrends([analyzed(nightsAgo(3))], { now: NOW, period: '30' });
    expect(month.nights.length % 7).toBe(0);
    expect(month.nights[0].weekday).toBe(1);
    expect(month.nights.at(-1)?.weekday).toBe(0);
    expect(month.nights.filter((night) => night.inRange)).toHaveLength(30);
    expect(month.nights.filter((night) => night.isToday).map((night) => night.dateKey)).toEqual(['2026-10-29']);
    // Nights outside the period carry no dream even when the journal has one there.
    expect(month.nights.filter((night) => !night.inRange).every((night) => night.dreams.length === 0)).toBe(true);
    expect(month.months).toEqual([]);

    const week = buildDreamTrends([analyzed(nightsAgo(3))], { now: NOW, period: '7' });
    expect(week.nights.map((night) => night.dateKey)).toEqual([
      '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29',
    ]);
    expect(week.nights.find((night) => night.dateKey === '2026-10-26')?.dreams).toHaveLength(1);
  });

  it('reads the whole journal by month from its first dream, without a previous period', () => {
    const trends = buildDreamTrends([
      analyzed(localDay(2026, 6, 14)),
      analyzed(localDay(2026, 8, 2)),
      analyzed(localDay(2026, 8, 20)),
      analyzed(nightsAgo(1)),
    ], { now: NOW, period: 'all' });

    expect(trends.previous).toBeNull();
    expect(trends.countDelta).toBeNull();
    expect(trends.range.start).toBe(localDay(2026, 6, 14, 0));
    expect(trends.nights).toEqual([]);
    expect(trends.months).toEqual([
      { key: '2026-07', count: 1, current: false },
      { key: '2026-08', count: 0, current: false },
      { key: '2026-09', count: 2, current: false },
      { key: '2026-10', count: 1, current: true },
    ]);
    // 4 dreams over the 108 nights since 14 July.
    expect(trends.averagePerWeek).toBeCloseTo(4 / (108 / 7), 5);
  });

  it('lets a theme lead only with three themed dreams and no tie', () => {
    const lead = (themes: DreamAnalysis['theme'][]) => buildDreamTrends(
      themes.map((theme, index) => analyzed(nightsAgo(index + 1), { theme })),
      { now: NOW },
    ).themes;

    expect(lead(['mystical', 'mystical']).dominant).toBeNull();
    expect(lead(['mystical', 'mystical', 'calm', 'calm']).dominant).toBeNull();
    expect(lead(['mystical', 'mystical', 'calm']).dominant).toBe('mystical');
    // A dream without a theme (a draft) counts in the period, not in the seal.
    const withDraft = buildDreamTrends([
      draft(nightsAgo(1), { theme: undefined }),
      analyzed(nightsAgo(2), { theme: 'noir' }),
    ], { now: NOW });
    expect(withDraft.count).toBe(2);
    expect(withDraft.themes.total).toBe(1);
  });

  it('keeps the previous period’s theme counts for the comparison under the seal', () => {
    const trends = buildDreamTrends([
      analyzed(nightsAgo(1), { theme: 'mystical' }),
      analyzed(nightsAgo(2), { theme: 'mystical' }),
      analyzed(nightsAgo(3), { theme: 'calm' }),
      analyzed(nightsAgo(35), { theme: 'mystical' }),
    ], { now: NOW });

    expect(trends.themes.previousCounts?.mystical).toBe(1);
    expect(trends.themes.counts.mystical - (trends.themes.previousCounts?.mystical ?? 0)).toBe(1);
  });

  it('threads the run that ends yesterday and says today is still open', () => {
    const trends = buildDreamTrends([
      analyzed(nightsAgo(1)),
      analyzed(nightsAgo(2)),
      analyzed(nightsAgo(3)),
      analyzed(nightsAgo(6)),
      analyzed(nightsAgo(7)),
      analyzed(nightsAgo(8)),
      analyzed(nightsAgo(9)),
    ], { now: NOW, period: '7' });

    expect(trends.streak).toEqual({ current: 3, longest: 4, dreamedToday: false });
    expect(trends.nights.filter((night) => night.inStreak).map((night) => night.dateKey)).toEqual([
      '2026-10-26', '2026-10-27', '2026-10-28',
    ]);
  });

  it('treats consecutive local days as a run across the spring-forward change', () => {
    const now = localDay(2026, 2, 30, 12);
    const trends = buildDreamTrends([
      analyzed(localDay(2026, 2, 28, 23)),
      analyzed(localDay(2026, 2, 29, 1)),
      analyzed(localDay(2026, 2, 30, 9)),
    ], { now, period: '7' });

    expect(trends.streak).toEqual({ current: 3, longest: 3, dreamedToday: true });
    expect(trends.activeNights).toBe(3);
    expect(trends.nights).toHaveLength(7);
  });

  it('reads days from an injected calendar rather than the device clock', () => {
    const now = Date.UTC(2026, 9, 29, 23);
    const trends = buildDreamTrends([analyzed(Date.UTC(2026, 9, 29, 22))], {
      now,
      period: '7',
      calendar: {
        localDateKey: (timestamp) => new Date(timestamp).toISOString().slice(0, 10),
        startOfLocalDay: (timestamp) => {
          const date = new Date(timestamp);
          return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
        },
        addLocalDays: (start, days) => start + days * 86_400_000,
        weekday: (timestamp) => new Date(timestamp).getUTCDay(),
      },
    });

    expect(trends.nights.at(-1)).toMatchObject({ dateKey: '2026-10-29', isToday: true });
    expect(trends.nights.at(-1)?.dreams).toHaveLength(1);
  });

  it('names the richest weekday only from four dreams and a clear winner', () => {
    // 29 Oct 2026 is a Thursday: 1, 8 and 15 nights ago are Wednesdays.
    const wednesdays = [1, 8, 15].map((days) => analyzed(nightsAgo(days)));
    expect(buildDreamTrends(wednesdays, { now: NOW }).richestWeekday).toBeNull();
    expect(buildDreamTrends([...wednesdays, analyzed(nightsAgo(2))], { now: NOW }).richestWeekday).toBe(3);
    expect(buildDreamTrends([
      analyzed(nightsAgo(1)), analyzed(nightsAgo(8)), analyzed(nightsAgo(2)), analyzed(nightsAgo(9)),
    ], { now: NOW }).richestWeekday).toBeNull();
  });

  it('paces the 30 nights per week over the part the journal covers, from a full week', () => {
    const young = buildDreamTrends([analyzed(nightsAgo(2)), analyzed(nightsAgo(1))], { now: NOW });
    expect(young.averagePerWeek).toBeNull();

    const settled = buildDreamTrends([
      analyzed(nightsAgo(13)), analyzed(nightsAgo(6)), analyzed(nightsAgo(1)),
    ], { now: NOW });
    expect(settled.averagePerWeek).toBeCloseTo(3 / 2, 5);
  });

  it('says what returns only from three analyzed dreams, with shares of those dreams', () => {
    const early = buildDreamTrends([
      analyzed(nightsAgo(1), { emotions: fear }),
      analyzed(nightsAgo(2), { emotions: fear }),
      draft(nightsAgo(3), { emotions: fear }),
    ], { now: NOW });
    expect(early.patterns).toMatchObject({ analyzed: 2, unanalyzed: 1, ready: false, emotions: [], types: [] });

    const ready = buildDreamTrends([
      // The same family twice in one dream counts once.
      analyzed(nightsAgo(1), { emotions: [{ name: 'fear', insight: '' }, { name: 'afraid', insight: '' }], dreamType: 'Nightmare' }),
      analyzed(nightsAgo(2), { emotions: fear, dreamType: 'Nightmare' }),
      analyzed(nightsAgo(3), { emotions: joy, dreamType: 'Unknown' }),
      analyzed(nightsAgo(4), { emotions: fear, dreamType: 'Lucid Dream' }),
      draft(nightsAgo(5), { emotions: joy, dreamType: 'Nightmare' }),
    ], { now: NOW });
    expect(ready.patterns.ready).toBe(true);
    expect(ready.patterns.analyzed).toBe(4);
    // Joy appears in one analyzed dream only: not a pattern.
    expect(ready.patterns.emotions).toEqual([{ family: 'fear', count: 3, share: 3 / 4, trend: null }]);
    // Unknown is not a type, and the draft does not count.
    expect(ready.patterns.types).toEqual([
      { value: 'Nightmare', count: 2 },
      { value: 'Lucid Dream', count: 1 },
    ]);
  });

  it('compares an emotion’s share with the previous period once it had three analyzed dreams', () => {
    const current = [1, 2, 3, 4].map((days) => analyzed(nightsAgo(days), { emotions: fear }));
    const previous = [31, 32, 33, 34].map((days, index) => analyzed(nightsAgo(days), { emotions: index === 0 ? fear : joy }));

    const rising = buildDreamTrends([...current, ...previous], { now: NOW });
    expect(rising.patterns.emotions[0]).toMatchObject({ family: 'fear', share: 1, trend: 'up' });

    const steady = buildDreamTrends([
      ...current,
      ...[31, 32, 33].map((days) => analyzed(nightsAgo(days), { emotions: fear })),
    ], { now: NOW });
    expect(steady.patterns.emotions[0].trend).toBe('same');

    const unknown = buildDreamTrends([...current, analyzed(nightsAgo(31), { emotions: fear })], { now: NOW });
    expect(unknown.patterns.emotions[0].trend).toBeNull();
  });
});
