import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from 'react';
import type { DreamAnalysis, QuotaStatus } from '@/lib/types';
import { isMockModeEnabled } from '@/lib/env';
import { getGuestBootstrapState, subscribeGuestBootstrapState } from '@/lib/guestSession';
import { quotaService } from '@/services/quotaService';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from './useSubscription';
import { deriveUserTier } from '@/lib/quotaTier';
import { resolveCanGenerateImage, UNLIMITED_QUOTA_METRIC } from '@/services/quota/quotaMetrics';

/**
 * React hook for quota management
 * Provides reactive quota status with automatic cache invalidation
 */
type QuotaTargetInput = {
  dreamId?: number;
  dream?: DreamAnalysis;
};

type NormalizedQuotaTarget = {
  dreamId: number;
  dream?: DreamAnalysis;
};

const getGuestBootstrapStatus = () => getGuestBootstrapState().status;

function normalizeTarget(input?: QuotaTargetInput): NormalizedQuotaTarget | undefined {
  if (!input) return undefined;
  const resolvedId = Number.isFinite(input.dream?.id)
    ? Number(input.dream?.id)
    : Number.isFinite(input.dreamId)
      ? Number(input.dreamId)
      : undefined;

  if (resolvedId === undefined) return undefined;

  if (input.dream && input.dream.id === resolvedId) {
    return { dreamId: resolvedId, dream: input.dream };
  }

  return { dreamId: resolvedId };
}

export function useQuota(targetInput?: QuotaTargetInput) {
  const isMockMode = isMockModeEnabled();
  const { user } = useAuth();
  const { status: subscriptionStatus, loading: subscriptionLoading } = useSubscription();
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const guestBootstrapStatus = useSyncExternalStore(
    subscribeGuestBootstrapState,
    getGuestBootstrapStatus,
    getGuestBootstrapStatus
  );

  const targetDreamId = targetInput?.dream?.id ?? targetInput?.dreamId;
  const normalizedDreamId = Number.isFinite(targetDreamId) ? Number(targetDreamId) : undefined;
  const fallbackDream = targetInput?.dream;

  const baseTarget = useMemo(() => {
    if (normalizedDreamId !== undefined) {
      if (fallbackDream && fallbackDream.id === normalizedDreamId) {
        return { dreamId: normalizedDreamId, dream: fallbackDream };
      }
      return { dreamId: normalizedDreamId };
    }
    if (fallbackDream) {
      return { dreamId: fallbackDream.id, dream: fallbackDream };
    }
    return undefined;
  }, [normalizedDreamId, fallbackDream]);
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

    const optimisticPaidTier = supabaseTier === 'plus' ? supabaseTier : null;

    return subscriptionStatus?.tier ?? optimisticPaidTier ?? 'free';
  }, [subscriptionStatus, supabaseTier, user?.id]);
  const isPaidTier = tier === 'plus';
  const isGuestBootstrapReady = isMockMode || Boolean(user?.id) || guestBootstrapStatus === 'ready';
  const guestQuotaRefreshKey = user?.id || isMockMode ? undefined : guestBootstrapStatus;

  /**
   * Fetch quota status
   * Wait for subscription to load before fetching quota to use RevenueCat tier
   */
  const fetchQuotaStatus = useCallback(async () => {
    // For paid tiers, mirror RevenueCat (source of truth) and short-circuit to unlimited.
    if (isPaidTier) {
      setQuotaStatus({
        tier,
        usage: {
          analysis: UNLIMITED_QUOTA_METRIC,
          exploration: UNLIMITED_QUOTA_METRIC,
          messages: UNLIMITED_QUOTA_METRIC,
          image: UNLIMITED_QUOTA_METRIC,
        },
        canAnalyze: true,
        canExplore: true,
        canGenerateImage: true,
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
   * Generic illustration permission from quota status.
   * Authenticated free stays false here so a bundled analysis-tied request can
   * be allowed independently by the caller.
   */
  const canGenerateImage = useCallback(async (): Promise<boolean> => {
    if (isPaidTier) return true;
    if (tier === 'free') return false;
    const status = await quotaService.getQuotaStatus(user, tier, baseTarget);
    return resolveCanGenerateImage({
      tier,
      canGenerateImage: status.canGenerateImage,
      image: status.usage.image,
    });
  }, [isPaidTier, user, tier, baseTarget]);

  /**
   * Get usage counts
   */
  const getUsageCounts = useCallback(async () => {
    if (isPaidTier) {
      return {
        analysis: 0,
        exploration: 0,
        messages: 0,
        image: 0,
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
      image: quotaStatus?.usage.image?.used ?? 0,
    };
  }, [isPaidTier, user, baseTarget, quotaStatus?.usage.image?.used]);

  // Fetch on mount, when user/dreamId changes, and when guest bootstrap changes.
  // Keeping this in one effect avoids two identical guest requests on mount/sign-out.
  useEffect(() => {
    void fetchQuotaStatus();
  }, [fetchQuotaStatus, guestQuotaRefreshKey]);

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
    canGenerateImage,
    getUsageCounts,

    // Convenience flags from quota status
    // Use tier from RevenueCat (source of truth), not from quotaStatus
    tier,
    canAnalyzeNow: isGuestBootstrapReady ? (quotaStatus?.canAnalyze ?? true) : false,
    canExploreNow: isGuestBootstrapReady ? (quotaStatus?.canExplore ?? true) : false,
    canGenerateImageNow: isPaidTier
      ? true
      : !isGuestBootstrapReady
        ? false
        : resolveCanGenerateImage({
            tier,
            canGenerateImage: quotaStatus?.canGenerateImage,
            image: quotaStatus?.usage.image,
          }),
    usage: quotaStatus?.usage,
    reasons: quotaStatus?.reasons,
    guestBootstrapStatus: quotaStatus?.guestBootstrapStatus ?? (!user ? guestBootstrapStatus : undefined),
  };
}
