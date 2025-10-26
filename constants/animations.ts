/**
 * Animation constants and configurations for the app
 * Using react-native-reanimated for smooth 60fps animations
 */

import { Easing, WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

// Animation durations (in milliseconds)
export const ANIMATION_DURATION = {
  fast: 200,
  normal: 400,
  slow: 600,
  verySlow: 800,
} as const;

// Spring animation configurations
export const SPRING_CONFIGS: Record<string, WithSpringConfig> = {
  // Bouncy spring for playful interactions
  bouncy: {
    damping: 12,
    stiffness: 150,
    mass: 0.5,
  },
  // Smooth spring for gentle transitions
  smooth: {
    damping: 20,
    stiffness: 120,
    mass: 0.8,
  },
  // Snappy spring for quick feedback
  snappy: {
    damping: 15,
    stiffness: 200,
    mass: 0.4,
  },
  // Gentle spring for cards
  gentle: {
    damping: 25,
    stiffness: 100,
    mass: 1,
  },
} as const;

// Timing animation configurations
export const TIMING_CONFIGS: Record<string, WithTimingConfig> = {
  // Linear timing
  linear: {
    duration: ANIMATION_DURATION.normal,
    easing: Easing.linear,
  },
  // Ease in out for smooth transitions
  easeInOut: {
    duration: ANIMATION_DURATION.normal,
    easing: Easing.bezier(0.42, 0, 0.58, 1),
  },
  // Ease out for natural deceleration
  easeOut: {
    duration: ANIMATION_DURATION.normal,
    easing: Easing.bezier(0, 0, 0.58, 1),
  },
  // Ease in for natural acceleration
  easeIn: {
    duration: ANIMATION_DURATION.normal,
    easing: Easing.bezier(0.42, 0, 1, 1),
  },
  // Custom curve for smooth feel
  smooth: {
    duration: ANIMATION_DURATION.slow,
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  },
} as const;

// Scale values for press interactions
export const SCALE = {
  press: 0.95,
  default: 1,
  enlarged: 1.05,
} as const;

// Opacity values
export const OPACITY = {
  transparent: 0,
  dimmed: 0.3,
  semiTransparent: 0.5,
  visible: 0.7,
  full: 1,
} as const;

// Stagger delay for list animations (in milliseconds)
export const STAGGER_DELAY = 50;

// Translation distances for slide animations
export const SLIDE_DISTANCE = {
  small: 10,
  medium: 30,
  large: 100,
} as const;
