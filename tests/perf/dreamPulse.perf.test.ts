import { describe, expect, it } from 'vitest';
import { getDreamPulse } from '../../lib/dreamPulse';

const DREAM_COUNT = 50_000;
const RUNS = 100;
const now = Date.now();

const dreams = Array.from({ length: DREAM_COUNT }, (_, index) => ({
  id: now - index * 60_000,
  isFavorite: index % 7 === 0,
  isAnalyzed: index % 3 === 0,
  analysisStatus: index % 5 === 0 ? 'done' : undefined,
}));

const getNow = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

describe('perf(getDreamPulse)', () => {
  it('logs one-pass inspiration pulse calculation time', () => {
    const start = getNow();
    for (let index = 0; index < RUNS; index += 1) {
      getDreamPulse(dreams as any, now);
    }
    const avgMs = (getNow() - start) / RUNS;

    console.log(
      `[perf] getDreamPulse avg ${avgMs.toFixed(3)}ms over ${RUNS} runs (n=${DREAM_COUNT})`
    );
    expect(avgMs).toBeGreaterThan(0);
  });
});
