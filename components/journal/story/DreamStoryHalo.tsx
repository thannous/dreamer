import React, { useEffect, useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type CSSStyle } from 'react-native-reanimated';

import { EASE } from '@/components/motion/motion';
import { TID } from '@/lib/testIDs';

import { DREAM_STORY } from './dreamStoryMotion';

/**
 * The epilogue: back in the journal, the card of the dream just told glows once, in and
 * out, so the reader sees where it now lives. Drawn over the card as a ring and a faint
 * wash, so its artwork cannot hide it, and never intercepting a touch. A fade only, so
 * it also plays under reduce motion; decorative, so assistive technology ignores it.
 */
export function DreamStoryHalo({ onDone }: { onDone?: () => void }) {
  useEffect(() => {
    if (!onDone) return;
    const timer = setTimeout(onDone, DREAM_STORY.epilogueHalo);
    return () => clearTimeout(timer);
  }, [onDone]);
  const glow = useMemo<CSSStyle<ViewStyle>>(() => ({
    animationName: {
      '0%': { opacity: 0 },
      '35%': { opacity: 1 },
      '100%': { opacity: 0 },
    },
    animationDuration: DREAM_STORY.epilogueHalo,
    animationTimingFunction: EASE.inOut,
    animationFillMode: 'both',
  }), []);

  return (
    <Animated.View
      testID={TID.Component.DreamStoryHalo}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      className="absolute -bottom-2 -left-2 -right-2 -top-1"
      style={glow as StyleProp<ViewStyle>}
    >
      <View className="absolute inset-0 rounded-xl bg-champagne opacity-10" />
      <View className="absolute inset-0 rounded-xl border border-champagne" />
    </Animated.View>
  );
}
