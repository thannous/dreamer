import { useIsFocused } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Platform, ScrollView, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, {
  Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useDerivedValue, useReducedMotion, type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { EASE } from '@/components/motion/motion';

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

// Publish bounded scalar values before constructing animated styles. Once the painting
// is out of view (or the pull has ended), equal derived values no longer wake a style
// mapper on each scroll event. Visible motion retains the same positions and opacity.
const STRETCH_REST = [{ translateY: 0 }, { scale: 1 }];

/**
 * Pulling past the top stretches the painting instead of opening a gap. In the content
 * it follows the pull back to the top; pinned over the content it grows downwards.
 * Scrolling down fades it out over 60% of its height unless its header already fades.
 * Apply with `transformOrigin: 'top center'`.
 */
export function useHeaderStretchStyle(height: number, pinned = false, fadeOnScroll = true) {
  const scrollY = useHeaderScrollY();
  const reduced = useReducedMotion();
  const opacity = useDerivedValue(() => fadeOnScroll && height > 0
    ? interpolate(scrollY.get(), [0, height * 0.6], [1, 0], Extrapolation.CLAMP)
    : 1);
  const pull = useDerivedValue(() => reduced || height <= 0 ? 0 : Math.min(scrollY.get(), 0));
  return useAnimatedStyle(() => {
    const y = pull.get();
    return {
      opacity: opacity.get(),
      transform: y === 0 ? STRETCH_REST : [{ translateY: pinned ? 0 : y }, { scale: 1 + -y / height }],
    };
  });
}

/** A header fades out as the page scrolls down, over about two thirds of its height. */
export function useHeaderFadeStyle(height: number) {
  const scrollY = useHeaderScrollY();
  const opacity = useDerivedValue(() => height > 0
    ? interpolate(scrollY.get(), [0, height * 0.65], [1, 0], Extrapolation.CLAMP)
    : 1);
  return useAnimatedStyle(() => ({ opacity: opacity.get() }));
}

/**
 * A painting scrolls more slowly than its frame: down through a scrolling frame, up
 * through a fixed one. Travel stops at the frame's height; the uncovered strip is off
 * screen or already the page's ground, so the frame needs no overhang.
 */
export function usePaintingDepthStyle(height: number, frame: 'scrolls' | 'fixed' = 'scrolls') {
  const scrollY = useHeaderScrollY();
  const reduced = useReducedMotion();
  const offset = useDerivedValue(() => {
    if (reduced || height <= 0) return 0;
    const y = Math.max(0, Math.min(height, scrollY.get()));
    return frame === 'scrolls' ? y * 0.45 : -y * 0.3;
  });
  return useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
}

// Test doubles of expo-router may omit useIsFocused; a mounted screen is then in front.
export const useOnScreen: () => boolean = typeof useIsFocused === 'function' ? useIsFocused : () => true;

// One object, so a render of the screen never starts the arrival again.
const PAINTING_ARRIVAL = {
  animationName: { from: { transform: [{ scale: 1.05 }] }, to: { transform: [{ scale: 1 }] } },
  animationDuration: 1600,
  animationTimingFunction: EASE.out,
  animationFillMode: 'both',
} as const;

/**
 * A painting arrives: as its screen opens it settles from a slight zoom, then rests, and
 * after that only the scroll moves it. On Android every frame of a moving painting redraws
 * the whole screen, so an endless breath kept a page at rest busy; this costs a second and
 * a half once (owner decision 2026-10-20). Never with reduced motion.
 */
export function usePaintingArrival() {
  return useReducedMotion() ? null : PAINTING_ARRIVAL;
}
