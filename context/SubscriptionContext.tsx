import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import {
  useSubscriptionInternal,
  type UseSubscriptionResult,
} from '@/hooks/useSubscriptionInternal';

type SubscriptionContextValue = UseSubscriptionResult & {
  requestPackages: () => void;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export const SubscriptionProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [shouldLoadPackages, setShouldLoadPackages] = useState(false);

  const requestPackages = useCallback(() => {
    setShouldLoadPackages(true);
  }, []);

  const subscription = useSubscriptionInternal({ loadPackages: shouldLoadPackages });

  const value = useMemo(
    () => ({
      ...subscription,
      requestPackages,
    }),
    [subscription, requestPackages]
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export function useSubscriptionContext(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return ctx;
}
