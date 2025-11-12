import { useState, useEffect, useCallback, useMemo } from 'react';
import type { DreamAnalysis, QuotaStatus } from '@/lib/types';
import { quotaService } from '@/services/quotaService';
import { useAuth } from '@/context/AuthContext';

/**
 * React hook for quota management
 * Provides reactive quota status with automatic cache invalidation
 */
type QuotaTargetInput = {
  dreamId?: number;
  dream?: DreamAnalysis;
};

function normalizeTarget(input?: QuotaTargetInput) {
  if (!input) return undefined;
  const dreamId = input.dream?.id ?? input.dreamId;
  if (!dreamId && !input.dream) {
    return undefined;
  }
  return {
    dreamId,
    dream: input.dream,
  };
}

export function useQuota(targetInput?: QuotaTargetInput) {
  const { user } = useAuth();
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const baseTarget = useMemo(() => normalizeTarget(targetInput), [targetInput?.dream, targetInput?.dreamId]);

  const resolveTarget = useCallback(
    (override?: QuotaTargetInput) => normalizeTarget(override) ?? baseTarget,
    [baseTarget]
  );

  /**
   * Fetch quota status
   */
  const fetchQuotaStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const status = await quotaService.getQuotaStatus(user, baseTarget);
      setQuotaStatus(status);
    } catch (err) {
      console.error('Error fetching quota status:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [user, baseTarget]);

  /**
   * Invalidate cache and refetch
   */
  const invalidate = useCallback(() => {
    quotaService.invalidate(user);
    fetchQuotaStatus();
  }, [user, fetchQuotaStatus]);

  /**
   * Check if user can analyze a dream
   */
  const canAnalyze = useCallback(async (): Promise<boolean> => {
    return quotaService.canAnalyzeDream(user);
  }, [user]);

  /**
   * Check if user can explore a specific dream
   */
  const canExplore = useCallback(
    async (override?: QuotaTargetInput): Promise<boolean> => {
      return quotaService.canExploreDream(resolveTarget(override), user);
    },
    [user, resolveTarget]
  );

  /**
   * Check if user can send a chat message
   */
  const canChat = useCallback(
    async (override?: QuotaTargetInput): Promise<boolean> => {
      return quotaService.canSendChatMessage(resolveTarget(override), user);
    },
    [user, resolveTarget]
  );

  /**
   * Get usage counts
   */
  const getUsageCounts = useCallback(async () => {
    const [analysisCount, explorationCount, messageCount] = await Promise.all([
      quotaService.getUsedAnalysisCount(user),
      quotaService.getUsedExplorationCount(user),
      baseTarget ? quotaService.getUsedMessagesCount(baseTarget, user) : Promise.resolve(0),
    ]);

    return {
      analysis: analysisCount,
      exploration: explorationCount,
      messages: messageCount,
    };
  }, [user, baseTarget]);

  // Fetch on mount and when user/dreamId changes
  useEffect(() => {
    fetchQuotaStatus();
  }, [fetchQuotaStatus]);

  // Invalidate cache when user changes (sign in/out)
  useEffect(() => {
    quotaService.invalidateAll();
  }, [user?.id]); // Only on user ID change, not user object reference

  return {
    quotaStatus,
    loading,
    error,
    refetch: fetchQuotaStatus,
    invalidate,
    canAnalyze,
    canExplore,
    canChat,
    getUsageCounts,

    // Convenience flags from quota status
    tier: quotaStatus?.tier || 'guest',
    canAnalyzeNow: quotaStatus?.canAnalyze ?? false,
    canExploreNow: quotaStatus?.canExplore ?? false,
    usage: quotaStatus?.usage,
    reasons: quotaStatus?.reasons,
  };
}
