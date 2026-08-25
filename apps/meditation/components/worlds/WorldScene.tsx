import { Image, type ImageProps } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  SafeAreaView as RNSafeAreaView,
  type Edge,
} from 'react-native-safe-area-context';
import { ScopedTheme, withUniwind } from 'uniwind';

import { GrainOverlay } from '@/components/atmosphere/GrainOverlay';
import { ImmersiveScene } from '@/components/immersive';
import { BreathAmplitude, Curve, Duration } from '@/constants/motion';
import { Atmosphere, NightTheme, Themes } from '@/constants/theme';
import type { MeditationWorld, WorldMotion } from '@/constants/worlds';
import { useBreath } from '@/context/BreathContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const SafeAreaView = withUniwind(RNSafeAreaView);

const ARTWORK_OVERSCAN = {
  bottom: -12,
  left: -12,
  position: 'absolute',
  right: -12,
  top: -12,
} as const;

/** Six restrained physical signatures, all driven by the same 11 s breath. */
export function worldArtworkMotionStyle(motion: WorldMotion, breath: number): ViewStyle {
  'worklet';
  const progress = Math.max(0, Math.min(breath, 1));
  const direction = 1 - progress * 2;

  switch (motion) {
    case 'orbit':
      return {
        transform: [
          { scale: 1.018 },
          { rotate: `${direction * 0.16}deg` },
        ],
      };
    case 'rise':
      return { transform: [{ translateY: direction * 5 }, { scale: 1.018 }] };
    case 'canopy':
      return {
        transform: [
          { translateX: direction * 3 },
          { translateY: progress * -2 },
          { scale: 1.018 },
        ],
      };
    case 'drift':
      return { transform: [{ translateX: direction * 7 }, { scale: 1.026 }] };
    case 'pulse':
      return { transform: [{ scale: 1.008 + progress * 0.012 }] };
    case 'float':
      return { transform: [{ translateY: direction * 7 }, { scale: 1.022 }] };
  }
}

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
  /** Pause ambient breathing when a foreground trainer owns the rhythm. */
  breathMotion?: boolean;
  /** Opts a route into the experimental Skia atmosphere. */
  immersive?: boolean;
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
  breathMotion = true,
  immersive = false,
  edges = ['top', 'bottom'],
  className,
  testID,
  children,
}: WorldSceneProps) {
  const isFocused = useIsFocused();
  const reducedMotion = useReducedMotion();
  const { progress } = useBreath();
  const previousWorldId = useRef(world.id);
  const reveal = useSharedValue(0);
  const strength = Math.max(0, Math.min(scrimStrength, 1.5));
  const overlayOpacity = Math.min(world.atmosphere.overlayOpacity * strength, 1);
  const colors = Themes[world.appearance];
  const ambientMotionPaused = reducedMotion || !breathMotion;
  const centreScrim = withAlpha(
    world.atmosphere.scrimColor,
    Math.min(world.atmosphere.centreScrimOpacity * strength, 1)
  );
  const breathingTintStyle = useAnimatedStyle(
    () => ({
      opacity: interpolate(
        ambientMotionPaused ? 0.5 : progress.get(),
        [0, 1],
        [overlayOpacity * (1 - BreathAmplitude.halo * 2), overlayOpacity]
      ),
    }),
    [ambientMotionPaused, overlayOpacity]
  );
  const artworkMotionStyle = useAnimatedStyle(
    () => worldArtworkMotionStyle(world.motion, ambientMotionPaused ? 0.5 : progress.get()),
    [ambientMotionPaused, world.motion]
  );
  const revealStyle = useAnimatedStyle(() => ({ opacity: reveal.get() * 0.18 }));

  useEffect(() => {
    if (previousWorldId.current === world.id) return;
    previousWorldId.current = world.id;
    reveal.set(0);
    if (reducedMotion) return;

    reveal.set(
      withSequence(
        withTiming(1, { duration: Duration.fast, easing: Curve.enter }),
        withTiming(0, { duration: Duration.base, easing: Curve.exit })
      )
    );
  }, [reducedMotion, reveal, world.id]);

  return (
    <View
      className="flex-1 overflow-hidden"
      style={{ backgroundColor: world.atmosphere.scrimColor }}
      testID={testID}>
      {isFocused ? <StatusBar style={world.appearance === 'dark' ? 'light' : 'dark'} /> : null}
      <Animated.View
        testID={`world-scene-motion.${world.motion}`}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={[ARTWORK_OVERSCAN, artworkMotionStyle]}>
        <Image
          accessible={false}
          source={world.artwork[artwork] as ImageProps['source']}
          contentFit="cover"
          contentPosition="center"
          recyclingKey={`${world.id}-${artwork}`}
          transition={reducedMotion ? 0 : Duration.slow}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          revealStyle,
          { backgroundColor: NightTheme.accentLight },
        ]}
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

      {immersive ? (
        <ImmersiveScene
          motionPaused={ambientMotionPaused}
          palette={{
            fog: Atmosphere[world.appearance].aurora[1].color,
            glow: world.atmosphere.overlayColor,
            light: colors.accentLight,
            ground: world.atmosphere.scrimColor,
          }}
          testID={`world-scene-immersive.${world.id}`}
        />
      ) : null}

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
