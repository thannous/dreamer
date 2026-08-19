import { isDreamAnalyzed, isDreamExplored } from '@/lib/dreamUsage';
import type { DreamAnalysis, DreamTheme } from '@/lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;
export const PERSONAL_READING_WINDOW_DAYS = 30;

export type PersonalReading = {
  /** Dreams recorded in the window (any status). */
  windowDreamCount: number;
  analyzedInWindow: number;
  /** Symbol present in ≥ 2 analyzed dreams of the window, most frequent first. */
  recurringSymbol: { name: string; count: number } | null;
  /** Theme present in ≥ 2 analyzed dreams of the window when no symbol repeats. */
  recurringTheme: { theme: DreamTheme; count: number } | null;
  /** Most recent analyzed-but-not-explored dream (any age). */
  dreamToExplore: DreamAnalysis | null;
  /** Most recent dream still waiting for an analysis (any age). */
  dreamToAnalyze: DreamAnalysis | null;
};

const normalize = (name: string): string => name.trim().toLowerCase();

/**
 * The home screen's "reading of the day": what keeps coming back in the last
 * thirty days and the single next best action on the journal. Pure and cheap —
 * one pass over the dreams — so it can run on every render of the home tab.
 */
export function buildPersonalReading(dreams: DreamAnalysis[], now: number = Date.now()): PersonalReading {
  const windowStart = now - PERSONAL_READING_WINDOW_DAYS * DAY_MS;
  const symbolCounts = new Map<string, { name: string; count: number }>();
  const themeCounts = new Map<DreamTheme, number>();
  let windowDreamCount = 0;
  let analyzedInWindow = 0;
  let dreamToExplore: DreamAnalysis | null = null;
  let dreamToAnalyze: DreamAnalysis | null = null;

  const sorted = [...dreams].sort((a, b) => b.id - a.id);
  for (const dream of sorted) {
    if (typeof dream.id !== 'number') continue;
    const analyzed = isDreamAnalyzed(dream);
    if (analyzed) {
      if (!dreamToExplore && !isDreamExplored(dream)) dreamToExplore = dream;
    } else if (!dreamToAnalyze) {
      dreamToAnalyze = dream;
    }
    if (dream.id < windowStart) continue;
    windowDreamCount += 1;
    if (!analyzed) continue;
    analyzedInWindow += 1;
    if (dream.theme) themeCounts.set(dream.theme, (themeCounts.get(dream.theme) ?? 0) + 1);
    const seen = new Set<string>();
    for (const symbol of dream.symbols ?? []) {
      const key = normalize(symbol?.name ?? '');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const entry = symbolCounts.get(key) ?? { name: symbol.name.trim(), count: 0 };
      entry.count += 1;
      symbolCounts.set(key, entry);
    }
  }

  let recurringSymbol: PersonalReading['recurringSymbol'] = null;
  for (const entry of symbolCounts.values()) {
    if (entry.count >= 2 && (!recurringSymbol || entry.count > recurringSymbol.count)) {
      recurringSymbol = { name: entry.name, count: entry.count };
    }
  }

  let recurringTheme: PersonalReading['recurringTheme'] = null;
  for (const [theme, count] of themeCounts) {
    if (count >= 2 && (!recurringTheme || count > recurringTheme.count)) {
      recurringTheme = { theme, count };
    }
  }

  return { windowDreamCount, analyzedInWindow, recurringSymbol, recurringTheme, dreamToExplore, dreamToAnalyze };
}
