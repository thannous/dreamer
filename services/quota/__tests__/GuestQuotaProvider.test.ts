import type { DreamAnalysis } from '@/lib/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GuestQuotaProvider } from '../GuestQuotaProvider';

// Use vi.hoisted to ensure mock is available during module loading
const { mockGetDreams, localCounterConfig } = vi.hoisted(() => ({
  mockGetDreams: vi.fn<[], Promise<DreamAnalysis[]>>(),
  localCounterConfig: {
    analysisCount: 0,
    explorationCount: 0,
  },
}));

// Mock using the relative path from this test file to storageServiceReal
vi.mock('../../storageServiceReal', () => ({
  getSavedDreams: () => mockGetDreams(),
}));

// Mock GuestAnalysisCounter for persistent counts
vi.mock('../GuestAnalysisCounter', () => ({
  getLocalAnalysisCount: () => Promise.resolve(localCounterConfig.analysisCount),
  getLocalExplorationCount: () => Promise.resolve(localCounterConfig.explorationCount),
}));

const buildDream = (overrides: Partial<DreamAnalysis>): DreamAnalysis => ({
  id: Date.now(),
  transcript: 'Dream transcript',
  title: 'Dream',
  interpretation: '',
  shareableQuote: '',
  theme: undefined,
  dreamType: 'Symbolic Dream',
  imageUrl: '',
  chatHistory: [],
  isAnalyzed: false,
  analysisStatus: 'none',
  ...overrides,
});

describe('GuestQuotaProvider', () => {
  beforeEach(() => {
    mockGetDreams.mockReset();
    // Default to empty array to avoid undefined issues
    mockGetDreams.mockResolvedValue([]);
    // Reset local counter config
    localCounterConfig.analysisCount = 0;
    localCounterConfig.explorationCount = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('analysis validation', () => {
    it('given guest limit reached when checking analysis then blocks', async () => {
      // Given - persistent counter at limit (2)
      localCounterConfig.analysisCount = 2;

      const provider = new GuestQuotaProvider();

      // When
      const canAnalyze = await provider.canAnalyzeDream(null);

      // Then
      expect(canAnalyze).toBe(false);
    });

    it('given guest within limit when checking analysis then allows', async () => {
      // Given - persistent counter below limit
      localCounterConfig.analysisCount = 1;

      const provider = new GuestQuotaProvider();

      // When
      const canAnalyze = await provider.canAnalyzeDream(null);

      // Then
      expect(canAnalyze).toBe(true);
    });

    it('given authenticated user when checking analysis then allows', async () => {
      // Given
      const user = { id: 'test-user', user_metadata: { tier: 'free' } } as any;
      const provider = new GuestQuotaProvider();

      // When
      const canAnalyze = await provider.canAnalyzeDream(user);

      // Then
      expect(canAnalyze).toBe(true);
    });
  });

  describe('exploration validation', () => {
    it('given already explored dream when checking exploration then allows continued', async () => {
      // Given - dream is already explored
      const dream = buildDream({ id: 5, explorationStartedAt: Date.now() });
      mockGetDreams.mockResolvedValueOnce([dream]);
      const provider = new GuestQuotaProvider();

      // When
      const canExplore = await provider.canExploreDream({ dreamId: dream.id }, null);

      // Then
      expect(canExplore).toBe(true);
    });

    it('given guest within exploration limit when checking new dream then allows', async () => {
      // Given - persistent counter below limit
      localCounterConfig.explorationCount = 1;
      mockGetDreams.mockResolvedValueOnce([]);
      const provider = new GuestQuotaProvider();

      // When
      const canExplore = await provider.canExploreDream({ dreamId: 999 }, null);

      // Then
      expect(canExplore).toBe(true);
    });

    it('given guest beyond exploration limit when checking new dream then denies', async () => {
      // Given - persistent counter at limit (2)
      localCounterConfig.explorationCount = 2;
      mockGetDreams.mockResolvedValueOnce([]);
      const provider = new GuestQuotaProvider();

      // When
      const canExplore = await provider.canExploreDream({ dreamId: 999 }, null);

      // Then
      expect(canExplore).toBe(false);
    });

    it('given authenticated user when checking exploration then allows', async () => {
      // Given
      const user = { id: 'test-user', user_metadata: { tier: 'free' } } as any;
      const provider = new GuestQuotaProvider();

      // When
      const canExplore = await provider.canExploreDream({ dreamId: 999 }, user);

      // Then
      expect(canExplore).toBe(true);
    });
  });

  describe('message validation', () => {
    it('given guest within message limit when checking messages then allows', async () => {
      // Given
      const dream = buildDream({ 
        id: 123, 
        chatHistory: Array(5).fill({ role: 'user', text: 'test' }) 
      });
      mockGetDreams.mockResolvedValueOnce([dream]);
      const provider = new GuestQuotaProvider();

      // When
      const canSendMessage = await provider.canSendChatMessage({ dreamId: 123 }, null);

      // Then
      expect(canSendMessage).toBe(true);
    });

    it('given guest beyond message limit when checking messages then denies', async () => {
      // Given
      const dream = buildDream({ 
        id: 123, 
        chatHistory: Array(25).fill({ role: 'user', text: 'test' }) 
      });
      mockGetDreams.mockResolvedValueOnce([dream]);
      const provider = new GuestQuotaProvider();

      // When
      const canSendMessage = await provider.canSendChatMessage({ dreamId: 123 }, null);

      // Then
      expect(canSendMessage).toBe(false);
    });

    it('given authenticated user when checking messages then allows', async () => {
      // Given
      const user = { id: 'test-user', user_metadata: { tier: 'free' } } as any;
      const provider = new GuestQuotaProvider();

      // When
      const canSendMessage = await provider.canSendChatMessage({ dreamId: 123 }, user);

      // Then
      expect(canSendMessage).toBe(true);
    });
  });

  describe('usage counting', () => {
    it('given persistent counter when counting analysis then returns counter value', async () => {
      // Given - persistent counter has value
      localCounterConfig.analysisCount = 2;
      const provider = new GuestQuotaProvider();

      // When
      const count = await provider.getUsedAnalysisCount(null);

      // Then
      expect(count).toBe(2);
    });

    it('given persistent counter when counting exploration then returns counter value', async () => {
      // Given - persistent counter has value
      localCounterConfig.explorationCount = 2;
      const provider = new GuestQuotaProvider();

      // When
      const count = await provider.getUsedExplorationCount(null);

      // Then
      expect(count).toBe(2);
    });

    it('given dream with chat history when counting messages then returns correct count', async () => {
      // Given
      const dream = buildDream({
        id: 123,
        chatHistory: Array(8).fill({ role: 'user', text: 'test' })
      });
      mockGetDreams.mockResolvedValueOnce([dream]);
      const provider = new GuestQuotaProvider();

      // When
      const count = await provider.getUsedMessagesCount({ dreamId: 123 }, null);

      // Then
      expect(count).toBe(8);
    });

    it('given analyzed dreams exceed counter when counting analysis then uses dream count', async () => {
      // Given - counter is outdated but two dreams are analyzed
      localCounterConfig.analysisCount = 0;
      mockGetDreams.mockResolvedValueOnce([
        buildDream({ id: 1, isAnalyzed: true, analyzedAt: Date.now() }),
        buildDream({ id: 2, isAnalyzed: true, analyzedAt: Date.now() }),
      ]);
      const provider = new GuestQuotaProvider();

      // When
      const count = await provider.getUsedAnalysisCount(null);

      // Then
      expect(count).toBe(2);
    });

    it('given explored dreams exceed counter when counting exploration then uses dream count', async () => {
      // Given - counter is outdated but dreams are explored
      localCounterConfig.explorationCount = 0;
      mockGetDreams.mockResolvedValueOnce([
        buildDream({ id: 3, explorationStartedAt: Date.now() }),
        buildDream({ id: 4, explorationStartedAt: Date.now() }),
      ]);
      const provider = new GuestQuotaProvider();

      // When
      const count = await provider.getUsedExplorationCount(null);

      // Then
      expect(count).toBe(2);
    });
  });

  describe('quota status', () => {
    it('given authenticated user when getting status then returns free tier placeholder', async () => {
      // Given
      const user = { id: 'test-user', user_metadata: { tier: 'free' } } as any;
      const provider = new GuestQuotaProvider();

      // When
      const status = await provider.getQuotaStatus(user);

      // Then
      expect(status.tier).toBe('free');
      expect(status.canAnalyze).toBe(true);
      expect(status.canExplore).toBe(true);
      expect(status.usage.analysis.limit).toBeNull();
      expect(status.usage.exploration.limit).toBeNull();
    });

    it('given guest user with limits exceeded when getting status then includes reasons', async () => {
      // Given - persistent counter at limit
      localCounterConfig.analysisCount = 2;
      const dreamB = buildDream({
        id: 11,
        chatHistory: [
          { role: 'user', text: 'hello' },
          { role: 'model', text: 'hi' },
          { role: 'user', text: 'follow-up' },
        ]
      });
      mockGetDreams.mockResolvedValueOnce([dreamB]);

      const provider = new GuestQuotaProvider();

      // When
      const status = await provider.getQuotaStatus(null, { dreamId: dreamB.id });

      // Then
      expect(status.usage.analysis.used).toBe(2);
      expect(status.usage.messages.used).toBe(2);
      expect(status.canAnalyze).toBe(false);
      expect(status.reasons?.[0]).toContain('Guest analysis limit');
    });

    it('given guest user within limits when getting status then shows all permissions', async () => {
      // Given - persistent counter below limit
      localCounterConfig.analysisCount = 1;
      localCounterConfig.explorationCount = 0;

      const provider = new GuestQuotaProvider();

      // When
      const status = await provider.getQuotaStatus(null, { dreamId: 999 });

      // Then
      expect(status.tier).toBe('guest');
      expect(status.canAnalyze).toBe(true);
      expect(status.canExplore).toBe(true);
      expect(status.reasons).toBeUndefined();
    });

    it('given guest beyond exploration limit when getting status then includes exploration reason', async () => {
      // Given - persistent counter at limit
      localCounterConfig.explorationCount = 2;
      mockGetDreams.mockResolvedValueOnce([]);

      const provider = new GuestQuotaProvider();

      // When
      const status = await provider.getQuotaStatus(null, { dreamId: 999 });

      // Then
      expect(status.canExplore).toBe(false);
      expect(status.reasons).toBeDefined();
      expect(status.reasons!.some(reason => reason.includes('Guest exploration limit reached'))).toBe(true);
    });
  });

  describe('cache management', () => {
    it('given provider when invalidating cache then completes successfully', async () => {
      // Given
      const provider = new GuestQuotaProvider();

      // When
      provider.invalidate();

      // Then
      // Cache invalidation should complete without errors
      expect(true).toBe(true);
    });
  });
});
