/**
 * @jest-environment jsdom
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const storage = new Map<string, string>();

const mockAsyncStorage = {
  getItem: jest.fn(async (key: string) => storage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    storage.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    storage.delete(key);
  }),
  multiRemove: jest.fn(async (keys: string[]) => {
    keys.forEach((key) => storage.delete(key));
  }),
};

const mockGetSavedDreams = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockAsyncStorage,
  ...mockAsyncStorage,
}));

jest.mock('../../storageService', () => ({
  getSavedDreams: mockGetSavedDreams,
}));

const STORAGE_KEY = 'mock_quota_events_v1';
const MIGRATION_KEY = 'mock_quota_events_migrated_v1';

const buildDream = (overrides: Record<string, unknown>) => ({
  id: 1,
  isAnalyzed: false,
  analyzedAt: null,
  explorationStartedAt: null,
  chatHistory: [],
  ...overrides,
});

describe('MockQuotaEventStore', () => {
  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    storage.clear();
    mockGetSavedDreams.mockResolvedValue([]);
  });

  it('migrates counts from stored dreams on first access', async () => {
    mockGetSavedDreams.mockResolvedValue([
      buildDream({ id: 1, isAnalyzed: true, analyzedAt: 100, explorationStartedAt: 200 }),
      buildDream({ id: 2, isAnalyzed: true, analyzedAt: 101, chatHistory: [{ role: 'model' }] }),
      buildDream({ id: 3, isAnalyzed: false }),
    ]);

    const store = require('../MockQuotaEventStore');

    const analysisCount = await store.getMockAnalysisCount();
    const explorationCount = await store.getMockExplorationCount();

    expect(analysisCount).toBe(2);
    expect(explorationCount).toBe(2);
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(MIGRATION_KEY, 'true');
    expect(storage.get(STORAGE_KEY)).toContain('analysisCount');
  });

  it('uses cached migration state on subsequent calls', async () => {
    mockGetSavedDreams.mockResolvedValue([buildDream({ id: 10, isAnalyzed: true, analyzedAt: 1 })]);

    const store = require('../MockQuotaEventStore');

    await store.getMockAnalysisCount();
    await store.getMockAnalysisCount();

    expect(mockGetSavedDreams).toHaveBeenCalledTimes(1);
  });

  it('tracks analysis and exploration events with deduplication', async () => {
    const store = require('../MockQuotaEventStore');

    const first = await store.markMockAnalysis({ id: 42 } as any);
    const second = await store.markMockAnalysis({ id: 42 } as any);

    expect(first).toBe(1);
    expect(second).toBe(1);

    const exploreFirst = await store.markMockExploration({ id: 99 } as any);
    const exploreSecond = await store.markMockExploration({ id: 99 } as any);

    expect(exploreFirst).toBe(1);
    expect(exploreSecond).toBe(1);
  });

  it('returns false for undefined dream ids', async () => {
    const store = require('../MockQuotaEventStore');

    expect(await store.isDreamAnalyzedMock(undefined)).toBe(false);
    expect(await store.isDreamExploredMock(undefined)).toBe(false);
  });

  it('resets stored quota events', async () => {
    storage.set(STORAGE_KEY, JSON.stringify({ analysisCount: 1 }));
    storage.set(MIGRATION_KEY, 'true');

    const store = require('../MockQuotaEventStore');
    await store.resetMockQuotaEvents();

    expect(storage.has(STORAGE_KEY)).toBe(false);
    expect(storage.has(MIGRATION_KEY)).toBe(false);
    expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith([STORAGE_KEY, MIGRATION_KEY]);
  });

  it('invalidates cache to rehydrate from storage', async () => {
    storage.set(STORAGE_KEY, JSON.stringify({
      analysisCount: 3,
      explorationCount: 0,
      analyzedDreamIds: [1, 2, 3],
      exploredDreamIds: [],
    }));
    storage.set(MIGRATION_KEY, 'true');

    const store = require('../MockQuotaEventStore');

    const initial = await store.getMockAnalysisCount();
    expect(initial).toBe(3);

    storage.set(STORAGE_KEY, JSON.stringify({
      analysisCount: 1,
      explorationCount: 0,
      analyzedDreamIds: [1],
      exploredDreamIds: [],
    }));

    store.invalidateMockQuotaCache();
    const refreshed = await store.getMockAnalysisCount();

    expect(refreshed).toBe(1);
  });
});
