import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { router } from 'expo-router';

import { isMockModeEnabled } from '@/lib/env';
import { getCurrentUser, onAuthChange, wasAccountCreatedOnDevice } from '@/lib/auth';
import { createCircuitBreaker } from '@/lib/circuitBreaker';
import { consumeStayOnSettingsIntent } from '@/lib/navigationIntents';
import { clearRemoteDreamStorage } from '@/services/storageService';
import type { SubscriptionTier } from '@/lib/types';
import { supabase } from '@/lib/supabase';

export type AuthContextValue = {
  user: User | null;
  loading: boolean;
  sessionReady: boolean;
  returningGuestBlocked: boolean;
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
const SESSION_READY_RETRIES = 4;
const SESSION_READY_DELAY_MS = 150;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waitForSessionReady(): Promise<boolean> {
  for (let attempt = 0; attempt <= SESSION_READY_RETRIES; attempt += 1) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        return true;
      }
    } catch {
      // Ignore transient session fetch errors and retry.
    }
    if (attempt < SESSION_READY_RETRIES) {
      await sleep(SESSION_READY_DELAY_MS);
    }
  }
  return false;
}

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [returningGuestBlocked, setReturningGuestBlocked] = useState(false);
  const userRef = useRef<User | null>(null);
  const sessionReadyRef = useRef(false);
  const previousUserIdRef = useRef<string | null>(null);

  // Circuit breaker for refresh cascades
  const refreshCircuitBreakerRef = useRef(createCircuitBreaker({ maxAttempts: 3, windowMs: 10000 }));

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    sessionReadyRef.current = sessionReady;
  }, [sessionReady]);

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
        if (isMockMode) {
          const mockUser = await getCurrentUser();
          if (mounted) {
            if (__DEV__) {
              console.log('[AuthContext] bootstrap (mock mode)', {
                hasUser: !!mockUser,
                email: mockUser?.email,
                tier: mockUser?.app_metadata?.tier ?? mockUser?.user_metadata?.tier,
              });
            }
            setUser(mockUser);
            setSessionReady(Boolean(mockUser));
            previousUserIdRef.current = mockUser?.id ?? null;

            // Check if returning guest should be blocked
            if (!mockUser) {
              const accountCreated = await wasAccountCreatedOnDevice();
              if (accountCreated) {
                setReturningGuestBlocked(true);
                if (__DEV__) {
                  console.log('[AuthContext] Returning guest blocked (mock mode)');
                }
              }
            } else {
              setReturningGuestBlocked(false);
            }

            setLoading(false);
            ensureSettingsTab(mockUser);
          }
          return;
        }

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
          setSessionReady(Boolean(data.session?.access_token));
          previousUserIdRef.current = sessionUser?.id ?? null;

          // Check if returning guest should be blocked
          if (!sessionUser) {
            const accountCreated = await wasAccountCreatedOnDevice();
            if (accountCreated) {
              setReturningGuestBlocked(true);
              if (__DEV__) {
                console.log('[AuthContext] Returning guest blocked');
              }
            }
          } else {
            setReturningGuestBlocked(false);
          }

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

    const unsubscribe = onAuthChange(async (nextUser, session) => {
      if (__DEV__) {
        console.log('[AuthContext] onAuthChange', {
          hasUser: !!nextUser,
          email: nextUser?.email,
          tier: nextUser?.app_metadata?.tier ?? nextUser?.user_metadata?.tier,
        });
      }
      const previousUserId = previousUserIdRef.current;
      const nextUserId = nextUser?.id ?? null;
      if (previousUserId !== nextUserId) {
        try {
          await clearRemoteDreamStorage();
        } catch (error) {
          if (__DEV__) {
            console.warn('[AuthContext] Failed to clear remote dream cache', error);
          }
        }
      }

      previousUserIdRef.current = nextUserId;
      setUser(nextUser);
      if (isMockMode) {
        setSessionReady(Boolean(nextUser));
      } else if (!nextUser) {
        setSessionReady(false);
      } else if (session?.access_token) {
        setSessionReady(true);
      } else {
        const ready = await waitForSessionReady();
        if (mounted) {
          setSessionReady(ready);
        }
      }

      // Update returning guest blocked state
      if (nextUser) {
        // User is logged in, so they're not a blocked returning guest
        setReturningGuestBlocked(false);
      } else {
        // User logged out, check if they had created an account before
        const accountCreated = await wasAccountCreatedOnDevice();
        setReturningGuestBlocked(accountCreated);
        if (__DEV__ && accountCreated) {
          console.log('[AuthContext] Returning guest blocked after logout');
        }
      }

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
      const existingUser = userRef.current;

      if (!bypassCircuitBreaker) {
        const breaker = refreshCircuitBreakerRef.current;
        if (breaker.shouldBlock()) {
          if (__DEV__) {
            console.warn('[AuthContext] Circuit breaker: skipping refresh.');
          }
          return await new Promise<User | null>((resolve) => {
            setUser((currentUser) => {
              resolve(currentUser);
              return currentUser;
            });
          });
        }
        breaker.record();
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

      if (existingUser && !sessionReadyRef.current) {
        const ready = await waitForSessionReady();
        if (ready) {
          setSessionReady(true);
        }
      }

      let current = await getCurrentUser();
      if (!current && existingUser) {
        if (__DEV__) {
          console.warn('[AuthContext] refreshUser returned null, keeping existing user');
        }
        setLoading(false);
        return existingUser;
      }

      setUser(current);
      setSessionReady(Boolean(current));
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
    () => ({ user, loading, sessionReady, returningGuestBlocked, refreshUser, setUserTierLocally }),
    [user, loading, sessionReady, returningGuestBlocked, refreshUser, setUserTierLocally]
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
