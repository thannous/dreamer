import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import type { PurchasePackage, SubscriptionStatus } from '@/lib/types';
import {
    getSubscriptionStatus,
    initializeSubscription,
    isSubscriptionInitialized,
    loadSubscriptionPackages,
    purchaseSubscriptionPackage,
    restoreSubscriptionPurchases,
} from '@/services/subscriptionService';

export function useSubscription() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [packages, setPackages] = useState<PurchasePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        if (!isSubscriptionInitialized()) {
          await initializeSubscription(user?.id ?? null);
        }
        const [nextStatus, nextPackages] = await Promise.all([
          getSubscriptionStatus(),
          loadSubscriptionPackages(),
        ]);
        if (mounted) {
          setStatus(nextStatus);
          setPackages(nextPackages);
        }
      } catch (e) {
        if (mounted) {
          setError(e as Error);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const purchase = useCallback(async (id: string) => {
    setProcessing(true);
    setError(null);
    try {
      const nextStatus = await purchaseSubscriptionPackage(id);
      setStatus(nextStatus);
      return nextStatus;
    } catch (e) {
      setError(e as Error);
      throw e;
    } finally {
      setProcessing(false);
    }
  }, []);

  const restore = useCallback(async () => {
    setProcessing(true);
    setError(null);
    try {
      const nextStatus = await restoreSubscriptionPurchases();
      setStatus(nextStatus);
      return nextStatus;
    } catch (e) {
      setError(e as Error);
      throw e;
    } finally {
      setProcessing(false);
    }
  }, []);

  return {
    status,
    isActive: status?.isActive ?? false,
    loading,
    processing,
    error,
    packages,
    purchase,
    restore,
  };
}
