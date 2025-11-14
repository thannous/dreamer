import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { router } from 'expo-router';

import { getCurrentUser, onAuthChange } from '@/lib/auth';
import { consumeStayOnSettingsIntent } from '@/lib/navigationIntents';

export type AuthContextValue = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const ensureSettingsTab = (nextUser: User | null) => {
    if (!nextUser) {
      return;
    }
    if (consumeStayOnSettingsIntent()) {
      router.replace('/(tabs)/settings');
    }
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const sessionUser = await getCurrentUser();
        if (mounted) {
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
      setUser(nextUser);
      setLoading(false);
      ensureSettingsTab(nextUser);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ user, loading }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
