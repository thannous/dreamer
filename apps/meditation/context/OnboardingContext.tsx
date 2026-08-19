import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { INITIAL_ONBOARDING, type OnboardingState } from '@/lib/types';
import { readJson, StorageKey, writeJson } from '@/services/storageService';

type OnboardingPatch =
  | Partial<OnboardingState>
  | ((current: OnboardingState) => Partial<OnboardingState>);

type OnboardingContextValue = {
  state: OnboardingState;
  /** False until the stored state has been read; the router waits on it. */
  loaded: boolean;
  update: (patch: OnboardingPatch) => Promise<void>;
  complete: () => Promise<void>;
  reset: () => Promise<void>;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export const OnboardingProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [state, setState] = useState<OnboardingState>(INITIAL_ONBOARDING);
  const [loaded, setLoaded] = useState(false);

  /**
   * Mirrors `state`, but updated SYNCHRONOUSLY inside `update`.
   *
   * Two taps in the same tick — tapping two goals quickly — would otherwise
   * both read the pre-tap state and the first selection would be silently
   * dropped. React state alone cannot fix this: the caller needs to see the
   * previous change before the next render.
   */
  const stateRef = useRef(state);

  const commit = useCallback(async (next: OnboardingState) => {
    stateRef.current = next;
    setState(next);
    await writeJson(StorageKey.onboarding, next);
  }, []);

  useEffect(() => {
    let mounted = true;

    readJson<OnboardingState>(StorageKey.onboarding, INITIAL_ONBOARDING)
      .then((stored) => {
        if (!mounted) return;
        // Merge over the defaults: state written by an older build may be
        // missing keys added since.
        const merged = { ...INITIAL_ONBOARDING, ...stored };
        stateRef.current = merged;
        setState(merged);
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const update = useCallback(
    async (patch: OnboardingPatch) => {
      const resolved = typeof patch === 'function' ? patch(stateRef.current) : patch;
      await commit({ ...stateRef.current, ...resolved });
    },
    [commit]
  );

  const complete = useCallback(() => update({ completed: true }), [update]);

  const reset = useCallback(() => commit(INITIAL_ONBOARDING), [commit]);

  const value = useMemo(
    () => ({ state, loaded, update, complete, reset }),
    [state, loaded, update, complete, reset]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
};

export const useOnboarding = (): OnboardingContextValue => {
  const ctx = useContext(OnboardingContext);

  return (
    ctx ?? {
      state: INITIAL_ONBOARDING,
      loaded: false,
      update: async () => {},
      complete: async () => {},
      reset: async () => {},
    }
  );
};
