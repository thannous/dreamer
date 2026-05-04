import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import type { SubscriptionStatus } from '@/lib/types';
import {
  addSubscriptionStatusUpdateListener,
  isSubscriptionInitialized,
} from '@/services/subscriptionService';

type OnStatusChange = (status: SubscriptionStatus) => void;

const callbackRegistry = new Set<OnStatusChange>();
let removeListener: (() => void) | null = null;

function ensureListener() {
  if (removeListener) return;
  if (!isSubscriptionInitialized()) return;

  removeListener = addSubscriptionStatusUpdateListener((nextStatus) => {
    callbackRegistry.forEach((cb) => {
      try {
        cb(nextStatus);
      } catch (err) {
        if (__DEV__) {
          console.warn('[useSubscriptionCustomerInfoListener] Callback error', err);
        }
      }
    });
  });
}

function cleanupListenerIfEmpty() {
  if (callbackRegistry.size === 0 && removeListener) {
    removeListener();
    removeListener = null;
  }
}

export function useSubscriptionCustomerInfoListener(
  onStatusChange?: OnStatusChange,
  enabled: boolean = true
) {
  const callbackRef = useRef(onStatusChange);
  callbackRef.current = onStatusChange;

  const stableCallback = useCallback((nextStatus: SubscriptionStatus) => {
    callbackRef.current?.(nextStatus);
  }, []);

  useEffect(() => {
    if (!enabled || !onStatusChange) return;
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

    callbackRegistry.add(stableCallback);
    ensureListener();

    return () => {
      callbackRegistry.delete(stableCallback);
      cleanupListenerIfEmpty();
    };
  }, [enabled, onStatusChange, stableCallback]);
}
