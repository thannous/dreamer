import React, { useMemo } from 'react';
import { View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type CSSStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EASE } from '@/components/motion/motion';
import { TID } from '@/lib/testIDs';

import { DREAM_STORY } from './dreamStoryMotion';

const GLOW = 220;
const SPARK = 28;
/** Where the saved moment's medallion opens on the next screen, below its navigation. */
const MEDALLION_CENTER_FROM_TOP = 76 + 120;

/**
 * The prologue of the dream story, played on the capture screen once the dream is
 * durably saved: night falls over the draft, its glow condenses into a single star and
 * the star rises to where the saved moment's window will open. It holds touch for its
 * half second so nothing is pressed twice, and is decorative to assistive technology:
 * the next screen announces the save. The caller skips it under reduce motion.
 */
export function DreamCaptureSeal() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const rise = insets.top + MEDALLION_CENTER_FROM_TOP - height / 2;

  const motion = useMemo<Record<'veil' | 'glow' | 'spark', CSSStyle<ViewStyle>>>(() => {
    const base: CSSStyle<ViewStyle> = {
      animationDuration: DREAM_STORY.prologue,
      animationTimingFunction: EASE.out,
      animationFillMode: 'both',
    };
    return {
      veil: {
        ...base,
        animationName: { '0%': { opacity: 0 }, '40%': { opacity: 0.94 }, '100%': { opacity: 0.94 } },
      },
      glow: {
        ...base,
        animationName: {
          '0%': { opacity: 0, transform: [{ scale: 1.6 }] },
          '20%': { opacity: 0.3, transform: [{ scale: 1.2 }] },
          '50%': { opacity: 0, transform: [{ scale: 0.15 }] },
          '100%': { opacity: 0, transform: [{ scale: 0.15 }] },
        },
      },
      spark: {
        ...base,
        animationTimingFunction: EASE.inOut,
        animationName: {
          '0%': { opacity: 0, transform: [{ translateY: 0 }, { scale: 0.6 }] },
          '35%': { opacity: 1, transform: [{ translateY: 0 }, { scale: 1.15 }] },
          '45%': { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
          '100%': { opacity: 1, transform: [{ translateY: rise }, { scale: 1 }] },
        },
      },
    };
  }, [rise]);

  return (
    <View
      testID={TID.Component.DreamCaptureSeal}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      className="absolute inset-0 items-center justify-center"
    >
      <Animated.View className="absolute inset-0 bg-ink" style={motion.veil as StyleProp<ViewStyle>} />
      <Animated.View className="absolute rounded-full bg-champagne"
        style={[{ width: GLOW, height: GLOW }, motion.glow] as StyleProp<ViewStyle>} />
      <Animated.View className="items-center justify-center"
        style={[{ width: SPARK, height: SPARK }, motion.spark] as StyleProp<ViewStyle>}>
        <View className="absolute rounded-full bg-champagne opacity-30" style={{ width: SPARK, height: SPARK }} />
        <View className="h-2.5 w-2.5 rounded-full bg-champagne" />
      </Animated.View>
    </View>
  );
}
