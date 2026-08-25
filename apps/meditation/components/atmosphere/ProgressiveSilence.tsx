import React from 'react';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Curve, Duration } from '@/constants/motion';
import { useSilence } from '@/context/SilenceContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useScreenReader } from '@/hooks/useScreenReader';

type Props = React.PropsWithChildren<{
  className?: string;
}>;

/**
 * Fades one piece of chrome in and out with the screen's silence.
 *
 * It holds no state and no timer: the schedule and the touch that ends it live
 * in `SilenceProvider`, so every piece of chrome on a screen withdraws and
 * returns together. Wrap this around chrome, never around content.
 *
 * Anything wrapped must be non-essential while hidden: hidden chrome stops
 * receiving touches and leaves the accessibility tree, so the touch that
 * restores it cannot also trigger it.
 */
export function ProgressiveSilence({ children, className }: Props) {
  const reducedMotion = useReducedMotion();
  const screenReader = useScreenReader();
  const { visible } = useSilence();
  const controlsVisible = visible || screenReader;

  const style = useAnimatedStyle(() => ({
    opacity: withTiming(controlsVisible ? 1 : 0, {
      duration: reducedMotion ? Duration.fast : Duration.slow,
      easing: Curve.standard,
    }),
  }));

  return (
    <Animated.View
      className={className}
      style={[style, { pointerEvents: controlsVisible ? 'auto' : 'none' }]}
      accessibilityElementsHidden={!controlsVisible}
      importantForAccessibility={controlsVisible ? 'auto' : 'no-hide-descendants'}>
      {children}
    </Animated.View>
  );
}
