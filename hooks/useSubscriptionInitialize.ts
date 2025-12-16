import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { createScopedLogger } from '@/lib/logger';
import { initializeSubscription, isSubscriptionInitialized } from '@/services/subscriptionService';

const log = createScopedLogger('[useSubscriptionInitialize]');

export function useSubscriptionInitialize() {
  const { user, refreshUser } = useAuth();
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // ✅ FIX: Store refreshUser in a ref to break the circular dependency
  // Prevents re-triggering when refreshUser callback is recreated
  const refreshUserRef = useRef(refreshUser);
  useEffect(() => {
    refreshUserRef.current = refreshUser;
  }, [refreshUser]);

  // ✅ FIX: Track if initialization has completed for this user
  // Prevents redundant initialization calls
  const initializedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        // ✅ Avoid re-initialization for the same user
        if (initializedUserIdRef.current === (user?.id ?? null)) {
          if (mounted) {
            setInitialized(true);
          }
          log.debug('Already initialized for user', { userId: user?.id ?? null });
          return;
        }

        log.debug('Initializing subscription for user', { userId: user?.id ?? null });

        if (!isSubscriptionInitialized()) {
          await initializeSubscription(user?.id ?? null);
          log.debug('Subscription SDK initialized', { userId: user?.id ?? null });

          // Refresh user to ensure app_metadata.tier is synced from server after RevenueCat init.
          // This fixes the race condition where subscription tier from RevenueCat differs from
          // the stale app_metadata in the restored session.
          // ✅ FIX: Use ref instead of direct dependency to avoid circular dependency
          await refreshUserRef.current();
          log.debug('User refreshed after subscription init', { userId: user?.id ?? null });

          initializedUserIdRef.current = user?.id ?? null;
        }
        if (mounted) {
          setInitialized(true);
        }
        log.debug('Subscription initialization completed', { userId: user?.id ?? null });
      } catch (e) {
        log.error('Subscription initialization failed', { userId: user?.id ?? null }, e);
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
  }, [user?.id]); // ✅ CRITICAL: Remove refreshUser from dependencies

  return { initialized, error };
}
