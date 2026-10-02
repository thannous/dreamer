import React, { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, AppState, Platform, StyleSheet, Text, View, type ViewProps, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion, type CSSStyle } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion/PressableScale';
import { DURATION, EASE } from '@/components/motion/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { NoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';

const SCENE_DURATION = 2400;
export const STORY_DEMO_STEP = 3;

/** One pass, then a free example. Timers change scenes, never animation frames. */
export function useFeatureStory() {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(!reduced);
  const [readerReady, setReaderReady] = useState(Platform.OS === 'web');
  const [screenReader, setScreenReader] = useState(false);
  const canPlay = !reduced && readerReady && !screenReader;

  useEffect(() => {
    let mounted = true;
    const updateReader = (enabled: boolean) => {
      if (!mounted) return;
      setScreenReader(enabled);
      setReaderReady(true);
      if (enabled) setPlaying(false);
    };
    // RN Web hardcodes isScreenReaderEnabled() to true; detection is native-only.
    if (Platform.OS !== 'web') {
      void AccessibilityInfo.isScreenReaderEnabled().then(updateReader, () => updateReader(true));
    }
    const reader = Platform.OS === 'web' ? null : AccessibilityInfo.addEventListener('screenReaderChanged', updateReader);
    const background = AppState.addEventListener('change', (state) => {
      if (state !== 'active') setPlaying(false);
    });
    return () => { mounted = false; reader?.remove(); background.remove(); };
  }, []);

  useEffect(() => {
    if (!playing || !canPlay || step === STORY_DEMO_STEP) return;
    const timer = setTimeout(() => {
      setStep(step + 1);
      if (step + 1 === STORY_DEMO_STEP) setPlaying(false);
    }, SCENE_DURATION);
    return () => clearTimeout(timer);
  }, [canPlay, playing, step]);

  const stop = () => setPlaying(false);
  const seek = (next: number) => {
    setPlaying(false);
    setStep(Math.max(0, Math.min(STORY_DEMO_STEP, next)));
  };

  return {
    step, playing: playing && canPlay, canPlay, reduced, stop,
    next: () => seek(step + 1), previous: () => seek(step - 1),
    skip: () => seek(STORY_DEMO_STEP),
    replay: () => { setStep(0); setPlaying(canPlay); },
    toggle: () => { if (canPlay) setPlaying((value) => !value); },
  };
}

export type FeatureStoryPlayback = ReturnType<typeof useFeatureStory>;

/** The entrance stays on the UI runtime; reduced motion retains only the fade. */
export function StoryScene({ children, style, ...props }: ViewProps) {
  const reduced = useReducedMotion();
  const animation = useMemo<CSSStyle<ViewStyle>>(() => ({
    animationName: {
      from: { opacity: 0, ...(!reduced ? { transform: [{ translateY: 12 }] } : {}) },
      to: { opacity: 1, ...(!reduced ? { transform: [{ translateY: 0 }] } : {}) },
    },
    animationDuration: DURATION.fast,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  }), [reduced]);
  return <Animated.View {...props} style={[animation, style]}>{children}</Animated.View>;
}

export function FeatureStoryControls({ story, tokens }: { story: FeatureStoryPlayback; tokens: NoctaliaDesignTokens }) {
  const { t } = useTranslation();
  const demo = story.step === STORY_DEMO_STEP;
  return <View style={styles.controls}>
    <View accessible={false} style={styles.progress}>
      {[0, 1, 2].map((index) => <View key={index} style={[styles.segment, {
        backgroundColor: index <= story.step ? tokens.accent.text : tokens.surface.border,
      }]} />)}
    </View>
    <View style={styles.actions}>
      <PressableScale accessibilityRole="button" accessibilityLabel={t('onboarding.story.previous')} disabled={story.step === 0} onPress={story.previous} style={styles.icon} testID="btn.onboarding.story.previous">
        <IconSymbol name="chevron.left" size={18} color={story.step === 0 ? tokens.text.tertiary : tokens.accent.text} />
      </PressableScale>
      <PressableScale accessibilityRole="button"
        accessibilityLabel={t(demo ? 'onboarding.story.replay' : story.playing ? 'onboarding.story.pause' : 'onboarding.story.play')}
        disabled={!demo && !story.canPlay} onPress={demo ? story.replay : story.toggle} style={styles.icon}
        testID={demo ? 'btn.onboarding.story.replay' : 'btn.onboarding.story.play'}>
        <IconSymbol name={demo ? 'arrow.clockwise' : story.playing ? 'pause.fill' : 'play.fill'} size={18} color={tokens.accent.text} />
      </PressableScale>
      <PressableScale accessibilityRole="button" accessibilityLabel={t('onboarding.story.next')} disabled={demo} onPress={story.next} style={styles.icon} testID="btn.onboarding.story.next">
        <IconSymbol name="chevron.right" size={18} color={demo ? tokens.text.tertiary : tokens.accent.text} />
      </PressableScale>
      {demo ? <Text style={[styles.skip, styles.label, { color: tokens.text.secondary }]}>{t('onboarding.feature.example')}</Text> :
        <PressableScale accessibilityRole="button" onPress={story.skip} style={styles.skip} testID="btn.onboarding.story.skip">
          <Text style={[styles.label, { color: tokens.accent.text }]}>{t('onboarding.story.skip')}</Text>
        </PressableScale>}

    </View>
  </View>;
}

const styles = StyleSheet.create({
  controls: { paddingTop: 4, paddingBottom: 8 },
  progress: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 2, borderRadius: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  icon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  skip: { flex: 1, minHeight: 48, justifyContent: 'center', alignItems: 'flex-end', paddingLeft: 8 },
  label: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 12, lineHeight: 18 },
});
