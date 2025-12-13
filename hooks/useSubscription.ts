import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { isEntitlementExpired } from '@/lib/revenuecat';
import type { PurchasePackage, SubscriptionStatus } from '@/lib/types';
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

  const syncTier = useCallback(
    async (nextStatus: SubscriptionStatus) => {
      setUserTierLocally(nextStatus.tier);
      try {
        // ✅ CRITICAL SECURITY FIX: Tier is now updated ONLY via RevenueCat webhook (admin-only app_metadata)
        // No need to call updateUserTier() - webhook has already updated app_metadata
        // Just refresh to get the latest tier from the server
        await refreshUser();
      } catch (err) {
        if (__DEV__) {
          console.warn('[Subscription] Failed to sync tier with auth user', err);
        }
      }
    },
    [refreshUser, setUserTierLocally]
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
      const nextStatus = await purchaseSubscriptionPackage(id);
      setStatus(nextStatus);
      await syncTier(nextStatus);
      return nextStatus;
    } catch (e) {
      const isCancelled = isUserCancelledError(e);
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
  }, [requiresAuth, syncTier]);

  const restore = useCallback(async () => {
    if (requiresAuth) {
      return Promise.reject(new Error('auth_required'));
    }
    setProcessing(true);
    setError(null);
    try {
      const nextStatus = await restoreSubscriptionPurchases();
      setStatus(nextStatus);
      await syncTier(nextStatus);
      return nextStatus;
    } catch (e) {
      // Don't show error if user simply cancelled the restore
      if (!isUserCancelledError(e)) {
        setError(formatError(e));
      }
      throw e;
    } finally {
      setProcessing(false);
    }
  }, [requiresAuth, syncTier]);

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
