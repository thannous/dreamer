import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { SurrealTheme } from '@/constants/theme';

interface WaveformProps {
  isActive: boolean;
}

const BARS = [
  { height: 20, opacity: 0.5 },
  { height: 36, opacity: 0.7 },
  { height: 56, opacity: 1 },
  { height: 28, opacity: 0.6 },
  { height: 48, opacity: 0.8 },
  { height: 20, opacity: 0.5 },
  { height: 36, opacity: 0.7 },
  { height: 56, opacity: 1 },
  { height: 28, opacity: 0.6 },
  { height: 48, opacity: 0.8 },
  { height: 20, opacity: 0.5 },
  { height: 36, opacity: 0.7 },
  { height: 56, opacity: 1 },
  { height: 28, opacity: 0.6 },
  { height: 48, opacity: 0.8 },
  { height: 20, opacity: 0.5 },
  { height: 36, opacity: 0.7 },
  { height: 56, opacity: 1 },
];

export function Waveform({ isActive }: WaveformProps) {
  const animations = useRef(
    BARS.map(() => new Animated.Value(1))
  ).current;

  useEffect(() => {
    if (isActive) {
      // Animate each bar with different timing
      const animatedBars = animations.map((anim, index) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 0.3 + Math.random() * 0.7,
              duration: 300 + Math.random() * 400,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 1,
              duration: 300 + Math.random() * 400,
              useNativeDriver: true,
            }),
          ])
        )
      );

      animatedBars.forEach((animation, index) => {
        setTimeout(() => animation.start(), index * 50);
      });

      return () => {
        animatedBars.forEach(animation => animation.stop());
      };
    } else {
      // Reset all bars to default state
      animations.forEach(anim => anim.setValue(1));
    }
  }, [isActive, animations]);

  return (
    <View style={styles.container}>
      {BARS.map((bar, index) => {
        const isAccent = index % 5 === 2 || index % 5 === 4;
        return (
          <Animated.View
            key={index}
            style={[
              styles.bar,
              {
                height: bar.height,
                backgroundColor: isAccent
                  ? SurrealTheme.accent
                  : SurrealTheme.textMuted,
                opacity: bar.opacity,
                transform: [{ scaleY: animations[index] }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  bar: {
    width: 4,
    borderRadius: 2,
  },
});
