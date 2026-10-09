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
import { WordReveal } from './story/StoryText';

const ARTWORK = require('../../docs-src/static/img/dreams/staircase-480w.webp');
const VOICE_BARS = [10, 20, 32, 24, 38, 26, 16, 10];
/** Details of the dream that slip away on waking, each from its own place around it. */
const FADING = [
  { key: 'door', left: '-34%', top: '14%' },
  { key: 'house', left: '62%', top: '46%' },
] as const;

/** Beats of the telling scene, in milliseconds from the slide's arrival. */
export const CAPTURE_BEATS = {
  /** The dream has appeared; its subtitle can follow. */
  dream: 1500,
  /** The details have flown; the subtitle names what happened. */
  forget: 2600,
  /** The fragment is written, the dream returns, and we are carried to its door. */
  tell: 4200,
} as const;

/** Where the blue door sits in the staircase painting, as fractions of the card. */
const DOOR = { x: 0.58, y: 0.1 } as const;
/** How close the camera gets: enough to reach the door without uncovering an edge. */
const DOOR_ZOOM = 2.4;
/** Where the door lands in the card once the camera arrives. */
const DOOR_LANDING_Y = 0.22;
/** The door's middle once landed, where its light gathers. */
const DOOR_GLOW_Y = 0.3;
/** The telling scene, in milliseconds from the slide's arrival. */
const TELL = { fade: 1900, light: 1900, push: 2300, pushFor: 2800, glow: 4000 } as const;

function DreamCard({ height, tokens }: { height: number; tokens: NoctaliaDesignTokens }) {
  return <View accessible={false} style={[styles.card, { width: height * 0.76, height, borderColor: tokens.surface.border }]}>
    <Image source={ARTWORK} style={StyleSheet.absoluteFill} contentFit="cover" />
  </View>;
}

/**
 * Raconter, told as a night: a dream appears, slips away on waking, then comes
 * back once it is told. Each scene plays once when its slide arrives.
 */
export function CaptureStory({ step, reduced, tokens, stageHeight, onDreamChange }: {
  step: number; reduced: boolean; tokens: NoctaliaDesignTokens; stageHeight: number; onDreamChange?: (index: number) => void;
}) {
  const { t } = useTranslation();
  if (step === STORY_DEMO_STEP) return <StoryScene><DreamGlobe tokens={tokens} stageHeight={stageHeight} onSelectionChange={onDreamChange} /></StoryScene>;
  const cardHeight = Math.max(120, Math.min(190, stageHeight - 24));
  const cardWidth = cardHeight * 0.76;

  if (step === 0) {
    // The dream appears out of the dark and floats, as dreams do.
    return <View style={[styles.stage, { height: stageHeight }]}>
      <Animated.View accessible={false} style={[styles.halo, {
        width: cardHeight * 1.5, height: cardHeight * 1.5, borderRadius: cardHeight, backgroundColor: tokens.accent.text,
      }, !reduced && {
        animationName: { from: { opacity: 0.04, transform: [{ scale: 0.9 }] }, to: { opacity: 0.16, transform: [{ scale: 1.05 }] } },
        animationDuration: 2800, animationIterationCount: 'infinite', animationDirection: 'alternate', animationTimingFunction: EASE.inOut,
      }]} />
      <Animated.View style={!reduced && {
        animationName: { from: { transform: [{ translateY: 4 }] }, to: { transform: [{ translateY: -4 }] } },
        animationDuration: 3200, animationIterationCount: 'infinite', animationDirection: 'alternate', animationTimingFunction: EASE.inOut,
      }}>
        <Animated.View style={!reduced && {
          animationName: { from: { opacity: 0, transform: [{ scale: 0.86 }] }, to: { opacity: 1, transform: [{ scale: 1 }] } },
          animationDuration: 1400, animationDelay: 200, animationTimingFunction: EASE.out, animationFillMode: 'both',
        }}>
          <DreamCard height={cardHeight} tokens={tokens} />
        </Animated.View>
      </Animated.View>
    </View>;
  }

  if (step === 1) {
    // On waking the image dims while its details drift off, one after another.
    return <View style={[styles.stage, { height: stageHeight }]}>
      <Animated.View style={reduced ? { opacity: 0.35 } : {
        animationName: { from: { opacity: 1, transform: [{ scale: 1 }] }, to: { opacity: 0.16, transform: [{ scale: 0.95 }] } },
        animationDuration: 2600, animationDelay: 900, animationTimingFunction: EASE.inOut, animationFillMode: 'both',
      }}>
        <DreamCard height={cardHeight} tokens={tokens} />
      </Animated.View>
      <View pointerEvents="none" style={[styles.detailLayer, { width: cardWidth, height: cardHeight }]}>
        {FADING.map((detail, index) => <Animated.View key={detail.key} accessible={false} style={[styles.detail, {
          left: detail.left, top: detail.top, borderColor: tokens.accent.text, backgroundColor: tokens.illustration.scrim,
        }, reduced ? { opacity: 0 } : {
          animationName: {
            '0%': { opacity: 0, transform: [{ translateY: 8 }] },
            '18%': { opacity: 1, transform: [{ translateY: 0 }] },
            '55%': { opacity: 1, transform: [{ translateY: -6 }] },
            '100%': { opacity: 0, transform: [{ translateY: -56 }] },
          },
          animationDuration: 3200, animationDelay: 300 + index * 450, animationTimingFunction: EASE.inOut, animationFillMode: 'both',
        }]}>
          <Text style={[styles.detailText, { color: tokens.illustration.text }]}>
            {t(`onboarding.feature.constellation.symbol.${detail.key}`)}
          </Text>
        </Animated.View>)}
      </View>
    </View>;
  }

  // Told in a few words, the dream comes back into the light, and the camera
  // climbs the staircase to the blue door it was all about.
  const reach = Math.min(1.45, (stageHeight - 16) / cardHeight);
  return <View style={[styles.stage, { height: stageHeight }]}>
    <Animated.View style={reduced ? null : {
      animationName: { from: { opacity: 0.16 }, to: { opacity: 1 } },
      animationDuration: 900, animationDelay: TELL.light, animationTimingFunction: EASE.out, animationFillMode: 'both',
    }}>
      <Animated.View style={reduced ? null : {
        animationName: { from: { transform: [{ scale: 1 }] }, to: { transform: [{ scale: reach }] } },
        animationDuration: TELL.pushFor, animationDelay: TELL.push, animationTimingFunction: EASE.inOut, animationFillMode: 'both',
      }}>
        <View accessible={false} style={[styles.card, { width: cardWidth, height: cardHeight, borderColor: tokens.surface.border }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: `${DOOR.x * 100}% ${DOOR.y * 100}%` }, !reduced && {
            animationName: {
              from: { transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] },
              to: { transform: [
                { translateX: (0.5 - DOOR.x) * cardWidth },
                { translateY: (DOOR_LANDING_Y - DOOR.y) * cardHeight },
                { scale: DOOR_ZOOM },
              ] },
            },
            animationDuration: TELL.pushFor, animationDelay: TELL.push, animationTimingFunction: EASE.inOut, animationFillMode: 'both',
          }]}>
            <Image source={ARTWORK} style={StyleSheet.absoluteFill} contentFit="cover" />
          </Animated.View>
          {/* Light from behind the door once we reach it. */}
          {!reduced ? <Animated.View pointerEvents="none" style={[styles.doorGlow, {
            left: cardWidth / 2 - 30, top: cardHeight * DOOR_GLOW_Y - 30,
            backgroundColor: tokens.illustration.text,
            boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 40, spreadDistance: 8, color: tokens.illustration.text }],
            animationName: {
              '0%': { opacity: 0, transform: [{ scale: 0.7 }] },
              '40%': { opacity: 0.28, transform: [{ scale: 1 }] },
              '100%': { opacity: 0.14, transform: [{ scale: 1.2 }] },
            },
            animationDuration: 2400, animationDelay: TELL.glow, animationIterationCount: 'infinite', animationDirection: 'alternate',
            animationTimingFunction: EASE.inOut, animationFillMode: 'both',
          }]} /> : null}
        </View>
      </Animated.View>
    </Animated.View>
    <Animated.View pointerEvents="none" style={[styles.telling, !reduced && {
      animationName: { from: { opacity: 1 }, to: { opacity: 0 } },
      animationDuration: 500, animationDelay: TELL.fade, animationTimingFunction: EASE.out, animationFillMode: 'both',
    }]}>
      <View accessible={false} style={styles.voice}>
        {VOICE_BARS.map((height, index) => <Animated.View key={index} style={[
          styles.voiceBar, { height, backgroundColor: tokens.accent.text },
          !reduced && {
            animationName: { from: { opacity: 0.45, transform: [{ scaleY: 0.3 }] }, to: { opacity: 1, transform: [{ scaleY: 1 }] } },
            animationDuration: DURATION.slow, animationDelay: index * 90, animationTimingFunction: EASE.inOut,
            animationIterationCount: 'infinite', animationDirection: 'alternate', animationFillMode: 'both',
          },
        ]} />)}
      </View>
      <WordReveal text={t('onboarding.story.capture.fragment')} delay={300} stagger={150} caret={tokens.accent.text}
        style={[styles.fragment, { color: tokens.illustration.text, textShadowColor: tokens.illustration.scrim }]} />
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  stage: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute' },
  card: { borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, overflow: 'hidden' },
  detailLayer: { position: 'absolute' },
  doorGlow: { position: 'absolute', width: 60, height: 60, borderRadius: 30 },
  detail: { position: 'absolute', borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  detailText: { fontFamily: Fonts.fraunces.medium, fontSize: 15, lineHeight: 20 },
  telling: { position: 'absolute', left: 16, right: 16, alignItems: 'center', gap: 14 },
  voice: { flexDirection: 'row', height: 40, gap: 5, alignItems: 'center' },
  voiceBar: { width: 4, borderRadius: 2 },
  // A soft shadow keeps the words legible over the brightening dream.
  fragment: { fontFamily: Fonts.fraunces.medium, fontSize: 22, lineHeight: 30, textAlign: 'center', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 10 },
});
