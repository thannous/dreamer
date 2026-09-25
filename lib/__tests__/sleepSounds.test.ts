import {
  isSleepSoundId,
  isSleepTimerMinutes,
} from '@/lib/sleepSounds';

describe('sleepSounds', () => {

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
