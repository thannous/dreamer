import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { LucidSpace } from '@/constants/lucidTheme';

export const LUCID_PROGRESS_REFLOW_MIN_WIDTH = 380;
export const LUCID_PROGRESS_REFLOW_FONT_SCALE = 1.3;

export function shouldUseLucidProgressReflow(width: number, fontScale: number) {
  return width < LUCID_PROGRESS_REFLOW_MIN_WIDTH || fontScale >= LUCID_PROGRESS_REFLOW_FONT_SCALE;
}

/**
 * Neutral celestial path. Stars, labels and selected method live in React Native
 * so the raster never encodes a statistic or a leader.
 */
export function LucidProgressConstellation({
  fadeColor,
  reflow,
  source,
  children,
}: {
  fadeColor: string;
  reflow: boolean;
  source: number;
  children?: ReactNode;
}) {
  return (
    <View pointerEvents="box-none" style={[styles.hero, reflow && styles.heroReflow]}>
      <Image
        accessibilityElementsHidden
        accessible={false}
        contentFit="cover"
        contentPosition={{ left: '50%', top: '38%' }}
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        source={source}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[`${fadeColor}00`, `${fadeColor}55`, fadeColor]}
        locations={[0.46, 0.74, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    aspectRatio: 0.92,
    overflow: 'hidden',
  },
  heroReflow: {
    aspectRatio: 1.18,
    marginBottom: LucidSpace.sm,
  },
});
