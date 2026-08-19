import React, { useMemo } from 'react';
import type { ViewProps } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { DURATION, staggerDelay } from './motion';

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
 */
export const Reveal = ({ index = 0, delay = 0, distance = 12, children, ...rest }: RevealProps) => {
  const reduced = useReducedMotion();

  const entering = useMemo(() => {
    const total = staggerDelay(index) + delay;

    if (reduced || distance === 0) {
      return FadeIn.duration(DURATION.normal).delay(total);
    }

    return FadeInDown.duration(DURATION.normal).delay(total).withInitialValues({
      transform: [{ translateY: distance }],
    });
  }, [delay, distance, index, reduced]);

  // Remaining props (`onLayout`, `testID`, `pointerEvents`, `style`, `className`) pass
  // straight through — a caller measuring this subtree must not have to add a wrapper
  // View just to get a layout callback.
  return (
    <Animated.View entering={entering} {...rest}>
      {children}
    </Animated.View>
  );
};
