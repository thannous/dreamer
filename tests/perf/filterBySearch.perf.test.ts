import { describe, expect, it } from 'vitest';
import { filterBySearch } from '../../lib/dreamFilters';

const DREAM_COUNT = 20_000;
const RUNS = 5;
const now = Date.now();

// Perf: mimic real-world long transcripts/interpretations to surface allocation costs.
const LONG_TRANSCRIPT = 'lorem ipsum dolor sit amet consectetur adipiscing elit. '.repeat(80);
const LONG_INTERPRETATION = 'ut enim ad minim veniam quis nostrud exercitation ullamco. '.repeat(40);

const dreams = Array.from({ length: DREAM_COUNT }, (_, index) => ({
  id: now - index * 60_000,
  title: `Dream ${index}`,
  transcript: LONG_TRANSCRIPT,
  interpretation: LONG_INTERPRETATION,
  shareableQuote: '',
  imageUrl: '',
  dreamType: 'Symbolic Dream' as const,
  chatHistory: [],
}));

const getNow = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

describe('perf(filterBySearch)', () => {
  it('logs average filtering time for a large list (single token, no matches)', () => {
    const query = '__no_match_token__';

    const start = getNow();
    for (let i = 0; i < RUNS; i += 1) {
      filterBySearch(dreams as any, query);
    }
    const durationMs = getNow() - start;
    const avgMs = durationMs / RUNS;

    console.log(`[perf] filterBySearch avg ${avgMs.toFixed(2)}ms over ${RUNS} runs (n=${DREAM_COUNT})`);
    expect(avgMs).toBeGreaterThan(0);
  });
});
