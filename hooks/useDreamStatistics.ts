import { useMemo, useState } from 'react';
import { compareDreamFacets } from '@/lib/dreamFacets';
import { UNKNOWN_DREAM_TYPE, type DreamTypeKey } from '@/lib/dreamLabels';
import { getUserChatMessageCount, isDreamAnalyzed, isDreamExplored } from '@/lib/dreamUsage';
import { calculateStreaks, isWithinDays, startOfDay } from '@/lib/streakUtils';
import type { DreamAnalysis, DreamTheme } from '@/lib/types';

export interface DreamStatistics {
  totalDreams: number;
  favoriteDreams: number;
  dreamsThisWeek: number;
  dreamsThisMonth: number;
  currentStreak: number;
  longestStreak: number;
  averageDreamsPerWeek: number;

  // Time-based data
  dreamsByDay: { weekday: number; count: number }[];
  /**
   * Activity series over the window the caller asked for, anchored on today: the last entry
   * is always the current bucket. Each `timestamp` is the local midnight the bucket starts on.
   */
  dreamsOverTime: { timestamp: number; count: number }[];
  /**
   * Days covered by each `dreamsOverTime` entry. 1 until the window needs more than
   * TIME_SERIES_MAX_POINTS points. A renderer must read it before labelling a point with a
   * single date — under '12 months' one point is a fortnight, not a day.
   */
  dreamsOverTimeBucketDays: number;

  // Content analysis
  dreamTypeDistribution: { type: DreamTypeKey; count: number; percentage: number }[];
  topThemes: { theme: DreamTheme; count: number }[];

  // Engagement
  totalChatMessages: number;
  dreamsWithChat: number;
  analyzedDreams: number;
  mostDiscussedDream: DreamAnalysis | null;
  mostDiscussedDreamUserMessages: number;
}

const ORDERED_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Window `dreamsOverTime` covers when the caller does not name one. Kept at 30 so the single
 * argument call — the shape every caller used before the window became explicit — returns the
 * exact series it always did.
 */
export const DEFAULT_STATS_WINDOW_DAYS = 30;

/**
 * Point ceiling, mirroring THEME_TREND_MAX_POINTS on the statistics screen and there for the
 * same reason: '12 months' would otherwise be 365 entries and 'all time' one per day of the
 * journal, recomputed on every change of the dream list.
 */
const TIME_SERIES_MAX_POINTS = 30;

// Math.round, not Math.floor: startOfDay() returns local midnight, and across a DST boundary
// a one-day gap is 23 or 25 hours, which floor() would count as zero days.
const dayDiff = (fromDayStart: number, toDayStart: number) =>
  Math.round((toDayStart - fromDayStart) / DAY_IN_MS);

/**
 * `null` (all time) resolves to the span the journal actually covers; anything else is the
 * requested window, NOT clamped to that span. A 12-month window over a three-week journal has
 * to keep its empty buckets — shrinking it would answer a question the user did not ask and
 * would make "12 months" and "7 days" draw the same picture.
 */
const resolveWindowDays = (windowDays: number | null, observedDays: number) =>
  windowDays === null || !Number.isFinite(windowDays)
    ? observedDays
    : Math.max(1, Math.floor(windowDays));

/**
 * @param dreams Dreams to describe. The caller filters them; this hook never does.
 * @param windowDays Days `dreamsOverTime` spans, or `null` for the whole journal. An
 *   already-filtered array carries no trace of the filter that produced it, so the window has
 *   to be handed in: without it the series would keep answering "last 30 days" while every
 *   other number on the screen answered the selected period.
 */
export const useDreamStatistics = (
  dreams: DreamAnalysis[],
  windowDays: number | null = DEFAULT_STATS_WINDOW_DAYS,
): DreamStatistics => {
  const [now] = useState(() => Date.now());

  return useMemo(() => {
    const effectiveNow = now;

    const totalDreams = dreams.length;
    let favoriteDreams = 0;
    let dreamsThisWeek = 0;
    let dreamsThisMonth = 0;

    const streaks = calculateStreaks(dreams, effectiveNow, { sortedDescending: true });
    const currentStreak = streaks.current;
    const longestStreak = streaks.longest;

    let firstDreamDate = effectiveNow;

    const dayCount = new Map<number, number>();
    const dateCount = new Map<number, number>();
    const typeCount = new Map<DreamTypeKey, number>();
    const themeCount = new Map<DreamTheme, number>();
    let totalChatMessages = 0;
    let dreamsWithChat = 0;
    let analyzedDreams = 0;
    let mostDiscussedDream: DreamAnalysis | null = null;
    let mostDiscussedDreamUserMessages = 0;

    dreams.forEach(dream => {
      if (dream.isFavorite) {
        favoriteDreams += 1;
      }

      if (isWithinDays(dream.id, 7, effectiveNow)) {
        dreamsThisWeek += 1;
      }

      const isWithinMonth = isWithinDays(dream.id, 30, effectiveNow);
      if (isWithinMonth) {
        dreamsThisMonth += 1;
      }

      if (dream.id < firstDreamDate) {
        firstDreamDate = dream.id;
      }

      const day = new Date(dream.id).getDay();
      dayCount.set(day, (dayCount.get(day) || 0) + 1);

      // Every dream, not only the last 30 days: the window is resolved after this loop (for
      // 'all time' it depends on `firstDreamDate`), and the bucketing below drops whatever
      // falls outside it. One entry per distinct day, so this stays bounded by the journal's
      // span rather than its size.
      const dayTimestamp = startOfDay(dream.id).getTime();
      dateCount.set(dayTimestamp, (dateCount.get(dayTimestamp) || 0) + 1);

      // The annotation is required: `dreamType` is declared non-optional, so TS
      // discards the never-falsy fallback and would infer plain `DreamType`,
      // hiding the sentinel from every consumer.
      const type: DreamTypeKey = dream.dreamType || UNKNOWN_DREAM_TYPE;
      typeCount.set(type, (typeCount.get(type) || 0) + 1);
      if (dream.theme) {
        themeCount.set(dream.theme, (themeCount.get(dream.theme) || 0) + 1);
      }

      if (isDreamExplored(dream)) {
        dreamsWithChat += 1;
      }

      if (isDreamAnalyzed(dream)) {
        analyzedDreams += 1;
      }

      const userMessages = getUserChatMessageCount(dream);
      totalChatMessages += userMessages;
      if (userMessages > mostDiscussedDreamUserMessages) {
        mostDiscussedDream = dream;
        mostDiscussedDreamUserMessages = userMessages;
      }
    });

    const dreamsByDay = ORDERED_WEEKDAYS.map(weekday => ({
      weekday,
      count: dayCount.get(weekday) || 0,
    }));

    const weeksSinceFirst = Math.max(1, Math.floor((effectiveNow - firstDreamDate) / (7 * 24 * 60 * 60 * 1000)));
    const averageDreamsPerWeek = totalDreams / weeksSinceFirst;

    // Anchored on today so the right edge always means "now", whatever the window.
    const today = startOfDay(effectiveNow);
    const dayStartOffsetBy = (days: number) => {
      const date = new Date(today);
      // setDate(), not an arithmetic offset: it lands on local midnight even across a DST
      // boundary, where a day is not 24 hours.
      date.setDate(date.getDate() + days);
      return date.getTime();
    };

    const observedDays = Math.max(
      1,
      dayDiff(startOfDay(firstDreamDate).getTime(), today.getTime()) + 1,
    );
    const resolvedWindowDays = resolveWindowDays(windowDays, observedDays);
    const dreamsOverTimeBucketDays = Math.max(
      1,
      Math.ceil(resolvedWindowDays / TIME_SERIES_MAX_POINTS),
    );
    const pointCount = Math.max(1, Math.ceil(resolvedWindowDays / dreamsOverTimeBucketDays));
    const firstDayOffset = -(resolvedWindowDays - 1);
    const windowStart = dayStartOffsetBy(firstDayOffset);

    const dreamsOverTime = Array.from({ length: pointCount }, (_, index) => ({
      timestamp: dayStartOffsetBy(firstDayOffset + index * dreamsOverTimeBucketDays),
      count: 0,
    }));

    dateCount.forEach((count, dayTimestamp) => {
      const offset = dayDiff(windowStart, dayTimestamp);
      if (offset < 0 || offset >= resolvedWindowDays) return;
      // The last bucket absorbs the remainder when the window is not a whole number of
      // buckets: 365 days in 13-day buckets leaves a short final one, and a dream recorded
      // today must not fall past the end of the array.
      const bucket = Math.min(Math.floor(offset / dreamsOverTimeBucketDays), pointCount - 1);
      dreamsOverTime[bucket].count += count;
    });

    const dreamTypeDistribution = Array.from(typeCount.entries())
      .map(([type, count]) => ({
        type,
        count,
        percentage: totalDreams > 0 ? Math.round((count / totalDreams) * 100) : 0,
      }))
      .sort((a, b) => compareDreamFacets(a.count, a.type, b.count, b.type));

    const topThemes = Array.from(themeCount.entries())
      .map(([theme, count]) => ({ theme, count }))
      .sort((a, b) => compareDreamFacets(a.count, a.theme, b.count, b.theme))
      .slice(0, 5);

    if (mostDiscussedDreamUserMessages === 0) {
      mostDiscussedDream = null;
    }

    return {
      totalDreams,
      favoriteDreams,
      dreamsThisWeek,
      dreamsThisMonth,
      currentStreak,
      longestStreak,
      averageDreamsPerWeek,
      dreamsByDay,
      dreamsOverTime,
      dreamsOverTimeBucketDays,
      dreamTypeDistribution,
      topThemes,
      totalChatMessages,
      dreamsWithChat,
      analyzedDreams,
      mostDiscussedDream,
      mostDiscussedDreamUserMessages,
    };
  }, [dreams, now, windowDays]);
};
