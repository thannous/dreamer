import React, { useState } from 'react';
import { Image } from 'expo-image';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { DURATION, EASE } from '@/components/motion/motion';

import { PressableScale } from '@/components/motion/PressableScale';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { NoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';
import { HEADLINE_SETTLE, StoryScene, STORY_DEMO_STEP } from './FeatureStory';
import { TypingDots, WordReveal, afterTyping, wordRevealDuration } from './story/StoryText';
import { TypeScale } from '@/constants/typeScale';

/** Beats of the dialogue scenes, in milliseconds from the slide's arrival. */
export const EXPLORE_BEATS = {
  /** How long Noctalia is seen typing before the question appears. */
  typing: 1300,
  /** When each scene has said its line and the subtitle can follow. */
  subtitles: [2500, 2100, 2400],
} as const;

type Association = 'start' | 'home';
const ASSOCIATIONS: Association[] = ['start', 'home'];
/** The blue door of "Cette nuit", in the 800 px painting so it stays sharp this large. */
const STAIRCASE = require('../../docs-src/static/img/dreams/staircase-800w.webp');
/** The example in order: the door and its question, then the two answers, one after the other. */
const EXAMPLE_BEATS = { question: HEADLINE_SETTLE, choices: HEADLINE_SETTLE + 700, choiceStagger: 160 } as const;
/** The copy room other examples hold for their two-line sentence, which this one sets itself (about 134 pt against 72). */
const EXAMPLE_COPY_RETURNED = 62;
/** Noctalia's follow-up is written word by word at this rhythm. */
const REPLY_STAGGER = 60;
/** Below this height the answered door would be a sliver: it leaves instead. */
const DOOR_MIN = 48;
/** Between the door and the dialogue, and between the dialogue's parts. */
const GAP = 14;
const EXAMPLE_BOTTOM = 8;

/**
 * "À toi": the door and its question come first, then the two answers. Nothing is
 * chosen in advance; once the reader picks one, Noctalia answers it and the story
 * can go on. `onAnswer` gives how long that reply takes to be told.
 */
function DialogueExample({ tokens, stageHeight, onAnswer }: {
  tokens: NoctaliaDesignTokens; stageHeight: number; onAnswer?: (replyDuration: number) => void;
}) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const [association, setAssociation] = useState<Association | null>(null);
  const followup = association ? t(`onboarding.story.explore.followup_${association}`) : '';
  const replyEnd = afterTyping(EXPLORE_BEATS.typing) + wordRevealDuration(followup, REPLY_STAGGER);
  const choose = (next: Association) => {
    if (next === association) return;
    setAssociation(next);
    const text = t(`onboarding.story.explore.followup_${next}`);
    // iOS has no live regions: Noctalia's reply is announced as it starts to be written.
    // Android reads the reply's live region by itself.
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text);
    onAnswer?.(afterTyping(EXPLORE_BEATS.typing) + wordRevealDuration(text, REPLY_STAGGER) + DURATION.normal);
  };
  // As large as the stage allows, the door is what the question is about; on a small
  // phone it gives way so both answers stay above the button.
  const doorHeight = Math.round(Math.max(96, Math.min(188, stageHeight * 0.45)));
  const doorWidth = Math.round(doorHeight * 0.8);
  const answered = association !== null;
  // The stage's height is kept before and after the answer, so the footer never moves. The
  // example's headline stands alone, without the sentence other examples set under it: its
  // room is given back here.
  const exampleHeight = stageHeight + EXAMPLE_COPY_RETURNED;
  // Once answered, the question steps back to a smaller size and the door makes room for the
  // dialogue, keeping what is left: whole on a tall phone, smaller on a 874 pt one, gone where
  // even a small door would push the closing under the button. The dialogue's height is
  // measured, so long languages and large text are counted.
  const [dialogueHeight, setDialogueHeight] = useState(0);
  const roomForDoor = exampleHeight - EXAMPLE_BOTTOM - GAP - dialogueHeight;
  const answeredDoor = roomForDoor >= DOOR_MIN ? Math.min(doorHeight, Math.floor(roomForDoor)) : 0;
  const shownDoor = answered && dialogueHeight > 0 ? answeredDoor : doorHeight;
  const resize = { transitionDuration: DURATION.slow, transitionTimingFunction: EASE.inOut } as const;
  return <View style={[styles.example, { minHeight: exampleHeight }]}>
    <StoryScene delay={EXAMPLE_BEATS.question} style={styles.doorSlot}>
      {/* The door's room follows it, so the dialogue rises as it shrinks. */}
      <Animated.View accessible={false} testID="component.onboarding.dialogue.door" style={{
        height: shownDoor, marginBottom: shownDoor ? 0 : -GAP,
        ...(reduced ? {} : { transitionProperty: ['height', 'marginBottom'], ...resize }),
      }}>
        <Animated.View style={[styles.arch, {
          width: doorWidth, height: doorHeight, borderTopLeftRadius: doorWidth / 2, borderTopRightRadius: doorWidth / 2,
          borderColor: tokens.surface.border, transformOrigin: 'top',
          opacity: shownDoor ? 1 : 0,
          transform: [{ scale: shownDoor ? shownDoor / doorHeight : 0.4 }],
          ...(reduced ? {} : { transitionProperty: ['transform', 'opacity'], ...resize }),
        }]}>
          {/* The painting shares the arch's proportions: this crop frames the door, its landing and the stairs. */}
          <Image source={STAIRCASE} style={styles.staircase} contentFit="cover" />
        </Animated.View>
      </Animated.View>
    </StoryScene>
    <View style={styles.dialogue} onLayout={(event) => setDialogueHeight(event.nativeEvent.layout.height)}>
      <StoryScene delay={EXAMPLE_BEATS.question} style={styles.prompt}>
        <Animated.Text accessibilityRole="header" maxFontSizeMultiplier={1.4} lineBreakStrategyIOS="standard" style={[styles.question, {
          color: tokens.text.primary, textShadowColor: tokens.illustration.scrim,
          fontSize: (answered ? TypeScale.h3 : TypeScale.h1).fontSize, lineHeight: (answered ? TypeScale.h3 : TypeScale.h1).lineHeight,
          ...(reduced ? {} : { transitionProperty: ['fontSize', 'lineHeight'], ...resize }),
        }]} testID="text.onboarding.dialogue.question">
          {t('onboarding.narrative.explore.demo.body')}
        </Animated.Text>
      </StoryScene>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('onboarding.narrative.explore.demo.body')} style={styles.choices}>
        {ASSOCIATIONS.map((option, index) => {
          const selected = association === option;
          return <StoryScene key={option} delay={EXAMPLE_BEATS.choices + index * EXAMPLE_BEATS.choiceStagger} style={styles.choiceSlot}>
            <PressableScale accessibilityRole="radio" accessibilityState={{ checked: selected }} aria-checked={selected}
              onPress={() => choose(option)}
              style={[styles.choice, {
                borderColor: selected ? tokens.accent.text : tokens.surface.border,
                backgroundColor: selected ? tokens.surface.active : tokens.surface.soft,
                opacity: answered && !selected ? 0.7 : 1,
              }]}
              testID={`btn.onboarding.dialogue.${option}`}>
              <View style={[styles.radio, {
                borderColor: selected ? tokens.accent.text : tokens.text.tertiary,
                backgroundColor: selected ? tokens.accent.text : 'transparent',
              }]}>
                {selected ? <IconSymbol name="checkmark" size={12} color={tokens.text.onAccent} /> : null}
              </View>
              <Text style={[styles.choiceText, { color: tokens.text.primary }]}>{t(`onboarding.story.explore.choice_${option}`)}</Text>
            </PressableScale>
          </StoryScene>;
        })}
      </View>
      {/* Noctalia answers the reader's own choice, written in front of them; a new choice rewrites it. */}
      {association ? <StoryScene key={`followup-${association}`} delay={120} accessibilityLiveRegion="polite"
        style={[styles.bubble, { backgroundColor: tokens.surface.raised, borderColor: tokens.surface.border }]} testID="component.onboarding.dialogue.followup">
        <Text style={[styles.speaker, { color: tokens.accent.text }]}>Noctalia</Text>
        <TypingDots color={tokens.accent.text} hideAt={EXPLORE_BEATS.typing} style={styles.typing} />
        <WordReveal text={followup} delay={afterTyping(EXPLORE_BEATS.typing)} stagger={REPLY_STAGGER} align="left"
          style={[styles.message, { color: tokens.text.primary }]} />
      </StoryScene> : null}
      {/* The question is left with the reader: the first dream may bring its answer. */}
      {association ? <StoryScene key={`closing-${association}`} delay={reduced ? 0 : replyEnd}>
        <Text style={[styles.closing, { color: tokens.accent.text }]} testID="text.onboarding.dialogue.closing">{t('onboarding.story.explore.closing')}</Text>
      </StoryScene> : null}
    </View>
  </View>;
}

export function DialogueStory({ step, tokens, onAnswer, stageHeight }: {
  step: number; tokens: NoctaliaDesignTokens; stageHeight: number;
  /** In the example, called when the reader picks an answer, with how long Noctalia's reply takes. */
  onAnswer?: (replyDuration: number) => void;
}) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  if (step === STORY_DEMO_STEP) return <DialogueExample tokens={tokens} stageHeight={stageHeight} onAnswer={onAnswer} />;
  return <View style={[styles.root, styles.storyRoot, { height: stageHeight }]}>
    <Animated.View accessible={false} style={[styles.doorFrame, { borderColor: tokens.surface.border,
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
      <WordReveal text={t('onboarding.feature.explore.answer')}
        delay={450} stagger={130} align="left" caret={tokens.accent.text} style={[styles.message, { color: tokens.text.primary }]} />
    </StoryScene> : null}
    {step === 2 ? <StoryScene key="followup" delay={200} style={[styles.bubble, { backgroundColor: tokens.surface.raised, borderColor: tokens.surface.border }]}>
      <Text style={[styles.speaker, { color: tokens.accent.text }]}>Noctalia</Text>
      <TypingDots color={tokens.accent.text} hideAt={EXPLORE_BEATS.typing} style={styles.typing} />
      <WordReveal text={t('onboarding.story.explore.followup_start')} delay={afterTyping(EXPLORE_BEATS.typing)} stagger={60} align="left"
        style={[styles.message, { color: tokens.text.primary }]} />
    </StoryScene> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { gap: 12, paddingTop: 4, paddingBottom: 8 },
  // Inside the story frame the dialogue is centred, with breathing room on both sides.
  storyRoot: { width: '100%', justifyContent: 'center', paddingHorizontal: 16 },
  typing: { left: 16, top: 34 },
  doorFrame: { width: 64, height: 80, padding: 3, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, borderWidth: 1, alignSelf: 'center', marginBottom: 6, overflow: 'hidden' },
  door: { width: '100%', height: '100%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  example: { gap: GAP, paddingBottom: EXAMPLE_BOTTOM },
  doorSlot: { alignItems: 'center' },
  dialogue: { gap: GAP },
  prompt: { alignItems: 'center' },
  arch: { borderBottomLeftRadius: 14, borderBottomRightRadius: 14, borderWidth: 1, overflow: 'hidden' },
  // The 800 × 1000 painting, enlarged so the arch (same 4:5 proportions) frames its door.
  staircase: { position: 'absolute', top: 0, left: '-131%', width: '308%', height: '308%' },
  // The instruction is the screen's question: set large, in the story's serif, until it is answered.
  question: { fontFamily: Fonts.fraunces.medium, textAlign: 'center', maxWidth: 340, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 12 },
  bubble: { borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, gap: 4, marginRight: 24 },
  reply: { marginLeft: 24, marginRight: 0, borderBottomRightRadius: 6 },
  speaker: { fontFamily: Fonts.outfit.medium, fontSize: TypeScale.caption.fontSize, lineHeight: 16 },
  message: { fontFamily: Fonts.outfit.regular, fontSize: TypeScale.body.fontSize, lineHeight: TypeScale.body.lineHeight },
  // Two answers side by side, each a card with its own radio: there is one to pick.
  choices: { flexDirection: 'row', gap: 10 },
  choiceSlot: { flex: 1 },
  choice: { flex: 1, minHeight: 64, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  choiceText: { flex: 1, fontFamily: Fonts.outfit.medium, fontSize: TypeScale.bodySm.fontSize, lineHeight: 19 },
  closing: { fontFamily: Fonts.fraunces.regular, fontStyle: 'italic', fontSize: TypeScale.body.fontSize, lineHeight: 22, textAlign: 'center', paddingHorizontal: 8 },
});
