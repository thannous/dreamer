import React, { useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/motion/PressableScale';
import type { NoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';
import { StoryScene, STORY_DEMO_STEP } from './FeatureStory';

export function DialogueStory({ step, tokens, onInteraction }: {
  step: number; tokens: NoctaliaDesignTokens; onInteraction: () => void;
}) {
  const { t } = useTranslation();
  const [association, setAssociation] = useState<'start' | 'home'>('start');
  const choose = (next: 'start' | 'home') => { onInteraction(); setAssociation(next); };
  return <View style={styles.root}>
    <View accessible={false} style={[styles.doorFrame, { borderColor: tokens.surface.border }]}>
      <Image source={require('../../docs-src/static/img/starmap/door-160w.webp')} style={styles.door} contentFit="cover" />
    </View>
    <StoryScene style={[styles.bubble, { backgroundColor: tokens.surface.soft, borderColor: tokens.surface.border }]}>
      <Text style={[styles.speaker, { color: tokens.accent.text }]}>Noctalia</Text>
      <Text style={[styles.message, { color: tokens.text.primary }]}>{t('onboarding.feature.explore.question')}</Text>
    </StoryScene>
    {step >= 1 ? <StoryScene style={[styles.bubble, styles.reply, { backgroundColor: tokens.surface.active, borderColor: tokens.surface.border }]}>
      <Text style={[styles.speaker, { color: tokens.accent.text }]}>{t('onboarding.feature.explore.you')}</Text>
      <Text style={[styles.message, { color: tokens.text.primary }]}>{t(association === 'start' ? 'onboarding.feature.explore.answer' : 'onboarding.story.explore.home')}</Text>
    </StoryScene> : null}
    {step >= 2 ? <StoryScene style={[styles.bubble, { backgroundColor: tokens.surface.soft, borderColor: tokens.surface.border }]} testID="component.onboarding.dialogue.followup">
      <Text style={[styles.speaker, { color: tokens.accent.text }]}>Noctalia</Text>
      <Text accessibilityLiveRegion="polite" style={[styles.message, { color: tokens.text.primary }]}>{t(`onboarding.story.explore.followup_${association}`)}</Text>
    </StoryScene> : null}
    {step === STORY_DEMO_STEP ? <View style={styles.choices}>
      <Text style={[styles.choiceHint, { color: tokens.text.secondary }]}>{t('onboarding.story.explore.choose')}</Text>
      {(['start', 'home'] as const).map((option) => <PressableScale key={option}
        accessibilityRole="button" accessibilityState={{ selected: association === option }} onPress={() => choose(option)}
        style={[styles.choice, { borderColor: association === option ? tokens.accent.text : tokens.surface.border, backgroundColor: tokens.surface.soft }]}
        testID={`btn.onboarding.dialogue.${option}`}>
        <Text style={[styles.message, { color: tokens.text.primary }]}>{t(`onboarding.story.explore.choice_${option}`)}</Text>
      </PressableScale>)}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { gap: 12, paddingVertical: 12 },
  doorFrame: { width: 80, height: 80, padding: 4, borderRadius: 40, borderWidth: 1, alignSelf: 'center', marginBottom: 4 },
  door: { width: '100%', height: '100%', borderRadius: 36 },
  bubble: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 6, marginRight: 20 },
  reply: { marginLeft: 36, marginRight: 0 },
  speaker: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 12, lineHeight: 18 },
  message: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 14, lineHeight: 21 },
  choices: { gap: 8, paddingTop: 4 },
  choiceHint: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 12, lineHeight: 18 },
  choice: { minHeight: 48, padding: 12, borderRadius: 12, borderWidth: 1, justifyContent: 'center' },
});
