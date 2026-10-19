import { useState, useEffect, useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { DreamAnalysis, QuotaStatus } from '@/lib/types';
import { AppState } from 'react-native';
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

const EXPIRY_ALLOWANCE_MS = 24 * 60 * 60 * 1000;
const MAX_EXPIRY_TIMER_MS = 12 * 60 * 60 * 1000;
const PAID_QUOTA_STATUS: QuotaStatus = {
  tier: 'plus',
  usage: {
    analysis: UNLIMITED_QUOTA_METRIC,
    exploration: UNLIMITED_QUOTA_METRIC,
    messages: UNLIMITED_QUOTA_METRIC,
    image: UNLIMITED_QUOTA_METRIC,
  },
  canAnalyze: true,
  canExplore: true,
  canGenerateImage: true,
};

// The clock is an external input. Subscribe only to this entitlement's boundary;
// a cached RevenueCat object need not change for its 24h allowance to end.
function createExpiryStore(deadline: number | null) {
  const getSnapshot = () => deadline !== null && Date.now() > deadline;
  return {
    getSnapshot,
    subscribe(listener: () => void) {
      if (deadline === null) return () => {};
      let timer: ReturnType<typeof setTimeout> | undefined;
      const check = () => {
        if (timer !== undefined) clearTimeout(timer);
        listener();
        if (!getSnapshot()) {
          timer = setTimeout(check, Math.min(MAX_EXPIRY_TIMER_MS, Math.max(1, deadline - Date.now() + 1)));
        }
      };
      const appState = AppState.addEventListener('change', state => { if (state === 'active') check(); });
      check();
      return () => { if (timer !== undefined) clearTimeout(timer); appState.remove(); };
    },
  };
}

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
  const {
    status: subscriptionStatus, loading: subscriptionLoading,
    refreshing: subscriptionRefreshing, refreshSubscription,
  } = useSubscription();
  const [quotaResult, setQuotaResult] = useState<{ request: object; status: QuotaStatus | null; error: Error | null }>();
  const [quotaRefreshing, setQuotaRefreshing] = useState(false);
  const requestVersion = useRef(0);
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

  const expiryTime = subscriptionStatus?.expiryDate ? new Date(subscriptionStatus.expiryDate).getTime() : NaN;
  const expiryDeadline = user?.id && subscriptionStatus?.tier === 'plus' && subscriptionStatus.willRenew === false && Number.isFinite(expiryTime)
    ? expiryTime + EXPIRY_ALLOWANCE_MS : null;
  const expiryStore = useMemo(() => createExpiryStore(expiryDeadline), [expiryDeadline]);
  const allowanceExpired = useSyncExternalStore(expiryStore.subscribe, expiryStore.getSnapshot, expiryStore.getSnapshot);

  // RevenueCat remains authoritative; retain optimistic paid metadata while it loads.
  const tier = !user?.id ? 'guest' : allowanceExpired ? 'free'
    : subscriptionStatus?.tier ?? (supabaseTier === 'plus' ? 'plus' : 'free');
  const isPaidTier = tier === 'plus';
  const isGuestBootstrapReady = isMockMode || Boolean(user?.id) || guestBootstrapStatus === 'ready';
  const guestQuotaRefreshKey = user?.id || isMockMode ? undefined : guestBootstrapStatus;

  const request = useMemo(() => ({ user, tier, baseTarget, subscriptionLoading, guestQuotaRefreshKey }),
    [user, tier, baseTarget, subscriptionLoading, guestQuotaRefreshKey]);
  const currentResult = quotaResult?.request === request ? quotaResult : undefined;
  // Paid status is derived, so an old free request cannot overwrite unlimited access.
  const quotaStatus = isPaidTier ? PAID_QUOTA_STATUS : currentResult?.status ?? null;
  const error = isPaidTier ? null : currentResult?.error ?? null;
  const loading = !isPaidTier && (quotaRefreshing || !currentResult || subscriptionLoading);

  const requestQuotaStatus = useCallback(async () => {
    if (isPaidTier || subscriptionLoading) return;
    requestVersion.current += 1;
    const version = requestVersion.current;
    try {
      const status = await quotaService.getQuotaStatus(user, tier, baseTarget);
      if (version === requestVersion.current) setQuotaResult({ request, status, error: null });
    } catch (err) {
      if (version !== requestVersion.current) return;
      console.error('Error fetching quota status:', err);
      setQuotaResult(previous => ({ request, status: previous?.request === request ? previous.status : null, error: err as Error }));
    } finally {
      if (version === requestVersion.current) setQuotaRefreshing(false);
    }
  }, [user, tier, baseTarget, subscriptionLoading, isPaidTier, request]);

  // Explicit refetches are events. Mount/context changes derive their pending state
  // from request identity and only commit state after the service responds.
  // A caller may hold a refetch from an earlier render (the QA lab refreshes the user,
  // then refetches): it always runs the latest request, so its result is the current one.
  const latestRequest = useRef({ skip: isPaidTier || subscriptionLoading, run: requestQuotaStatus });
  useLayoutEffect(() => {
    latestRequest.current = { skip: isPaidTier || subscriptionLoading, run: requestQuotaStatus };
  }, [isPaidTier, subscriptionLoading, requestQuotaStatus]);
  const fetchQuotaStatus = useCallback(async () => {
    const { skip, run } = latestRequest.current;
    if (skip) return;
    setQuotaRefreshing(true);
    await run();
  }, []);

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
    void requestQuotaStatus();
    return () => { requestVersion.current += 1; };
  }, [requestQuotaStatus]);

  useEffect(() => {
    const unsubscribe = quotaService.subscribe(fetchQuotaStatus);
    return unsubscribe;
  }, [fetchQuotaStatus]);

  // Invalidate cache when user changes (sign in/out)
  useEffect(() => {
    quotaService.invalidateAll();
  }, [user?.id]); // Only on user ID change, not user object reference

  return {
    subscriptionStatus,
    subscriptionLoading,
    subscriptionRefreshing,
    refreshSubscription,
    quotaStatus,
    // Only wait for RevenueCat when we don't have an optimistic paid tier from Supabase.
    loading,
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
