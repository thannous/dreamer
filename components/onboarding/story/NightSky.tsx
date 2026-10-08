import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion, type CSSStyle } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { EASE } from '@/components/motion';

import { STORY } from './storyMotion';

const ARTWORK_SOURCE = require('@/assets/images/onboarding-reverie-background.webp');
/** Intrinsic size of the painting and its moon, in source pixels. */
const ARTWORK = { width: 887, height: 1774 } as const;
const MOON = { x: 548, y: 274, r: 140 } as const;
/** The painting is drawn taller than the screen so the camera can tilt toward the lake. */
const OVERSCAN = 1.1;
const TILT = 0.07;

/** Hand-placed in clear patches of the painted sky: never on a cloud or the moon. */
const STARS = [
  { x: 252, y: 58, size: 2.5, period: 3200, phase: 0 },
  { x: 330, y: 128, size: 2, period: 4100, phase: 900 },
  { x: 398, y: 42, size: 3, period: 2700, phase: 400 },
  { x: 458, y: 96, size: 2, period: 3600, phase: 1500 },
  { x: 702, y: 38, size: 3, period: 3800, phase: 300 },
  { x: 788, y: 96, size: 2, period: 2900, phase: 1200 },
  { x: 852, y: 30, size: 2.5, period: 4200, phase: 600 },
  { x: 736, y: 142, size: 2, period: 3400, phase: 2100 },
  { x: 160, y: 120, size: 2, period: 3900, phase: 1700 },
] as const;

const GLOW = '#F6DFB8';
const STAR = '#FFF9EF';

export type NightSkyProps = {
  step: 'intro' | 'path';
  /** The user committed: the camera plunges and the scene recedes. */
  leaving: boolean;
  /** Play the arrival (settle, halo, shooting star). False when resuming on a later step. */
  arrival: boolean;
};

/**
 * The living backdrop of the onboarding. Three nested cameras, one concern each, so no
 * animation shares a `transform` with another:
 *   1. arrival — the night settles from a slight zoom, once (CSS animation);
 *   2. story   — tilts toward the lake between steps, plunges on commit (CSS transition);
 *   3. sky     — stars breathe and the moon answers the title (loops and one-shots).
 *
 * Decorative only: the parent hides it from assistive technology. Under reduce motion
 * nothing travels; the sky fades in, stars hold still and the veil still darkens on
 * commit so the change is explained.
 */
export const NightSky = memo(function NightSky({ step, leaving, arrival }: NightSkyProps) {
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();

  // Where the painting lands under `cover` in the overscanned frame. The moon and stars
  // are drawn in the same space so they stay glued to the artwork.
  const frame = useMemo(() => {
    const frameHeight = height * OVERSCAN;
    const scale = Math.max(width / ARTWORK.width, frameHeight / ARTWORK.height);
    return {
      height: frameHeight,
      scale,
      left: (width - ARTWORK.width * scale) / 2,
      top: (frameHeight - ARTWORK.height * scale) / 2,
    };
  }, [height, width]);
  const toScreen = (x: number, y: number) => ({ x: frame.left + x * frame.scale, y: frame.top + y * frame.scale });
  const moon = toScreen(MOON.x, MOON.y);
  const haloRadius = MOON.r * frame.scale * 1.9;

  const arrivalStyle = useMemo<CSSStyle<ViewStyle>>(() => (arrival ? {
    animationName: {
      from: { opacity: 0, ...(reduced ? {} : { transform: [{ scale: 1.08 }] }) },
      to: { opacity: 1, ...(reduced ? {} : { transform: [{ scale: 1 }] }) },
    },
    animationDuration: reduced ? 600 : STORY.skySettle,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  } : {}), [arrival, reduced]);

  const storyStyle = useMemo<CSSStyle<ViewStyle>>(() => {
    const tilt = step === 'path' ? -height * TILT : 0;
    const transform = reduced
      ? [{ translateY: 0 }, { scale: 1 }]
      : leaving
        ? [{ translateY: tilt - height * 0.04 }, { scale: 1.16 }]
        : [{ translateY: tilt }, { scale: step === 'path' ? 1.03 : 1 }];
    return {
      transform,
      transitionProperty: 'transform',
      transitionDuration: leaving ? STORY.plunge : STORY.camera,
      transitionTimingFunction: EASE.inOut,
    };
  }, [height, leaving, reduced, step]);

  // The moon answers when « une histoire » lands, then keeps a faint resting glow.
  const haloStyle = useMemo<CSSStyle<ViewStyle>>(() => (arrival && !reduced ? {
    animationName: {
      '0%': { opacity: 0, transform: [{ scale: 0.86 }] },
      '45%': { opacity: 0.85, transform: [{ scale: 1.06 }] },
      '100%': { opacity: 0.38, transform: [{ scale: 1 }] },
    },
    animationDuration: 1800,
    animationDelay: STORY.moonHalo,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  } : { opacity: 0.38 }), [arrival, reduced]);

  const veilStyle = useMemo<CSSStyle<ViewStyle>>(() => ({
    opacity: leaving ? 0.55 : step === 'path' ? 0.22 : 0,
    transitionProperty: 'opacity',
    transitionDuration: leaving ? STORY.plunge : STORY.camera,
    transitionTimingFunction: EASE.out,
  }), [leaving, step]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, arrivalStyle] as StyleProp<ViewStyle>}>
        <Animated.View style={[styles.frame, { height: frame.height }, storyStyle] as StyleProp<ViewStyle>}>
          <Image source={ARTWORK_SOURCE} contentFit="cover" style={StyleSheet.absoluteFill} />
          <Animated.View
            style={[
              styles.halo,
              {
                left: moon.x - haloRadius,
                top: moon.y - haloRadius,
                width: haloRadius * 2,
                height: haloRadius * 2,
              },
              haloStyle,
            ] as StyleProp<ViewStyle>}
          >
            <Svg width="100%" height="100%" viewBox="0 0 100 100">
              <Defs>
                <RadialGradient id="moonHalo" cx="50%" cy="50%" r="50%">
                  <Stop offset="0.38" stopColor={GLOW} stopOpacity="0.55" />
                  <Stop offset="0.62" stopColor={GLOW} stopOpacity="0.16" />
                  <Stop offset="1" stopColor={GLOW} stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Circle cx="50" cy="50" r="50" fill="url(#moonHalo)" />
            </Svg>
          </Animated.View>
          {STARS.map((star) => {
            const point = toScreen(star.x, star.y);
            return (
              <Twinkle
                key={`${star.x}-${star.y}`}
                x={point.x}
                y={point.y}
                size={star.size}
                period={star.period}
                phase={star.phase}
                still={reduced}
              />
            );
          })}
          {arrival && !reduced ? <ShootingStar width={width} height={height} /> : null}
        </Animated.View>
      </Animated.View>
      <LinearGradient
        colors={['rgba(3,4,13,0.12)', 'rgba(3,4,13,0.06)', 'rgba(3,4,13,0.60)', 'rgba(3,4,13,0.90)']}
        locations={[0, 0.25, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[StyleSheet.absoluteFill, styles.veil, veilStyle] as StyleProp<ViewStyle>} />
    </View>
  );
});

function Twinkle({ x, y, size, period, phase, still }: {
  x: number; y: number; size: number; period: number; phase: number; still: boolean;
}) {
  const style = useMemo<CSSStyle<ViewStyle>>(() => (still ? { opacity: 0.7 } : {
    animationName: { from: { opacity: 0.25 }, to: { opacity: 0.95 } },
    animationDuration: period,
    animationDelay: -phase,
    animationIterationCount: 'infinite',
    animationDirection: 'alternate',
    animationTimingFunction: EASE.inOut,
  }), [period, phase, still]);
  return (
    <Animated.View
      style={[
        styles.star,
        { left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: size / 2 },
        style,
      ] as StyleProp<ViewStyle>}
    />
  );
}

/** Once, top right to upper left, while the user is reading. */
function ShootingStar({ width, height }: { width: number; height: number }) {
  const style = useMemo<CSSStyle<ViewStyle>>(() => ({
    animationName: {
      '0%': { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '-28deg' }] },
      '20%': { opacity: 1 },
      '100%': { opacity: 0, transform: [{ translateX: -width * 0.42 }, { translateY: height * 0.12 }, { rotate: '-28deg' }] },
    },
    animationDuration: 900,
    animationDelay: STORY.shootingStar,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  }), [height, width]);
  return (
    <Animated.View style={[styles.shootingStar, { left: width * 0.78, top: height * 0.06 }, style] as StyleProp<ViewStyle>}>
      <LinearGradient
        colors={['rgba(255,249,239,0)', 'rgba(255,249,239,0.9)']}
        start={{ x: 1, y: 0.5 }}
        end={{ x: 0, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: { position: 'absolute', top: 0, left: 0, right: 0 },
  halo: { position: 'absolute' },
  star: { position: 'absolute', backgroundColor: STAR },
  shootingStar: { position: 'absolute', width: 90, height: 1.5, borderRadius: 1, overflow: 'hidden' },
  veil: { backgroundColor: '#03040D' },
});
