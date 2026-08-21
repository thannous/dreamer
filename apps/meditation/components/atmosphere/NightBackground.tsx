import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { BreathAmplitude } from '@/constants/motion';
import { useBreath } from '@/context/BreathContext';
import { useTheme } from '@/context/ThemeContext';

import { GrainOverlay } from './GrainOverlay';

export type AtmosphereVariant = 'immersive' | 'subtle';

type Props = {
  /** `immersive` for welcome / player / breathing, `subtle` behind lists. */
  variant?: AtmosphereVariant;
};

const STAR_COUNT = 28;

/** Deterministic PRNG — stars must not jump between renders or re-mounts. */
function seededStars(width: number, height: number) {
  let seed = 0x6d5a3b;
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  return Array.from({ length: STAR_COUNT }, () => ({
    cx: next() * width,
    // Stars thin out towards the bottom, where content lives.
    cy: next() * height * 0.72,
    r: 0.6 + next() * 1.3,
    opacity: 0.25 + next() * 0.6,
  }));
}

/**
 * The Noctalia atmosphere: an ink wash, thin gold orbits, a low horizon, star
 * dust and a film of grain. This is what replaces the template's aurora
 * gradients.
 *
 * The halo breathes with the app-wide rhythm. The swing is small on purpose —
 * the screen should feel alive without anyone being able to point at what moved.
 *
 * Purely decorative — never put content or hit targets in here.
 */
export function NightBackground({ variant = 'immersive' }: Props) {
  const { width, height } = useWindowDimensions();
  const { mode, atmosphere } = useTheme();
  const { progress } = useBreath();

  const isSubtle = variant === 'subtle';
  const isDark = mode === 'dark';

  const stars = useMemo(() => seededStars(width, height), [width, height]);

  const orbitOpacity = isSubtle ? (isDark ? 0.24 : 0.14) : isDark ? 0.64 : 0.42;
  const starOpacity = isSubtle ? 0.35 : 1;
  const baseGlow = isSubtle ? atmosphere.glowOpacity * 0.5 : atmosphere.glowOpacity;
  const horizonOpacity = isSubtle ? (isDark ? 0.22 : 0.16) : isDark ? 0.74 : 0.48;

  // The halo lives in its own layer so the breath animates a plain opacity on
  // the UI thread, instead of driving SVG props frame by frame.
  // The range must top out at exactly 1: opacity above 1 is clamped, so any
  // overshoot is spent pinned at full brightness instead of breathing.
  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [1 - BreathAmplitude.halo * 4, 1]),
  }));

  return (
    <View
      // Purely decorative: a screen reader has nothing to say about a gradient,
      // and reading it out would bury the actual content.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { pointerEvents: 'none', zIndex: 0 }]}>
      <LinearGradient
        colors={[...atmosphere.gradient]}
        locations={[...atmosphere.gradientLocations]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[StyleSheet.absoluteFill, haloStyle]}>
        <Svg width={width} height={height}>
          <Defs>
            <RadialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={atmosphere.glow} stopOpacity={baseGlow} />
              <Stop offset="1" stopColor={atmosphere.glow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {/* Halo, high and off-centre — the light source of the whole app. */}
          <Circle cx={width * 0.78} cy={height * 0.14} r={width * 0.55} fill="url(#moonGlow)" />
        </Svg>
      </Animated.View>

      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {/* Orbits: three thin ellipses, never closed on screen. */}
        <Ellipse
          cx={width * 0.5}
          cy={height * 0.3}
          rx={width * 0.62}
          ry={height * 0.22}
          stroke={atmosphere.orbit}
          strokeWidth={1}
          opacity={orbitOpacity}
          fill="none"
        />
        <Ellipse
          cx={width * 0.62}
          cy={height * 0.42}
          rx={width * 0.48}
          ry={height * 0.3}
          stroke={atmosphere.orbit}
          strokeWidth={0.75}
          opacity={orbitOpacity * 0.7}
          fill="none"
        />
        <Ellipse
          cx={width * 0.24}
          cy={height * 0.2}
          rx={width * 0.4}
          ry={height * 0.16}
          stroke={atmosphere.orbit}
          strokeWidth={0.75}
          opacity={orbitOpacity * 0.55}
          fill="none"
        />

        {stars.map((star, index) => (
          <Circle
            key={index}
            cx={star.cx}
            cy={star.cy}
            r={star.r}
            fill={atmosphere.star}
            opacity={star.opacity * starOpacity}
          />
        ))}

        {/* Horizon line, just below the optical centre. */}
        <Path
          d={`M0 ${height * 0.58} Q ${width * 0.5} ${height * 0.545} ${width} ${height * 0.58}`}
          stroke={atmosphere.horizon}
          strokeWidth={1}
          opacity={horizonOpacity}
          fill="none"
        />

        {/* Veil: settles the lower half so text always stays readable. */}
        <Rect
          x={0}
          y={height * 0.55}
          width={width}
          height={height * 0.45}
          fill={atmosphere.veil}
          opacity={isSubtle ? 0.5 : 1}
        />
      </Svg>

      <GrainOverlay />
    </View>
  );
}
