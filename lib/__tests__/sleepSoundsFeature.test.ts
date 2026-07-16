import {
  isSleepSoundsAvailable,
  isSleepSoundsEnabled,
} from '@/lib/sleepSoundsFeature';

describe('sleep sounds feature flag', () => {
  const originalFlag = process.env.EXPO_PUBLIC_SLEEP_SOUNDS_ENABLED;
  const originalExpoOs = process.env.EXPO_OS;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.EXPO_PUBLIC_SLEEP_SOUNDS_ENABLED;
    } else {
      process.env.EXPO_PUBLIC_SLEEP_SOUNDS_ENABLED = originalFlag;
    }
    if (originalExpoOs === undefined) {
      delete process.env.EXPO_OS;
    } else {
      process.env.EXPO_OS = originalExpoOs;
    }
  });

  it.each(['true', 'TRUE', 'TrUe'])(
    'is enabled when EXPO_PUBLIC_SLEEP_SOUNDS_ENABLED is %s',
    (value) => {
      process.env.EXPO_PUBLIC_SLEEP_SOUNDS_ENABLED = value;

      expect(isSleepSoundsEnabled()).toBe(true);
    }
  );

  it.each(['false', '1', 'yes', ' true ', ''])(
    'is disabled when EXPO_PUBLIC_SLEEP_SOUNDS_ENABLED is %j',
    (value) => {
      process.env.EXPO_PUBLIC_SLEEP_SOUNDS_ENABLED = value;

      expect(isSleepSoundsEnabled()).toBe(false);
    }
  );

  it('is disabled when EXPO_PUBLIC_SLEEP_SOUNDS_ENABLED is absent', () => {
    delete process.env.EXPO_PUBLIC_SLEEP_SOUNDS_ENABLED;

    expect(isSleepSoundsEnabled()).toBe(false);
  });

  it('is available on native builds when the flag is enabled', () => {
    process.env.EXPO_PUBLIC_SLEEP_SOUNDS_ENABLED = 'true';
    process.env.EXPO_OS = 'android';

    expect(isSleepSoundsAvailable('android')).toBe(true);
  });

  it('stays unavailable on web when the flag is enabled', () => {
    process.env.EXPO_PUBLIC_SLEEP_SOUNDS_ENABLED = 'true';
    process.env.EXPO_OS = 'web';

    expect(isSleepSoundsAvailable('web')).toBe(false);
  });

  it('fails closed when the native platform is unknown', () => {
    process.env.EXPO_PUBLIC_SLEEP_SOUNDS_ENABLED = 'true';

    expect(isSleepSoundsAvailable('unknown')).toBe(false);
  });
});
