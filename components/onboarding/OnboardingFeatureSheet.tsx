import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
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
  HEADLINE_SETTLE, Headline, STORY_DEMO_STEP, StoryProgress, StoryScene, useFeatureStory,
} from './FeatureStory';
import { SymbolConstellation } from './SymbolConstellation';
import { StoryButton } from './story/StoryButton';
import { StoryFrame, SUBTITLE_SPACE, SUBTITLE_STAGGER } from './story/StoryFrame';
import { StoryNight } from './story/StoryNight';
import { wordRevealDuration } from './story/StoryText';
import { TypeScale } from '@/constants/typeScale';

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

function FeatureNarrative({ feature, step, reduced, tokens, stageHeight, frameHeight, onAnswer }: {
  feature: OnboardingFeature; step: number; reduced: boolean; tokens: NoctaliaDesignTokens; stageHeight: number; frameHeight: number;
  /** Called when the reader answers the dialogue example, with how long Noctalia's reply takes. */
  onAnswer: (replyDuration: number) => void;
}) {
  const { t } = useTranslation();
  const demo = step === STORY_DEMO_STEP;
  const scene = demo ? 'demo' : String(step);
  const body = t(`onboarding.narrative.${feature}.${scene}.body`);
  // The dialogue example sets its own question, large, beside the door it is about.
  const dialogueExample = demo && feature === 'explore';
  const sceneHeight = demo ? stageHeight : frameHeight - SUBTITLE_SPACE;
  const visual = feature === 'capture' ? <CaptureStory step={step} reduced={reduced} tokens={tokens} stageHeight={sceneHeight} /> :
    feature === 'connect' ? <SymbolConstellation tokens={tokens} storyStep={demo ? undefined : step} stageHeight={sceneHeight} /> :
      <DialogueStory step={step} tokens={tokens} stageHeight={sceneHeight} onAnswer={onAnswer} />;
  return <View style={styles.narrative}>
    <View key={step} style={[styles.copy, (!demo || dialogueExample) && styles.storyCopy]}>
      <Headline text={t(`onboarding.narrative.${feature}.${scene}.title`)} lineHeight={styles.title.lineHeight}
        style={[styles.title, { color: tokens.text.primary }]} />
      {demo && !dialogueExample ? <StoryScene delay={HEADLINE_SETTLE}>
        <Text style={[styles.body, { color: tokens.text.secondary, textShadowColor: tokens.illustration.scrim }]}>{body}</Text>
      </StoryScene> : null}
    </View>
    <View testID={`component.onboarding.preview.${feature}`}>
      <View testID={`component.onboarding.story.${feature}.${step}`}>
        {/* Each slide is a scene played in the same night; its sentence is the subtitle. */}
        {demo ? visual : <StoryFrame height={frameHeight} tokens={tokens} subtitle={body}
          subtitleDelay={SUBTITLE_DELAYS[feature][step]} sceneKey={step}>
          <View key={step} style={styles.sceneSlot}>{visual}</View>
        </StoryFrame>}
      </View>
    </View>
  </View>;
}

type FooterLink = { label: string; testID: string; onPress: () => void };

/** How long a fresh page's skip ignores taps, in milliseconds. */
const SKIP_GUARD = 400;

/**
 * The page-turning footer: one button, always in the same place. It arrives once
 * the scene has finished telling its part (`readyAt`, or once the reader has
 * answered when it is null), and its label names what comes next. The header's
 * back control turns pages the other way; the close button leaves at any time.
 */
function StoryFooter({ label, testID, readyAt, readyKey, tokens, onNext, skip }: {
  label: string; testID: string; readyAt: number | null; tokens: NoctaliaDesignTokens; onNext: () => void;
  /** Changes when the wait starts over, such as a new answer that takes as long as the last one. */
  readyKey?: unknown;
  /** Turns the page without waiting for the scene, in the button's place: it gives way once the button arrives. */
  skip?: FooterLink;
}) {
  const [ready, setReady] = useState(readyAt !== null && readyAt <= 0);
  useEffect(() => {
    if (ready || readyAt === null) return;
    const timer = setTimeout(() => setReady(true), readyAt);
    return () => clearTimeout(timer);
  }, [ready, readyAt, readyKey]);
  // A page's skip ignores the first moments after the turn, so a double tap cannot skip two pages.
  const [skipArmed, setSkipArmed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSkipArmed(true), SKIP_GUARD);
    return () => clearTimeout(timer);
  }, []);
  return <BottomSheetActions>
    <View>
      <StoryArrival shown={ready}>
        <StoryButton label={label} onPress={onNext} disabled={!ready} testID={testID} tokens={tokens} />
      </StoryArrival>
      {/* The skip waits with the reader in the button's place and fades out as the button
          arrives there: no row of its own, so the scene keeps the room under it. */}
      {skip ? <StoryArrival shown={!ready} style={StyleSheet.absoluteFill}>
        {/* Once the button is there, the faded skip lets every tap through to it. On the web a
            parent's pointerEvents reaches only its direct children, so the text says it too. */}
        <PressableScale accessibilityRole="button" onPress={skip.onPress} disabled={ready || !skipArmed}
          pointerEvents={ready ? 'none' : 'auto'} testID={skip.testID} style={styles.link}>
          <Text pointerEvents="none" style={[styles.linkText, { color: tokens.text.secondary }]}>{skip.label}</Text>
        </PressableScale>
      </StoryArrival> : null}
    </View>
  </BottomSheetActions>;
}

/** A footer control rises into place when it becomes available; until then it holds its room, hidden. */
function StoryArrival({ shown, style, children }: { shown: boolean; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  return <Animated.View
    pointerEvents={shown ? 'auto' : 'none'}
    accessibilityElementsHidden={!shown}
    importantForAccessibility={shown ? 'auto' : 'no-hide-descendants'}
    style={[style, {
      opacity: shown ? 1 : 0,
      transform: [{ translateY: shown ? 0 : 10 }],
      transitionProperty: ['opacity', 'transform'],
      transitionDuration: DURATION.normal,
      transitionTimingFunction: EASE.out,
    }]}
  >{children}</Animated.View>;
}

export function OnboardingFeatureSheet({ feature: opening, onClose, ending }: {
  /** The chapter the stories open on. */
  feature: OnboardingFeature; onClose: () => void;
  /** How the last page ends the stories: its button's label and where it leads. */
  ending: { label: string; onFinish: () => void };
}) {
  const { t } = useTranslation();
  const tokens = NIGHT;
  const reduced = useReducedMotion();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Tall enough to be the night itself; the onboarding stays visible above it.
  const sheetHeight = Math.max(160, Math.min(height * 0.86, height - insets.top - insets.bottom - 40) - 24);
  // The sheet turns its own chapters and pages: the scene and its footer change in one
  // render, and the onboarding behind the sheet is never rendered again.
  const story = useFeatureStory(CHAPTERS, opening);
  const feature = story.chapter;
  const step = story.step;
  const nextChapter = story.nextChapter;
  const demo = step === STORY_DEMO_STEP;
  const page = `${feature}-${step}`;
  // Noctalia's reply once the dialogue example is answered, null until then. Each answer is
  // a new object, so a second answer restarts the wait even when it takes as long as the first.
  // Every page turn starts it over: the example opens unanswered each time.
  const [reply, setReply] = useState<{ duration: number } | null>(null);
  const [replyPage, setReplyPage] = useState(page);
  if (replyPage !== page) {
    setReplyPage(page);
    setReply(null);
  }
  const replyDuration = reply?.duration ?? null;
  // Pages already read keep their button ready when the reader comes back to them.
  const [readPages, setReadPages] = useState<ReadonlySet<string>>(() => new Set());
  const turn = (go: () => void) => {
    if (!readPages.has(page)) setReadPages(new Set(readPages).add(page));
    go();
  };
  const awaitsAnswer = demo && feature === 'explore';
  const subtitle = t(`onboarding.narrative.${feature}.${demo ? 'demo' : step}.body`);
  // Wait for the scene's subtitle to land; the example only needs its headline,
  // and the dialogue example waits for the reader's answer and Noctalia's reply.
  const readyAt = awaitsAnswer ? (replyDuration === null ? null : reduced ? 0 : replyDuration)
    : reduced || readPages.has(page) ? 0 : demo ? HEADLINE_SETTLE + DURATION.normal
      : SUBTITLE_DELAYS[feature][step] + wordRevealDuration(subtitle, SUBTITLE_STAGGER);
  const finish = !nextChapter && demo;
  // The skip turns the page at once, without waiting for the scene; on the unanswered
  // example it goes on without an answer.
  const skip = !demo || (awaitsAnswer && replyDuration === null) ? {
    label: t('onboarding.story.skip'), testID: 'btn.onboarding.story.skip',
    onPress: () => turn(() => (demo ? ending.onFinish() : story.next())),
  } : undefined;

  // Only the cross closes the stories, and it asks first: no swipe can end them by accident.
  return <StandardBottomSheet visible onClose={onClose} dismissBehavior="none" title={t(`onboarding.feature.${feature}.title`)} focusKey={page}
    testID="sheet.onboarding.feature" style={{ height: sheetHeight, ...(Platform.OS === 'web' ? { width } : {}) }}
    surfaceColor={tokens.screen.background} transparentContent
    // The whole sheet is the night: sky, stars, and a shooting star at each page.
    background={<StoryNight tokens={tokens} page={{ key: `${feature}-${step}`, index: CHAPTERS.indexOf(feature) * 4 + step }} />}
    closeIconColor={tokens.text.primary}
    dragIndicatorColor={tokens.text.secondary} showsVerticalScrollIndicator={false}
    headerContent={<StoryProgress step={step} tokens={tokens} />}
    backButton={story.canGoBack ? { label: t('onboarding.back'), onPress: () => turn(story.back), testID: 'btn.onboarding.story.back' } : undefined}
    footer={<StoryFooter key={page} tokens={tokens} readyAt={readyAt} readyKey={reply}
      label={finish ? ending.label
        : t(demo ? `onboarding.narrative.continue.${nextChapter}` : `onboarding.narrative.${feature}.${step}.next`)}
      skip={skip}
      testID={demo ? 'btn.onboarding.story.continue' : 'btn.onboarding.story.next'}
      onNext={() => turn(() => {
        if (!demo) story.next();
        else if (nextChapter) story.open(nextChapter);
        else ending.onFinish();
      })}
    />}
    closeButton={{ label: t('journal.detail.share_modal.close'), testID: 'btn.onboarding.feature.close' }}>
    {/* Only the narrative resets. The sheet host and its close control stay in place. */}
    <FeatureNarrative key={feature} feature={feature} step={step} reduced={reduced} tokens={tokens}
      onAnswer={(duration) => setReply({ duration })}
      // The example's globe takes the room the copy and the button leave it.
      stageHeight={Math.max(200, Math.min(420, sheetHeight - 350))}
      // Leaves room under the scene for the button's glow.
      frameHeight={Math.max(230, Math.min(440, sheetHeight - 290))} />
  </StandardBottomSheet>;
}

const styles = StyleSheet.create({
  // Air between the scene and the footer, so captions never touch the button.
  narrative: { paddingTop: 4, paddingBottom: 20 },
  // Room for the word and a two-line sentence, so the image never jumps between slides.
  copy: { alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 18, minHeight: 132 },
  // Above a scene, the word stands alone; the sentence plays as the scene's subtitle.
  storyCopy: { minHeight: 0, paddingBottom: 14 },
  sceneSlot: { width: '100%', alignItems: 'center', paddingHorizontal: 12 },
  title: { fontFamily: Fonts.fraunces.semiBold, fontSize: 44, lineHeight: 52, textAlign: 'center' },
  // Shaded like the subtitles, so it stays legible over the moon.
  body: { fontFamily: Fonts.outfit.regular, fontSize: TypeScale.body.fontSize, lineHeight: TypeScale.body.lineHeight, textAlign: 'center', maxWidth: 300, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 12 },
  // Fills the button's place: the whole slot takes the tap, the words sit where the label will.
  link: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  linkText: { fontFamily: Fonts.outfit.medium, fontSize: TypeScale.bodySm.fontSize, lineHeight: 20 },
});
