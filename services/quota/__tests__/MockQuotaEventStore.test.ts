/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();

const asyncStorageMock = {
  getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
  setItem: vi.fn(async (key: string, value: string) => {
    storage.set(key, value);
  }),
  removeItem: vi.fn(async (key: string) => {
    storage.delete(key);
  }),
  multiRemove: vi.fn(async (keys: string[]) => {
    keys.forEach((key) => storage.delete(key));
  }),
};

const mockGetSavedDreams = vi.fn();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorageMock,
}));

vi.mock('../../storageService', () => ({
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
    vi.resetModules();
    vi.clearAllMocks();
    storage.clear();
    mockGetSavedDreams.mockResolvedValue([]);
  });

  it('migrates counts from stored dreams on first access', async () => {
    mockGetSavedDreams.mockResolvedValue([
      buildDream({ id: 1, isAnalyzed: true, analyzedAt: 100, explorationStartedAt: 200 }),
      buildDream({ id: 2, isAnalyzed: true, analyzedAt: 101, chatHistory: [{ role: 'model' }] }),
      buildDream({ id: 3, isAnalyzed: false }),
    ]);

    const store = await import('../MockQuotaEventStore');

    const analysisCount = await store.getMockAnalysisCount();
    const explorationCount = await store.getMockExplorationCount();

    expect(analysisCount).toBe(2);
    expect(explorationCount).toBe(2);
    expect(asyncStorageMock.setItem).toHaveBeenCalledWith(MIGRATION_KEY, 'true');
    expect(storage.get(STORAGE_KEY)).toContain('analysisCount');
  });

  it('uses cached migration state on subsequent calls', async () => {
    mockGetSavedDreams.mockResolvedValue([buildDream({ id: 10, isAnalyzed: true, analyzedAt: 1 })]);

    const store = await import('../MockQuotaEventStore');

    await store.getMockAnalysisCount();
    await store.getMockAnalysisCount();

    expect(mockGetSavedDreams).toHaveBeenCalledTimes(1);
  });

  it('tracks analysis and exploration events with deduplication', async () => {
    const store = await import('../MockQuotaEventStore');

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
    const store = await import('../MockQuotaEventStore');

    expect(await store.isDreamAnalyzedMock(undefined)).toBe(false);
    expect(await store.isDreamExploredMock(undefined)).toBe(false);
  });

  it('resets stored quota events', async () => {
    storage.set(STORAGE_KEY, JSON.stringify({ analysisCount: 1 }));
    storage.set(MIGRATION_KEY, 'true');

    const store = await import('../MockQuotaEventStore');
    await store.resetMockQuotaEvents();

    expect(storage.has(STORAGE_KEY)).toBe(false);
    expect(storage.has(MIGRATION_KEY)).toBe(false);
    expect(asyncStorageMock.multiRemove).toHaveBeenCalledWith([STORAGE_KEY, MIGRATION_KEY]);
  });

  it('invalidates cache to rehydrate from storage', async () => {
    storage.set(STORAGE_KEY, JSON.stringify({
      analysisCount: 3,
      explorationCount: 0,
      analyzedDreamIds: [1, 2, 3],
      exploredDreamIds: [],
    }));
    storage.set(MIGRATION_KEY, 'true');

    const store = await import('../MockQuotaEventStore');

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
