import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

import type { SubscriptionStatus } from '@/lib/types';
import { getSubscriptionStatus, refreshSubscriptionStatus } from '@/services/subscriptionService';

type OnStatusChange = (status: SubscriptionStatus) => void;

// Registre singleton de callbacks - un seul listener AppState partagé
const callbackRegistry = new Set<OnStatusChange>();
let listenerCleanup: (() => void) | null = null;

async function handleAppStateChange(state: AppStateStatus) {
  if (state !== 'active' || callbackRegistry.size === 0) return;

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

    if (status) {
      callbackRegistry.forEach((cb) => {
        try {
          cb(status);
        } catch (err) {
          if (__DEV__) {
            console.warn('[useSubscriptionMonitor] Callback error:', err);
          }
        }
      });
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[useSubscriptionMonitor] Failed to refresh status on resume:', error);
    }
  }
}

function ensureListener() {
  if (listenerCleanup) return;
  const subscription = AppState.addEventListener('change', handleAppStateChange);
  listenerCleanup = () => {
    subscription.remove();
    listenerCleanup = null;
  };
}

function cleanupListenerIfEmpty() {
  if (callbackRegistry.size === 0 && listenerCleanup) {
    listenerCleanup();
  }
}

/**
 * Hook qui surveille l'état de l'app et rafraîchit le status d'abonnement au resume.
 * Utilise un singleton interne - plusieurs appels partagent le même listener AppState.
 *
 * @param onStatusChange - Callback appelé quand le status est rafraîchi
 */
export function useSubscriptionMonitor(onStatusChange?: OnStatusChange) {
  const callbackRef = useRef(onStatusChange);
  callbackRef.current = onStatusChange;

  const stableCallback = useCallback((status: SubscriptionStatus) => {
    callbackRef.current?.(status);
  }, []);

  useEffect(() => {
    if (!onStatusChange) return;

    callbackRegistry.add(stableCallback);
    ensureListener();

    return () => {
      callbackRegistry.delete(stableCallback);
      cleanupListenerIfEmpty();
    };
  }, [stableCallback, onStatusChange]);
}
