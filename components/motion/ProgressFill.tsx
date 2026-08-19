import React, { memo, useEffect, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { DURATION, EASING } from './motion';

export type ProgressFillProps = {
  /** 0–100. Values outside the range are clamped. */
  percent: number;
  /**
   * Grow from zero on the first mount. True where the length of the bar is information
   * the reader has not seen yet; false where the bar is already on screen and only the
   * value changes.
   */
  growOnMount?: boolean;
  style?: StyleProp<ViewStyle>;
  className?: string;
  testID?: string;
};

const clamp = (value: number) => Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

/**
 * The fill half of a progress bar, as a value that travels instead of teleporting.
 *
 * Purpose: state indication. A bar that jumps from 40% to 60% shows the new number but
 * never shows that it grew — and on a checklist the growth *is* the reward for the tap.
 *
 * `width`, not `scaleX`: the fill is childless and sits alone inside a clipped track, so
 * the Yoga pass it triggers stops at that node, and the rounded cap survives (a scaled
 * bar smears its own corners). This is the exception the rule allows, not a shortcut.
 *
 * The animation runs on the UI thread and React never re-renders for it. Under "reduce
 * motion" the width is written directly: the number still updates, nothing travels.
 */
export const ProgressFill = memo(function ProgressFill({
  percent,
  growOnMount = true,
  style,
  className,
  testID,
}: ProgressFillProps) {
  const reduced = useReducedMotion();
  const target = clamp(percent);
  const width = useSharedValue(reduced || !growOnMount ? target : 0);
  const mounted = useRef(false);

  useEffect(() => {
    const isFirstRun = !mounted.current;
    mounted.current = true;

    if (reduced || (isFirstRun && !growOnMount)) {
      width.set(target);
      return;
    }

    width.set(withTiming(target, { duration: DURATION.normal, easing: EASING.out }));
  }, [growOnMount, reduced, target, width]);

  const animatedStyle = useAnimatedStyle(() => ({ width: `${width.get()}%` }));

  return <Animated.View className={className} style={[style, animatedStyle]} testID={testID} />;
});
