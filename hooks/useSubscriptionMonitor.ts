import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';

import { useAppState } from '@/hooks/useAppState';
import type { SubscriptionStatus } from '@/lib/types';
import { getSubscriptionStatus, refreshSubscriptionStatus } from '@/services/subscriptionService';

type OnStatusChange = (status: SubscriptionStatus) => void;

async function refreshStatus() {
  try {
    let status: SubscriptionStatus | null = null;

    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      try {
        status = await refreshSubscriptionStatus();
      } catch {
        status = await getSubscriptionStatus();
      }
    } else {
      status = await getSubscriptionStatus();
    }

    return status;
  } catch (error) {
    if (__DEV__) {
      console.warn('[useSubscriptionMonitor] Failed to refresh status on resume:', error);
    }
    return null;
  }
}

/**
 * Hook qui surveille l'état de l'app et rafraîchit le status d'abonnement au resume.
 *
 * @param onStatusChange - Callback appelé quand le status est rafraîchi
 */
export function useSubscriptionMonitor(onStatusChange?: OnStatusChange) {
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const handleForeground = useCallback(async () => {
    if (!onStatusChangeRef.current) return;
    const status = await refreshStatus();
    if (status) {
      onStatusChangeRef.current(status);
    }
  }, []);

  useAppState(handleForeground);
}

