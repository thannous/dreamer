import { createContext, useCallback, useContext, useRef } from 'react';
import { useWindowDimensions, type View } from 'react-native';
import {
  Extrapolation, interpolate, makeMutable, measure, useAnimatedRef, useAnimatedStyle, useDerivedValue,
  useReducedMotion, useSharedValue, type SharedValue,
} from 'react-native-reanimated';

function plainHolder(): SharedValue<number> {
  let current = 0;
  return { get: () => current, set: (next: number) => { current = next; } } as unknown as SharedValue<number>;
}

// Test doubles of Reanimated may omit makeMutable; a plain holder keeps the same API.
const RESTING_SCROLL: SharedValue<number> = typeof makeMutable === 'function' ? makeMutable(0) : plainHolder();

/**
 * The vertical scroll of the screen around a header, painting or card. Each screen that
 * scrolls owns its value (see `withHeaderScroll`); anywhere else it rests at the top, so
 * a header never fades from another screen's scroll.
 */
export const HeaderScrollContext = createContext<SharedValue<number>>(RESTING_SCROLL);

export function useHeaderScrollY(): SharedValue<number> {
  return useContext(HeaderScrollContext);
}

/** True outside any scrolling screen: such a value is never written. */
export function isRestingScroll(value: SharedValue<number>): boolean {
  return value === RESTING_SCROLL;
}

// Test doubles of Reanimated may omit useSharedValue; a plain holder keeps the same API.
export const useScreenScrollValue: () => SharedValue<number> = typeof useSharedValue === 'function'
  ? () => useSharedValue(0)
  : () => {
      const holder = useRef<SharedValue<number> | null>(null);
      if (!holder.current) holder.current = plainHolder();
      return holder.current;
    };

// Test doubles of Reanimated may omit useAnimatedRef; a plain ref keeps the frame still.
const useFrameRef: () => ReturnType<typeof useAnimatedRef<View>> = typeof useAnimatedRef === 'function'
  ? () => useAnimatedRef<View>()
  : () => useRef(null) as unknown as ReturnType<typeof useAnimatedRef<View>>;

// Test doubles of Reanimated may omit useDerivedValue; the drift then rests.
const useDrift: (drift: () => number) => SharedValue<number> = typeof useDerivedValue === 'function'
  ? (drift) => useDerivedValue(drift)
  : () => {
      const holder = useRef<SharedValue<number> | null>(null);
      if (!holder.current) holder.current = plainHolder();
      return holder.current;
    };

/**
 * A picture in a card drifts through its frame as the card crosses the screen: it shows
 * its lower part as the card enters at the bottom and its upper part as it leaves at the
 * top, so it seems to lie further away than the card. The picture overhangs its frame by
 * `travel` points above and below. Put `frame` and `onLayout` on the frame and `style` on
 * the picture. A `travel` of 0 (no picture shown) keeps the style still.
 */
export function useFrameParallax(travel: number) {
  const frame = useFrameRef();
  const screenScroll = useHeaderScrollY();
  // A frame is measured again once laid out, so a new page takes its drift at once rather
  // than on its first scroll.
  const laidOut = useScreenScrollValue();
  const reduced = useReducedMotion();
  const { height: screen, scale } = useWindowDimensions();
  // A still frame follows no scroll: its style is not run on each scroll frame, and never
  // measures a frame that is not mounted (Reanimated warns on each such measure).
  const drifts = travel > 0 && !reduced;
  const scrollY = drifts ? screenScroll : RESTING_SCROLL;
  const pixel = 1 / (scale > 0 ? scale : 1);
  // The drift in whole device pixels, apart from its style: Reanimated commits a style each
  // time it runs with a new transform, while a number that has not changed runs nothing. So a
  // slow scroll moves the picture only on the frames where it gains a pixel, and a card above
  // or below the screen, its picture held at the end of its travel, commits nothing at all.
  const drift = useDrift(() => {
    'worklet';
    // Read to run again on every scroll frame of its screen, and once its frame is laid out.
    scrollY.get();
    laidOut.get();
    // Positions are only known on the UI thread; the first pass on the JS thread rests.
    if (!drifts || !globalThis._WORKLET) return 0;
    const box = measure(frame);
    if (!box || box.height <= 0) return 0;
    const progress = (box.pageY + box.height / 2 - screen / 2) / (screen / 2 + box.height / 2);
    return Math.round(interpolate(progress, [-1, 1], [travel, -travel], Extrapolation.CLAMP) / pixel) * pixel;
  });
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: drift.get() }] }));
  const onLayout = useCallback(() => { laidOut.set(laidOut.get() + 1); }, [laidOut]);
  return { frame, style, onLayout };
}
