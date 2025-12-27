import { useEffect } from 'react';

import { useSubscriptionContext } from '@/context/SubscriptionContext';
import type { UseSubscriptionOptions, UseSubscriptionResult } from './useSubscriptionInternal';

export type { UseSubscriptionOptions, UseSubscriptionResult } from './useSubscriptionInternal';

export function useSubscription(options?: UseSubscriptionOptions): UseSubscriptionResult {
  const { requestPackages, ...subscription } = useSubscriptionContext();

  useEffect(() => {
    if (options?.loadPackages) {
      requestPackages();
    }
  }, [options?.loadPackages, requestPackages]);

  return subscription;
}
