import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cubicBezier, useReducedMotion, type CSSStyle } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { EASE } from '@/components/motion';
import { SLEEP_SOUNDS, type SleepSoundId } from '@/lib/sleepSounds';

import {
  SLEEP_AMBIENCE_SCENES,
  getSceneFrame,
  seededRandom,
  type SceneLight,
  type SleepAmbienceScene as Scene,
} from './sleepAmbienceScenes';
import { useContentWindow } from '@/context/ContentWindowContext';

const WARM = '#F6DFB8';
const RAIN = '214, 224, 245';
const MIST = '206, 192, 228';
const INK = '3, 4, 13';

/** Scenes cross-fade like a slow dissolve between two places, never a slide. */
const SCENE_FADE_MS = 1200;
/** Dimming the night once the sound starts takes as long as a long breath out. */
const NIGHT_FALL_MS = 2400;

/**
 * One swell's whole life, from the far water to the shore and back out. The waves loop
 * swells on the same slow cycle, so the light on the water moves with what is heard.
 */
const SWELL_PERIOD_MS = 18000;
/** Swells in flight at once: one reaches the shore every period / count. */
const SWELL_COUNT = 4;
const SWELL_INTERVAL_MS = SWELL_PERIOD_MS / SWELL_COUNT;
/** Share of a swell's cycle spent rolling in; the rest is the backwash. */
const SWELL_ARRIVAL = 0.8;
/**
 * Seen from the shore, a swell gathers speed as it nears, the way perspective draws
 * anything coming closer. Close to a quadratic ease-in, which `swellReaches` inverts.
 */
const APPROACH = cubicBezier(0.55, 0.085, 0.68, 0.53);
/** A swell is a line of light wider than the scene, centred on the moon's path. */
const CREST_WIDTH = 1800;
const CREST_HEIGHT = 30;

type Props = {
  soundId: SleepSoundId;
  /** The sound is playing: the night deepens and the copy steps back. */
  playing: boolean;
  /** The page's ground, which the lower half of the scene melts into. */
  ground: string;
};

/**
 * The living backdrop of the sleep sounds screen. Every ambience has its painting and
 * the motion of its sound: rain falls across the forest, slow swells roll in under the
 * moon, mist drifts over the lake and rises from it. Decorative only, hidden from
 * assistive technology.
 *
 * Under reduce motion nothing moves: the drops, swells, glints and mist hold still, the
 * lights keep a steady glow and the scenes still cross-fade, so a change of ambience
 * stays explained.
 */
export const SleepAmbienceScene = memo(function SleepAmbienceScene({ soundId, playing, ground }: Props) {
  const reduced = useReducedMotion();
  const { width, height } = useContentWindow();

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
        {active && scene.weather === 'tide' ? <Swell scene={scene} scale={frame.scale} still={still} /> : null}
        {active && scene.glintPath ? <Glints scene={scene} scale={frame.scale} still={still} /> : null}
        {active && scene.ripples ? <Ripples scene={scene} scale={frame.scale} still={still} /> : null}
        {active && scene.weather === 'mist' ? <Mist scene={scene} scale={frame.scale} still={still} /> : null}
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

/**
 * When a swell passes a point of the water, as a share of the swell's cycle. The swell's
 * depth follows `APPROACH`, close to the square of the time, so the time is a square root.
 */
function swellReaches(water: NonNullable<Scene['water']>, y: number) {
  const depth = Math.min(1, Math.max(0, (y - water.horizon) / (water.shore - water.horizon)));
  return SWELL_ARRIVAL * Math.sqrt(depth);
}

/**
 * A swell rolling in from the far water: a broken line of light, warm where it crosses
 * the moon's path and silver elsewhere, that widens as it nears, dims over the dark near
 * water, reaches the shore, then draws back and fades.
 */
function Swell({ scene, scale, still }: { scene: Scene; scale: number; still: boolean }) {
  const water = scene.water!;
  const center = scene.glintPath?.x ?? scene.width / 2;
  return (
    <>
      {Array.from({ length: SWELL_COUNT }, (_, index) => (
        <Crest
          key={index}
          index={index}
          left={(center - CREST_WIDTH / 2) * scale}
          top={(water.horizon - CREST_HEIGHT / 2) * scale}
          travel={(water.shore - water.horizon) * scale}
          scale={scale}
          still={still}
        />
      ))}
    </>
  );
}

function Crest({ index, left, top, travel, scale, still }: {
  index: number; left: number; top: number; travel: number; scale: number; still: boolean;
}) {
  const segments = useMemo(() => {
    const random = seededRandom(41 + index);
    // Wavelets on either side of the moon's path, in the crest's 1000 x 20 frame. They
    // dim away from the path and sit a little off the line, so the swell never reads as a rule.
    const silver = Array.from({ length: 9 }, () => {
      const offset = 60 + random() * 420;
      const cx = 500 + (random() < 0.5 ? -offset : offset);
      return {
        cx,
        cy: 10 + (random() - 0.5) * 5,
        rx: 30 + random() * 80,
        ry: 2.5 + random() * 2,
        opacity: (0.55 + random() * 0.45) * (1 - (0.65 * offset) / 480),
      };
    });
    return { moon: { rx: 70 + random() * 50 }, silver };
  }, [index]);

  const style = useMemo<CSSStyle<ViewStyle>>(() => {
    if (still) {
      // Held at evenly spaced depths, as if the sea stopped mid-breath.
      const depth = (index + 1) / (SWELL_COUNT + 1);
      const spread = 0.3 + 0.7 * depth;
      return {
        opacity: 0.6,
        transform: [{ translateY: travel * depth * depth }, { scaleX: spread }, { scaleY: spread }],
      };
    }
    return {
      animationName: {
        '0%': { opacity: 0, transform: [{ translateY: 0 }, { scaleX: 0.3 }, { scaleY: 0.4 }] },
        '30%': { opacity: 1 },
        // Out of the moon's path the near water is dark, so the swell dims as it comes in.
        '60%': { opacity: 0.75 },
        [`${SWELL_ARRIVAL * 100}%`]: {
          opacity: 0.3,
          transform: [{ translateY: travel }, { scaleX: 1 }, { scaleY: 1 }],
        },
        // The backwash: the line draws back a little as it fades on the shore.
        '100%': { opacity: 0, transform: [{ translateY: travel * 0.94 }, { scaleX: 1.04 }, { scaleY: 0.6 }] },
      },
      animationDuration: SWELL_PERIOD_MS,
      animationDelay: -index * SWELL_INTERVAL_MS,
      animationIterationCount: 'infinite',
      animationTimingFunction: APPROACH,
    };
  }, [index, still, travel]);
  const moonId = `swell-moon-${index}`;
  const silverId = `swell-silver-${index}`;

  return (
    <Animated.View
      style={[
        styles.absolute,
        { left, top, width: CREST_WIDTH * scale, height: CREST_HEIGHT * scale },
        style,
      ] as StyleProp<ViewStyle>}
    >
      <Svg width="100%" height="100%" viewBox="0 0 1000 20" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={moonId} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={WARM} stopOpacity="1" />
            <Stop offset="0.5" stopColor={WARM} stopOpacity="0.55" />
            <Stop offset="1" stopColor={WARM} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={silverId} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={`rgb(${RAIN})`} stopOpacity="1" />
            <Stop offset="0.5" stopColor={`rgb(${RAIN})`} stopOpacity="0.45" />
            <Stop offset="1" stopColor={`rgb(${RAIN})`} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {/* The face of the swell, catching a little light along its whole length. */}
        <Ellipse cx={500} cy={10} rx={340} ry={9} fill={`url(#${silverId})`} opacity={0.28} />
        {segments.silver.map((segment, i) => (
          <Ellipse
            key={i}
            cx={segment.cx}
            cy={segment.cy}
            rx={segment.rx}
            ry={segment.ry}
            fill={`url(#${silverId})`}
            opacity={segment.opacity}
          />
        ))}
        <Ellipse cx={500} cy={10} rx={segments.moon.rx} ry={7} fill={`url(#${moonId})`} />
      </Svg>
    </Animated.View>
  );
}

/** Rings that open on the water around the stones, as each swell reaches them. */
function Ripples({ scene, scale, still }: { scene: Scene; scale: number; still: boolean }) {
  const water = scene.water;
  return (
    <>
      {scene.ripples!.map((ripple, index) => {
        // A ring opens when a swell passes its stone: the swells arrive every interval.
        const phase = water
          ? (SWELL_INTERVAL_MS - ((swellReaches(water, ripple.y) * SWELL_PERIOD_MS) % SWELL_INTERVAL_MS))
            % SWELL_INTERVAL_MS
          : index * 2300;
        return (
          <Ripple key={`${ripple.x}-${ripple.y}`} {...ripple} scale={scale} still={still} phase={phase} />
        );
      })}
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
    animationDuration: SWELL_INTERVAL_MS,
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

/**
 * The mist of the lake, in the painting's own pixels so it lies on the water on every
 * screen. Banks drift towards the house at their own depths, the near ones faster, which
 * is what gives the mist its depth; plumes rise from the water and a few motes float up.
 */
function Mist({ scene, scale, still }: { scene: Scene; scale: number; still: boolean }) {
  const water = scene.water;
  const plumes = useMemo(() => {
    if (!water) return [];
    const random = seededRandom(29);
    return Array.from({ length: 7 }, (_, index) => ({
      index,
      x: ((index + 0.2 + random() * 0.6) / 7) * scene.width,
      y: water.horizon + (0.3 + random() * 0.7) * (water.shore - water.horizon),
      rx: 110 + random() * 80,
      ry: 50 + random() * 30,
      rise: 220 + random() * 120,
      period: 16000 + random() * 9000,
      phase: random() * 25000,
    }));
  }, [scene.width, water]);
  const motes = useMemo(() => {
    if (!water) return [];
    const random = seededRandom(23);
    return Array.from({ length: 14 }, (_, index) => ({
      index,
      x: random() * scene.width,
      y: water.horizon + random() * (water.shore - water.horizon),
      size: 1.5 + random() * 2,
      period: 9000 + random() * 8000,
      phase: random() * 16000,
    }));
  }, [scene.width, water]);

  return (
    <>
      {scene.mistBanks?.map((bank, index) => (
        <MistBank key={bank.y} bank={bank} index={index} width={scene.width} scale={scale} still={still} />
      ))}
      {plumes.map((plume) => (
        <Plume key={plume.index} {...plume} scale={scale} still={still} />
      ))}
      {motes.map((mote) => (
        <Mote key={mote.index} {...mote} x={mote.x * scale} y={mote.y * scale} still={still} />
      ))}
    </>
  );
}

/**
 * A bank of soft clouds twice the painting's width that slides one painting width and
 * starts over. The clouds repeat every painting width, so the loop has no seam.
 */
function MistBank({ bank, index, width, scale, still }: {
  bank: NonNullable<Scene['mistBanks']>[number]; index: number; width: number; scale: number; still: boolean;
}) {
  const clouds = useMemo(() => {
    const random = seededRandom(31 + index);
    // A few distinct clouds with clear air between them, so the drift reads as motion.
    const count = 4 + index;
    return Array.from({ length: count }, (_, i) => ({
      x: ((i + random() * 0.7) / count) * width,
      y: bank.height * (0.4 + random() * 0.2),
      rx: width * (0.1 + random() * 0.1),
      ry: bank.height * (0.3 + random() * 0.18),
      opacity: 0.55 + random() * 0.45,
    }));
  }, [bank.height, index, width]);
  const drift = useMemo<CSSStyle<ViewStyle>>(() => (still ? {} : {
    animationName: {
      from: { transform: [{ translateX: 0 }] },
      to: { transform: [{ translateX: -width * scale }] },
    },
    animationDuration: bank.period,
    // Each bank starts somewhere along its way, so the banks never line up.
    animationDelay: -bank.period * ((index * 0.37) % 1),
    animationIterationCount: 'infinite',
    animationTimingFunction: 'linear',
  }), [bank.period, index, scale, still, width]);
  const id = `mist-${index}`;

  return (
    <Animated.View
      style={[
        styles.absolute,
        { left: 0, top: (bank.y - bank.height / 2) * scale, width: width * 2 * scale, height: bank.height * scale },
        drift,
      ] as StyleProp<ViewStyle>}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${width * 2} ${bank.height}`} preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={`rgb(${MIST})`} stopOpacity={bank.opacity} />
            <Stop offset="0.45" stopColor={`rgb(${MIST})`} stopOpacity={bank.opacity * 0.6} />
            <Stop offset="1" stopColor={`rgb(${MIST})`} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {/* Copies one width either side fill the edges, whichever way the loop is caught. */}
        {[-width, 0, width, width * 2].flatMap((offset) => clouds.map((cloud, i) => (
          <Ellipse
            key={`${offset}-${i}`}
            cx={cloud.x + offset}
            cy={cloud.y}
            rx={cloud.rx}
            ry={cloud.ry}
            fill={`url(#${id})`}
            opacity={cloud.opacity}
          />
        )))}
      </Svg>
    </Animated.View>
  );
}

/** Mist lifting off the water: a soft cloud that rises, spreads and thins away. */
function Plume({ index, x, y, rx, ry, rise, period, phase, scale, still }: {
  index: number; x: number; y: number; rx: number; ry: number; rise: number; period: number; phase: number;
  scale: number; still: boolean;
}) {
  const motion = useMemo<CSSStyle<ViewStyle>>(() => (still ? { opacity: 0.5 } : {
    animationName: {
      '0%': { opacity: 0, transform: [{ translateY: 0 }, { scale: 0.6 }] },
      '40%': { opacity: 1 },
      '100%': { opacity: 0, transform: [{ translateY: -rise * scale }, { scale: 1.5 }] },
    },
    animationDuration: period,
    animationDelay: -phase,
    animationIterationCount: 'infinite',
    animationTimingFunction: 'linear',
  }), [period, phase, rise, scale, still]);
  const id = `plume-${index}`;

  return (
    <Animated.View
      style={[
        styles.absolute,
        { left: (x - rx) * scale, top: (y - ry) * scale, width: rx * 2 * scale, height: ry * 2 * scale },
        motion,
      ] as StyleProp<ViewStyle>}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={`rgb(${MIST})`} stopOpacity="0.5" />
            <Stop offset="0.5" stopColor={`rgb(${MIST})`} stopOpacity="0.24" />
            <Stop offset="1" stopColor={`rgb(${MIST})`} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx={50} cy={50} rx={50} ry={50} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
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
