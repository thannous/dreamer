import React, { createContext, useContext, useEffect } from 'react';
import {
  cancelAnimation,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Breath, Curve } from '@/constants/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * ONE breath for the whole app.
 *
 * A single shared value, driven on the UI thread, oscillating 0 → 1 → 0 at
 * coherent-breathing pace. Every surface that breathes reads from it, so the
 * halo, the accent stripes and the player ring are all in phase — the interface
 * inhales and exhales as one body instead of a handful of loops drifting apart.
 *
 * Cost is one animation for the entire app, whatever the number of consumers.
 */
type BreathContextValue = {
  /** 0 = fully exhaled, 1 = fully inhaled. Never re-renders React. */
  progress: SharedValue<number>;
  /** True when the system asked for reduced motion: `progress` is pinned mid-way. */
  isStill: boolean;
};

const BreathContext = createContext<BreathContextValue | null>(null);

export const BreathProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const progress = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(progress);
      // Park it at the middle of the cycle: every surface lands on its average
      // value, so a still app looks intentional rather than half-finished.
      progress.value = 0.5;
      return;
    }

    progress.value = 0;
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: Breath.inhaleMs, easing: Curve.breath }),
        withTiming(0, { duration: Breath.exhaleMs, easing: Curve.breath })
      ),
      -1,
      false
    );

    return () => cancelAnimation(progress);
  }, [progress, reducedMotion]);

  return (
    <BreathContext.Provider value={{ progress, isStill: reducedMotion }}>
      {children}
    </BreathContext.Provider>
  );
};

/**
 * Reads the app-wide breath. Safe outside the provider: returns a still value
 * so components render normally in isolation and in tests.
 */
export const useBreath = (): BreathContextValue => {
  const ctx = useContext(BreathContext);
  const fallback = useSharedValue(0.5);

  return ctx ?? { progress: fallback, isStill: true };
};
