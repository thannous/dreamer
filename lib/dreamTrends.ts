import { isResumableAnalysisRequest } from '@/lib/analysisRequest';
import { DREAM_THEMES } from '@/lib/dreamThemes';
import { compareDreamFacets } from '@/lib/dreamFacets';
import { matchEmotionFamily, type EmotionFamilyId } from '@/lib/dreamEmotions';
import { isDreamAnalyzed } from '@/lib/dreamUsage';
import { startOfDay } from '@/lib/streakUtils';
import type { DreamAnalysis, DreamTheme, DreamType } from '@/lib/types';

/** The span the whole Tendances screen reads: the last 7 nights, the last 30, or the whole journal. */
export type DreamTrendsPeriod = '7' | '30' | 'all';
export const DREAM_TRENDS_PERIODS: readonly DreamTrendsPeriod[] = ['7', '30', 'all'];
export const DEFAULT_DREAM_TRENDS_PERIOD: DreamTrendsPeriod = '30';

const PERIOD_NIGHTS: Record<Exclude<DreamTrendsPeriod, 'all'>, number> = { '7': 7, '30': 30 };
const WEEK_DAYS = 7;
/** Below this many dreams, no theme "leads" and nothing is said to return. */
export const MIN_DREAMS_FOR_TRENDS = 3;
const MAX_MONTHS = 12;
const MAX_EMOTIONS = 3;
/** A share must move by more than this between two periods before an arrow says it rose or fell. */
const EMOTION_TREND_STEP = 0.1;
/** The richest night of the week is only named once there is enough to compare. */
const MIN_DREAMS_FOR_RICHEST_WEEKDAY = 4;
const KNOWN_THEMES: ReadonlySet<DreamTheme> = new Set(DREAM_THEMES);
// Unknown is deliberately not a motif: insufficient evidence must not become a pattern.
const DREAM_TYPES: ReadonlySet<DreamType> = new Set([
  'Lucid Dream',
  'Recurring Dream',
  'Nightmare',
  'Symbolic Dream',
  'Everyday Dream',
  'Fantastical Dream',
]);

export type DreamTrendsFacet<T extends string> = {
  value: T;
  count: number;
};

export type DreamTrendsShift = 'up' | 'down' | 'same';

export type DreamTrendsEmotion = {
  family: EmotionFamilyId;
  count: number;
  /** Of the period's analyzed dreams, the part that carries this emotion (0 to 1). */
  share: number;
  /** Against the previous period, when it had enough analyzed dreams to compare. */
  trend: DreamTrendsShift | null;
};

/** One night of the calendar, in or around the period. */
export type DreamTrendsNight = {
  dateKey: string;
  dayStart: number;
  /** 0 is Sunday, as `Date#getDay`. */
  weekday: number;
  inRange: boolean;
  isToday: boolean;
  /** Part of the run of nights that ends today or yesterday. */
  inStreak: boolean;
  /** The night's dreams, oldest first. Empty outside the period. */
  dreams: DreamAnalysis[];
};

export type DreamTrendsMonth = {
  /** `YYYY-MM`, local. */
  key: string;
  count: number;
  current: boolean;
};

export type DreamTrends = {
  period: DreamTrendsPeriod;
  /** No dream in the journal at all. */
  empty: boolean;
  /** Local day starts; `nights` counts both ends. */
  range: { start: number; end: number; nights: number };
  /** The span of the same length just before, compared with when it holds a dream. */
  previous: { start: number; end: number } | null;
  count: number;
  /** Against the previous period; null when it holds no dream to compare with. */
  countDelta: number | null;
  activeNights: number;
  activeNightsDelta: number | null;
  streak: { current: number; longest: number; dreamedToday: boolean };
  themes: {
    counts: Record<DreamTheme, number>;
    total: number;
    /** The one theme ahead of every other, once the period holds enough themed dreams. */
    dominant: DreamTheme | null;
    /** The previous period's counts, when it holds a themed dream. */
    previousCounts: Record<DreamTheme, number> | null;
  };
  /** The calendar of the 7 or 30 nights; empty for the whole journal. */
  nights: DreamTrendsNight[];
  /** The whole journal's months, the latest twelve; empty otherwise. */
  months: DreamTrendsMonth[];
  averagePerWeek: number | null;
  richestWeekday: number | null;
  lastActivityAt: number | null;
  patterns: {
    analyzed: number;
    unanalyzed: number;
    /** Unanalyzed dreams with no request under way or to resume: only these need a new analysis. */
    unrequested: number;
    /** Enough analyzed dreams in the period to say what returns. */
    ready: boolean;
    /** Ids of the period's analyzed dreams: what the symbols that return are counted in. */
    analyzedIds: number[];
    emotions: DreamTrendsEmotion[];
    types: DreamTrendsFacet<DreamType>[];
  };
};

export type DreamTrendsCalendar = {
  localDateKey: (timestamp: number) => string;
  startOfLocalDay: (timestamp: number) => number;
  addLocalDays: (startOfDayTimestamp: number, days: number) => number;
  weekday: (timestamp: number) => number;
};

export type BuildDreamTrendsOptions = {
  now?: number;
  period?: DreamTrendsPeriod;
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

const MAX_LOCAL_DAY_WALK = 366 * 40;

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

/** Consecutive local days, newest first, as the run that ends today or yesterday and the longest run. */
function calculateCalendarStreaks(
  dayStarts: number[],
  todayStart: number,
  calendar: DreamTrendsCalendar,
): { current: number; longest: number; currentDays: number[] } {
  const uniqueDays = Array.from(new Set(dayStarts)).sort((a, b) => b - a);
  if (uniqueDays.length === 0) return { current: 0, longest: 0, currentDays: [] };

  const follows = (newer: number, older: number) => calendar.addLocalDays(older, 1) === newer;
  const mostRecent = uniqueDays[0];
  const currentDays: number[] = [];
  if (mostRecent === todayStart || mostRecent === calendar.addLocalDays(todayStart, -1)) {
    currentDays.push(mostRecent);
    for (let index = 1; index < uniqueDays.length; index += 1) {
      if (!follows(uniqueDays[index - 1], uniqueDays[index])) break;
      currentDays.push(uniqueDays[index]);
    }
  }

  let longest = 1;
  let run = 1;
  for (let index = 1; index < uniqueDays.length; index += 1) {
    if (follows(uniqueDays[index - 1], uniqueDays[index])) {
      run += 1;
    } else {
      longest = Math.max(longest, run);
      run = 1;
    }
  }

  return {
    current: currentDays.length,
    longest: Math.max(longest, run, currentDays.length),
    currentDays,
  };
}

function emptyThemeCounts(): Record<DreamTheme, number> {
  return Object.fromEntries(DREAM_THEMES.map((theme) => [theme, 0])) as Record<DreamTheme, number>;
}

function countThemes(dreams: DreamAnalysis[]): { counts: Record<DreamTheme, number>; total: number } {
  const counts = emptyThemeCounts();
  let total = 0;
  for (const dream of dreams) {
    if (dream.theme && KNOWN_THEMES.has(dream.theme)) {
      counts[dream.theme] += 1;
      total += 1;
    }
  }
  return { counts, total };
}

/** The single theme ahead of all others; a tie, or too few dreams, leads nowhere. */
function dominantTheme(counts: Record<DreamTheme, number>, total: number): DreamTheme | null {
  if (total < MIN_DREAMS_FOR_TRENDS) return null;
  let best: DreamTheme | null = null;
  let tied = false;
  for (const theme of DREAM_THEMES) {
    const count = counts[theme];
    if (best === null || count > counts[best]) {
      best = theme;
      tied = false;
    } else if (count === counts[best]) {
      tied = true;
    }
  }
  return best && !tied && counts[best] > 0 ? best : null;
}

function emotionFamilies(dream: DreamAnalysis): Set<EmotionFamilyId> {
  const families = new Set<EmotionFamilyId>();
  for (const emotion of dream.emotions ?? []) {
    const name = typeof emotion?.name === 'string' ? emotion.name.trim() : '';
    if (!name) continue;
    const family = matchEmotionFamily(name);
    if (family) families.add(family);
  }
  return families;
}

function emotionCounts(dreams: DreamAnalysis[]): Map<EmotionFamilyId, number> {
  const counts = new Map<EmotionFamilyId, number>();
  for (const dream of dreams) {
    for (const family of emotionFamilies(dream)) {
      counts.set(family, (counts.get(family) ?? 0) + 1);
    }
  }
  return counts;
}

function toFacets<T extends string>(map: Map<T, number>): DreamTrendsFacet<T>[] {
  return Array.from(map.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => compareDreamFacets(a.count, a.value, b.count, b.value));
}

function shiftOf(current: number, previous: number): DreamTrendsShift {
  if (current - previous > EMOTION_TREND_STEP) return 'up';
  if (previous - current > EMOTION_TREND_STEP) return 'down';
  return 'same';
}

/**
 * Pure Tendances model.
 *
 * Journal-only: no chat, messages, or analyzed-engagement counters. Inject `now`
 * and a local calendar so period, DST, and weekday math stay deterministic. Every
 * figure reads the chosen period; the streak and the last dream read the whole journal.
 */
export function buildDreamTrends(
  dreams: DreamAnalysis[],
  options: BuildDreamTrendsOptions = {},
): DreamTrends {
  const now = isFiniteTimestamp(options.now) ? options.now : Date.now();
  const period = options.period ?? DEFAULT_DREAM_TRENDS_PERIOD;
  const calendar = resolveCalendar(options.calendar);
  const todayStart = calendar.startOfLocalDay(now);

  const valid: { dream: DreamAnalysis; dayStart: number }[] = [];
  for (const dream of dreams) {
    if (!dream || !isFiniteTimestamp(dream.id) || dream.id > now) continue;
    const dayStart = calendar.startOfLocalDay(dream.id);
    if (!Number.isFinite(dayStart)) continue;
    valid.push({ dream, dayStart });
  }

  let firstDay: number | null = null;
  let lastActivityAt: number | null = null;
  for (const { dream, dayStart } of valid) {
    if (firstDay === null || dayStart < firstDay) firstDay = dayStart;
    if (lastActivityAt === null || dream.id > lastActivityAt) lastActivityAt = dream.id;
  }

  const nightsInPeriod = period === 'all' ? null : PERIOD_NIGHTS[period];
  const rangeStart = nightsInPeriod === null
    ? Math.min(firstDay ?? todayStart, todayStart)
    : calendar.addLocalDays(todayStart, -(nightsInPeriod - 1));
  const rangeNights = nightsInPeriod ?? inclusiveLocalDayCount(rangeStart, todayStart, calendar) ?? 1;
  const previous = nightsInPeriod === null
    ? null
    : { start: calendar.addLocalDays(rangeStart, -nightsInPeriod), end: calendar.addLocalDays(rangeStart, -1) };

  const inRange = valid.filter(({ dayStart }) => dayStart >= rangeStart && dayStart <= todayStart);
  const inPrevious = previous
    ? valid.filter(({ dayStart }) => dayStart >= previous.start && dayStart <= previous.end)
    : [];
  const periodDreams = inRange.map(({ dream }) => dream);
  const previousDreams = inPrevious.map(({ dream }) => dream);

  const activeKeys = new Set(inRange.map(({ dream }) => calendar.localDateKey(dream.id)));
  const previousActiveKeys = new Set(inPrevious.map(({ dream }) => calendar.localDateKey(dream.id)));
  const comparable = previousDreams.length > 0;

  const streak = calculateCalendarStreaks(valid.map(({ dayStart }) => dayStart), todayStart, calendar);
  const streakDays = new Set(streak.currentDays);
  const dreamedToday = valid.some(({ dayStart }) => dayStart === todayStart);

  const themes = countThemes(periodDreams);
  const previousThemes = countThemes(previousDreams);

  // The calendar: 7 nights in a row, or 30 laid out in whole weeks from Monday.
  const nights: DreamTrendsNight[] = [];
  if (nightsInPeriod !== null) {
    const byDay = new Map<number, DreamAnalysis[]>();
    for (const { dream, dayStart } of [...inRange].sort((a, b) => a.dream.id - b.dream.id)) {
      const list = byDay.get(dayStart) ?? [];
      list.push(dream);
      byDay.set(dayStart, list);
    }
    let first = rangeStart;
    let last = todayStart;
    if (nightsInPeriod > WEEK_DAYS) {
      first = calendar.addLocalDays(rangeStart, -((calendar.weekday(rangeStart) + 6) % 7));
      last = calendar.addLocalDays(todayStart, (7 - calendar.weekday(todayStart)) % 7);
    }
    for (let cursor = first, guard = 0; cursor <= last && guard < 7 * 7; guard += 1) {
      const within = cursor >= rangeStart && cursor <= todayStart;
      nights.push({
        dateKey: calendar.localDateKey(cursor),
        dayStart: cursor,
        weekday: calendar.weekday(cursor),
        inRange: within,
        isToday: cursor === todayStart,
        inStreak: within && streakDays.has(cursor),
        dreams: within ? byDay.get(cursor) ?? [] : [],
      });
      const next = calendar.addLocalDays(cursor, 1);
      if (!Number.isFinite(next) || next <= cursor) break;
      cursor = next;
    }
  }

  const months: DreamTrendsMonth[] = [];
  if (period === 'all' && firstDay !== null) {
    const counts = new Map<string, number>();
    for (const { dream } of inRange) {
      const key = calendar.localDateKey(dream.id).slice(0, 7);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const currentKey = calendar.localDateKey(todayStart).slice(0, 7);
    const [firstYear, firstMonth] = calendar.localDateKey(firstDay).slice(0, 7).split('-').map(Number);
    const [lastYear, lastMonth] = currentKey.split('-').map(Number);
    for (let year = firstYear, month = firstMonth; year < lastYear || (year === lastYear && month <= lastMonth);) {
      const key = `${year}-${`${month}`.padStart(2, '0')}`;
      months.push({ key, count: counts.get(key) ?? 0, current: key === currentKey });
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }

  // Per week: the period's own pace once it covers a full week of the journal; for
  // 7 nights, which would only repeat its count, and for the whole journal, the journal's.
  let averagePerWeek: number | null = null;
  const averageOver = (count: number, from: number) => {
    const span = inclusiveLocalDayCount(from, todayStart, calendar);
    if (count <= 0 || span == null || span < WEEK_DAYS) return null;
    const average = count / (span / WEEK_DAYS);
    return Number.isFinite(average) ? average : null;
  };
  if (firstDay !== null) {
    averagePerWeek = period === '30'
      ? averageOver(periodDreams.length, Math.max(rangeStart, firstDay))
      : averageOver(valid.length, firstDay);
  }

  let richestWeekday: number | null = null;
  if (periodDreams.length >= MIN_DREAMS_FOR_RICHEST_WEEKDAY) {
    const byWeekday = new Map<number, number>();
    for (const dream of periodDreams) {
      const weekday = calendar.weekday(dream.id);
      if (Number.isFinite(weekday)) byWeekday.set(weekday, (byWeekday.get(weekday) ?? 0) + 1);
    }
    const ranked = Array.from(byWeekday.entries()).sort((a, b) => b[1] - a[1]);
    if (ranked.length > 0 && (ranked.length === 1 || ranked[0][1] > ranked[1][1])) {
      richestWeekday = ranked[0][0];
    }
  }

  const analyzedDreams = periodDreams.filter((dream) => isDreamAnalyzed(dream));
  const previousAnalyzed = previousDreams.filter((dream) => isDreamAnalyzed(dream));
  const ready = analyzedDreams.length >= MIN_DREAMS_FOR_TRENDS;
  const previousEmotions = previousAnalyzed.length >= MIN_DREAMS_FOR_TRENDS ? emotionCounts(previousAnalyzed) : null;
  const emotions: DreamTrendsEmotion[] = ready
    ? toFacets(emotionCounts(analyzedDreams))
      .filter((facet) => facet.count >= 2)
      .slice(0, MAX_EMOTIONS)
      .map(({ value, count }) => {
        const share = count / analyzedDreams.length;
        return {
          family: value,
          count,
          share,
          trend: previousEmotions
            ? shiftOf(share, (previousEmotions.get(value) ?? 0) / previousAnalyzed.length)
            : null,
        };
      })
    : [];
  const typeCounts = new Map<DreamType, number>();
  if (ready) {
    for (const dream of analyzedDreams) {
      if (DREAM_TYPES.has(dream.dreamType)) {
        typeCounts.set(dream.dreamType, (typeCounts.get(dream.dreamType) ?? 0) + 1);
      }
    }
  }

  return {
    period,
    empty: valid.length === 0,
    range: { start: rangeStart, end: todayStart, nights: rangeNights },
    previous,
    count: periodDreams.length,
    countDelta: comparable ? periodDreams.length - previousDreams.length : null,
    activeNights: activeKeys.size,
    activeNightsDelta: comparable ? activeKeys.size - previousActiveKeys.size : null,
    streak: { current: streak.current, longest: streak.longest, dreamedToday },
    themes: {
      counts: themes.counts,
      total: themes.total,
      dominant: dominantTheme(themes.counts, themes.total),
      previousCounts: previousThemes.total > 0 ? previousThemes.counts : null,
    },
    nights,
    months: months.slice(-MAX_MONTHS),
    averagePerWeek,
    richestWeekday,
    lastActivityAt,
    patterns: {
      analyzed: analyzedDreams.length,
      unanalyzed: periodDreams.length - analyzedDreams.length,
      unrequested: periodDreams.filter((dream) => !isDreamAnalyzed(dream) && !isResumableAnalysisRequest(dream)).length,
      ready,
      analyzedIds: analyzedDreams.map((dream) => dream.id),
      emotions,
      types: toFacets(typeCounts),
    },
  };
}
