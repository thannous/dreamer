import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DREAMER_ARTWORK, type DreamerScene } from '@/constants/dreamerArtwork';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';

type Props = {
  scene: DreamerScene;
  height: number;
  background?: string;
};

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
