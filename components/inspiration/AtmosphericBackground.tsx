import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import { useTheme } from '@/context/ThemeContext';
import { useScrollPerf } from '@/context/ScrollPerfContext';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { MotiView } from '@/lib/moti';

/**
 * AtmosphericBackground component creates a dreamlike background with:
 * - Animated aurora gradient (theme-aware)
 * - 2-3 floating orbs with blur effects (theme-aware)
 * - Noise overlay for depth
 */
export function AtmosphericBackground() {
  const { width, height } = useWindowDimensions();
  const { mode, colors } = useTheme();
  const [showAnimations, setShowAnimations] = useState(false);
  const isScrolling = useScrollPerf();
  const prefersReducedMotion = usePrefersReducedMotion();
  const reduceEffects = isScrolling || prefersReducedMotion;
  const shouldAnimate = showAnimations && !reduceEffects;

  // Defer animations to avoid layout jank
  useEffect(() => {
    if (prefersReducedMotion) {
      setShowAnimations(false);
      return undefined;
    }
    const timer = setTimeout(() => setShowAnimations(true), 100);
    return () => clearTimeout(timer);
  }, [prefersReducedMotion]);

  const isWeb = Platform.OS === 'web';

  // Theme-aware gradient colors using system theme colors
  // Dark mode: very progressive gradient staying in deep dark tones
  const gradientColors: readonly [string, string, ...string[]] = mode === 'dark'
    ? [
        colors.backgroundDark, // rgb(26, 15, 43) — deepest
        'rgb(30, 20, 48)',     // barely lighter
        'rgb(38, 28, 58)',     // subtle warmth
        'rgb(44, 32, 65)',     // peak — still dark
        'rgb(35, 25, 54)',     // easing back
        'rgb(28, 18, 45)',     // near-deepest
        colors.backgroundDark, // match navbar exactly
      ]
    : [
        colors.backgroundDark, // soft cream (#F8F6F2)
        colors.backgroundCard, // beige sable (#E3DACC)
        colors.backgroundSecondary, // light beige (#EEEBE6)
        colors.backgroundCard, // beige sable
        colors.backgroundDark, // soft cream
      ];

  const gradientLocations: readonly [number, number, ...number[]] = mode === 'dark'
    ? [0, 0.15, 0.35, 0.5, 0.65, 0.85, 1]
    : [0, 0.25, 0.5, 0.75, 1];

  // Theme-aware orb colors - balanced between subtle and visible
  const orb1Color = mode === 'dark' ? `${colors.accent}45` : `${colors.accent}20`;
  const orb2Color = mode === 'dark' ? `${colors.accentLight}38` : `${colors.accentLight}18`;
  const orb3Color = mode === 'dark' ? `${colors.accentDark}30` : `${colors.accentDark}15`;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Aurora Gradient Background - animated cycling of colors */}
      <LinearGradient
        colors={gradientColors}
        locations={gradientLocations}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.3, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Floating Orb 1 - Top Left */}
      <MotiView
        from={{ translateY: 0, translateX: 0, opacity: 0 }}
        animate={
          shouldAnimate
            ? { translateY: [-20, 0, -20], translateX: [-10, 10, -10], opacity: 0.3 }
            : { translateY: 0, translateX: 0, opacity: showAnimations ? 0.3 : 0 }
        }
        transition={
          shouldAnimate
            ? {
                type: 'timing',
                duration: 10000,
                loop: true,
                delay: 0,
              }
            : {
                type: 'timing',
                duration: 0,
              }
        }
        style={[
          styles.orb,
          {
            width: Math.min(width * 0.7, 400),
            height: Math.min(width * 0.7, 400),
            top: -100,
            left: -100,
            backgroundColor: orb1Color,
          },
        ]}
      />

      {/* Floating Orb 2 - Bottom Right */}
      <MotiView
        from={{ translateY: 0, translateX: 0, opacity: 0 }}
        animate={
          shouldAnimate
            ? { translateY: [20, 0, 20], translateX: [10, -10, 10], opacity: 0.25 }
            : { translateY: 0, translateX: 0, opacity: showAnimations ? 0.25 : 0 }
        }
        transition={
          shouldAnimate
            ? {
                type: 'timing',
                duration: 12000,
                loop: true,
                delay: 1000,
              }
            : {
                type: 'timing',
                duration: 0,
              }
        }
        style={[
          styles.orb,
          {
            width: Math.min(width * 0.8, 500),
            height: Math.min(width * 0.8, 500),
            bottom: -150,
            right: -150,
            backgroundColor: orb2Color,
          },
        ]}
      />

      {/* Floating Orb 3 - Middle Right (subtle) */}
      <MotiView
        from={{ translateY: 0, opacity: 0 }}
        animate={
          shouldAnimate
            ? { translateY: [-15, 15, -15], opacity: 0.2 }
            : { translateY: 0, opacity: showAnimations ? 0.2 : 0 }
        }
        transition={
          shouldAnimate
            ? {
                type: 'timing',
                duration: 8000,
                loop: true,
                delay: 2000,
              }
            : {
                type: 'timing',
                duration: 0,
              }
        }
        style={[
          styles.orb,
          {
            width: Math.min(width * 0.6, 350),
            height: Math.min(width * 0.6, 350),
            top: height * 0.4,
            right: -80,
            backgroundColor: orb3Color,
          },
        ]}
      />

      {/* Bottom fade to navbar background — ensures seamless transition */}
      <LinearGradient
        colors={['transparent', colors.backgroundDark]}
        locations={[0, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.bottomFade}
      />

      {/* Noise Overlay for texture depth */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: isWeb ? 'transparent' : `${colors.textPrimary}05`,
            opacity: reduceEffects ? 0.25 : 0.5,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 9999,
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
  },
});
