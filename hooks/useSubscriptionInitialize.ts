import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { createScopedLogger } from '@/lib/logger';
import { initializeSubscription, isSubscriptionInitialized } from '@/services/subscriptionService';
import { syncSubscriptionFromServer } from '@/services/subscriptionSyncService';

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
  const syncedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const nextUserId = user?.id ?? null;

        if (!nextUserId) {
          syncedUserIdRef.current = null;
        }

        // ✅ Avoid re-initialization for the same user
        // We still call initializeSubscription when user changes to ensure Purchases.logIn/logOut
        // keeps RevenueCat aligned with the current Supabase user.
        if (initializedUserIdRef.current === nextUserId && isSubscriptionInitialized()) {
          if (mounted) {
            setInitialized(true);
            setError(null);
          }
          log.debug('Already initialized for user', { userId: nextUserId });
          return;
        }

        log.debug('Initializing subscription for user', { userId: nextUserId });

        // Always call initializeSubscription to ensure correct Purchases user linking on auth changes.
        await initializeSubscription(nextUserId);
        log.debug('Subscription SDK initialized', { userId: nextUserId });

        if (nextUserId && syncedUserIdRef.current !== nextUserId) {
          try {
            await syncSubscriptionFromServer('app_launch');
            log.debug('Subscription sync requested', { userId: nextUserId });
          } catch (syncError) {
            log.warn('Subscription sync failed', { userId: nextUserId }, syncError);
          } finally {
            syncedUserIdRef.current = nextUserId;
          }
        }

        if (nextUserId) {
          // Refresh user to ensure app_metadata.tier is synced from server after RevenueCat init.
          // This fixes the race condition where subscription tier from RevenueCat differs from
          // the stale app_metadata in the restored session.
          // ✅ FIX: Use ref instead of direct dependency to avoid circular dependency
          await refreshUserRef.current();
          log.debug('User refreshed after subscription init', { userId: nextUserId });
        }
        initializedUserIdRef.current = nextUserId;

        if (mounted) {
          setInitialized(true);
          setError(null);
        }
        log.debug('Subscription initialization completed', { userId: nextUserId });
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
