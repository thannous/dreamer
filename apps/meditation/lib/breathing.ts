import type { BreathingPattern, BreathPhase, BreathPhaseType } from '@/content/breathing';

/**
 * Where a pattern is at a given moment.
 *
 * Deliberately a pure function of elapsed time rather than a chain of timers:
 * timers drift, and an exercise that teaches a 4-7-8 rhythm has to still be a
 * 4-7-8 rhythm after five minutes. Anything reading this — the label, the
 * haptic, the countdown — is derived from the same clock and cannot desync.
 */

export type BreathState = {
  phase: BreathPhaseType;
  /** Index of the phase inside the pattern. */
  phaseIndex: number;
  /** How far into the current phase, 0 → 1. */
  phaseProgress: number;
  /** Seconds left in the current phase, rounded up for display. */
  phaseRemainingSec: number;
  /** Completed cycles since the start. */
  cycleIndex: number;
};

export const cycleDurationMs = (pattern: BreathingPattern): number =>
  pattern.phases.reduce((total, phase) => total + phase.seconds * 1000, 0);

/** Scale of the ring at each phase boundary: the visual language of the breath. */
export const RING_SCALE_MIN = 0.55;
export const RING_SCALE_MAX = 1;

export function breathStateAt(pattern: BreathingPattern, elapsedMs: number): BreathState {
  const cycleMs = cycleDurationMs(pattern);
  const safeElapsed = Math.max(0, elapsedMs);
  const cycleIndex = Math.floor(safeElapsed / cycleMs);

  let offset = safeElapsed % cycleMs;

  for (let index = 0; index < pattern.phases.length; index += 1) {
    const phase = pattern.phases[index];
    const phaseMs = phase.seconds * 1000;

    if (offset < phaseMs) {
      return {
        phase: phase.type,
        phaseIndex: index,
        phaseProgress: phaseMs === 0 ? 1 : offset / phaseMs,
        phaseRemainingSec: Math.ceil((phaseMs - offset) / 1000),
        cycleIndex,
      };
    }
    offset -= phaseMs;
  }

  // Unreachable while the phases sum to the cycle, but a rounding error must
  // not return undefined and blank the screen mid-exercise.
  const last = pattern.phases[pattern.phases.length - 1];
  return {
    phase: last.type,
    phaseIndex: pattern.phases.length - 1,
    phaseProgress: 1,
    phaseRemainingSec: 0,
    cycleIndex,
  };
}

/**
 * Ring scale for a phase. `hold` stays expanded and `rest` stays contracted —
 * a ring that keeps moving during a hold is teaching the wrong thing.
 */
export function ringScaleFor(phase: BreathPhaseType, progress: number): number {
  const span = RING_SCALE_MAX - RING_SCALE_MIN;

  switch (phase) {
    case 'inhale':
      return RING_SCALE_MIN + span * progress;
    case 'exhale':
      return RING_SCALE_MAX - span * progress;
    case 'hold':
      return RING_SCALE_MAX;
    case 'rest':
      return RING_SCALE_MIN;
  }
}

/** The sequence of (target, duration) steps one cycle animates through. */
export function ringKeyframes(pattern: BreathingPattern): { to: number; durationMs: number }[] {
  return pattern.phases.map((phase: BreathPhase) => ({
    to: ringScaleFor(phase.type, 1),
    durationMs: phase.seconds * 1000,
  }));
}

export const totalCycles = (pattern: BreathingPattern, durationMin: number): number =>
  Math.floor((durationMin * 60 * 1000) / cycleDurationMs(pattern));
