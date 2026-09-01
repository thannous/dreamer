import { describe, expect, it } from 'vitest';

import { applyFilters } from '../../lib/dreamFilters';
import { generateRandomDream } from '../../mock-data/generators';
import type { DreamAnalysis } from '../../lib/types';

const DREAM_COUNT = 8_000;
const RUNS = 8;
const WARMUP_RUNS = 2;
const MAX_AVG_MS = 80;
const MAX_RATIO = 6;
const now = Date.now();

const dreams: DreamAnalysis[] = Array.from({ length: DREAM_COUNT }, (_, index) => ({
  id: now - index * 60_000,
  ...generateRandomDream(),
  isFavorite: index % 5 === 0,
  isAnalyzed: index % 3 === 0,
  analysisStatus: (index % 3 === 0 ? 'done' : 'none') as DreamAnalysis['analysisStatus'],
  analyzedAt: index % 3 === 0 ? now - index * 60_000 : undefined,
  interpretation: index % 3 === 0 ? 'A complete reading.' : '',
  explorationStartedAt: index % 11 === 0 ? now - index * 60_000 : undefined,
  memory: index % 7 === 0 ? { origin: 'remembered' as const } : undefined,
}));

const getNow = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

function runSearchOnly() {
  return applyFilters(dreams, { searchQuery: 'ocean' });
}

function runCombined() {
  return applyFilters(dreams, {
    searchQuery: 'ocean',
    theme: 'calm',
    favoritesOnly: true,
    rememberedOnly: true,
    needsExplorationOnly: true,
    startDate: new Date(now - 14 * 24 * 60 * 60 * 1000),
    endDate: new Date(now),
  });
}

describe('perf(journalCombinedFilters)', () => {
  it('keeps a combined journal filter pass within a non-flaky ratio of the unfiltered path', () => {
    expect(runSearchOnly().length).toBeGreaterThan(0);
    expect(Array.isArray(runCombined())).toBe(true);

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
