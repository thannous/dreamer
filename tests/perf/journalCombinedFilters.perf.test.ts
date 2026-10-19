import { describe, expect, it } from 'vitest';

import { applyFilters } from '../../lib/dreamFilters';
import type { DreamAnalysis } from '../../lib/types';

const DREAM_COUNT = 8_000;
const RUNS = 8;
const WARMUP_RUNS = 2;
const MAX_AVG_MS = 80;
const MAX_RATIO = 6;
const now = Date.now();
const themes = ['surreal', 'mystical', 'calm', 'noir', 'luminous', 'nostalgic'] as const;
const dreamTypes = ['Lucid Dream', 'Recurring Dream', 'Nightmare', 'Symbolic Dream'] as const;

// Filtering needs a repeatable mixed corpus, not Metro's bundled image gallery.
// Separate periods for text, themes and types keep their intersections nonempty.

const dreams: DreamAnalysis[] = Array.from({ length: DREAM_COUNT }, (_, index) => ({
  id: now - index * 60_000,
  title: index % 2 === 0 ? 'Flying Over the Ocean' : 'Running Through a Forest',
  transcript: index % 2 === 0
    ? 'I was flying high above the ocean, feeling completely free. The water was crystal clear below me.'
    : 'I was running through a dense forest, jumping over roots and ducking under branches. My heart was racing.',
  shareableQuote: 'Every dream is a journey within.',
  theme: themes[Math.floor(index / 3) % themes.length],
  dreamType: dreamTypes[Math.floor(index / 5) % dreamTypes.length],
  imageUrl: '',
  chatHistory: [],
  isFavorite: index % 5 === 0,
  isAnalyzed: index % 3 === 0,
  analysisStatus: (index % 3 === 0 ? 'done' : 'none') as DreamAnalysis['analysisStatus'],
  analyzedAt: index % 3 === 0 ? now - index * 60_000 : undefined,
  interpretation: index % 3 === 0 ? 'A complete reading.' : '',
  explorationStartedAt: index % 11 === 0 ? now - index * 60_000 : undefined,
  memory: index % 7 === 0
    ? {
        origin: 'remembered' as const,
        ...(index % 14 === 0 ? { rememberedKind: 'recurring' as const, recurring: true } : {}),
      }
    : undefined,
}));

const getNow = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

function runSearchOnly() {
  return applyFilters(dreams, { searchQuery: 'ocean' });
}

function runCombined() {
  return applyFilters(dreams, {
    searchQuery: 'ocean',
    theme: 'calm',
    dreamType: 'Nightmare',
    favoritesOnly: true,
    rememberedOnly: true,
    recurringOnly: true,
    needsExplorationOnly: true,
    startDate: new Date(now - 14 * 24 * 60 * 60 * 1000),
    endDate: new Date(now),
  });
}

describe('perf(journalCombinedFilters)', () => {
  it('keeps a combined journal filter pass within a non-flaky ratio of the unfiltered path', () => {
    expect(runSearchOnly()).toHaveLength(DREAM_COUNT / 2);
    // Exact matches make an empty/ignored combined filter fail before timing it.
    expect(runCombined().map((dream) => (now - dream.id) / 60_000))
      .toEqual([1050, 3570, 4830, 6090, 7350]);

    for (let index = 0; index < WARMUP_RUNS; index += 1) {
      runSearchOnly();
      runCombined();
    }

    const searchStart = getNow();
    for (let index = 0; index < RUNS; index += 1) {
      runSearchOnly();
    }
    const searchAvgMs = (getNow() - searchStart) / RUNS;

    const combinedStart = getNow();
    for (let index = 0; index < RUNS; index += 1) {
      runCombined();
    }
    const combinedAvgMs = (getNow() - combinedStart) / RUNS;
    const ratio = combinedAvgMs / Math.max(searchAvgMs, 0.2);

    console.log(
      `[perf] journalCombinedFilters avg ${combinedAvgMs.toFixed(2)}ms vs search ${searchAvgMs.toFixed(2)}ms ratio ${ratio.toFixed(2)} over ${RUNS} runs (n=${DREAM_COUNT})`
    );

    expect(combinedAvgMs).toBeGreaterThan(0);
    expect(combinedAvgMs).toBeLessThan(MAX_AVG_MS);
    expect(ratio).toBeLessThan(MAX_RATIO);
  });
});
