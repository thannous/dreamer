import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { isEntitlementExpired } from '@/lib/revenuecat';
import type { PurchasePackage, SubscriptionStatus, SubscriptionTier } from '@/lib/types';
import { quotaService } from '@/services/quotaService';
import {
  getSubscriptionStatus,
  initializeSubscription,
  isSubscriptionInitialized,
  loadSubscriptionPackages,
  purchaseSubscriptionPackage,
  restoreSubscriptionPurchases,
} from '@/services/subscriptionService';

type RevenueCatError = Error & {
  userCancelled?: boolean;
  code?: string | number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isUserCancelledError(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const error = e as RevenueCatError;

  if (__DEV__) {
    console.log('[useSubscription] isUserCancelledError checking:', {
      userCancelled: error.userCancelled,
      code: error.code,
      message: error.message?.substring(0, 100),
    });
  }

  // RevenueCat sets userCancelled flag or uses various cancellation codes
  if (error.userCancelled === true) return true;
  if (error.code === 'PURCHASE_CANCELLED_ERROR') return true;
  if (error.code === 'PurchaseCancelledError') return true;
  if (error.code === 'USER_CANCELED') return true;
  // Some versions use numeric code 1; coerce strings to cover both
  const numericCode = typeof error.code === 'string' ? Number.parseInt(error.code, 10) : error.code;
  if (numericCode === 1) return true;

  return false;
}

function formatError(e: unknown): Error {
  if (e instanceof Error) {
    const msg = e.message.toLowerCase();

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

    // Generic purchase error
    if (msg.includes('purchaseerror') && !msg.includes('cancelled')) {
      return new Error('subscription.error.purchase_failed');
    }

    // SDK not initialized
    if (msg.includes('purchases not initialized')) {
      return new Error('subscription.error.not_initialized');
    }

    return e;
  }
  return new Error('subscription.error.unknown');
}

export function useSubscription() {
  const { user, refreshUser, setUserTierLocally } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [packages, setPackages] = useState<PurchasePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const requiresAuth = !user?.id;
  const lastSyncedTierRef = useRef<SubscriptionTier | null>(null);
  const tierReconcileRunIdRef = useRef(0);
  // ✅ FIX: Track if sync is in progress for a specific tier to prevent duplicate syncs
  const syncInProgressRef = useRef<SubscriptionTier | null>(null);
  // ✅ FIX: Track reconciliation attempts to enforce max attempt limit
  const reconciliationAttemptsRef = useRef(0);

  const getTierFromUser = useCallback((input?: typeof user | null): SubscriptionTier => {
    return (
      (input?.app_metadata?.tier as SubscriptionTier | undefined) ||
      (input?.user_metadata?.tier as SubscriptionTier | undefined) ||
      'free'
    );
  }, []);

  const startTierReconciliation = useCallback(
    (expectedTier: SubscriptionTier) => {
      if (!user?.id) return;

      const runId = ++tierReconcileRunIdRef.current;
      const startedAt = Date.now();
      const timeoutMs = 30000;
      const intervalMs = 2000;
      const maxAttempts = 15; // 15 attempts × 2s = 30s max

      console.log('[useSubscription] Tier reconciliation started', {
        timestamp: new Date().toISOString(),
        userId: user?.id,
        expectedTier,
        runId,
      });

      // ✅ FIX: Reset attempt counter for this new reconciliation
      reconciliationAttemptsRef.current = 0;

      const run = async () => {
        for (;;) {
          // ✅ FIX: Check if this run has been cancelled (new reconciliation started)
          if (tierReconcileRunIdRef.current !== runId) {
            if (__DEV__) {
              console.log('[useSubscription] Reconciliation cancelled (new run started)');
            }
            return;
          }

          // ✅ FIX: Check timeout
          if (Date.now() - startedAt > timeoutMs) {
            console.warn('[useSubscription] Reconciliation timeout (30s)', {
              timestamp: new Date().toISOString(),
              userId: user?.id,
              expectedTier,
              attempts: reconciliationAttemptsRef.current,
            });
            if (__DEV__) {
              console.warn('[useSubscription] Reconciliation timeout (30s)');
            }
            syncInProgressRef.current = null; // ✅ Clean up sync state
            return;
          }

          // ✅ FIX: Check attempt limit
          if (++reconciliationAttemptsRef.current > maxAttempts) {
            console.warn('[useSubscription] Max reconciliation attempts reached', {
              timestamp: new Date().toISOString(),
              userId: user?.id,
              expectedTier,
              maxAttempts,
            });
            if (__DEV__) {
              console.warn(`[useSubscription] Max attempts (${maxAttempts}) reached`);
            }
            syncInProgressRef.current = null; // ✅ Clean up sync state
            return;
          }

          // Poll the authoritative user without forcing a JWT refresh on every attempt.
          // Once the tier matches, refresh the session JWT a single time so DB-side auth.jwt()
          // reflects the updated app_metadata (used by quota triggers).
          // ✅ FIX: Don't bypass circuit breaker - respect rate limiting
          const refreshed = await refreshUser({ bypassCircuitBreaker: false, skipJwtRefresh: true });
          if (tierReconcileRunIdRef.current !== runId) return;

          const refreshedTier = getTierFromUser(refreshed);
          if (refreshedTier === expectedTier) {
            // ✅ FIX: Log successful reconciliation with attempt count
            console.log('[useSubscription] Tier reconciliation successful', {
              timestamp: new Date().toISOString(),
              userId: user?.id,
              tier: expectedTier,
              attempts: reconciliationAttemptsRef.current,
              durationMs: Date.now() - startedAt,
            });
            if (__DEV__) {
              console.log(`[useSubscription] Tier reconciled after ${reconciliationAttemptsRef.current} attempts`);
            }

            // Final refresh with JWT
            const withFreshJwt = await refreshUser({ bypassCircuitBreaker: false, skipJwtRefresh: false });
            quotaService.invalidate(withFreshJwt ?? refreshed ?? user);
            syncInProgressRef.current = null; // ✅ Clean up sync state
            return;
          }

          await sleep(intervalMs);
        }
      };

      void run();
    },
    [getTierFromUser, refreshUser, user]
  );

  const syncTier = useCallback(
    async (nextStatus: SubscriptionStatus) => {
      console.log('[useSubscription] Tier sync started', {
        timestamp: new Date().toISOString(),
        userId: user?.id,
        targetTier: nextStatus.tier,
        currentTier: getTierFromUser(user),
        expiryDate: nextStatus.expiryDate || null,
      });

      setUserTierLocally(nextStatus.tier);
      try {
        // ✅ CRITICAL SECURITY FIX: Tier is now updated ONLY via RevenueCat webhook (admin-only app_metadata)
        // No need to call updateUserTier() - webhook has already updated app_metadata
        // Kick a short background reconciliation loop to wait for webhook + refresh JWT.
        // This prevents users from being stuck on server-side "free" claims for 10-30s after purchase.
        startTierReconciliation(nextStatus.tier);
        await refreshUser();
        console.log('[useSubscription] Tier sync completed', {
          timestamp: new Date().toISOString(),
          userId: user?.id,
          targetTier: nextStatus.tier,
        });
      } catch (err) {
        console.error('[useSubscription] Tier sync failed', {
          timestamp: new Date().toISOString(),
          userId: user?.id,
          targetTier: nextStatus.tier,
          error: (err as Error).message,
        });
        if (__DEV__) {
          console.warn('[Subscription] Failed to sync tier with auth user', err);
        }
      }
    },
    [refreshUser, setUserTierLocally, startTierReconciliation, user, getTierFromUser]
  );

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        if (requiresAuth) {
          if (mounted) {
            setStatus(null);
            setPackages([]);
          }
          return;
        }
        if (!isSubscriptionInitialized()) {
          await initializeSubscription(user?.id ?? null);
        }
        const [nextStatus, nextPackages] = await Promise.all([
          getSubscriptionStatus(),
          loadSubscriptionPackages(),
        ]);
        if (mounted) {
          setStatus(nextStatus);
          setPackages(nextPackages);
        }
      } catch (e) {
        if (mounted) {
          setError(formatError(e));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, [requiresAuth, user?.id]);

  // Keep auth user tier in sync with the RevenueCat status to avoid stale "Free plan" UI/quota states.
  useEffect(() => {
    if (!status || requiresAuth) return;

    const currentTier = getTierFromUser(user);

    // Already in sync
    if (status.tier === currentTier) {
      lastSyncedTierRef.current = null;
      syncInProgressRef.current = null; // ✅ FIX: Clean up sync state
      return;
    }

    // Avoid looping refreshes for the same target tier
    if (lastSyncedTierRef.current === status.tier) return;

    // ✅ FIX: Avoid starting a new sync if already syncing this tier
    if (syncInProgressRef.current === status.tier) {
      if (__DEV__) {
        console.log('[useSubscription] Sync already in progress for tier:', status.tier);
      }
      return;
    }

    lastSyncedTierRef.current = status.tier;
    syncInProgressRef.current = status.tier;

    if (__DEV__) {
      console.log('[useSubscription] Starting tier sync:', { from: currentTier, to: status.tier });
    }

    // Optimistic UI, then reconcile with server until webhook-driven app_metadata matches.
    setUserTierLocally(status.tier);
    startTierReconciliation(status.tier);
  }, [getTierFromUser, requiresAuth, setUserTierLocally, startTierReconciliation, status, user]);

  // ✅ PHASE 3: Check for subscription expiration on app startup
  useEffect(() => {
    if (!status || requiresAuth) return;

    // Check if subscription has expired
    if (status.expiryDate && isEntitlementExpired(status.expiryDate)) {
      if (__DEV__) {
        console.log('[useSubscription] Subscription expired, forcing refresh');
      }
      // Force refresh from RevenueCat to get latest status
      initializeSubscription(user?.id ?? null)
        .then((nextStatus) => {
          setStatus(nextStatus);
        })
        .catch((err) => {
          if (__DEV__) {
            console.warn('[useSubscription] Failed to refresh expired status', err);
          }
        });
    }
  }, [status?.expiryDate, requiresAuth, user?.id]);

  const purchase = useCallback(async (id: string) => {
    if (requiresAuth) {
      return Promise.reject(new Error('auth_required'));
    }
    setProcessing(true);
    setError(null);
    try {
      console.log('[useSubscription] Purchase started', {
        timestamp: new Date().toISOString(),
        userId: user?.id,
        packageId: id,
        currentTier: getTierFromUser(user),
      });

      const nextStatus = await purchaseSubscriptionPackage(id);
      console.log('[useSubscription] Purchase completed', {
        timestamp: new Date().toISOString(),
        userId: user?.id,
        packageId: id,
        newTier: nextStatus.tier,
        isActive: nextStatus.isActive,
      });

      setStatus(nextStatus);
      await syncTier(nextStatus);
      return nextStatus;
    } catch (e) {
      const isCancelled = isUserCancelledError(e);
      console.error('[useSubscription] Purchase failed', {
        timestamp: new Date().toISOString(),
        userId: user?.id,
        packageId: id,
        isCancelled,
        error: (e as Error).message,
      });
      if (__DEV__) {
        console.log('[useSubscription] purchase error caught:', {
          isCancelled,
          error: e,
        });
      }
      // Don't show error if user simply cancelled the purchase
      if (!isCancelled) {
        const formattedError = formatError(e);
        if (__DEV__) {
          console.log('[useSubscription] setting error state:', formattedError.message);
        }
        setError(formattedError);
      }
      throw e;
    } finally {
      setProcessing(false);
    }
  }, [requiresAuth, syncTier, user, getTierFromUser]);

  const restore = useCallback(async () => {
    if (requiresAuth) {
      return Promise.reject(new Error('auth_required'));
    }
    setProcessing(true);
    setError(null);
    try {
      console.log('[useSubscription] Purchase restore started', {
        timestamp: new Date().toISOString(),
        userId: user?.id,
        currentTier: getTierFromUser(user),
      });

      const nextStatus = await restoreSubscriptionPurchases();
      console.log('[useSubscription] Purchase restore completed', {
        timestamp: new Date().toISOString(),
        userId: user?.id,
        restoredTier: nextStatus.tier,
        isActive: nextStatus.isActive,
      });

      setStatus(nextStatus);
      await syncTier(nextStatus);
      return nextStatus;
    } catch (e) {
      console.error('[useSubscription] Purchase restore failed', {
        timestamp: new Date().toISOString(),
        userId: user?.id,
        error: (e as Error).message,
        isCancelled: isUserCancelledError(e),
      });
      // Don't show error if user simply cancelled the restore
      if (!isUserCancelledError(e)) {
        setError(formatError(e));
      }
      throw e;
    } finally {
      setProcessing(false);
    }
  }, [requiresAuth, syncTier, user, getTierFromUser]);

  return {
    status,
    isActive: status?.isActive ?? false,
    loading,
    processing,
    error,
    packages,
    requiresAuth,
    purchase,
    restore,
  };
}
