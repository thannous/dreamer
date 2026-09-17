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
import type { ThemeAmbience } from '@/lib/themeAmbience';

const ONBOARDING_SCENES = [
  require('@/assets/images/lucid/onboarding/onboarding-step-1-reference.jpg'),
  require('@/assets/images/lucid/onboarding/onboarding-step-2-waypoints.jpg'),
  require('@/assets/images/lucid/onboarding/onboarding-step-3.jpg'),
  require('@/assets/images/lucid/onboarding/onboarding-step-4.jpg'),
  require('@/assets/images/lucid/onboarding/onboarding-step-5.jpg'),
] as const;

const PARALLAX_DISTANCE = 16;
const FOREGROUND_DISTANCE = PARALLAX_DISTANCE * 2;

const AMBIENCE_STYLES = {
  dark: {
    sceneOpacity: 1,
    gradient: [
      'rgba(4, 20, 29, 0.04)',
      'rgba(2, 13, 20, 0.02)',
      'rgba(0, 8, 14, 0.12)',
    ],
    scrim: 'rgba(2, 10, 14, 0.28)',
    introScrim: 'rgba(2, 10, 14, 0.22)',
    experienceScrim: 'rgba(2, 10, 14, 0.34)',
  },
  afterglow: {
    sceneOpacity: 0.98,
    gradient: [
      'rgba(72, 45, 112, 0.2)',
      'rgba(164, 74, 105, 0.18)',
      'rgba(240, 148, 91, 0.16)',
    ],
    scrim: 'rgba(18, 7, 24, 0.12)',
    introScrim: 'rgba(18, 7, 24, 0.1)',
    experienceScrim: 'rgba(18, 7, 24, 0.18)',
  },
  morning: {
    sceneOpacity: 1,
    gradient: [
      'rgba(190, 224, 235, 0.18)',
      'rgba(249, 218, 185, 0.14)',
      'rgba(255, 209, 160, 0.2)',
    ],
    scrim: 'rgba(255, 248, 230, 0.1)',
    introScrim: 'rgba(255, 248, 230, 0.08)',
    experienceScrim: 'rgba(255, 248, 230, 0.14)',
  },
  light: {
    sceneOpacity: 1,
    gradient: [
      'rgba(202, 231, 239, 0.22)',
      'rgba(236, 245, 238, 0.12)',
      'rgba(218, 237, 226, 0.18)',
    ],
    scrim: 'rgba(243, 249, 246, 0.12)',
    introScrim: 'rgba(243, 249, 246, 0.1)',
    experienceScrim: 'rgba(243, 249, 246, 0.16)',
  },
} as const satisfies Record<ThemeAmbience, {
  sceneOpacity: number;
  gradient: readonly [string, string, string];
  scrim: string;
  introScrim: string;
  experienceScrim: string;
}>;

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
