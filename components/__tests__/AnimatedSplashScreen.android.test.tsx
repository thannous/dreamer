import React from 'react';
import { cleanup, render } from '@testing-library/react-native';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import AnimatedSplashScreen, {
  ANDROID_STATIC_SPLASH_MINIMUM_VISIBLE_MS,
  SPLASH_PARTICLE_COUNT,
  getSplashMinimumVisibleMs,
  shouldUseAnimatedSplash,
} from '@/components/AnimatedSplashScreen.android';

describe('Android static splash', () => {
  afterEach(cleanup);

  it('uses the short, animation-free Android policy', () => {
    expect(getSplashMinimumVisibleMs()).toBe(ANDROID_STATIC_SPLASH_MINIMUM_VISIBLE_MS);
    expect(shouldUseAnimatedSplash()).toBe(false);
    expect(SPLASH_PARTICLE_COUNT).toBe(0);
  });

  it('finishes the outro exactly once', () => {
    const onAnimationEnd = jest.fn();
    const view = render(
      <AnimatedSplashScreen status="intro" onAnimationEnd={onAnimationEnd} />
    );

    view.rerender(
      <AnimatedSplashScreen status="outro" onAnimationEnd={onAnimationEnd} />
    );
    view.rerender(
      <AnimatedSplashScreen status="outro" onAnimationEnd={onAnimationEnd} />
    );

    expect(onAnimationEnd).toHaveBeenCalledTimes(1);
  });
});
