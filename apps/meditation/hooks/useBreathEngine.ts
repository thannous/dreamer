import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
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
import { playBreathHaptic } from '@/lib/breathGuidance';

import { useReducedMotion } from './useReducedMotion';

/** How often the label, countdown and haptics are recomputed. Not per frame. */
const TICK_MS = 200;

type Options = {
  pattern: BreathingPattern;
  durationMin: number;
  hapticsEnabled?: boolean;
};

export type BreathPracticeStatus = 'ready' | 'active' | 'paused' | 'finished';

export type BreathEngine = {
  state: BreathState;
  /** Ring scale, driven on the UI thread. */
  scale: SharedValue<number>;
  status: BreathPracticeStatus;
  running: boolean;
  started: boolean;
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
  const lastHapticKeyRef = useRef<string | null>(null);

  const totalMs = durationMin * 60 * 1000;
  const state = breathStateAt(pattern, elapsedMs);
  const remainingSec = Math.max(0, Math.ceil((totalMs - elapsedMs) / 1000));
  const finished = elapsedMs >= totalMs;
  // Derived rather than written back by an effect: reaching the end used to
  // call `setRunning(false)` from inside one, which is a cascading render the
  // linter rightly refuses. Nothing else has to know the difference.
  const active = running && !finished;
  const started = elapsedMs > 0 || running || finished;
  const status: BreathPracticeStatus = finished
    ? 'finished'
    : active
      ? 'active'
      : started
        ? 'paused'
        : 'ready';

  const animateRing = useCallback(() => {
    if (reducedMotion) {
      // The gauge takes over; a looping scale is exactly what was asked to stop.
      scale.set(RING_SCALE_MIN);
      return;
    }

    const steps = ringKeyframes(pattern);
    scale.set(RING_SCALE_MIN);
    scale.set(
      withRepeat(
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
      )
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

  useEffect(() => {
    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') return;
      pause();
    };
    const subscription = AppState.addEventListener('change', onAppState);
    return () => subscription.remove();
  }, [pause]);

  const reset = useCallback(() => {
    cancelAnimation(scale);
    scale.set(RING_SCALE_MIN);
    startedAtRef.current = null;
    accumulatedRef.current = 0;
    lastHapticKeyRef.current = null;
    setElapsedMs(0);
    setRunning(false);
  }, [scale]);

  // Restarting the ring when the pattern changes mid-exercise keeps the visual
  // and the clock describing the same rhythm.
  useEffect(() => {
    if (active) animateRing();
  }, [pattern, active, animateRing]);

  useEffect(() => {
    if (!active) return;

    const tick = setInterval(() => {
      const base = accumulatedRef.current;
      const live = startedAtRef.current === null ? 0 : Date.now() - startedAtRef.current;
      setElapsedMs(Math.min(totalMs, base + live));
    }, TICK_MS);

    return () => clearInterval(tick);
  }, [active, totalMs]);

  // One signature at each phase boundary, including the first breath. Reduced
  // motion stills the ring, not the vibration: haptic-only practice has to
  // keep working when the visuals stay still.
  useEffect(() => {
    if (!active || !hapticsEnabled) {
      lastHapticKeyRef.current = null;
      return;
    }

    const key = `${state.cycleIndex}:${state.phaseIndex}`;
    if (lastHapticKeyRef.current === key) return;
    lastHapticKeyRef.current = key;
    playBreathHaptic(state.phase).catch(() => {});
  }, [active, hapticsEnabled, state.cycleIndex, state.phaseIndex, state.phase]);

  // Stopping the ring is a genuine side effect; the state that drove it is not.
  useEffect(() => {
    if (active) return;
    cancelAnimation(scale);
  }, [active, scale]);

  useEffect(() => () => cancelAnimation(scale), [scale]);

  return {
    state,
    scale,
    status,
    running: active,
    started,
    remainingSec,
    finished,
    start,
    pause,
    reset,
  };
}

export { cycleDurationMs };
