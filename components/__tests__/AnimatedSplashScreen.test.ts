import React from 'react';
import { cleanup, render } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockCancelAnimation = jest.fn();
const mockWithTiming = jest.fn(
  (value: unknown, _config?: unknown, callback?: (finished: boolean) => void) => {
    callback?.(true);
    callback?.(true);
    return value;
  }
);
const mockPrefersReducedMotion = jest.fn(() => false);

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
  cancelAnimation: (...args: unknown[]) => mockCancelAnimation(...args),
  interpolate: () => 0,
  interpolateColor: () => '#fff',
  runOnJS: (fn: unknown) => fn,
  useAnimatedProps: (factory: () => unknown) => factory(),
  useAnimatedStyle: (factory: () => unknown) => factory(),
  useSharedValue: (value: unknown) => {
    const ReactModule = require('react') as typeof React;
    return ReactModule.useRef({ value }).current;
  },
  withRepeat: (value: unknown) => value,
  withSequence: (...values: unknown[]) => values.at(-1),
  withTiming: (
    value: unknown,
    config?: unknown,
    callback?: (finished: boolean) => void
  ) => mockWithTiming(value, config, callback),
}));

jest.mock('@/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => mockPrefersReducedMotion(),
}));

// The import must follow the module factories so lifecycle callbacks stay observable.
// eslint-disable-next-line import/first
import AnimatedSplashScreen, {
  ANDROID_STATIC_SPLASH_MINIMUM_VISIBLE_MS,
  SPLASH_MINIMUM_VISIBLE_MS,
  SPLASH_OUTRO_DURATION_MS,
  SPLASH_PARTICLE_COUNT,
  getSplashMinimumVisibleMs,
  shouldUseAnimatedSplash,
  shouldUseMinimalStaticSplash,
} from '@/components/AnimatedSplashScreen';

describe('AnimatedSplashScreen motion policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrefersReducedMotion.mockReturnValue(false);
  });

  afterEach(cleanup);

  it('disables splash animation, particles, and haptic scheduling for reduced motion', () => {
    expect(shouldUseAnimatedSplash(true)).toBe(false);
  });

  it('keeps the full splash sequence when reduced motion is disabled', () => {
    expect(shouldUseAnimatedSplash(false)).toBe(true);
  });

  it('switches to a static surface when the startup failsafe expires', () => {
    expect(shouldUseAnimatedSplash(false, true)).toBe(false);
  });

  it('keeps the startup animation inside the performance budget', () => {
    expect(SPLASH_MINIMUM_VISIBLE_MS).toBeLessThanOrEqual(600);
    expect(ANDROID_STATIC_SPLASH_MINIMUM_VISIBLE_MS).toBeLessThanOrEqual(150);
    expect(SPLASH_OUTRO_DURATION_MS).toBeLessThanOrEqual(250);
    expect(SPLASH_PARTICLE_COUNT).toBeLessThanOrEqual(12);
  });

  it('does not hold the static Android splash for the animated iOS budget', () => {
    expect(getSplashMinimumVisibleMs('android')).toBe(
      ANDROID_STATIC_SPLASH_MINIMUM_VISIBLE_MS
    );
    expect(getSplashMinimumVisibleMs('ios')).toBe(SPLASH_MINIMUM_VISIBLE_MS);
  });

  it('removes decorative static gradients only on Android', () => {
    expect(shouldUseMinimalStaticSplash('android')).toBe(true);
    expect(shouldUseMinimalStaticSplash('ios')).toBe(false);
  });

  it('stops shared animations before the outro callback and calls it once', () => {
    const onAnimationEnd = jest.fn();
    const view = render(
      React.createElement(AnimatedSplashScreen, { status: 'intro', onAnimationEnd })
    );

    view.rerender(
      React.createElement(AnimatedSplashScreen, { status: 'outro', onAnimationEnd })
    );

    expect(mockCancelAnimation).toHaveBeenCalled();
    expect(onAnimationEnd).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('cleans up an interrupted intro without completing it', () => {
    const onAnimationEnd = jest.fn();
    const view = render(
      React.createElement(AnimatedSplashScreen, { status: 'intro', onAnimationEnd })
    );

    view.unmount();

    expect(mockCancelAnimation).toHaveBeenCalled();
    expect(onAnimationEnd).not.toHaveBeenCalled();
  });

  it('finishes the static Android-style outro once without scheduling a timing worklet', () => {
    const onAnimationEnd = jest.fn();
    const view = render(
      React.createElement(AnimatedSplashScreen, {
        status: 'intro',
        forceStatic: true,
        onAnimationEnd,
      })
    );
    mockWithTiming.mockClear();

    view.rerender(
      React.createElement(AnimatedSplashScreen, {
        status: 'outro',
        forceStatic: true,
        onAnimationEnd,
      })
    );

    expect(mockWithTiming).not.toHaveBeenCalled();
    expect(onAnimationEnd).toHaveBeenCalledTimes(1);
  });
});
