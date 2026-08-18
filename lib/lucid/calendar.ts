import { isLucidDateKey } from './model';

export type LucidProgramCalendarStatus =
  | 'completed'
  | 'today'
  | 'available'
  | 'upcoming';

export type LucidProgramCalendarEntry = {
  session: number;
  dateKey: string;
  status: LucidProgramCalendarStatus;
};

type LucidProgramCalendarInput = {
  startDateKey: string;
  todayDateKey: string;
  sessionCount: number;
  weeklyTarget: number;
  completedSessionCount: number;
};

function addCalendarDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function getLucidLocalDateKey(timestamp = Date.now()): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Builds a stable, local calendar from the program start date. A weekly target
 * of three produces three evenly spaced practice days per seven-day block.
 * Missed sessions stay available; the plan never shortens sleep to catch up.
 */
export function buildLucidProgramCalendar(
  input: LucidProgramCalendarInput
): LucidProgramCalendarEntry[] {
  if (
    !isLucidDateKey(input.startDateKey) ||
    !isLucidDateKey(input.todayDateKey) ||
    !Number.isInteger(input.sessionCount) ||
    input.sessionCount < 1 ||
    input.sessionCount > 365 ||
    !Number.isInteger(input.weeklyTarget) ||
    input.weeklyTarget < 1 ||
    input.weeklyTarget > 7 ||
    !Number.isInteger(input.completedSessionCount) ||
    input.completedSessionCount < 0
  ) {
    return [];
  }

  return Array.from({ length: input.sessionCount }, (_, index) => {
    const dateKey = addCalendarDays(
      input.startDateKey,
      Math.floor((index * 7) / input.weeklyTarget)
    );
    const completed = index < Math.min(input.completedSessionCount, input.sessionCount);
    const status: LucidProgramCalendarStatus = completed
      ? 'completed'
      : dateKey === input.todayDateKey
        ? 'today'
        : dateKey < input.todayDateKey
          ? 'available'
          : 'upcoming';
    return { session: index + 1, dateKey, status };
  });
}
