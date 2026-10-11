import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

/** Scroll distance over which the veil comes in once the page leaves its resting point. */
const VEIL_FADE = 56;

const transparent = (rgba: string) => rgba.replace(/[\d.]+\)$/, '0)');

/**
 * Dreamer's status bar veil: once the page leaves the top, whatever scrolls under
 * the clock and battery melts into the screen ground instead of running into them.
 * Over night artwork it waits until the page has scrolled past the painting, where
 * the status bar turns dark again.
 */
export function LucidStatusBarVeil({
  scrollY,
  start,
  top,
  ground,
  tint,
}: {
  scrollY: SharedValue<number>;
  /** Scroll offset where the veil starts to come in. */
  start: number;
  top: number;
  /** Screen ground, as a #RRGGBB colour. */
  ground: string;
  /** Top stop of the screen atmosphere laid over the ground, as an rgba() colour. */
  tint: string;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [start, start + VEIL_FADE], [0, 1], Extrapolation.CLAMP),
  }));
  if (top <= 0) return null;
  const height = top + 28;
  const locations = [0, top / height, 1] as const;
  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.veil, { height }, style]}
    >
      <LinearGradient colors={[ground, `${ground}F2`, `${ground}00`]} locations={locations}
        style={StyleSheet.absoluteFill} />
      <LinearGradient colors={[tint, tint, transparent(tint)]} locations={locations}
        style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  veil: { position: 'absolute', top: 0, left: 0, right: 0 },
});
