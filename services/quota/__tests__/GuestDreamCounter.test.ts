/**
 * Unit tests for GuestDreamCounter
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { DreamAnalysis, DreamListReadResult } from '@/lib/types';

let getGuestRecordedDreamCount: typeof import('../GuestDreamCounter').getGuestRecordedDreamCount;
let getLocalDreamRecordingCount: typeof import('../GuestDreamCounter').getLocalDreamRecordingCount;
let reserveGuestDreamRecording: typeof import('../GuestDreamCounter').reserveGuestDreamRecording;
let commitGuestDreamRecording: typeof import('../GuestDreamCounter').commitGuestDreamRecording;
let reconcilePendingGuestDreamRecording: typeof import('../GuestDreamCounter').reconcilePendingGuestDreamRecording;
let migrateExistingGuestDreamRecording: typeof import('../GuestDreamCounter').migrateExistingGuestDreamRecording;
let resetGuestDreamRecordingCount: typeof import('../GuestDreamCounter').resetGuestDreamRecordingCount;
let subscribeGuestDreamRecordingCount: typeof import('../GuestDreamCounter').subscribeGuestDreamRecordingCount;

const { mockStorage, mockGetSavedDreams } = ((factory: any) => factory())(() => {
  const storage = new Map<string, string>();
  return {
    mockStorage: storage,
    mockGetSavedDreams: jest.fn() as jest.MockedFunction<() => Promise<DreamListReadResult>>,
  };
});

const loadedDreams = (value: DreamAnalysis[]): DreamListReadResult => ({ status: 'loaded', value });
const setSavedDreams = (value: DreamAnalysis[]) => mockGetSavedDreams.mockResolvedValue(loadedDreams(value));

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
  multiRemove: jest.fn((keys: string[]) => {
    keys.forEach((key) => mockStorage.delete(key));
    return Promise.resolve();
  }),
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockAsyncStorage,
  ...mockAsyncStorage,
}));

jest.mock('@/services/storageService', () => ({
  getSavedDreams: mockGetSavedDreams,
}));

let mockIsMockModeEnabled = false;
jest.mock('@/lib/env', () => ({
  isMockModeEnabled: () => mockIsMockModeEnabled,
}));


const DREAM_RECORDING_KEY = 'guest_total_dream_recording_count_v1';
const RECORDING_STATE_KEY = 'guest_dream_recording_state_v2';
const MIGRATION_KEY = 'guest_dream_recording_migrated_v1';
const dream = (id: number) => ({ id, clientRequestId: `dream-${id}` });
const storedState = () => JSON.parse(mockStorage.get(RECORDING_STATE_KEY) ?? 'null');

describe('GuestDreamCounter', () => {
  beforeEach(() => {
    jest.resetModules();
    mockStorage.clear();
    mockGetSavedDreams.mockReset();
    mockIsMockModeEnabled = false;
    jest.clearAllMocks();
    ({
      getGuestRecordedDreamCount,
      getLocalDreamRecordingCount,
      reserveGuestDreamRecording,
      commitGuestDreamRecording,
      reconcilePendingGuestDreamRecording,
      migrateExistingGuestDreamRecording,
      resetGuestDreamRecordingCount,
      subscribeGuestDreamRecordingCount,
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

  it('reserves a slot with the dream identity before the journal write', async () => {
    await reserveGuestDreamRecording(dream(1), 0, 5);
    expect(storedState()).toEqual({
      count: 1,
      pending: { identity: 'client:dream-1', previousCount: 0 },
    });
    setSavedDreams([dream(1) as DreamAnalysis]);
    await expect(reconcilePendingGuestDreamRecording()).resolves.toBe('saved');
    expect(storedState()).toEqual({ count: 1, pending: null });
  });

  it('never lowers an older stored count and refuses a failed read before reserving', async () => {
    mockStorage.set(DREAM_RECORDING_KEY, '4');
    await reserveGuestDreamRecording(dream(5), 2, 5);
    expect(storedState().count).toBe(5);
    await commitGuestDreamRecording(dream(5));
    mockAsyncStorage.getItem.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(reserveGuestDreamRecording(dream(6), 1, 6)).rejects.toThrow('storage unavailable');
    expect(storedState().count).toBe(5);
  });

  it('does not report a reservation when its durable write fails', async () => {
    mockAsyncStorage.setItem.mockRejectedValueOnce(new Error('storage full'));
    await expect(reserveGuestDreamRecording(dream(1), 0, 5)).rejects.toThrow('storage full');
    expect(mockStorage.has(RECORDING_STATE_KEY)).toBe(false);
  });

  it('releases an interrupted reservation after restart when no dream reached the journal', async () => {
    mockStorage.set(DREAM_RECORDING_KEY, '4');
    setSavedDreams([dream(1), dream(2), dream(3), dream(4)] as DreamAnalysis[]);
    await reserveGuestDreamRecording(dream(5), 4, 5);
    expect(storedState().count).toBe(5);

    jest.resetModules();
    ({ getGuestRecordedDreamCount, reserveGuestDreamRecording } = require('../GuestDreamCounter'));
    await expect(getGuestRecordedDreamCount(4)).resolves.toBe(4);
    expect(storedState()).toEqual({ count: 4, pending: null });
    await expect(reserveGuestDreamRecording(dream(6), 4, 5)).resolves.toBeUndefined();
  });

  it('keeps a saved slot after restart and later deletion', async () => {
    await reserveGuestDreamRecording(dream(1), 0, 5);
    setSavedDreams([dream(1)] as DreamAnalysis[]);

    jest.resetModules();
    ({ getGuestRecordedDreamCount } = require('../GuestDreamCounter'));
    await expect(getGuestRecordedDreamCount(1)).resolves.toBe(1);
    setSavedDreams([]);
    await expect(getGuestRecordedDreamCount(0)).resolves.toBe(1);
  });

  it('keeps a pending reservation when the journal cannot be read', async () => {
    await reserveGuestDreamRecording(dream(1), 0, 5);
    mockGetSavedDreams.mockResolvedValue({ status: 'error' });
    await expect(getGuestRecordedDreamCount(0)).rejects.toThrow();
    expect(storedState().count).toBe(1);
    expect(storedState().pending.identity).toBe('client:dream-1');
  });

  it('getGuestRecordedDreamCount uses max(local, currentDreamCount)', async () => {
    mockStorage.set(DREAM_RECORDING_KEY, '2');
    await expect(getGuestRecordedDreamCount(1)).resolves.toBe(2);
    await expect(getGuestRecordedDreamCount(5)).resolves.toBe(5);
  });

  it('rejects an unreadable quota counter instead of treating it as zero', async () => {
    mockAsyncStorage.getItem.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(getGuestRecordedDreamCount(0)).rejects.toThrow('storage unavailable');
  });

  it('rejects an invalid stored counter rather than resetting the lifetime allowance', async () => {
    mockStorage.set(DREAM_RECORDING_KEY, 'corrupt');
    await expect(getGuestRecordedDreamCount(0)).rejects.toThrow('Invalid guest recording count');
    await expect(reserveGuestDreamRecording(dream(1), 0, 5)).rejects.toThrow('Invalid guest recording count');
    expect(mockStorage.get(DREAM_RECORDING_KEY)).toBe('corrupt');
  });

  it('rejects an invalid reservation instead of reopening the allowance', async () => {
    mockStorage.set(RECORDING_STATE_KEY, '{"count":5,"pending":{"identity":"client:x","previousCount":2}}');
    await expect(getGuestRecordedDreamCount(0)).rejects.toThrow('Invalid guest recording state');
  });

  it('resetGuestDreamRecordingCount clears the cumulative count and migration marker', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeGuestDreamRecordingCount(listener);
    mockStorage.set(DREAM_RECORDING_KEY, '2');
    mockStorage.set(MIGRATION_KEY, 'true');

    await resetGuestDreamRecordingCount();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(mockStorage.has(DREAM_RECORDING_KEY)).toBe(false);
    expect(mockStorage.has(RECORDING_STATE_KEY)).toBe(false);
    expect(mockStorage.has(MIGRATION_KEY)).toBe(false);
    await expect(getLocalDreamRecordingCount()).resolves.toBe(0);
    unsubscribe();
  });

  it('migrateExistingGuestDreamRecording is idempotent and seeds from dreams length', async () => {
    setSavedDreams([{ id: 1 }, { id: 2 }] as any);
    await migrateExistingGuestDreamRecording();
    expect(storedState().count).toBe(2);
    expect(mockStorage.get(MIGRATION_KEY)).toBe('true');

    setSavedDreams([{ id: 1 }, { id: 2 }, { id: 3 }] as any);
    await migrateExistingGuestDreamRecording();
    expect(storedState().count).toBe(2);
  });

  it('migration preserves a reserved count when fewer dreams are still present', async () => {
    mockStorage.set(DREAM_RECORDING_KEY, '5');
    setSavedDreams([{ id: 1 }] as any);
    await migrateExistingGuestDreamRecording();
    await expect(getGuestRecordedDreamCount(1)).resolves.toBe(5);
    expect(mockStorage.get(MIGRATION_KEY)).toBe('true');
  });

  it('ignores persisted recording counts in mock mode so an empty in-memory journal can save again', async () => {
    mockIsMockModeEnabled = true;
    mockStorage.set(DREAM_RECORDING_KEY, '2');

    ({
      getGuestRecordedDreamCount,
      getLocalDreamRecordingCount,
      reserveGuestDreamRecording,
      commitGuestDreamRecording,
    } = require('../GuestDreamCounter'));

    await expect(getGuestRecordedDreamCount(0)).resolves.toBe(0);
    await expect(getLocalDreamRecordingCount()).resolves.toBe(0);

    await reserveGuestDreamRecording(dream(1), 0, 5);
    await commitGuestDreamRecording(dream(1));
    await reserveGuestDreamRecording(dream(2), 1, 5);
    await commitGuestDreamRecording(dream(2));
    expect(mockStorage.get(DREAM_RECORDING_KEY)).toBe('2');
    await expect(getGuestRecordedDreamCount(2)).resolves.toBe(2);
  });
});
