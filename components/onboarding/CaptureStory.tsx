import React from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, { type CSSStyle } from 'react-native-reanimated';

import { DURATION, EASE } from '@/components/motion/motion';
import type { NoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';
import { DreamGlobe } from './DreamGlobe';
import { StoryScene, STORY_DEMO_STEP } from './FeatureStory';

const ARTWORK = require('../../docs-src/static/img/dreams/staircase-480w.webp');
const VOICE_BARS = [8, 15, 25, 18, 30, 20, 12];

export function CaptureStory({ step, reduced, tokens, stageHeight, onDreamChange }: {
  step: number; reduced: boolean; tokens: NoctaliaDesignTokens; stageHeight: number; onDreamChange?: (index: number) => void;
}) {
  const { t } = useTranslation();
  if (step === STORY_DEMO_STEP) return <StoryScene><DreamGlobe tokens={tokens} stageHeight={stageHeight} onSelectionChange={onDreamChange} /></StoryScene>;
  const imageHeight = Math.min(280, stageHeight - 24);
  const figure: CSSStyle<ViewStyle> = {
    opacity: step === 0 ? 0.24 : step === 1 ? 0.48 : 1,
    transform: reduced ? [] : [{ translateY: step === 1 ? -10 : 0 }, { scale: step === 0 ? 0.94 : step === 1 ? 0.97 : 1 }],
    transitionProperty: reduced ? ['opacity'] : ['opacity', 'transform'],
    transitionDuration: DURATION.fast,
    transitionTimingFunction: EASE.inOut,
  };

  return <View style={[styles.stage, { minHeight: stageHeight }]}>
    <View accessible={false} style={[styles.orbit, { borderColor: tokens.surface.border, width: imageHeight + 40, height: imageHeight + 40 }]} />
    {/* This artwork remains mounted as the fragment becomes a page, then an image. */}
    <Animated.View accessible={false} style={[styles.artwork, { width: imageHeight * 0.76, height: imageHeight, borderColor: tokens.surface.border }, figure]}>
      <Image source={ARTWORK} style={StyleSheet.absoluteFill} contentFit="cover" />
    </Animated.View>
    <Animated.View pointerEvents="none" aria-hidden={step !== 0} accessibilityElementsHidden={step !== 0} importantForAccessibility={step === 0 ? 'auto' : 'no-hide-descendants'} style={[styles.fragment, {
      opacity: step === 0 ? 1 : 0,
      transform: reduced ? [] : [{ translateY: step === 0 ? 0 : -8 }],
      transitionProperty: reduced ? ['opacity'] : ['opacity', 'transform'],
      transitionDuration: DURATION.fast, transitionTimingFunction: EASE.out,
    }]}>
      <View accessible={false} style={styles.voice}>
        {VOICE_BARS.map((height, index) => <Animated.View key={index} style={[
          styles.voiceBar, { height, backgroundColor: tokens.accent.text },
          !reduced && {
            animationName: { from: { opacity: 0.4, transform: [{ scaleY: 0.4 }] }, to: { opacity: 1, transform: [{ scaleY: 1 }] } },
            animationDuration: DURATION.slow, animationDelay: index * 50, animationTimingFunction: EASE.out, animationFillMode: 'both',
          },
        ]} />)}
      </View>
      <Text style={[styles.fragmentText, { color: tokens.text.primary }]}>{t('onboarding.story.capture.fragment')}</Text>
    </Animated.View>
    <Animated.View pointerEvents="none" aria-hidden={step !== 1} accessibilityElementsHidden={step !== 1} importantForAccessibility={step === 1 ? 'auto' : 'no-hide-descendants'}
      style={[styles.journal, { backgroundColor: tokens.surface.base, borderColor: tokens.surface.border,
        opacity: step === 1 ? 1 : 0,
        transform: reduced ? [] : [{ translateY: step === 1 ? 0 : 12 }, { scale: step === 1 ? 1 : 0.96 }],
        transitionProperty: reduced ? ['opacity'] : ['opacity', 'transform'], transitionDuration: DURATION.fast, transitionTimingFunction: EASE.inOut,
      }]}>
      <View accessible={false} style={[styles.pageRule, { backgroundColor: tokens.accent.text }]} />
      <Text style={[styles.kicker, { color: tokens.accent.text }]}>{t('onboarding.feature.capture.benefit_2.title')}</Text>
      <Text style={[styles.title, { color: tokens.text.primary }]}>{t('onboarding.feature.constellation.dream_1.title')}</Text>
      <Text numberOfLines={3} style={[styles.body, { color: tokens.text.secondary }]}>{t('onboarding.feature.constellation.dream_1.body')}</Text>
    </Animated.View>
    {step === 2 ? <StoryScene style={[styles.memory, { backgroundColor: tokens.surface.base, borderColor: tokens.surface.border }]}>
      <Text style={[styles.memoryLabel, { color: tokens.text.secondary }]}>{t('onboarding.feature.constellation.dream_1.title')}</Text>
    </StoryScene> : null}
  </View>;
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  orbit: { position: 'absolute', borderWidth: 1, borderRadius: 300, opacity: 0.55 },
  artwork: { position: 'absolute', borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, overflow: 'hidden' },
  fragment: { position: 'absolute', width: '100%', alignItems: 'center', paddingHorizontal: 18, gap: 22 },
  voice: { flexDirection: 'row', height: 32, gap: 5, alignItems: 'center' },
  voiceBar: { width: 3, borderRadius: 2 },
  fragmentText: { fontFamily: Fonts.fraunces.regular, fontSize: 24, lineHeight: 33, textAlign: 'center', maxWidth: 290 },
  journal: { width: '100%', maxWidth: 310, padding: 20, paddingLeft: 26, gap: 10, borderRadius: 18, borderWidth: 1 },
  pageRule: { position: 'absolute', left: 10, top: 20, bottom: 20, width: 1, opacity: 0.35 },
  kicker: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 10, lineHeight: 16, letterSpacing: 1 },
  title: { fontFamily: Fonts.fraunces.regular, fontSize: 21, lineHeight: 28 },
  body: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 12, lineHeight: 19 },
  memory: { position: 'absolute', bottom: 4, maxWidth: '90%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  memoryLabel: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
