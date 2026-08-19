import type { PracticeEntry } from '@/lib/types';

/**
 * Streaks and statistics, computed from the practice log.
 *
 * Everything here works on `YYYY-MM-DD` strings in the LOCAL calendar, never on
 * timestamps: a practice at 23:40 belongs to that evening, and a streak the
 * user earned must not break because they crossed a UTC midnight.
 */

/** Local calendar day for a date. `sv-SE` is the shortest route to ISO order. */
export const toLocalDay = (date: Date): string => date.toLocaleDateString('sv-SE');

/** Days between two `YYYY-MM-DD` strings, ignoring time and DST entirely. */
export function daysBetween(fromDay: string, toDay: string): number {
  const [fy, fm, fd] = fromDay.split('-').map(Number);
  const [ty, tm, td] = toDay.split('-').map(Number);
  // UTC arithmetic on calendar parts: no DST hour can shift a day boundary.
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86_400_000);
}

export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + delta));
  return shifted.toISOString().slice(0, 10);
}

/** Distinct practice days, most recent first. */
export function practiceDays(log: PracticeEntry[]): string[] {
  return [...new Set(log.map((entry) => entry.dateISO))].sort((a, b) => b.localeCompare(a));
}

export type Streak = {
  current: number;
  longest: number;
  /** True when today has already been practised — drives the calendar's today mark. */
  practisedToday: boolean;
};

/**
 * The current streak runs back from today, or from yesterday.
 *
 * Not having practised *yet today* must not read as a broken streak: the day is
 * not over. It breaks only once a whole day has been missed.
 */
export function computeStreak(log: PracticeEntry[], today: string): Streak {
  const days = practiceDays(log);
  if (days.length === 0) return { current: 0, longest: 0, practisedToday: false };

  const practisedToday = days[0] === today;

  let current = 0;
  const gapToMostRecent = daysBetween(days[0], today);
  if (gapToMostRecent <= 1) {
    current = 1;
    for (let index = 1; index < days.length; index += 1) {
      if (daysBetween(days[index], days[index - 1]) === 1) current += 1;
      else break;
    }
  }

  let longest = 1;
  let run = 1;
  for (let index = 1; index < days.length; index += 1) {
    if (daysBetween(days[index], days[index - 1]) === 1) run += 1;
    else run = 1;
    longest = Math.max(longest, run);
  }

  return { current, longest: Math.max(longest, current), practisedToday };
}

export type PracticeStats = {
  totalSessions: number;
  totalMinutes: number;
  /** Distinct days with at least one practice. */
  totalDays: number;
};

export function computeStats(log: PracticeEntry[]): PracticeStats {
  const totalSeconds = log.reduce((sum, entry) => sum + Math.max(0, entry.seconds), 0);

  return {
    totalSessions: log.length,
    totalMinutes: Math.round(totalSeconds / 60),
    totalDays: practiceDays(log).length,
  };
}

export type CalendarDay = {
  day: string;
  practised: boolean;
  isToday: boolean;
};

/**
 * A flat run of days ending today, oldest first — the calendar strip renders it
 * in rows of seven, so it must start on the right weekday to line up.
 */
export function calendarDays(log: PracticeEntry[], today: string, weeks = 5): CalendarDay[] {
  const practised = new Set(practiceDays(log));

  // Walk back to the most recent Monday, then back `weeks - 1` further.
  const [y, m, d] = today.split('-').map(Number);
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Monday = 0
  const start = shiftDay(today, -(weekday + (weeks - 1) * 7));

  const total = weekday + 1 + (weeks - 1) * 7;
  return Array.from({ length: total }, (_, index) => {
    const day = shiftDay(start, index);
    return { day, practised: practised.has(day), isToday: day === today };
  });
}
