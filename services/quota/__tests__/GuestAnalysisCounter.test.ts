/**
 * Unit tests for GuestAnalysisCounter
 *
 * Tests the persistent local counter for guest quota tracking, which prevents
 * quota bypass by storing cumulative counts instead of counting current dreams.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

let getLocalAnalysisCount: typeof import('../GuestAnalysisCounter').getLocalAnalysisCount;
let getLocalExplorationCount: typeof import('../GuestAnalysisCounter').getLocalExplorationCount;
let getLocalImageCount: typeof import('../GuestAnalysisCounter').getLocalImageCount;
let incrementLocalAnalysisCount: typeof import('../GuestAnalysisCounter').incrementLocalAnalysisCount;
let incrementLocalExplorationCount: typeof import('../GuestAnalysisCounter').incrementLocalExplorationCount;
let incrementLocalImageCount: typeof import('../GuestAnalysisCounter').incrementLocalImageCount;
let syncWithServerCount: typeof import('../GuestAnalysisCounter').syncWithServerCount;
let migrateExistingGuestQuota: typeof import('../GuestAnalysisCounter').migrateExistingGuestQuota;

// Use jest.hoisted to ensure mocks are available during module loading
const { mockStorage, mockGetSavedDreams, mockDreamUsageConfig } = ((factory: any) => factory())(() => {
  const storage = new Map<string, string>();
  return {
    mockStorage: storage,
    mockGetSavedDreams: jest.fn(),
    // Config for dreamUsage mock return values (set per test)
    mockDreamUsageConfig: {
      analysisCount: 0,
      explorationCount: 0,
    },
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

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockAsyncStorage,
  ...mockAsyncStorage,
}));

// Mock storageServiceReal
jest.mock('@/services/storageServiceReal', () => ({
  getSavedDreams: mockGetSavedDreams,
}));

// Mock dreamUsage - use config object for return values
jest.mock('@/lib/dreamUsage', () => ({
  getAnalyzedDreamCount: () => mockDreamUsageConfig.analysisCount,
  getExploredDreamCount: () => mockDreamUsageConfig.explorationCount,
}));

// Import after mocks are set up

const ANALYSIS_KEY = 'guest_total_analysis_count_v1';
const EXPLORATION_KEY = 'guest_total_exploration_count_v1';
const IMAGE_KEY = 'guest_total_image_count_v1';
const IMAGE_LEDGER_KEY = 'guest_total_image_ledger_v1';
const MIGRATION_KEY = 'guest_quota_migrated_v1';

describe('GuestAnalysisCounter', () => {
  beforeEach(() => {
    jest.resetModules();
    mockStorage.clear();
    mockGetSavedDreams.mockReset();
    // Reset dreamUsage config
    mockDreamUsageConfig.analysisCount = 0;
    mockDreamUsageConfig.explorationCount = 0;
    jest.clearAllMocks();
    ({
      getLocalAnalysisCount,
      getLocalExplorationCount,
      getLocalImageCount,
      incrementLocalAnalysisCount,
      incrementLocalExplorationCount,
      incrementLocalImageCount,
      syncWithServerCount,
      migrateExistingGuestQuota,
    } = require('../GuestAnalysisCounter'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getLocalAnalysisCount', () => {
    it('given empty storage when getting count then returns 0', async () => {
      // Given
      // Storage is empty by default

      // When
      const count = await getLocalAnalysisCount();

      // Then
      expect(count).toBe(0);
    });

    it('given stored value when getting count then returns stored value', async () => {
      // Given
      mockStorage.set(ANALYSIS_KEY, '5');

      // When
      const count = await getLocalAnalysisCount();

      // Then
      expect(count).toBe(5);
    });

    it('given corrupted value (NaN) when getting count then returns 0', async () => {
      // Given
      mockStorage.set(ANALYSIS_KEY, 'not-a-number');

      // When
      const count = await getLocalAnalysisCount();

      // Then
      expect(count).toBe(0);
    });

    it('given empty string when getting count then returns 0', async () => {
      // Given
      mockStorage.set(ANALYSIS_KEY, '');

      // When
      const count = await getLocalAnalysisCount();

      // Then
      expect(count).toBe(0);
    });
  });

  describe('getLocalImageCount', () => {
    it('given empty storage when getting count then returns 0', async () => {
      await expect(getLocalImageCount()).resolves.toBe(0);
    });
  });

  describe('getLocalExplorationCount', () => {
    it('given empty storage when getting count then returns 0', async () => {
      // Given
      // Storage is empty by default

      // When
      const count = await getLocalExplorationCount();

      // Then
      expect(count).toBe(0);
    });

    it('given stored value when getting count then returns stored value', async () => {
      // Given
      mockStorage.set(EXPLORATION_KEY, '3');

      // When
      const count = await getLocalExplorationCount();

      // Then
      expect(count).toBe(3);
    });

    it('given corrupted value when getting count then returns 0', async () => {
      // Given
      mockStorage.set(EXPLORATION_KEY, 'undefined');

      // When
      const count = await getLocalExplorationCount();

      // Then
      expect(count).toBe(0);
    });
  });

  describe('incrementLocalAnalysisCount', () => {
    it('given empty storage when incrementing then returns 1', async () => {
      // Given
      // Storage is empty

      // When
      const newCount = await incrementLocalAnalysisCount();

      // Then
      expect(newCount).toBe(1);
      expect(mockStorage.get(ANALYSIS_KEY)).toBe('1');
    });

    it('given existing count when incrementing then returns incremented value', async () => {
      // Given
      mockStorage.set(ANALYSIS_KEY, '2');

      // When
      const newCount = await incrementLocalAnalysisCount();

      // Then
      expect(newCount).toBe(3);
      expect(mockStorage.get(ANALYSIS_KEY)).toBe('3');
    });

    it('given corrupted count when incrementing then treats as 0 and returns 1', async () => {
      // Given
      mockStorage.set(ANALYSIS_KEY, 'garbage');

      // When
      const newCount = await incrementLocalAnalysisCount();

      // Then
      expect(newCount).toBe(1);
      expect(mockStorage.get(ANALYSIS_KEY)).toBe('1');
    });
  });

  describe('incrementLocalImageCount', () => {
    it('given empty storage when incrementing then returns 1', async () => {
      const newCount = await incrementLocalImageCount();

      expect(newCount).toBe(1);
      expect(mockStorage.get(IMAGE_KEY)).toBe('1');
      expect(JSON.parse(mockStorage.get(IMAGE_LEDGER_KEY) ?? '{}')).toEqual({
        count: 1,
        claimedJobIds: [],
      });
    });

    it('given the same image job when incrementing twice then stays at 1', async () => {
      const first = await incrementLocalImageCount({ jobId: 'job-image-1' });
      const second = await incrementLocalImageCount({ jobId: 'job-image-1' });

      expect(first).toBe(1);
      expect(second).toBe(1);
      expect(mockStorage.get(IMAGE_KEY)).toBe('1');
      expect(JSON.parse(mockStorage.get(IMAGE_LEDGER_KEY) ?? '{}')).toEqual({
        count: 1,
        claimedJobIds: ['job-image-1'],
      });
    });

    it('given distinct image jobs when incrementing then counts each success once', async () => {
      await incrementLocalImageCount({ jobId: 'job-image-1' });
      const second = await incrementLocalImageCount({ jobId: 'job-image-2' });

      expect(second).toBe(2);
      expect(mockStorage.get(IMAGE_KEY)).toBe('2');
      expect(JSON.parse(mockStorage.get(IMAGE_LEDGER_KEY) ?? '{}').claimedJobIds).toEqual([
        'job-image-1',
        'job-image-2',
      ]);
    });

    it('given concurrent claims for the same job then counts once', async () => {
      const [first, second] = await Promise.all([
        incrementLocalImageCount({ jobId: 'job-image-1' }),
        incrementLocalImageCount({ jobId: 'job-image-1' }),
      ]);

      expect([first, second].sort()).toEqual([1, 1]);
      expect(await getLocalImageCount()).toBe(1);
      expect(JSON.parse(mockStorage.get(IMAGE_LEDGER_KEY) ?? '{}')).toEqual({
        count: 1,
        claimedJobIds: ['job-image-1'],
      });
    });

    it('given a crash after ledger write then still counts the claimed job once', async () => {
      await incrementLocalImageCount({ jobId: 'job-image-1' });
      mockStorage.delete(IMAGE_KEY);

      expect(await getLocalImageCount()).toBe(1);
      const retried = await incrementLocalImageCount({ jobId: 'job-image-1' });
      expect(retried).toBe(1);
      expect(mockStorage.get(IMAGE_KEY)).toBe('1');
    });

    it('given a higher legacy count than the ledger then uses the maximum', async () => {
      mockStorage.set(IMAGE_KEY, '3');
      mockStorage.set(IMAGE_LEDGER_KEY, JSON.stringify({ count: 1, claimedJobIds: ['job-image-1'] }));

      expect(await getLocalImageCount()).toBe(3);
      const next = await incrementLocalImageCount({ jobId: 'job-image-2' });
      expect(next).toBe(4);
    });
  });

  describe('incrementLocalExplorationCount', () => {
    it('given empty storage when incrementing then returns 1', async () => {
      // Given
      // Storage is empty

      // When
      const newCount = await incrementLocalExplorationCount();

      // Then
      expect(newCount).toBe(1);
      expect(mockStorage.get(EXPLORATION_KEY)).toBe('1');
    });

    it('given existing count when incrementing then returns incremented value', async () => {
      // Given
      mockStorage.set(EXPLORATION_KEY, '5');

      // When
      const newCount = await incrementLocalExplorationCount();

      // Then
      expect(newCount).toBe(6);
      expect(mockStorage.get(EXPLORATION_KEY)).toBe('6');
    });
  });

  describe('syncWithServerCount', () => {
    it('given server count higher than local when syncing analysis then uses server count', async () => {
      // Given
      mockStorage.set(ANALYSIS_KEY, '2');

      // When
      const result = await syncWithServerCount(5, 'analysis');

      // Then
      expect(result).toBe(5);
      expect(mockStorage.get(ANALYSIS_KEY)).toBe('5');
    });

    it('given local count higher than server when syncing analysis then keeps local count', async () => {
      // Given
      mockStorage.set(ANALYSIS_KEY, '7');

      // When
      const result = await syncWithServerCount(3, 'analysis');

      // Then
      expect(result).toBe(7);
      expect(mockStorage.get(ANALYSIS_KEY)).toBe('7');
    });

    it('given equal counts when syncing then returns same value', async () => {
      // Given
      mockStorage.set(ANALYSIS_KEY, '4');

      // When
      const result = await syncWithServerCount(4, 'analysis');

      // Then
      expect(result).toBe(4);
    });

    it('given server count higher than local when syncing exploration then uses server count', async () => {
      // Given
      mockStorage.set(EXPLORATION_KEY, '1');

      // When
      const result = await syncWithServerCount(3, 'exploration');

      // Then
      expect(result).toBe(3);
      expect(mockStorage.get(EXPLORATION_KEY)).toBe('3');
    });

    it('given local count higher than server when syncing exploration then keeps local count', async () => {
      // Given
      mockStorage.set(EXPLORATION_KEY, '5');

      // When
      const result = await syncWithServerCount(2, 'exploration');

      // Then
      expect(result).toBe(5);
      expect(mockStorage.get(EXPLORATION_KEY)).toBe('5');
    });

    it('given server count higher than local when syncing image then uses server count', async () => {
      mockStorage.set('guest_total_image_count_v1', '1');

      const result = await syncWithServerCount(2, 'image');

      expect(result).toBe(2);
      expect(mockStorage.get('guest_total_image_count_v1')).toBe('2');
    });

    it('given empty local storage when syncing then uses server count', async () => {
      // Given
      // Storage is empty

      // When
      const result = await syncWithServerCount(3, 'analysis');

      // Then
      expect(result).toBe(3);
      expect(mockStorage.get(ANALYSIS_KEY)).toBe('3');
    });
  });

  describe('migrateExistingGuestQuota', () => {
    it('given previous migration when calling migrate then skips migration', async () => {
      // Given
      mockStorage.set(MIGRATION_KEY, 'true');
      mockStorage.set(ANALYSIS_KEY, '1'); // Pre-existing count

      // When
      await migrateExistingGuestQuota();

      // Then - getSavedDreams should not be called
      expect(mockGetSavedDreams).not.toHaveBeenCalled();
      expect(mockStorage.get(ANALYSIS_KEY)).toBe('1'); // Unchanged
    });

    it('given migration already done when calling again then is idempotent', async () => {
      // Given - First migration (with no dreams)
      mockGetSavedDreams.mockResolvedValue([]);
      await migrateExistingGuestQuota();

      // Verify migration flag is set
      expect(mockStorage.get(MIGRATION_KEY)).toBe('true');

      // Reset mock call counts
      mockGetSavedDreams.mockClear();

      // When - Second migration attempt
      await migrateExistingGuestQuota();

      // Then - getSavedDreams should not be called again
      expect(mockGetSavedDreams).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('given negative server count when syncing then uses max(local, server)', async () => {
      // Given
      mockStorage.set(ANALYSIS_KEY, '0');

      // When
      const result = await syncWithServerCount(-1, 'analysis');

      // Then
      expect(result).toBe(0); // max(0, -1) = 0
    });

    it('given very large count when storing then handles correctly', async () => {
      // Given
      mockStorage.set(ANALYSIS_KEY, '999999');

      // When
      const count = await getLocalAnalysisCount();

      // Then
      expect(count).toBe(999999);
    });

    it('given float string when getting count then parses as integer', async () => {
      // Given
      mockStorage.set(ANALYSIS_KEY, '3.7');

      // When
      const count = await getLocalAnalysisCount();

      // Then
      expect(count).toBe(3); // parseInt truncates
    });
  });
});
