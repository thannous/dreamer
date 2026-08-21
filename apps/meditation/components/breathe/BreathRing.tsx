import React from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { useTheme } from '@/context/ThemeContext';
import type { AccentPair } from '@/lib/types';

type Props = {
  /** Driven by the engine on the UI thread. */
  scale: SharedValue<number>;
  accent: AccentPair;
  size: number;
};

/**
 * The ring that breathes.
 *
 * Two concentric circles: a soft halo that carries most of the movement, and a
 * thin champagne rule that gives the eye an exact edge to follow. Scaling a
 * plain view rather than animating SVG props keeps this entirely on the UI
 * thread with no per-frame React work.
 */
export function BreathRing({ scale, accent, size }: Props) {
  const { colors } = useTheme();

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
    // The halo lags the rule in weight, not in time: brightest fully inhaled.
    opacity: 0.18 + (scale.get() - 0.55) * 0.5,
  }));

  return (
    <View className="items-center justify-center" style={{ width: size, height: size }}>
      <Animated.View
        style={[
          haloStyle,
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: accent[0],
          },
        ]}
      />
      <Animated.View
        style={[
          ringStyle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 1.5,
            borderColor: colors.accent,
          },
        ]}
      />
    </View>
  );
}
