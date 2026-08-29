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
  freeQuotaResetDay,
  playsThisMonth,
  remainingFreePlays,
  type Gate,
  type GateReason,
  type SubscriptionTier,
} from '@/lib/entitlements';
import { areSubscriptionsEnabled } from '@/lib/env';
import { toLocalDay } from '@/lib/streak';
import type { MeditationSession } from '@/lib/types';
import * as subscriptions from '@/services/subscriptionService';

type SubscriptionContextValue = {
  subscriptionsEnabled: boolean;
  tier: SubscriptionTier;
  loaded: boolean;
  monthlyPlays: number;
  remainingPlays: number;
  /** Local `YYYY-MM-DD` when the free monthly quota resets. */
  quotaResetDay: string;
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
  const subscriptionsEnabled = areSubscriptionsEnabled();
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [loaded, setLoaded] = useState(!subscriptionsEnabled);

  useEffect(() => {
    if (!subscriptionsEnabled) return;

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
  }, [subscriptionsEnabled]);

  const today = toLocalDay(new Date());
  const monthlyPlays = playsThisMonth(practiceLog, today);
  const quotaResetDay = freeQuotaResetDay(today);
  const accessTier: SubscriptionTier = subscriptionsEnabled ? tier : 'plus';

  const refresh = useCallback(async () => {
    if (!subscriptionsEnabled) return;
    setTier(await subscriptions.currentTier());
  }, [subscriptionsEnabled]);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      subscriptionsEnabled,
      tier: accessTier,
      loaded,
      monthlyPlays,
      remainingPlays: remainingFreePlays(accessTier, monthlyPlays),
      quotaResetDay,
      isPlus: accessTier === 'plus',
      gateForSession: (session) => canPlaySession(session, accessTier, monthlyPlays),
      gateForPattern: (patternId) => canUseBreathingPattern(patternId, accessTier),
      gateForTimer: (minutes) => canUseFadeTimer(minutes, accessTier),
      openPaywall: (reason) => {
        if (subscriptionsEnabled) router.push(`/paywall?reason=${reason}`);
      },
      refresh,
      applyTier: (nextTier) => {
        if (subscriptionsEnabled) setTier(nextTier);
      },
    }),
    [subscriptionsEnabled, accessTier, loaded, monthlyPlays, quotaResetDay, refresh, router]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
};

export const useSubscription = (): SubscriptionContextValue => {
  const ctx = useContext(SubscriptionContext);

  return (
    ctx ?? {
      subscriptionsEnabled: false,
      tier: 'plus',
      loaded: true,
      monthlyPlays: 0,
      remainingPlays: Number.POSITIVE_INFINITY,
      quotaResetDay: freeQuotaResetDay(toLocalDay(new Date())),
      isPlus: true,
      gateForSession: () => ({ allowed: true }),
      gateForPattern: () => ({ allowed: true }),
      gateForTimer: () => ({ allowed: true }),
      openPaywall: () => {},
      refresh: async () => {},
      applyTier: () => {},
    }
  );
};
