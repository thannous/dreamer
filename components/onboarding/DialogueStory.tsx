import React, { useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { DURATION, EASE } from '@/components/motion/motion';

import { PressableScale } from '@/components/motion/PressableScale';
import type { NoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';
import { StoryScene, STORY_DEMO_STEP } from './FeatureStory';
import { TypingDots, WordReveal, afterTyping } from './story/StoryText';

/** Beats of the dialogue scenes, in milliseconds from the slide's arrival. */
export const EXPLORE_BEATS = {
  /** How long Noctalia is seen typing before the question appears. */
  typing: 1300,
  /** When each scene has said its line and the subtitle can follow. */
  subtitles: [2500, 2100, 2400],
} as const;

export function DialogueStory({ step, tokens, onInteraction, stageHeight }: {
  step: number; tokens: NoctaliaDesignTokens; onInteraction?: () => void; stageHeight: number;
}) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const [association, setAssociation] = useState<'start' | 'home'>('start');
  const choose = (next: 'start' | 'home') => { onInteraction?.(); setAssociation(next); };
  const story = step !== STORY_DEMO_STEP;
  return <View style={[styles.root, story ? [styles.storyRoot, { height: stageHeight }] : { minHeight: stageHeight }]}>
    <Animated.View accessible={false} style={[styles.doorFrame, step === STORY_DEMO_STEP && styles.doorFrameDemo, { borderColor: tokens.surface.border,
      transform: reduced ? [] : [{ scale: step === 0 ? 1 : 0.9 }],
      transitionProperty: reduced ? ['opacity'] : ['transform'], transitionDuration: DURATION.fast, transitionTimingFunction: EASE.inOut,
    }]}>
      <Image source={require('../../docs-src/static/img/starmap/door-160w.webp')} style={styles.door} contentFit="cover" />
    </Animated.View>
    {/* One line of the dialogue per slide, written in front of the reader:
        Noctalia types, then asks; you answer; Noctalia types again. */}
    {step === 0 ? <StoryScene key="question" delay={200} style={[styles.bubble, { backgroundColor: tokens.surface.raised, borderColor: tokens.surface.border }]}>
      <Text style={[styles.speaker, { color: tokens.accent.text }]}>Noctalia</Text>
      <TypingDots color={tokens.accent.text} hideAt={EXPLORE_BEATS.typing} style={styles.typing} />
      <WordReveal text={t('onboarding.feature.explore.question')} delay={afterTyping(EXPLORE_BEATS.typing)} stagger={60} align="left"
        style={[styles.message, { color: tokens.text.primary }]} />
    </StoryScene> : null}
    {step === 1 ? <StoryScene key="reply" delay={200} style={[styles.bubble, styles.reply, { backgroundColor: tokens.surface.active, borderColor: tokens.surface.border }]}>
      <Text style={[styles.speaker, { color: tokens.accent.text }]}>{t('onboarding.feature.explore.you')}</Text>
      <WordReveal text={t(association === 'start' ? 'onboarding.feature.explore.answer' : 'onboarding.story.explore.home')}
        delay={450} stagger={130} align="left" caret={tokens.accent.text} style={[styles.message, { color: tokens.text.primary }]} />
    </StoryScene> : null}
    {step === 2 ? <StoryScene key="followup" delay={200} style={[styles.bubble, { backgroundColor: tokens.surface.raised, borderColor: tokens.surface.border }]}>
      <Text style={[styles.speaker, { color: tokens.accent.text }]}>Noctalia</Text>
      <TypingDots color={tokens.accent.text} hideAt={EXPLORE_BEATS.typing} style={styles.typing} />
      <WordReveal text={t(`onboarding.story.explore.followup_${association}`)} delay={afterTyping(EXPLORE_BEATS.typing)} stagger={60} align="left"
        style={[styles.message, { color: tokens.text.primary }]} />
    </StoryScene> : null}
    {step === STORY_DEMO_STEP ? <View style={styles.choices}>
      {(['start', 'home'] as const).map((option) => <PressableScale key={option}
        accessibilityRole="button" accessibilityState={{ selected: association === option }} onPress={() => choose(option)}
        style={[styles.choice, { borderColor: association === option ? tokens.accent.text : tokens.surface.border, backgroundColor: tokens.surface.soft }]}
        testID={`btn.onboarding.dialogue.${option}`}>
        <Text style={[styles.choiceText, { color: tokens.text.primary }]}>{t(`onboarding.story.explore.choice_${option}`)}</Text>
      </PressableScale>)}
    </View> : null}
    {/* In the example, the follow-up answers the reader's own choice above it. */}
    {step === STORY_DEMO_STEP ? <StoryScene key={`followup-${association}`} style={[styles.bubble, { backgroundColor: tokens.surface.soft, borderColor: tokens.surface.border }]} testID="component.onboarding.dialogue.followup">
      <Text style={[styles.speaker, { color: tokens.accent.text }]}>Noctalia</Text>
      <Text accessibilityLiveRegion="polite" style={[styles.message, { color: tokens.text.primary }]}>{t(`onboarding.story.explore.followup_${association}`)}</Text>
    </StoryScene> : null}
    {/* The question is left with the reader: no answer is asked for here, the first dream will bring one. */}
    {step === STORY_DEMO_STEP ? <StoryScene key={`closing-${association}`} delay={900}>
      <Text style={[styles.closing, { color: tokens.accent.text }]} testID="text.onboarding.dialogue.closing">{t('onboarding.story.explore.closing')}</Text>
    </StoryScene> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { gap: 12, paddingTop: 4, paddingBottom: 8 },
  // Inside the story frame the dialogue is centred, with breathing room on both sides.
  storyRoot: { width: '100%', justifyContent: 'center', paddingHorizontal: 16 },
  typing: { left: 16, top: 34 },
  doorFrame: { width: 64, height: 80, padding: 3, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, borderWidth: 1, alignSelf: 'center', marginBottom: 6, overflow: 'hidden' },
  // In the example the door is only a reminder; the choices need the room.
  doorFrameDemo: { width: 44, height: 56, marginBottom: 0 },
  door: { width: '100%', height: '100%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  bubble: { borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, gap: 4, marginRight: 24 },
  reply: { marginLeft: 24, marginRight: 0, borderBottomRightRadius: 6 },
  speaker: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 10, lineHeight: 16 },
  message: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 15, lineHeight: 21 },
  choices: { flexDirection: 'row', gap: 10 },
  choice: { flex: 1, minHeight: 52, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  closing: { fontFamily: Fonts.fraunces.regular, fontStyle: 'italic', fontSize: 16, lineHeight: 22, textAlign: 'center', paddingHorizontal: 8 },
  choiceText: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 14, lineHeight: 19, textAlign: 'center' },
});
