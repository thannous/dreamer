import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { StyleSheet, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDreamerArtwork, type DreamerScene } from '@/constants/dreamerArtwork';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { usePaintingDepthStyle, useHeaderStretchStyle } from './headerStretch';

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
  /** An open scene: the painting fills the header and melts into the page from its title. */
  immersive?: boolean;
  /** Open scene: where the title block starts, in points, so the page's ground rises behind it. */
  titleTop?: number;
};

/**
 * The painting itself lags behind the page as it scrolls, so the scene seems to lie deeper
 * than the copy over it. It does not breathe: on Android each frame of an endless zoom
 * redrew the whole screen, so a page at rest kept the phone busy (owner decision 2026-10-20).
 */
function PaintingLayer({ height, frame, children }: {
  height: number;
  frame: 'scrolls' | 'fixed';
  children: React.ReactNode;
}) {
  const depth = usePaintingDepthStyle(height, frame);
  return <Animated.View style={[StyleSheet.absoluteFill, depth]}>{children}</Animated.View>;
}

/** A real opening onto the scene: copy lives on the theme's reading surface below it.
 * No paper/night wash covers the painting. Only its last stretch melts into the page.
 */
export function DreamerArtworkWindow({ scene, style, bleedTop = 0, maxHeight = 240 }: {
  scene: DreamerScene;
  style?: StyleProp<ViewStyle>;
  /** The scroller's top padding the painting rises through, so it starts at the top of the screen. */
  bleedTop?: number;
  /** The painting's height on a roomy screen, below the top bleed. */
  maxHeight?: number;
}) {
  const { colors, mode } = useTheme();
  const { width, height, fontScale } = useWindowDimensions();
  const ground = getNoctaliaDesignTokens(colors, mode).screen.background;
  const artworkKey = `${scene}:${mode}`;
  const [failedArtwork, setFailedArtwork] = useState<string | null>(null);
  const compact = height < 700 || fontScale >= 1.5;
  const paintingHeight = Math.min(compact ? Math.min(128, maxHeight) : maxHeight, width * 0.625);
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
export function DreamerBackground({ scene, height, background, pinned = false, fadeEnd, fadeOnScroll = true, fixed = false, immersive = false, titleTop }: Props) {
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
  // No veil over the painting, the top of the screen included (owner decision 2026-10-17):
  // header copy reads on its own halo of the ground. Open scene: the ground rises from the
  // title block (however far a wrapped intro lifts it); in a short window it starts higher.
  const titleVeil = Math.max(0, Math.min(fadeEndAt - 160 / height, ((titleTop ?? Infinity) - 8) / height));
  const clearEnd = immersive ? titleVeil : fadeStart;
  const veil = {
    colors: [`${ground}00`, `${ground}00`, ground, ground] as const,
    locations: [0, clearEnd, fadeEndAt, 1] as const,
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
