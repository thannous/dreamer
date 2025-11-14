import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getSubscriptionStatus } from '@/services/subscriptionService';

export function useSubscriptionMonitor() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        getSubscriptionStatus().catch(() => {});
      }
    });

    if (mounted) {
      setReady(true);
    }

    return () => {
      mounted = false;
      listener.remove();
    };
  }, []);

  return ready;
}
