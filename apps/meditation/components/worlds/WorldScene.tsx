import { Image, type ImageProps } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import {
  SafeAreaView as RNSafeAreaView,
  type Edge,
} from 'react-native-safe-area-context';
import { ScopedTheme, withUniwind } from 'uniwind';

import { GrainOverlay } from '@/components/atmosphere/GrainOverlay';
import { BreathAmplitude } from '@/constants/motion';
import type { MeditationWorld } from '@/constants/worlds';
import { useBreath } from '@/context/BreathContext';

const SafeAreaView = withUniwind(RNSafeAreaView);

function withAlpha(color: string, alpha: number): string {
  const hex = color.startsWith('#') ? color.slice(1) : color;
  if (!/^[0-9a-f]{6}$/i.test(hex)) return 'transparent';

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export type WorldArtworkKey = keyof MeditationWorld['artwork'];

export type WorldSceneProps = React.PropsWithChildren<{
  world: MeditationWorld;
  artwork: WorldArtworkKey;
  /** Multiplies the world's authored scrim, without changing its hue. */
  scrimStrength?: number;
  edges?: readonly Edge[];
  className?: string;
  testID?: string;
}>;

/**
 * Immersive shell shared by every world-facing screen.
 *
 * The order is intentional: a real raster scene, one world tint, one static
 * readability scrim, one grain film, then accessible content. A route owns
 * its scroll or fixed trainer layout; this component owns only presentation.
 */
export function WorldScene({
  world,
  artwork,
  scrimStrength = 1,
  edges = ['top', 'bottom'],
  className,
  testID,
  children,
}: WorldSceneProps) {
  const isFocused = useIsFocused();
  const { progress } = useBreath();
  const strength = Math.max(0, Math.min(scrimStrength, 1.5));
  const overlayOpacity = Math.min(world.atmosphere.overlayOpacity * strength, 1);
  const centreScrim = withAlpha(
    world.atmosphere.scrimColor,
    world.appearance === 'dark' ? 0.45 : 0.18
  );
  const breathingTintStyle = useAnimatedStyle(
    () => ({
      opacity: interpolate(
        progress.value,
        [0, 1],
        [overlayOpacity * (1 - BreathAmplitude.halo * 2), overlayOpacity]
      ),
    }),
    [overlayOpacity]
  );

  return (
    <View
      className="flex-1 overflow-hidden"
      style={{ backgroundColor: world.atmosphere.scrimColor }}
      testID={testID}>
      {isFocused ? <StatusBar style={world.appearance === 'dark' ? 'light' : 'dark'} /> : null}
      <Image
        accessible={false}
        source={world.artwork[artwork] as ImageProps['source']}
        contentFit="cover"
        contentPosition="center"
        recyclingKey={`${world.id}-${artwork}`}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          breathingTintStyle,
          {
            backgroundColor: world.atmosphere.overlayColor,
          },
        ]}
      />

      <LinearGradient
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        colors={[
          world.atmosphere.scrimColor,
          centreScrim,
          world.atmosphere.scrimColor,
        ]}
        locations={[0, 0.46, 1]}
        style={[
          StyleSheet.absoluteFill,
          { opacity: Math.min(world.atmosphere.scrimOpacity * strength, 1) },
        ]}
      />

      <GrainOverlay opacity={world.appearance === 'dark' ? 0.035 : 0.022} />

      <ScopedTheme theme={world.appearance}>
        <SafeAreaView
          edges={edges}
          className={className ?? 'flex-1'}
          style={{ zIndex: 1 }}>
          {children}
        </SafeAreaView>
      </ScopedTheme>
    </View>
  );
}
