import { Image } from 'expo-image';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { EASE } from '@/components/motion/motion';
import { LivingPainting } from '@/components/symbols/LivingPainting';
import { MarkdownText } from '@/components/ui/MarkdownText';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';
import { atlasPictureSources, type AtlasScene, type SymbolAtlas } from '@/lib/symbolAtlas';
import type { SymbolLanguage, SymbolVariation } from '@/lib/symbolTypes';
import { TypeScale } from '@/constants/typeScale';

type Tokens = ReturnType<typeof getNoctaliaDesignTokens>;

const TILE_GAP = 10;

// A newly chosen painting dawns over the one it replaces. One object, so a render of
// the section never starts it again.
const DAWN = {
  animationName: { from: { opacity: 0 }, to: { opacity: 1 } },
  animationDuration: 450,
  animationTimingFunction: EASE.out,
  animationFillMode: 'both',
} as const;

export interface SceneReading {
  scene: AtlasScene;
  /** The variation card the scene paints: its context names the scene. */
  label: string;
  question: string;
  excerpt: string;
}

/**
 * Each scene with the variation card it paints, read as the site reads it: the card's
 * opening question apart when it opens with one, every sentence kept. A scene whose card
 * this language does not have is left out.
 */
export function readScenes(scenes: AtlasScene[], variations: SymbolVariation[], lang: SymbolLanguage): SceneReading[] {
  return scenes.flatMap((scene) => {
    const context = scene.variation[lang];
    const card = context === undefined ? undefined : variations.find((variation) => variation.context === context);
    if (!card) return [];
    const meaning = card.meaning.trim();
    const first = meaning.search(/[.?!](\s|$)/);
    const question = first !== -1 && meaning[first] === '?' ? meaning.slice(0, first + 1) : '';
    return [{ scene, label: card.context, question, excerpt: meaning.slice(question.length).trim() }];
  });
}

/** A painting on show: the chosen one, and the one it is dawning over. */
interface Shown {
  key: number;
  index: number;
  /** Chosen by a tap, so it dawns and its textures arrive; the first one waits at rest. */
  chosen: boolean;
}

interface SymbolScenesProps {
  atlas: SymbolAtlas;
  symbolId: string;
  /** From `readScenes`; the section shows only when there is at least one. */
  readings: SceneReading[];
  /** The reading column's width. */
  width: number;
  noctalia: Tokens;
}

/**
 * The common scenes of a symbol, painted. Three small paintings to choose from; the chosen
 * one is shown large across the column, its textures arriving once, with the reading of
 * its variation card under it. The first scene is chosen from the start and waits at rest.
 */
export function SymbolScenes({ atlas, symbolId, readings, width, noctalia }: SymbolScenesProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const tileSources = useMemo(
    () => readings.map(({ scene }) => atlasPictureSources(atlas, symbolId, scene.image)),
    [atlas, readings, symbolId],
  );
  const [shown, setShown] = useState<Shown[]>([{ key: 0, index: 0, chosen: false }]);
  const current = shown[shown.length - 1];
  // Content refreshed under the section can hold fewer scenes: start again from the first.
  if (current.index >= readings.length && readings.length > 0) {
    setShown([{ key: current.key + 1, index: 0, chosen: false }]);
  }
  const reading = readings[current.index];

  const choose = useCallback((index: number) => {
    setShown((list) => {
      const last = list[list.length - 1];
      // Keyed by order of choice, the replaced painting stays mounted under the new one.
      return last.index === index ? list : [last, { key: last.key + 1, index, chosen: true }];
    });
  }, []);

  if (!reading) return null;

  const tileWidth = (width - TILE_GAP * (readings.length - 1)) / readings.length;
  const picture = reading.scene.image;
  const frame = { width, height: Math.round((width * picture.height) / picture.width) };

  return (
    <View style={styles.root}>
      <Text style={[styles.hint, { color: noctalia.text.secondary }]}>{t('symbols.scenes_hint')}</Text>

      {/* Toggle buttons, like the dictionary's own choices, so every platform's keys work. */}
      <View style={styles.tiles}>
        {readings.map(({ scene, label }, index) => {
          const selected = index === current.index;
          return (
            <Pressable
              key={scene.id}
              onPress={() => choose(index)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              aria-pressed={selected}
              accessibilityLabel={label}
              testID={`symbol-scene-${scene.id}`}
              style={({ pressed }) => [{ width: tileWidth }, pressed && styles.pressed]}
            >
              <View style={[styles.tileArt, { height: (tileWidth * scene.image.height) / scene.image.width, backgroundColor: noctalia.surface.soft }]}>
                <Image
                  source={tileSources[index]}
                  contentFit="cover"
                  style={StyleSheet.absoluteFill}
                />
                <View
                  pointerEvents="none"
                  style={[
                    styles.tileEdge,
                    selected
                      ? { borderWidth: 2, borderColor: noctalia.action.primary }
                      : { borderWidth: StyleSheet.hairlineWidth, borderColor: noctalia.surface.border },
                  ]}
                />
              </View>
              <Text style={[styles.tileLabel, { color: selected ? noctalia.text.primary : noctalia.text.secondary }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.reading} accessibilityLiveRegion="polite" aria-live="polite">
        <Text style={[styles.kicker, { color: noctalia.accent.text }]}>{t('symbols.scene_chosen')}</Text>
        <Text selectable style={[styles.readingTitle, { color: noctalia.text.primary }]}>{reading.label}</Text>
        {reading.question ? (
          <MarkdownText selectable style={[styles.question, { color: noctalia.text.primary }]}>
            {reading.question}
          </MarkdownText>
        ) : null}
        {reading.excerpt ? (
          <MarkdownText selectable style={[styles.excerpt, { color: noctalia.text.secondary }]}>
            {reading.excerpt}
          </MarkdownText>
        ) : null}
      </View>

      <View
        style={[styles.stage, frame, { backgroundColor: noctalia.surface.soft }]}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        {shown.map((entry) => {
          const scene = readings[entry.index]?.scene;
          if (!scene) return null;
          return (
            <Animated.View
              key={entry.key}
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, entry.chosen && !reducedMotion ? DAWN : null]}
            >
              <LivingPainting
                atlas={atlas}
                symbolId={symbolId}
                picture={scene.image}
                layers={scene.layers}
                frame={frame}
                arrive={entry.chosen}
                transition={200}
              />
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 18 },
  hint: { marginTop: -8, fontFamily: Fonts.outfit.regular, fontSize: TypeScale.body.fontSize, lineHeight: TypeScale.body.lineHeight },
  tiles: { flexDirection: 'row', alignItems: 'flex-start', gap: TILE_GAP },
  tileArt: { borderRadius: 10, borderCurve: 'continuous', overflow: 'hidden' },
  tileEdge: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 10, borderCurve: 'continuous' },
  tileLabel: { marginTop: 8, fontFamily: Fonts.outfit.medium, fontSize: TypeScale.bodySm.fontSize, lineHeight: TypeScale.bodySm.lineHeight },
  pressed: { opacity: 0.78 },
  stage: { borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden' },
  reading: { gap: 10 },
  kicker: { fontFamily: Fonts.outfit.medium, fontSize: TypeScale.overline.fontSize, lineHeight: TypeScale.overline.lineHeight, letterSpacing: TypeScale.overline.letterSpacing, textTransform: 'uppercase' },
  readingTitle: { fontFamily: Fonts.fraunces.semiBold, fontSize: TypeScale.h2.fontSize, lineHeight: TypeScale.h2.lineHeight },
  question: { fontFamily: Fonts.fraunces.regular, fontSize: TypeScale.h3.fontSize, lineHeight: 27 },
  excerpt: { fontFamily: Fonts.outfit.regular, fontSize: TypeScale.body.fontSize, lineHeight: TypeScale.body.lineHeight },
});
