import {
  clampSeek,
  COMPLETION_RATIO,
  effectiveDuration,
  FADE_TAIL_SEC,
  fadeVolume,
  formatTime,
  isPractised,
  seekBy,
} from '@/lib/audio';

describe('formatTime', () => {
  it('pads the seconds', () => {
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(600)).toBe('10:00');
  });

  it('floors partial seconds rather than rounding up past the end', () => {
    expect(formatTime(59.9)).toBe('0:59');
  });

  it('treats an unknown duration as zero instead of showing NaN', () => {
    expect(formatTime(Number.NaN)).toBe('0:00');
    expect(formatTime(-5)).toBe('0:00');
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe('0:00');
  });
});

describe('clampSeek', () => {
  it('keeps a target inside the track', () => {
    expect(clampSeek(-10, 300)).toBe(0);
    expect(clampSeek(400, 300)).toBe(300);
    expect(clampSeek(120, 300)).toBe(120);
  });

  it('returns zero when the duration is not known yet', () => {
    expect(clampSeek(120, 0)).toBe(0);
    expect(clampSeek(120, Number.NaN)).toBe(0);
  });
});

describe('seekBy', () => {
  it('does not rewind past the start', () => {
    expect(seekBy(5, -15, 300)).toBe(0);
  });

  it('does not run past the end', () => {
    expect(seekBy(295, 15, 300)).toBe(300);
  });
});

describe('fadeVolume', () => {
  it('stays at full volume outside the tail', () => {
    expect(fadeVolume(FADE_TAIL_SEC + 1)).toBe(1);
    expect(fadeVolume(600)).toBe(1);
  });

  it('ramps down across the tail', () => {
    expect(fadeVolume(FADE_TAIL_SEC / 2)).toBeCloseTo(0.5);
  });

  it('reaches silence, and never goes below it', () => {
    expect(fadeVolume(0)).toBe(0);
    expect(fadeVolume(-10)).toBe(0);
  });

  it('scales a quieter bed proportionally', () => {
    expect(fadeVolume(FADE_TAIL_SEC / 2, 0.35)).toBeCloseTo(0.175);
  });
});

describe('isPractised', () => {
  it('counts a session heard nearly to the end', () => {
    expect(isPractised(300 * COMPLETION_RATIO, 300)).toBe(true);
  });

  it('does not count a session abandoned halfway', () => {
    expect(isPractised(150, 300)).toBe(false);
  });

  it('is false while the duration is unknown', () => {
    expect(isPractised(100, 0)).toBe(false);
  });
});

describe('effectiveDuration', () => {
  // The file is the truth; the catalogue length is what we show until it loads.
  it('prefers the loaded duration', () => {
    expect(effectiveDuration(287, 600)).toBe(287);
  });

  it('falls back to the advertised length while loading', () => {
    expect(effectiveDuration(0, 600)).toBe(600);
    expect(effectiveDuration(Number.NaN, 600)).toBe(600);
  });
});
