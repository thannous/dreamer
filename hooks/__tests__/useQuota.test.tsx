/**
 * @vitest-environment happy-dom
 */
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { QuotaStatus } from '../../lib/types';

// Hoist mock functions
const {
  mockGetQuotaStatus,
  mockInvalidate,
  mockInvalidateAll,
  mockCanAnalyzeDream,
  mockCanExploreDream,
  mockCanSendChatMessage,
  mockGetUsedAnalysisCount,
  mockGetUsedExplorationCount,
  mockGetUsedMessagesCount,
} = vi.hoisted(() => ({
  mockGetQuotaStatus: vi.fn(),
  mockInvalidate: vi.fn(),
  mockInvalidateAll: vi.fn(),
  mockCanAnalyzeDream: vi.fn(),
  mockCanExploreDream: vi.fn(),
  mockCanSendChatMessage: vi.fn(),
  mockGetUsedAnalysisCount: vi.fn(),
  mockGetUsedExplorationCount: vi.fn(),
  mockGetUsedMessagesCount: vi.fn(),
}));

let mockUser: any = null;
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

vi.mock('../../services/quotaService', () => ({
  quotaService: {
    getQuotaStatus: mockGetQuotaStatus,
    invalidate: mockInvalidate,
    invalidateAll: mockInvalidateAll,
    canAnalyzeDream: mockCanAnalyzeDream,
    canExploreDream: mockCanExploreDream,
    canSendChatMessage: mockCanSendChatMessage,
    getUsedAnalysisCount: mockGetUsedAnalysisCount,
    getUsedExplorationCount: mockGetUsedExplorationCount,
    getUsedMessagesCount: mockGetUsedMessagesCount,
  },
}));

// Import after mocks
const { useQuota } = await import('../useQuota');

const buildQuotaStatus = (overrides: Partial<QuotaStatus> = {}): QuotaStatus => ({
  tier: 'guest',
  canAnalyze: true,
  canExplore: true,
  usage: {
    analysisCount: 0,
    analysisLimit: 3,
    explorationCount: 0,
    explorationLimit: 1,
  },
  reasons: [],
  ...overrides,
});

describe('useQuota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    mockGetQuotaStatus.mockResolvedValue(buildQuotaStatus());
    mockCanAnalyzeDream.mockResolvedValue(true);
    mockCanExploreDream.mockResolvedValue(true);
    mockCanSendChatMessage.mockResolvedValue(true);
    mockGetUsedAnalysisCount.mockResolvedValue(0);
    mockGetUsedExplorationCount.mockResolvedValue(0);
    mockGetUsedMessagesCount.mockResolvedValue(0);
  });

  describe('initialization and loading', () => {
    it('fetches quota status on mount', async () => {
      const { result } = renderHook(() => useQuota());

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockGetQuotaStatus).toHaveBeenCalledWith(null, undefined);
      expect(result.current.quotaStatus).toBeDefined();
    });

    it('provides guest tier by default when not authenticated', async () => {
      mockGetQuotaStatus.mockResolvedValue(buildQuotaStatus({ tier: 'guest' }));

      const { result } = renderHook(() => useQuota());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.tier).toBe('guest');
    });

    it('provides free tier when authenticated', async () => {
      mockUser = { id: 'user-1' };
      mockGetQuotaStatus.mockResolvedValue(buildQuotaStatus({ tier: 'free' }));

      const { result } = renderHook(() => useQuota());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.tier).toBe('free');
      expect(mockGetQuotaStatus).toHaveBeenCalledWith(mockUser, undefined);
    });

    it('handles errors gracefully', async () => {
      const testError = new Error('Quota service error');
      mockGetQuotaStatus.mockRejectedValue(testError);

      const { result } = renderHook(() => useQuota());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe(testError);
      expect(result.current.quotaStatus).toBeNull();
    });
  });

  describe('quota status with target dream', () => {
    it('fetches quota status with dreamId target', async () => {
      const { result } = renderHook(() => useQuota({ dreamId: 123 }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockGetQuotaStatus).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ dreamId: 123 })
      );
    });

    it('fetches quota status with dream object target', async () => {
      const dream = { id: 456, transcript: 'Test dream' } as any;
      const { result } = renderHook(() => useQuota({ dream }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockGetQuotaStatus).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ dreamId: 456, dream })
      );
    });

    it('normalizes target when both dreamId and dream provided', async () => {
      const dream = { id: 789, transcript: 'Test dream' } as any;
      const { result } = renderHook(() => useQuota({ dreamId: 123, dream }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should use dream.id when both provided
      expect(mockGetQuotaStatus).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ dreamId: 789 })
      );
    });
  });

  describe('convenience flags', () => {
    it('provides canAnalyzeNow flag from quota status', async () => {
      mockGetQuotaStatus.mockResolvedValue(buildQuotaStatus({ canAnalyze: true }));

      const { result } = renderHook(() => useQuota());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canAnalyzeNow).toBe(true);
    });

    it('provides canExploreNow flag from quota status', async () => {
      mockGetQuotaStatus.mockResolvedValue(buildQuotaStatus({ canExplore: false }));

      const { result } = renderHook(() => useQuota());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canExploreNow).toBe(false);
    });

    it('provides usage data from quota status', async () => {
      const usage = {
        analysisCount: 2,
        analysisLimit: 3,
        explorationCount: 1,
        explorationLimit: 1,
      };
      mockGetQuotaStatus.mockResolvedValue(buildQuotaStatus({ usage }));

      const { result } = renderHook(() => useQuota());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.usage).toEqual(usage);
    });

    it('provides reasons array from quota status', async () => {
      const reasons = ['Guest limit reached', 'Sign in to continue'];
      mockGetQuotaStatus.mockResolvedValue(buildQuotaStatus({ reasons }));

      const { result } = renderHook(() => useQuota());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.reasons).toEqual(reasons);
    });
  });

  describe('refetch and invalidation', () => {
    it('refetches quota status on demand', async () => {
      const { result } = renderHook(() => useQuota());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockGetQuotaStatus).toHaveBeenCalledTimes(1);

      await result.current.refetch();

      expect(mockGetQuotaStatus).toHaveBeenCalledTimes(2);
    });

    it('invalidates cache and refetches', async () => {
      const { result } = renderHook(() => useQuota());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      result.current.invalidate();

      expect(mockInvalidate).toHaveBeenCalledWith(null);
      await waitFor(() => {
        expect(mockGetQuotaStatus).toHaveBeenCalledTimes(2);
      });
    });

    it('invalidates all caches when user changes', async () => {
      const { rerender } = renderHook(() => useQuota());

      await waitFor(() => {
        expect(mockGetQuotaStatus).toHaveBeenCalledTimes(1);
      });

      // Change user
      mockUser = { id: 'user-1' };
      rerender();

      expect(mockInvalidateAll).toHaveBeenCalled();
    });
  });

  describe('capability checks', () => {
    it('checks if user can analyze', async () => {
      mockCanAnalyzeDream.mockResolvedValue(true);

      const { result } = renderHook(() => useQuota());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const canAnalyze = await result.current.canAnalyze();

      expect(canAnalyze).toBe(true);
      expect(mockCanAnalyzeDream).toHaveBeenCalledWith(null);
    });

    it('checks if user can explore with target', async () => {
      mockCanExploreDream.mockResolvedValue(false);

      const { result } = renderHook(() => useQuota({ dreamId: 123 }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const canExplore = await result.current.canExplore();

      expect(canExplore).toBe(false);
      expect(mockCanExploreDream).toHaveBeenCalledWith(
        expect.objectContaining({ dreamId: 123 }),
        null
      );
    });

    it('checks if user can explore with override target', async () => {
      mockCanExploreDream.mockResolvedValue(true);

      const { result } = renderHook(() => useQuota({ dreamId: 123 }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Override with different dreamId
      const canExplore = await result.current.canExplore({ dreamId: 456 });

      expect(canExplore).toBe(true);
      expect(mockCanExploreDream).toHaveBeenCalledWith(
        expect.objectContaining({ dreamId: 456 }),
        null
      );
    });

    it('checks if user can chat', async () => {
      mockCanSendChatMessage.mockResolvedValue(true);

      const { result } = renderHook(() => useQuota({ dreamId: 123 }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const canChat = await result.current.canChat();

      expect(canChat).toBe(true);
      expect(mockCanSendChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({ dreamId: 123 }),
        null
      );
    });
  });

  describe('usage counts', () => {
    it('retrieves usage counts', async () => {
      mockGetUsedAnalysisCount.mockResolvedValue(2);
      mockGetUsedExplorationCount.mockResolvedValue(1);
      mockGetUsedMessagesCount.mockResolvedValue(5);

      const { result } = renderHook(() => useQuota({ dreamId: 123 }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const counts = await result.current.getUsageCounts();

      expect(counts).toEqual({
        analysis: 2,
        exploration: 1,
        messages: 5,
      });
      expect(mockGetUsedAnalysisCount).toHaveBeenCalledWith(null);
      expect(mockGetUsedExplorationCount).toHaveBeenCalledWith(null);
      expect(mockGetUsedMessagesCount).toHaveBeenCalledWith(
        expect.objectContaining({ dreamId: 123 }),
        null
      );
    });

    it('returns 0 message count when no target provided', async () => {
      mockGetUsedAnalysisCount.mockResolvedValue(2);
      mockGetUsedExplorationCount.mockResolvedValue(1);

      const { result } = renderHook(() => useQuota());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const counts = await result.current.getUsageCounts();

      expect(counts).toEqual({
        analysis: 2,
        exploration: 1,
        messages: 0,
      });
      expect(mockGetUsedMessagesCount).not.toHaveBeenCalled();
    });
  });

  describe('user authentication changes', () => {
    it('refetches quota when user signs in', async () => {
      const { rerender } = renderHook(() => useQuota());

      await waitFor(() => {
        expect(mockGetQuotaStatus).toHaveBeenCalledTimes(1);
      });

      // User signs in
      mockUser = { id: 'user-1' };
      mockGetQuotaStatus.mockResolvedValue(buildQuotaStatus({ tier: 'free' }));
      rerender();

      await waitFor(() => {
        expect(mockGetQuotaStatus).toHaveBeenCalledTimes(2);
      });

      expect(mockGetQuotaStatus).toHaveBeenLastCalledWith(mockUser, undefined);
    });

    it('refetches quota when user signs out', async () => {
      mockUser = { id: 'user-1' };
      const { result, rerender } = renderHook(() => useQuota());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // User signs out
      mockUser = null;
      mockGetQuotaStatus.mockResolvedValue(buildQuotaStatus({ tier: 'guest' }));
      rerender();

      await waitFor(() => {
        expect(mockGetQuotaStatus).toHaveBeenCalledTimes(2);
      });

      expect(mockGetQuotaStatus).toHaveBeenLastCalledWith(null, undefined);
    });
  });
});
