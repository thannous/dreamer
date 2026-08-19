import type { ReminderPreference } from '@/lib/types';

/**
 * Reminder scheduling arithmetic, kept pure so the rules can be tested without
 * a notification module — the one thing that cannot be checked by hand is
 * whether a reminder lands on the right day at the right hour.
 */

/** Monday = 1 … Sunday = 7, matching `expo-notifications` weekday numbering. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export type ReminderSchedule = ReminderPreference & {
  /** Empty means every day. */
  days: Weekday[];
};

export const DEFAULT_SCHEDULE: ReminderSchedule = {
  enabled: false,
  hour: 21,
  minute: 30,
  days: [],
};

/** `21:30`, in the 24-hour form the settings screen shows. */
export const formatHour = (hour: number, minute: number): string =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

/**
 * The next moment a reminder should fire, from `now`.
 *
 * Today still counts if the hour has not passed yet — someone enabling a 21:30
 * reminder at 18:00 expects it tonight, not tomorrow.
 */
export function nextOccurrence(schedule: ReminderSchedule, now: Date): Date | null {
  if (!schedule.enabled) return null;

  const allowed = schedule.days.length ? schedule.days : WEEKDAYS;

  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(schedule.hour, schedule.minute, 0, 0);

    // JS Sunday is 0; ours is 7.
    const weekday = (candidate.getDay() === 0 ? 7 : candidate.getDay()) as Weekday;

    if (allowed.includes(weekday) && candidate.getTime() > now.getTime()) {
      return candidate;
    }
  }

  return null;
}

/**
 * One trigger per selected weekday, because a repeating daily trigger cannot
 * express "weekdays only". An empty selection collapses to a single daily one.
 */
export function scheduleTriggers(
  schedule: ReminderSchedule
): ({ hour: number; minute: number; weekday?: Weekday })[] {
  if (!schedule.enabled) return [];

  if (schedule.days.length === 0 || schedule.days.length === WEEKDAYS.length) {
    return [{ hour: schedule.hour, minute: schedule.minute }];
  }

  return [...schedule.days]
    .sort((a, b) => a - b)
    .map((weekday) => ({ hour: schedule.hour, minute: schedule.minute, weekday }));
}

export function toggleDay(days: Weekday[], day: Weekday): Weekday[] {
  return days.includes(day) ? days.filter((item) => item !== day) : [...days, day].sort();
}
