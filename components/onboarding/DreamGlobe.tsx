import type { ViewInstance } from 'react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { AccessibilityInfo, findNodeHandle, Platform, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/motion/PressableScale';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { NoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';

// Reuse the landing's artwork and Fibonacci sphere, with native image cards.
const IMAGES = [
  require('../../docs-src/static/img/dreams/staircase-480w.webp'),
  require('../../docs-src/static/img/dreams/harbour-480w.webp'),
  require('../../docs-src/static/img/dreams/tide-480w.webp'),
  require('../../docs-src/static/img/dreams/station-480w.webp'),
  require('../../docs-src/static/img/dreams/doors-480w.webp'),
  require('../../docs-src/static/img/dreams/cat-480w.webp'),
  require('../../docs-src/static/img/dreams/floating-480w.webp'),
  require('../../docs-src/static/img/dreams/frozen-lake-480w.webp'),
  require('../../docs-src/static/img/dreams/glass-teeth-480w.webp'),
  require('../../docs-src/static/img/dreams/no-driver-480w.webp'),
];
/** The dream told in Raconter (the staircase): it opens facing the reader, ringed in champagne. */
const TOLD_DREAM = 0;
/** The sphere point that faces the reader at the globe's opening rotation. */
const FRONT_POINT = 6;
const pointFor = (index: number) => POINTS[index === TOLD_DREAM ? FRONT_POINT : index === FRONT_POINT ? TOLD_DREAM : index];
/** The row holding the way back from a dream to the globe. */
const CONTROLS_HEIGHT = 44;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const POINTS = IMAGES.map((_, index) => {
  const y = 1 - ((index + 0.5) * 2) / IMAGES.length;
  const r = Math.sqrt(1 - y * y);
  return { x: Math.cos(index * GOLDEN_ANGLE) * r, y, z: Math.sin(index * GOLDEN_ANGLE) * r };
});
const DREAM_KEYS = [
  'constellation.dream_1', 'dream.harbour', 'constellation.dream_2', 'dream.station',
  'dream.doors', 'constellation.dream_3', 'dream.floating', 'dream.frozen-lake',
  'dream.glass-teeth', 'dream.no-driver',
];

/** The globe fills the stage it is given; the orbit ring follows its radius. */
function globeMetrics(width: number, height: number) {
  const radius = Math.min(width * 0.36, height * 0.33, 160);
  const cardWidth = Math.min(width * 0.3, height * 0.32, 140);
  return { radius, cardWidth, cardHeight: cardWidth * 1.25, orbit: radius * 1.75 };
}

function DreamCard({ index, rotation, width, height, onSelect, buttonRef, ring }: { index: number; rotation: SharedValue<number>; width: number; height: number; onSelect: (index: number) => void; buttonRef: (node: ViewInstance | null) => void; ring?: string }) {
  const { t } = useTranslation();
  const point = pointFor(index);
  const { radius, cardWidth, cardHeight } = globeMetrics(width, height);
  const position = useAnimatedStyle(() => {
    const yaw = rotation.get();
    const x = point.x * Math.cos(yaw) + point.z * Math.sin(yaw);
    const z = -point.x * Math.sin(yaw) + point.z * Math.cos(yaw);
    const perspective = 2.6 / (2.6 - z);
    return {
      transform: [
        { perspective: 500 },
        { translateX: x * radius * perspective },
        { translateY: point.y * radius * perspective },
        { scale: perspective },
        { rotateY: `${Math.atan2(x, z)}rad` },
        { rotateX: `${-Math.asin(point.y)}rad` },
      ],
      opacity: 0.35 + 0.65 * (z + 1) / 2,
      zIndex: Math.round((z + 1) * 10),
    };
  });

  return (
    <Animated.View
      style={[styles.card, { left: width / 2 - cardWidth / 2, top: (height - cardHeight) / 2, width: cardWidth, height: cardHeight }, ring ? { borderWidth: 2, borderColor: ring } : null, position]}
      testID={`component.onboarding.globeCard.${index}`}
    >
      <PressableScale
        ref={buttonRef}
        accessibilityRole="button"
        accessibilityLabel={t(`onboarding.feature.${DREAM_KEYS[index]}.title`)}
        onPress={() => onSelect(index)}
        style={styles.cardButton}
        testID={`btn.onboarding.globeCard.${index}`}
      >
        <Image source={IMAGES[index]} style={StyleSheet.absoluteFill} contentFit="cover" />
      </PressableScale>
    </Animated.View>
  );
}

export function DreamArtwork({ index }: { index: number }) {
  return <Image source={IMAGES[index]} style={StyleSheet.absoluteFill} contentFit="cover" />;
}

export function DreamGlobe({ tokens, stageHeight, onSelectionChange }: {
  tokens: NoctaliaDesignTokens; stageHeight: number; onSelectionChange?: (index: number) => void;
}) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [width, setWidth] = useState(300);
  const [selected, setSelected] = useState<number | null>(null);
  const entryTitle = useRef<ViewInstance | null>(null);
  const cardButtons = useRef<(ViewInstance | null)[]>([]);
  const previousSelection = useRef<number | null>(null);
  const rotation = useSharedValue(0.6);
  const origin = useSharedValue(0);
  useEffect(() => {
    const previous = previousSelection.current;
    previousSelection.current = selected;
    if (selected === null && previous === null) return;
    const timer = setTimeout(() => {
      const target = selected !== null ? entryTitle.current : cardButtons.current[previous!];
      if (Platform.OS === 'web') target?.focus();
      else {
        const node = findNodeHandle(target ?? null);
        if (node) AccessibilityInfo.setAccessibilityFocus(node);
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [selected]);
  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .enabled(!reducedMotion)
    .onStart(() => {
      cancelAnimation(rotation);
      origin.set(rotation.get());
    })
    .onUpdate((event) => rotation.set(origin.get() + event.translationX / 130))
    .onEnd((event) => {
      const velocity = event.velocityX / 130;
      const projected = ((velocity / 1000) * 0.998) / (1 - 0.998);
      rotation.set(withSpring(rotation.get() + projected, {
        duration: 300, dampingRatio: 0.8, velocity, reduceMotion: ReduceMotion.System,
      }));
    }), [origin, reducedMotion, rotation]);

  const rotate = (direction: number) => rotation.set(withSpring(rotation.get() + direction * Math.PI / 3, {
    duration: 300, dampingRatio: 0.8, reduceMotion: ReduceMotion.System,
  }));

  const { orbit } = globeMetrics(width, stageHeight);
  const select = (index: number) => {
    cancelAnimation(rotation);
    setSelected(index);
    onSelectionChange?.(index);
  };

  if (selected !== null) {
    return (
      <View>
        <View style={[styles.entry, { height: stageHeight - CONTROLS_HEIGHT }]} testID="component.onboarding.dreamEntry">
          <View style={[styles.entryImage, { height: stageHeight - CONTROLS_HEIGHT - 76, aspectRatio: 0.8 }]}>
            <DreamArtwork index={selected} />
          </View>
          <Text ref={entryTitle} {...(Platform.OS === 'web' ? { tabIndex: -1 as const } : {})} accessibilityRole="header" numberOfLines={1} style={[styles.entryTitle, { color: tokens.text.primary }]}>
            {t(`onboarding.feature.${DREAM_KEYS[selected]}.title`)}
          </Text>
          <Text numberOfLines={2} style={[styles.entryText, { color: tokens.text.secondary }]}>{t(`onboarding.feature.${DREAM_KEYS[selected]}.body`)}</Text>
        </View>
        <View style={styles.controls}>
          <PressableScale accessibilityRole="button" onPress={() => setSelected(null)} style={styles.back} testID="btn.onboarding.dreamEntry.back">
            <IconSymbol name="chevron.left" size={16} color={tokens.accent.text} />
            <Text style={[styles.hint, { color: tokens.accent.text }]}>{t('onboarding.feature.globe.back')}</Text>
          </PressableScale>
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      {reducedMotion ? (
        <View style={[styles.gallery, { height: stageHeight }]} testID="component.onboarding.dreamExamples">
          {IMAGES.slice(0, 3).map((source, index) => (
            <PressableScale ref={(node) => { cardButtons.current[index] = node; }} key={index} accessibilityRole="button" accessibilityLabel={t(`onboarding.feature.${DREAM_KEYS[index]}.title`)} onPress={() => select(index)} style={[styles.galleryImage, { height: Math.min(stageHeight * 0.8, 300) }]} testID={`btn.onboarding.globeCard.${index}`}>
              <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" />
            </PressableScale>
          ))}
        </View>
      ) : <GestureDetector gesture={pan}>
        <View
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          accessible={false}
          style={[styles.stage, { height: stageHeight }]}
          testID="component.onboarding.dreamGlobe"
        >
          <View pointerEvents="none" style={[styles.orbit, {
            borderColor: tokens.surface.border, width: orbit, height: orbit, borderRadius: orbit / 2,
            top: (stageHeight - orbit) / 2, left: (width - orbit) / 2,
          }]} />
          {IMAGES.map((_, index) => <DreamCard key={index} index={index} rotation={rotation} width={width} height={stageHeight} onSelect={select} buttonRef={(node) => { cardButtons.current[index] = node; }}
            ring={index === TOLD_DREAM ? tokens.accent.text : undefined} />)}
          {/* Turning buttons sit on the globe's flanks: the drag does the same, these keep it reachable. */}
          <PressableScale accessibilityRole="button" accessibilityLabel={t('onboarding.feature.globe.previous')} onPress={() => rotate(-1)} style={[styles.control, styles.controlStart]} testID="btn.onboarding.globe.previous">
            <IconSymbol name="chevron.left" size={20} color={tokens.accent.text} />
          </PressableScale>
          <PressableScale accessibilityRole="button" accessibilityLabel={t('onboarding.feature.globe.next')} onPress={() => rotate(1)} style={[styles.control, styles.controlEnd]} testID="btn.onboarding.globe.next">
            <IconSymbol name="chevron.right" size={20} color={tokens.accent.text} />
          </PressableScale>
        </View>
      </GestureDetector>}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%' },
  stage: { overflow: 'hidden' },
  orbit: { position: 'absolute', borderWidth: 1 },
  card: { position: 'absolute', borderRadius: 12, overflow: 'hidden', backfaceVisibility: 'hidden' },
  cardButton: { flex: 1 },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, minHeight: 44 },
  control: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  controlStart: { position: 'absolute', left: 0, top: '50%', marginTop: -22, zIndex: 30 },
  controlEnd: { position: 'absolute', right: 0, top: '50%', marginTop: -22, zIndex: 30 },
  hint: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  gallery: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  galleryImage: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  entry: { alignItems: 'center', gap: 7 },
  entryImage: { borderRadius: 18, overflow: 'hidden' },
  entryTitle: { fontFamily: Fonts.fraunces.regular, fontSize: 17, lineHeight: 22, textAlign: 'center' },
  entryText: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12 },
});
