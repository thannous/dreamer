import React, { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, AppState, Platform, StyleSheet, Text, View, type ViewProps, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type CSSStyle, type SharedValue } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion/PressableScale';
import { DURATION, EASE } from '@/components/motion/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { NoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';

const SCENE_DURATIONS = {
  capture: [3200, 3800, 3400],
  captureTransition: [3000, 3600, 3600],
  connect: [3000, 3400, 3800],
  explore: [3000, 3800, 3600],
} as const;
export const STORY_DEMO_STEP = 3;

/** One timer per scene; the continuous progress runs on the UI runtime. */
export function useFeatureStory(feature: keyof typeof SCENE_DURATIONS) {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(!reduced);
  const [readerReady, setReaderReady] = useState(Platform.OS === 'web');
  const [screenReader, setScreenReader] = useState(false);
  const progress = useSharedValue(0);
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
    const duration = SCENE_DURATIONS[feature][step];
    // Pausing freezes this value; resuming spends only the remaining scene time.
    const remaining = duration * (1 - progress.get());
    progress.set(withTiming(1, { duration: remaining, easing: Easing.linear }));
    const timer = setTimeout(() => {
      progress.set(0);
      setStep(step + 1);
      if (step + 1 === STORY_DEMO_STEP) setPlaying(false);
    }, remaining);
    return () => { clearTimeout(timer); cancelAnimation(progress); };
  }, [canPlay, feature, playing, progress, step]);

  const stop = () => setPlaying(false);
  const seek = (next: number) => {
    setPlaying(false);
    progress.set(0);
    setStep(Math.max(0, Math.min(STORY_DEMO_STEP, next)));
  };

  return {
    step, playing: playing && canPlay, canPlay, reduced, progress, stop,
    next: () => seek(step + 1), previous: () => seek(step - 1),
    skip: () => seek(STORY_DEMO_STEP),
    replay: () => { progress.set(0); setStep(0); setPlaying(canPlay); },
    toggle: () => { if (canPlay) setPlaying((value) => !value); },
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

function StoryProgress({ active, complete, progress, reduced, color, track }: {
  active: boolean; complete: boolean; progress: SharedValue<number>; reduced: boolean; color: string; track: string;
}) {
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: complete || (active && reduced) ? 1 : active ? progress.get() : 0 }],
  }));
  return <View style={[styles.segment, { backgroundColor: track }]}>
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: color, transformOrigin: 'left center' }, fillStyle]} />
  </View>;
}

export function FeatureStoryControls({ story, tokens, showSkip = true, endLabel }: {
  story: FeatureStoryPlayback; tokens: NoctaliaDesignTokens; showSkip?: boolean; endLabel?: string;
}) {
  const { t } = useTranslation();
  const demo = story.step === STORY_DEMO_STEP;
  return <View style={styles.controls}>
    <View accessible={false} style={styles.progress}>
      {[0, 1, 2].map((index) => <StoryProgress key={index} active={index === story.step} complete={index < story.step}
        progress={story.progress} reduced={story.reduced} color={tokens.accent.text} track={tokens.surface.border} />)}
    </View>
    <View style={styles.actions}>
      <PressableScale accessibilityRole="button" accessibilityLabel={t('onboarding.story.previous')} disabled={story.step === 0} onPress={story.previous} style={styles.icon} testID="btn.onboarding.story.previous">
        <IconSymbol name="chevron.left" size={17} color={story.step === 0 ? tokens.text.tertiary : tokens.text.secondary} />
      </PressableScale>
      <PressableScale accessibilityRole="button"
        accessibilityLabel={t(demo ? 'onboarding.story.replay' : story.playing ? 'onboarding.story.pause' : 'onboarding.story.play')}
        disabled={!demo && !story.canPlay} onPress={demo ? story.replay : story.toggle} style={styles.icon}
        testID={demo ? 'btn.onboarding.story.replay' : 'btn.onboarding.story.play'}>
        <IconSymbol name={demo ? 'arrow.clockwise' : story.playing ? 'pause.fill' : 'play.fill'} size={16} color={tokens.text.secondary} />
      </PressableScale>
      <PressableScale accessibilityRole="button" accessibilityLabel={t('onboarding.story.next')} disabled={demo} onPress={story.next} style={styles.icon} testID="btn.onboarding.story.next">
        <IconSymbol name="chevron.right" size={17} color={demo ? tokens.text.tertiary : tokens.text.secondary} />
      </PressableScale>
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
