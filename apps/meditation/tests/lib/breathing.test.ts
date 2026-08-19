import { BREATHING_PATTERNS, PATTERN_BY_ID } from '@/content/breathing';
import {
  breathStateAt,
  cycleDurationMs,
  RING_SCALE_MAX,
  RING_SCALE_MIN,
  ringScaleFor,
  totalCycles,
} from '@/lib/breathing';

describe('cycleDurationMs', () => {
  it.each([
    ['calm', 10_000],
    ['box', 16_000],
    ['four-seven-eight', 19_000],
    ['coherent', 11_000],
  ] as const)('%s lasts %i ms', (id, expected) => {
    expect(cycleDurationMs(PATTERN_BY_ID[id])).toBe(expected);
  });

  it('matches the app-wide breath for the coherent pattern', () => {
    // 5.5 s in, 5.5 s out — the same rhythm the interface itself breathes at.
    expect(cycleDurationMs(PATTERN_BY_ID.coherent)).toBe(11_000);
  });
});

describe('breathStateAt', () => {
  it('starts on the inhale', () => {
    for (const pattern of BREATHING_PATTERNS) {
      expect(breathStateAt(pattern, 0).phase).toBe('inhale');
    }
  });

  it('walks 4-7-8 through its three phases at the right moments', () => {
    const pattern = PATTERN_BY_ID['four-seven-eight'];

    expect(breathStateAt(pattern, 0).phase).toBe('inhale');
    expect(breathStateAt(pattern, 3_999).phase).toBe('inhale');
    expect(breathStateAt(pattern, 4_000).phase).toBe('hold');
    expect(breathStateAt(pattern, 10_999).phase).toBe('hold');
    expect(breathStateAt(pattern, 11_000).phase).toBe('exhale');
    expect(breathStateAt(pattern, 18_999).phase).toBe('exhale');
  });

  it('wraps into the next cycle', () => {
    const pattern = PATTERN_BY_ID['four-seven-eight'];
    const next = breathStateAt(pattern, 19_000);

    expect(next.phase).toBe('inhale');
    expect(next.cycleIndex).toBe(1);
  });

  /**
   * The acceptance criterion from the spec: phase durations hold to ±100 ms
   * over five minutes. Derived from elapsed time rather than chained timers,
   * so this is exact by construction — the test is what keeps it that way.
   */
  it.each(BREATHING_PATTERNS.map((p) => [p.id] as const))(
    '%s keeps its phase boundaries exact after five minutes',
    (id) => {
      const pattern = PATTERN_BY_ID[id];
      const cycle = cycleDurationMs(pattern);
      const fiveMinutes = 5 * 60 * 1000;
      const lastWholeCycle = Math.floor(fiveMinutes / cycle) * cycle;

      let boundary = lastWholeCycle;
      for (const phase of pattern.phases) {
        const atStart = breathStateAt(pattern, boundary);
        expect(atStart.phase).toBe(phase.type);
        expect(atStart.phaseProgress).toBeCloseTo(0, 5);

        // One millisecond before the end, we are still inside the same phase.
        const beforeEnd = breathStateAt(pattern, boundary + phase.seconds * 1000 - 1);
        expect(beforeEnd.phase).toBe(phase.type);

        boundary += phase.seconds * 1000;
      }
    }
  );

  it('reports the seconds left in the phase', () => {
    const pattern = PATTERN_BY_ID.box;
    expect(breathStateAt(pattern, 0).phaseRemainingSec).toBe(4);
    expect(breathStateAt(pattern, 3_500).phaseRemainingSec).toBe(1);
  });

  it('treats a negative elapsed time as the start', () => {
    expect(breathStateAt(PATTERN_BY_ID.calm, -500).phase).toBe('inhale');
  });
});

describe('ringScaleFor', () => {
  it('expands across the inhale and contracts across the exhale', () => {
    expect(ringScaleFor('inhale', 0)).toBe(RING_SCALE_MIN);
    expect(ringScaleFor('inhale', 1)).toBe(RING_SCALE_MAX);
    expect(ringScaleFor('exhale', 0)).toBe(RING_SCALE_MAX);
    expect(ringScaleFor('exhale', 1)).toBe(RING_SCALE_MIN);
  });

  it('holds still during a hold and a rest', () => {
    // A ring that keeps moving through a hold teaches the wrong thing.
    expect(ringScaleFor('hold', 0)).toBe(RING_SCALE_MAX);
    expect(ringScaleFor('hold', 0.5)).toBe(RING_SCALE_MAX);
    expect(ringScaleFor('rest', 0.5)).toBe(RING_SCALE_MIN);
  });
});

describe('totalCycles', () => {
  it('counts whole cycles only', () => {
    expect(totalCycles(PATTERN_BY_ID.calm, 1)).toBe(6);
    expect(totalCycles(PATTERN_BY_ID['four-seven-eight'], 1)).toBe(3);
  });
});
