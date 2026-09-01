import { compareDreamFacets } from '@/lib/dreamFacets';
import { matchEmotionFamily, type EmotionFamilyId } from '@/lib/dreamEmotions';
import { startOfDay } from '@/lib/streakUtils';
import { normalizeDreamMemoryMetadata } from '@/lib/dreamUtils';
import type { DreamAnalysis, DreamTheme, DreamType } from '@/lib/types';

const WEEK_DAYS = 7;
const MIN_DREAMS_FOR_PATTERNS = 3;
const TOP_LIMIT = 5;
const MAX_THEME_POINTS = 30;
const ORDERED_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;
const DREAM_THEMES: ReadonlySet<DreamTheme> = new Set(['surreal', 'mystical', 'calm', 'noir']);
const DREAM_TYPES: ReadonlySet<DreamType> = new Set([
  'Lucid Dream',
  'Recurring Dream',
  'Nightmare',
  'Symbolic Dream',
]);

export type DreamTrendsNextAction =
  | 'capture_first'
  | 'capture_this_week'
  | 'wait_for_patterns'
  | 'keep_rhythm'
  | 'review_patterns';

export type DreamTrendsFacet<T extends string> = {
  value: T;
  count: number;
};

export type DreamTrendsRhythmDay = {
  weekday: number;
  count: number;
};

export type DreamTrendsThemePoint = {
  dateKey: string;
  theme: DreamTheme;
  count: number;
};

export type DreamTrendsWeek = {
  count: number;
  activeDays: number;
  rhythm: DreamTrendsRhythmDay[];
  lastActivityAt: number | null;
  streak: { current: number; longest: number };
  averagePerWeek: number | null;
};

export type DreamTrendsPatterns = {
  empty: boolean;
  themes: DreamTrendsFacet<DreamTheme>[];
  emotions: DreamTrendsFacet<EmotionFamilyId>[];
  types: DreamTrendsFacet<DreamType>[];
  recurrence: { count: number; hasRecurrence: boolean };
};

export type DreamTrendsEvolutionDay = {
  dateKey: string;
  total: number;
  dominantTheme: DreamTheme;
  themes: DreamTrendsFacet<DreamTheme>[];
};

export type DreamTrendsEvolution = {
  themePoints: DreamTrendsThemePoint[];
  days: DreamTrendsEvolutionDay[];
  nextAction: DreamTrendsNextAction;
};

export type DreamTrends = {
  week: DreamTrendsWeek;
  patterns: DreamTrendsPatterns;
  evolution: DreamTrendsEvolution;
};

export type DreamTrendsCalendar = {
  localDateKey: (timestamp: number) => string;
  startOfLocalDay: (timestamp: number) => number;
  addLocalDays: (startOfDayTimestamp: number, days: number) => number;
  weekday: (timestamp: number) => number;
};

export type BuildDreamTrendsOptions = {
  now?: number;
  calendar?: Partial<DreamTrendsCalendar>;
};

export function getLocalDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const defaultDreamTrendsCalendar: DreamTrendsCalendar = {
  localDateKey: getLocalDateKey,
  startOfLocalDay: (timestamp) => startOfDay(timestamp).getTime(),
  addLocalDays: (startOfDayTimestamp, days) => {
    const date = new Date(startOfDayTimestamp);
    date.setDate(date.getDate() + days);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  },
  weekday: (timestamp) => new Date(timestamp).getDay(),
};

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function resolveCalendar(calendar?: Partial<DreamTrendsCalendar>): DreamTrendsCalendar {
  return {
    localDateKey: calendar?.localDateKey ?? defaultDreamTrendsCalendar.localDateKey,
    startOfLocalDay: calendar?.startOfLocalDay ?? defaultDreamTrendsCalendar.startOfLocalDay,
    addLocalDays: calendar?.addLocalDays ?? defaultDreamTrendsCalendar.addLocalDays,
    weekday: calendar?.weekday ?? defaultDreamTrendsCalendar.weekday,
  };
}

function increment<T extends string>(map: Map<T, number>, value: T | undefined | null): void {
  if (!value) return;
  map.set(value, (map.get(value) ?? 0) + 1);
}

const MAX_LOCAL_DAY_WALK = 366 * 40;

function areConsecutiveLocalDays(
  newerStart: number,
  olderStart: number,
  calendar: DreamTrendsCalendar,
): boolean {
  return calendar.addLocalDays(olderStart, 1) === newerStart;
}

function isTodayOrYesterday(
  dayStart: number,
  todayStart: number,
  calendar: DreamTrendsCalendar,
): boolean {
  return dayStart === todayStart || dayStart === calendar.addLocalDays(todayStart, -1);
}

function inclusiveLocalDayCount(
  fromStart: number,
  toStart: number,
  calendar: DreamTrendsCalendar,
): number | null {
  if (!Number.isFinite(fromStart) || !Number.isFinite(toStart) || toStart < fromStart) {
    return null;
  }

  let days = 1;
  let cursor = fromStart;
  while (cursor < toStart) {
    const next = calendar.addLocalDays(cursor, 1);
    if (!Number.isFinite(next) || next <= cursor) return null;
    cursor = next;
    days += 1;
    if (days > MAX_LOCAL_DAY_WALK) return null;
  }

  return cursor === toStart ? days : null;
}

function calculateCalendarStreaks(
  timestamps: number[],
  now: number,
  calendar: DreamTrendsCalendar,
): { current: number; longest: number } {
  if (timestamps.length === 0) return { current: 0, longest: 0 };

  const uniqueDays = Array.from(
    new Set(timestamps.map((timestamp) => calendar.startOfLocalDay(timestamp))),
  )
    .filter((day) => Number.isFinite(day))
    .sort((a, b) => b - a);

  if (uniqueDays.length === 0) return { current: 0, longest: 0 };

  const today = calendar.startOfLocalDay(now);
  const mostRecent = uniqueDays[0];

  let current = 0;
  if (isTodayOrYesterday(mostRecent, today, calendar)) {
    current = 1;
    for (let index = 1; index < uniqueDays.length; index += 1) {
      if (!areConsecutiveLocalDays(uniqueDays[index - 1], uniqueDays[index], calendar)) {
        break;
      }
      current += 1;
    }
  }

  let longest = 1;
  let run = 1;
  for (let index = 1; index < uniqueDays.length; index += 1) {
    if (areConsecutiveLocalDays(uniqueDays[index - 1], uniqueDays[index], calendar)) {
      run += 1;
    } else {
      longest = Math.max(longest, run);
      run = 1;
    }
  }

  return { current, longest: Math.max(longest, run, current) };
}

function toFacets<T extends string>(map: Map<T, number>, limit = TOP_LIMIT): DreamTrendsFacet<T>[] {
  return Array.from(map.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => compareDreamFacets(a.count, a.value, b.count, b.value))
    .slice(0, limit);
}

function usefulAveragePerWeek(
  count: number,
  firstAt: number | null,
  now: number,
  calendar: DreamTrendsCalendar,
): number | null {
  if (count <= 0 || firstAt == null) return null;
  const firstDay = calendar.startOfLocalDay(firstAt);
  const today = calendar.startOfLocalDay(now);
  if (today < firstDay) return null;
  const spanDays = inclusiveLocalDayCount(firstDay, today, calendar);
  if (spanDays == null || spanDays < WEEK_DAYS) return null;
  const average = count / (spanDays / WEEK_DAYS);
  return Number.isFinite(average) ? average : null;
}

function isRecurringDream(dream: DreamAnalysis): boolean {
  if (dream.dreamType === 'Recurring Dream') return true;
  const memory = normalizeDreamMemoryMetadata(dream.memory);
  return memory?.recurring === true || memory?.rememberedKind === 'recurring';
}

function resolveNextAction(params: {
  validCount: number;
  weekCount: number;
  activeDays: number;
}): DreamTrendsNextAction {
  if (params.validCount === 0) return 'capture_first';
  if (params.weekCount === 0) return 'capture_this_week';
  if (params.validCount < MIN_DREAMS_FOR_PATTERNS) return 'wait_for_patterns';
  if (params.activeDays < 3) return 'keep_rhythm';
  return 'review_patterns';
}

function buildThemePoints(
  themedByDay: Map<string, Map<DreamTheme, number>>,
): DreamTrendsThemePoint[] {
  const dateKeys = Array.from(themedByDay.keys()).sort();
  const points: DreamTrendsThemePoint[] = [];

  for (const dateKey of dateKeys) {
    const themeCounts = themedByDay.get(dateKey);
    if (!themeCounts) continue;
    const dayPoints = Array.from(themeCounts.entries())
      .map(([theme, count]) => ({ dateKey, theme, count }))
      .sort((a, b) => compareDreamFacets(a.count, a.theme, b.count, b.theme));
    points.push(...dayPoints);
  }

  if (points.length <= MAX_THEME_POINTS) return points;

  const kept = new Set<string>();
  const recent: DreamTrendsThemePoint[] = [];
  for (let index = dateKeys.length - 1; index >= 0; index -= 1) {
    const dateKey = dateKeys[index];
    const dayPoints = points.filter((point) => point.dateKey === dateKey);
    if (recent.length + dayPoints.length > MAX_THEME_POINTS && kept.size > 0) break;
    kept.add(dateKey);
    recent.unshift(...dayPoints);
  }
  return recent;
}

export function groupDreamTrendEvolutionDays(
  points: DreamTrendsThemePoint[],
): DreamTrendsEvolutionDay[] {
  const byDate = new Map<string, Map<DreamTheme, number>>();

  for (const point of points) {
    if (!point?.dateKey || !DREAM_THEMES.has(point.theme)) continue;
    if (!Number.isFinite(point.count) || point.count <= 0) continue;
    const themes = byDate.get(point.dateKey) ?? new Map<DreamTheme, number>();
    themes.set(point.theme, (themes.get(point.theme) ?? 0) + point.count);
    byDate.set(point.dateKey, themes);
  }

  return Array.from(byDate.entries())
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([dateKey, themeCounts]) => {
      const themes = toFacets(themeCounts, themeCounts.size);
      const total = themes.reduce((sum, facet) => sum + facet.count, 0);
      return {
        dateKey,
        total,
        dominantTheme: themes[0]?.value ?? 'calm',
        themes,
      };
    })
    .filter((day) => day.themes.length > 0 && Number.isFinite(day.total));
}

/**
 * Pure Tendances model (TI-426).
 *
 * Journal-only: no chat, messages, or analyzed-engagement counters. Inject `now`
 * and a local calendar so week, DST, and weekday math stay deterministic.
 */
export function buildDreamTrends(
  dreams: DreamAnalysis[],
  options: BuildDreamTrendsOptions = {},
): DreamTrends {
  const now = isFiniteTimestamp(options.now) ? options.now : Date.now();
  const calendar = resolveCalendar(options.calendar);
  const todayStart = calendar.startOfLocalDay(now);
  const weekStart = calendar.addLocalDays(todayStart, -(WEEK_DAYS - 1));

  const validDreams: DreamAnalysis[] = [];
  const weekDayCounts = new Map<number, number>();
  const weekDateKeys = new Set<string>();
  const themeCounts = new Map<DreamTheme, number>();
  const emotionCounts = new Map<EmotionFamilyId, number>();
  const typeCounts = new Map<DreamType, number>();
  const themedByDay = new Map<string, Map<DreamTheme, number>>();

  let weekCount = 0;
  let lastActivityAt: number | null = null;
  let firstAt: number | null = null;
  let recurrenceCount = 0;

  for (const dream of dreams) {
    if (!dream || !isFiniteTimestamp(dream.id) || dream.id > now) continue;
    const dayStart = calendar.startOfLocalDay(dream.id);
    if (!Number.isFinite(dayStart)) continue;

    validDreams.push(dream);

    if (lastActivityAt === null || dream.id > lastActivityAt) {
      lastActivityAt = dream.id;
    }
    if (firstAt === null || dream.id < firstAt) {
      firstAt = dream.id;
    }

    if (dayStart >= weekStart && dayStart <= todayStart) {
      weekCount += 1;
      weekDateKeys.add(calendar.localDateKey(dream.id));
      const weekday = calendar.weekday(dream.id);
      if (Number.isFinite(weekday)) {
        weekDayCounts.set(weekday, (weekDayCounts.get(weekday) ?? 0) + 1);
      }
    }

    if (DREAM_TYPES.has(dream.dreamType)) {
      increment(typeCounts, dream.dreamType);
    }
    if (dream.theme && DREAM_THEMES.has(dream.theme)) {
      increment(themeCounts, dream.theme);
      const dateKey = calendar.localDateKey(dream.id);
      const dayThemes = themedByDay.get(dateKey) ?? new Map<DreamTheme, number>();
      dayThemes.set(dream.theme, (dayThemes.get(dream.theme) ?? 0) + 1);
      themedByDay.set(dateKey, dayThemes);
    }
    if (isRecurringDream(dream)) {
      recurrenceCount += 1;
    }

    const seenFamilies = new Set<EmotionFamilyId>();
    for (const emotion of dream.emotions ?? []) {
      const name = typeof emotion?.name === 'string' ? emotion.name.trim() : '';
      if (!name) continue;
      const family = matchEmotionFamily(name);
      if (!family || seenFamilies.has(family)) continue;
      seenFamilies.add(family);
      increment(emotionCounts, family);
    }
  }

  const themes = toFacets(themeCounts);
  const types = toFacets(typeCounts);
  const emotions = toFacets(emotionCounts).filter((facet) => facet.count >= 2);
  const hasRecurrence = recurrenceCount > 0;
  // Types count as motifs. Empty means "nothing ready to show", not "no themes".
  const empty =
    validDreams.length < MIN_DREAMS_FOR_PATTERNS ||
    (themes.length === 0 && emotions.length === 0 && types.length === 0 && !hasRecurrence);

  const streak = calculateCalendarStreaks(
    validDreams.map((dream) => dream.id),
    now,
    calendar,
  );
  const averagePerWeek = usefulAveragePerWeek(validDreams.length, firstAt, now, calendar);
  const themePoints = buildThemePoints(themedByDay);

  return {
    week: {
      count: weekCount,
      activeDays: weekDateKeys.size,
      rhythm: ORDERED_WEEKDAYS.map((weekday) => ({
        weekday,
        count: weekDayCounts.get(weekday) ?? 0,
      })),
      lastActivityAt,
      streak,
      averagePerWeek,
    },
    patterns: {
      empty,
      themes,
      emotions,
      types,
      recurrence: { count: recurrenceCount, hasRecurrence },
    },
    evolution: {
      themePoints,
      days: groupDreamTrendEvolutionDays(themePoints),
      nextAction: resolveNextAction({
        validCount: validDreams.length,
        weekCount,
        activeDays: weekDateKeys.size,
      }),
    },
  };
}
