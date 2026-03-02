/**
 * Unit tests for GuestDreamCounter
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

let getGuestRecordedDreamCount: typeof import('../GuestDreamCounter').getGuestRecordedDreamCount;
let getLocalDreamRecordingCount: typeof import('../GuestDreamCounter').getLocalDreamRecordingCount;
let incrementLocalDreamRecordingCount: typeof import('../GuestDreamCounter').incrementLocalDreamRecordingCount;
let migrateExistingGuestDreamRecording: typeof import('../GuestDreamCounter').migrateExistingGuestDreamRecording;

const { mockStorage, mockGetSavedDreams } = ((factory: any) => factory())(() => {
  const storage = new Map<string, string>();
  return {
    mockStorage: storage,
    mockGetSavedDreams: jest.fn(),
  };
});

const mockAsyncStorage = {
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    mockStorage.delete(key);
    return Promise.resolve();
  }),
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockAsyncStorage,
  ...mockAsyncStorage,
}));

jest.mock('@/services/storageServiceReal', () => ({
  getSavedDreams: mockGetSavedDreams,
}));


const DREAM_RECORDING_KEY = 'guest_total_dream_recording_count_v1';
const MIGRATION_KEY = 'guest_dream_recording_migrated_v1';

describe('GuestDreamCounter', () => {
  beforeEach(() => {
    jest.resetModules();
    mockStorage.clear();
    mockGetSavedDreams.mockReset();
    jest.clearAllMocks();
    ({
      getGuestRecordedDreamCount,
      getLocalDreamRecordingCount,
      incrementLocalDreamRecordingCount,
      migrateExistingGuestDreamRecording,
    } = require('../GuestDreamCounter'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('getLocalDreamRecordingCount returns 0 for empty storage', async () => {
    await expect(getLocalDreamRecordingCount()).resolves.toBe(0);
  });

  it('getLocalDreamRecordingCount returns stored value', async () => {
    mockStorage.set(DREAM_RECORDING_KEY, '2');
    await expect(getLocalDreamRecordingCount()).resolves.toBe(2);
  });

  it('incrementLocalDreamRecordingCount increments from 0 to 1', async () => {
    const next = await incrementLocalDreamRecordingCount();
    expect(next).toBe(1);
    expect(mockStorage.get(DREAM_RECORDING_KEY)).toBe('1');
  });

  it('getGuestRecordedDreamCount uses max(local, currentDreamCount)', async () => {
    mockStorage.set(DREAM_RECORDING_KEY, '2');
    await expect(getGuestRecordedDreamCount(1)).resolves.toBe(2);
    await expect(getGuestRecordedDreamCount(5)).resolves.toBe(5);
  });

  it('migrateExistingGuestDreamRecording is idempotent and seeds from dreams length', async () => {
    mockGetSavedDreams.mockResolvedValue([{ id: 1 }, { id: 2 }] as any);
    await migrateExistingGuestDreamRecording();
    expect(mockStorage.get(DREAM_RECORDING_KEY)).toBe('2');
    expect(mockStorage.get(MIGRATION_KEY)).toBe('true');

    mockGetSavedDreams.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }] as any);
    await migrateExistingGuestDreamRecording();
    expect(mockStorage.get(DREAM_RECORDING_KEY)).toBe('2');
  });
});
