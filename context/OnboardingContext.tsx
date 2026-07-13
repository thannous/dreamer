import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuth } from '@/context/AuthContext';
import {
  claimGuestOnboardingState,
  getDefaultOnboardingState,
  getOnboardingState,
  reduceOnboardingState,
  transitionOnboarding,
  type OnboardingEvent,
  type OnboardingPath,
  type OnboardingScope,
  type OnboardingState,
} from '@/lib/onboardingState';

export type OnboardingContextValue = {
  state: OnboardingState;
  loading: boolean;
  error: Error | null;
  scope: OnboardingScope;
  transition: (event: OnboardingEvent) => Promise<OnboardingState>;
  continueForSession: (reason?: OnboardingPath | 'skip') => void;
  reload: () => Promise<OnboardingState>;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error('Unable to load onboarding state');

export function OnboardingProvider({ children }: React.PropsWithChildren) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const scope = useMemo<OnboardingScope>(
    () => (userId ? `user:${userId}` : 'guest'),
    [userId]
  );
  const [state, setState] = useState<OnboardingState>(() => getDefaultOnboardingState());
  const [loadedScope, setLoadedScope] = useState<OnboardingScope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const activeLoadRef = useRef(0);
  const stateRef = useRef(state);
  const sessionOnlyRef = useRef(false);

  const loadScope = useCallback(async (): Promise<OnboardingState> => {
    const loadId = activeLoadRef.current + 1;
    activeLoadRef.current = loadId;
    setLoading(true);
    setError(null);

    try {
      if (userId) {
        await claimGuestOnboardingState(userId);
      }
      const next = await getOnboardingState(scope);
      if (activeLoadRef.current === loadId) {
        stateRef.current = next;
        sessionOnlyRef.current = false;
        setState(next);
        setLoadedScope(scope);
        setLoading(false);
      }
      return next;
    } catch (cause) {
      const nextError = toError(cause);
      if (activeLoadRef.current === loadId) {
        const safeState = getDefaultOnboardingState();
        stateRef.current = safeState;
        sessionOnlyRef.current = false;
        setState(safeState);
        setLoadedScope(scope);
        setError(nextError);
        setLoading(false);
      }
      throw nextError;
    }
  }, [scope, userId]);

  useEffect(() => {
    if (authLoading) return;

    let active = true;
    void loadScope().catch(() => {
      if (!active) return;
      // Error state is exposed to the onboarding screen. Startup remains on the
      // safe, incomplete default state rather than bypassing first run.
    });

    return () => {
      active = false;
      activeLoadRef.current += 1;
    };
  }, [authLoading, loadScope]);

  const transition = useCallback(
    async (event: OnboardingEvent): Promise<OnboardingState> => {
      setError(null);
      if (sessionOnlyRef.current && loadedScope === scope) {
        const next = reduceOnboardingState(stateRef.current, event);
        stateRef.current = next;
        setState(next);
        return next;
      }
      try {
        const next = await transitionOnboarding(scope, event);
        stateRef.current = next;
        setState(next);
        setLoadedScope(scope);
        return next;
      } catch (cause) {
        const nextError = toError(cause);
        setError(nextError);
        throw nextError;
      }
    },
    [loadedScope, scope]
  );

  const continueForSession = useCallback((reason: OnboardingPath | 'skip' = 'skip') => {
    setError(null);
    const base = loadedScope === scope ? stateRef.current : getDefaultOnboardingState();
    const next = reason === 'skip'
      ? reduceOnboardingState(base, { type: 'SKIP' })
      : reduceOnboardingState(base, { type: 'COMPLETE', path: reason });
    sessionOnlyRef.current = true;
    stateRef.current = next;
    setState(next);
    setLoadedScope(scope);
  }, [loadedScope, scope]);

  const scopeReady = loadedScope === scope;
  const unloadedScopeState = useMemo(() => getDefaultOnboardingState(), [scope]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      state: scopeReady ? state : unloadedScopeState,
      loading: authLoading || loading || !scopeReady,
      error,
      scope,
      transition,
      continueForSession,
      reload: loadScope,
    }),
    [
      authLoading,
      continueForSession,
      error,
      loadScope,
      loading,
      scope,
      scopeReady,
      state,
      transition,
      unloadedScopeState,
    ]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}
