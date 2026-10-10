import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { makeMutable, useAnimatedStyle, useReducedMotion, type SharedValue } from 'react-native-reanimated';

/**
 * The vertical scroll of the screen in front, shared with its header painting.
 * One value is enough: only the visible screen scrolls, and a painting only reacts
 * to a pull past the top (a negative offset).
 */
function plainHolder(): SharedValue<number> {
  let current = 0;
  return { get: () => current, set: (next: number) => { current = next; } } as unknown as SharedValue<number>;
}

export const headerScrollY: SharedValue<number> = typeof makeMutable === 'function'
  ? makeMutable(0)
  // Test doubles of Reanimated may omit makeMutable; a plain holder keeps the same API.
  : plainHolder();

/** Pass to a screen's main vertical scroller, with `scrollEventThrottle={16}`. */
export function onHeaderScroll(event: NativeSyntheticEvent<NativeScrollEvent>): void {
  headerScrollY.set(event.nativeEvent.contentOffset.y);
}

/**
 * Pulling the page down past the top stretches the painting instead of opening a gap
 * of bare ground above it: pinned to the top of the screen, it grows by the pull.
 * Apply with `transformOrigin: 'top center'`.
 */
export function useHeaderStretchStyle(height: number, pinned = false) {
  const reduced = useReducedMotion();
  return useAnimatedStyle(() => {
    const y = headerScrollY.get();
    if (reduced || y >= 0 || height <= 0) return { transform: [{ translateY: 0 }, { scale: 1 }] };
    // In the content it rides down with the pull, so it is pulled back up to the top;
    // pinned over the content (a fixed header) it only grows down to follow it.
    return { transform: [{ translateY: pinned ? 0 : y }, { scale: 1 + -y / height }] };
  });
}
