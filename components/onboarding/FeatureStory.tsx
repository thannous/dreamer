import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewProps, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion, type CSSStyle } from 'react-native-reanimated';

import { DURATION, EASE } from '@/components/motion/motion';
import type { NoctaliaDesignTokens } from '@/constants/noctaliaDesign';

/** Three told scenes, then the interactive example. */
export const STORY_DEMO_STEP = 3;
const SEGMENTS = STORY_DEMO_STEP + 1;

/**
 * The reader turns the pages. Nothing advances on a timer: readers found the
 * timed scenes too fast, and a story read at one's own pace is the point.
 */
export function useFeatureStory() {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const seek = (next: number) => {
    const target = Math.max(0, Math.min(STORY_DEMO_STEP, next));
    if (target === step) return;
    // One soft tick per page turn, in the same frame as the new slide.
    if (process.env.EXPO_OS !== 'web') void Haptics.selectionAsync();
    setStep(target);
  };
  return {
    step, reduced,
    next: () => seek(step + 1),
  };
}

export type FeatureStoryPlayback = ReturnType<typeof useFeatureStory>;

/**
 * A scene's entrance: a short rise and fade, staggered by `delay` so the title
 * lands before the sentence under it. Reduced motion keeps only the fade.
 */
export function StoryScene({ children, style, delay = 0, ...props }: ViewProps & { delay?: number }) {
  const reduced = useReducedMotion();
  const animation = useMemo<CSSStyle<Pick<ViewStyle, 'opacity' | 'transform'>>>(() => ({
    animationName: {
      from: { opacity: 0, ...(!reduced ? { transform: [{ translateY: 10 }] } : {}) },
      to: { opacity: 1, ...(!reduced ? { transform: [{ translateY: 0 }] } : {}) },
    },
    animationDuration: DURATION.normal,
    animationDelay: reduced ? 0 : delay,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  }), [delay, reduced]);
  return <Animated.View {...props} style={[animation, style]}>{children}</Animated.View>;
}

/** The sentence follows the headline once the word has risen. */
export const HEADLINE_SETTLE = 260;

/**
 * The slide's one word, rising out of a mask as on a keynote slide. Reduced
 * motion keeps only the fade; assistive technology reads it once, whole.
 */
export function Headline({ text, style, lineHeight }: { text: string; style: StyleProp<TextStyle>; lineHeight: number }) {
  const reduced = useReducedMotion();
  return <View accessible accessibilityRole="header" accessibilityLabel={text} accessibilityLiveRegion="polite" style={styles.mask}>
    <Animated.Text accessible={false} maxFontSizeMultiplier={1.4} style={[style, {
      animationName: {
        from: { opacity: 0, ...(!reduced ? { transform: [{ translateY: lineHeight * 0.7 }] } : {}) },
        to: { opacity: 1, ...(!reduced ? { transform: [{ translateY: 0 }] } : {}) },
      },
      animationDuration: DURATION.slow,
      animationTimingFunction: EASE.out,
      animationFillMode: 'both',
    }]}>
      {text}
    </Animated.Text>
  </View>;
}

/** Quiet progress: one small dot per page, the current one a little brighter. */
export function StoryProgress({ step, tokens }: { step: number; tokens: NoctaliaDesignTokens }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.progress}>
    {Array.from({ length: SEGMENTS }, (_, index) => <Animated.View key={index} style={[styles.dot, {
      backgroundColor: index === step ? tokens.text.secondary : tokens.surface.border,
      transitionProperty: 'backgroundColor',
      transitionDuration: DURATION.fast,
      transitionTimingFunction: EASE.out,
    }]} />)}
  </View>;
}

const styles = StyleSheet.create({
  // Clips the rising word so it appears out of a line, not out of thin air.
  mask: { overflow: 'hidden', maxWidth: 340 },
  progress: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
