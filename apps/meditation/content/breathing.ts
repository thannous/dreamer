import type { AccentPair } from '@/lib/types';

export type BreathPhaseType = 'inhale' | 'hold' | 'exhale' | 'rest';

export type BreathPhase = {
  type: BreathPhaseType;
  seconds: number;
};

export type BreathingPatternId = 'calm' | 'box' | 'four-seven-eight' | 'coherent';

export type BreathingPattern = {
  id: BreathingPatternId;
  phases: BreathPhase[];
  /** Preselected length, in minutes. */
  defaultDurationMin: 1 | 3 | 5 | 10;
  accent: AccentPair;
};

/** Session lengths offered on the exercise screen. */
export const BREATH_DURATIONS = [1, 3, 5, 10] as const;
export type BreathDurationMinutes = (typeof BREATH_DURATIONS)[number];

/**
 * Four patterns.
 *
 * `coherent` is 5.5 s in, 5.5 s out — the exact rhythm the whole interface
 * already breathes at (`constants/motion.ts`). The app is not teaching
 * something it does not itself do.
 */
export const BREATHING_PATTERNS: BreathingPattern[] = [
  {
    id: 'calm',
    phases: [
      { type: 'inhale', seconds: 4 },
      { type: 'exhale', seconds: 6 },
    ],
    defaultDurationMin: 3,
    accent: ['#31354F', '#0D0B1C'],
  },
  {
    id: 'box',
    phases: [
      { type: 'inhale', seconds: 4 },
      { type: 'hold', seconds: 4 },
      { type: 'exhale', seconds: 4 },
      { type: 'rest', seconds: 4 },
    ],
    defaultDurationMin: 5,
    accent: ['#446B8C', '#0D0B1C'],
  },
  {
    id: 'four-seven-eight',
    phases: [
      { type: 'inhale', seconds: 4 },
      { type: 'hold', seconds: 7 },
      { type: 'exhale', seconds: 8 },
    ],
    defaultDurationMin: 3,
    accent: ['#6C568F', '#0D0B1C'],
  },
  {
    id: 'coherent',
    phases: [
      { type: 'inhale', seconds: 5.5 },
      { type: 'exhale', seconds: 5.5 },
    ],
    defaultDurationMin: 5,
    accent: ['#4F3D6B', '#0D0B1C'],
  },
];

export const PATTERN_BY_ID: Record<BreathingPatternId, BreathingPattern> =
  BREATHING_PATTERNS.reduce(
    (acc, pattern) => ({ ...acc, [pattern.id]: pattern }),
    {} as Record<BreathingPatternId, BreathingPattern>
  );

export const isBreathingPatternId = (value: string): value is BreathingPatternId =>
  BREATHING_PATTERNS.some((pattern) => pattern.id === value);
