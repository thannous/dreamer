import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { StyleSheet, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDreamerArtwork, type DreamerScene } from '@/constants/dreamerArtwork';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { usePaintingBreath, usePaintingDepthStyle, useHeaderStretchStyle } from './headerStretch';

type Props = {
  scene: DreamerScene;
  height: number;
  background?: string;
  /** Fixed over scrolling content (not inside it): it grows down on a pull instead of following it. */
  pinned?: boolean;
  /** Where the painting has fully become the page's ground (the bottom of its header), in points. */
  fadeEnd?: number;
  /** Fade out while the page scrolls down; off when the header around it already fades. */
  fadeOnScroll?: boolean;
  /** Stays in place while the page scrolls under it, instead of scrolling with the page. */
  fixed?: boolean;
  /** An open scene: veiled only behind the wordmark at the top and the title at its foot. */
  immersive?: boolean;
  /** Open scene: where the title block starts, in points, so its veil is in place above it. */
  titleTop?: number;
  /** Copy covers the whole painting (Today's hero): it reads on the copy veil from the top. */
  reading?: boolean;
};

/**
 * The painting itself, alive: it breathes slowly and lags behind the page as it scrolls,
 * so the scene seems to lie deeper than the copy over it.
 */
function PaintingLayer({ height, frame, children }: {
  height: number;
  frame: 'scrolls' | 'fixed';
  children: React.ReactNode;
}) {
  const depth = usePaintingDepthStyle(height, frame);
  const breath = usePaintingBreath();
  return <Animated.View style={[StyleSheet.absoluteFill, depth]}>
    <Animated.View style={[StyleSheet.absoluteFill, breath]}>{children}</Animated.View>
  </Animated.View>;
}

/** A real opening onto the scene: copy lives on the theme's reading surface below it.
 * No paper/night wash covers the painting. Only its last stretch melts into the page.
 */
export function DreamerArtworkWindow({ scene, style, bleedTop = 0 }: {
  scene: DreamerScene;
  style?: StyleProp<ViewStyle>;
  /** The scroller's top padding the painting rises through, so it starts at the top of the screen. */
  bleedTop?: number;
}) {
  const { colors, mode } = useTheme();
  const { width, height, fontScale } = useWindowDimensions();
  const ground = getNoctaliaDesignTokens(colors, mode).screen.background;
  const artworkKey = `${scene}:${mode}`;
  const [failedArtwork, setFailedArtwork] = useState<string | null>(null);
  const compact = height < 700 || fontScale >= 1.5;
  const paintingHeight = Math.min(compact ? 128 : 240, width * 0.625);
  const stretch = useHeaderStretchStyle(paintingHeight + bleedTop);

  if (failedArtwork === artworkKey) return null;
  return <Animated.View
    testID={`artwork.window.${scene}`}
    pointerEvents="none" accessible={false} accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    style={[{ height: paintingHeight + bleedTop, marginTop: -bleedTop, alignSelf: 'stretch', flexShrink: 0, overflow: 'hidden', backgroundColor: ground, transformOrigin: 'top center' }, style, stretch]}
  >
    <PaintingLayer height={paintingHeight + bleedTop} frame="scrolls">
      <Image testID={`image.background.${scene}`} accessible={false}
        source={getDreamerArtwork(scene, mode)} contentFit="cover" contentPosition="center"
        // Bundled Android resource IDs can move between compatible app updates.
        // Keep these local paintings out of the persisted resource-ID cache.
        cachePolicy="memory"
        recyclingKey={artworkKey} onError={() => setFailedArtwork(artworkKey)} style={StyleSheet.absoluteFill} />
    </PaintingLayer>
    {/* Eased over about 120 points: the scene thins into the page instead of stopping at a line. */}
    <LinearGradient colors={[`${ground}00`, `${ground}33`, `${ground}8C`, `${ground}D9`, ground]}
      locations={[0, 0.3, 0.6, 0.85, 1]}
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.min(120, paintingHeight * 0.6) }} />
  </Animated.View>;
}

/** A static, decorative painting fades into the page's own readable ground. */
export function DreamerBackground({ scene, height, background, pinned = false, fadeEnd, fadeOnScroll = true, fixed = false, immersive = false, titleTop, reading = false }: Props) {
  const { colors, mode } = useTheme();
  const tokens = getNoctaliaDesignTokens(colors, mode);
  const insets = useSafeAreaInsets();
  const artworkKey = `${scene}:${mode}`;
  const [failedArtwork, setFailedArtwork] = useState<string | null>(null);
  const ground = background ?? tokens.screen.background;
  const spaciousHero = scene === 'sleep' || scene === 'ritual';
  const readingStart = Math.min(0.68, (insets.top + (spaciousHero ? 190 : 72)) / height);
  const stretch = useHeaderStretchStyle(height, pinned, fadeOnScroll);
  // The painting melts into the page over 80 points and is pure ground by the bottom of its
  // header, so content with its own ground below never meets it as an edge.
  const fadeEndAt = Math.min(1, Math.max(readingStart + 0.05, (fadeEnd ?? height) / height));
  const fadeStart = Math.max(readingStart, fadeEndAt - 80 / height);
  // The wordmark row reads on the copy veil, then the scene opens. Open scene: clear down
  // to the title block (however far a wrapped intro lifts it), which reads on the copy veil.
  const { copy, reveal, scrim } = tokens.backgroundArtwork;
  const wordmarkEnd = (insets.top + 64) / height;
  // In a short window the title reaches the wordmark row and the scene stays veiled.
  const titleVeil = Math.max(0, Math.min(fadeEndAt - 160 / height, ((titleTop ?? Infinity) - 8) / height));
  const openHold = Math.min(0.24, wordmarkEnd, titleVeil);
  const openStart = Math.min(0.32, wordmarkEnd + 40 / height, titleVeil);
  const clearEnd = Math.min(titleVeil, Math.max(openStart, titleVeil - 120 / height));
  const scrimStart = Math.max(readingStart, Math.min(fadeStart, wordmarkEnd + 56 / height));
  const veil = immersive
    ? {
        colors: [copy, copy, reveal, reveal, copy, ground, ground] as const,
        locations: [0, openHold, openStart, clearEnd, titleVeil, fadeEndAt, 1] as const,
      }
    : reading
      ? { colors: [copy, copy, ground, ground] as const, locations: [0, fadeStart, fadeEndAt, 1] as const }
      : {
          colors: [copy, copy, scrim, scrim, ground, ground] as const,
          locations: [0, Math.min(readingStart, wordmarkEnd), scrimStart, fadeStart, fadeEndAt, 1] as const,
        };

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.band, { height, backgroundColor: ground }, stretch]}
    >
      {failedArtwork !== artworkKey ? (
        <PaintingLayer height={height} frame={fixed ? 'fixed' : 'scrolls'}>
        <Image
          testID={`image.background.${scene}`}
          accessible={false}
          source={getDreamerArtwork(scene, mode)}
          contentFit="cover"
          contentPosition={scene === 'reverie' ? 'top' : 'bottom right'}
          cachePolicy="memory"
          recyclingKey={artworkKey}
          onError={() => setFailedArtwork(artworkKey)}
          style={StyleSheet.absoluteFill}
        />
        </PaintingLayer>
      ) : null}
      <LinearGradient colors={veil.colors} locations={veil.locations} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  band: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden', transformOrigin: 'top center' },
});
