import { useState, useEffect, useCallback, useMemo } from 'react';
import type { DreamAnalysis, QuotaStatus } from '@/lib/types';
import { quotaService } from '@/services/quotaService';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from './useSubscription';
import { deriveUserTier } from '@/lib/quotaTier';

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

  const baseTarget = useMemo(() => normalizeTarget(targetInput), [targetInput]);
  const supabaseTier = useMemo(() => deriveUserTier(user), [user]);

  const resolveTarget = useCallback(
    (override?: QuotaTargetInput) => normalizeTarget(override) ?? baseTarget,
    [baseTarget]
  );

  // RevenueCat is the source of truth, but we should not downgrade paid users while it loads.
  // If Supabase already indicates a paid tier, treat it as paid until RevenueCat resolves.
  const tier = useMemo(() => {
    if (!user?.id) return 'guest';

    // Fallback conservateur: uniquement si l'expiration est largement passée
    // et que l'abonnement ne renouvelle pas.
    if (subscriptionStatus?.expiryDate && subscriptionStatus?.tier === 'plus') {
      const expiryTime = new Date(subscriptionStatus.expiryDate).getTime();
      const now = Date.now();
      const marginMs = 24 * 60 * 60 * 1000;
      if (expiryTime + marginMs < now && subscriptionStatus.willRenew === false) {
        if (__DEV__) {
          console.warn('[useQuota] Subscription expired (24h+ margin, willRenew=false), tier should be free');
        }
        return 'free';
      }
    }

    const optimisticPaidTier =
      supabaseTier === 'plus' || supabaseTier === 'premium' ? supabaseTier : null;

    return subscriptionStatus?.tier ?? optimisticPaidTier ?? 'free';
  }, [subscriptionStatus?.tier, subscriptionStatus?.expiryDate, subscriptionStatus?.willRenew, supabaseTier, user?.id]);
  const isPaidTier = tier === 'plus' || tier === 'premium';

  /**
   * Fetch quota status
   * Wait for subscription to load before fetching quota to use RevenueCat tier
   */
  const fetchQuotaStatus = useCallback(async () => {
    // For paid tiers, mirror RevenueCat (source of truth) and short-circuit to unlimited.
    if (isPaidTier) {
      const unlimitedUsage = { used: 0, limit: null, remaining: null } as const;
      setQuotaStatus({
        tier,
        usage: {
          analysis: unlimitedUsage,
          exploration: unlimitedUsage,
          messages: unlimitedUsage,
        },
        canAnalyze: true,
        canExplore: true,
      });
      setLoading(false);
      setError(null);
      return;
    }

    // Don't fetch until subscription is loaded (avoids relying on the default 'free' tier).
    if (subscriptionLoading) return;

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
  }, [user, tier, baseTarget, subscriptionLoading, isPaidTier]);

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
    if (isPaidTier) return true;
    return quotaService.canAnalyzeDream(user, tier);
  }, [isPaidTier, user, tier]);

  /**
   * Check if user can explore a specific dream
   */
  const canExplore = useCallback(
    async (override?: QuotaTargetInput): Promise<boolean> => {
      if (isPaidTier) return true;
      return quotaService.canExploreDream(resolveTarget(override), user, tier);
    },
    [isPaidTier, user, tier, resolveTarget]
  );

  /**
   * Check if user can send a chat message
   */
  const canChat = useCallback(
    async (override?: QuotaTargetInput): Promise<boolean> => {
      if (isPaidTier) return true;
      return quotaService.canSendChatMessage(resolveTarget(override), user, tier);
    },
    [isPaidTier, user, tier, resolveTarget]
  );

  /**
   * Get usage counts
   */
  const getUsageCounts = useCallback(async () => {
    if (isPaidTier) {
      return {
        analysis: 0,
        exploration: 0,
        messages: 0,
      };
    }

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
  }, [isPaidTier, user, baseTarget]);

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
    // Only wait for RevenueCat when we don't have an optimistic paid tier from Supabase.
    loading: loading || (subscriptionLoading && !isPaidTier),
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
