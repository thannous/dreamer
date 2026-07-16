import {
  getSleepSoundStartOffset,
  isSleepSoundId,
  isSleepTimerMinutes,
  SLEEP_SOUND_TIMER_OPTIONS,
} from '@/lib/sleepSounds';

describe('sleepSounds', () => {
  it.each([
    [15, 30 * 60],
    [30, 15 * 60],
    [45, 0],
  ] as const)('starts a %i-minute session at offset %i seconds', (duration, offset) => {
    expect(getSleepSoundStartOffset(duration)).toBe(offset);
  });

  it('exposes the three supported timer durations', () => {
    expect(SLEEP_SOUND_TIMER_OPTIONS).toEqual([15, 30, 45]);
  });

  it.each(['rain', 'ocean', 'brown-noise'])('accepts the supported sound id %s', (soundId) => {
    expect(isSleepSoundId(soundId)).toBe(true);
  });

  it.each([undefined, null, '', 'waves', 'RAIN', 15, {}])(
    'rejects an unsupported sound id %p',
    (soundId) => {
      expect(isSleepSoundId(soundId)).toBe(false);
    }
  );

  it.each([15, 30, 45])('accepts the supported timer duration %i', (duration) => {
    expect(isSleepTimerMinutes(duration)).toBe(true);
  });

  it.each([undefined, null, 0, 14, 20, 46, '15', NaN])(
    'rejects an unsupported timer duration %p',
    (duration) => {
      expect(isSleepTimerMinutes(duration)).toBe(false);
    }
  );
});
