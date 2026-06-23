import { useFocusEffect } from 'expo-router';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { MotiView } from '@/lib/moti';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, Path, RadialGradient, Stop } from 'react-native-svg';

const STAR_COUNT = 2;

const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

function AtmosphereBackgroundComponent() {
  const { colors, mode } = useTheme();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isFocused, setIsFocused] = useState(true);
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  const shouldAnimate = isFocused && !prefersReducedMotion;

  const stars = useMemo(() => Array.from({ length: STAR_COUNT }).map((_, i) => ({
    id: i,
    x: 12 + seededRandom(i + 101) * 76,
    y: 10 + seededRandom(i + 111) * 46,
    size: seededRandom(i + 121) * 1.1 + 0.9,
    delay: seededRandom(i + 131) * 1400,
    blinkDuration: 3400 + seededRandom(i + 141) * 1800,
  })), []);

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        Platform.OS === 'web' ? styles.nonInteractive : styles.nativeNonInteractive,
      ]}
    >
      <Svg height="100%" width="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="captureTopGlow" cx="76%" cy="7%" rx="58%" ry="40%" fx="76%" fy="7%">
            <Stop offset="0%" stopColor={noctalia.atmosphere.veil} stopOpacity={mode === 'dark' ? 0.58 : 0.48} />
            <Stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="captureLowerGlow" cx="50%" cy="78%" rx="72%" ry="36%" fx="50%" fy="78%">
            <Stop offset="0%" stopColor={noctalia.atmosphere.glow} stopOpacity={mode === 'dark' ? 0.045 : 0.07} />
            <Stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx="76" cy="8" rx="58" ry="40" fill="url(#captureTopGlow)" />
        <Ellipse cx="50" cy="80" rx="72" ry="36" fill="url(#captureLowerGlow)" />
        <G opacity={mode === 'dark' ? 0.42 : 0.3}>
          <Circle cx="86" cy="13" r="18" fill="none" stroke={noctalia.atmosphere.orbit} strokeWidth="0.12" />
          <Circle cx="86" cy="13" r="28" fill="none" stroke={noctalia.atmosphere.orbit} strokeWidth="0.08" strokeDasharray="0.7 2.8" />
          <Path
            d="M59 11 C71 6 86 7 97 18"
            fill="none"
            stroke={noctalia.atmosphere.orbit}
            strokeLinecap="round"
            strokeWidth="0.1"
          />
          <Path
            d="M2 73 C20 68 37 70 54 76 C69 82 83 82 98 76"
            fill="none"
            stroke={noctalia.atmosphere.horizon}
            strokeLinecap="round"
            strokeWidth="0.14"
          />
          <Path
            d="M7 80 C28 77 45 81 63 84 C77 87 88 86 98 82"
            fill="none"
            stroke={noctalia.atmosphere.horizon}
            strokeLinecap="round"
            strokeWidth="0.08"
            strokeDasharray="0.6 2"
          />
          <Line
            x1="80"
            x2="90"
            y1="22"
            y2="11"
            stroke={noctalia.atmosphere.orbit}
            strokeLinecap="round"
            strokeWidth="0.08"
          />
        </G>
      </Svg>

      {/* Slow capture glow: a quiet pulse that keeps the capture screen alive without distracting from writing. */}
      <MotiView
        from={{ opacity: 0.035 }}
        animate={shouldAnimate ? { opacity: 0.075 } : { opacity: 0.05 }}
        transition={
          shouldAnimate
            ? {
                type: 'timing',
                duration: 8600,
                loop: true,
                repeatReverse: true,
              }
            : undefined
        }
        style={StyleSheet.absoluteFill}
      >
        <Svg height="100%" width="100%">
          <Defs>
            <RadialGradient id="grad" cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%" gradientUnits="userSpaceOnUse">
              <Stop
                offset="0%"
                stopColor={noctalia.atmosphere.glow}
                stopOpacity={noctalia.atmosphere.glowOpacity * 0.42}
              />
              <Stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx="50%" cy="66%" rx="48%" ry="28%" fill="url(#grad)" />
        </Svg>
      </MotiView>

      {stars.map((s) => (
        <MotiView
          key={`star-${s.id}`}
          from={{ opacity: 0.08, scale: 0.96 }}
          animate={
            shouldAnimate
              ? { opacity: 0.18, scale: 1.03 }
              : { opacity: 0.12, scale: 1 }
          }
          transition={
            shouldAnimate
              ? {
                  type: 'timing',
                  duration: s.blinkDuration,
                  loop: true,
                  repeatReverse: true,
                  delay: s.delay,
                }
              : undefined
          }
          style={[
            styles.star,
            {
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              backgroundColor: noctalia.atmosphere.star,
            }
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  nonInteractive: {
    pointerEvents: 'none',
  } as ViewStyle,
  nativeNonInteractive: {
    pointerEvents: 'none',
  } as ViewStyle,
  star: {
    position: 'absolute',
    borderRadius: 999,
  },
});

export const AtmosphereBackground = memo(AtmosphereBackgroundComponent);
