import { useCallback, useEffect, useRef } from 'react';
import Purchases from 'react-native-purchases';

import type { SubscriptionStatus } from '@/lib/types';
import { isMockModeEnabled } from '@/lib/env';
import { getSubscriptionStatus, refreshSubscriptionStatus } from '@/services/subscriptionService';
import { syncSubscriptionFromServer } from '@/services/subscriptionSyncService';

type OnStatusChange = (status: SubscriptionStatus) => void;

const EXPIRY_REFRESH_MARGIN_MS = 60 * 1000;
const MAX_TIMER_DELAY_MS = 12 * 60 * 60 * 1000;
const RETRY_DELAY_MS = 5 * 60 * 1000;

const callbackRegistry = new Set<OnStatusChange>();
let latestStatus: SubscriptionStatus | null = null;
let latestUserId: string | null = null;
let timerHandle: ReturnType<typeof setTimeout> | null = null;
let refreshInFlight = false;
let lastRefreshKey: string | null = null;

function clearTimer() {
  if (timerHandle) {
    clearTimeout(timerHandle);
    timerHandle = null;
  }
}

function getExpiryKey(status: SubscriptionStatus): string {
  return `${status.tier}-${status.expiryDate ?? 'no-expiry'}`;
}

function setLatestStatus(nextStatus: SubscriptionStatus | null) {
  const prevKey = latestStatus ? getExpiryKey(latestStatus) : null;
  latestStatus = nextStatus;
  const nextKey = nextStatus ? getExpiryKey(nextStatus) : null;
  if (!nextStatus || nextStatus.tier !== 'plus' || prevKey !== nextKey) {
    lastRefreshKey = null;
  }
}

function notifyCallbacks(nextStatus: SubscriptionStatus) {
  callbackRegistry.forEach((cb) => {
    try {
      cb(nextStatus);
    } catch (err) {
      if (__DEV__) {
        console.warn('[useSubscriptionExpiryTimer] Callback error', err);
      }
    }
  });
}

function scheduleRetry() {
  clearTimer();
  timerHandle = setTimeout(() => {
    scheduleTimer();
  }, RETRY_DELAY_MS);
}

async function refreshFromTimer(source: string, expiryKey: string | null) {
  if (refreshInFlight) return;
  refreshInFlight = true;
  const isMockMode = isMockModeEnabled();

  try {
    try {
      await Purchases.invalidateCustomerInfoCache();
    } catch {
      // ignore cache invalidation errors
    }

    let nextStatus: SubscriptionStatus | null = null;
    try {
      nextStatus = await refreshSubscriptionStatus();
    } catch {
      nextStatus = await getSubscriptionStatus();
    }

    if (nextStatus) {
      setLatestStatus(nextStatus);
      notifyCallbacks(nextStatus);
    }

    if (latestUserId && !isMockMode) {
      try {
        await syncSubscriptionFromServer(source);
      } catch (err) {
        if (__DEV__) {
          console.warn('[useSubscriptionExpiryTimer] Server sync failed', err);
        }
      }
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[useSubscriptionExpiryTimer] Refresh failed', error);
    }
    if (expiryKey && lastRefreshKey === expiryKey) {
      lastRefreshKey = null;
    }
    scheduleRetry();
    return;
  } finally {
    refreshInFlight = false;
  }

  scheduleTimer();
}

function scheduleTimer() {
  clearTimer();
  if (callbackRegistry.size === 0) return;

  const status = latestStatus;
  if (!status || status.tier !== 'plus' || !status.expiryDate) {
    return;
  }

  const expiryMs = new Date(status.expiryDate).getTime();
  if (!Number.isFinite(expiryMs)) {
    return;
  }

  const targetMs = expiryMs + EXPIRY_REFRESH_MARGIN_MS;
  const now = Date.now();
  const expiryKey = getExpiryKey(status);

  if (now >= targetMs) {
    if (lastRefreshKey !== expiryKey) {
      lastRefreshKey = expiryKey;
      void refreshFromTimer('expiry_timer', expiryKey);
    }
    return;
  }

  const delayMs = Math.min(targetMs - now, MAX_TIMER_DELAY_MS);
  timerHandle = setTimeout(() => {
    scheduleTimer();
  }, delayMs);
}

type UseSubscriptionExpiryTimerOptions = {
  status: SubscriptionStatus | null;
  userId?: string | null;
  enabled?: boolean;
  onStatusChange?: OnStatusChange;
};

export function useSubscriptionExpiryTimer({
  status,
  userId,
  enabled = true,
  onStatusChange,
}: UseSubscriptionExpiryTimerOptions) {
  const callbackRef = useRef(onStatusChange);
  callbackRef.current = onStatusChange;

  const stableCallback = useCallback((nextStatus: SubscriptionStatus) => {
    callbackRef.current?.(nextStatus);
  }, []);

  useEffect(() => {
    latestUserId = enabled ? userId ?? null : null;
    setLatestStatus(enabled ? status : null);
    scheduleTimer();
  }, [enabled, status?.tier, status?.expiryDate, userId]);

  useEffect(() => {
    if (!enabled || !onStatusChange) return;

    callbackRegistry.add(stableCallback);
    scheduleTimer();

    return () => {
      callbackRegistry.delete(stableCallback);
      if (callbackRegistry.size === 0) {
        clearTimer();
        latestStatus = null;
        latestUserId = null;
        lastRefreshKey = null;
      }
    };
  }, [enabled, onStatusChange, stableCallback]);
}
