import { describe, expect, it } from 'vitest';
import { filterByDateRange } from '../../lib/dreamFilters';
import { generateRandomDream } from '../../mock-data/generators';

const DREAM_COUNT = 20000;
const RUNS = 20;
const now = Date.now();

const dreams = Array.from({ length: DREAM_COUNT }, (_, index) => ({
  id: now - index * 60_000,
  ...generateRandomDream(),
}));

const getNow = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

describe('perf(filterByDateRange)', () => {
  it('logs average filtering time for a large list', () => {
    const startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const endDate = new Date(now);

    const start = getNow();
    for (let i = 0; i < RUNS; i += 1) {
      filterByDateRange(dreams, startDate, endDate);
    }
    const durationMs = getNow() - start;
    const avgMs = durationMs / RUNS;

    console.log(
      `[perf] filterByDateRange avg ${avgMs.toFixed(2)}ms over ${RUNS} runs (n=${DREAM_COUNT})`
    );
    expect(avgMs).toBeGreaterThan(0);
  });
});
