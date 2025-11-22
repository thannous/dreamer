import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/context/ThemeContext';

interface WaveformProps {
  isActive: boolean;
}

type BarConfig = {
  height: number;
  opacity: number;
  phase: number;
};

// Pre-generate subtle phase offsets so bars don't move in sync
const BARS: BarConfig[] = [
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
].map((bar, index) => ({
  ...bar,
  phase: (index * Math.PI) / 6 + Math.random() * 0.8,
}));

const LOOP_DURATION_MS = 900;

export function Waveform({ isActive }: WaveformProps) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      progress.value = withRepeat(
        withTiming(Math.PI * 2, {
          duration: LOOP_DURATION_MS,
          easing: Easing.linear,
        }),
        -1
      );
    } else {
      progress.value = 0;
    }

    return () => {
      progress.value = 0;
    };
  }, [isActive, progress]);

  return (
    <View style={styles.container}>
      {BARS.map((bar, index) => {
        const isAccent = index % 5 === 2 || index % 5 === 4;
        return (
          <WaveformBar
            key={index}
            bar={bar}
            isAccent={isAccent}
            progress={progress}
            accentColor={colors.accent}
            baseColor={colors.textSecondary}
          />
        );
      })}
    </View>
  );
}

type WaveformBarProps = {
  bar: BarConfig;
  isAccent: boolean;
  progress: SharedValue<number>;
  accentColor: string;
  baseColor: string;
};

function WaveformBar({ bar, isAccent, progress, accentColor, baseColor }: WaveformBarProps) {
  const animatedStyle = useAnimatedStyle(() => {
    // Range ~0.3 -> 1.0 to mimic breathing waveform
    const wave = 0.5 + 0.5 * Math.sin(progress.value + bar.phase);
    const scaleY = 0.3 + wave * 0.7;
    return { transform: [{ scaleY }] };
  });

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          height: bar.height,
          backgroundColor: isAccent ? accentColor : baseColor,
          opacity: bar.opacity,
        },
        animatedStyle,
      ]}
    />
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
