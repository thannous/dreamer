import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { BreathingPattern } from '@/content/breathing';
import { breathStateAt, cycleDurationMs, RING_SCALE_MIN, ringKeyframes, type BreathState } from '@/lib/breathing';

import { useReducedMotion } from './useReducedMotion';

/** How often the label, countdown and haptics are recomputed. Not per frame. */
const TICK_MS = 200;

type Options = {
  pattern: BreathingPattern;
  durationMin: number;
  hapticsEnabled?: boolean;
};

export type BreathEngine = {
  state: BreathState;
  /** Ring scale, driven on the UI thread. */
  scale: SharedValue<number>;
  running: boolean;
  /** Seconds left in the whole exercise. */
  remainingSec: number;
  finished: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
};

/**
 * The breathing exercise.
 *
 * This is the ONE place allowed to run a rhythm of its own instead of reading
 * the app-wide breath (`useBreath`): 4-7-8 is not the interface's 5.5/5.5, and
 * the exercise is the subject rather than an ambient surface.
 *
 * Phase, countdown and haptics all derive from a single elapsed-time clock, so
 * they cannot drift apart from each other or from the ring.
 */
export function useBreathEngine({
  pattern,
  durationMin,
  hapticsEnabled = true,
}: Options): BreathEngine {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(RING_SCALE_MIN);

  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  /** Wall-clock anchor for the current run, plus what earlier runs accumulated. */
  const startedAtRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);
  const lastPhaseIndexRef = useRef<number | null>(null);

  const totalMs = durationMin * 60 * 1000;
  const state = breathStateAt(pattern, elapsedMs);
  const remainingSec = Math.max(0, Math.ceil((totalMs - elapsedMs) / 1000));
  const finished = elapsedMs >= totalMs;

  const animateRing = useCallback(() => {
    if (reducedMotion) {
      // The gauge takes over; a looping scale is exactly what was asked to stop.
      scale.value = RING_SCALE_MIN;
      return;
    }

    const steps = ringKeyframes(pattern);
    scale.value = RING_SCALE_MIN;
    scale.value = withRepeat(
      withSequence(
        ...steps.map((step) =>
          withTiming(step.to, {
            duration: step.durationMs,
            easing: Easing.inOut(Easing.sin),
          })
        )
      ),
      -1,
      false
    );
  }, [pattern, reducedMotion, scale]);

  const start = useCallback(() => {
    if (running || finished) return;
    startedAtRef.current = Date.now();
    setRunning(true);
    animateRing();
  }, [running, finished, animateRing]);

  const pause = useCallback(() => {
    if (!running) return;
    if (startedAtRef.current !== null) {
      accumulatedRef.current += Date.now() - startedAtRef.current;
      startedAtRef.current = null;
    }
    cancelAnimation(scale);
    setRunning(false);
  }, [running, scale]);

  const reset = useCallback(() => {
    cancelAnimation(scale);
    scale.value = RING_SCALE_MIN;
    startedAtRef.current = null;
    accumulatedRef.current = 0;
    lastPhaseIndexRef.current = null;
    setElapsedMs(0);
    setRunning(false);
  }, [scale]);

  // Restarting the ring when the pattern changes mid-exercise keeps the visual
  // and the clock describing the same rhythm.
  useEffect(() => {
    if (running) animateRing();
  }, [pattern, running, animateRing]);

  useEffect(() => {
    if (!running) return;

    const tick = setInterval(() => {
      const base = accumulatedRef.current;
      const live = startedAtRef.current === null ? 0 : Date.now() - startedAtRef.current;
      setElapsedMs(Math.min(totalMs, base + live));
    }, TICK_MS);

    return () => clearInterval(tick);
  }, [running, totalMs]);

  // One tick at each phase boundary — the whole point of the haptic is that it
  // marks the transition, so it must never fire twice inside a phase.
  useEffect(() => {
    if (!running) return;
    if (lastPhaseIndexRef.current === state.phaseIndex) return;

    const isFirst = lastPhaseIndexRef.current === null;
    lastPhaseIndexRef.current = state.phaseIndex;
    if (isFirst) return;

    if (hapticsEnabled && !reducedMotion) {
      Haptics.selectionAsync().catch(() => {});
    }
  }, [state.phaseIndex, running, hapticsEnabled, reducedMotion]);

  useEffect(() => {
    if (!finished || !running) return;
    cancelAnimation(scale);
    setRunning(false);
  }, [finished, running, scale]);

  useEffect(() => () => cancelAnimation(scale), [scale]);

  return { state, scale, running, remainingSec, finished, start, pause, reset };
}

export { cycleDurationMs };
