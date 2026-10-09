import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DURATION, EASE } from '@/components/motion/motion';
import { PressableScale } from '@/components/motion/PressableScale';
import { BottomSheetActions } from '@/components/ui/BottomSheetActions';
import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';
import { DarkTheme } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens, type NoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';
import { CAPTURE_BEATS, CaptureStory } from './CaptureStory';
import { DialogueStory, EXPLORE_BEATS } from './DialogueStory';
import {
  HEADLINE_SETTLE, Headline, STORY_DEMO_STEP, StoryProgress, StoryScene, useFeatureStory, type FeatureStoryPlayback,
} from './FeatureStory';
import { SymbolConstellation } from './SymbolConstellation';
import { StoryButton } from './story/StoryButton';
import { StoryFrame, SUBTITLE_SPACE, SUBTITLE_STAGGER } from './story/StoryFrame';
import { StoryNight } from './story/StoryNight';
import { wordRevealDuration } from './story/StoryText';

export type OnboardingFeature = 'capture' | 'connect' | 'explore';
const CHAPTERS: OnboardingFeature[] = ['capture', 'connect', 'explore'];
/** The story is told at night in either theme, like the onboarding it opens from. */
const NIGHT = getNoctaliaDesignTokens(DarkTheme, 'dark');
/** When each scene has played its part and its subtitle may follow. */
const SUBTITLE_DELAYS: Record<OnboardingFeature, readonly number[]> = {
  capture: [CAPTURE_BEATS.dream, CAPTURE_BEATS.forget, CAPTURE_BEATS.tell],
  connect: [1000, 1000, 1300],
  explore: EXPLORE_BEATS.subtitles,
};

function FeatureNarrative({ feature, tokens, stageHeight, frameHeight, onStoryChange }: {
  feature: OnboardingFeature; tokens: NoctaliaDesignTokens; stageHeight: number; frameHeight: number;
  onStoryChange: (story: FeatureStoryPlayback) => void;
}) {
  const { t } = useTranslation();
  const story = useFeatureStory();
  // The sheet's footer turns the pages; it needs this chapter's current controls.
  useEffect(() => onStoryChange(story));
  const demo = story.step === STORY_DEMO_STEP;
  const scene = demo ? 'demo' : String(story.step);
  const body = t(`onboarding.narrative.${feature}.${scene}.body`);
  const sceneHeight = demo ? stageHeight : frameHeight - SUBTITLE_SPACE;
  const visual = feature === 'capture' ? <CaptureStory step={story.step} reduced={story.reduced} tokens={tokens} stageHeight={sceneHeight} /> :
    feature === 'connect' ? <SymbolConstellation tokens={tokens} storyStep={demo ? undefined : story.step} stageHeight={sceneHeight} startAt={story.lastScene} /> :
      <DialogueStory step={story.step} tokens={tokens} stageHeight={sceneHeight} />;
  return <View style={styles.narrative}>
    <View key={story.step} style={[styles.copy, !demo && styles.storyCopy]}>
      <Headline text={t(`onboarding.narrative.${feature}.${scene}.title`)} lineHeight={styles.title.lineHeight}
        style={[styles.title, { color: tokens.text.primary }]} />
      {demo ? <StoryScene delay={HEADLINE_SETTLE}>
        <Text style={[styles.body, { color: tokens.text.secondary }]}>{body}</Text>
      </StoryScene> : null}
    </View>
    <View testID={`component.onboarding.preview.${feature}`}>
      <View testID={`component.onboarding.story.${feature}.${story.step}`}>
        {/* Each slide is a scene played in the same night; its sentence is the subtitle. */}
        {demo ? visual : <StoryFrame height={frameHeight} tokens={tokens} subtitle={body}
          subtitleDelay={SUBTITLE_DELAYS[feature][story.step]} sceneKey={story.step}>
          <View key={story.step} style={styles.sceneSlot}>{visual}</View>
        </StoryFrame>}
      </View>
    </View>
    {feature !== 'capture' && demo ? <Text style={[styles.note, { color: tokens.text.tertiary }]}>{t('onboarding.feature.reflection_note')}</Text> : null}
  </View>;
}

/**
 * The page-turning footer. The button arrives once the scene has finished telling
 * its part, and its label names what comes next. The link row keeps its height on
 * the first page, so the button never moves under the thumb.
 */
function StoryFooter({ label, testID, readyAt, tokens, onNext, backLabel, onBack }: {
  label: string; testID: string; readyAt: number; tokens: NoctaliaDesignTokens;
  onNext: () => void; backLabel: string; onBack?: () => void;
}) {
  const [ready, setReady] = useState(readyAt <= 0);
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setReady(true), readyAt);
    return () => clearTimeout(timer);
  }, [ready, readyAt]);
  return <BottomSheetActions>
    <Animated.View
      pointerEvents={ready ? 'auto' : 'none'}
      accessibilityElementsHidden={!ready}
      importantForAccessibility={ready ? 'auto' : 'no-hide-descendants'}
      style={{
        opacity: ready ? 1 : 0,
        transform: [{ translateY: ready ? 0 : 10 }],
        transitionProperty: ['opacity', 'transform'],
        transitionDuration: DURATION.normal,
        transitionTimingFunction: EASE.out,
      }}
    >
      <StoryButton label={label} onPress={onNext} disabled={!ready} testID={testID} tokens={tokens} />
    </Animated.View>
    {onBack ? <PressableScale accessibilityRole="button" onPress={onBack} style={styles.link} testID="btn.onboarding.story.previous">
      <Text style={[styles.linkText, { color: tokens.text.secondary }]}>{backLabel}</Text>
    </PressableScale> : <View accessible={false} style={styles.link} />}
  </BottomSheetActions>;
}

export function OnboardingFeatureSheet({ feature, onClose, onFeatureChange }: {
  feature: OnboardingFeature; onClose: () => void; onFeatureChange: (feature: OnboardingFeature) => void;
}) {
  const { t } = useTranslation();
  const tokens = NIGHT;
  const reduced = useReducedMotion();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheetHeight = Math.max(160, Math.min(height * 0.8, height - insets.top - insets.bottom - 96) - 48);
  const nextChapter = CHAPTERS[CHAPTERS.indexOf(feature) + 1];
  const storyRef = useRef<FeatureStoryPlayback | null>(null);
  const [step, setStep] = useState(0);
  const updateStory = useCallback((story: FeatureStoryPlayback) => {
    storyRef.current = story;
    setStep(story.step);
  }, []);
  const demo = step === STORY_DEMO_STEP;
  const subtitle = t(`onboarding.narrative.${feature}.${demo ? 'demo' : step}.body`);
  // Wait for the scene's subtitle to land; the example only needs its headline.
  const readyAt = reduced ? 0 : demo ? HEADLINE_SETTLE + DURATION.normal
    : SUBTITLE_DELAYS[feature][step] + wordRevealDuration(subtitle, SUBTITLE_STAGGER);

  return <StandardBottomSheet visible onClose={onClose} title={t(`onboarding.feature.${feature}.title`)} focusKey={feature}
    testID="sheet.onboarding.feature" style={{ height: sheetHeight, ...(Platform.OS === 'web' ? { width } : {}) }}
    surfaceColor={tokens.screen.background} transparentContent
    // The whole sheet is the night: sky, stars, and a shooting star at each page.
    background={<StoryNight tokens={tokens} page={{ key: `${feature}-${step}`, index: CHAPTERS.indexOf(feature) * 4 + step }} />}
    closeIconColor={tokens.text.primary}
    dragIndicatorColor={tokens.text.secondary} showsVerticalScrollIndicator={false}
    headerContent={<StoryProgress step={step} tokens={tokens} />}
    footer={<StoryFooter key={`${feature}-${step}`} tokens={tokens} readyAt={readyAt}
      label={t(demo ? (nextChapter ? `onboarding.narrative.continue.${nextChapter}` : 'onboarding.narrative.finish') : `onboarding.narrative.${feature}.${step}.next`)}
      testID={demo ? 'btn.onboarding.story.continue' : 'btn.onboarding.story.next'}
      onNext={() => {
        if (!demo) storyRef.current?.next();
        else if (nextChapter) onFeatureChange(nextChapter);
        else onClose();
      }}
      backLabel={t('onboarding.story.back')}
      onBack={step > 0 ? () => storyRef.current?.previous() : undefined} />}
    closeButton={{ label: t('journal.detail.share_modal.close'), testID: 'btn.onboarding.feature.close' }}>
    {/* Only the narrative resets. The sheet host and its close control stay in place. */}
    <FeatureNarrative key={feature} feature={feature} tokens={tokens}
      stageHeight={Math.max(170, Math.min(270, sheetHeight - 380))}
      // Leaves room under the scene for the button's glow.
      frameHeight={Math.max(230, Math.min(390, sheetHeight - 340))}
      onStoryChange={updateStory} />
  </StandardBottomSheet>;
}

const styles = StyleSheet.create({
  // Air between the scene and the footer, so captions never touch the button.
  narrative: { paddingTop: 4, paddingBottom: 20 },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  linkText: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 14, lineHeight: 20 },
  // Room for the word and a two-line sentence, so the image never jumps between slides.
  copy: { alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 18, minHeight: 132 },
  // Above a scene, the word stands alone; the sentence plays as the scene's subtitle.
  storyCopy: { minHeight: 0, paddingBottom: 14 },
  sceneSlot: { width: '100%', alignItems: 'center', paddingHorizontal: 12 },
  title: { fontFamily: Fonts.fraunces.semiBold, fontSize: 44, lineHeight: 52, textAlign: 'center' },
  body: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 17, lineHeight: 24, textAlign: 'center', maxWidth: 300 },
  note: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 11, lineHeight: 16, textAlign: 'center', paddingTop: 12, paddingBottom: 8 },
});
