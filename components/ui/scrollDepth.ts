import { useRef } from 'react';
import { useWindowDimensions, type View } from 'react-native';
import {
  Extrapolation, interpolate, makeMutable, measure, useAnimatedRef, useAnimatedStyle, useReducedMotion, type SharedValue,
} from 'react-native-reanimated';

function plainHolder(): SharedValue<number> {
  let current = 0;
  return { get: () => current, set: (next: number) => { current = next; } } as unknown as SharedValue<number>;
}

/**
 * The vertical scroll of the screen in front, shared with its header and painting.
 * Each screen keeps its own offset and publishes it again when it comes back into
 * focus, so a header never reads another screen's scroll.
 */
export const headerScrollY: SharedValue<number> = typeof makeMutable === 'function'
  ? makeMutable(0)
  // Test doubles of Reanimated may omit makeMutable; a plain holder keeps the same API.
  : plainHolder();

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
  const reduced = useReducedMotion();
  const { height: screen } = useWindowDimensions();
  const style = useAnimatedStyle(() => {
    // Read to run again on every scroll frame of the screen in front.
    headerScrollY.get();
    // Positions are only known on the UI thread; the first pass on the JS thread rests.
    if (reduced || travel <= 0 || !globalThis._WORKLET) return { transform: [{ translateY: 0 }] };
    const box = measure(frame);
    if (!box || box.height <= 0) return { transform: [{ translateY: 0 }] };
    const progress = (box.pageY + box.height / 2 - screen / 2) / (screen / 2 + box.height / 2);
    return { transform: [{ translateY: interpolate(progress, [-1, 1], [travel, -travel], Extrapolation.CLAMP) }] };
  });
  return { frame, style };
}
