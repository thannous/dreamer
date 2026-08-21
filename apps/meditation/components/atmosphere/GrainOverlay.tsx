import React from 'react';
import { Image, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/context/ThemeContext';

const GRAIN = require('@/assets/images/grain.png');

type Props = {
  /** Override the default per-theme opacity. Keep it under 0.05. */
  opacity?: number;
  style?: ViewStyle;
};

/**
 * A film of grain over the glass.
 *
 * Frosted glass on its own reads as a stock system material. The grain is what
 * turns it into moonlight through mist — and it suits a palette of champagne on
 * ink, which is a paper-and-film palette, not a plastic one.
 *
 * Tiled 96px greyscale noise, never above 4% opacity: felt as texture, never
 * seen as pattern. Costs one repeated bitmap, no blur, no shader.
 */
export function GrainOverlay({ opacity, style }: Props) {
  const { mode } = useTheme();
  const resolved = opacity ?? (mode === 'dark' ? 0.035 : 0.022);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        StyleSheet.absoluteFill,
        { opacity: resolved, zIndex: 0, pointerEvents: 'none' },
        style,
      ]}>
      <Image source={GRAIN} resizeMode="repeat" style={StyleSheet.absoluteFill} />
    </View>
  );
}
