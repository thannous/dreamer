/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DreamAnalysis } from '../../lib/types';
import { useDreamStatistics } from '../useDreamStatistics';

const buildDream = (overrides: Partial<DreamAnalysis> = {}): DreamAnalysis => ({
  id: Date.now(),
  transcript: 'Test dream',
  title: 'Test Dream',
  interpretation: '',
  shareableQuote: '',
  imageUrl: '',
  dreamType: 'Symbolic Dream',
  theme: 'surreal',
  chatHistory: [],
  isAnalyzed: true,
  analyzedAt: Date.now(),
  analysisStatus: 'done',
  ...overrides,
});

describe('useDreamStatistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic counts', () => {
    it('calculates total dreams', () => {
      const dreams = [buildDream({ id: 1 }), buildDream({ id: 2 }), buildDream({ id: 3 })];

      const { result } = renderHook(() => useDreamStatistics(dreams));

      expect(result.current.totalDreams).toBe(3);
    });

    it('counts favorite dreams', () => {
      const dreams = [
        buildDream({ id: 1, isFavorite: true }),
        buildDream({ id: 2, isFavorite: false }),
        buildDream({ id: 3, isFavorite: true }),
      ];

      const { result } = renderHook(() => useDreamStatistics(dreams));

      expect(result.current.favoriteDreams).toBe(2);
    });

    it('returns zero for empty dream list', () => {
      const { result } = renderHook(() => useDreamStatistics([]));

      expect(result.current.totalDreams).toBe(0);
      expect(result.current.favoriteDreams).toBe(0);
      expect(result.current.currentStreak).toBe(0);
      expect(result.current.longestStreak).toBe(0);
    });
  });

  describe('time-based counts', () => {
    it('counts dreams from this week', () => {
      const now = Date.now();
      const yesterday = now - 24 * 60 * 60 * 1000;
      const lastWeek = now - 8 * 24 * 60 * 60 * 1000;
      const dreams = [
        buildDream({ id: now }),
        buildDream({ id: yesterday }),
        buildDream({ id: lastWeek }),
      ];

      const { result } = renderHook(() => useDreamStatistics(dreams));

      expect(result.current.dreamsThisWeek).toBe(2);
    });

    it('counts dreams from this month', () => {
      const now = Date.now();
      const lastWeek = now - 7 * 24 * 60 * 60 * 1000;
      const lastMonth = now - 31 * 24 * 60 * 60 * 1000;
      const dreams = [
        buildDream({ id: now }),
        buildDream({ id: lastWeek }),
        buildDream({ id: lastMonth }),
      ];

      const { result } = renderHook(() => useDreamStatistics(dreams));

      expect(result.current.dreamsThisMonth).toBe(2);
    });
  });

  describe('streak calculations', () => {
    it('calculates current streak when dreams are on consecutive days', () => {
      const now = Date.now();
      const today = new Date(now);
      today.setHours(12, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const dreams = [
        buildDream({ id: today.getTime() }),
        buildDream({ id: yesterday.getTime() }),
        buildDream({ id: twoDaysAgo.getTime() }),
      ];

      const { result } = renderHook(() => useDreamStatistics(dreams));

      expect(result.current.currentStreak).toBe(3);
    });

    it('resets current streak when there is a gap', () => {
      const now = Date.now();
      const today = new Date(now);
      today.setHours(12, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const dreams = [
        buildDream({ id: today.getTime() }),
        buildDream({ id: yesterday.getTime() }),
        buildDream({ id: threeDaysAgo.getTime() }), // Gap breaks streak
      ];

      const { result } = renderHook(() => useDreamStatistics(dreams));

      expect(result.current.currentStreak).toBe(2);
    });

    it('calculates longest streak across dream history', () => {
      const now = Date.now();
      const today = new Date(now);
      today.setHours(12, 0, 0, 0);

      // Current streak of 2 days
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Gap
      const fiveDaysAgo = new Date(today);
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const sixDaysAgo = new Date(today);
      sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const eightDaysAgo = new Date(today);
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

      const dreams = [
        buildDream({ id: today.getTime() }),
        buildDream({ id: yesterday.getTime() }),
        // Gap here
        buildDream({ id: fiveDaysAgo.getTime() }),
        buildDream({ id: sixDaysAgo.getTime() }),
        buildDream({ id: sevenDaysAgo.getTime() }),
        buildDream({ id: eightDaysAgo.getTime() }),
      ];

      const { result } = renderHook(() => useDreamStatistics(dreams));

      // Current streak is 2, longest streak is 4
      expect(result.current.currentStreak).toBe(2);
      expect(result.current.longestStreak).toBe(4);
    });

    it('returns zero streak when last dream is more than 1 day ago', () => {
      const now = Date.now();
      const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;

      const dreams = [buildDream({ id: threeDaysAgo })];

      const { result } = renderHook(() => useDreamStatistics(dreams));

      expect(result.current.currentStreak).toBe(0);
    });
  });

  describe('average dreams per week', () => {
    it('calculates average dreams per week', () => {
      const now = Date.now();
      const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;

      // 4 dreams over 2 weeks = 2 per week
      const dreams = [
        buildDream({ id: now }),
        buildDream({ id: now - 3 * 24 * 60 * 60 * 1000 }),
        buildDream({ id: now - 7 * 24 * 60 * 60 * 1000 }),
        buildDream({ id: twoWeeksAgo }),
      ];

      const { result } = renderHook(() => useDreamStatistics(dreams));

      expect(result.current.averageDreamsPerWeek).toBeCloseTo(2, 1);
    });
  });

  describe('dreams by day of week', () => {
    it('aggregates dreams by day of week', () => {
      // Create dreams on specific days
      const monday = new Date('2024-01-01T12:00:00'); // Monday
      const tuesday = new Date('2024-01-02T12:00:00'); // Tuesday
      const monday2 = new Date('2024-01-08T12:00:00'); // Another Monday

      const dreams = [
        buildDream({ id: monday.getTime() }),
        buildDream({ id: tuesday.getTime() }),
        buildDream({ id: monday2.getTime() }),
      ];

      const { result } = renderHook(() => useDreamStatistics(dreams));

      expect(result.current.dreamsByDay).toHaveLength(7);

      // Check Monday (weekday 1) has 2 dreams
      const mondayData = result.current.dreamsByDay.find((d) => d.weekday === 1);
      expect(mondayData?.count).toBe(2);

      // Check Tuesday (weekday 2) has 1 dream
      const tuesdayData = result.current.dreamsByDay.find((d) => d.weekday === 2);
      expect(tuesdayData?.count).toBe(1);
    });

    it('orders days starting from Monday', () => {
      const { result } = renderHook(() => useDreamStatistics([]));

      const weekdays = result.current.dreamsByDay.map((d) => d.weekday);
      expect(weekdays).toEqual([1, 2, 3, 4, 5, 6, 0]); // Mon-Sun
    });
  });

  describe('dreams over time', () => {
    it('generates 30-day time series', () => {
      const dreams = [buildDream({ id: Date.now() })];

      const { result } = renderHook(() => useDreamStatistics(dreams));

      expect(result.current.dreamsOverTime).toHaveLength(30);
    });

    it('aggregates dreams by date', () => {
      const now = Date.now();
      const today = new Date(now);
      today.setHours(12, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const dreams = [
        buildDream({ id: today.getTime() }),
        buildDream({ id: today.getTime() + 1000 }), // Same day, different time
        buildDream({ id: yesterday.getTime() }),
      ];

      const { result } = renderHook(() => useDreamStatistics(dreams));

      // Find today's count
      const todayData = result.current.dreamsOverTime.find((d) => {
        const date = new Date(d.timestamp);
        date.setHours(0, 0, 0, 0);
        return date.getTime() === new Date(today).setHours(0, 0, 0, 0);
      });

      expect(todayData?.count).toBe(2);
    });

    it('includes days with zero dreams', () => {
      const now = Date.now();
      const dreams = [buildDream({ id: now })];

      const { result } = renderHook(() => useDreamStatistics(dreams));

      // Most days should have 0 dreams
      const daysWithZero = result.current.dreamsOverTime.filter((d) => d.count === 0);
      expect(daysWithZero.length).toBeGreaterThan(20);
    });
  });

  describe('dream type distribution', () => {
    it('calculates dream type distribution', () => {
      const dreams = [
        buildDream({ id: 1, dreamType: 'Lucid Dream' }),
        buildDream({ id: 2, dreamType: 'Lucid Dream' }),
        buildDream({ id: 3, dreamType: 'Nightmare' }),
        buildDream({ id: 4, dreamType: 'Symbolic Dream' }),
      ];

      const { result } = renderHook(() => useDreamStatistics(dreams));

      expect(result.current.dreamTypeDistribution).toHaveLength(3);

      const lucidDreams = result.current.dreamTypeDistribution.find((d) => d.type === 'Lucid Dream');
      expect(lucidDreams?.count).toBe(2);
      expect(lucidDreams?.percentage).toBe(50);

      const nightmares = result.current.dreamTypeDistribution.find((d) => d.type === 'Nightmare');
      expect(nightmares?.count).toBe(1);
      expect(nightmares?.percentage).toBe(25);
    });

    it('sorts distribution by count descending', () => {
      const dreams = [
        buildDream({ id: 1, dreamType: 'Nightmare' }),
        buildDream({ id: 2, dreamType: 'Lucid Dream' }),
        buildDream({ id: 3, dreamType: 'Lucid Dream' }),
        buildDream({ id: 4, dreamType: 'Lucid Dream' }),
      ];

      const { result } = renderHook(() => useDreamStatistics(dreams));

      expect(result.current.dreamTypeDistribution[0].type).toBe('Lucid Dream');
      expect(result.current.dreamTypeDistribution[0].count).toBe(3);
    });

    it('handles dreams with no type', () => {
      const dreams = [buildDream({ id: 1, dreamType: undefined as any })];

      const { result } = renderHook(() => useDreamStatistics(dreams));

      const unknownType = result.current.dreamTypeDistribution.find((d) => d.type === 'Unknown');
      expect(unknownType?.count).toBe(1);
    });
  });

  describe('top themes', () => {
    it('aggregates themes', () => {
      const dreams = [
        buildDream({ id: 1, theme: 'surreal' }),
        buildDream({ id: 2, theme: 'surreal' }),
        buildDream({ id: 3, theme: 'mystical' }),
        buildDream({ id: 4, theme: 'noir' }),
        buildDream({ id: 5, theme: 'calm' }),
      ];

      const { result } = renderHook(() => useDreamStatistics(dreams));

      expect(result.current.topThemes).toHaveLength(4);
      expect(result.current.topThemes[0].theme).toBe('surreal');
      expect(result.current.topThemes[0].count).toBe(2);
    });

    it('sorts themes by count descending', () => {
      const dreams = [
        buildDream({ id: 1, theme: 'surreal' }),
        buildDream({ id: 2, theme: 'mystical' }),
        buildDream({ id: 3, theme: 'mystical' }),
        buildDream({ id: 4, theme: 'mystical' }),
      ];

      const { result } = renderHook(() => useDreamStatistics(dreams));

      expect(result.current.topThemes[0].theme).toBe('mystical');
      expect(result.current.topThemes[0].count).toBe(3);
    });

    it('ignores dreams with no theme', () => {
      const dreams = [
        buildDream({ id: 1, theme: 'surreal' }),
        buildDream({ id: 2, theme: undefined }),
      ];

      const { result } = renderHook(() => useDreamStatistics(dreams));

      expect(result.current.topThemes).toHaveLength(1);
      expect(result.current.topThemes[0].theme).toBe('surreal');
    });
  });

  describe('chat engagement metrics', () => {
    it('counts total chat messages', () => {
      const dreams = [
        buildDream({
          id: 1,
          chatHistory: [
            { role: 'user', text: 'Hello' },
            { role: 'model', text: 'Hi' },
            { role: 'user', text: 'Thanks' },
          ],
        }),
        buildDream({
          id: 2,
          chatHistory: [{ role: 'user', text: 'Question' }],
        }),
      ];

      const { result } = renderHook(() => useDreamStatistics(dreams));

      expect(result.current.totalChatMessages).toBe(3); // Only user messages
    });

    it('counts dreams with chat', () => {
      const dreams = [
        buildDream({
          id: 1,
          explorationStartedAt: Date.now(),
          chatHistory: [{ role: 'user', text: 'Hello' }],
        }),
        buildDream({
          id: 2,
          explorationStartedAt: Date.now(),
          chatHistory: [],
        }),
        buildDream({
          id: 3,
          explorationStartedAt: undefined,
          chatHistory: [],
        }),
      ];

      const { result } = renderHook(() => useDreamStatistics(dreams));

      expect(result.current.dreamsWithChat).toBe(2);
    });

    it('counts analyzed dreams', () => {
      const dreams = [
        buildDream({ id: 1, isAnalyzed: true, analyzedAt: Date.now() }),
        buildDream({ id: 2, isAnalyzed: true, analyzedAt: Date.now() }),
        buildDream({ id: 3, isAnalyzed: false }),
      ];

      const { result } = renderHook(() => useDreamStatistics(dreams));

      expect(result.current.analyzedDreams).toBe(2);
    });

    it('identifies most discussed dream', () => {
      const dreams = [
        buildDream({
          id: 1,
          title: 'Dream 1',
          chatHistory: [
            { role: 'user', text: 'Q1' },
            { role: 'model', text: 'A1' },
          ],
        }),
        buildDream({
          id: 2,
          title: 'Dream 2',
          chatHistory: [
            { role: 'user', text: 'Q1' },
            { role: 'model', text: 'A1' },
            { role: 'user', text: 'Q2' },
            { role: 'model', text: 'A2' },
            { role: 'user', text: 'Q3' },
          ],
        }),
        buildDream({
          id: 3,
          title: 'Dream 3',
          chatHistory: [],
        }),
      ];

      const { result } = renderHook(() => useDreamStatistics(dreams));

      expect(result.current.mostDiscussedDream?.id).toBe(2);
      expect(result.current.mostDiscussedDreamUserMessages).toBe(3);
    });

    it('returns null when no dreams have chat', () => {
      const dreams = [
        buildDream({ id: 1, chatHistory: [] }),
        buildDream({ id: 2, chatHistory: [] }),
      ];

      const { result } = renderHook(() => useDreamStatistics(dreams));

      expect(result.current.mostDiscussedDream).toBeNull();
      expect(result.current.mostDiscussedDreamUserMessages).toBe(0);
    });
  });

  describe('reactivity', () => {
    it('recalculates when dreams change', () => {
      const { result, rerender } = renderHook(
        ({ dreams }) => useDreamStatistics(dreams),
        {
          initialProps: { dreams: [buildDream({ id: 1 })] },
        }
      );

      expect(result.current.totalDreams).toBe(1);

      rerender({ dreams: [buildDream({ id: 1 }), buildDream({ id: 2 })] });

      expect(result.current.totalDreams).toBe(2);
    });
  });
});
