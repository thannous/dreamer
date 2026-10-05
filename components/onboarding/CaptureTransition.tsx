import React, { useEffect } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import Animated, { ReduceMotion, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';

import { DURATION, EASE, EASING } from '@/components/motion/motion';
import type { NoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';
import { DreamArtwork } from './DreamGlobe';
import { FeatureStoryControls, StoryScene, useFeatureStory } from './FeatureStory';

const SYMBOLS = [
  { name: 'house', x: 44, y: 76, image: require('../../docs-src/static/img/starmap/house-160w.webp') },
  { name: 'door', x: 254, y: 104, image: require('../../docs-src/static/img/starmap/door-160w.webp') },
  { name: 'water', x: 230, y: 195, image: require('../../docs-src/static/img/starmap/water-160w.webp') },
] as const;
const AnimatedLine = Animated.createAnimatedComponent(Line);

function MemoryThread({ from, to, color, visible }: {
  from: typeof SYMBOLS[number]; to: typeof SYMBOLS[number]; color: string; visible: boolean;
}) {
  const progress = useSharedValue(0);
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  useEffect(() => {
    progress.set(withTiming(visible ? 1 : 0, {
      duration: DURATION.normal, easing: EASING.inOut, reduceMotion: ReduceMotion.System,
    }));
  }, [progress, visible]);
  const animatedProps = useAnimatedProps(() => ({
    opacity: progress.get(), strokeDashoffset: length * (1 - progress.get()),
  }));
  return <AnimatedLine x1={from.x} y1={from.y} x2={to.x} y2={to.y}
    stroke={color} strokeWidth={1.5} strokeDasharray={[length, length]} animatedProps={animatedProps} />;
}

/** The chosen memory stays present while the narrative opens the next chapter. */
export function CaptureTransition({ tokens, stageHeight, dreamIndex }: {
  tokens: NoctaliaDesignTokens; stageHeight: number; dreamIndex: number;
}) {
  const { t } = useTranslation();
  const story = useFeatureStory('captureTransition');
  const scene = Math.min(story.step, 2);
  const imageHeight = Math.min(220, stageHeight * 0.86);

  return <View>
    <View style={styles.copy}>
      <StoryScene key={scene}>
        <Text accessibilityLiveRegion="polite" style={[styles.sentence, { color: tokens.text.primary }]}>
          {t(`onboarding.narrative.capture.transition.${scene}`)}
        </Text>
      </StoryScene>
    </View>
    <View style={[styles.stage, { height: stageHeight }]}>
      <Animated.View accessible={false} style={[styles.memory, {
        width: imageHeight * 0.8, height: imageHeight,
        opacity: scene === 0 ? 1 : 0.82,
        transform: story.reduced ? [] : [{ translateY: scene === 0 ? 0 : -6 }, { scale: scene === 0 ? 1 : 0.94 }],
        transitionProperty: story.reduced ? ['opacity'] : ['opacity', 'transform'],
        transitionDuration: DURATION.fast, transitionTimingFunction: EASE.inOut,
      }]}>
        <DreamArtwork index={dreamIndex} />
      </Animated.View>
      <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
        <Svg aria-hidden focusable={false} width="100%" height={stageHeight} viewBox="0 0 300 240" preserveAspectRatio="none">
          <MemoryThread from={SYMBOLS[0]} to={SYMBOLS[1]} color={tokens.accent.text} visible={scene === 2} />
          <MemoryThread from={SYMBOLS[1]} to={SYMBOLS[2]} color={tokens.accent.text} visible={scene === 2} />
        </Svg>
      </View>
      {SYMBOLS.map((symbol, index) => scene >= (index === 2 ? 2 : 1) ? <StoryScene key={symbol.name}
        style={[styles.symbol, { left: `${symbol.x / 3}%`, top: symbol.y / 240 * stageHeight - 24 }]}>
        <View style={[styles.symbolImage, { borderColor: tokens.surface.border, backgroundColor: tokens.surface.base }]}>
          <Image source={symbol.image} style={styles.image} contentFit="cover" />
        </View>
        <Text style={[styles.label, { color: tokens.accent.text, backgroundColor: tokens.surface.base }]}>
          {t(`onboarding.feature.constellation.symbol.${symbol.name}`)}
        </Text>
      </StoryScene> : null)}
    </View>
    <FeatureStoryControls story={story} tokens={tokens} showSkip={false} endLabel={t('onboarding.feature.connect.title')} />
  </View>;
}

const styles = StyleSheet.create({
  copy: { minHeight: 108, justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 12 },
  sentence: { fontFamily: Fonts.fraunces.regular, fontSize: 25, lineHeight: 33, textAlign: 'center' },
  stage: { alignItems: 'center', justifyContent: 'center' },
  memory: { borderRadius: 18, overflow: 'hidden' },
  symbol: { position: 'absolute', width: 76, marginLeft: -38, alignItems: 'center', gap: 4 },
  symbolImage: { width: 48, height: 48, padding: 3, borderWidth: 1, borderRadius: 24 },
  image: { width: '100%', height: '100%', borderRadius: 20 },
  label: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 10, lineHeight: 16, paddingHorizontal: 4, borderRadius: 4 },
});
