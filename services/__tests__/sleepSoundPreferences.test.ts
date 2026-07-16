import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockStorage = {
  getItem: jest.fn(async (_key: string): Promise<string | null> => null),
  setItem: jest.fn(async (_key: string, _value: string): Promise<void> => undefined),
};

const PREFERENCES_KEY = 'noctalia_sleep_sound_preferences_v1';
const DEFAULT_PREFERENCES = { soundId: 'rain', durationMinutes: 30 } as const;

let preferencesModule: typeof import('@/services/sleepSoundPreferences');

describe('sleepSoundPreferences', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockStorage.getItem.mockResolvedValue(null);
    mockStorage.setItem.mockResolvedValue(undefined);
    jest.doMock('expo-sqlite/kv-store', () => ({
      __esModule: true,
      default: mockStorage,
    }));
    preferencesModule = require('@/services/sleepSoundPreferences');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns defaults when no preferences have been saved', async () => {
    await expect(preferencesModule.getSleepSoundPreferences()).resolves.toEqual(
      DEFAULT_PREFERENCES
    );
    expect(mockStorage.getItem).toHaveBeenCalledWith(PREFERENCES_KEY);
  });

  it('reads valid persisted preferences', async () => {
    mockStorage.getItem.mockResolvedValueOnce(
      JSON.stringify({ soundId: 'ocean', durationMinutes: 45 })
    );

    await expect(preferencesModule.getSleepSoundPreferences()).resolves.toEqual({
      soundId: 'ocean',
      durationMinutes: 45,
    });
  });

  it.each([
    [JSON.stringify({ soundId: 'invalid', durationMinutes: 15 }), 'rain', 15],
    [JSON.stringify({ soundId: 'brown-noise', durationMinutes: 60 }), 'brown-noise', 30],
    [JSON.stringify({ soundId: null, durationMinutes: '45' }), 'rain', 30],
  ])(
    'validates persisted fields independently',
    async (
      persistedValue: string,
      soundId: 'rain' | 'brown-noise',
      durationMinutes: number,
    ) => {
      mockStorage.getItem.mockResolvedValueOnce(persistedValue);

      await expect(preferencesModule.getSleepSoundPreferences()).resolves.toEqual({
        soundId,
        durationMinutes,
      });
    }
  );

  it.each([
    ['malformed JSON', () => mockStorage.getItem.mockResolvedValueOnce('{invalid')],
    [
      'storage read failure',
      () => mockStorage.getItem.mockRejectedValueOnce(new Error('read failed')),
    ],
  ])('falls back to defaults after %s', async (
    _label: string,
    arrangeFailure: () => unknown,
  ) => {
    arrangeFailure();
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(preferencesModule.getSleepSoundPreferences()).resolves.toEqual(
      DEFAULT_PREFERENCES
    );
  });

  it('persists preferences as JSON under the versioned key', async () => {
    await preferencesModule.saveSleepSoundPreferences({
      soundId: 'brown-noise',
      durationMinutes: 15,
    });

    expect(mockStorage.setItem).toHaveBeenCalledWith(
      PREFERENCES_KEY,
      JSON.stringify({ soundId: 'brown-noise', durationMinutes: 15 })
    );
  });

  it('swallows storage write failures', async () => {
    mockStorage.setItem.mockRejectedValueOnce(new Error('write failed'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      preferencesModule.saveSleepSoundPreferences({ soundId: 'rain', durationMinutes: 30 })
    ).resolves.toBeUndefined();
  });
});
