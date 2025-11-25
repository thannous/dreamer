import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { MotiView } from 'moti';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { Dimensions, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

const { height } = Dimensions.get('window');
const PARTICLE_COUNT = 4;
const STAR_COUNT = 5;

function AtmosphereBackgroundComponent() {
  const { mode, colors } = useTheme();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isFocused, setIsFocused] = useState(true);
  const isDark = mode === 'dark';

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  const shouldAnimate = isFocused && !prefersReducedMotion;

  // Particle configuration
  const particles = useMemo(() => Array.from({ length: PARTICLE_COUNT }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    size: Math.random() * 4 + 2,
    duration: Math.random() * 10000 + 4000,
    delay: Math.random() * 2000,
  })), []);

  // Star configuration
  const stars = useMemo(() => Array.from({ length: STAR_COUNT }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 1,
    delay: Math.random() * 1000,
  })), []);

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        Platform.OS === 'web' ? styles.nonInteractive : styles.nativeNonInteractive,
      ]}
    >
      {/* Animated Gradient Background Overlay - subtle movement */}
      <MotiView
        from={{ opacity: 0.3 }}
        animate={shouldAnimate ? { opacity: 0.6 } : { opacity: 0.45 }}
        transition={
          shouldAnimate
            ? {
                type: 'timing',
                duration: 4000,
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
                stopColor={isDark ? '#4c3f6d' : colors.accent}
                stopOpacity={isDark ? 0.4 : 0.25}
              />
              <Stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx="50%" cy="60%" rx="45%" ry="40%" fill="url(#grad)" />
        </Svg>
      </MotiView>

      {/* Floating Particles */}
      {particles.map((p) => (
        <MotiView
          key={`particle-${p.id}`}
          from={{
            translateY: height,
            opacity: 0,
          }}
          animate={
            shouldAnimate
              ? {
                  translateY: -50,
                  opacity: [0, 0.8, 0],
                }
              : {
                  translateY: height * 0.2,
                  opacity: 0.35,
                }
          }
          transition={
            shouldAnimate
              ? {
                  type: 'timing',
                  duration: p.duration,
                  loop: true,
                  delay: p.delay,
                  repeatReverse: false,
                }
              : undefined
          }
          style={[
            styles.particle,
            {
              left: `${p.x}%`,
              width: p.size,
              height: p.size,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(212, 165, 116, 0.4)',
            }
          ]}
        />
      ))}

      {/* Twinkling Stars */}
      {stars.map((s) => (
        <MotiView
          key={`star-${s.id}`}
          from={{ opacity: 0.2, scale: 0.85 }}
          animate={
            shouldAnimate
              ? { opacity: 1, scale: 1.2 }
              : { opacity: 0.8, scale: 1 }
          }
          transition={
            shouldAnimate
              ? {
                  type: 'timing',
                  duration: 1000 + Math.random() * 1000,
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
              backgroundColor: isDark ? '#FFF' : 'rgba(212, 165, 116, 0.6)',
            }
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cloud: {
    position: 'absolute',
    // Note: blurRadius is an Image prop, for Views we can't easily blur without Expo Blur.
    // We rely on opacity and soft shapes.
  },
  nonInteractive: {
    pointerEvents: 'none',
  } as ViewStyle,
  nativeNonInteractive: {
    pointerEvents: 'none',
  } as ViewStyle,
  particle: {
    position: 'absolute',
    borderRadius: 999,
  },
  star: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#FFF',
  },
});

export const AtmosphereBackground = memo(AtmosphereBackgroundComponent);
