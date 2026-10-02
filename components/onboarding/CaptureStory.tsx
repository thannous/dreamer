import React from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { DURATION, EASE } from '@/components/motion/motion';
import type { NoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';
import { DreamGlobe } from './DreamGlobe';
import { StoryScene, STORY_DEMO_STEP } from './FeatureStory';

const ARTWORK = require('../../docs-src/static/img/dreams/staircase-480w.webp');

export function CaptureStory({ step, reduced, tokens, stageHeight }: {
  step: number; reduced: boolean; tokens: NoctaliaDesignTokens; stageHeight: number;
}) {
  const { t } = useTranslation();
  if (step === STORY_DEMO_STEP) return <StoryScene><DreamGlobe tokens={tokens} stageHeight={stageHeight} /></StoryScene>;

  return <View style={[styles.stage, { minHeight: stageHeight }]}>
    <Animated.View accessible={false} style={[styles.artwork, {
      opacity: step === 0 ? 0.14 : step === 1 ? 0.3 : 1,
      ...(!reduced ? { transform: [{ translateY: step === 1 ? -24 : 0 }, { scale: step === 0 ? 0.94 : step === 1 ? 0.96 : 1 }] } : {}),
      transitionProperty: reduced ? ['opacity'] : ['opacity', 'transform'],
      transitionDuration: DURATION.fast,
      transitionTimingFunction: EASE.inOut,
    }]}>
      <Image source={ARTWORK} style={StyleSheet.absoluteFill} contentFit="cover" />
    </Animated.View>
    {step === 0 ? <StoryScene style={styles.fragment}>
      <Text style={[styles.fragmentText, { color: tokens.text.primary }]}>{t('onboarding.story.capture.fragment')}</Text>
    </StoryScene> : step === 1 ? <StoryScene style={[styles.journal, { backgroundColor: tokens.surface.base, borderColor: tokens.surface.border }]}>
      <Text style={[styles.kicker, { color: tokens.accent.text }]}>{t('onboarding.feature.capture.benefit_2.title')}</Text>
      <Text style={[styles.title, { color: tokens.text.primary }]}>{t('onboarding.feature.constellation.dream_1.title')}</Text>
      <Text style={[styles.body, { color: tokens.text.secondary }]}>{t('onboarding.feature.constellation.dream_1.body')}</Text>
    </StoryScene> : null}
  </View>;
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  artwork: { position: 'absolute', width: 190, height: 250, borderRadius: 18, overflow: 'hidden' },
  fragment: { paddingHorizontal: 16, paddingVertical: 32 },
  fragmentText: { fontFamily: Fonts.fraunces.regular, fontSize: 25, lineHeight: 35, textAlign: 'center' },
  journal: { width: '100%', padding: 20, gap: 12, borderRadius: 18, borderWidth: 1 },
  kicker: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 11, lineHeight: 17 },
  title: { fontFamily: Fonts.fraunces.regular, fontSize: 21, lineHeight: 29 },
  body: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 14, lineHeight: 22 },
});
