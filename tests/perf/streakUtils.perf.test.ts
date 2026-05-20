import { describe, expect, it } from 'vitest';
import { calculateStreaks } from '../../lib/streakUtils';

const DREAM_COUNT = 20_000;
const RUNS = 20;
const DAY_MS = 86_400_000;
const now = Date.now();

const dreams = Array.from({ length: DREAM_COUNT }, (_, index) => ({
  id: now - Math.floor(index / 5) * DAY_MS - (index % 5) * 60_000,
}));

const getNow = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

describe('perf(calculateStreaks)', () => {
  it('logs sorted journal streak calculation time', () => {
    const start = getNow();
    for (let index = 0; index < RUNS; index += 1) {
      calculateStreaks(dreams, now, { sortedDescending: true });
    }
    const avgMs = (getNow() - start) / RUNS;

    console.log(
      `[perf] calculateStreaks sorted avg ${avgMs.toFixed(2)}ms over ${RUNS} runs (n=${DREAM_COUNT})`
    );
    expect(avgMs).toBeGreaterThan(0);
  });
});
