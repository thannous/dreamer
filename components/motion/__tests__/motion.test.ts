import {
  DURATION,
  PRESS_SCALE,
  SPRING,
  STAGGER_MAX_ITEMS,
  STAGGER_MS,
  staggerDelay,
} from '../motion';

describe('motion tokens', () => {
  it('keeps press feedback below the perceptual floor', () => {
    // Above ~150ms a press stops reading as the surface responding and starts
    // reading as an animation playing.
    expect(DURATION.press).toBeLessThan(150);
  });

  it('keeps every UI duration under 300ms', () => {
    // Navigation uses the platform's own timing; everything the app draws itself
    // should beat it.
    expect(DURATION.fast).toBeLessThanOrEqual(300);
    expect(DURATION.normal).toBeLessThanOrEqual(400);
  });

  it('presses sink, never grow', () => {
    expect(PRESS_SCALE).toBeGreaterThan(0.9);
    expect(PRESS_SCALE).toBeLessThan(1);
  });

  it('expresses springs in duration/dampingRatio, not mass/stiffness', () => {
    for (const [name, config] of Object.entries(SPRING)) {
      expect(config).toHaveProperty('duration');
      expect(config).toHaveProperty('dampingRatio');
      expect(config).not.toHaveProperty('stiffness');
      expect(name).toBeTruthy();
    }
  });

  it('never overshoots on the default settle', () => {
    expect(SPRING.settle.dampingRatio).toBe(1);
  });

  it('clamps a value that must not pass a hard edge', () => {
    expect(SPRING.clamped.overshootClamping).toBe(true);
  });
});

describe('staggerDelay', () => {
  it('gives the first item no delay', () => {
    expect(staggerDelay(0)).toBe(0);
  });

  it('steps by one interval per sibling', () => {
    expect(staggerDelay(1)).toBe(STAGGER_MS);
    expect(staggerDelay(3)).toBe(3 * STAGGER_MS);
  });

  it('stops growing past the cap so a long list never reads as loading', () => {
    const capped = STAGGER_MAX_ITEMS * STAGGER_MS;
    expect(staggerDelay(STAGGER_MAX_ITEMS)).toBe(capped);
    expect(staggerDelay(STAGGER_MAX_ITEMS + 40)).toBe(capped);
  });

  it('never delays a whole screen by more than a beat', () => {
    expect(staggerDelay(999)).toBeLessThanOrEqual(300);
  });
});
