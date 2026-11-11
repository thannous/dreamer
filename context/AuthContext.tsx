import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { router } from 'expo-router';

import { isMockModeEnabled } from '@/lib/env';
import { getAuthReturnSnapshot } from '@/lib/authReturnIntent';
import { getCurrentUser, onAuthChange } from '@/lib/auth';
import { clearUnsentDrafts } from '@/lib/chat/unsentDrafts';
import { createCircuitBreaker } from '@/lib/circuitBreaker';
import { getPaywallTrigger } from '@/lib/analytics';
import { clearStayOnSettingsIntent, consumeStayOnSettingsDestination, peekReturnToPaywallTrigger } from '@/lib/navigationIntents';
import { buildPaywallHref } from '@/lib/paywallRoute';
import { normalizeSubscriptionTier } from '@/lib/quotaTier';
import type { SubscriptionTier } from '@/lib/types';
import { isLucidTrainer } from '@/lib/appVariant';
import { clearRemoteDreamStorage } from '@/services/storageService';
import { supabase } from '@/lib/supabase';
import { setDreamMediaScope } from '@/services/dreamMediaService';

export type AuthContextValue = {
  user: User | null;
  sessionGeneration: number;
  isCurrentSession: (userId: string | null, generation: number) => boolean;
  loading: boolean;
  sessionReady: boolean;
  returningGuestBlocked: boolean;
  refreshUser: (options?: RefreshUserOptions) => Promise<User | null>;
  setUserTierLocally: (input: LocalSubscriptionCacheInput, scope?: AuthScope) => void;
};

type AuthScope = { userId: string | null; generation: number };

function getSessionId(token?: string): string | undefined {
  // This claim distinguishes two logins for the same account across token refreshes.
  // It scopes client work only and is never used to authorize a request.
  try {
    const payload = token?.split('.')[1];
    if (!payload) return undefined;
    const { session_id: id } = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof id === 'string' ? id : undefined;
  } catch {
    return undefined;
  }
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export type RefreshUserOptions = {
  bypassCircuitBreaker?: boolean;
  skipJwtRefresh?: boolean;
  jwtRefreshTimeoutMs?: number;
};

export type LocalSubscriptionCacheInput =
  | SubscriptionTier
  | {
      tier: SubscriptionTier;
      version?: number | null;
      isActive?: boolean;
      productId?: string | null;
      entitlementId?: string | null;
      source?: string | null;
      sourceUpdatedAt?: string | null;
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
  const [sessionGeneration, setSessionGeneration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  // A device is only one signal in server-side abuse scoring. Logging out must
  // never hard-block guest mode on a shared or refurbished phone.
  const returningGuestBlocked = false;
  const userRef = useRef<User | null>(null);
  const sessionReadyRef = useRef(false);
  const authScope = useRef<AuthScope & { sessionId?: string }>({ userId: null, generation: 0 });
  const isCurrentSession = useCallback((userId: string | null, generation: number) =>
    authScope.current.userId === userId && authScope.current.generation === generation, []);

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
    if (!isLucidTrainer && getAuthReturnSnapshot().intent) {
      clearStayOnSettingsIntent();
      return; // Root navigation resumes the requested dream after its gates.
    }
    const paywallTrigger = peekReturnToPaywallTrigger();
    if (paywallTrigger) {
      // The user signed in from the paywall: bring them straight back to it.
      // The intent is cleared by the paywall screen itself, so if a route gate
      // (e.g. onboarding for a fresh user scope) replaces this navigation, the
      // gate's exit can still honour it.
      clearStayOnSettingsIntent();
      router.replace(buildPaywallHref(getPaywallTrigger(paywallTrigger)));
      return;
    }
    const settingsDestination = consumeStayOnSettingsDestination();
    if (__DEV__) {
      console.log('[AuthContext] ensureSettingsTab', {
        hasUser: true,
        settingsDestination,
      });
    }
    if (settingsDestination) {
      router.replace(settingsDestination);
    }
  };

  useEffect(() => {
    let mounted = true;
    let authEvent = 0;
    const advanceSession = (nextUser: User | null, accessToken?: string) => {
      const current = authScope.current;
      const userId = nextUser?.id ?? null;
      const sessionId = getSessionId(accessToken);
      if (current.userId !== userId || (sessionId && current.sessionId && current.sessionId !== sessionId)) {
        authScope.current = { userId, sessionId, generation: current.generation + 1 };
        refreshCircuitBreakerRef.current = createCircuitBreaker({ maxAttempts: 3, windowMs: 10000 });
      } else if (sessionId) {
        authScope.current = { ...current, sessionId };
      }
      return authScope.current;
    };
    const publishUser = (nextUser: User | null, scope: AuthScope) => {
      userRef.current = nextUser;
      setUser(nextUser);
      setSessionGeneration(scope.generation);
    };

    const bootstrap = async () => {
      try {
        if (isMockMode) {
          const mockUser = await getCurrentUser();
          if (mounted && authEvent === 0) {
            if (__DEV__) {
              console.log('[AuthContext] bootstrap (mock mode)', {
                hasUser: !!mockUser,
                email: mockUser?.email,
                tier: mockUser?.app_metadata?.tier ?? mockUser?.user_metadata?.tier,
              });
            }
            setDreamMediaScope(mockUser?.id ?? null);
            publishUser(mockUser, advanceSession(mockUser));
            setSessionReady(Boolean(mockUser));

            setLoading(false);
            ensureSettingsTab(mockUser);
          }
          return;
        }

        // Keep startup responsive: restore local session first, then let onAuthChange/getCurrentUser
        // reconcile server-side app_metadata in the background.
        const { data } = await supabase.auth.getSession();
        if (!mounted || authEvent !== 0) return;
        const sessionUser = data.session?.user ?? null;
        const scope = advanceSession(sessionUser, data.session?.access_token);
        if (mounted) {
          if (__DEV__) {
            console.log('[AuthContext] bootstrap user', {
              hasUser: !!sessionUser,
              email: sessionUser?.email,
              tier: sessionUser?.app_metadata?.tier ?? sessionUser?.user_metadata?.tier,
            });
          }
          setDreamMediaScope(sessionUser?.id ?? null);
          publishUser(sessionUser, scope);
          setSessionReady(Boolean(data.session?.access_token));

          setLoading(false);
          ensureSettingsTab(sessionUser);
        }

        // Best-effort reconciliation: fetch the authoritative user (server-side) so app_metadata
        // updates are reflected even if there is no auth state change event.
        if (sessionUser) {
          getCurrentUser()
            .then((current) => {
              if (mounted && current?.id === scope.userId) {
                setUser((previous) => isCurrentSession(scope.userId, scope.generation) ? current : previous);
              }
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
      const event = ++authEvent;
      const previousUserId = authScope.current.userId;
      const scope = advanceSession(nextUser, session?.access_token);
      if (__DEV__) {
        console.log('[AuthContext] onAuthChange', {
          hasUser: !!nextUser,
          email: nextUser?.email,
          tier: nextUser?.app_metadata?.tier ?? nextUser?.user_metadata?.tier,
        });
      }
      setDreamMediaScope(nextUser?.id ?? null);
      const nextUserId = nextUser?.id ?? null;
      if (previousUserId !== nextUserId) {
        // Text typed in a dream conversation stays with the account that typed it.
        clearUnsentDrafts();
      }
      if (!isLucidTrainer && previousUserId !== nextUserId) {
        try {
          // Called without an account on purpose: this only removes the journal
          // cache and queue written before they were stored per account, which
          // no account can safely claim. Each account's own cache and unsent
          // changes stay on the device, so signing back in loses nothing.
          await clearRemoteDreamStorage();
        } catch {
          // Best-effort: a leftover legacy blob is never read.
        }
      }
      if (!mounted || event !== authEvent) return;
      publishUser(nextUser, scope);
      if (isMockMode) {
        setSessionReady(Boolean(nextUser));
      } else if (!nextUser) {
        setSessionReady(false);
      } else if (session?.access_token) {
        setSessionReady(true);
      } else {
        const ready = await waitForSessionReady();
        if (mounted && event === authEvent) {
          setSessionReady(ready);
        }
      }

      if (!mounted || event !== authEvent) return;
      setLoading(false);
      ensureSettingsTab(nextUser);
    });

    return () => {
      mounted = false;
      authScope.current = { userId: null, generation: authScope.current.generation + 1 };
      setDreamMediaScope(null);
      unsubscribe();
    };
  }, [isCurrentSession]);

  const refreshUser = useCallback(async (options?: RefreshUserOptions) => {
    const scope = authScope.current;
    const isCurrent = () => isCurrentSession(scope.userId, scope.generation);
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
              resolve(isCurrent() ? currentUser : null);
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

      if (!isCurrent()) return null;
      if (existingUser && !sessionReadyRef.current) {
        const ready = await waitForSessionReady();
        if (!isCurrent()) return null;
        if (ready) {
          setSessionReady(true);
        }
      }

      const current = await getCurrentUser();
      if (!isCurrent() || (current && current.id !== scope.userId)) return null;
      if (!current && existingUser) {
        if (__DEV__) {
          console.warn('[AuthContext] refreshUser returned null, keeping existing user');
        }
        setLoading(false);
        return existingUser;
      }

      setUser(previous => isCurrent() ? current : previous);
      setSessionReady(Boolean(current));
      setLoading(false);
      return current;
    } catch (err) {
      if (__DEV__) {
        console.warn('Failed to refresh user', err);
      }
      return null;
    }
  }, [isCurrentSession]);

  const setUserTierLocally = useCallback((input: LocalSubscriptionCacheInput, scope = authScope.current) => {
    const cache = typeof input === 'string' ? { tier: input } : input;
    const tier = normalizeSubscriptionTier(cache.tier, 'free');

    setUser((prev) => {
      if (!prev || prev.id !== scope.userId || !isCurrentSession(scope.userId, scope.generation)) return prev;
      // Mirror tier into app_metadata (source of truth for quota) and keep user_metadata for backward UI paths.
      return {
        ...prev,
        app_metadata: {
          ...(prev.app_metadata ?? {}),
          tier,
          ...(cache.version !== undefined && { subscription_version: cache.version }),
          ...(cache.isActive !== undefined && { subscription_is_active: cache.isActive }),
          ...(cache.productId !== undefined && { subscription_product_id: cache.productId }),
          ...(cache.entitlementId !== undefined && { subscription_entitlement_id: cache.entitlementId }),
          ...(cache.source !== undefined && { subscription_source: cache.source }),
          ...(cache.sourceUpdatedAt !== undefined && { subscription_source_updated_at: cache.sourceUpdatedAt }),
        },
        user_metadata: {
          ...(prev.user_metadata ?? {}),
          tier,
        },
      } as User;
    });
  }, [isCurrentSession]);

  const value = useMemo(
    () => ({ user, sessionGeneration, isCurrentSession, loading, sessionReady, returningGuestBlocked, refreshUser, setUserTierLocally }),
    [user, sessionGeneration, isCurrentSession, loading, sessionReady, returningGuestBlocked, refreshUser, setUserTierLocally]
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
