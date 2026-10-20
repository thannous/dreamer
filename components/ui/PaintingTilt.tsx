import React, { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState, Platform, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, {
  SensorType, useAnimatedReaction, useAnimatedSensor, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { DURATION, EASING } from '@/components/motion/motion';

import { useOnScreen } from './headerStretch';
import { useHeaderScrollY } from './scrollDepth';

/** How far the painting slides each way at full tilt, in points. */
const SHIFT_X = 12;
const SHIFT_Y = 10;
/** The change of tilt, as a share of gravity (about 17 degrees), that slides it all the way. */
const FULL_TILT = 0.3;
/** However the phone is held, in bed included, that becomes the rest position over a few seconds. */
const RECENTER = 0.005;
/** Hand tremor is smoothed out before it reaches the painting. */
const SMOOTH = 0.14;
/** Moves smaller than this are not drawn: a phone held still costs no frame. */
const STILL = 0.3;
/** One reading a frame at 60 Hz, never faster on a 120 Hz screen. */
const SAMPLE_MS = 16;
// iOS reports gravity pulling the phone down, Android the reaction holding it up.
const GRAVITY_SIGN = Platform.OS === 'ios' ? -1 : 1;

type Props = {
  /** The painting can tilt: nothing covers it and it is not on its way somewhere. */
  active: boolean;
  /** Scrolled past this offset of its screen, the painting no longer dominates it. */
  dominantUntil: number;
  children: ReactNode;
};

// Paintings that may tilt, in the order they asked: only the latest one does.
const claims: object[] = [];
const listeners = new Set<() => void>();
const announce = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Enlarged by the slide each way plus a point, along whichever side of the frame needs it. */
function tiltZoom({ width, height }: { width: number; height: number }): number {
  return width > 0 && height > 0
    ? 1 + Math.max((2 * SHIFT_X + 2) / width, (2 * SHIFT_Y + 2) / height)
    : 1;
}

/** The frame a painting fills, the screen until it is laid out. */
function useFrame() {
  const screen = useWindowDimensions();
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);
  const onLayout = ({ nativeEvent: { layout } }: LayoutChangeEvent) => setFrame((previous) => (
    previous?.width === layout.width && previous.height === layout.height
      ? previous
      : { width: layout.width, height: layout.height }));
  return { frame: frame ?? screen, onLayout };
}

function useTiltTurn(wanted: boolean): boolean {
  const [id] = useState(() => ({}));
  useEffect(() => {
    if (!wanted) return;
    claims.push(id);
    announce();
    return () => {
      const at = claims.lastIndexOf(id);
      if (at >= 0) claims.splice(at, 1);
      announce();
    };
  }, [id, wanted]);
  return useSyncExternalStore(subscribe, () => claims[claims.length - 1] === id);
}

function useForeground(): boolean {
  const [foreground, setForeground] = useState(() => AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  return foreground;
}

function useDominant(until: number): boolean {
  const scrollY = useHeaderScrollY();
  const [dominant, setDominant] = useState(true);
  useAnimatedReaction(() => scrollY.get() < until, (now, before) => {
    if (now !== before) scheduleOnRN(setDominant, now);
  }, [until]);
  return dominant;
}

/** Mounted only while its painting tilts: the sensor runs for that painting alone. */
function TiltSensor({ x, y }: { x: SharedValue<number>; y: SharedValue<number> }) {
  const gravity = useAnimatedSensor(SensorType.GRAVITY, { interval: SAMPLE_MS });
  const rested = useSharedValue(false);
  const restX = useSharedValue(0);
  const restY = useSharedValue(0);
  const smoothX = useSharedValue(0);
  const smoothY = useSharedValue(0);
  useAnimatedReaction(() => gravity.sensor.get(), (reading) => {
    const size = Math.hypot(reading.x, reading.y, reading.z);
    if (!size) return;
    const gx = (GRAVITY_SIGN * reading.x) / size;
    const gy = (GRAVITY_SIGN * reading.y) / size;
    if (!rested.get()) {
      rested.set(true);
      restX.set(gx);
      restY.set(gy);
      // Taken back on its way to the centre, the painting goes on from where it is.
      smoothX.set(x.get());
      smoothY.set(y.get());
      return;
    }
    const rx = restX.get() + (gx - restX.get()) * RECENTER;
    const ry = restY.get() + (gy - restY.get()) * RECENTER;
    restX.set(rx);
    restY.set(ry);
    // Like a scene behind glass: the side tilted away shows more of it, so the painting
    // slides towards that side.
    const towardX = -Math.max(-1, Math.min(1, (gx - rx) / FULL_TILT)) * SHIFT_X;
    const towardY = Math.max(-1, Math.min(1, (gy - ry) / FULL_TILT)) * SHIFT_Y;
    const sx = smoothX.get() + (towardX - smoothX.get()) * SMOOTH;
    const sy = smoothY.get() + (towardY - smoothY.get()) * SMOOTH;
    smoothX.set(sx);
    smoothY.set(sy);
    if (Math.abs(sx - x.get()) > STILL) x.set(sx);
    if (Math.abs(sy - y.get()) > STILL) y.set(sy);
  });
  return null;
}

/**
 * Tilting the phone slides the painting that dominates the screen a few points within its
 * frame, as if it lay behind the glass. One painting at a time: the latest to ask while its
 * screen is in front, the app in use and the page scrolled no further than `dominantUntil`.
 * Only then does the sensor run, and a phone held still draws nothing. The painting is
 * enlarged just enough, for its own frame, that its edges never show. Never with reduced motion.
 */
function LivePaintingTilt({ active, dominantUntil, children }: Props) {
  const reduced = useReducedMotion();
  const onScreen = useOnScreen();
  const foreground = useForeground();
  const dominant = useDominant(dominantUntil);
  const tilts = useTiltTurn(active && !reduced && onScreen && foreground && dominant);
  const { frame, onLayout } = useFrame();
  const zoom = tiltZoom(frame);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  useEffect(() => {
    if (tilts) return;
    x.set(withTiming(0, { duration: DURATION.slow, easing: EASING.out }));
    y.set(withTiming(0, { duration: DURATION.slow, easing: EASING.out }));
  }, [tilts, x, y]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: zoom }],
  }), [zoom]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, reduced ? null : style]}
      onLayout={onLayout}
    >
      {tilts ? <TiltSensor x={x} y={y} /> : null}
      {children}
    </Animated.View>
  );
}

function StillPainting({ children }: { children: ReactNode }) {
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>{children}</View>;
}

/**
 * A likeness of a painting that tilts, as it rests: enlarged alike and unmoved, so that the
 * painting taking its place, as a page turned to takes over, does not grow.
 */
function RestingTiltedPainting({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const { frame, onLayout } = useFrame();
  return (
    <View pointerEvents="none" onLayout={onLayout}
      style={[StyleSheet.absoluteFill, reduced ? null : { transform: [{ scale: tiltZoom(frame) }] }]}>
      {children}
    </View>
  );
}

// The web has no tilt to follow; test doubles of Reanimated may omit the sensor.
const tilting = Platform.OS !== 'web' && typeof useAnimatedSensor === 'function';
export const PaintingTilt: (props: Props) => React.JSX.Element = tilting ? LivePaintingTilt : StillPainting;
export const PaintingAtRest = tilting ? RestingTiltedPainting : StillPainting;
