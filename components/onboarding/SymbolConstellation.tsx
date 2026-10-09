import React, { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import Animated, { ReduceMotion, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion/PressableScale';
import { DURATION, EASE, EASING } from '@/components/motion/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { NoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';
import { StoryScene } from './FeatureStory';

type SymbolName = 'house' | 'door' | 'water' | 'cat';
const SYMBOLS: { id: SymbolName; x: number; y: number; image: number }[] = [
  { id: 'house', x: 150, y: 105, image: require('../../docs-src/static/img/starmap/house-160w.webp') },
  { id: 'door', x: 245, y: 48, image: require('../../docs-src/static/img/starmap/door-160w.webp') },
  { id: 'water', x: 55, y: 154, image: require('../../docs-src/static/img/starmap/water-160w.webp') },
  { id: 'cat', x: 178, y: 205, image: require('../../docs-src/static/img/starmap/cat-160w.webp') },
];
// Three accounts from the landing, with their original symbol associations.
const DREAMS: { symbols: SymbolName[] }[] = [
  { symbols: ['house', 'door'] },
  { symbols: ['water', 'house'] },
  { symbols: ['cat', 'house'] },
];
const MAP_HEIGHT = 256;

const AnimatedLine = Animated.createAnimatedComponent(Line);

function ConstellationLink({ from, to, color, selected, weight }: {
  from: typeof SYMBOLS[number]; to: typeof SYMBOLS[number]; color: string; selected: boolean; weight: number;
}) {
  const progress = useSharedValue(0);
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  useEffect(() => {
    progress.set(withTiming(1, { duration: DURATION.normal, easing: EASING.inOut, reduceMotion: ReduceMotion.System }));
  }, [progress]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - progress.get()) }));
  return <AnimatedLine x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color}
    strokeWidth={weight} opacity={selected ? 1 : 0.4} strokeDasharray={[length, length]} animatedProps={animatedProps} />;
}

export function SymbolConstellation({ tokens, storyStep, onInteraction, stageHeight, startAt = 0 }: {
  tokens: NoctaliaDesignTokens; storyStep?: number; onInteraction?: () => void; stageHeight?: number;
  /** The dream the interactive example opens on: the last one the story showed. */
  startAt?: number;
}) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  // A story slide mounts on its own scene, so it starts there rather than at the first dream.
  const [current, setCurrent] = useState(storyStep ?? startAt);
  const [selected, setSelected] = useState<SymbolName>('house');
  const [inspecting, setInspecting] = useState(false);
  const [width, setWidth] = useState(300);
  const [previousStoryStep, setPreviousStoryStep] = useState(storyStep);
  // Synchronize a new scene before rendering children; manual choices otherwise persist.
  if (previousStoryStep !== storyStep) {
    setPreviousStoryStep(storyStep);
    if (storyStep !== undefined) {
      setCurrent(storyStep);
      setSelected('house');
      setInspecting(false);
    }
  }
  // As a story slide the map fits the stage; the interactive example keeps its full size.
  const mapHeight = storyStep !== undefined && stageHeight ? Math.min(MAP_HEIGHT, stageHeight) : MAP_HEIGHT;
  const mapScale = mapHeight / MAP_HEIGHT;
  const seen = DREAMS.slice(0, current + 1);
  const count = (id: SymbolName) => seen.filter((dream) => dream.symbols.includes(id)).length;
  const related = seen.flatMap((dream, index) => dream.symbols.includes(selected) ? [index] : []);
  const advance = (direction: number) => {
    onInteraction?.();
    const next = Math.max(0, Math.min(DREAMS.length - 1, current + direction));
    if (!DREAMS.slice(0, next + 1).some((dream) => dream.symbols.includes(selected))) setSelected('house');
    setCurrent(next);
  };
  const select = (id: SymbolName) => { onInteraction?.(); setSelected(id); setInspecting(true); };

  return (
    <View style={styles.root}>
      {storyStep === undefined ? <View style={styles.controls}>
        <PressableScale accessibilityRole="button" accessibilityLabel={t('onboarding.feature.constellation.previous')} disabled={current === 0} onPress={() => advance(-1)} style={styles.control} testID="btn.onboarding.constellation.previous">
          <IconSymbol name="chevron.left" size={18} color={current === 0 ? tokens.text.tertiary : tokens.accent.text} />
        </PressableScale>
        <Text accessibilityLiveRegion="polite" style={[styles.progress, { color: tokens.text.secondary }]}>
          {t('onboarding.feature.constellation.progress', { current: current + 1, total: DREAMS.length })}
        </Text>
        <PressableScale accessibilityRole="button" accessibilityLabel={t('onboarding.feature.constellation.next')} disabled={current === DREAMS.length - 1} onPress={() => advance(1)} style={styles.control} testID="btn.onboarding.constellation.next">
          <IconSymbol name="arrow.right" size={18} color={current === DREAMS.length - 1 ? tokens.text.tertiary : tokens.accent.text} />
        </PressableScale>
      </View> : null}
      {storyStep === undefined ? <StoryScene key={current} style={[styles.story, { backgroundColor: tokens.surface.soft, borderColor: tokens.surface.border }]}>
        <Text style={[styles.storyTitle, { color: tokens.text.primary }]}>{t(`onboarding.feature.constellation.dream_${current + 1}.title`)}</Text>
        <Text style={[styles.storyText, { color: tokens.text.secondary }]}>{t(`onboarding.feature.constellation.dream_${current + 1}.body`)}</Text>
        <View style={styles.tags}>
          {DREAMS[current].symbols.map((id) => (
            <PressableScale key={id} accessibilityRole="button" onPress={() => select(id)} style={styles.tag} accessibilityLabel={t(`onboarding.feature.constellation.symbol.${id}`)}>
              <Text style={[styles.tagText, { color: tokens.accent.text }]}>{t(`onboarding.feature.constellation.symbol.${id}`)}</Text>
            </PressableScale>
          ))}
        </View>
      </StoryScene> : null}
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ height: mapHeight }}>
        <Svg aria-hidden focusable={false} width="100%" height={mapHeight} viewBox={`0 0 300 ${MAP_HEIGHT}`} preserveAspectRatio="none">
          {seen.map((dream, index) => {
            const from = SYMBOLS.find((symbol) => symbol.id === dream.symbols[0])!;
            const to = SYMBOLS.find((symbol) => symbol.id === dream.symbols[1])!;
            return <ConstellationLink key={index} from={from} to={to} color={tokens.accent.soft}
              weight={1 + 0.6 * (count(from.id) - 1 + count(to.id) - 1)} selected={dream.symbols.includes(selected)} />;
          })}
        </Svg>
        {SYMBOLS.map((symbol) => {
          const born = count(symbol.id) > 0;
          return born ? (
            <StoryScene key={symbol.id} style={[styles.node, { left: symbol.x / 300 * width - 27, top: symbol.y * mapScale - 27 }]}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`${t(`onboarding.feature.constellation.symbol.${symbol.id}`)}, ${t('onboarding.feature.constellation.related', { count: count(symbol.id), total: seen.length })}`}
              accessibilityHint={t('onboarding.feature.constellation.select_hint')}
              accessibilityState={{ selected: selected === symbol.id }}
              onPress={() => select(symbol.id)}
              style={styles.nodeButton}
              testID={`btn.onboarding.constellation.symbol.${symbol.id}`}
            >
              {/* In the story, a symbol that returns breathes: the eye finds what repeats. */}
              {storyStep !== undefined && count(symbol.id) > 1 && !reduced ? <Animated.View pointerEvents="none" style={[styles.halo, {
                backgroundColor: tokens.accent.text,
                animationName: { from: { opacity: 0.08, transform: [{ scale: 0.9 }] }, to: { opacity: 0.4, transform: [{ scale: 1.35 }] } },
                animationDuration: 1600, animationDelay: 600, animationIterationCount: 'infinite', animationDirection: 'alternate',
                animationTimingFunction: EASE.inOut, animationFillMode: 'both',
              }]} /> : null}
              <View style={[styles.nodeImageBorder, { borderColor: selected === symbol.id ? tokens.accent.text : tokens.surface.border, borderWidth: selected === symbol.id ? 2 : 1 }]}>
                <Image source={symbol.image} style={styles.nodeImage} contentFit="cover" />
                {count(symbol.id) > 1 ? <View style={[styles.count, { backgroundColor: tokens.surface.base, borderColor: tokens.accent.text }]}>
                  <Text style={[styles.countText, { color: tokens.accent.text }]}>{count(symbol.id)}</Text>
                </View> : null}
              </View>
              <Text style={[styles.nodeLabel, { color: selected === symbol.id ? tokens.accent.text : tokens.text.secondary }]}>{t(`onboarding.feature.constellation.symbol.${symbol.id}`)}</Text>
            </PressableScale>
            </StoryScene>
          ) : null;
        })}
      </View>
      {storyStep === undefined || inspecting ? <View style={[styles.selection, storyStep !== undefined && styles.selectionOverlay, { backgroundColor: storyStep !== undefined ? tokens.surface.raised : tokens.surface.soft, borderColor: tokens.surface.border }]} accessibilityLiveRegion={storyStep === undefined ? 'polite' : 'none'} testID="component.onboarding.constellation.selection">
        <Text style={[styles.selectionTitle, { color: tokens.text.primary }]}>
          {t(`onboarding.feature.constellation.symbol.${selected}`)}{' · '}{t('onboarding.feature.constellation.related', { count: related.length, total: seen.length })}
        </Text>
        {related.map((index) => <Text key={index} style={[styles.related, { color: tokens.text.secondary }]}>{t(`onboarding.feature.constellation.dream_${index + 1}.title`)}</Text>)}
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Full width in a story frame too: node positions are fractions of the measured width.
  root: { width: '100%', paddingTop: 4 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  control: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  progress: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 12, lineHeight: 18 },
  story: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 6 },
  storyTitle: { fontFamily: Fonts.fraunces.regular, fontSize: 17, lineHeight: 23 },
  storyText: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 12, lineHeight: 18 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tag: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 },
  tagText: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 12, lineHeight: 18, textDecorationLine: 'underline' },
  node: { position: 'absolute', width: 54, minHeight: 70, alignItems: 'center', gap: 5 },
  nodeButton: { alignItems: 'center', gap: 5 },
  nodeImageBorder: { width: 54, height: 54, borderRadius: 27, padding: 3 },
  nodeImage: { width: '100%', height: '100%', borderRadius: 24 },
  nodeLabel: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  count: { position: 'absolute', right: -6, top: -6, width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 11, lineHeight: 16 },
  selection: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 5 },
  // Over a story scene the detail floats on it instead of pushing the frame open.
  selectionOverlay: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  halo: { position: 'absolute', top: 0, width: 54, height: 54, borderRadius: 27 },
  selectionTitle: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 12, lineHeight: 18 },
  related: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 11, lineHeight: 17 },
});
