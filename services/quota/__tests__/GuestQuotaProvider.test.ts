import type { DreamAnalysis } from '@/lib/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GuestQuotaProvider } from '../GuestQuotaProvider';

// Use vi.hoisted to ensure mock is available during module loading
const { mockGetDreams } = vi.hoisted(() => ({
  mockGetDreams: vi.fn<[], Promise<DreamAnalysis[]>>(),
}));

// Mock using the relative path from this test file to storageServiceReal
vi.mock('../../storageServiceReal', () => ({
  getSavedDreams: () => mockGetDreams(),
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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('analysis validation', () => {
    it('given guest limit reached when checking analysis then blocks', async () => {
      // Given
      const analyzedDreams: DreamAnalysis[] = [
        buildDream({ id: 1, isAnalyzed: true, analyzedAt: Date.now() }),
        buildDream({ id: 2, isAnalyzed: true, analyzedAt: Date.now() }),
      ];
      mockGetDreams.mockResolvedValueOnce(analyzedDreams);

      const provider = new GuestQuotaProvider();

      // When
      const canAnalyze = await provider.canAnalyzeDream(null);

      // Then
      expect(canAnalyze).toBe(false);
    });

    it('given guest within limit when checking analysis then allows', async () => {
      // Given
      const analyzedDreams: DreamAnalysis[] = [
        buildDream({ id: 1, isAnalyzed: true, analyzedAt: Date.now() }),
      ];
      mockGetDreams.mockResolvedValueOnce(analyzedDreams);

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
      // Given
      const dream = buildDream({ id: 5, explorationStartedAt: Date.now() });
      mockGetDreams.mockResolvedValueOnce([dream]);
      const provider = new GuestQuotaProvider();

      // When
      const canExplore = await provider.canExploreDream({ dreamId: dream.id }, null);

      // Then
      expect(canExplore).toBe(true);
    });

    it('given guest within exploration limit when checking new dream then allows', async () => {
      // Given
      const dreams: DreamAnalysis[] = [
        buildDream({ id: 1, explorationStartedAt: Date.now() }),
      ];
      mockGetDreams.mockResolvedValueOnce(dreams);
      const provider = new GuestQuotaProvider();

      // When
      const canExplore = await provider.canExploreDream({ dreamId: 999 }, null);

      // Then
      expect(canExplore).toBe(true);
    });

    it('given guest beyond exploration limit when checking new dream then denies', async () => {
      // Given
      const exploredDreams = Array(3).fill(null).map((_, i) => 
        buildDream({ id: i + 1, explorationStartedAt: Date.now() })
      );
      mockGetDreams.mockResolvedValueOnce(exploredDreams);
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
    it('given analyzed dreams when counting analysis then returns correct count', async () => {
      // Given
      const dreams: DreamAnalysis[] = [
        buildDream({ id: 1, isAnalyzed: true, analyzedAt: Date.now() }),
        buildDream({ id: 2, isAnalyzed: true, analyzedAt: Date.now() }),
        buildDream({ id: 3, isAnalyzed: false }), // Not analyzed
      ];
      mockGetDreams.mockResolvedValueOnce(dreams);
      const provider = new GuestQuotaProvider();

      // When
      const count = await provider.getUsedAnalysisCount(null);

      // Then
      expect(count).toBe(2);
    });

    it('given explored dreams when counting exploration then returns correct count', async () => {
      // Given
      const dreams: DreamAnalysis[] = [
        buildDream({ id: 1, explorationStartedAt: Date.now() }),
        buildDream({ id: 2, explorationStartedAt: Date.now() }),
        buildDream({ id: 3 }), // Not explored
      ];
      mockGetDreams.mockResolvedValueOnce(dreams);
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
      // Given
      const dreamA = buildDream({ id: 10, isAnalyzed: true, analyzedAt: Date.now() });
      const dreamB = buildDream({ id: 11, isAnalyzed: true, analyzedAt: Date.now(), explorationStartedAt: Date.now(), chatHistory: [
        { role: 'user', text: 'hello' },
        { role: 'model', text: 'hi' },
        { role: 'user', text: 'follow-up' },
      ] });
      mockGetDreams.mockResolvedValueOnce([dreamA, dreamB]);

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
      // Given
      const singleDream = buildDream({ id: 1, isAnalyzed: true, analyzedAt: Date.now() });
      mockGetDreams.mockResolvedValueOnce([singleDream]);

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
      // Given
      const exploredDreams = Array(3).fill(null).map((_, i) => 
        buildDream({ id: i + 1, explorationStartedAt: Date.now() })
      );
      mockGetDreams.mockResolvedValueOnce(exploredDreams);

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
