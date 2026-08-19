import React, { useMemo } from 'react';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import Animated, { useReducedMotion, type CSSStyle } from 'react-native-reanimated';

import { DURATION, EASE, staggerDelay } from './motion';

export type RevealProps = ViewProps & {
  /**
   * Position in a group of siblings. Each step adds 50 ms, capped at 6 items so a long
   * section never turns its entrance into a loading sequence.
   */
  index?: number;
  /** Extra delay in ms, e.g. to let a screen transition land first. */
  delay?: number;
  /** Distance travelled, in px. Set 0 for a pure fade. */
  distance?: number;
  className?: string;
};

/**
 * Entrance for content that mounts once — a screen's sections, an empty state, a result
 * card. It explains where content came from, which is worth ~300 ms exactly once.
 *
 * Do **not** wrap rows of a FlatList/FlashList in this. Virtualized rows mount and
 * unmount as they recycle, so every scroll replays the entrance. Animate the list
 * container instead, or use `itemLayoutAnimation` for reflow.
 *
 * Under "reduce motion" the translation is dropped and only the fade remains: the state
 * change is still explained, nothing travels.
 *
 * ## Why a CSS animation and not `entering={FadeInDown}`
 *
 * Layout animations are the obvious tool here and they are the wrong one on the web
 * build. Reanimated's web implementation takes the element out of flow for the duration
 * — inline `position: absolute` plus a frozen top/left/width/height — and restores it
 * when the animation ends. On a screen that re-renders while the entrance is still
 * pending (the paywall, whose packages resolve after mount), that restore never lands
 * and the section stays absolutely positioned for good: every staggered block collapses
 * onto the same coordinates. A CSS animation only ever writes `opacity` and `transform`,
 * so there is nothing to restore and nothing to lose. On native both run on the UI
 * thread, so this costs no fidelity.
 *
 * `animationFillMode: 'both'` is what makes the stagger safe: without it the block is
 * fully visible during its delay and then jumps to `opacity: 0` to start animating.
 */
export const Reveal = ({
  index = 0,
  delay = 0,
  distance = 12,
  style,
  children,
  ...rest
}: RevealProps) => {
  const reduced = useReducedMotion();

  const animation = useMemo<CSSStyle>(() => {
    const travels = !reduced && distance !== 0;

    return {
      animationName: {
        from: {
          opacity: 0,
          ...(travels ? { transform: [{ translateY: distance }] } : null),
        },
        to: {
          opacity: 1,
          ...(travels ? { transform: [{ translateY: 0 }] } : null),
        },
      },
      animationDuration: DURATION.normal,
      animationDelay: staggerDelay(index) + delay,
      animationTimingFunction: EASE.out,
      animationFillMode: 'both',
    };
  }, [delay, distance, index, reduced]);

  // Remaining props (`onLayout`, `testID`, `pointerEvents`, `className`) pass straight
  // through — a caller measuring this subtree must not have to add a wrapper View just
  // to get a layout callback.
  return (
    <Animated.View style={[animation, style] as StyleProp<ViewStyle>} {...rest}>
      {children}
    </Animated.View>
  );
};
