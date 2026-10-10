import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Extrapolation, interpolate, useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';

import { headerScrollY } from './scrollDepth';

export { headerScrollY };

// Test doubles of expo-router may omit useFocusEffect; mounting is then the only focus.
const useScreenFocus: (effect: () => void) => void = typeof useFocusEffect === 'function'
  ? useFocusEffect
  : (effect) => { useEffect(effect, [effect]); };

/** Publishes a screen's own scroll offset again whenever the screen comes into focus. */
export function useHeaderScrollFocus(read: () => number): void {
  useScreenFocus(useCallback(() => { headerScrollY.set(read()); }, [read]));
}

/**
 * For a screen's main vertical scroller, with `scrollEventThrottle={16}`: tracks the
 * screen's own offset and publishes it to its header.
 */
export function useHeaderScroll() {
  const offset = useRef(0);
  useHeaderScrollFocus(useCallback(() => offset.current, []));
  return useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.y;
    headerScrollY.set(offset.current);
  }, []);
}

/**
 * Pulling the page down past the top stretches the painting instead of opening a gap
 * of bare ground above it: pinned to the top of the screen, it grows by the pull.
 * Scrolling down, it fades out over 60% of its height unless something around it
 * (its header) already fades. Apply with `transformOrigin: 'top center'`.
 */
export function useHeaderStretchStyle(height: number, pinned = false, fadeOnScroll = true) {
  const reduced = useReducedMotion();
  return useAnimatedStyle(() => {
    const y = headerScrollY.get();
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
  return useAnimatedStyle(() => ({
    opacity: height > 0
      ? interpolate(headerScrollY.get(), [0, height * 0.65], [1, 0], Extrapolation.CLAMP)
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
  const reduced = useReducedMotion();
  return useAnimatedStyle(() => {
    const y = headerScrollY.get();
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
