import { useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { initializeSubscription, isSubscriptionInitialized } from '@/services/subscriptionService';

export function useSubscriptionInitialize() {
  const { user } = useAuth();
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        if (!isSubscriptionInitialized()) {
          await initializeSubscription(user?.id ?? null);
        }
        if (mounted) {
          setInitialized(true);
        }
      } catch (e) {
        if (mounted) {
          setError(e as Error);
          setInitialized(false);
        }
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  return { initialized, error };
}
