import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, type ComponentRef, type RefObject } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';

export type BlurTarget = RefObject<ComponentRef<typeof View> | null>;

/**
 * The floating bar's frosted glass, drawn behind its tabs and clipped to its corners.
 * iOS and web blur whatever lies behind. Android blurs only a declared BlurTargetView,
 * and only from Android 12 (API 31); without a target, or on older Android, it keeps a
 * denser tint and no blur so labels stay legible over the content scrolling beneath.
 */
export function TabBarGlass({ borderRadius, blurTarget }: { borderRadius: number; blurTarget?: BlurTarget }) {
  const { colors, mode } = useTheme();
  const { nav } = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const blurs = Platform.OS !== 'android' || (Boolean(blurTarget) && Number(Platform.Version) >= 31);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius, overflow: 'hidden' }]}>
      {blurs ? (
        <BlurView
          intensity={70}
          tint={mode === 'dark' ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
          blurMethod="dimezisBlurViewSdk31Plus"
          blurTarget={blurs ? blurTarget : undefined}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: blurs ? nav.glass.tint : nav.glass.solid }]} />
      <LinearGradient colors={nav.glass.highlight} end={{ x: 0.5, y: 0.6 }} style={StyleSheet.absoluteFill} />
    </View>
  );
}

/** The active tab's lens: a champagne tint with a sheen across its top and a fine rim. */
export function ActiveTabPill({ style }: { style: ViewStyle }) {
  const { colors, mode } = useTheme();
  const { nav } = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  return (
    <View
      pointerEvents="none"
      style={[style, {
        backgroundColor: nav.activePill.fill,
        borderColor: nav.activePill.rim,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
      }]}
    >
      <LinearGradient colors={nav.activePill.sheen} end={{ x: 0.5, y: 0.7 }} style={StyleSheet.absoluteFill} />
    </View>
  );
}
