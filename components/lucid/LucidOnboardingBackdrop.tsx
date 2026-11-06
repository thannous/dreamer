import { type ReactNode, useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useReducedMotion, type CSSStyle } from 'react-native-reanimated';

import { DURATION, EASE } from '@/components/motion/motion';
import { getNoctaliaPalette } from '@/constants/noctaliaPalette';
import { getLucidPalette } from '@/constants/lucidTheme';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeAmbience } from '@/lib/themeAmbience';

const ONBOARDING_SCENES = [
  require('@/assets/images/lucid/onboarding/onboarding-step-1-reference.webp'),
  require('@/assets/images/lucid/onboarding/onboarding-step-2-waypoints.webp'),
  require('@/assets/images/lucid/onboarding/onboarding-step-3.webp'),
  require('@/assets/images/lucid/onboarding/onboarding-step-4.webp'),
  require('@/assets/images/lucid/onboarding/onboarding-step-5.webp'),
] as const;

const PARALLAX_DISTANCE = 16;
const FOREGROUND_DISTANCE = PARALLAX_DISTANCE * 2;

const night = getNoctaliaPalette('dark');
const paper = getNoctaliaPalette('light');
const nightScene = {
  sceneOpacity: 1,
  gradient: [night.backgroundArtwork.transparent, night.backgroundArtwork.transparent, night.backgroundArtwork.transparent],
  scrim: night.backgroundArtwork.scrim,
  introScrim: night.backgroundArtwork.scrim,
  experienceScrim: night.backgroundArtwork.scrim,
} as const;
const paperScene = {
  sceneOpacity: 1,
  gradient: [paper.backgroundArtwork.transparent, paper.backgroundArtwork.transparent, paper.backgroundArtwork.transparent],
  scrim: paper.backgroundArtwork.scrim,
  introScrim: paper.backgroundArtwork.scrim,
  experienceScrim: paper.backgroundArtwork.scrim,
} as const;
const AMBIENCE_STYLES = { dark: nightScene, afterglow: nightScene, light: paperScene, morning: paperScene } satisfies Record<ThemeAmbience, typeof nightScene>;

/**
 * Five bundled night scenes form one continuous approach to the lucid portal.
 * The current scene and its two neighbours stay mounted: the next step is
 * already decoded, the previous one can cross-fade out, and low-end devices do
 * not retain five full-screen rasters. Only opacity and transform animate, on
 * Reanimated's UI thread.
 */
export function LucidOnboardingBackdrop({
  ambience = 'dark',
  step,
  reduceMotion = false,
}: {
  ambience?: ThemeAmbience;
  step: number;
  reduceMotion?: boolean;
}) {
  const systemReducedMotion = useReducedMotion();
  const motionReduced = reduceMotion || systemReducedMotion;
  const ambienceStyle = AMBIENCE_STYLES[ambience];
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const lightReading = ambience === 'morning' || ambience === 'light';
  const readabilityColor = step === 0
    ? ambienceStyle.introScrim
    : step === 2
      ? ambienceStyle.experienceScrim
      : ambienceStyle.scrim;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    >
      {ONBOARDING_SCENES.map((source, index) => {
        if (Math.abs(index - step) > 1) return null;

        const active = index === step;
        const direction = index < step ? -1 : 1;
        const travel = motionReduced || active ? 0 : direction * PARALLAX_DISTANCE;
        const motion = {
          opacity: active ? ambienceStyle.sceneOpacity : 0,
          transform: [
            { translateX: travel },
            { scale: motionReduced ? 1.03 : active ? 1.03 : 1.06 },
          ],
          transitionProperty: ['opacity', 'transform'],
          transitionDuration: motionReduced ? DURATION.fast : DURATION.slow,
          transitionTimingFunction: EASE.inOut,
        } satisfies CSSStyle;

        return (
          <Animated.Image
            key={index}
            resizeMode="cover"
            source={source}
            style={[styles.scene, motion] as StyleProp<ImageStyle>}
            testID={active ? `lucid-onboarding-background-${index + 1}` : undefined}
          />
        );
      })}
      <LinearGradient
        colors={ambienceStyle.gradient}
        end={{ x: 0.85, y: 1 }}
        locations={[0, 0.54, 1]}
        start={{ x: 0.15, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[styles.readabilityScrim, { backgroundColor: readabilityColor }]}
      />
      {lightReading ? (
        <LinearGradient
          colors={[`${palette.background}E8`, `${palette.background}F5`, palette.background]}
          locations={[0, 0.25, 0.55]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  );
}

/** Foreground partner of the backdrop: same axis, twice the travel, faster settle. */
export function LucidOnboardingStage({
  children,
  direction = 1,
  step,
  reduceMotion = false,
  style,
}: {
  children: ReactNode;
  direction?: -1 | 1;
  step: number;
  reduceMotion?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const systemReducedMotion = useReducedMotion();
  const motionReduced = reduceMotion || systemReducedMotion;

  const entrance = useMemo<CSSStyle>(() => ({
    animationName: {
      from: {
        opacity: 0,
        ...(!motionReduced
          ? { transform: [{ translateX: direction * FOREGROUND_DISTANCE }] }
          : null),
      },
      to: {
        opacity: 1,
        ...(!motionReduced ? { transform: [{ translateX: 0 }] } : null),
      },
    },
    animationDuration: motionReduced ? DURATION.fast : DURATION.normal,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  }), [direction, motionReduced]);

  return (
    <Animated.View key={step} style={[entrance, style] as StyleProp<ViewStyle>}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scene: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  // The artwork remains legible while the native copy keeps WCAG contrast at
  // the top and bottom, where the title and pinned actions live.
  readabilityScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
});
