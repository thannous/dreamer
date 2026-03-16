import { useCallback, useEffect, useRef, useState } from 'react';

import type { User } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import { useAuth } from '@/context/AuthContext';
import { isMockModeEnabled } from '@/lib/env';
import { isEntitlementExpired, mapStatus as mapStatusFromInfo } from '@/lib/revenuecat';
import type { PurchasePackage, SubscriptionStatus, SubscriptionTier } from '@/lib/types';
import { quotaService } from '@/services/quotaService';
import {
  getSubscriptionStatus,
  initializeSubscription,
  loadSubscriptionPackages,
  purchaseSubscriptionPackage,
  restoreSubscriptionPurchases,
} from '@/services/subscriptionService';
import { syncSubscriptionFromServer } from '@/services/subscriptionSyncService';
import { useSubscriptionCustomerInfoListener } from './useSubscriptionCustomerInfoListener';
import { useSubscriptionExpiryTimer } from './useSubscriptionExpiryTimer';
import { useSubscriptionMonitor } from './useSubscriptionMonitor';

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

const globalAndroidPurchaseSyncState: {
  inProgress: boolean;
  lastUserId: string | null;
} = {
  inProgress: false,
  lastUserId: null,
};

export function useSubscriptionInternal(options?: UseSubscriptionOptions) {
  const { user, refreshUser, setUserTierLocally } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [packages, setPackages] = useState<PurchasePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isMockMode = isMockModeEnabled();
  const requiresAuth = !user?.id;
  // Track which expiry we've already refreshed to avoid infinite loops on expired plans
  const expiredExpiryKeyRef = useRef<string | null>(null);
  const lastSyncAttemptRef = useRef<{ userId: string | null; at: number } | null>(null);
  const lastUserIdRef = useRef<string | null>(null);
  const lastSyncedStatusKeyRef = useRef<string | null>(null);
  // ✅ FIX: Guard against stale RevenueCat listener updates during user transition
  const isUserTransitioningRef = useRef(false);

  const shouldLoadPackages = options?.loadPackages === true;

  // Extract stable user ID to break circular dependency in tier sync
  const userId = user?.id;
  // Extract user tier independently from user object reference
  // to avoid re-triggering effects when user object changes
  const userTierRaw = (
    (user?.app_metadata?.tier as SubscriptionTier | undefined) ||
    (user?.user_metadata?.tier as SubscriptionTier | undefined) ||
    'free'
  );
  const userTier: SubscriptionTier = userTierRaw === 'premium' ? 'plus' : userTierRaw;
  const appMetadataTierRaw = user?.app_metadata?.tier as SubscriptionTier | undefined;
  const appMetadataTier: SubscriptionTier | undefined =
    appMetadataTierRaw === 'premium' ? 'plus' : appMetadataTierRaw;

  useEffect(() => {
    if (lastUserIdRef.current === userId) return;

    // ✅ FIX: Mark transition start to ignore stale RevenueCat listener updates
    isUserTransitioningRef.current = true;

    lastUserIdRef.current = userId ?? null;
    expiredExpiryKeyRef.current = null;
    lastSyncAttemptRef.current = null;
    lastSyncedStatusKeyRef.current = null;

    setStatus(null);
    setPackages([]);
    setError(null);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    if (appMetadataTier !== 'plus') return;

    // Optimistically treat Supabase-paid users as active while RevenueCat is loading.
    // RevenueCat remains the source of truth and will overwrite this once resolved.
    setStatus((current) => {
      if (current?.isActive && current.tier === 'plus') {
        return current;
      }
      return { tier: appMetadataTier, isActive: true };
    });
  }, [appMetadataTier, userId]);

  const getTierFromUser = useCallback((input?: User | null): SubscriptionTier => {
    const tier = (
      (input?.app_metadata?.tier as SubscriptionTier | undefined) ||
      (input?.user_metadata?.tier as SubscriptionTier | undefined) ||
      'free'
    );
    return tier === 'premium' ? 'plus' : tier;
  }, []);

  const getSubscriptionVersionFromUser = useCallback((input?: User | null): number | null => {
    const rawVersion = input?.app_metadata?.subscription_version;
    if (typeof rawVersion === 'number' && Number.isFinite(rawVersion)) {
      return rawVersion;
    }
    if (typeof rawVersion === 'string') {
      const parsed = Number(rawVersion);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }, []);

  const waitForSubscriptionVersion = useCallback(async (targetVersion: number) => {
    if (!userId) return null;
    const currentVersion = getSubscriptionVersionFromUser(user);
    if (currentVersion !== null && currentVersion >= targetVersion) {
      return user;
    }

    const startedAt = Date.now();
    const timeoutMs = 10000;
    const intervalMs = 1000;

    while (Date.now() - startedAt < timeoutMs) {
      try {
        const refreshedUser = await refreshUser({
          bypassCircuitBreaker: true,
          skipJwtRefresh: false,
        });

        if (lastUserIdRef.current !== userId) {
          return refreshedUser;
        }

        const refreshedVersion = getSubscriptionVersionFromUser(refreshedUser);
        if (refreshedVersion !== null && refreshedVersion >= targetVersion) {
          return refreshedUser;
        }
      } catch (err) {
        if (__DEV__) {
          console.warn('[useSubscription] Waiting for subscription version failed', err);
        }
      }

      await sleep(intervalMs);
    }

    return null;
  }, [getSubscriptionVersionFromUser, refreshUser, user, userId]);

  const applyLocalSubscriptionCache = useCallback((nextStatus: SubscriptionStatus, version?: number | null) => {
    setUserTierLocally({
      tier: nextStatus.tier,
      version,
      isActive: nextStatus.isActive,
      productId: nextStatus.productId ?? null,
      source: 'subscription_refresh',
    });
  }, [setUserTierLocally]);

  const syncSubscription = useCallback(async (
    source: string,
    options?: {
      cooldownMs?: number;
      force?: boolean;
      awaitVersion?: boolean;
      localStatus?: SubscriptionStatus | null;
    }
  ) => {
    if (isMockMode) {
      return null;
    }
    if (!userId) {
      lastSyncAttemptRef.current = null;
      return null;
    }
    const now = Date.now();
    const cooldownMs = options?.cooldownMs ?? 60 * 1000;
    if (
      !options?.force &&
      lastSyncAttemptRef.current &&
      lastSyncAttemptRef.current.userId === userId &&
      now - lastSyncAttemptRef.current.at < cooldownMs
    ) {
      return null;
    }
    lastSyncAttemptRef.current = { userId, at: now };

    const result = await syncSubscriptionFromServer(source);

    if (options?.localStatus) {
      const mergedStatus: SubscriptionStatus = {
        ...options.localStatus,
        tier: result.tier,
        isActive: result.isActive,
      };
      setStatus(mergedStatus);
      applyLocalSubscriptionCache(mergedStatus, result.version);
    } else {
      applyLocalSubscriptionCache(
        {
          tier: result.tier,
          isActive: result.isActive,
          productId: undefined,
        },
        result.version
      );
    }

    if (options?.awaitVersion && typeof result.version === 'number') {
      const refreshedUser = await waitForSubscriptionVersion(result.version);
      quotaService.invalidate(refreshedUser ?? user);
    }

    return result;
  }, [applyLocalSubscriptionCache, isMockMode, user, userId, waitForSubscriptionVersion]);

  const syncOnStatusChange = useCallback((source: string, nextStatus: SubscriptionStatus | null) => {
    if (!userId || !nextStatus || requiresAuth) return;
    const statusKey = `${nextStatus.tier}-${nextStatus.isActive}-${nextStatus.expiryDate ?? 'no-expiry'}`;
    if (lastSyncedStatusKeyRef.current === statusKey) return;
    lastSyncedStatusKeyRef.current = statusKey;
    void syncSubscription(source).catch((err) => {
      if (__DEV__) {
        console.warn('[useSubscription] Subscription sync failed', err);
      }
    });
  }, [requiresAuth, syncSubscription, userId]);

  const convergeServerSubscription = useCallback(async (
    source: string,
    nextStatus: SubscriptionStatus,
    options?: { throwOnError?: boolean }
  ) => {
    console.log('[useSubscription] Subscription convergence started', {
      timestamp: new Date().toISOString(),
      userId,
      source,
      targetTier: nextStatus.tier,
      currentTier: userTier,
      expiryDate: nextStatus.expiryDate || null,
    });

    applyLocalSubscriptionCache(nextStatus, getSubscriptionVersionFromUser(user));

    try {
      const result = await syncSubscription(source, {
        force: true,
        cooldownMs: 0,
        awaitVersion: true,
        localStatus: nextStatus,
      });

      return result
        ? { ...nextStatus, tier: result.tier, isActive: result.isActive }
        : nextStatus;
    } catch (err) {
      console.warn('[useSubscription] Subscription convergence failed', {
        timestamp: new Date().toISOString(),
        userId,
        source,
        message: (err as Error)?.message,
      });

      quotaService.invalidate(user);

      if (options?.throwOnError) {
        throw err;
      }

      return nextStatus;
    }
  }, [applyLocalSubscriptionCache, getSubscriptionVersionFromUser, syncSubscription, user, userId, userTier]);

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
            // ✅ FIX: Clear transition flag even when logged out
            isUserTransitioningRef.current = false;
          }
          return;
        }
        // Always ensure RevenueCat is configured and logged in for the current user.
        // This avoids purchases/status being attributed to a stale anonymous/appUserId.
        const initializedStatus = await initializeSubscription(user?.id ?? null);
        const [nextStatus, nextPackages] = await Promise.all([
          Promise.resolve(initializedStatus),
          shouldLoadPackages ? loadSubscriptionPackages() : Promise.resolve<PurchasePackage[]>([]),
        ]);
        if (mounted) {
          setStatus(nextStatus);
          setPackages(nextPackages);
          // ✅ FIX: Clear transition flag - fresh status is now set for current user
          isUserTransitioningRef.current = false;
        }

        // Android edge case: Play Store reports "déjà abonné" but RevenueCat returns free.
        // We avoid calling restorePurchases() automatically (it can alias accounts and is slow).
        // Instead, do a one-shot syncPurchases + refresh to pull entitlements if needed.
        if (
          Platform.OS === 'android' &&
          !requiresAuth &&
          !globalAndroidPurchaseSyncState.inProgress &&
          globalAndroidPurchaseSyncState.lastUserId !== user?.id &&
          (nextStatus?.tier === 'free' || nextStatus?.isActive === false)
        ) {
          globalAndroidPurchaseSyncState.inProgress = true;
          globalAndroidPurchaseSyncState.lastUserId = user?.id ?? null;
          try {
            await Purchases.syncPurchases();
            Purchases.invalidateCustomerInfoCache();
            const refreshed = await getSubscriptionStatus();
            if (mounted && refreshed) {
              setStatus(refreshed);
            }
          } catch (syncErr) {
            console.warn('[useSubscription] Android syncPurchases failed', syncErr);
          } finally {
            globalAndroidPurchaseSyncState.inProgress = false;
          }
        }
      } catch (e) {
        if (mounted) {
          setError(formatError(e));
          // Clear transition guard to avoid getting stuck after init failures.
          isUserTransitioningRef.current = false;
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
  }, [requiresAuth, shouldLoadPackages, user?.id]);

  useEffect(() => {
    syncOnStatusChange('status_change', status);
  }, [status, syncOnStatusChange]);

  useEffect(() => {
    if (!status || requiresAuth) return;
    if (status.tier === userTier && status.isActive === (userTier === 'plus')) return;

    applyLocalSubscriptionCache(status, getSubscriptionVersionFromUser(user));
  }, [applyLocalSubscriptionCache, getSubscriptionVersionFromUser, requiresAuth, status, user, userTier]);

  // ✅ PHASE 3: Check for subscription expiration on app startup
  useEffect(() => {
    if (!status || requiresAuth) return;

    // Reset the guard when the status is not expired anymore (new purchase/restore)
    if (!status.expiryDate || !isEntitlementExpired(status.expiryDate)) {
      expiredExpiryKeyRef.current = null;
      return;
    }

    // Avoid infinite refresh loops for the same expired entitlement
    const expiryKey = status.expiryDate ?? 'no-expiry';
    if (expiredExpiryKeyRef.current === expiryKey) return;
    expiredExpiryKeyRef.current = expiryKey;

    if (__DEV__) {
      console.log('[useSubscription] Subscription expired, forcing refresh');
    }

    // ✅ FIX: Track mounted state and current userId to prevent stale updates after user switch
    let mounted = true;
    const currentUserId = user?.id;

    // Force refresh from RevenueCat to get latest status
    initializeSubscription(currentUserId ?? null)
      .then((nextStatus) => {
        // ✅ FIX: Only apply if still mounted and user hasn't changed
        if (mounted && !isUserTransitioningRef.current && lastUserIdRef.current === currentUserId) {
          setStatus(nextStatus);
        } else if (__DEV__) {
          console.log('[useSubscription] Ignoring expired status refresh - user changed or transitioning');
        }
      })
      .catch((err) => {
        if (__DEV__) {
          console.warn('[useSubscription] Failed to refresh expired status', err);
        }
      });

    return () => {
      mounted = false;
    };
  }, [status, requiresAuth, user?.id]);

  const purchase = useCallback(async (id: string) => {
    if (requiresAuth) {
      return Promise.reject(new Error('auth_required'));
    }
    setProcessing(true);
    setError(null);
    try {
      // Ensure Purchases is configured + logged into the current user right before purchasing.
      // This prevents purchases from being attached to an anonymous/stale RevenueCat user.
      await initializeSubscription(user?.id ?? null);
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
      return await convergeServerSubscription('purchase', nextStatus);
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
  }, [convergeServerSubscription, requiresAuth, user, getTierFromUser]);

  const restore = useCallback(async () => {
    if (requiresAuth) {
      return Promise.reject(new Error('auth_required'));
    }
    setProcessing(true);
    setError(null);
    try {
      // Ensure Purchases is configured + logged into the current user right before restoring.
      await initializeSubscription(user?.id ?? null);
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
      return await convergeServerSubscription('restore', nextStatus);
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
  }, [convergeServerSubscription, requiresAuth, user, getTierFromUser]);

  const refreshSubscription = useCallback(async () => {
    if (requiresAuth) {
      return Promise.reject(new Error('auth_required'));
    }

    setRefreshing(true);
    setError(null);

    try {
      console.log('[useSubscription] Refresh started', {
        timestamp: new Date().toISOString(),
        userId: user?.id,
      });

      // Invalidate cache then get fresh customer info
      Purchases.invalidateCustomerInfoCache();
      const info = await Purchases.getCustomerInfo();

      // Map the fresh customer info to our status format
      const nextStatus = mapStatusFromInfo(info as any);

      console.log('[useSubscription] Refresh completed', {
        timestamp: new Date().toISOString(),
        userId: user?.id,
        tier: nextStatus.tier,
        isActive: nextStatus.isActive,
      });

      setStatus(nextStatus);
      return await convergeServerSubscription('manual_refresh', nextStatus, { throwOnError: true });
    } catch (e) {
      console.error('[useSubscription] Refresh failed', {
        timestamp: new Date().toISOString(),
        userId: user?.id,
        error: (e as Error).message,
      });

      setError(formatError(e));
      throw e;
    } finally {
      setRefreshing(false);
    }
  }, [convergeServerSubscription, requiresAuth, user]);

  // Écouter les changements de status au resume de l'app
  // Ceci permet de mettre à jour l'UI quand l'abonnement expire pendant que l'app est en arrière-plan
  const applyStatusUpdate = useCallback((source: string, newStatus: SubscriptionStatus) => {
    if (__DEV__) {
      console.log(`[useSubscription] Status updated from ${source}:`, {
        tier: newStatus.tier,
        isActive: newStatus.isActive,
        expiryDate: newStatus.expiryDate,
      });
    }
    setStatus(newStatus);
  }, []);

  const handleStatusFromMonitor = useCallback((newStatus: SubscriptionStatus) => {
    // ✅ FIX: Ignore stale updates during user transition
    if (isUserTransitioningRef.current) {
      if (__DEV__) {
        console.log('[useSubscription] Ignoring monitor update during user transition');
      }
      return;
    }
    applyStatusUpdate('resume', newStatus);
    void syncSubscription('resume');
  }, [applyStatusUpdate, syncSubscription]);

  const handleStatusFromCustomerInfo = useCallback((newStatus: SubscriptionStatus) => {
    // ✅ FIX: Ignore stale RevenueCat updates during user transition
    // This prevents showing previous user's subscription after account switch
    if (isUserTransitioningRef.current) {
      if (__DEV__) {
        console.log('[useSubscription] Ignoring customer_info update during user transition');
      }
      return;
    }
    applyStatusUpdate('customer_info', newStatus);
    if (newStatus.tier === 'free' || newStatus.isActive === false) {
      void syncSubscription('customer_info_free');
    }
  }, [applyStatusUpdate, syncSubscription]);

  const handleStatusFromExpiryTimer = useCallback((newStatus: SubscriptionStatus) => {
    // ✅ FIX: Ignore stale updates during user transition
    if (isUserTransitioningRef.current) {
      if (__DEV__) {
        console.log('[useSubscription] Ignoring expiry_timer update during user transition');
      }
      return;
    }
    applyStatusUpdate('expiry_timer', newStatus);
  }, [applyStatusUpdate]);

  useSubscriptionMonitor(handleStatusFromMonitor);
  useSubscriptionCustomerInfoListener(handleStatusFromCustomerInfo, !requiresAuth);
  useSubscriptionExpiryTimer({
    status,
    userId,
    enabled: !requiresAuth,
    onStatusChange: handleStatusFromExpiryTimer,
  });

  return {
    status,
    isActive: status?.isActive ?? false,
    loading,
    processing,
    refreshing,
    error,
    packages,
    requiresAuth,
    purchase,
    restore,
    refreshSubscription,
  };
}

export type UseSubscriptionResult = ReturnType<typeof useSubscriptionInternal>;
