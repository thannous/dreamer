import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const SKY_ART = require('@/assets/images/onboarding-reverie-background.webp');

/**
 * The painted night sky behind a screen header, fading into the page, as on the
 * noctalia.app content pages. Decorative: hidden from assistive technology and
 * never intercepts touches. Callers render it only in the dark theme.
 */
export function NightSkyBand({ height, background }: { height: number; background: string }) {
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.band, { height }]}
    >
      <Image source={SKY_ART} contentFit="cover" contentPosition="top" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(3,4,13,0.35)', 'rgba(3,4,13,0.55)', background]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  band: { position: 'absolute', top: 0, left: 0, right: 0 },
});
