import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { LucidSpace } from '@/constants/lucidTheme';

export const LUCID_NIGHT_REFLOW_MIN_WIDTH = 380;
export const LUCID_NIGHT_REFLOW_FONT_SCALE = 1.3;

export function shouldUseLucidNightReflow(width: number, fontScale: number) {
  return width < LUCID_NIGHT_REFLOW_MIN_WIDTH || fontScale >= LUCID_NIGHT_REFLOW_FONT_SCALE;
}

/**
 * Neutral night-ritual artwork: open sanctuary, basin and three empty plinths.
 * Selection, copy and controls stay in React Native so the bitmap never bakes state.
 */
export function LucidNightSanctuary({
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
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.hero, reflow && styles.heroReflow]}
    >
      <Image
        accessible={false}
        contentFit="cover"
        contentPosition={{ left: '50%', top: '42%' }}
        source={source}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[`${fadeColor}00`, `${fadeColor}66`, fadeColor]}
        locations={[0.42, 0.72, 1]}
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
