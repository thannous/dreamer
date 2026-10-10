import { createContext, useContext, useRef } from 'react';
import { useWindowDimensions, type View } from 'react-native';
import {
  Extrapolation, interpolate, makeMutable, measure, useAnimatedRef, useAnimatedStyle, useReducedMotion,
  useSharedValue, type SharedValue,
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

/**
 * A picture in a card drifts through its frame as the card crosses the screen: it shows
 * its lower part as the card enters at the bottom and its upper part as it leaves at the
 * top, so it seems to lie further away than the card. The picture overhangs its frame by
 * `travel` points above and below. Put `frame` on the frame and `style` on the picture.
 */
export function useFrameParallax(travel: number) {
  const frame = useFrameRef();
  const scrollY = useHeaderScrollY();
  const reduced = useReducedMotion();
  const { height: screen } = useWindowDimensions();
  const style = useAnimatedStyle(() => {
    // Read to run again on every scroll frame of its screen.
    scrollY.get();
    // Positions are only known on the UI thread; the first pass on the JS thread rests.
    if (reduced || travel <= 0 || !globalThis._WORKLET) return { transform: [{ translateY: 0 }] };
    const box = measure(frame);
    if (!box || box.height <= 0) return { transform: [{ translateY: 0 }] };
    const progress = (box.pageY + box.height / 2 - screen / 2) / (screen / 2 + box.height / 2);
    return { transform: [{ translateY: interpolate(progress, [-1, 1], [travel, -travel], Extrapolation.CLAMP) }] };
  });
  return { frame, style };
}
