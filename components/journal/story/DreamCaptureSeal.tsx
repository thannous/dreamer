import React, { useMemo } from 'react';
import { Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type CSSStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { EASE } from '@/components/motion/motion';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { TID } from '@/lib/testIDs';

import { DREAM_STORY } from './dreamStoryMotion';

const GLOW = 280;
const SPARK = 28;
/** Where the saved moment's medallion opens on the next screen, below its navigation. */
const MEDALLION_CENTER_FROM_TOP = 76 + 120;
const WORDS = 180;

const excerpt = (text: string) => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > WORDS ? `${flat.slice(0, WORDS - 1).trimEnd()}…` : flat;
};

/**
 * The prologue of the dream story, played on the capture screen once the dream is
 * durably saved: night falls over the draft, the dream's own words gather into a soft
 * glow, the glow condenses into a single star and the star rises to where the saved
 * moment's window will open. The glow is a radial light with no edge, so it reads as
 * light on the night ground and as a warm haze on the paper ground. It holds touch for
 * its moment so nothing is pressed twice, and is decorative to assistive technology:
 * the next screen announces the save. The caller skips it under reduce motion.
 */
export function DreamCaptureSeal({ text }: { text: string }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors, mode } = useTheme();
  const light = getNoctaliaDesignTokens(colors, mode).accent.base;
  const rise = insets.top + MEDALLION_CENTER_FROM_TOP - height / 2;
  const words = useMemo(() => excerpt(text), [text]);

  const motion = useMemo<Record<'veil' | 'words' | 'glow' | 'spark', CSSStyle<ViewStyle>>>(() => {
    const base: CSSStyle<ViewStyle> = {
      animationDuration: DREAM_STORY.prologue,
      animationTimingFunction: EASE.out,
      animationFillMode: 'both',
    };
    return {
      veil: {
        ...base,
        animationName: { '0%': { opacity: 0 }, '22%': { opacity: 0.96 }, '100%': { opacity: 0.96 } },
      },
      words: {
        ...base,
        animationTimingFunction: EASE.inOut,
        animationName: {
          '0%': { opacity: 0, transform: [{ scale: 1 }] },
          '16%': { opacity: 1, transform: [{ scale: 1 }] },
          '30%': { opacity: 1, transform: [{ scale: 1 }] },
          '56%': { opacity: 0, transform: [{ scale: 0.2 }] },
          '100%': { opacity: 0, transform: [{ scale: 0.2 }] },
        },
      },
      glow: {
        ...base,
        animationTimingFunction: EASE.inOut,
        animationName: {
          '0%': { opacity: 0, transform: [{ scale: 1.3 }] },
          '34%': { opacity: 0.9, transform: [{ scale: 1 }] },
          '58%': { opacity: 0, transform: [{ scale: 0.12 }] },
          '100%': { opacity: 0, transform: [{ scale: 0.12 }] },
        },
      },
      spark: {
        ...base,
        animationTimingFunction: EASE.inOut,
        animationName: {
          '0%': { opacity: 0, transform: [{ translateY: 0 }, { scale: 0.6 }] },
          '46%': { opacity: 0, transform: [{ translateY: 0 }, { scale: 0.6 }] },
          '56%': { opacity: 1, transform: [{ translateY: 0 }, { scale: 1.15 }] },
          '62%': { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
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
      <Animated.View className="absolute" style={[{ width: GLOW, height: GLOW }, motion.glow] as StyleProp<ViewStyle>}>
        <Svg width={GLOW} height={GLOW}>
          <Defs>
            <RadialGradient id="seal-glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={light} stopOpacity={0.5} />
              <Stop offset="0.45" stopColor={light} stopOpacity={0.18} />
              <Stop offset="1" stopColor={light} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill="url(#seal-glow)" />
        </Svg>
      </Animated.View>
      <Animated.View className="absolute px-10" style={motion.words as StyleProp<ViewStyle>}>
        <Text numberOfLines={5} className="text-center font-serif text-[18px] leading-7 text-ivory">{words}</Text>
      </Animated.View>
      <Animated.View className="items-center justify-center"
        style={[{ width: SPARK, height: SPARK }, motion.spark] as StyleProp<ViewStyle>}>
        <View className="absolute rounded-full bg-champagne opacity-30" style={{ width: SPARK, height: SPARK }} />
        <View className="h-2.5 w-2.5 rounded-full bg-champagne" />
      </Animated.View>
    </View>
  );
}
