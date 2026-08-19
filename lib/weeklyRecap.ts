import { buildEmotionProfile, type EmotionFamilyId } from '@/lib/dreamEmotions';
import { isDreamAnalyzed, isDreamExplored } from '@/lib/dreamUsage';
import { calculateStreaks, startOfDay } from '@/lib/streakUtils';
import type { DreamAnalysis, DreamTheme } from '@/lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEKLY_RECAP_ROUTE = '/weekly-recap' as const;

export type WeeklyRecapSymbol = { name: string; count: number };

export type WeeklyRecap = {
  /** Local midnight, 7 days before `weekEnd`'s day (inclusive). */
  weekStart: number;
  /** Local midnight of the reference day (the recap covers weekStart..now). */
  weekEnd: number;
  dreamCount: number;
  previousWeekCount: number;
  analyzedCount: number;
  currentStreak: number;
  topTheme: { theme: DreamTheme; count: number } | null;
  /** Emotion family present in the most dreams this week (needs ≥ 2 dreams with emotions). */
  topEmotion: { family: EmotionFamilyId; count: number } | null;
  /** Symbol name repeated across at least two dreams this week. */
  topSymbol: WeeklyRecapSymbol | null;
  /** Most recent analyzed-but-not-explored dream of the week. */
  dreamToExplore: DreamAnalysis | null;
  /** Most recent dream of the week that has no analysis yet. */
  dreamToAnalyze: DreamAnalysis | null;
};

const normalizeSymbol = (name: string): string => name.trim().toLowerCase();

/**
 * Pure aggregation for the "your week in dreams" screen. `now` is injectable so
 * the recap can be rendered for the week that just ended (Sunday morning push)
 * and unit-tested deterministically.
 */
export function buildWeeklyRecap(dreams: DreamAnalysis[], now: number = Date.now()): WeeklyRecap {
  const weekEnd = startOfDay(now).getTime() + DAY_MS; // exclusive upper bound: end of today
  const weekStart = weekEnd - 7 * DAY_MS;
  const previousWeekStart = weekStart - 7 * DAY_MS;

  const week: DreamAnalysis[] = [];
  let previousWeekCount = 0;
  for (const dream of dreams) {
    if (typeof dream.id !== 'number') continue;
    if (dream.id >= weekStart && dream.id < weekEnd) {
      week.push(dream);
    } else if (dream.id >= previousWeekStart && dream.id < weekStart) {
      previousWeekCount += 1;
    }
  }
  week.sort((a, b) => b.id - a.id);

  const themeCount = new Map<DreamTheme, number>();
  const symbolCount = new Map<string, { name: string; dreams: number }>();
  let analyzedCount = 0;
  let dreamToExplore: DreamAnalysis | null = null;
  let dreamToAnalyze: DreamAnalysis | null = null;

  for (const dream of week) {
    const analyzed = isDreamAnalyzed(dream);
    if (analyzed) {
      analyzedCount += 1;
      if (dream.theme) {
        themeCount.set(dream.theme, (themeCount.get(dream.theme) ?? 0) + 1);
      }
      if (!dreamToExplore && !isDreamExplored(dream)) {
        dreamToExplore = dream;
      }
      const seen = new Set<string>();
      for (const symbol of dream.symbols ?? []) {
        const key = normalizeSymbol(symbol?.name ?? '');
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const entry = symbolCount.get(key) ?? { name: symbol.name.trim(), dreams: 0 };
        entry.dreams += 1;
        symbolCount.set(key, entry);
      }
    } else if (!dreamToAnalyze) {
      dreamToAnalyze = dream;
    }
  }

  let topTheme: WeeklyRecap['topTheme'] = null;
  for (const [theme, count] of themeCount) {
    if (!topTheme || count > topTheme.count) topTheme = { theme, count };
  }

  let topSymbol: WeeklyRecapSymbol | null = null;
  for (const entry of symbolCount.values()) {
    if (entry.dreams < 2) continue;
    if (!topSymbol || entry.dreams > topSymbol.count) {
      topSymbol = { name: entry.name, count: entry.dreams };
    }
  }

  const emotionProfile = buildEmotionProfile(week);
  const leadingFamily = emotionProfile.families[0];
  const topEmotion =
    leadingFamily && emotionProfile.dreamsWithEmotions >= 2
      ? { family: leadingFamily.family, count: leadingFamily.count }
      : null;

  return {
    weekStart,
    weekEnd: weekEnd - DAY_MS,
    dreamCount: week.length,
    previousWeekCount,
    analyzedCount,
    currentStreak: calculateStreaks(dreams, now).current,
    topTheme,
    topEmotion,
    topSymbol,
    dreamToExplore,
    dreamToAnalyze,
  };
}
