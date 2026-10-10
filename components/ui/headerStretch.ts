import { useIsFocused } from 'expo-router';
import { useCallback } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Extrapolation, interpolate, useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';

import { isRestingScroll, useHeaderScrollY } from './scrollDepth';

/**
 * For a screen's main vertical scroller, with `scrollEventThrottle={16}`: publishes its
 * offset to the header, paintings and cards of the screen (wrapped in `withHeaderScroll`).
 */
export function useHeaderScroll() {
  const scrollY = useHeaderScrollY();
  return useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!isRestingScroll(scrollY)) scrollY.set(event.nativeEvent.contentOffset.y);
  }, [scrollY]);
}

/**
 * Pulling the page down past the top stretches the painting instead of opening a gap
 * of bare ground above it: pinned to the top of the screen, it grows by the pull.
 * Scrolling down, it fades out over 60% of its height unless something around it
 * (its header) already fades. Apply with `transformOrigin: 'top center'`.
 */
export function useHeaderStretchStyle(height: number, pinned = false, fadeOnScroll = true) {
  const scrollY = useHeaderScrollY();
  const reduced = useReducedMotion();
  return useAnimatedStyle(() => {
    const y = scrollY.get();
    const opacity = fadeOnScroll && height > 0
      ? interpolate(y, [0, height * 0.6], [1, 0], Extrapolation.CLAMP)
      : 1;
    if (reduced || y >= 0 || height <= 0) return { opacity, transform: [{ translateY: 0 }, { scale: 1 }] };
    // In the content it rides down with the pull, so it is pulled back up to the top;
    // pinned over the content (a fixed header) it only grows down to follow it.
    return { opacity, transform: [{ translateY: pinned ? 0 : y }, { scale: 1 + -y / height }] };
  });
}

/** A header fades out as the page scrolls down, over about two thirds of its height. */
export function useHeaderFadeStyle(height: number) {
  const scrollY = useHeaderScrollY();
  return useAnimatedStyle(() => ({
    opacity: height > 0
      ? interpolate(scrollY.get(), [0, height * 0.65], [1, 0], Extrapolation.CLAMP)
      : 1,
  }));
}

/**
 * Depth for a painting: it slides through its frame more slowly than the page.
 * A frame that scrolls with the content leaves its painting lagging behind; a frame
 * fixed over the content lets its painting drift up instead. The uncovered strip is
 * off screen (or already the page's ground), so the frame needs no overhang.
 */
export function usePaintingDepthStyle(height: number, frame: 'scrolls' | 'fixed' = 'scrolls') {
  const scrollY = useHeaderScrollY();
  const reduced = useReducedMotion();
  return useAnimatedStyle(() => {
    const y = scrollY.get();
    if (reduced || y <= 0 || height <= 0) return { transform: [{ translateY: 0 }] };
    const travel = Math.min(y, height);
    return { transform: [{ translateY: frame === 'scrolls' ? travel * 0.45 : -travel * 0.3 }] };
  });
}

// Test doubles of expo-router may omit useIsFocused; a mounted painting is then on screen.
const useOnScreen: () => boolean = typeof useIsFocused === 'function' ? useIsFocused : () => true;

/**
 * A painting breathes: a slow zoom in and out, as if the scene were still dreaming.
 * Only on the screen in front, and never with reduced motion.
 */
export function usePaintingBreath() {
  const reduced = useReducedMotion();
  const onScreen = useOnScreen();
  if (reduced) return null;
  return {
    animationName: { from: { transform: [{ scale: 1 }] }, to: { transform: [{ scale: 1.07 }] } },
    animationDuration: '18s',
    animationIterationCount: 'infinite',
    animationDirection: 'alternate',
    animationTimingFunction: 'ease-in-out',
    animationPlayState: onScreen ? 'running' : 'paused',
  } as const;
}
