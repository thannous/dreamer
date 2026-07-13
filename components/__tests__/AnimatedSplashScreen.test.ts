import { describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    View: 'AnimatedView',
    createAnimatedComponent: (component: unknown) => component,
  },
  Easing: {
    linear: (value: unknown) => value,
    inOut: (value: unknown) => value,
    out: (value: unknown) => value,
    cubic: (value: unknown) => value,
    quad: (value: unknown) => value,
  },
  cancelAnimation: jest.fn(),
  interpolate: jest.fn(),
  interpolateColor: jest.fn(),
  runOnJS: (fn: unknown) => fn,
  useAnimatedProps: jest.fn(),
  useAnimatedStyle: jest.fn(),
  useSharedValue: (value: unknown) => ({ value }),
  withRepeat: jest.fn(),
  withSequence: jest.fn(),
  withTiming: jest.fn(),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));

import { shouldUseAnimatedSplash } from '@/components/AnimatedSplashScreen';

describe('AnimatedSplashScreen motion policy', () => {
  it('disables splash animation, particles, and haptic scheduling for reduced motion', () => {
    expect(shouldUseAnimatedSplash(true)).toBe(false);
  });

  it('keeps the full splash sequence when reduced motion is disabled', () => {
    expect(shouldUseAnimatedSplash(false)).toBe(true);
  });

  it('switches to a static surface when the startup failsafe expires', () => {
    expect(shouldUseAnimatedSplash(false, true)).toBe(false);
  });
});
