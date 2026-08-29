import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  serializeDreamRecallAssistantState,
  startDreamRecallAssistant,
  type DreamRecallAssistantState,
} from '@/lib/dreamRecallAssistant';

const NOW = 1_700_000_000_000;
const DREAM_ID = 'dream-42';
const ORIGINAL = 'I flew over a quiet city with a blue door.';
const ORIGINAL_SEGMENT_ID = 'persisted-original-42';

const mockStorage = new Map<string, string>();

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

const { getKey, load, remove, save } =
  require('../dreamRecallAssistantStorage') as typeof import('../dreamRecallAssistantStorage');

function startedState(): DreamRecallAssistantState {
  return startDreamRecallAssistant({
    dreamId: DREAM_ID,
    originalTranscript: ORIGINAL,
    originalPersistedSegmentId: ORIGINAL_SEGMENT_ID,
    now: NOW,
    maxQuestions: 2,
  }).state;
}

describe('dreamRecallAssistantStorage', () => {
  beforeEach(() => {
    mockStorage.clear();
    mockAsyncStorage.getItem.mockReset().mockImplementation((key: string) =>
      Promise.resolve(mockStorage.get(key) ?? null)
    );
    mockAsyncStorage.setItem.mockReset().mockImplementation((key: string, value: string) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    });
    mockAsyncStorage.removeItem.mockReset().mockImplementation((key: string) => {
      mockStorage.delete(key);
      return Promise.resolve();
    });
  });

  it('builds the exact local sidecar key from dreamId', () => {
    expect(getKey(DREAM_ID)).toBe(`dream_recall_assistant:${DREAM_ID}`);
  });

  it('rejects empty dreamId on getKey, load, save, and remove', async () => {
    const invalid = ['', '   '] as const;
    for (const dreamId of invalid) {
      expect(() => getKey(dreamId)).toThrow(/dreamId is required/);
      await expect(load(dreamId)).rejects.toThrow(/dreamId is required/);
      await expect(remove(dreamId)).rejects.toThrow(/dreamId is required/);
    }
    const blankState = { ...startedState(), dreamId: '   ' };
    await expect(save(blankState as DreamRecallAssistantState)).rejects.toThrow(/dreamId is required/);
    expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('round-trips a valid state through serialize and hydrate', async () => {
    const state = startedState();
    await save(state);
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      `dream_recall_assistant:${DREAM_ID}`,
      serializeDreamRecallAssistantState(state)
    );
    await expect(load(DREAM_ID)).resolves.toEqual(state);
  });

  it('returns null when no sidecar exists', async () => {
    await expect(load(DREAM_ID)).resolves.toBeNull();
    expect(mockAsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it('removes invalid payloads on load and returns null without throwing', async () => {
    mockStorage.set(`dream_recall_assistant:${DREAM_ID}`, '{');
    await expect(load(DREAM_ID)).resolves.toBeNull();
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(`dream_recall_assistant:${DREAM_ID}`);
    expect(mockStorage.has(`dream_recall_assistant:${DREAM_ID}`)).toBe(false);

    mockStorage.set(
      `dream_recall_assistant:${DREAM_ID}`,
      JSON.stringify({ schemaVersion: 0, status: 'active' })
    );
    await expect(load(DREAM_ID)).resolves.toBeNull();
    expect(mockStorage.has(`dream_recall_assistant:${DREAM_ID}`)).toBe(false);
  });

  it('returns null without throwing when AsyncStorage getItem fails', async () => {
    mockAsyncStorage.getItem.mockRejectedValueOnce(new Error('Row too big'));
    await expect(load(DREAM_ID)).resolves.toBeNull();
    expect(mockAsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it('does not throw when invalid payload removal fails', async () => {
    mockStorage.set(`dream_recall_assistant:${DREAM_ID}`, '{');
    mockAsyncStorage.removeItem.mockRejectedValueOnce(new Error('locked'));
    await expect(load(DREAM_ID)).resolves.toBeNull();
  });

  it('removes only the sidecar for the given dreamId', async () => {
    const state = startedState();
    await save(state);
    mockStorage.set('dream_recall_assistant:other', 'keep-me');
    await remove(DREAM_ID);
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(`dream_recall_assistant:${DREAM_ID}`);
    expect(mockStorage.has(`dream_recall_assistant:${DREAM_ID}`)).toBe(false);
    expect(mockStorage.get('dream_recall_assistant:other')).toBe('keep-me');
  });
});
