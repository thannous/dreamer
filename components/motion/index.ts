/**
 * Noctalia motion primitives.
 *
 * Import motion from here rather than reaching for Reanimated directly in a screen —
 * it keeps durations, curves and reduced-motion handling consistent, and keeps the
 * decisions (why 120 ms, why a spring here and a curve there) in one reviewable place.
 */
export { PressableScale, type PressableScaleProps, type PressableScaleHaptic } from './PressableScale';
export { Reveal, type RevealProps } from './Reveal';
export {
  DURATION,
  EASE,
  EASING,
  SPRING,
  PRESS_SCALE,
  HIT_SLOP,
  PRESS_RETENTION_OFFSET,
  STAGGER_MS,
  STAGGER_MAX_ITEMS,
  staggerDelay,
} from './motion';
