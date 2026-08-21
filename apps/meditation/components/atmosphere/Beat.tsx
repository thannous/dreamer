import React, { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { Curve, Duration, StaggerDelayMs } from '@/constants/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type Props = React.PropsWithChildren<{
  /** Position in the sequence; the delay is `rank × StaggerDelayMs`. */
  rank: number;
  className?: string;
}>;

/**
 * One beat of a staggered entrance.
 *
 * Driven by a shared value rather than Reanimated's `FadeIn`: the layout
 * entering animations do not settle here and strand the content at opacity 0 —
 * which is how the welcome screen ended up blank. Same rule as the mini player
 * (AGENTS.md 10), and the same fix.
 *
 * Under reduced motion the delays go too: the screen arrives whole and at once
 * rather than slowly.
 */
export function Beat({ rank, className, children }: Props) {
  const reducedMotion = useReducedMotion();
  const appear = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      appear.set(1);
      return;
    }

    appear.set(
      withDelay(
        rank * StaggerDelayMs,
        withTiming(1, { duration: Duration.slow, easing: Curve.enter })
      )
    );
  }, [appear, rank, reducedMotion]);

  const style = useAnimatedStyle(() => ({ opacity: appear.get() }));

  return (
    <Animated.View style={style} className={className}>
      {children}
    </Animated.View>
  );
}
