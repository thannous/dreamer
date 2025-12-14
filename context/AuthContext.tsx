import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { router } from 'expo-router';

import { getCurrentUser, onAuthChange } from '@/lib/auth';
import { consumeStayOnSettingsIntent } from '@/lib/navigationIntents';
import type { SubscriptionTier } from '@/lib/types';

export type AuthContextValue = {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<User | null>;
  setUserTierLocally: (tier: SubscriptionTier) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
        const sessionUser = await getCurrentUser();
        if (mounted) {
          if (__DEV__) {
            console.log('[AuthContext] bootstrap user', {
              hasUser: !!sessionUser,
              email: sessionUser?.email,
            });
          }
          setUser(sessionUser);
          setLoading(false);
          ensureSettingsTab(sessionUser);
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

  const refreshUser = useCallback(async () => {
    try {
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
  }, []);

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
