import { isDreamAnalyzed } from '@/lib/dreamUsage';
import type { LinkedSymbol, SymbolIndex } from '@/lib/symbolLinks';
import type { DreamAnalysis, DreamTheme } from '@/lib/types';

/** Nights with a dream, Monday to Sunday, that make a week form its constellation. */
export const CONSTELLATION_NIGHTS = 5;

/** A calendar week of nights, Monday first. */
export type WeekNights = {
  /** Its Monday's local midnight, and the next Monday's. */
  start: number;
  end: number;
  /** Whether a dream was noted on each day, Monday first. */
  nights: boolean[];
  count: number;
  /** The week's dreams, oldest first. */
  dreams: DreamAnalysis[];
  formed: boolean;
};

/** The local midnight of the Monday that opens a moment's week. */
export function startOfWeek(timestamp: number): number {
  const day = new Date(timestamp);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - ((day.getDay() + 6) % 7)).getTime();
}

const dayOfWeek = (timestamp: number) => (new Date(timestamp).getDay() + 6) % 7;

function weekFrom(start: number, dreams: DreamAnalysis[]): WeekNights {
  const monday = new Date(start);
  const end = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7).getTime();
  const nights = Array.from({ length: 7 }, () => false);
  for (const dream of dreams) nights[dayOfWeek(dream.id)] = true;
  const count = nights.filter(Boolean).length;
  return { start, end, nights, count, dreams: [...dreams].sort((a, b) => a.id - b.id), formed: count >= CONSTELLATION_NIGHTS };
}

function groupByWeek(dreams: readonly DreamAnalysis[]): Map<number, DreamAnalysis[]> {
  const weeks = new Map<number, DreamAnalysis[]>();
  for (const dream of dreams) {
    if (!Number.isFinite(dream.id)) continue;
    const start = startOfWeek(dream.id);
    const week = weeks.get(start);
    if (week) week.push(dream);
    else weeks.set(start, [dream]);
  }
  return weeks;
}

/** The week under way, with the nights noted since Monday. */
export function getWeekNights(dreams: readonly DreamAnalysis[], now: number): WeekNights {
  const start = startOfWeek(now);
  return weekFrom(start, dreams.filter((dream) => Number.isFinite(dream.id) && startOfWeek(dream.id) === start));
}

/** Every week that formed its constellation, the newest first. */
export function getFormedWeeks(dreams: readonly DreamAnalysis[]): WeekNights[] {
  return [...groupByWeek(dreams)]
    .map(([start, week]) => weekFrom(start, week))
    .filter((week) => week.formed)
    .sort((a, b) => b.start - a.start);
}

/** Whether the days left in the week can still bring it to its constellation. */
export function canStillForm(week: WeekNights, now: number): boolean {
  if (week.formed) return true;
  const today = dayOfWeek(now);
  const open = week.nights.filter((noted, day) => !noted && day >= today).length;
  return week.count + open >= CONSTELLATION_NIGHTS;
}

/**
 * What a formed week is named after: the symbol its readings hold most often, the dreamer's
 * own before the dictionary's on a tie, else the theme most of its dreams share.
 */
export function nameWeek(
  week: WeekNights,
  index: SymbolIndex | null,
): { symbol: LinkedSymbol } | { theme: DreamTheme } | null {
  const analyzed = new Set(week.dreams.filter(isDreamAnalyzed).map((dream) => dream.id));
  let best: { symbol: LinkedSymbol; count: number; last: number } | null = null;
  for (const symbol of index?.symbols.values() ?? []) {
    const seen = symbol.appearances.filter(({ dream }) => analyzed.has(dream.id));
    if (seen.length === 0) continue;
    const candidate = { symbol, count: seen.length, last: seen[seen.length - 1].dream.id };
    if (!best || candidate.count > best.count || (candidate.count === best.count && (candidate.last > best.last
      || (candidate.last === best.last && symbol.kind === 'personal' && best.symbol.kind !== 'personal')))) {
      best = candidate;
    }
  }
  if (best) return { symbol: best.symbol };
  const themes = new Map<DreamTheme, number>();
  for (const dream of week.dreams) if (dream.theme) themes.set(dream.theme, (themes.get(dream.theme) ?? 0) + 1);
  const theme = [...themes].sort((a, b) => b[1] - a[1])[0];
  return theme ? { theme: theme[0] } : null;
}

/** A star's height in its week's figure, between 0 and 1: scattered, yet the same at every visit. */
export function starHeight(weekStart: number, day: number): number {
  let hash = (Math.floor(weekStart / 1000) + day * 0x9e3779b9) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}
