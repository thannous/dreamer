import { useState, useEffect, useCallback, useMemo } from 'react';
import type { DreamAnalysis, QuotaStatus } from '@/lib/types';
import { quotaService } from '@/services/quotaService';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from './useSubscription';

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
  const { status: subscriptionStatus, loading: subscriptionLoading } = useSubscription();
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const baseTarget = useMemo(() => normalizeTarget(targetInput), [targetInput?.dream, targetInput?.dreamId]);

  const resolveTarget = useCallback(
    (override?: QuotaTargetInput) => normalizeTarget(override) ?? baseTarget,
    [baseTarget]
  );

  // Get tier from RevenueCat (source of truth)
  const tier = subscriptionStatus?.tier || 'free';

  /**
   * Fetch quota status
   * Wait for subscription to load before fetching quota to use RevenueCat tier
   */
  const fetchQuotaStatus = useCallback(async () => {
    // Don't fetch until subscription is loaded
    if (subscriptionLoading || !subscriptionStatus) return;

    try {
      setLoading(true);
      setError(null);
      const status = await quotaService.getQuotaStatus(user, tier, baseTarget);
      setQuotaStatus(status);
    } catch (err) {
      console.error('Error fetching quota status:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [user, tier, baseTarget, subscriptionLoading, subscriptionStatus]);

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
    return quotaService.canAnalyzeDream(user, tier);
  }, [user, tier]);

  /**
   * Check if user can explore a specific dream
   */
  const canExplore = useCallback(
    async (override?: QuotaTargetInput): Promise<boolean> => {
      return quotaService.canExploreDream(resolveTarget(override), user, tier);
    },
    [user, tier, resolveTarget]
  );

  /**
   * Check if user can send a chat message
   */
  const canChat = useCallback(
    async (override?: QuotaTargetInput): Promise<boolean> => {
      return quotaService.canSendChatMessage(resolveTarget(override), user, tier);
    },
    [user, tier, resolveTarget]
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

  useEffect(() => {
    const unsubscribe = quotaService.subscribe(fetchQuotaStatus);
    return unsubscribe;
  }, [fetchQuotaStatus]);

  // Invalidate cache when user changes (sign in/out)
  useEffect(() => {
    quotaService.invalidateAll();
  }, [user?.id]); // Only on user ID change, not user object reference

  return {
    quotaStatus,
    loading: loading || subscriptionLoading, // Combine subscription and quota loading states
    error,
    refetch: fetchQuotaStatus,
    invalidate,
    canAnalyze,
    canExplore,
    canChat,
    getUsageCounts,

    // Convenience flags from quota status
    // Use tier from RevenueCat (source of truth), not from quotaStatus
    tier,
    // Default to optimistic while loading to avoid false blocks (gate will fail later if quota is actually exceeded)
    canAnalyzeNow: quotaStatus?.canAnalyze ?? true,
    canExploreNow: quotaStatus?.canExplore ?? true,
    usage: quotaStatus?.usage,
    reasons: quotaStatus?.reasons,
  };
}
