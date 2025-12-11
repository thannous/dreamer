import { describe, expect, it } from 'vitest';

import { calculateStreaks, isWithinDays, startOfDay } from '../streakUtils';

describe('streakUtils', () => {
  describe('startOfDay', () => {
    it('given a timestamp with time returns midnight of that day', () => {
      const timestamp = new Date('2024-03-15T14:30:00').getTime();
      const result = startOfDay(timestamp);

      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
      expect(result.getDate()).toBe(15);
      expect(result.getMonth()).toBe(2); // March
    });

    it('given midnight timestamp returns same date', () => {
      const midnight = new Date('2024-03-15T00:00:00').getTime();
      const result = startOfDay(midnight);

      expect(result.getTime()).toBe(midnight);
    });

    it('given late night timestamp returns same day midnight', () => {
      const lateNight = new Date('2024-03-15T23:59:59.999').getTime();
      const result = startOfDay(lateNight);

      expect(result.getDate()).toBe(15);
      expect(result.getHours()).toBe(0);
    });
  });

  describe('isWithinDays', () => {
    const now = new Date('2024-03-15T12:00:00').getTime();
    const dayInMs = 24 * 60 * 60 * 1000;

    it('given timestamp from today returns true for 1 day window', () => {
      const today = new Date('2024-03-15T08:00:00').getTime();
      expect(isWithinDays(today, 1, now)).toBe(true);
    });

    it('given timestamp from yesterday returns true for 2 day window', () => {
      const yesterday = now - dayInMs;
      expect(isWithinDays(yesterday, 2, now)).toBe(true);
    });

    it('given timestamp from 7 days ago returns true for 7 day window', () => {
      const sevenDaysAgo = now - (7 * dayInMs);
      expect(isWithinDays(sevenDaysAgo, 7, now)).toBe(true);
    });

    it('given timestamp from 8 days ago returns false for 7 day window', () => {
      const eightDaysAgo = now - (8 * dayInMs);
      expect(isWithinDays(eightDaysAgo, 7, now)).toBe(false);
    });

    it('given timestamp exactly at boundary returns true', () => {
      const exactlySevenDays = now - (7 * dayInMs);
      expect(isWithinDays(exactlySevenDays, 7, now)).toBe(true);
    });

    it('given future timestamp returns true', () => {
      const tomorrow = now + dayInMs;
      expect(isWithinDays(tomorrow, 1, now)).toBe(true);
    });
  });

  describe('calculateStreaks', () => {
    const dayInMs = 24 * 60 * 60 * 1000;

    // Helper to create items with specific dates
    const createItem = (daysAgo: number, referenceTime: number) => ({
      id: referenceTime - (daysAgo * dayInMs) + Math.floor(Math.random() * 1000),
    });

    it('given empty array returns zero streaks', () => {
      const result = calculateStreaks([]);
      expect(result).toEqual({ current: 0, longest: 0 });
    });

    it('given single item from today returns current streak of 1', () => {
      const now = Date.now();
      const items = [{ id: now }];

      const result = calculateStreaks(items, now);

      expect(result.current).toBe(1);
      expect(result.longest).toBe(1);
    });

    it('given single item from yesterday returns current streak of 1', () => {
      const now = Date.now();
      const items = [{ id: now - dayInMs }];

      const result = calculateStreaks(items, now);

      expect(result.current).toBe(1);
      expect(result.longest).toBe(1);
    });

    it('given single item from 3 days ago returns current streak of 0', () => {
      const now = Date.now();
      const items = [{ id: now - (3 * dayInMs) }];

      const result = calculateStreaks(items, now);

      expect(result.current).toBe(0);
      expect(result.longest).toBe(1);
    });

    it('given 3 consecutive days returns streak of 3', () => {
      const now = new Date('2024-03-15T12:00:00').getTime();
      const items = [
        { id: now }, // today
        { id: now - dayInMs }, // yesterday
        { id: now - (2 * dayInMs) }, // 2 days ago
      ];

      const result = calculateStreaks(items, now);

      expect(result.current).toBe(3);
      expect(result.longest).toBe(3);
    });

    it('given broken streak returns correct current and longest', () => {
      const now = new Date('2024-03-15T12:00:00').getTime();
      const items = [
        { id: now }, // today - start of current streak
        { id: now - dayInMs }, // yesterday
        // gap - 2 days ago missing
        { id: now - (3 * dayInMs) }, // 3 days ago - start of old streak
        { id: now - (4 * dayInMs) }, // 4 days ago
        { id: now - (5 * dayInMs) }, // 5 days ago
        { id: now - (6 * dayInMs) }, // 6 days ago
      ];

      const result = calculateStreaks(items, now);

      expect(result.current).toBe(2);
      expect(result.longest).toBe(4);
    });

    it('given multiple items on same day counts each item (not deduplicated)', () => {
      // Note: The original algorithm doesn't deduplicate days.
      // Multiple items on the same day are counted as consecutive (daysDiff = 0).
      const now = new Date('2024-03-15T12:00:00').getTime();
      const items = [
        { id: now }, // today morning
        { id: now + 1000 }, // today afternoon
        { id: now + 2000 }, // today evening
        { id: now - dayInMs }, // yesterday
      ];

      const result = calculateStreaks(items, now);

      // All 4 items are counted as consecutive since daysDiff <= 1
      expect(result.current).toBe(4);
      expect(result.longest).toBe(4);
    });

    it('given items out of order still calculates correctly', () => {
      const now = new Date('2024-03-15T12:00:00').getTime();
      const items = [
        { id: now - (2 * dayInMs) }, // oldest first
        { id: now }, // newest last
        { id: now - dayInMs }, // middle
      ];

      const result = calculateStreaks(items, now);

      expect(result.current).toBe(3);
      expect(result.longest).toBe(3);
    });

    it('given old historical streak longer than current returns correct longest', () => {
      const now = new Date('2024-03-15T12:00:00').getTime();
      const items = [
        { id: now }, // today - current streak of 1
        // big gap
        { id: now - (30 * dayInMs) }, // old streak of 5
        { id: now - (31 * dayInMs) },
        { id: now - (32 * dayInMs) },
        { id: now - (33 * dayInMs) },
        { id: now - (34 * dayInMs) },
      ];

      const result = calculateStreaks(items, now);

      expect(result.current).toBe(1);
      expect(result.longest).toBe(5);
    });

    it('given no recent items returns current streak of 0', () => {
      const now = new Date('2024-03-15T12:00:00').getTime();
      const items = [
        { id: now - (10 * dayInMs) },
        { id: now - (11 * dayInMs) },
        { id: now - (12 * dayInMs) },
      ];

      const result = calculateStreaks(items, now);

      expect(result.current).toBe(0);
      expect(result.longest).toBe(3);
    });

    it('given custom reference time calculates from that point', () => {
      const pastReference = new Date('2024-01-15T12:00:00').getTime();
      const items = [
        { id: pastReference }, // "today" relative to reference
        { id: pastReference - dayInMs },
      ];

      const result = calculateStreaks(items, pastReference);

      expect(result.current).toBe(2);
      expect(result.longest).toBe(2);
    });

    it('given items with additional properties works correctly', () => {
      const now = Date.now();
      const items = [
        { id: now, name: 'Dream 1', content: 'test' },
        { id: now - dayInMs, name: 'Dream 2', content: 'test2' },
      ];

      const result = calculateStreaks(items, now);

      expect(result.current).toBe(2);
      expect(result.longest).toBe(2);
    });
  });
});
