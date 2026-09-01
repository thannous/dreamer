import { describe, expect, it } from '@jest/globals';

import { buildDreamTrends, getLocalDateKey } from '../dreamTrends';
import type { DreamAnalysis, DreamTheme, DreamType } from '../types';

const NOW = new Date(2026, 7, 29, 18, 0, 0).getTime();

const analyzed = (
  id: number,
  overrides: Partial<DreamAnalysis> = {},
): DreamAnalysis => ({
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

const localDateKey = (timestamp: number): string => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const localDay = (year: number, monthIndex: number, day: number, hour = 9): number =>
  new Date(year, monthIndex, day, hour, 0, 0).getTime();

function expectExactlyThreeKeys(value: object) {
  expect(Object.keys(value).sort()).toEqual(['evolution', 'patterns', 'week']);
}

describe('buildDreamTrends', () => {
  it('returns exactly week, patterns and evolution with an empty journal', () => {
    const trends = buildDreamTrends([], { now: NOW });

    expectExactlyThreeKeys(trends);
    expect(trends.week).toEqual({
      count: 0,
      activeDays: 0,
      rhythm: [
        { weekday: 1, count: 0 },
        { weekday: 2, count: 0 },
        { weekday: 3, count: 0 },
        { weekday: 4, count: 0 },
        { weekday: 5, count: 0 },
        { weekday: 6, count: 0 },
        { weekday: 0, count: 0 },
      ],
      lastActivityAt: null,
      streak: { current: 0, longest: 0 },
      averagePerWeek: null,
    });
    expect(trends.patterns.empty).toBe(true);
    expect(trends.patterns.themes).toEqual([]);
    expect(trends.patterns.emotions).toEqual([]);
    expect(trends.patterns.types).toEqual([]);
    expect(trends.patterns.recurrence).toEqual({ count: 0, hasRecurrence: false });
    expect(trends.evolution.themePoints).toEqual([]);
    expect(trends.evolution.days).toEqual([]);
    expect(trends.evolution.nextAction).toBe('capture_first');
    expect(JSON.stringify(trends)).not.toMatch(/chat|message|mostDiscussed|analyzedCount|engagement/i);
  });

  it('keeps a single valid dream honest and withholds a weekly average', () => {
    const id = localDay(2026, 7, 29);
    const trends = buildDreamTrends(
      [
        analyzed(id, {
          theme: 'calm',
          emotions: [{ name: 'fear', insight: '' }],
        }),
      ],
      { now: NOW },
    );

    expectExactlyThreeKeys(trends);
    expect(trends.week.count).toBe(1);
    expect(trends.week.activeDays).toBe(1);
    expect(trends.week.lastActivityAt).toBe(id);
    expect(trends.week.averagePerWeek).toBeNull();
    expect(trends.week.streak).toEqual({ current: 1, longest: 1 });
    expect(trends.patterns.empty).toBe(true);
    expect(trends.patterns.emotions).toEqual([]);
    expect(trends.evolution.nextAction).toBe('wait_for_patterns');
  });

  it('ignores invalid timestamps and future ids', () => {
    const valid = localDay(2026, 7, 28);
    const trends = buildDreamTrends(
      [
        analyzed(Number.NaN as unknown as number),
        analyzed(Number.POSITIVE_INFINITY),
        analyzed(NOW + 60_000, { theme: 'noir' }),
        analyzed(valid, { theme: 'calm' }),
      ],
      { now: NOW },
    );

    expect(trends.week.count).toBe(1);
    expect(trends.week.lastActivityAt).toBe(valid);
    expect(trends.patterns.themes).toEqual([{ value: 'calm', count: 1 }]);
    expect(Number.isFinite(trends.week.count)).toBe(true);
    expect(trends.week.averagePerWeek).toBeNull();
  });

  it('counts local week days and DST-safe rhythm without 24h arithmetic', () => {
    const now = localDay(2026, 2, 29, 12);
    const saturdayBefore = localDay(2026, 2, 28, 23);
    const sundayAfter = localDay(2026, 2, 29, 1);
    const monday = localDay(2026, 2, 23, 8);

    const trends = buildDreamTrends(
      [
        analyzed(saturdayBefore, { theme: 'noir' }),
        analyzed(sundayAfter, { theme: 'calm' }),
        analyzed(monday, { theme: 'calm' }),
      ],
      { now },
    );

    expect(trends.week.count).toBe(3);
    expect(trends.week.activeDays).toBe(3);
    expect(trends.week.rhythm.find((day) => day.weekday === 6)?.count).toBe(1);
    expect(trends.week.rhythm.find((day) => day.weekday === 0)?.count).toBe(1);
    expect(trends.week.rhythm.find((day) => day.weekday === 1)?.count).toBe(1);
    expect(getLocalDateKey(saturdayBefore)).toBe('2026-03-28');
    expect(getLocalDateKey(sundayAfter)).toBe('2026-03-29');
  });

  it('treats consecutive local days as a streak across the DST spring-forward', () => {
    const now = localDay(2026, 2, 30, 12);
    const trends = buildDreamTrends(
      [
        analyzed(localDay(2026, 2, 28, 23), { theme: 'noir' }),
        analyzed(localDay(2026, 2, 29, 1), { theme: 'calm' }),
        analyzed(localDay(2026, 2, 30, 9), { theme: 'calm' }),
      ],
      { now },
    );

    expect(trends.week.streak).toEqual({ current: 3, longest: 3 });
    expect(trends.week.activeDays).toBe(3);
  });

  it('splits current and longest streaks after a broken local day', () => {
    const now = localDay(2026, 7, 29, 12);
    const trends = buildDreamTrends(
      [
        analyzed(localDay(2026, 7, 29), { theme: 'calm' }),
        analyzed(localDay(2026, 7, 28), { theme: 'calm' }),
        analyzed(localDay(2026, 7, 25), { theme: 'noir' }),
        analyzed(localDay(2026, 7, 24), { theme: 'noir' }),
        analyzed(localDay(2026, 7, 23), { theme: 'mystical' }),
        analyzed(localDay(2026, 7, 22), { theme: 'mystical' }),
      ],
      { now },
    );

    expect(trends.week.streak).toEqual({ current: 2, longest: 4 });
  });

  it('keeps a Sunday-to-Monday week boundary on local calendar days', () => {
    const now = localDay(2026, 7, 24, 10);
    const sundayNight = localDay(2026, 7, 23, 23);
    const mondayMorning = localDay(2026, 7, 24, 1);
    const previousMonday = localDay(2026, 7, 17, 22);

    const trends = buildDreamTrends(
      [
        analyzed(sundayNight, { theme: 'mystical' }),
        analyzed(mondayMorning, { theme: 'calm' }),
        analyzed(previousMonday, { theme: 'noir' }),
      ],
      { now },
    );

    expect(trends.week.count).toBe(2);
    expect(trends.week.activeDays).toBe(2);
    expect(trends.week.lastActivityAt).toBe(mondayMorning);
    expect(trends.evolution.themePoints.map((point) => point.dateKey)).toEqual([
      '2026-08-17',
      '2026-08-23',
      '2026-08-24',
    ]);
  });

  it('uses the injected calendar adapter for date keys', () => {
    const id = Date.UTC(2026, 7, 29, 22);
    const trends = buildDreamTrends([analyzed(id, { theme: 'calm' })], {
      now: Date.UTC(2026, 7, 29, 23),
      calendar: {
        localDateKey: (timestamp) => {
          const date = new Date(timestamp);
          const year = date.getUTCFullYear();
          const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
          const day = `${date.getUTCDate()}`.padStart(2, '0');
          return `${year}-${month}-${day}`;
        },
        startOfLocalDay: (timestamp) => {
          const date = new Date(timestamp);
          return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
        },
        addLocalDays: (start, days) => start + days * 24 * 60 * 60 * 1000,
        weekday: (timestamp) => new Date(timestamp).getUTCDay(),
      },
    });

    expect(trends.week.count).toBe(1);
    expect(trends.evolution.themePoints[0]?.dateKey).toBe('2026-08-29');
  });

  it('uses the injected calendar, not 24h arithmetic, for consecutive days', () => {
    const day0 = 1_000_000;
    const day1 = day0 + 48 * 60 * 60 * 1000;
    const day2 = day1 + 48 * 60 * 60 * 1000;
    const keyFor = (timestamp: number) => {
      if (timestamp >= day2) return '2026-08-29';
      if (timestamp >= day1) return '2026-08-28';
      return '2026-08-27';
    };
    const startFor = (timestamp: number) => {
      if (timestamp >= day2) return day2;
      if (timestamp >= day1) return day1;
      return day0;
    };

    const trends = buildDreamTrends(
      [
        analyzed(day0, { theme: 'calm' }),
        analyzed(day1, { theme: 'calm' }),
        analyzed(day2, { theme: 'noir' }),
      ],
      {
        now: day2,
        calendar: {
          localDateKey: keyFor,
          startOfLocalDay: startFor,
          addLocalDays: (start, days) => start + days * 48 * 60 * 60 * 1000,
          weekday: (timestamp) => {
            if (timestamp >= day2) return 6;
            if (timestamp >= day1) return 5;
            return 4;
          },
        },
      },
    );

    expect(trends.week.streak).toEqual({ current: 3, longest: 3 });
    expect(trends.week.activeDays).toBe(3);
    expect(trends.week.averagePerWeek).toBeNull();
  });

  it('breaks theme and type ties with code-unit order', () => {
    const trends = buildDreamTrends(
      [
        analyzed(localDay(2026, 7, 23), { theme: 'noir', dreamType: 'Nightmare' }),
        analyzed(localDay(2026, 7, 24), { theme: 'calm', dreamType: 'Lucid Dream' }),
        analyzed(localDay(2026, 7, 25), { theme: 'noir', dreamType: 'Nightmare' }),
        analyzed(localDay(2026, 7, 26), { theme: 'calm', dreamType: 'Lucid Dream' }),
        analyzed(localDay(2026, 7, 27), { theme: 'mystical', dreamType: 'Symbolic Dream' }),
      ],
      { now: NOW },
    );

    expect(trends.patterns.themes.map((facet) => facet.value)).toEqual(['calm', 'noir', 'mystical']);
    expect(trends.patterns.types.map((facet) => facet.value)).toEqual([
      'Lucid Dream',
      'Nightmare',
      'Symbolic Dream',
    ]);
    expect(trends.patterns.empty).toBe(false);
  });

  it('treats types as honest motifs even without themes or recurrence', () => {
    const trends = buildDreamTrends(
      [
        analyzed(localDay(2026, 7, 23), { dreamType: 'Nightmare' }),
        analyzed(localDay(2026, 7, 24), { dreamType: 'Lucid Dream' }),
        analyzed(localDay(2026, 7, 25), { dreamType: 'Nightmare' }),
      ],
      { now: NOW },
    );

    expect(trends.patterns.empty).toBe(false);
    expect(trends.patterns.types).toEqual([
      { value: 'Nightmare', count: 2 },
      { value: 'Lucid Dream', count: 1 },
    ]);
    expect(trends.patterns.themes).toEqual([]);
    expect(trends.patterns.emotions).toEqual([]);
    expect(trends.patterns.recurrence.hasRecurrence).toBe(false);
  });

  it('keeps patterns empty below the volume threshold even when types exist', () => {
    const trends = buildDreamTrends(
      [
        analyzed(localDay(2026, 7, 28), { dreamType: 'Nightmare' }),
        analyzed(localDay(2026, 7, 29), { dreamType: 'Lucid Dream' }),
      ],
      { now: NOW },
    );

    expect(trends.patterns.types).toEqual([
      { value: 'Lucid Dream', count: 1 },
      { value: 'Nightmare', count: 1 },
    ]);
    expect(trends.patterns.empty).toBe(true);
  });

  it('only treats emotions as patterns when they recur and never uses chat history', () => {
    const trends = buildDreamTrends(
      [
        analyzed(localDay(2026, 7, 23), {
          theme: 'calm',
          emotions: [
            { name: 'fear', insight: '' },
            { name: 'peur', insight: '' },
            { name: 'joy', insight: '' },
          ],
          chatHistory: [{ id: '1', role: 'user', text: 'most discussed?' }],
        }),
        analyzed(localDay(2026, 7, 24), {
          theme: 'calm',
          emotions: [{ name: 'angoisse', insight: '' }],
          chatHistory: [{ id: '2', role: 'model', text: 'engagement' }],
        }),
        analyzed(localDay(2026, 7, 25), {
          theme: 'noir',
          emotions: [{ name: 'grief', insight: '' }],
        }),
      ],
      { now: NOW },
    );

    expect(trends.patterns.emotions).toEqual([{ value: 'fear', count: 2 }]);
    expect(JSON.stringify(trends)).not.toMatch(/most discussed|chatHistory|totalChat/i);
  });

  it('counts recurrence from type or memory without claiming a causal evolution', () => {
    const trends = buildDreamTrends(
      [
        analyzed(localDay(2026, 7, 23), { dreamType: 'Recurring Dream', theme: 'noir' }),
        analyzed(localDay(2026, 7, 24), {
          dreamType: 'Symbolic Dream',
          theme: 'calm',
          memory: { recurring: true },
        }),
        analyzed(localDay(2026, 7, 25), {
          dreamType: 'Lucid Dream',
          theme: 'calm',
          memory: { rememberedKind: 'recurring' },
        }),
      ],
      { now: NOW },
    );

    expect(trends.patterns.recurrence).toEqual({ count: 3, hasRecurrence: true });
    expect(trends.evolution.themePoints).toEqual([
      { dateKey: '2026-08-23', theme: 'noir', count: 1 },
      { dateKey: '2026-08-24', theme: 'calm', count: 1 },
      { dateKey: '2026-08-25', theme: 'calm', count: 1 },
    ]);
    expect(trends.evolution.days.map((day) => ({ dateKey: day.dateKey, total: day.total, dominantTheme: day.dominantTheme }))).toEqual([
      { dateKey: '2026-08-23', total: 1, dominantTheme: 'noir' },
      { dateKey: '2026-08-24', total: 1, dominantTheme: 'calm' },
      { dateKey: '2026-08-25', total: 1, dominantTheme: 'calm' },
    ]);
    expect(trends.evolution.nextAction).toBe('review_patterns');
  });

  it('exposes a finite weekly average only after a full local week', () => {
    const first = localDay(2026, 7, 23);
    const dreams = [
      analyzed(first, { theme: 'calm' }),
      analyzed(localDay(2026, 7, 24), { theme: 'calm' }),
      analyzed(localDay(2026, 7, 29), { theme: 'noir' }),
    ];

    const tooSoon = buildDreamTrends(dreams, { now: localDay(2026, 7, 27, 12) });
    const ready = buildDreamTrends(dreams, { now: NOW });

    expect(tooSoon.week.averagePerWeek).toBeNull();
    expect(ready.week.averagePerWeek).toBe(3);
    expect(Number.isFinite(ready.week.averagePerWeek)).toBe(true);
  });

  it('asks to recapture after a silent week and keep rhythm when volume is lumped', () => {
    const silent = buildDreamTrends(
      [
        analyzed(localDay(2026, 7, 20), { theme: 'calm' }),
        analyzed(localDay(2026, 7, 19), { theme: 'calm' }),
        analyzed(localDay(2026, 7, 18), { theme: 'noir' }),
      ],
      { now: NOW },
    );
    const lumped = buildDreamTrends(
      [
        analyzed(localDay(2026, 7, 29, 8), { theme: 'calm' }),
        analyzed(localDay(2026, 7, 29, 9), { theme: 'calm' }),
        analyzed(localDay(2026, 7, 28), { theme: 'noir' }),
      ],
      { now: NOW },
    );

    expect(silent.evolution.nextAction).toBe('capture_this_week');
    expect(silent.week.count).toBe(0);
    expect(silent.week.lastActivityAt).toBe(localDay(2026, 7, 20));
    expect(lumped.week.count).toBe(3);
    expect(lumped.week.activeDays).toBe(2);
    expect(lumped.evolution.nextAction).toBe('keep_rhythm');
  });

  it('bounds chronological theme points and never emits NaN', () => {
    const dreams: DreamAnalysis[] = [];
    for (let day = 1; day <= 40; day += 1) {
      const theme: DreamTheme = day % 2 === 0 ? 'calm' : 'noir';
      const type: DreamType = day % 3 === 0 ? 'Nightmare' : 'Symbolic Dream';
      dreams.push(analyzed(localDay(2026, 6, day), { theme, dreamType: type }));
    }

    const trends = buildDreamTrends(dreams, { now: localDay(2026, 7, 10, 12) });
    const serialized = JSON.stringify(trends);

    expect(trends.evolution.themePoints.length).toBeLessThanOrEqual(30);
    expect(trends.evolution.themePoints.map((point) => point.dateKey)).toEqual(
      [...trends.evolution.themePoints.map((point) => point.dateKey)].sort(),
    );
    expect(trends.evolution.days.map((day) => day.dateKey)).toEqual(
      [...trends.evolution.days.map((day) => day.dateKey)].sort(),
    );
    expect(trends.evolution.days.every((day) => day.total > 0 && Number.isFinite(day.total))).toBe(true);
    expect(serialized).not.toMatch(/NaN|Infinity/);
    expect(localDateKey(NOW)).toBe('2026-08-29');
  });

  it('groups chronological theme points into labelled evolution days', () => {
    const trends = buildDreamTrends(
      [
        analyzed(localDay(2026, 7, 27), { theme: 'noir' }),
        analyzed(localDay(2026, 7, 28, 8), { theme: 'calm' }),
        analyzed(localDay(2026, 7, 28, 21), { theme: 'calm' }),
        analyzed(localDay(2026, 7, 29), { theme: 'mystical' }),
      ],
      { now: NOW },
    );

    expect(trends.evolution.days).toEqual([
      {
        dateKey: '2026-08-27',
        total: 1,
        dominantTheme: 'noir',
        themes: [{ value: 'noir', count: 1 }],
      },
      {
        dateKey: '2026-08-28',
        total: 2,
        dominantTheme: 'calm',
        themes: [{ value: 'calm', count: 2 }],
      },
      {
        dateKey: '2026-08-29',
        total: 1,
        dominantTheme: 'mystical',
        themes: [{ value: 'mystical', count: 1 }],
      },
    ]);
  });
});
