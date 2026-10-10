import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming,
} from 'react-native-reanimated';

import { EASING } from '@/components/motion/motion';
import { DarkTheme } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { StoryNight } from './StoryNight';

const NIGHT = getNoctaliaDesignTokens(DarkTheme, 'dark');
/** The door of the whole story: the same blue as the dream, lit from the other side. */
const DOOR = { width: 132, height: 214, frame: 7, radius: 66 } as const;
const BLUE = ['#4E79A0', '#2E4466'] as const;
const LIGHT = ['#FFF9EF', '#EAD4B4'] as const;

/**
 * One passage, played once (ms). The night settles over the closing sheet, the door
 * arrives, opens onto its light, and the camera walks through it into the next step.
 */
const BEAT = {
  covered: 320,
  arrive: 120, arriveFor: 620,
  open: 640, openFor: 820,
  walk: 1240, walkFor: 900,
  glow: 1640, glowFor: 420,
  reveal: 2080, revealFor: 560,
} as const;
const REDUCED = { covered: 220, reveal: 760, revealFor: 320 } as const;

/**
 * The end of the onboarding stories: the blue door the reader followed since
 * "Cette nuit" opens, and the reader walks into its light. `onCovered` fires once
 * the screen is hidden, so the next step can settle out of sight; `onDone` once
 * it is revealed again.
 */
export function DoorPassage({ onCovered, onDone }: { onCovered: () => void; onDone: () => void }) {
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const veil = useSharedValue(0);
  const arrive = useSharedValue(reduced ? 1 : 0);
  const open = useSharedValue(reduced ? 1 : 0);
  const walk = useSharedValue(0);
  const glow = useSharedValue(0);
  // Deep enough that the doorway outgrows the screen on every side.
  const depth = Math.max(width / DOOR.width, height / DOOR.height) * 1.9;

  useEffect(() => {
    const beat = reduced ? REDUCED : BEAT;
    if (!reduced) {
      arrive.set(withDelay(BEAT.arrive, withTiming(1, { duration: BEAT.arriveFor, easing: EASING.out })));
      open.set(withDelay(BEAT.open, withTiming(1, { duration: BEAT.openFor, easing: EASING.inOut })));
      // The walk gathers pace like a step taken, then the light takes over.
      walk.set(withDelay(BEAT.walk, withTiming(1, { duration: BEAT.walkFor, easing: Easing.bezier(0.55, 0, 0.75, 0.4) })));
      glow.set(withDelay(BEAT.glow, withTiming(1, { duration: BEAT.glowFor, easing: EASING.out })));
    }
    // The night covers the closing sheet, holds through the passage, then lifts on the next step.
    veil.set(withSequence(
      withTiming(1, { duration: beat.covered, easing: EASING.out }),
      withDelay(beat.reveal - beat.covered, withTiming(0, { duration: beat.revealFor, easing: EASING.out })),
    ));
    const haptic = (style: Haptics.ImpactFeedbackStyle) => {
      if (process.env.EXPO_OS !== 'web') void Haptics.impactAsync(style);
    };
    const timers = [
      setTimeout(onCovered, beat.covered),
      setTimeout(onDone, beat.reveal + beat.revealFor),
      ...(reduced ? [] : [
        setTimeout(() => haptic(Haptics.ImpactFeedbackStyle.Soft), BEAT.open),
        setTimeout(() => haptic(Haptics.ImpactFeedbackStyle.Light), BEAT.glow),
      ]),
    ];
    return () => timers.forEach(clearTimeout);
    // One passage per mount: the callbacks of the first render are the ones that count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.get() }));
  const sceneStyle = useAnimatedStyle(() => ({
    opacity: arrive.get(),
    transform: [
      { translateY: interpolate(arrive.get(), [0, 1], [18, 0]) },
      { scale: interpolate(arrive.get(), [0, 1], [0.92, 1]) * interpolate(walk.get(), [0, 1], [1, depth]) },
    ],
  }));
  // The leaf swings on its left hinge; past 80° it is only an edge of blue.
  const leafStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 700 }, { rotateY: `${-84 * open.get()}deg` }],
  }));
  const leafShadeStyle = useAnimatedStyle(() => ({ opacity: interpolate(open.get(), [0, 1], [0, 0.55]) }));
  const lightStyle = useAnimatedStyle(() => ({ opacity: interpolate(open.get(), [0, 0.3, 1], [0.12, 0.75, 1]) }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(open.get(), [0, 1], [0.08, 0.7]),
    transform: [{ scale: interpolate(open.get(), [0, 1], [0.7, 1.15]) }],
  }));
  const spillStyle = useAnimatedStyle(() => ({
    opacity: interpolate(open.get(), [0, 1], [0, 0.32]),
    transform: [{ scaleX: interpolate(open.get(), [0, 1], [0.3, 1]) }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() * 0.9 }));

  return <Animated.View pointerEvents="auto" accessible={false} importantForAccessibility="no-hide-descendants"
    accessibilityElementsHidden testID="component.onboarding.doorPassage"
    style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: NIGHT.screen.background }, veilStyle]}>
    <StoryNight tokens={NIGHT} page={{ key: 'door', index: 12 }} />
    <Animated.View style={[styles.scene, sceneStyle]}>
      <Animated.View style={[styles.halo, { backgroundColor: LIGHT[1], boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 60, spreadDistance: 18, color: LIGHT[1] }] }, haloStyle]} />
      <View style={[styles.frame, { borderColor: NIGHT.accent.text }]}>
        <Animated.View style={[StyleSheet.absoluteFill, lightStyle]}>
          <LinearGradient colors={LIGHT} start={{ x: 0.5, y: 0.25 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        {/* A two-point gap on the free edge: the light is there before the door moves. */}
        <Animated.View style={[styles.leaf, leafStyle]}>
          <LinearGradient colors={BLUE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={[styles.panel, styles.panelTop, { borderColor: `${NIGHT.text.primary}24` }]} />
          <View style={[styles.panel, styles.panelBottom, { borderColor: `${NIGHT.text.primary}24` }]} />
          <View style={[styles.knob, { backgroundColor: NIGHT.accent.text }]} />
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: NIGHT.screen.background }, leafShadeStyle]} />
        </Animated.View>
      </View>
      <Animated.View style={[styles.spill, { backgroundColor: LIGHT[1], boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 24, spreadDistance: 4, color: LIGHT[1] }] }, spillStyle]} />
    </Animated.View>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: LIGHT[1] }, glowStyle]} />
  </Animated.View>;
}

const INNER = { width: DOOR.width - DOOR.frame * 2, height: DOOR.height - DOOR.frame * 2 };

const styles = StyleSheet.create({
  root: { zIndex: 100, alignItems: 'center', justifyContent: 'center' },
  scene: { width: DOOR.width, height: DOOR.height, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: DOOR.width * 1.6, height: DOOR.height * 1.3, borderRadius: DOOR.width },
  frame: {
    width: DOOR.width, height: DOOR.height, padding: DOOR.frame, borderWidth: 1, overflow: 'hidden',
    borderTopLeftRadius: DOOR.radius, borderTopRightRadius: DOOR.radius, borderBottomLeftRadius: 6, borderBottomRightRadius: 6,
  },
  leaf: {
    width: INNER.width - 2, height: INNER.height, overflow: 'hidden', transformOrigin: 'left center',
    borderTopLeftRadius: DOOR.radius - DOOR.frame, borderTopRightRadius: DOOR.radius - DOOR.frame, borderBottomLeftRadius: 3, borderBottomRightRadius: 3,
  },
  panel: { position: 'absolute', left: 16, right: 16, borderWidth: 1, borderRadius: 10 },
  panelTop: { top: 34, height: INNER.height * 0.36, borderTopLeftRadius: 44, borderTopRightRadius: 44 },
  panelBottom: { bottom: 18, height: INNER.height * 0.3 },
  knob: { position: 'absolute', right: 14, top: INNER.height * 0.55, width: 8, height: 8, borderRadius: 4 },
  spill: { position: 'absolute', bottom: -12, width: DOOR.width * 1.8, height: 22, borderRadius: 22 },
});
