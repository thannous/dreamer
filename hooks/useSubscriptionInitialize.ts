import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { initializeSubscription, isSubscriptionInitialized } from '@/services/subscriptionService';

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
          console.log('[useSubscriptionInitialize] Already initialized for user', {
            timestamp: new Date().toISOString(),
            userId: user?.id,
          });
          return;
        }

        console.log('[useSubscriptionInitialize] Initializing subscription for user', {
          timestamp: new Date().toISOString(),
          userId: user?.id,
        });

        if (!isSubscriptionInitialized()) {
          await initializeSubscription(user?.id ?? null);
          console.log('[useSubscriptionInitialize] Subscription SDK initialized', {
            timestamp: new Date().toISOString(),
            userId: user?.id,
          });

          // Refresh user to ensure app_metadata.tier is synced from server after RevenueCat init.
          // This fixes the race condition where subscription tier from RevenueCat differs from
          // the stale app_metadata in the restored session.
          // ✅ FIX: Use ref instead of direct dependency to avoid circular dependency
          await refreshUserRef.current();
          console.log('[useSubscriptionInitialize] User refreshed after subscription init', {
            timestamp: new Date().toISOString(),
            userId: user?.id,
          });

          initializedUserIdRef.current = user?.id ?? null;
        }
        if (mounted) {
          setInitialized(true);
        }
        console.log('[useSubscriptionInitialize] Subscription initialization completed', {
          timestamp: new Date().toISOString(),
          userId: user?.id,
        });
      } catch (e) {
        console.error('[useSubscriptionInitialize] Subscription initialization failed', {
          timestamp: new Date().toISOString(),
          userId: user?.id,
          error: (e as Error).message,
        });
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
