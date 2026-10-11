import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { DURATION, EASE } from '@/components/motion/motion';
import { PressableScale } from '@/components/motion/PressableScale';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { NoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';

const RADIUS = 22;
/** One pass of light across the button when it arrives. */
const SHIMMER = 1400;
/** The halo's slow breath while the button waits for the reader. */
const BREATH = 2400;

/**
 * The story's page-turn button: moonlight rather than a form control. A sheen
 * lights its top edge, a halo breathes behind it, and one glint crosses it as it
 * arrives. The label is set in the story's serif and names what comes next.
 */
export function StoryButton({ label, onPress, disabled, testID, tokens }: {
  label: string; onPress: () => void; disabled: boolean; testID: string; tokens: NoctaliaDesignTokens;
}) {
  const reduced = useReducedMotion();
  const light = tokens.illustration.text;
  return <View>
    {/* A glow cast by a hidden twin of the button: only its opacity breathes, never the shadow itself. */}
    <Animated.View pointerEvents="none" accessible={false} style={[styles.halo, {
      backgroundColor: tokens.action.primary,
      boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 26, spreadDistance: 1, color: tokens.action.primary }],
    }, reduced || disabled ? { opacity: 0.45 } : {
        animationName: { from: { opacity: 0.3 }, to: { opacity: 0.85 } },
        animationDuration: BREATH,
        animationIterationCount: 'infinite',
        animationDirection: 'alternate',
        animationTimingFunction: EASE.inOut,
      }]} />
    <PressableScale accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} testID={testID}
      style={[styles.button, { backgroundColor: tokens.action.primary }]}>
      <LinearGradient pointerEvents="none" colors={[`${light}66`, `${light}00`]} locations={[0, 0.6]} style={StyleSheet.absoluteFill} />
      {!disabled && !reduced ? <Animated.View pointerEvents="none" accessible={false} style={[styles.shimmer, {
        animationName: {
          from: { transform: [{ translateX: '-120%' }, { skewX: '-20deg' }] },
          to: { transform: [{ translateX: '420%' }, { skewX: '-20deg' }] },
        },
        animationDuration: SHIMMER,
        animationDelay: DURATION.normal,
        animationTimingFunction: EASE.inOut,
        animationFillMode: 'both',
      }]}>
        <LinearGradient colors={[`${light}00`, `${light}8C`, `${light}00`]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill} />
      </Animated.View> : null}
      <Text style={[styles.label, { color: tokens.action.primaryText }]} numberOfLines={2}>{label}</Text>
      <View style={[styles.arrow, { backgroundColor: tokens.action.primaryText }]}>
        <IconSymbol name="arrow.right" size={18} color={tokens.action.primary} />
      </View>
    </PressableScale>
  </View>;
}

const styles = StyleSheet.create({
  halo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: RADIUS },
  button: {
    minHeight: 62, borderRadius: RADIUS, borderCurve: 'continuous', overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingLeft: 22, paddingRight: 12, paddingVertical: 12,
  },
  shimmer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: '24%' },
  label: { flex: 1, minWidth: 0, fontFamily: Fonts.fraunces.medium, fontSize: 19, lineHeight: 25 },
  arrow: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
