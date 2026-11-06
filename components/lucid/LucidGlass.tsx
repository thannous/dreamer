import React, { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { TabBarGlass } from '@/components/navigation/TabBarGlass';
import { LucidRadius } from '@/constants/lucidTheme';
import { getNoctaliaPalette } from '@/constants/noctaliaPalette';
import { useTheme } from '@/context/ThemeContext';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

/** Noctalia's floating glass, shared by Lucid's navigation and compact chrome. */
export function LucidGlass({ children, style, radius = LucidRadius.xl, pointerEvents, testID }: {
  children?: ReactNode;
  style?: ViewStyle;
  radius?: number;
  pointerEvents?: 'auto' | 'none' | 'box-none';
  testID?: string;
}) {
  const { mode } = useTheme();
  const palette = getNoctaliaPalette(mode);
  const reduceEffects = usePrefersReducedMotion();
  return (
    <View pointerEvents={pointerEvents} testID={testID} style={[
      styles.root,
      { borderRadius: radius, borderColor: palette.navGlass.rim },
      style,
    ]}>
      {reduceEffects
        ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: palette.raised }]} />
        : <TabBarGlass borderRadius={radius} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});
