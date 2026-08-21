import React from 'react';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';

import { BreathAmplitude } from '@/constants/motion';
import { useBreath } from '@/context/BreathContext';

/**
 * The champagne stripe on featured cards, brightening and dimming with the
 * app-wide breath. Same rhythm as the halo, so the card and the sky agree.
 */
export function BreathingStripe({ className }: { className?: string }) {
  const { progress } = useBreath();

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 1],
      [0.95 - BreathAmplitude.stripe, 0.95]
    ),
  }));

  return (
    <Animated.View
      style={style}
      className={`h-[2.5px] w-full bg-champagne ${className ?? ''}`}
    />
  );
}
