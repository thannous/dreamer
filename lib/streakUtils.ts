/**
 * Pure utility functions for calculating dream journaling streaks.
 * Extracted for testability and reusability.
 */

export interface StreakResult {
  current: number;
  longest: number;
}

export interface TimestampedItem {
  id: number;
}

export interface CalculateStreaksOptions {
  sortedDescending?: boolean;
}

/**
 * Returns the start of the day (midnight) for a given timestamp.
 */
export const startOfDay = (timestamp: number): Date => {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date;
};

const startOfDayTime = (timestamp: number): number => startOfDay(timestamp).getTime();

/**
 * Checks if a timestamp falls within a certain number of days from a reference point.
 */
export const isWithinDays = (timestamp: number, days: number, now: number): boolean => {
  const dayInMs = 24 * 60 * 60 * 1000;
  return now - timestamp <= days * dayInMs;
};

/**
 * Calculates current and longest streaks from a list of items with timestamps (id field).
 * A streak is defined as consecutive days with at least one item.
 *
 * @param items - Array of items with an `id` field representing timestamp
 * @param referenceTime - Optional reference time for "today" (defaults to Date.now())
 * @returns Object with current and longest streak counts
 */
export const calculateStreaks = <T extends TimestampedItem>(
  items: T[],
  referenceTime?: number,
  options: CalculateStreaksOptions = {}
): StreakResult => {
  if (items.length === 0) return { current: 0, longest: 0 };

  // Perf: callers that already receive newest-first data can skip a copy + sort here.
  const sortedItems = options.sortedDescending ? items : [...items].sort((a, b) => b.id - a.id);
  const dayInMs = 24 * 60 * 60 * 1000;

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 1;

  const today = new Date(referenceTime ?? Date.now());
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();

  const mostRecentItemDay = startOfDayTime(sortedItems[0].id);

  const daysSinceLastItem = Math.floor((todayTimestamp - mostRecentItemDay) / dayInMs);

  if (daysSinceLastItem <= 1) {
    currentStreak = 1;
    let previousDay = mostRecentItemDay;

    for (let i = 1; i < sortedItems.length; i++) {
      const currentDay = startOfDayTime(sortedItems[i].id);
      const daysDiff = Math.floor((previousDay - currentDay) / dayInMs);

      if (daysDiff <= 1) {
        currentStreak++;
        tempStreak++;
        previousDay = currentDay;
      } else {
        break;
      }

      longestStreak = Math.max(longestStreak, tempStreak);
    }
  }

  tempStreak = 1;
  let previousDay = mostRecentItemDay;
  for (let i = 1; i < sortedItems.length; i++) {
    const currentDay = startOfDayTime(sortedItems[i].id);
    const daysDiff = Math.floor((previousDay - currentDay) / dayInMs);

    if (daysDiff <= 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
    previousDay = currentDay;
  }

  longestStreak = Math.max(longestStreak, tempStreak, currentStreak);

  return { current: currentStreak, longest: longestStreak };
};
