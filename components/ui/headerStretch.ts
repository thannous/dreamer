import { useIsFocused } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Platform, ScrollView, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, {
  Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { isRestingScroll, useHeaderScrollY } from './scrollDepth';

// On native the offset reaches the header on the UI thread: a busy JavaScript thread
// cannot hold the painting or the title back, and a scroll sends it no event per frame.
// The web keeps the plain scroller and a JavaScript handler, as the journal list and the
// dream page do. Test doubles of Reanimated may omit these APIs; the plain path stands in.
const nativeScroll = Platform.OS !== 'web'
  && typeof useAnimatedScrollHandler === 'function'
  && typeof Animated?.createAnimatedComponent === 'function';

/** The scroller to use with `useHeaderScroll`. */
export const HeaderScrollView = nativeScroll ? Animated.createAnimatedComponent(ScrollView) : ScrollView;

/**
 * The list to use with `useHeaderScroll`. Not `Animated.FlatList`, which wraps every row
 * in an animated view for layout animations these lists never use.
 */
export const HeaderFlatList = nativeScroll ? Animated.createAnimatedComponent(FlatList) : FlatList;

const useNativeScrollHandler = nativeScroll
  ? function useNativeScrollHandler(scrollY: SharedValue<number>, resting: boolean, onScroll?: () => void) {
      return useAnimatedScrollHandler({
        onScroll: (event) => {
          if (!resting) scrollY.set(event.contentOffset.y);
          if (onScroll) scheduleOnRN(onScroll);
        },
      }, [onScroll, resting, scrollY]);
    }
  : function useNoNativeScrollHandler(): null {
      return null;
    };

/**
 * For a screen's main vertical scroller (`HeaderScrollView` or `HeaderFlatList`, with
 * `scrollEventThrottle={16}`): publishes its offset to the header, paintings and cards
 * of the screen (wrapped in `withHeaderScroll`). `onScroll`, when given, also runs on
 * the JavaScript thread for each scroll event; leave it out once it has nothing to do.
 */
export function useHeaderScroll(onScroll?: () => void) {
  const scrollY = useHeaderScrollY();
  const resting = isRestingScroll(scrollY);
  const onWebScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!resting) scrollY.set(event.nativeEvent.contentOffset.y);
    onScroll?.();
  }, [onScroll, resting, scrollY]);
  const onNativeScroll = useNativeScrollHandler(scrollY, resting, onScroll);
  return onNativeScroll ?? onWebScroll;
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

// Test doubles of expo-router may omit useIsFocused; a mounted screen is then in front.
export const useOnScreen: () => boolean = typeof useIsFocused === 'function' ? useIsFocused : () => true;

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
