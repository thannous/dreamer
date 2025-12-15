import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { router } from 'expo-router';

import { isMockModeEnabled } from '@/lib/env';
import { getCurrentUser, onAuthChange } from '@/lib/auth';
import { consumeStayOnSettingsIntent } from '@/lib/navigationIntents';
import type { SubscriptionTier } from '@/lib/types';
import { supabase } from '@/lib/supabase';

export type AuthContextValue = {
  user: User | null;
  loading: boolean;
  refreshUser: (options?: RefreshUserOptions) => Promise<User | null>;
  setUserTierLocally: (tier: SubscriptionTier) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export type RefreshUserOptions = {
  bypassCircuitBreaker?: boolean;
  skipJwtRefresh?: boolean;
  jwtRefreshTimeoutMs?: number;
};

const isMockMode = isMockModeEnabled();

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Circuit breaker for refresh cascades
  const refreshAttemptsRef = useRef<number[]>([]);
  const MAX_REFRESHES_PER_WINDOW = 3;
  const REFRESH_WINDOW_MS = 10000; // 10 seconds

  const ensureSettingsTab = (nextUser: User | null) => {
    if (!nextUser) {
      if (__DEV__) {
        console.log('[AuthContext] ensureSettingsTab: no user, skipping');
      }
      return;
    }
    const shouldStayOnSettings = consumeStayOnSettingsIntent();
    if (__DEV__) {
      console.log('[AuthContext] ensureSettingsTab', {
        hasUser: true,
        shouldStayOnSettings,
      });
    }
    if (shouldStayOnSettings) {
      router.replace('/(tabs)/settings');
    }
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        // Keep startup responsive: restore local session first, then let onAuthChange/getCurrentUser
        // reconcile server-side app_metadata in the background.
        const { data } = await supabase.auth.getSession();
        const sessionUser = data.session?.user ?? null;
        if (mounted) {
          if (__DEV__) {
            console.log('[AuthContext] bootstrap user', {
              hasUser: !!sessionUser,
              email: sessionUser?.email,
              tier: sessionUser?.app_metadata?.tier ?? sessionUser?.user_metadata?.tier,
            });
          }
          setUser(sessionUser);
          setLoading(false);
          ensureSettingsTab(sessionUser);
        }

        // Best-effort reconciliation: fetch the authoritative user (server-side) so app_metadata
        // updates are reflected even if there is no auth state change event.
        if (sessionUser) {
          getCurrentUser()
            .then((current) => {
              if (!mounted) return;
              if (current?.id && current.id !== sessionUser.id) return;
              if (current) setUser(current);
            })
            .catch(() => {
              // ignore
            });
        }
      } catch (error) {
        if (__DEV__) {
          console.warn('Failed to fetch initial session', error);
        }
        if (mounted) {
          setLoading(false);
        }
      }
    };

    bootstrap();

    const unsubscribe = onAuthChange((nextUser) => {
      if (__DEV__) {
        console.log('[AuthContext] onAuthChange', {
          hasUser: !!nextUser,
          email: nextUser?.email,
          tier: nextUser?.app_metadata?.tier ?? nextUser?.user_metadata?.tier,
        });
      }
      setUser(nextUser);
      setLoading(false);
      ensureSettingsTab(nextUser);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const refreshUser = useCallback(async (options?: RefreshUserOptions) => {
    try {
      const bypassCircuitBreaker = options?.bypassCircuitBreaker === true;
      const skipJwtRefresh = options?.skipJwtRefresh === true;
      const jwtRefreshTimeoutMs = options?.jwtRefreshTimeoutMs ?? 5000;

      if (!bypassCircuitBreaker) {
        // Circuit breaker: prevent rapid-fire refresh cascades
        const now = Date.now();
        refreshAttemptsRef.current = refreshAttemptsRef.current.filter(
          (timestamp: number) => now - timestamp < REFRESH_WINDOW_MS
        );

        if (refreshAttemptsRef.current.length >= MAX_REFRESHES_PER_WINDOW) {
          // ✅ FIX: Log circuit breaker activation for diagnostics
          if (__DEV__) {
            console.warn(
              `[AuthContext] Circuit breaker: ${MAX_REFRESHES_PER_WINDOW} refreshes in ${REFRESH_WINDOW_MS}ms. Skipping refresh.`
            );
          }
          // ✅ FIX: Return current user from state using functional update to avoid dependency on user closure
          return await new Promise<User | null>((resolve) => {
            setUser((currentUser) => {
              resolve(currentUser);
              return currentUser;
            });
          });
        }

        refreshAttemptsRef.current.push(now);
      }

      // Refresh the JWT so DB-side auth.jwt() (used by quota triggers) reflects updated app_metadata.
      // This is especially important after server-side app_metadata updates (RevenueCat webhook).
      if (!isMockMode && !skipJwtRefresh) {
        await Promise.race([
          supabase.auth.refreshSession(),
          new Promise((resolve) => setTimeout(resolve, jwtRefreshTimeoutMs)),
        ]).catch(() => {
          // Best-effort: if refresh fails, fall back to getUser() which may still succeed.
        });
      }
      const current = await getCurrentUser();
      setUser(current);
      setLoading(false);
      return current;
    } catch (err) {
      if (__DEV__) {
        console.warn('Failed to refresh user', err);
      }
      return null;
    }
  }, []); // ✅ CRITICAL: Remove 'user' from dependencies to break circular dependency

  const setUserTierLocally = useCallback((tier: SubscriptionTier) => {
    setUser((prev) => {
      if (!prev) return prev;
      // Mirror tier into app_metadata (source of truth for quota) and keep user_metadata for backward UI paths.
      return {
        ...prev,
        app_metadata: {
          ...(prev.app_metadata ?? {}),
          tier,
        },
        user_metadata: {
          ...(prev.user_metadata ?? {}),
          tier,
        },
      } as User;
    });
  }, []);

  const value = useMemo(
    () => ({ user, loading, refreshUser, setUserTierLocally }),
    [user, loading, refreshUser, setUserTierLocally]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
