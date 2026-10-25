import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewProps, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion, type CSSStyle } from 'react-native-reanimated';

import { DURATION, EASE } from '@/components/motion/motion';
import type { NoctaliaDesignTokens } from '@/constants/noctaliaDesign';

/** Three told scenes, then the interactive example. */
export const STORY_DEMO_STEP = 3;
const SEGMENTS = STORY_DEMO_STEP + 1;

/**
 * The reader turns the pages. Nothing advances on a timer: readers found the
 * timed scenes too fast, and a story read at one's own pace is the point.
 * The chapter and its page change together, and a chapter opens on its first page.
 * Pages turn both ways: going back from a chapter's first page reopens the
 * previous chapter's example, the page read just before it.
 */
export function useFeatureStory<Chapter extends string>(chapters: readonly Chapter[], first: Chapter) {
  const [page, setPage] = useState({ chapter: first, step: 0 });
  const index = chapters.indexOf(page.chapter);
  // Back never goes before the earliest chapter the reader entered: opened on Explorer,
  // the stories do not lead back into a chapter they did not choose.
  const [earliest, setEarliest] = useState(chapters.indexOf(first));
  const turn = (chapter: Chapter, step: number) => {
    // One soft tick per page turn, in the same frame as the new slide.
    if (process.env.EXPO_OS !== 'web') void Haptics.selectionAsync();
    setPage({ chapter, step });
  };
  return {
    chapter: page.chapter, step: page.step,
    nextChapter: chapters[index + 1] as Chapter | undefined,
    canGoBack: page.step > 0 || index > earliest,
    next: () => { if (page.step < STORY_DEMO_STEP) turn(page.chapter, page.step + 1); },
    back: () => {
      if (page.step > 0) turn(page.chapter, page.step - 1);
      else if (index > earliest) turn(chapters[index - 1], STORY_DEMO_STEP);
    },
    open: (chapter: Chapter) => {
      setEarliest((current) => Math.min(current, chapters.indexOf(chapter)));
      setPage({ chapter, step: 0 });
    },
  };
}

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
 * motion keeps only the fade; assistive technology reads it once, whole. The
 * view around the word moves, not the text, which would be re-measured each frame.
 */
export function Headline({ text, style, lineHeight }: { text: string; style: StyleProp<TextStyle>; lineHeight: number }) {
  const reduced = useReducedMotion();
  return <View accessible accessibilityRole="header" accessibilityLabel={text} accessibilityLiveRegion="polite" style={styles.mask}>
    <Animated.View accessible={false} style={{
      animationName: {
        from: { opacity: 0, ...(!reduced ? { transform: [{ translateY: lineHeight * 0.7 }] } : {}) },
        to: { opacity: 1, ...(!reduced ? { transform: [{ translateY: 0 }] } : {}) },
      },
      animationDuration: DURATION.slow,
      animationTimingFunction: EASE.out,
      animationFillMode: 'both',
    }}>
      <Text accessible={false} maxFontSizeMultiplier={1.4} style={style}>{text}</Text>
    </Animated.View>
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
