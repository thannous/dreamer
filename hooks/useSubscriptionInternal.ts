import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { User } from '@supabase/supabase-js';
import { useAuth } from '@/context/AuthContext';
import { normalizeSubscriptionTier } from '@/lib/quotaTier';
import { isEntitlementExpired } from '@/lib/revenuecat';
import { isUserCancelledError as isSharedUserCancelledError, type RevenueCatLikeError } from '@/lib/subscriptionErrors';
import type { PurchasePackage, SubscriptionStatus } from '@/lib/types';
import { quotaService } from '@/services/quotaService';
import {
  initializeSubscription,
  isMockSubscriptionService,
  isSubscriptionInitialized,
  loadSubscriptionPackages,
  purchaseSubscriptionPackage,
  refreshSubscriptionStatus,
  restoreSubscriptionPurchases,
} from '@/services/subscriptionService';
import { syncSubscriptionFromServer, type SubscriptionSyncResponse } from '@/services/subscriptionSyncService';
import { simulateMockSubscriptionSync } from '@/services/mocks/subscriptionServiceMock';
import { useSubscriptionCustomerInfoListener } from './useSubscriptionCustomerInfoListener';
import { useSubscriptionExpiryTimer } from './useSubscriptionExpiryTimer';
import { useSubscriptionMonitor } from './useSubscriptionMonitor';

type RevenueCatError = RevenueCatLikeError;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isUserCancelledError(e: unknown): boolean {
  if (__DEV__ && typeof e === 'object' && e !== null) {
    const error = e as RevenueCatError;
    console.log('[useSubscription] isUserCancelledError checking:', {
      userCancelled: error.userCancelled,
      code: error.code,
      message: error.message?.substring(0, 100),
    });
  }
  return isSharedUserCancelledError(e);
}

function formatError(e: unknown): Error {
  if (e instanceof Error) {
    const msg = e.message.toLowerCase();
    const error = e as RevenueCatError;

    // Network error
    if (msg.includes('network_error') || msg.includes('networkerror')) {
      return new Error('subscription.error.network');
    }

    // Product not available (ITEM_UNAVAILABLE) - Play Store error
    if (msg.includes('item_unavailable') ||
        msg.includes('productnotavailableforpurchase')) {
      return new Error('subscription.error.item_unavailable');
    }

    // Store/billing not available
    if (msg.includes('billing_unavailable') ||
        msg.includes('service_unavailable')) {
      return new Error('subscription.error.store_unavailable');
    }

    if (
      error.code === 'RECEIPT_ALREADY_IN_USE' ||
      error.code === 'ReceiptAlreadyInUseError' ||
      error.code === 'RECEIPT_IN_USE' ||
      msg.includes('receipt_already_in_use') ||
      msg.includes('receipt already in use')
    ) {
      return new Error('subscription.error.receipt_already_in_use');
    }

    // Generic purchase error
    if (msg.includes('purchaseerror') && !msg.includes('cancelled')) {
      return new Error('subscription.error.purchase_failed');
    }

    // SDK not initialized
    if (msg.includes('purchases not initialized')) {
      return new Error('subscription.error.not_initialized');
    }

    if (msg.includes('user not identified') || msg.includes('not logged in')) {
      return new Error('subscription.error.not_logged_in');
    }

    return e;
  }
  return new Error('subscription.error.unknown');
}

export type UseSubscriptionOptions = {
  loadPackages?: boolean;
};

type SubscriptionOperationResult = SubscriptionStatus & { serverConfirmed: boolean; storeActive: boolean };

function isConfirmed(result: SubscriptionSyncResponse | null): result is SubscriptionSyncResponse {
  return result?.ok === true && result.outcome !== 'unknown_entitlement' && result.outcome !== 'stale'
    && ((result.tier === 'plus' && result.isActive === true) || (result.tier === 'free' && result.isActive === false));
}

function getSubscriptionVersion(user: User | null): number | null {
  const raw = user?.app_metadata?.subscription_version;
  if (typeof raw !== 'number' && (typeof raw !== 'string' || !raw.trim())) return null;
  const version = Number(raw);
  return Number.isFinite(version) ? version : null;
}

export function useSubscriptionInternal(options?: UseSubscriptionOptions) {
  const { user, sessionGeneration, isCurrentSession, refreshUser, setUserTierLocally } = useAuth();
  const userId = user?.id ?? null;
  const sessionKey = `${sessionGeneration}:${userId ?? ''}`;
  const [stateSession, setStateSession] = useState(sessionKey);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [packages, setPackages] = useState<PurchasePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activationPending, setActivationPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const shouldLoadPackages = options?.loadPackages === true;
  const isMockMode = isMockSubscriptionService;
  const appMetadataTier = normalizeSubscriptionTier(user?.app_metadata?.tier, 'free');

  // Discard the old view before a consumer renders under the next account.
  if (stateSession !== sessionKey) {
    setStateSession(sessionKey);
    setStatus(null);
    setPackages([]);
    setLoading(true);
    setProcessing(false);
    setRefreshing(false);
    setActivationPending(false);
    setError(null);
  }

  const mounted = useRef(false);
  const initializing = useRef(true);
  const lastSyncAttempt = useRef<{ at: number } | null>(null);
  const expiredExpiryKey = useRef<string | null>(null);
  const storeOperation = useRef({ running: false, pending: false, refreshes: 0, observationVersion: 0 });
  const customerInfoRead = useRef<Promise<SubscriptionStatus | null> | null>(null);

  useLayoutEffect(() => {
    mounted.current = true;
    initializing.current = true;
    lastSyncAttempt.current = null;
    expiredExpiryKey.current = null;
    storeOperation.current = { running: false, pending: false, refreshes: 0, observationVersion: 0 };
    customerInfoRead.current = null;
    return () => { mounted.current = false; };
  }, [sessionKey]);

  const isSessionCurrent = useCallback(() => mounted.current && isCurrentSession(userId, sessionGeneration),
    [isCurrentSession, sessionGeneration, userId]);
  const canObserveStore = useCallback(() => {
    const { running, pending, refreshes } = storeOperation.current;
    return isSessionCurrent() && !running && !pending && refreshes === 0;
  }, [isSessionCurrent]);
  const captureStoreRead = useCallback(() => {
    const { observationVersion } = storeOperation.current;
    return () => canObserveStore() && storeOperation.current.observationVersion === observationVersion;
  }, [canObserveStore]);
  const invalidateStoreReads = useCallback(() => {
    storeOperation.current.observationVersion++;
    customerInfoRead.current = null;
  }, []);
  const assertSession = useCallback(() => {
    if (!isSessionCurrent()) throw new Error('subscription_session_changed');
  }, [isSessionCurrent]);
  const clearError = useCallback(() => { if (isSessionCurrent()) setError(null); }, [isSessionCurrent]);

  const setPending = useCallback((pending: boolean) => {
    if (!isSessionCurrent()) return;
    storeOperation.current.pending = pending;
    setActivationPending(pending);
  }, [isSessionCurrent]);

  const applyCache = useCallback((next: SubscriptionStatus, version?: number | null) => {
    if (!isSessionCurrent()) return;
    setUserTierLocally({
      tier: next.tier,
      version,
      isActive: next.isActive,
      productId: next.productId ?? null,
      source: 'subscription_refresh',
    }, { userId, generation: sessionGeneration });
  }, [isSessionCurrent, sessionGeneration, setUserTierLocally, userId]);

  const waitForVersion = useCallback(async (targetVersion: number) => {
    const currentVersion = getSubscriptionVersion(user);
    if (currentVersion !== null && currentVersion >= targetVersion) return user;

    const until = Date.now() + 10000;
    while (isSessionCurrent() && Date.now() < until) {
      const refreshed = await refreshUser({ bypassCircuitBreaker: true, skipJwtRefresh: false });
      if (!isSessionCurrent()) return null;
      const version = getSubscriptionVersion(refreshed);
      if (version !== null && version >= targetVersion) return refreshed;
      await sleep(1000);
    }
    return null;
  }, [isSessionCurrent, refreshUser, user]);

  const syncInBackground = useCallback((source: string, storeStatus?: SubscriptionStatus) => {
    const isCurrentRead = captureStoreRead();
    if (!userId || isMockMode || !isCurrentRead()) return;
    const now = Date.now();
    if (lastSyncAttempt.current && now - lastSyncAttempt.current.at < 60000) return;
    const request = { at: now };
    lastSyncAttempt.current = request;

    void syncSubscriptionFromServer(source).then(result => {
      if (!isCurrentRead() || lastSyncAttempt.current !== request || !isConfirmed(result)) return;

      const observed = storeStatus?.tier === result.tier && storeStatus.isActive === result.isActive
        ? storeStatus
        : undefined;
      const confirmed = { ...observed, tier: result.tier, isActive: result.isActive };
      setStatus(previous => {
        if (previous?.tier !== confirmed.tier || previous.isActive !== confirmed.isActive) return confirmed;
        return observed ? { ...previous, ...confirmed } : previous;
      });
      applyCache(confirmed, result.version);
    }).catch((err: unknown) => {
      if (__DEV__ && isSessionCurrent()) {
        const status = (err as { status?: unknown } | null)?.status;
        console.warn('[useSubscription] Background sync failed', { source, status: typeof status === 'number' ? status : undefined });
      }
    });
  }, [applyCache, captureStoreRead, isMockMode, isSessionCurrent, userId]);

  const applyStoreObservation = useCallback((source: string, next: SubscriptionStatus) => {
    if (!canObserveStore()) return;
    // A new paid grant needs confirmation. A known paid account keeps its
    // RevenueCat expiry metadata and the existing local expiration policy.
    if (next.tier === 'plus' && next.isActive && !isMockMode && appMetadataTier !== 'plus') {
      syncInBackground(source, next);
      return;
    }
    setStatus(next);
  }, [appMetadataTier, canObserveStore, isMockMode, syncInBackground]);

  const converge = useCallback(async (source: 'purchase' | 'restore' | 'manual_refresh', observed: SubscriptionStatus) => {
    assertSession();
    const unresolved: SubscriptionOperationResult = {
      tier: status?.tier ?? appMetadataTier,
      isActive: status?.isActive ?? (appMetadataTier === 'plus'),
      serverConfirmed: false,
      storeActive: observed.isActive,
    };
    try {
      const request = { at: Date.now() };
      lastSyncAttempt.current = request;
      let result: SubscriptionSyncResponse | null = null;
      if (isMockMode) simulateMockSubscriptionSync(source, userId ?? undefined);
      else result = await syncSubscriptionFromServer(source);
      assertSession();
      if (lastSyncAttempt.current !== request) return unresolved;

      if (result) {
        console.log('[useSubscription] Subscription convergence completed', {
          userId, source, syncedTier: result.tier, isActive: result.isActive,
          version: result.version, changed: result.changed, outcome: result.outcome ?? null,
        });
      }
      if (!isMockMode && !isConfirmed(result)) return unresolved;
      const confirmed: SubscriptionOperationResult = {
        ...observed,
        tier: result?.tier ?? observed.tier,
        isActive: result?.isActive ?? observed.isActive,
        serverConfirmed: true,
        storeActive: observed.isActive,
      };
      // A recognized receipt can precede the backend grant. Keep the last
      // confirmed access until the grant arrives or both sources report Free.
      if (storeOperation.current.pending && !confirmed.isActive && observed.isActive) return confirmed;
      setStatus(confirmed);
      applyCache(confirmed, result?.version);
      setPending(false);
      if (typeof result?.version === 'number') {
        const refreshed = await waitForVersion(result.version);
        assertSession();
        quotaService.invalidate(refreshed ?? user);
      }
      return confirmed;
    } catch (err) {
      assertSession();
      if (source === 'manual_refresh') throw err;
      return unresolved;
    }
  }, [appMetadataTier, applyCache, assertSession, isMockMode, setPending, status, user, userId, waitForVersion]);

  const applyStoreObservationRef = useRef(applyStoreObservation);
  useLayoutEffect(() => { applyStoreObservationRef.current = applyStoreObservation; }, [applyStoreObservation]);

  useEffect(() => {
    let active = true;
    const current = () => active && isSessionCurrent();
    const run = async () => {
      if (!current()) return;
      setLoading(true);
      setError(null);
      try {
        if (!userId && !shouldLoadPackages) return;
        const observed = await initializeSubscription(userId);
        if (!current()) return;
        if (userId) applyStoreObservationRef.current('status_change', observed);
        if (shouldLoadPackages) {
          const offerings = await loadSubscriptionPackages();
          if (current()) setPackages(offerings);
        }
      } catch (err) {
        if (current()) setError(formatError(err));
      } finally {
        if (current()) {
          initializing.current = false;
          setLoading(false);
        }
      }
    };
    void run();
    return () => { active = false; };
  }, [isSessionCurrent, shouldLoadPackages, userId]);

  useEffect(() => {
    if (userId && status) syncInBackground('status_change');
  }, [status, syncInBackground, userId]);

  useEffect(() => {
    if (!userId || !status || !isSessionCurrent() || storeOperation.current.pending) return;
    if (status.tier !== appMetadataTier) applyCache(status, getSubscriptionVersion(user));
  }, [appMetadataTier, applyCache, isSessionCurrent, status, user, userId]);

  useEffect(() => {
    if (!status?.expiryDate || !isEntitlementExpired(status.expiryDate)) {
      expiredExpiryKey.current = null;
      return;
    }
    if (!userId || expiredExpiryKey.current === status.expiryDate) return;
    expiredExpiryKey.current = status.expiryDate;
    let active = true;
    void initializeSubscription(userId).then(next => {
      if (active && isSessionCurrent() && !initializing.current) applyStoreObservationRef.current('expiry', next);
    }).catch(() => {});
    return () => { active = false; };
  }, [isSessionCurrent, status, userId]);

  const runStoreOperation = useCallback(async (source: 'purchase' | 'restore', operation: () => Promise<SubscriptionStatus>) => {
    if (!userId) throw new Error('auth_required');
    assertSession();
    const state = storeOperation.current;
    if (state.running || state.pending) throw new Error('subscription_operation_pending');
    state.running = true;
    invalidateStoreReads();
    setProcessing(true);
    setError(null);
    try {
      await initializeSubscription(userId);
      assertSession();
      const observed = await operation();
      assertSession();
      // A purchase or an active restored receipt can still need activation.
      // An empty restore reconciles without blocking a new purchase.
      if (source === 'purchase' || observed.isActive) setPending(true);
      return await converge(source, observed);
    } catch (err) {
      if (isSessionCurrent() && !isUserCancelledError(err)) setError(formatError(err));
      throw err;
    } finally {
      if (isSessionCurrent()) {
        state.running = false;
        setProcessing(false);
      }
    }
  }, [assertSession, converge, invalidateStoreReads, isSessionCurrent, setPending, userId]);

  const purchase = useCallback((id: string) => runStoreOperation('purchase', () => purchaseSubscriptionPackage(id)), [runStoreOperation]);
  const restore = useCallback(() => runStoreOperation('restore', restoreSubscriptionPurchases), [runStoreOperation]);
  const refreshSubscription = useCallback(async () => {
    if (!userId) throw new Error('auth_required');
    assertSession();
    const state = storeOperation.current;
    state.refreshes++;
    invalidateStoreReads();
    setRefreshing(true);
    setError(null);
    try {
      if (initializing.current) {
        await initializeSubscription(userId);
        assertSession();
      }
      const observed = await refreshSubscriptionStatus();
      assertSession();
      if (!observed) throw new Error('Purchases not initialized');
      return await converge('manual_refresh', observed);
    } catch (err) {
      if (isSessionCurrent()) setError(formatError(err));
      throw err;
    } finally {
      state.refreshes--;
      if (isSessionCurrent()) setRefreshing(state.refreshes > 0);
    }
  }, [assertSession, converge, invalidateStoreReads, isSessionCurrent, userId]);

  const onResume = useCallback((next: SubscriptionStatus) => {
    if (!isSessionCurrent() || initializing.current) return;
    applyStoreObservationRef.current('resume', next);
    syncInBackground('resume');
  }, [isSessionCurrent, syncInBackground]);

  const onCustomerInfo = useCallback((next: SubscriptionStatus) => {
    const isCurrentRead = captureStoreRead();
    if (!isCurrentRead() || initializing.current) return;
    if (isMockMode) {
      applyStoreObservation('customer_info', next);
      return;
    }
    if (customerInfoRead.current) return;

    // Native broadcasts lack a session generation. Read the current SDK
    // account's details once, including when server reconciliation is throttled.
    const read = refreshSubscriptionStatus();
    customerInfoRead.current = read;
    void read.then(observed => {
      if (!isCurrentRead() || customerInfoRead.current !== read) return;
      const source = observed?.isActive ? 'customer_info' : 'customer_info_free';
      if (observed?.tier === 'plus' && observed.isActive && appMetadataTier === 'plus') {
        setStatus(observed);
        syncInBackground(source);
      } else {
        syncInBackground(source, observed?.isActive ? observed : undefined);
      }
    }).catch(() => {
      if (isCurrentRead() && customerInfoRead.current === read) syncInBackground('customer_info');
    }).finally(() => {
      if (customerInfoRead.current === read) customerInfoRead.current = null;
    });
  }, [appMetadataTier, applyStoreObservation, captureStoreRead, isMockMode, syncInBackground]);

  const onExpiry = useCallback((next: SubscriptionStatus) => {
    if (isSessionCurrent() && !initializing.current) applyStoreObservation('expiry_timer', next);
  }, [applyStoreObservation, isSessionCurrent]);

  const effectiveStatus = status ?? (userId && appMetadataTier === 'plus'
    ? { tier: 'plus' as const, isActive: true }
    : null);

  useSubscriptionMonitor(onResume, !!userId && !loading, captureStoreRead);
  useSubscriptionCustomerInfoListener(onCustomerInfo, !!userId && isSubscriptionInitialized());
  useSubscriptionExpiryTimer({
    status: effectiveStatus,
    userId,
    sessionKey,
    isCurrentSession: isSessionCurrent,
    enabled: !!userId && !loading,
    onStatusChange: onExpiry,
  });

  return {
    status: effectiveStatus,
    isActive: effectiveStatus?.isActive ?? false,
    loading,
    processing,
    refreshing,
    activationPending,
    error,
    clearError,
    packages,
    requiresAuth: !userId,
    purchase,
    restore,
    refreshSubscription,
  };
}

export type UseSubscriptionResult = ReturnType<typeof useSubscriptionInternal>;
