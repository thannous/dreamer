import React from 'react';
import Animated, { cubicBezier } from 'react-native-reanimated';

import { Duration } from '@/constants/motion';
import { useSilence } from '@/context/SilenceContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useScreenReader } from '@/hooks/useScreenReader';

type Props = React.PropsWithChildren<{
  className?: string;
}>;

const chromeEase = cubicBezier(0.32, 0.72, 0, 1);

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

  return (
    <Animated.View
      className={className}
      style={{
        opacity: controlsVisible ? 1 : 0,
        pointerEvents: controlsVisible ? 'auto' : 'none',
        transitionProperty: 'opacity',
        transitionDuration: reducedMotion ? Duration.fast : Duration.slow,
        transitionTimingFunction: chromeEase,
      }}
      accessibilityElementsHidden={!controlsVisible}
      importantForAccessibility={controlsVisible ? 'auto' : 'no-hide-descendants'}>
      {children}
    </Animated.View>
  );
}
