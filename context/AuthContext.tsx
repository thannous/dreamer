import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';

import { onAuthChange } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export type AuthContextValue = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (mounted) {
          setUser(data.session?.user ?? null);
          setLoading(false);
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
