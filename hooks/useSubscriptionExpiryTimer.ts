import { useEffect, useLayoutEffect, useRef } from 'react';

import type { SubscriptionStatus } from '@/lib/types';
import { isMockModeEnabled } from '@/lib/env';
import { getSubscriptionStatus, refreshSubscriptionStatus } from '@/services/subscriptionService';
import { syncSubscriptionFromServer } from '@/services/subscriptionSyncService';

const EXPIRY_REFRESH_MARGIN_MS = 60 * 1000;
const MAX_TIMER_DELAY_MS = 12 * 60 * 60 * 1000;
const RETRY_DELAY_MS = 5 * 60 * 1000;

type UseSubscriptionExpiryTimerOptions = {
  status: SubscriptionStatus | null;
  userId?: string | null;
  sessionKey?: string;
  isCurrentSession?: () => boolean;
  enabled?: boolean;
  onStatusChange?: (status: SubscriptionStatus) => void;
};

export function useSubscriptionExpiryTimer({
  status, userId, sessionKey, isCurrentSession, enabled = true, onStatusChange,
}: UseSubscriptionExpiryTimerOptions) {
  const callback = useRef(onStatusChange);
  const hasCallback = Boolean(onStatusChange);
  useLayoutEffect(() => { callback.current = onStatusChange; }, [onStatusChange]);

  const expiryDate = status?.tier === 'plus' ? status.expiryDate : null;
  useEffect(() => {
    if (!enabled || !hasCallback || !expiryDate) return;
    const expiry = Date.parse(expiryDate);
    if (!Number.isFinite(expiry)) return;
    const target = expiry + EXPIRY_REFRESH_MARGIN_MS;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const current = () => active && isCurrentSession?.() !== false;

    const refresh = async () => {
      if (!current()) return;
      let next: SubscriptionStatus | null;
      try {
        try {
          next = await refreshSubscriptionStatus();
        } catch {
          if (!current()) return;
          next = await getSubscriptionStatus();
        }
        if (!current()) return;
      } catch (error) {
        if (!current()) return;
        if (__DEV__) console.warn('[useSubscriptionExpiryTimer] Refresh failed', error);
        timer = setTimeout(() => { void refresh(); }, RETRY_DELAY_MS);
        return;
      }

      if (next) callback.current?.(next);
      if (current() && userId && !isMockModeEnabled()) {
        try {
          await syncSubscriptionFromServer('expiry_timer');
        } catch (error) {
          if (__DEV__ && current()) console.warn('[useSubscriptionExpiryTimer] Server sync failed', error);
        }
      }
    };

    const schedule = () => {
      const delay = target - Date.now();
      if (delay <= 0) void refresh();
      else timer = setTimeout(schedule, Math.min(delay, MAX_TIMER_DELAY_MS));
    };
    schedule();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [enabled, expiryDate, hasCallback, isCurrentSession, sessionKey, userId]);
}
