/**
 * Motion tokens for Noctalia.
 *
 * These mirror the CSS custom properties in `global.css` (`--duration-*`, `--ease-*`).
 * Uniwind cannot drive Reanimated from `className` on the free tier, so anything that
 * moves reads its numbers from here and both sides stay in step.
 *
 * Rules encoded in these values:
 *   - Press feedback is 120 ms. Below the ~150 ms perceptual floor it reads as the
 *     surface responding rather than as an animation playing.
 *   - Anything a finger touched settles with a spring, so an interruption carries
 *     velocity instead of restarting.
 *   - Anything else uses a timing curve, and never an ease-in: starting slow delays
 *     the exact moment the user is looking at.
 */
import { Easing, cubicBezier, type WithSpringConfig } from 'react-native-reanimated';

/** Milliseconds. Mirrors `--duration-*`. */
export const DURATION = {
  /** Press in / press out. */
  press: 120,
  /** Toggles, chips, small state changes. */
  fast: 200,
  /** Cross-fades and on-screen movement. */
  normal: 400,
  /** Ambient, atmospheric drift. */
  slow: 600,
} as const;

/**
 * Curves for Reanimated **CSS** transitions and animations
 * (`transitionTimingFunction`, `animationTimingFunction`).
 */
export const EASE = {
  /** Default. Entering, exiting, press. */
  out: cubicBezier(0.23, 1, 0.32, 1),
  /** Something moving or morphing while already on screen. */
  inOut: cubicBezier(0.77, 0, 0.175, 1),
  /** The iOS sheet curve. */
  sheet: cubicBezier(0.32, 0.72, 0, 1),
} as const;

/** The same curves for the imperative API (`withTiming`). */
export const EASING = {
  out: Easing.bezier(0.23, 1, 0.32, 1),
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
  sheet: Easing.bezier(0.32, 0.72, 0, 1),
} as const;

/**
 * Springs, in Apple's two-parameter form. Prefer these over mass/stiffness/damping —
 * `duration` is the perceived settle time and `dampingRatio` is the bounce, which is
 * what you actually reason about when tuning.
 *
 * Pass the gesture's `velocity` on release so the animation continues the flick
 * instead of starting over.
 */
export const SPRING = {
  /** Default settle, no overshoot. */
  settle: { duration: 400, dampingRatio: 1 },
  /** Snapping back or repositioning after a drag. Overshoots a little. */
  snapBack: { duration: 400, dampingRatio: 0.8 },
  /** Sheets and drawers. */
  sheet: { duration: 300, dampingRatio: 0.8 },
  /** For a value that must not pass a hard edge (a progress fill, a clamp). */
  clamped: { duration: 400, dampingRatio: 1, overshootClamping: true },
} satisfies Record<string, WithSpringConfig>;

/**
 * Press scale. Scaling the whole pressable takes its label and icons with it, which is
 * what makes it read as a physical surface rather than a tinted rectangle.
 */
export const PRESS_SCALE = 0.97;

/** Touch targets are 44pt minimum. Grow the target, never the visual. */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

/** A finger drifting a few pixels shouldn't cancel a press the user meant. */
export const PRESS_RETENTION_OFFSET = { top: 16, bottom: 16, left: 16, right: 16 } as const;

/** Delay between siblings in a staggered entrance. Beyond ~6 items this reads as slow. */
export const STAGGER_MS = 50;

/** Items past this index enter together, so a long list never feels like it's loading. */
export const STAGGER_MAX_ITEMS = 6;

/** The delay for item `index` in a staggered entrance. */
export const staggerDelay = (index: number): number =>
  Math.min(index, STAGGER_MAX_ITEMS) * STAGGER_MS;
