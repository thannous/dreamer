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
import { Atmosphere, NightTheme, PaperTheme, Themes } from '@/constants/theme';
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

export const WORLD_PURCHASE_BACKING_ALPHA = {
  dark: 0.96,
  light: 0.82,
} as const;

/** Full-screen purchase veil stays thin so artwork remains visible between copy. */
export const WORLD_PURCHASE_VEIL = {
  locations: [0, 0.36, 1] as const,
  topAlpha: 0.05,
  centreAlpha: 0.2,
  bottomAlpha: 0.88,
  topAlphaMax: 0.18,
  centreAlphaMax: 0.36,
  bottomAlphaMax: 0.94,
} as const;

export function withAlpha(color: string, alpha: number): string {
  const hex = color.startsWith('#') ? color.slice(1) : color;
  if (!/^[0-9a-f]{6}$/i.test(hex)) return 'transparent';

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function worldPurchaseBackingFill(appearance: 'dark' | 'light'): string {
  const ground = appearance === 'dark' ? NightTheme.background : PaperTheme.background;
  return withAlpha(ground, WORLD_PURCHASE_BACKING_ALPHA[appearance]);
}

export function worldPurchaseVeilColors(
  scrimColor: string,
  strength: number
): readonly [string, string, string] {
  const clamped = Math.max(0, Math.min(strength, 1.5));
  return [
    withAlpha(
      scrimColor,
      Math.min(WORLD_PURCHASE_VEIL.topAlpha * clamped, WORLD_PURCHASE_VEIL.topAlphaMax)
    ),
    withAlpha(
      scrimColor,
      Math.min(WORLD_PURCHASE_VEIL.centreAlpha * clamped, WORLD_PURCHASE_VEIL.centreAlphaMax)
    ),
    withAlpha(
      scrimColor,
      Math.min(WORLD_PURCHASE_VEIL.bottomAlpha * clamped, WORLD_PURCHASE_VEIL.bottomAlphaMax)
    ),
  ];
}

/** Local readable backing for purchase copy. The scene stays visible around it. */
export function WorldPurchaseReadableBlock({
  appearance,
  testID,
  className,
  children,
}: React.PropsWithChildren<{
  appearance: 'dark' | 'light';
  testID?: string;
  className?: string;
}>) {
  return (
    <View
      testID={testID}
      className={className}
      style={{
        backgroundColor: worldPurchaseBackingFill(appearance),
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
      }}>
      {children}
    </View>
  );
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
  const isPurchaseArtwork = artwork === 'purchase';
  const overlayOpacity = Math.min(
    world.atmosphere.overlayOpacity * strength * (isPurchaseArtwork ? 0.35 : 1),
    1
  );
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
          contentPosition={isPurchaseArtwork ? 'top' : 'center'}
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
        colors={
          isPurchaseArtwork
            ? [...worldPurchaseVeilColors(world.atmosphere.scrimColor, strength)]
            : [world.atmosphere.scrimColor, centreScrim, world.atmosphere.scrimColor]
        }
        locations={isPurchaseArtwork ? [...WORLD_PURCHASE_VEIL.locations] : [0, 0.46, 1]}
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: isPurchaseArtwork
              ? 1
              : Math.min(world.atmosphere.scrimOpacity * strength, 1),
          },
        ]}
        testID={isPurchaseArtwork ? 'world-scene-purchase-veil' : undefined}
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
