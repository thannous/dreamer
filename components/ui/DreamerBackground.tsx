import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DREAMER_ARTWORK, type DreamerScene } from '@/constants/dreamerArtwork';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';

type Props = {
  scene: DreamerScene;
  height: number;
  background?: string;
};

/** A real opening onto the scene: copy lives on the theme's reading surface below it.
 * No paper/night wash covers the painting. Only its last 40 points meet the page.
 */
export function DreamerArtworkWindow({ scene, style }: {
  scene: DreamerScene;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, mode } = useTheme();
  const { width, height, fontScale } = useWindowDimensions();
  const ground = getNoctaliaDesignTokens(colors, mode).screen.background;
  const [failedScene, setFailedScene] = useState<DreamerScene | null>(null);
  const compact = height < 700 || fontScale >= 1.5;
  const paintingHeight = Math.min(compact ? 128 : 240, width * 0.625);

  if (failedScene === scene) return null;
  return <View
    testID={`artwork.window.${scene}`}
    pointerEvents="none" accessible={false} accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    style={[{ height: paintingHeight, alignSelf: 'stretch', flexShrink: 0, overflow: 'hidden', backgroundColor: ground }, style]}
  >
    <Image testID={`image.background.${scene}`} accessible={false}
      source={DREAMER_ARTWORK[scene]} contentFit="cover" contentPosition="center"
      recyclingKey={scene} onError={() => setFailedScene(scene)} style={StyleSheet.absoluteFill} />
    <LinearGradient colors={[`${ground}00`, ground]}
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40 }} />
  </View>;
}

/** A static, decorative painting fades into the page's own readable ground. */
export function DreamerBackground({ scene, height, background }: Props) {
  const { colors, mode } = useTheme();
  const tokens = getNoctaliaDesignTokens(colors, mode);
  const insets = useSafeAreaInsets();
  const [failedScene, setFailedScene] = useState<DreamerScene | null>(null);
  const ground = background ?? tokens.screen.background;
  const spaciousHero = scene === 'sleep' || scene === 'ritual';
  const readingStart = Math.min(0.68, (insets.top + (spaciousHero ? 190 : 72)) / height);

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.band, { height, backgroundColor: ground }]}
    >
      {failedScene !== scene ? (
        <Image
          testID={`image.background.${scene}`}
          accessible={false}
          source={DREAMER_ARTWORK[scene]}
          contentFit="cover"
          contentPosition={scene === 'reverie' ? 'top' : 'bottom right'}
          recyclingKey={scene}
          onError={() => setFailedScene(scene)}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <LinearGradient
        colors={[tokens.backgroundArtwork.reveal, tokens.backgroundArtwork.scrim, tokens.backgroundArtwork.scrim, ground]}
        locations={[0, readingStart, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Reveal the painting beside the header, then protect the full-width copy.
          Its left edge stays veiled for the wordmark and wrapped page titles. */}
      <LinearGradient
        colors={[tokens.backgroundArtwork.scrim, tokens.backgroundArtwork.scrim, tokens.backgroundArtwork.transparent]}
        locations={[0, 0.42, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  band: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
});
