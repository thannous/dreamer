import { describe, expect, it } from 'vitest';
import { formatLocaleDate, formatLocaleNumber } from '../../lib/dateUtils';

const RUNS = 5_000;
const locale = 'en-US';
const dates = Array.from({ length: RUNS }, (_, index) => Date.now() - index * 86_400_000);

const getNow = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

describe('perf(locale formatting)', () => {
  it('logs cached Intl formatter throughput across repeated labels', () => {
    const dateStart = getNow();
    for (const timestamp of dates) {
      formatLocaleDate(timestamp, locale, { year: 'numeric', month: 'short', day: 'numeric' });
    }
    const dateMs = getNow() - dateStart;

    const numberStart = getNow();
    for (let index = 0; index < RUNS; index += 1) {
      formatLocaleNumber(index * 1234.56, locale);
    }
    const numberMs = getNow() - numberStart;

    console.log(
      `[perf] cached locale formatting ${dateMs.toFixed(2)}ms dates, ${numberMs.toFixed(2)}ms numbers (n=${RUNS})`
    );
    expect(dateMs).toBeGreaterThan(0);
    expect(numberMs).toBeGreaterThan(0);
  });
});
