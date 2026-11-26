import { useEffect } from 'react';

import { useSubscriptionContext } from '@/context/SubscriptionContext';
import type { UseSubscriptionOptions, UseSubscriptionResult } from './useSubscriptionInternal';

export type { UseSubscriptionOptions, UseSubscriptionResult } from './useSubscriptionInternal';

export function useSubscription(options?: UseSubscriptionOptions): UseSubscriptionResult {
  const { requestPackages, ...subscription } = useSubscriptionContext();

  const { ensureGuestStore } = subscription;
  useEffect(() => {
    if (options?.loadPackages) {
      requestPackages();
      // The provider outlives the offer: a check that failed once is made again here.
      void ensureGuestStore().catch(() => {});
    }
  }, [ensureGuestStore, options?.loadPackages, requestPackages]);

  return subscription;
}
