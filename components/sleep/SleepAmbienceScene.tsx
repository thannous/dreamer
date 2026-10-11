import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion, type CSSStyle } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { EASE } from '@/components/motion';
import { SLEEP_SOUNDS, type SleepSoundId } from '@/lib/sleepSounds';

import {
  SLEEP_AMBIENCE_SCENES,
  getSceneFrame,
  seededRandom,
  type SceneLight,
  type SleepAmbienceScene as Scene,
} from './sleepAmbienceScenes';

const WARM = '#F6DFB8';
const RAIN = '214, 224, 245';
const MIST = '206, 192, 228';
const INK = '3, 4, 13';

/** Scenes cross-fade like a slow dissolve between two places, never a slide. */
const SCENE_FADE_MS = 1200;
/** Dimming the night once the sound starts takes as long as a long breath out. */
const NIGHT_FALL_MS = 2400;

type Props = {
  soundId: SleepSoundId;
  /** The sound is playing: the night deepens and the copy steps back. */
  playing: boolean;
  /** The page's ground, which the lower half of the scene melts into. */
  ground: string;
};

/**
 * The living backdrop of the sleep sounds screen. Every ambience has its painting and
 * the motion of its sound: rain falls across the forest, the moon's path glints on the
 * water, mist drifts over the lake. Decorative only, hidden from assistive technology.
 *
 * Under reduce motion nothing moves: the drops and glints hold still, the lights keep a
 * steady glow and the scenes still cross-fade, so a change of ambience stays explained.
 */
export const SleepAmbienceScene = memo(function SleepAmbienceScene({ soundId, playing, ground }: Props) {
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();

  const breath = useMemo<CSSStyle<ViewStyle>>(() => (reduced ? {} : {
    animationName: { from: { transform: [{ scale: 1 }] }, to: { transform: [{ scale: 1.06 }] } },
    animationDuration: 22000,
    animationIterationCount: 'infinite',
    animationDirection: 'alternate',
    animationTimingFunction: EASE.inOut,
  }), [reduced]);

  const nightFall = useMemo<CSSStyle<ViewStyle>>(() => ({
    opacity: playing ? 0.32 : 0,
    transitionProperty: 'opacity',
    transitionDuration: NIGHT_FALL_MS,
    transitionTimingFunction: EASE.out,
  }), [playing]);

  return (
    <View
      testID="sleep-scene"
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: ground }]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, breath] as StyleProp<ViewStyle>}>
        {SLEEP_SOUNDS.map((sound) => (
          <ScenePainting
            key={sound.id}
            scene={SLEEP_AMBIENCE_SCENES[sound.id]}
            active={sound.id === soundId}
            width={width}
            height={height}
            ground={ground}
            still={reduced}
          />
        ))}
      </Animated.View>
      <Weather key={soundId} scene={SLEEP_AMBIENCE_SCENES[soundId]} width={width} height={height} still={reduced} />
      {/* The status bar and back button read on a little night at the top. */}
      <LinearGradient
        colors={[`rgba(${INK}, 0.55)`, `rgba(${INK}, 0)`]}
        style={[styles.topVeil, { height: Math.min(180, height * 0.22) }]}
      />
      {/* The scene thins into the page: the copy lies on the ground, never on the painting. */}
      <LinearGradient
        colors={[`${ground}00`, `${ground}66`, `${ground}D9`, ground]}
        locations={[0.28, 0.5, 0.7, 0.86]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[StyleSheet.absoluteFill, styles.night, nightFall] as StyleProp<ViewStyle>} />
    </View>
  );
});

function ScenePainting({ scene, active, width, height, ground, still }: {
  scene: Scene; active: boolean; width: number; height: number; ground: string; still: boolean;
}) {
  const frame = getSceneFrame(scene, width, height);
  const fade = useMemo<CSSStyle<ViewStyle>>(() => ({
    opacity: active ? 1 : 0,
    transitionProperty: 'opacity',
    transitionDuration: SCENE_FADE_MS,
    transitionTimingFunction: EASE.inOut,
  }), [active]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, fade] as StyleProp<ViewStyle>}>
      <View style={{ position: 'absolute', left: frame.left, top: frame.top, width: frame.width, height: frame.height }}>
        <Image
          source={scene.source}
          contentFit="cover"
          // Bundled resources: keep them out of the persisted resource-ID cache.
          cachePolicy="memory"
          accessible={false}
          style={StyleSheet.absoluteFill}
        />
        {active ? scene.lights.map((light) => (
          <Glow key={`${light.x}-${light.y}`} light={light} scale={frame.scale} still={still} />
        )) : null}
        {active && scene.glintPath ? <Glints scene={scene} scale={frame.scale} still={still} /> : null}
        {active && scene.ripples ? <Ripples scene={scene} scale={frame.scale} still={still} /> : null}
        {scene.coverHeight < 1 ? (
          <LinearGradient
            colors={[`${ground}00`, ground]}
            style={[styles.frameFoot, { height: frame.height * 0.35 }]}
          />
        ) : null}
      </View>
    </Animated.View>
  );
}

/** A painted light that keeps burning: the lantern flickers, the moon's halo breathes. */
function Glow({ light, scale, still }: { light: SceneLight; scale: number; still: boolean }) {
  const radius = light.r * scale;
  const style = useMemo<CSSStyle<ViewStyle>>(() => (still ? { opacity: (light.min + light.max) / 2 } : {
    animationName: {
      from: { opacity: light.min, transform: [{ scale: 0.94 }] },
      to: { opacity: light.max, transform: [{ scale: 1.04 }] },
    },
    animationDuration: light.period,
    animationIterationCount: 'infinite',
    animationDirection: 'alternate',
    animationTimingFunction: EASE.inOut,
  }), [light, still]);
  const id = `glow-${light.x}-${light.y}`;

  return (
    <Animated.View
      style={[
        styles.absolute,
        { left: light.x * scale - radius, top: light.y * scale - radius, width: radius * 2, height: radius * 2 },
        style,
      ] as StyleProp<ViewStyle>}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={WARM} stopOpacity="0.55" />
            <Stop offset="0.35" stopColor={WARM} stopOpacity="0.2" />
            <Stop offset="1" stopColor={WARM} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/** Moonlight caught by the swell: short strokes along the reflection, lit one after another. */
function Glints({ scene, scale, still }: { scene: Scene; scale: number; still: boolean }) {
  const glints = useMemo(() => {
    const path = scene.glintPath!;
    const random = seededRandom(7);
    return Array.from({ length: 22 }, (_, index) => {
      const depth = random();
      const y = path.top + depth * (path.bottom - path.top);
      // The path widens toward the shore, like a real reflection.
      const x = path.x + (random() - 0.5) * path.spread * (0.4 + depth);
      return { index, x, y, length: 10 + random() * 26 * (0.5 + depth), period: 1400 + random() * 2600, phase: random() * 4000 };
    });
  }, [scene]);

  return (
    <>
      {glints.map((glint) => (
        <Glint key={glint.index} {...glint} scale={scale} still={still} />
      ))}
    </>
  );
}

function Glint({ x, y, length, period, phase, scale, still }: {
  x: number; y: number; length: number; period: number; phase: number; scale: number; still: boolean;
}) {
  const style = useMemo<CSSStyle<ViewStyle>>(() => (still ? { opacity: 0.4 } : {
    animationName: {
      '0%': { opacity: 0, transform: [{ scaleX: 0.5 }] },
      '50%': { opacity: 0.75, transform: [{ scaleX: 1 }] },
      '100%': { opacity: 0, transform: [{ scaleX: 0.5 }] },
    },
    animationDuration: period,
    animationDelay: -phase,
    animationIterationCount: 'infinite',
    animationTimingFunction: EASE.inOut,
  }), [period, phase, still]);
  const width = length * scale;

  return (
    <Animated.View
      style={[
        styles.absolute,
        { left: x * scale - width / 2, top: y * scale, width, height: Math.max(1.5, 2.5 * scale) },
        style,
      ] as StyleProp<ViewStyle>}
    >
      {/* Tapered ends: a glint is light on a ripple, not a dash. */}
      <LinearGradient
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        colors={['rgba(246, 223, 184, 0)', 'rgba(246, 223, 184, 0.95)', 'rgba(246, 223, 184, 0)']}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

/** Rings that open on the water around the stones, as each slow wave reaches the shore. */
function Ripples({ scene, scale, still }: { scene: Scene; scale: number; still: boolean }) {
  return (
    <>
      {scene.ripples!.map((ripple, index) => (
        <Ripple key={`${ripple.x}-${ripple.y}`} {...ripple} scale={scale} still={still} phase={index * 2300} />
      ))}
    </>
  );
}

function Ripple({ x, y, r, scale, still, phase }: {
  x: number; y: number; r: number; scale: number; still: boolean; phase: number;
}) {
  const style = useMemo<CSSStyle<ViewStyle>>(() => (still ? { opacity: 0 } : {
    animationName: {
      '0%': { opacity: 0, transform: [{ scale: 0.35 }] },
      '20%': { opacity: 0.55 },
      '100%': { opacity: 0, transform: [{ scale: 1 }] },
    },
    animationDuration: 7000,
    animationDelay: -phase,
    animationIterationCount: 'infinite',
    animationTimingFunction: EASE.out,
  }), [phase, still]);
  const width = r * 2 * scale;
  // Seen from the shore, a ring on the water is a flat ellipse.
  const height = width * 0.22;

  return (
    <Animated.View
      style={[
        styles.ripple,
        { left: x * scale - width / 2, top: y * scale - height / 2, width, height, borderRadius: width / 2 },
        style,
      ] as StyleProp<ViewStyle>}
    />
  );
}

/** The sound made visible, over the whole screen and outside the painting's frame. */
function Weather({ scene, width, height, still }: { scene: Scene; width: number; height: number; still: boolean }) {
  const arrive = useMemo<CSSStyle<ViewStyle>>(() => ({
    animationName: { from: { opacity: 0 }, to: { opacity: 1 } },
    animationDuration: SCENE_FADE_MS,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  }), []);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.clip, arrive] as StyleProp<ViewStyle>}>
      {scene.weather === 'rain' ? <Rain width={width} height={height} still={still} /> : null}
      {scene.weather === 'mist' ? <Mist width={width} height={height} still={still} /> : null}
    </Animated.View>
  );
}

/**
 * Two depths of rain, slanted by a light wind. The far drops are thin and slow, the near
 * ones longer and faster, which is what gives the rain its depth. An overcast wash over
 * the sky keeps a downpour from falling out of a clear night.
 */
function Rain({ width, height, still }: { width: number; height: number; still: boolean }) {
  const field = { width: width * 1.4, height: height * 1.2 };
  const drops = useMemo(() => {
    const random = seededRandom(11);
    const count = Math.round(Math.min(150, Math.max(70, (width * height) / 3600)));
    return Array.from({ length: count }, (_, index) => {
      const near = random() < 0.35;
      return {
        index,
        x: random() * field.width,
        length: near ? 26 + random() * 22 : 12 + random() * 14,
        thickness: near ? 1.5 : 1,
        opacity: near ? 0.32 + random() * 0.26 : 0.14 + random() * 0.14,
        duration: near ? 850 + random() * 300 : 1400 + random() * 600,
        phase: random() * 2000,
        y: random() * field.height,
      };
    });
    // The field only depends on the window size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);
  const fall = useMemo(() => ({
    from: { transform: [{ translateY: -60 }] },
    to: { transform: [{ translateY: field.height + 60 }] },
  }), [field.height]);

  return (
    <>
      <LinearGradient
        colors={['rgba(22, 28, 48, 0.62)', 'rgba(22, 28, 48, 0.28)', 'rgba(22, 28, 48, 0)']}
        locations={[0, 0.32, 0.62]}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={{
          position: 'absolute',
          left: -width * 0.25,
          top: -height * 0.1,
          width: field.width,
          height: field.height,
          transform: [{ rotate: '9deg' }],
        }}
      >
        {drops.map((drop) => (
          <Drop key={drop.index} drop={drop} fall={fall} still={still} />
        ))}
      </View>
    </>
  );
}

function Drop({ drop, fall, still }: {
  drop: { x: number; y: number; length: number; thickness: number; opacity: number; duration: number; phase: number };
  fall: CSSStyle<ViewStyle>['animationName'];
  still: boolean;
}) {
  const style = useMemo<CSSStyle<ViewStyle>>(() => (still ? { top: drop.y } : {
    top: 0,
    animationName: fall,
    animationDuration: drop.duration,
    animationDelay: -drop.phase,
    animationIterationCount: 'infinite',
    animationTimingFunction: 'linear',
  }), [drop, fall, still]);

  return (
    <Animated.View
      style={[
        styles.absolute,
        {
          left: drop.x,
          width: drop.thickness,
          height: drop.length,
          borderRadius: drop.thickness,
          backgroundColor: `rgba(${RAIN}, ${drop.opacity})`,
        },
        style,
      ] as StyleProp<ViewStyle>}
    />
  );
}

/** Mist banks drift over the lake at different speeds, and a few motes rise through them. */
function Mist({ width, height, still }: { width: number; height: number; still: boolean }) {
  const banks = [
    { top: 0.3, size: 0.22, period: 46000, phase: 0, opacity: 0.16 },
    { top: 0.46, size: 0.26, period: 62000, phase: 20000, opacity: 0.2 },
    { top: 0.62, size: 0.2, period: 38000, phase: 9000, opacity: 0.14 },
  ];
  const motes = useMemo(() => {
    const random = seededRandom(23);
    return Array.from({ length: 14 }, (_, index) => ({
      index,
      x: random() * width,
      y: height * (0.35 + random() * 0.4),
      size: 1.5 + random() * 2,
      period: 9000 + random() * 8000,
      phase: random() * 16000,
    }));
  }, [height, width]);

  return (
    <>
      {banks.map((bank) => (
        <Drift
          key={bank.top}
          still={still}
          from={0}
          to={-width * 0.6}
          period={bank.period}
          phase={bank.phase}
          style={{ position: 'absolute', left: 0, top: height * bank.top, width: width * 2.2, height: height * bank.size }}
        >
          <LinearGradient
            colors={[`rgba(${MIST}, 0)`, `rgba(${MIST}, ${bank.opacity})`, `rgba(${MIST}, 0)`]}
            style={StyleSheet.absoluteFill}
          />
        </Drift>
      ))}
      {motes.map((mote) => (
        <Mote key={mote.index} {...mote} still={still} />
      ))}
    </>
  );
}

function Drift({ from, to, period, phase, still, style, children }: {
  from: number; to: number; period: number; phase: number; still: boolean;
  style: ViewStyle; children: React.ReactNode;
}) {
  const motion = useMemo<CSSStyle<ViewStyle>>(() => (still ? {} : {
    animationName: {
      from: { transform: [{ translateX: from }] },
      to: { transform: [{ translateX: to }] },
    },
    animationDuration: period,
    animationDelay: -phase,
    animationIterationCount: 'infinite',
    animationDirection: 'alternate',
    animationTimingFunction: EASE.inOut,
  }), [from, period, phase, still, to]);
  return <Animated.View style={[style, motion] as StyleProp<ViewStyle>}>{children}</Animated.View>;
}

function Mote({ x, y, size, period, phase, still }: {
  x: number; y: number; size: number; period: number; phase: number; still: boolean;
}) {
  const motion = useMemo<CSSStyle<ViewStyle>>(() => (still ? { opacity: 0.35 } : {
    animationName: {
      '0%': { opacity: 0, transform: [{ translateY: 0 }] },
      '40%': { opacity: 0.6 },
      '100%': { opacity: 0, transform: [{ translateY: -90 }] },
    },
    animationDuration: period,
    animationDelay: -phase,
    animationIterationCount: 'infinite',
    animationTimingFunction: 'linear',
  }), [period, phase, still]);
  return (
    <Animated.View
      style={[
        styles.mote,
        { left: x, top: y, width: size, height: size, borderRadius: size / 2 },
        motion,
      ] as StyleProp<ViewStyle>}
    />
  );
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
  absolute: { position: 'absolute' },
  clip: { overflow: 'hidden' },
  topVeil: { position: 'absolute', top: 0, left: 0, right: 0 },
  frameFoot: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  night: { backgroundColor: `rgb(${INK})` },
  ripple: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(246, 223, 184, 0.7)' },
  mote: { position: 'absolute', backgroundColor: 'rgba(246, 223, 184, 0.9)' },
});
