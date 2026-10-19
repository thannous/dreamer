import { useEffect } from 'react';
import { Platform } from 'react-native';
import { isMockModeEnabled } from '@/lib/env';

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
  useEffect(() => {
    if (!enabled || !onStatusChange) return;
    if (Platform.OS !== 'ios' && Platform.OS !== 'android' && !isMockModeEnabled()) return;

    // Each effect owns its subscriber, even when two hooks receive the same
    // callback. Publish it only after React commits this render.
    const callback = (nextStatus: SubscriptionStatus) => onStatusChange(nextStatus);
    callbackRegistry.add(callback);
    ensureListener();

    return () => {
      callbackRegistry.delete(callback);
      cleanupListenerIfEmpty();
    };
  }, [enabled, onStatusChange]);
}
