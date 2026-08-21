import { useRouter } from 'expo-router';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useLibrary } from '@/context/LibraryContext';
import {
  canPlaySession,
  canUseBreathingPattern,
  canUseFadeTimer,
  playsThisMonth,
  remainingFreePlays,
  type Gate,
  type GateReason,
  type SubscriptionTier,
} from '@/lib/entitlements';
import { toLocalDay } from '@/lib/streak';
import type { MeditationSession } from '@/lib/types';
import * as subscriptions from '@/services/subscriptionService';

type SubscriptionContextValue = {
  tier: SubscriptionTier;
  loaded: boolean;
  monthlyPlays: number;
  remainingPlays: number;
  isPlus: boolean;
  /** Gates, pre-bound to the current tier and quota. */
  gateForSession: (session: MeditationSession) => Gate;
  gateForPattern: (patternId: Parameters<typeof canUseBreathingPattern>[0]) => Gate;
  gateForTimer: (minutes: number | null) => Gate;
  /** Sends the listener to the paywall, with the reason it opened. */
  openPaywall: (reason: GateReason) => void;
  refresh: () => Promise<void>;
  applyTier: (tier: SubscriptionTier) => void;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export const SubscriptionProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const router = useRouter();
  const { practiceLog } = useLibrary();
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    subscriptions
      .configure()
      .then(() => subscriptions.currentTier())
      .then((next) => {
        if (mounted) setTier(next);
      })
      .catch(() => {
        // A store that will not answer must not lock the app: fall back to free
        // and let "Restore" recover the purchase.
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const monthlyPlays = useMemo(
    () => playsThisMonth(practiceLog, toLocalDay(new Date())),
    [practiceLog]
  );

  const refresh = useCallback(async () => {
    setTier(await subscriptions.currentTier());
  }, []);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      tier,
      loaded,
      monthlyPlays,
      remainingPlays: remainingFreePlays(tier, monthlyPlays),
      isPlus: tier === 'plus',
      gateForSession: (session) => canPlaySession(session, tier, monthlyPlays),
      gateForPattern: (patternId) => canUseBreathingPattern(patternId, tier),
      gateForTimer: (minutes) => canUseFadeTimer(minutes, tier),
      openPaywall: (reason) => router.push(`/paywall?reason=${reason}`),
      refresh,
      applyTier: setTier,
    }),
    [tier, loaded, monthlyPlays, refresh, router]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
};

export const useSubscription = (): SubscriptionContextValue => {
  const ctx = useContext(SubscriptionContext);

  return (
    ctx ?? {
      tier: 'free',
      loaded: false,
      monthlyPlays: 0,
      remainingPlays: 3,
      isPlus: false,
      gateForSession: () => ({ allowed: true }),
      gateForPattern: () => ({ allowed: true }),
      gateForTimer: () => ({ allowed: true }),
      openPaywall: () => {},
      refresh: async () => {},
      applyTier: () => {},
    }
  );
};
