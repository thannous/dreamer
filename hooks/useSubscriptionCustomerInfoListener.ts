import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Purchases, { CustomerInfo } from 'react-native-purchases';

import type { SubscriptionStatus } from '@/lib/types';
import { mapStatus as mapStatusFromInfo } from '@/lib/revenuecat';

type OnStatusChange = (status: SubscriptionStatus) => void;

const callbackRegistry = new Set<OnStatusChange>();
let listener: ((info: CustomerInfo) => void) | null = null;

function ensureListener() {
  if (listener) return;
  listener = (info: CustomerInfo) => {
    const nextStatus = mapStatusFromInfo(info as any);
    callbackRegistry.forEach((cb) => {
      try {
        cb(nextStatus);
      } catch (err) {
        if (__DEV__) {
          console.warn('[useSubscriptionCustomerInfoListener] Callback error', err);
        }
      }
    });
  };
  try {
    Purchases.addCustomerInfoUpdateListener(listener);
  } catch (err) {
    listener = null;
    if (__DEV__) {
      console.warn('[useSubscriptionCustomerInfoListener] Failed to attach listener', err);
    }
  }
}

function cleanupListenerIfEmpty() {
  if (callbackRegistry.size === 0 && listener) {
    try {
      Purchases.removeCustomerInfoUpdateListener(listener);
    } catch (err) {
      if (__DEV__) {
        console.warn('[useSubscriptionCustomerInfoListener] Failed to remove listener', err);
      }
    }
    listener = null;
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
