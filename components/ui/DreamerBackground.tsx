import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
  const [failedScene, setFailedScene] = useState<DreamerScene | null>(null);
  const ground = background ?? tokens.screen.background;

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
        colors={[tokens.backgroundArtwork.scrim, tokens.illustration.scrim, ground]}
        locations={[0, 0.56, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  band: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
});
