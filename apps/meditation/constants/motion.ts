import { Easing } from 'react-native-reanimated';

/**
 * Motion is slow and continuous — the app is meant to lower arousal, never to
 * demand attention. Nothing here should feel snappy.
 */
export const Duration = {
  instant: 120,
  fast: 220,
  base: 360,
  slow: 640,
  /** One full cycle of the animated artwork gradient. */
  artwork: 12000,
} as const;

/**
 * The app breathes at coherent-breathing pace: 5.5 s in, 5.5 s out — 5.45
 * cycles per minute. It is the pace the breathing exercises teach, so the
 * interface is already doing what it asks of the user.
 */
export const Breath = {
  inhaleMs: 5500,
  exhaleMs: 5500,
  get cycleMs() {
    return this.inhaleMs + this.exhaleMs;
  },
} as const;

/**
 * Amplitudes of the breath, per surface. All are deliberately below the
 * threshold of conscious notice — felt, not seen.
 */
export const BreathAmplitude = {
  /** Halo opacity swing around its base value. */
  halo: 0.04,
  /** Accent stripe opacity swing on featured cards. */
  stripe: 0.18,
  /** Scale swing of a breathing ring (1 → 1 + value). */
  ring: 0.02,
} as const;

/** Chrome fades out after this long without a touch, in immersive contexts. */
export const SilenceDelayMs = 4000;

export const Curve = {
  /** Default for UI transitions. */
  standard: Easing.bezier(0.32, 0.72, 0, 1),
  /** Breath in/out — symmetric, no overshoot ever. */
  breath: Easing.inOut(Easing.sin),
  enter: Easing.out(Easing.cubic),
  exit: Easing.in(Easing.cubic),
} as const;

/**
 * Offset between two beats of a staggered entrance. Long enough for the eye to
 * read a sequence, short enough that consecutive beats still overlap heavily —
 * a wash, not a queue.
 */
export const StaggerDelayMs = 140;

/**
 * Press amplitudes, per surface. What stays constant across the kit is the
 * perceived depth, not the multiplier: 0.97 on a 56 pt call to action and 0.97
 * on a 36 pt pill are not the same gesture, and on a full-width card the same
 * number reads as a flinch. Same family as `BreathAmplitude` — felt, not seen.
 */
export const PressScale = {
  button: 0.97,
  chip: 0.96,
  card: 0.985,
} as const;

/** Opacity at full press. Always 1.00 at rest — never above, it would clip. */
export const PressOpacity = {
  button: 0.92,
  chip: 0.92,
  /** A large surface carries more of the change in absolute area. */
  card: 0.94,
  /**
   * A bare text link has neither a fill nor a border to darken, so the dip is
   * the entire answer to the finger and has to be the deepest of the family to
   * register at all. It has no `PressScale` twin on purpose: scaling a glyph
   * smears it.
   */
  link: 0.7,
} as const;
