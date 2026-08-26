import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { EASING } from '@/components/motion/motion';
import { getLucidPalette, LucidRadius } from '@/constants/lucidTheme';
import { useTheme } from '@/context/ThemeContext';

type LucidGuideOrbProps = {
  accessibilityLabel: string;
  active?: boolean;
  reduceMotion?: boolean;
  testID?: string;
};

/**
 * The Lucid guide is illustrative, not a control. Its halo only breathes while an
 * exercise is active; the raster stays still so the visual never competes with the
 * question the user is answering.
 */
export function LucidGuideOrb({
  accessibilityLabel,
  active = false,
  reduceMotion = false,
  testID = 'lucid-guide-orb',
}: LucidGuideOrbProps) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const systemReducedMotion = useReducedMotion();
  const shouldReduceMotion = reduceMotion || systemReducedMotion;
  const pulse = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(pulse);

    if (!active || shouldReduceMotion) {
      pulse.set(0);
      return;
    }

    pulse.set(
      withRepeat(
        withTiming(1, { duration: 2400, easing: EASING.inOut }),
        2,
        true
      )
    );

    return () => cancelAnimation(pulse);
  }, [active, pulse, shouldReduceMotion]);

  const haloStyle = useAnimatedStyle(() => {
    const phase = pulse.get();
    return {
      opacity: shouldReduceMotion ? 0.42 : 0.36 + phase * 0.32,
      transform: [{ scale: shouldReduceMotion ? 1 : 0.98 + phase * 0.04 }],
    };
  });

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      testID={testID}
      style={styles.root}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          { borderColor: palette.accent },
          haloStyle,
        ]}
      />
      <Image
        accessible={false}
        resizeMode="contain"
        source={require('../../assets/images/lucid/lucid-guide-orb.png')}
        style={styles.image}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: 260,
    maxWidth: '100%',
    aspectRatio: 1,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: LucidRadius.xl,
    overflow: 'hidden',
  },
  halo: {
    position: 'absolute',
    zIndex: 1,
    width: '46%',
    aspectRatio: 1,
    borderRadius: LucidRadius.full,
    borderWidth: 2,
  },
  image: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.24 }],
  },
});
