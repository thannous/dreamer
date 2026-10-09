import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { EASE } from '@/components/motion/motion';
import type { NoctaliaDesignTokens } from '@/constants/noctaliaDesign';

const SKY = require('@/assets/images/onboarding-reverie-background.webp');
/** A slow camera drift over the painted sky, once per opening. */
const DRIFT = 9000;
/** A shooting star crosses once per page turn. */
const FALL = 1100;

/** Hand-placed in the sheet's open sky, each with its own breath. */
const STARS = [
  { left: '12%', top: '7%', size: 2, period: 2600, delay: 0 },
  { left: '30%', top: '15%', size: 1.5, period: 3400, delay: 700 },
  { left: '47%', top: '5%', size: 2.5, period: 2900, delay: 300 },
  { left: '66%', top: '12%', size: 1.5, period: 3800, delay: 1200 },
  { left: '86%', top: '6%', size: 2, period: 3100, delay: 500 },
  { left: '92%', top: '24%', size: 1.5, period: 4200, delay: 1500 },
  { left: '6%', top: '30%', size: 1.5, period: 3600, delay: 900 },
  { left: '74%', top: '34%', size: 1.5, period: 3300, delay: 400 },
] as const;

/** Each page gets its own path through the sky, so no two turns look alike. */
const PATHS = [
  { left: '8%', top: '6%', dx: 220, dy: 96 },
  { left: '52%', top: '3%', dx: 180, dy: 104 },
  { left: '22%', top: '18%', dx: 240, dy: 88 },
  { left: '60%', top: '12%', dx: 150, dy: 110 },
] as const;

/** A streak of light, head first, that crosses the sky once and fades. */
function ShootingStar({ path, color }: { path: typeof PATHS[number]; color: string }) {
  const angle = `${Math.atan2(path.dy, path.dx) * 180 / Math.PI}deg`;
  return <Animated.View pointerEvents="none" accessible={false} style={[styles.shootingStar, {
    left: path.left, top: path.top,
    animationName: {
      '0%': { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: angle }] },
      '18%': { opacity: 1 },
      '100%': { opacity: 0, transform: [{ translateX: path.dx }, { translateY: path.dy }, { rotate: angle }] },
    },
    animationDuration: FALL,
    animationDelay: 180,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  }]}>
    <LinearGradient colors={[`${color}00`, `${color}E6`]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
  </Animated.View>;
}

/**
 * The night the whole story sheet is told in: the painted sky, its stars, and a
 * veil that deepens toward the button so the words stay legible. It keeps its
 * own night in either theme, like the onboarding behind it.
 */
export function StoryNight({ tokens, page }: { tokens: NoctaliaDesignTokens; page: { key: string; index: number } }) {
  const reduced = useReducedMotion();
  const scrim = tokens.illustration.scrim;
  return <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    <Animated.View style={[StyleSheet.absoluteFill, !reduced && {
      animationName: {
        from: { transform: [{ translateY: -14 }, { scale: 1.12 }] },
        to: { transform: [{ translateY: 0 }, { scale: 1.02 }] },
      },
      animationDuration: DRIFT,
      animationTimingFunction: EASE.out,
      animationFillMode: 'both',
    }]}>
      <Image source={SKY} contentFit="cover" contentPosition="top" style={StyleSheet.absoluteFill} />
    </Animated.View>
    <LinearGradient colors={[tokens.illustration.transparent, scrim, scrim]} locations={[0, 0.62, 1]}
      style={[StyleSheet.absoluteFill, styles.veil]} />
    {STARS.map((star) => <Animated.View key={`${star.left}-${star.top}`} style={[styles.star, {
      left: star.left, top: star.top, width: star.size * 2, height: star.size * 2, borderRadius: star.size,
      backgroundColor: tokens.illustration.text,
    }, !reduced && {
      animationName: { from: { opacity: 0.15 }, to: { opacity: 0.9 } },
      animationDuration: star.period,
      animationDelay: star.delay,
      animationIterationCount: 'infinite',
      animationDirection: 'alternate',
      animationTimingFunction: EASE.inOut,
    }]} />)}
    {/* Remounted on each page turn, so the star falls once per page. */}
    {!reduced ? <ShootingStar key={page.key} path={PATHS[page.index % PATHS.length]} color={tokens.illustration.text} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  veil: { opacity: 0.9 },
  star: { position: 'absolute' },
  shootingStar: { position: 'absolute', width: 72, height: 1.5, borderRadius: 1, overflow: 'hidden', transformOrigin: 'right center' },
});
