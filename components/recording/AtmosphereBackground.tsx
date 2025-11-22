import { useTheme } from '@/context/ThemeContext';
import { MotiView } from 'moti';
import React, { useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

const { height } = Dimensions.get('window');

export function AtmosphereBackground() {
  const { mode } = useTheme();
  const isDark = mode === 'dark';

  // Particle configuration
  const particles = useMemo(() => Array.from({ length: 15 }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    size: Math.random() * 4 + 2,
    duration: Math.random() * 10000 + 4000,
    delay: Math.random() * 2000,
  })), []);

  // Star configuration
  const stars = useMemo(() => Array.from({ length: 20 }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 1,
    delay: Math.random() * 1000,
  })), []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Animated Gradient Background Overlay - subtle movement */}
      <MotiView
        from={{ opacity: 0.3 }}
        animate={{ opacity: 0.6 }}
        transition={{
          type: 'timing',
          duration: 4000,
          loop: true,
          repeatReverse: true,
        }}
        style={StyleSheet.absoluteFill}
      >
        <Svg height="100%" width="100%">
          <Defs>
            <RadialGradient id="grad" cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%" gradientUnits="userSpaceOnUse">
              <Stop offset="0%" stopColor={isDark ? '#4c3f6d' : '#e0d4fc'} stopOpacity="0.4" />
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
          animate={{
            translateY: -50,
            opacity: [0, 0.8, 0],
          }}
          transition={{
            type: 'timing',
            duration: p.duration,
            loop: true,
            delay: p.delay,
            repeatReverse: false,
          }}
          style={[
            styles.particle,
            {
              left: `${p.x}%`,
              width: p.size,
              height: p.size,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.6)',
            }
          ]}
        />
      ))}

      {/* Twinkling Stars */}
      {isDark && stars.map((s) => (
        <MotiView
          key={`star-${s.id}`}
          from={{ opacity: 0.2, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1.2 }}
          transition={{
            type: 'timing',
            duration: 1000 + Math.random() * 1000,
            loop: true,
            repeatReverse: true,
            delay: s.delay,
          }}
          style={[
            styles.star,
            {
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
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
