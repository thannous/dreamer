import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type ViewProps, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion, type CSSStyle } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion/PressableScale';
import { DURATION, EASE } from '@/components/motion/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { NoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';

export const STORY_DEMO_STEP = 3;

/** Reading stays at the user's pace; only the artwork and entrances animate. */
export function useFeatureStory() {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  return {
    step, reduced,
    next: () => setStep((current) => Math.min(STORY_DEMO_STEP, current + 1)),
    previous: () => setStep((current) => Math.max(0, current - 1)),
    skip: () => setStep(STORY_DEMO_STEP),
    replay: () => setStep(0),
  };
}

export type FeatureStoryPlayback = ReturnType<typeof useFeatureStory>;

/** A brief entrance, with the same reading order and opacity-only reduced motion. */
export function StoryScene({ children, style, ...props }: ViewProps) {
  const reduced = useReducedMotion();
  const animation = useMemo<CSSStyle<Pick<ViewStyle, 'opacity' | 'transform'>>>(() => ({
    animationName: {
      from: { opacity: 0, ...(!reduced ? { transform: [{ translateY: 8 }] } : {}) },
      to: { opacity: 1, ...(!reduced ? { transform: [{ translateY: 0 }] } : {}) },
    },
    animationDuration: DURATION.fast,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  }), [reduced]);
  return <Animated.View {...props} style={[animation, style]}>{children}</Animated.View>;
}

function StoryProgress({ active, complete, color, track }: {
  active: boolean; complete: boolean; color: string; track: string;
}) {
  return <View style={[styles.segment, { backgroundColor: active || complete ? color : track }]} />;
}

export function FeatureStoryControls({ story, tokens, showSkip = true, endLabel }: {
  story: FeatureStoryPlayback; tokens: NoctaliaDesignTokens; showSkip?: boolean; endLabel?: string;
}) {
  const { t } = useTranslation();
  const demo = story.step === STORY_DEMO_STEP;
  return <View style={styles.controls}>
    <View accessible={false} style={styles.progress}>
      {[0, 1, 2].map((index) => <StoryProgress key={index} active={index === story.step} complete={index < story.step}
        color={tokens.accent.text} track={tokens.surface.border} />)}
    </View>
    <View style={styles.actions}>
      <PressableScale accessibilityRole="button" accessibilityLabel={t('onboarding.story.previous')} disabled={story.step === 0} onPress={story.previous} style={styles.icon} testID="btn.onboarding.story.previous">
        <IconSymbol name="chevron.left" size={17} color={story.step === 0 ? tokens.text.tertiary : tokens.text.secondary} />
      </PressableScale>
      {demo ? <PressableScale accessibilityRole="button" accessibilityLabel={t('onboarding.story.replay')}
        onPress={story.replay} style={styles.icon} testID="btn.onboarding.story.replay">
        <IconSymbol name="arrow.clockwise" size={16} color={tokens.text.secondary} />
      </PressableScale> : null}
      {demo ? <Text style={[styles.skip, styles.label, { color: tokens.text.tertiary }]}>{endLabel ?? t('onboarding.feature.example')}</Text> : showSkip ?
        <PressableScale accessibilityRole="button" onPress={story.skip} style={styles.skip} testID="btn.onboarding.story.skip">
          <Text style={[styles.label, { color: tokens.text.secondary }]}>{t('onboarding.story.skip')}</Text>
        </PressableScale> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  controls: { paddingTop: 8, paddingBottom: 0 },
  progress: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1, height: 2, borderRadius: 1, overflow: 'hidden' },
  actions: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  skip: { flex: 1, minHeight: 48, justifyContent: 'center', alignItems: 'flex-end', paddingLeft: 8 },
  label: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 11, lineHeight: 17 },
});
