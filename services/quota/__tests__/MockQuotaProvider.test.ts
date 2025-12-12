import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DreamAnalysis } from '@/lib/types';
import { MockQuotaProvider } from '../MockQuotaProvider';

// Use vi.hoisted to ensure mock is available during module loading
const { mockGetSavedDreams, mockStorage } = vi.hoisted(() => ({
  mockGetSavedDreams: vi.fn<() => Promise<DreamAnalysis[]>>(),
  mockStorage: new Map<string, string>(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      mockStorage.delete(key);
      return Promise.resolve();
    }),
  },
}));

// Mock using the relative path from this test file to storageService
vi.mock('../../storageService', () => ({
  getSavedDreams: () => mockGetSavedDreams(),
}));

const buildDream = (overrides: Partial<DreamAnalysis> = {}): DreamAnalysis => ({
  id: Date.now(),
  transcript: 'Mock transcript',
  title: 'Dream title',
  interpretation: '',
  shareableQuote: '',
  imageUrl: '',
  chatHistory: [],
  dreamType: 'Symbolic Dream',
  isAnalyzed: false,
  analysisStatus: 'done',
  ...overrides,
});

describe('MockQuotaProvider', () => {
  beforeEach(() => {
    mockGetSavedDreams.mockReset();
    mockStorage.clear();
  });

  describe('analysis counting', () => {
    it('counts only dreams that have both isAnalyzed and analyzedAt set', async () => {
      // Given
      const dreams = [
        buildDream({ id: 1, isAnalyzed: true }), // missing analyzedAt
        buildDream({ id: 2, isAnalyzed: true, analyzedAt: Date.now() }),
        buildDream({ id: 3 }),
      ];
      mockGetSavedDreams.mockResolvedValueOnce(dreams);

      // When
      const provider = new MockQuotaProvider();
      await expect(provider.getUsedAnalysisCount(null)).resolves.toBe(1);
    });

    it('persists analysis usage after dream deletion in mock mode', async () => {
      // Given
      const analyzedDream = buildDream({ id: 4, isAnalyzed: true, analyzedAt: Date.now() });
      mockGetSavedDreams.mockResolvedValueOnce([analyzedDream]);

      const provider = new MockQuotaProvider();
      await provider.getUsedAnalysisCount(null);

      // Simulate deletion of the analyzed dream
      mockGetSavedDreams.mockResolvedValueOnce([]);
      provider.invalidate();

      // When
      const refreshedCount = await provider.getUsedAnalysisCount(null);

      // Then
      expect(refreshedCount).toBe(1); // Usage remains even if dream is gone
    });

    it('given cache invalidation when counting analysis then keeps persisted usage', async () => {
      // Given
      const analyzedDream = buildDream({ id: 4, isAnalyzed: true, analyzedAt: Date.now() });
      mockGetSavedDreams.mockResolvedValueOnce([analyzedDream]);

      const provider = new MockQuotaProvider();
      await provider.getUsedAnalysisCount(null);

      mockGetSavedDreams.mockResolvedValueOnce([]);
      provider.invalidate();

      // When
      const refreshedCount = await provider.getUsedAnalysisCount(null);

      // Then
      expect(refreshedCount).toBe(1);
      // May call storage multiple times due to sync logic
      expect(mockGetSavedDreams).toHaveBeenCalled();
    });
  });

  describe('message counting', () => {
    it('given dream target when counting messages then returns chat message count for specific dream', async () => {
      // Given
      const targetDream = buildDream({
        id: 123,
        chatHistory: Array(5).fill({ role: 'user', text: 'test' })
      });
      const otherDream = buildDream({
        id: 456,
        chatHistory: Array(10).fill({ role: 'user', text: 'test' })
      });
      mockGetSavedDreams.mockResolvedValueOnce([targetDream, otherDream]);

      const provider = new MockQuotaProvider();

      // When
      const count = await provider.getUsedMessagesCount({ dreamId: 123 }, null);

      // Then
      expect(count).toBe(5);
    });

    it('given dream object target when counting messages then returns chat message count', async () => {
      // Given
      const targetDream = buildDream({
        id: 123,
        chatHistory: Array(8).fill({ role: 'user', text: 'test' })
      });
      mockGetSavedDreams.mockResolvedValueOnce([targetDream]);

      const provider = new MockQuotaProvider();

      // When
      const count = await provider.getUsedMessagesCount({ dream: targetDream }, null);

      // Then
      expect(count).toBe(8);
    });

    it('given no target when counting messages then returns 0', async () => {
      // Given
      const dreams = [buildDream({ id: 123 })];
      mockGetSavedDreams.mockResolvedValueOnce(dreams);

      const provider = new MockQuotaProvider();

      // When
      const count = await provider.getUsedMessagesCount(undefined, null);

      // Then
      expect(count).toBe(0);
    });

    it('given non-existent dream when counting messages then returns 0', async () => {
      // Given
      const dreams = [buildDream({ id: 456 })];
      mockGetSavedDreams.mockResolvedValueOnce(dreams);

      const provider = new MockQuotaProvider();

      // When
      const count = await provider.getUsedMessagesCount({ dreamId: 999 }, null);

      // Then
      expect(count).toBe(0);
    });
  });

  describe('exploration validation', () => {
    it('given unexplored dream when checking exploration then validates against limits', async () => {
      // Given
      const user = { id: 'test-user', user_metadata: { tier: 'free' } } as any;
      const unexploredDream = buildDream({ id: 123, explorationStartedAt: undefined });
      mockGetSavedDreams.mockResolvedValueOnce([unexploredDream]);

      const provider = new MockQuotaProvider();

      // When
      const canExplore = await provider.canExploreDream({ dreamId: 123 }, user);

      // Then
      expect(canExplore).toBe(true); // Free tier with 0 explorations used
    });

    it('given already explored dream when checking exploration then always allows', async () => {
      // Given
      const user = { id: 'test-user', user_metadata: { tier: 'guest' } } as any;
      const exploredDream = buildDream({
        id: 123,
        explorationStartedAt: Date.now(),
        chatHistory: Array(20).fill({ role: 'user', text: 'test' })
      });
      mockGetSavedDreams.mockResolvedValueOnce([exploredDream]);

      const provider = new MockQuotaProvider();

      // When
      const canExplore = await provider.canExploreDream({ dreamId: 123 }, user);

      // Then
      expect(canExplore).toBe(true); // Already explored, always allowed
    });

    it('keeps exploration usage after dream deletion in mock mode', async () => {
      // Given
      const user = null; // Guest user
      const exploredDreams = [
        buildDream({ id: 1, explorationStartedAt: Date.now() }),
        buildDream({ id: 2, explorationStartedAt: Date.now() }),
      ];
      mockGetSavedDreams.mockResolvedValueOnce(exploredDreams);

      const provider = new MockQuotaProvider();
      await provider.getUsedExplorationCount(user);

      // Simulate dream deletion after usage was recorded
      mockGetSavedDreams.mockResolvedValueOnce([]);
      provider.invalidate();

      // When
      const canExplore = await provider.canExploreDream({ dreamId: 999 }, user);

      // Then
      expect(canExplore).toBe(false); // Usage persists; guest limit reached
    });

    it('given premium user when checking exploration then always allows', async () => {
      // Given
      const premiumUser = { id: 'premium-user', user_metadata: { tier: 'premium' } } as any;
      const dreams = [buildDream({ id: 123 })];
      mockGetSavedDreams.mockResolvedValueOnce(dreams);

      const provider = new MockQuotaProvider();

      // When
      const canExplore = await provider.canExploreDream({ dreamId: 123 }, premiumUser);

      // Then
      expect(canExplore).toBe(true); // Premium has unlimited exploration
    });

    it('given guest user beyond limits when checking exploration then denies', async () => {
      // Given
      const user = null; // Guest user
      const exploredDreams = Array(3).fill(null).map((_, i) => 
        buildDream({ id: i + 1, explorationStartedAt: Date.now() })
      );
      mockGetSavedDreams.mockResolvedValue(exploredDreams);

      const provider = new MockQuotaProvider();

      // When
      const canExplore = await provider.canExploreDream({ dreamId: 999 }, user);

      // Then
      expect(canExplore).toBe(false); // Guest limit exceeded
    });
  });

  describe('analysis validation', () => {
    it('given premium user when checking analysis then always allows', async () => {
      // Given
      const premiumUser = { id: 'premium-user', user_metadata: { tier: 'premium' } } as any;
      const dreams = Array(100).fill(null).map((_, i) => 
        buildDream({ id: i + 1, isAnalyzed: true, analyzedAt: Date.now() })
      );
      mockGetSavedDreams.mockResolvedValueOnce(dreams);

      const provider = new MockQuotaProvider();

      // When
      const canAnalyze = await provider.canAnalyzeDream(premiumUser);

      // Then
      expect(canAnalyze).toBe(true); // Premium has unlimited analysis
    });

    it('given free user within limits when checking analysis then allows', async () => {
      // Given
      const freeUser = { id: 'free-user', user_metadata: { tier: 'free' } } as any;
      const dreams = Array(2).fill(null).map((_, i) =>
        buildDream({ id: i + 1, isAnalyzed: true, analyzedAt: Date.now() })
      );
      mockGetSavedDreams.mockResolvedValueOnce(dreams);

      const provider = new MockQuotaProvider();

      // When
      const canAnalyze = await provider.canAnalyzeDream(freeUser);

      // Then
      expect(canAnalyze).toBe(true); // Free user within 3 analysis limit
    });

    it('given free user beyond limits when checking analysis then denies', async () => {
      // Given
      const freeUser = { id: 'free-user', user_metadata: { tier: 'free' } } as any;
      const dreams = Array(4).fill(null).map((_, i) =>
        buildDream({ id: i + 1, isAnalyzed: true, analyzedAt: Date.now() })
      );
      mockGetSavedDreams.mockResolvedValueOnce(dreams);

      const provider = new MockQuotaProvider();

      // When
      const canAnalyze = await provider.canAnalyzeDream(freeUser);

      // Then
      expect(canAnalyze).toBe(false); // Free user exceeded 3 analysis limit
    });
  });

  describe('message validation', () => {
    it('given user within message limit when checking messages then allows', async () => {
      // Given
      const user = { id: 'test-user', user_metadata: { tier: 'free' } } as any;
      const targetDream = buildDream({
        id: 123,
        chatHistory: Array(10).fill({ role: 'user', text: 'test' })
      });
      mockGetSavedDreams.mockResolvedValueOnce([targetDream]);

      const provider = new MockQuotaProvider();

      // When
      const canSendMessage = await provider.canSendChatMessage({ dreamId: 123 }, user);

      // Then
      expect(canSendMessage).toBe(true); // Free user within 20 message limit
    });

    it('given user beyond message limit when checking messages then denies', async () => {
      // Given
      const user = { id: 'test-user', user_metadata: { tier: 'free' } } as any;
      const targetDream = buildDream({
        id: 123,
        chatHistory: Array(25).fill({ role: 'user', text: 'test' })
      });
      mockGetSavedDreams.mockResolvedValueOnce([targetDream]);

      const provider = new MockQuotaProvider();

      // When
      const canSendMessage = await provider.canSendChatMessage({ dreamId: 123 }, user);

      // Then
      expect(canSendMessage).toBe(false); // Free user exceeded 20 message limit
    });
  });
});
