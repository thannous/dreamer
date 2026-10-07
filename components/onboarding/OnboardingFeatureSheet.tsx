import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';
import { getNoctaliaDesignTokens, type NoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { CaptureStory } from './CaptureStory';
import { CaptureTransition } from './CaptureTransition';
import { DialogueStory } from './DialogueStory';
import { FeatureStoryControls, STORY_DEMO_STEP, StoryScene, useFeatureStory, type FeatureStoryPlayback } from './FeatureStory';
import { SymbolConstellation } from './SymbolConstellation';

export type OnboardingFeature = 'capture' | 'connect' | 'explore';
const CHAPTERS: OnboardingFeature[] = ['capture', 'connect', 'explore'];

function FeatureNarrative({ feature, tokens, stageHeight, story, transitioning }: {
  feature: OnboardingFeature; tokens: NoctaliaDesignTokens; stageHeight: number; story: FeatureStoryPlayback; transitioning: boolean;
}) {
  const { t } = useTranslation();
  const [selectedDream, setSelectedDream] = useState(0);
  const demo = story.step === STORY_DEMO_STEP;
  const chapter = CHAPTERS.indexOf(feature);
  const scene = demo ? 'demo' : String(story.step);
  return <View style={styles.narrative}>
    <Text style={[styles.chapter, { color: tokens.accent.text }]}>
      {String(chapter + 1).padStart(2, '0')}{'  /  03  ·  '}{t(`onboarding.feature.${feature}.title`)}
    </Text>
    {transitioning ? <CaptureTransition story={story} tokens={tokens} stageHeight={stageHeight} dreamIndex={selectedDream} /> : <>
    <StoryScene key={story.step} style={[styles.copy, demo && styles.demoCopy]}>
      <Text accessibilityRole="header" style={[styles.title, demo && styles.demoTitle, { color: tokens.text.primary }]}>
        {t(`onboarding.narrative.${feature}.${scene}.title`)}
      </Text>
      <Text style={[styles.body, { color: tokens.text.secondary }]}>
        {t(`onboarding.narrative.${feature}.${scene}.body`)}
      </Text>
    </StoryScene>
    <View testID={`component.onboarding.preview.${feature}`}>
      <View testID={`component.onboarding.story.${feature}.${story.step}`}>
        {feature === 'capture' ? <CaptureStory step={story.step} reduced={story.reduced} tokens={tokens} stageHeight={stageHeight} onDreamChange={setSelectedDream} /> :
          feature === 'connect' ? <SymbolConstellation tokens={tokens} storyStep={demo ? undefined : story.step} /> :
            <DialogueStory step={story.step} tokens={tokens} stageHeight={stageHeight} />}
      </View>
    </View>
    <FeatureStoryControls story={story} tokens={tokens} />
    {feature !== 'capture' && demo ? <Text style={[styles.note, { color: tokens.text.tertiary }]}>{t('onboarding.feature.reflection_note')}</Text> : null}
    </>}
  </View>;
}

export function OnboardingFeatureSheet({ feature, onClose, onFeatureChange }: {
  feature: OnboardingFeature; onClose: () => void; onFeatureChange: (feature: OnboardingFeature) => void;
}) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tokens = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const sheetHeight = Math.max(160, Math.min(height * 0.8, height - insets.top - insets.bottom - 96) - 48);
  const nextChapter = CHAPTERS[CHAPTERS.indexOf(feature) + 1];
  const story = useFeatureStory();
  const [transitioning, setTransitioning] = useState(false);
  const demo = story.step === STORY_DEMO_STEP;
  const advanceChapter = () => {
    if (nextChapter) {
      story.replay();
      setTransitioning(false);
      onFeatureChange(nextChapter);
    } else onClose();
  };

  return <StandardBottomSheet visible onClose={onClose} title={t(`onboarding.feature.${feature}.title`)} focusKey={feature}
    testID="sheet.onboarding.feature" style={{ height: sheetHeight, ...(Platform.OS === 'web' ? { width } : {}) }}
    surfaceColor={colors.backgroundCard} transparentContent
    dragIndicatorColor={tokens.text.secondary} showsVerticalScrollIndicator={false}
    actions={{
      primaryLabel: t(demo && feature === 'explore' ? 'onboarding.narrative.finish' : 'common.continue'),
      primaryTestID: demo ? 'btn.onboarding.story.continue' : 'btn.onboarding.story.next',
      onPrimary: () => {
        if (transitioning) {
          if (story.step < 2) story.next();
          else advanceChapter();
        } else if (!demo) story.next();
        else if (feature === 'capture') {
          story.replay();
          setTransitioning(true);
        } else advanceChapter();
      },
    }}
    closeButton={{ label: t('journal.detail.share_modal.close'), testID: 'btn.onboarding.feature.close' }}>
    {/* Only the narrative resets. The sheet host and its close control stay in place. */}
    <FeatureNarrative key={feature} feature={feature} tokens={tokens}
      stageHeight={Math.max(170, Math.min(270, sheetHeight - 350))}
      story={story} transitioning={transitioning} />
  </StandardBottomSheet>;
}

const styles = StyleSheet.create({
  narrative: { paddingTop: 0 },
  chapter: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 10, lineHeight: 16, letterSpacing: 1.6, textTransform: 'uppercase', textAlign: 'center', paddingBottom: 6 },
  copy: { alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingBottom: 20, minHeight: 102 },
  demoCopy: { gap: 6, paddingBottom: 8, minHeight: 0 },
  demoTitle: { fontSize: 23, lineHeight: 29 },
  title: { fontFamily: Fonts.fraunces.regular, fontSize: 25, lineHeight: 32, textAlign: 'center' },
  body: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 320 },
  note: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 10, lineHeight: 16, textAlign: 'center', paddingTop: 12, paddingBottom: 8 },
});
