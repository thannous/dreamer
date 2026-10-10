import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { EASE, EASING } from '@/components/motion/motion';
import { DarkTheme } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { StoryNight } from './StoryNight';

const NIGHT = getNoctaliaDesignTokens(DarkTheme, 'dark');

/** The door of the whole story: the blue door of "Cette nuit", in a stone arch, on a sill. */
const DOOR = { width: 156, height: 252, stone: 13, sill: 10 } as const;
const OPENING = { width: DOOR.width - DOOR.stone * 2, height: DOOR.height - DOOR.stone - DOOR.sill } as const;
/** A two-point gap on the free edge: the light is there before the door moves. */
const LEAF = { width: OPENING.width - 2, height: OPENING.height } as const;

const COLOR = {
  light: '#FFF9EF', warm: '#F4E3C6', gold: '#EAD4B4', amber: '#C9A777',
  stoneTop: '#2A2735', stoneBottom: '#14131C',
  blueTop: '#5D8AB3', blueMid: '#3A5A85', blueBottom: '#24385A',
  brass: '#F2DDB8', brassDeep: '#A9844F', ink: '#0E1730',
} as const;

/**
 * One passage, played once (ms). The night is already over the closing sheet; the
 * door arrives with light under it, moonlight crosses it, it swings open on the
 * dream's staircase, the reader walks in, and the light lifts on the next step.
 */
const BEAT = {
  arrive: 80, arriveFor: 700,
  sheen: 620,
  open: 1040, openFor: 900,
  walk: 1760, walkFor: 980,
  bloom: 2240, bloomFor: 520,
  reveal: 2820, revealFor: 560,
} as const;
const REDUCED = { reveal: 900, revealFor: 360 } as const;
const COVERED = 60;
/** A door resists, then gives: a slow start, a long swing, a soft stop. */
const SWING = Easing.bezier(0.6, 0, 0.3, 1);
/** A step taken: it gathers pace until the light takes over. */
const STEP = Easing.bezier(0.5, 0, 0.8, 0.35);

/** Arch with a semicircular head, as an SVG path in a w×h box. */
const arch = (w: number, h: number, x = 0, y = 0) =>
  `M${x} ${y + h} V${y + w / 2} A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y + w / 2} V${y + h} Z`;

/** Dust in the light, drifting up: positions inside the doorway, in scene points. */
const MOTES = [
  { x: 36, y: 190, size: 2.4, period: 3200, delay: 0 }, { x: 70, y: 150, size: 1.6, period: 2800, delay: 600 },
  { x: 104, y: 205, size: 2, period: 3600, delay: 300 }, { x: 52, y: 120, size: 1.4, period: 3000, delay: 1100 },
  { x: 92, y: 96, size: 2.2, period: 3400, delay: 800 }, { x: 118, y: 160, size: 1.5, period: 2600, delay: 200 },
  { x: 28, y: 212, size: 1.8, period: 3800, delay: 1400 }, { x: 80, y: 210, size: 2.6, period: 3300, delay: 500 },
  { x: 120, y: 200, size: 1.6, period: 2900, delay: 900 }, { x: 60, y: 70, size: 1.3, period: 3100, delay: 1600 },
] as const;

/**
 * The end of the onboarding stories: the reader walks through the blue door into
 * its light. `onCovered` fires once the screen is hidden, so the next step can
 * settle out of sight; `onDone` once it is revealed. A touch skips to the end.
 */
export function DoorPassage({ onCovered, onDone }: { onCovered: () => void; onDone: () => void }) {
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  // The night is already there when the sheet slides away: nothing of the previous step shows through.
  const veil = useSharedValue(1);
  const arrive = useSharedValue(reduced ? 1 : 0);
  const open = useSharedValue(reduced ? 1 : 0);
  const walk = useSharedValue(0);
  const bloom = useSharedValue(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const covered = useRef(false);
  const finished = useRef(false);
  // Deep enough that the doorway outgrows the screen on every side.
  const depth = Math.max(width / OPENING.width, height / OPENING.height) * 2.2;

  const cover = () => {
    if (covered.current) return;
    covered.current = true;
    onCovered();
  };
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  };

  useEffect(() => {
    const beat = reduced ? REDUCED : BEAT;
    if (!reduced) {
      arrive.set(withDelay(BEAT.arrive, withTiming(1, { duration: BEAT.arriveFor, easing: EASING.out })));
      open.set(withDelay(BEAT.open, withTiming(1, { duration: BEAT.openFor, easing: SWING })));
      walk.set(withDelay(BEAT.walk, withTiming(1, { duration: BEAT.walkFor, easing: STEP })));
      bloom.set(withDelay(BEAT.bloom, withTiming(1, { duration: BEAT.bloomFor, easing: EASING.out })));
    }
    // The night holds through the passage, then lifts on the next step.
    veil.set(withDelay(beat.reveal, withTiming(0, { duration: beat.revealFor, easing: EASING.out })));
    const haptic = (style: Haptics.ImpactFeedbackStyle) => {
      if (process.env.EXPO_OS !== 'web') void Haptics.impactAsync(style);
    };
    timers.current = [
      setTimeout(cover, COVERED),
      setTimeout(finish, beat.reveal + beat.revealFor),
      ...(reduced ? [] : [
        setTimeout(() => haptic(Haptics.ImpactFeedbackStyle.Soft), BEAT.open + 60),
        setTimeout(() => haptic(Haptics.ImpactFeedbackStyle.Light), BEAT.bloom),
      ]),
    ];
    return () => timers.current.forEach(clearTimeout);
    // One passage per mount: the callbacks of the first render are the ones that count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A touch is a hurry: the light lifts at once on the next step.
  const skip = () => {
    if (finished.current) return;
    timers.current.forEach(clearTimeout);
    cover();
    veil.set(withTiming(0, { duration: 280, easing: EASING.out }));
    timers.current = [setTimeout(finish, 300)];
  };

  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.get() }));
  // The sky moves less than the door: depth, not a zoom on a picture.
  const skyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(walk.get(), [0, 1], [1, 0.55]),
    transform: [{ scale: interpolate(walk.get(), [0, 1], [1, 1.22]) }],
  }));
  const vignetteStyle = useAnimatedStyle(() => ({ opacity: interpolate(walk.get(), [0, 0.6], [0, 1], 'clamp') }));
  const sceneStyle = useAnimatedStyle(() => ({
    opacity: arrive.get(),
    transform: [
      { translateY: interpolate(arrive.get(), [0, 1], [26, 0]) },
      { scale: interpolate(arrive.get(), [0, 1], [0.94, 1]) * interpolate(walk.get(), [0, 1], [1, depth]) },
    ],
  }));
  // Light under the door before it moves, then everywhere the door lets it.
  const crackStyle = useAnimatedStyle(() => ({
    opacity: interpolate(arrive.get(), [0.5, 1], [0, 0.85], 'clamp') * interpolate(open.get(), [0, 0.4], [1, 0], 'clamp'),
  }));
  const lightStyle = useAnimatedStyle(() => ({ opacity: interpolate(open.get(), [0, 0.25, 1], [0.18, 0.8, 1]) }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(open.get(), [0, 1], [0.12, 1]),
    transform: [{ scale: interpolate(open.get(), [0, 1], [0.82, 1.08]) }],
  }));
  const raysStyle = useAnimatedStyle(() => ({
    opacity: interpolate(open.get(), [0.1, 1], [0, 0.95], 'clamp'),
    transform: [{ scaleX: interpolate(open.get(), [0, 1], [0.25, 1]) }],
  }));
  const motesStyle = useAnimatedStyle(() => ({ opacity: interpolate(open.get(), [0.35, 1], [0, 1], 'clamp') }));
  // The leaf swings into the house on its left hinge; past 80° it is an edge of blue.
  const leafStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 620 }, { rotateY: `${-82 * open.get()}deg` }],
  }));
  const leafShadeStyle = useAnimatedStyle(() => ({ opacity: interpolate(open.get(), [0, 1], [0, 0.62]) }));
  // The free edge catches the light as it turns away from it.
  const edgeStyle = useAnimatedStyle(() => ({ opacity: interpolate(open.get(), [0, 0.3, 0.8, 1], [0, 1, 0.7, 0.4]) }));
  const bloomStyle = useAnimatedStyle(() => ({
    opacity: bloom.get(),
    transform: [{ scale: interpolate(bloom.get(), [0, 1], [0.2, 3.2]) }],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: interpolate(bloom.get(), [0.45, 1], [0, 0.94], 'clamp') }));
  const bloomSize = Math.max(width, height);

  return <Animated.View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
    testID="component.onboarding.doorPassage"
    style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: NIGHT.screen.background }, veilStyle]}>
    <Pressable onPress={skip} style={StyleSheet.absoluteFill} testID="btn.onboarding.doorPassage.skip">
      <Animated.View style={[StyleSheet.absoluteFill, skyStyle]}>
        <StoryNight tokens={NIGHT} page={{ key: 'door', index: 12 }} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, vignetteStyle]}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="dpVignette" cx="50%" cy="52%" r="62%">
              <Stop offset="0.35" stopColor={NIGHT.screen.background} stopOpacity={0} />
              <Stop offset="1" stopColor={NIGHT.screen.background} stopOpacity={0.92} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#dpVignette)" />
        </Svg>
      </Animated.View>

      <View pointerEvents="none" style={styles.stage}>
        <Animated.View style={[styles.scene, sceneStyle]}>
          {/* The light behind the door, larger than it: it seems to leak around the stone. */}
          <Animated.View style={[styles.glow, glowStyle]}>
            <Svg width="100%" height="100%">
              <Defs>
                <RadialGradient id="dpGlow" cx="50%" cy="56%" r="50%">
                  <Stop offset="0" stopColor={COLOR.light} stopOpacity={0.6} />
                  <Stop offset="0.22" stopColor={COLOR.gold} stopOpacity={0.24} />
                  <Stop offset="0.55" stopColor={COLOR.amber} stopOpacity={0.06} />
                  <Stop offset="1" stopColor={COLOR.amber} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#dpGlow)" />
            </Svg>
          </Animated.View>

          {/* The light thrown on the ground in front of the sill: a pool that fades on every side. */}
          <Animated.View style={[styles.rays, raysStyle]}>
            <Svg width="100%" height="100%">
              <Defs>
                {/* Gone before the sides of its box: no edge can show. */}
                <RadialGradient id="dpRays" cx="50%" cy="0%" r="100%">
                  <Stop offset="0" stopColor={COLOR.light} stopOpacity={0.62} />
                  <Stop offset="0.16" stopColor={COLOR.gold} stopOpacity={0.3} />
                  <Stop offset="0.46" stopColor={COLOR.amber} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#dpRays)" />
            </Svg>
          </Animated.View>

          {/* The arch: thick stone, a gilded rim, a sill. */}
          <Svg width={DOOR.width} height={DOOR.height} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="dpStone" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={COLOR.stoneTop} />
                <Stop offset="1" stopColor={COLOR.stoneBottom} />
              </LinearGradient>
              <LinearGradient id="dpSill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={COLOR.amber} stopOpacity={0.55} />
                <Stop offset="0.25" stopColor={COLOR.stoneTop} />
                <Stop offset="1" stopColor={COLOR.stoneBottom} />
              </LinearGradient>
            </Defs>
            <Path d={arch(DOOR.width, DOOR.height - DOOR.sill)} fill="url(#dpStone)" />
            <Path d={arch(DOOR.width - 1, DOOR.height - DOOR.sill - 0.5, 0.5, 0.5)} fill="none" stroke={COLOR.gold} strokeOpacity={0.55} strokeWidth={1} />
            <Rect x={0} y={DOOR.height - DOOR.sill} width={DOOR.width} height={DOOR.sill} rx={2} fill="url(#dpSill)" />
          </Svg>

          {/* The doorway: light, and the dream's staircase rising into it. */}
          <View style={styles.opening}>
            <Animated.View style={[StyleSheet.absoluteFill, lightStyle]}>
              <Svg width={OPENING.width} height={OPENING.height}>
                <Defs>
                  <RadialGradient id="dpInside" cx="50%" cy="38%" r="75%">
                    <Stop offset="0" stopColor={COLOR.light} />
                    <Stop offset="0.55" stopColor={COLOR.warm} />
                    <Stop offset="1" stopColor={COLOR.amber} />
                  </RadialGradient>
                </Defs>
                <Rect width={OPENING.width} height={OPENING.height} fill="url(#dpInside)" />
                <Staircase width={OPENING.width} height={OPENING.height} />
                {/* The depth of the wall, shaded on its inner faces. */}
                <Path d={arch(OPENING.width, OPENING.height)} fill="none" stroke={COLOR.amber} strokeOpacity={0.55} strokeWidth={5} />
              </Svg>
            </Animated.View>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, motesStyle]}>
              {MOTES.map((mote) => <Animated.View key={`${mote.x}-${mote.y}`} style={[styles.mote, {
                left: mote.x, top: mote.y, width: mote.size, height: mote.size, borderRadius: mote.size,
              }, !reduced && {
                animationName: {
                  from: { opacity: 0, transform: [{ translateY: 0 }, { translateX: 0 }] },
                  '50%': { opacity: 0.95 },
                  to: { opacity: 0, transform: [{ translateY: -46 }, { translateX: 6 }] },
                },
                animationDuration: mote.period,
                animationDelay: mote.delay,
                animationIterationCount: 'infinite',
                animationTimingFunction: EASE.inOut,
              }]} />)}
            </Animated.View>

            <Animated.View style={[styles.leaf, leafStyle]}>
              <Leaf reduced={reduced} />
              <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: NIGHT.screen.background }, leafShadeStyle]} />
              <Animated.View style={[styles.edge, edgeStyle]} />
            </Animated.View>
          </View>
          <Animated.View style={[styles.crack, crackStyle]} />
          <Animated.View style={[styles.seam, crackStyle]} />
        </Animated.View>
      </View>

      {/* The light takes the screen from the doorway outward, then everywhere. */}
      <Animated.View pointerEvents="none" style={[styles.bloom, {
        width: bloomSize, height: bloomSize, borderRadius: bloomSize / 2,
        left: (width - bloomSize) / 2, top: (height - bloomSize) / 2,
      }, bloomStyle]}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="dpBloom" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={COLOR.light} />
              <Stop offset="0.6" stopColor={COLOR.warm} stopOpacity={0.85} />
              <Stop offset="1" stopColor={COLOR.gold} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#dpBloom)" />
        </Svg>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: COLOR.warm }, flashStyle]} />
    </Pressable>
  </Animated.View>;
}

/** The blue leaf: two moulded panels, hinges, a brass knob; moonlight crosses it once. */
function Leaf({ reduced }: { reduced: boolean }) {
  const { width: w, height: h } = LEAF;
  const inset = 15;
  const top = { x: inset, y: 26, w: w - inset * 2, h: h * 0.42 };
  const bottom = { x: inset, y: h * 0.62, w: w - inset * 2, h: h * 0.3 };
  const panel = (p: { x: number; y: number; w: number; h: number }, arched: boolean) =>
    arched ? arch(p.w, p.h, p.x, p.y) : `M${p.x} ${p.y} H${p.x + p.w} V${p.y + p.h} H${p.x} Z`;
  const knob = { x: w - 17, y: h * 0.55 };
  return <View style={StyleSheet.absoluteFill}>
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id="dpBlue" x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor={COLOR.blueTop} />
          <Stop offset="0.55" stopColor={COLOR.blueMid} />
          <Stop offset="1" stopColor={COLOR.blueBottom} />
        </LinearGradient>
        <LinearGradient id="dpGrain" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={COLOR.light} stopOpacity={0.07} />
          <Stop offset="0.5" stopColor={COLOR.light} stopOpacity={0} />
          <Stop offset="1" stopColor={NIGHT.screen.background} stopOpacity={0.18} />
        </LinearGradient>
        <RadialGradient id="dpBrass" cx="40%" cy="35%" r="65%">
          <Stop offset="0" stopColor={COLOR.brass} />
          <Stop offset="1" stopColor={COLOR.brassDeep} />
        </RadialGradient>
      </Defs>
      <Path d={arch(w, h)} fill="url(#dpBlue)" />
      <Path d={arch(w, h)} fill="url(#dpGrain)" />
      {/* Each panel is sunk into the leaf: shadow on its upper edges, light on its lower ones. */}
      {[{ p: top, arched: true }, { p: bottom, arched: false }].map(({ p, arched }) => <G key={arched ? 'top' : 'bottom'}>
        <Path d={panel(p, arched)} fill="#1C2D4B" fillOpacity={0.34} />
        <Path d={panel(p, arched)} fill="none" stroke={COLOR.ink} strokeOpacity={0.7} strokeWidth={2} transform="translate(-1 -1)" />
        <Path d={panel(p, arched)} fill="none" stroke={COLOR.light} strokeOpacity={0.28} strokeWidth={1.2} transform="translate(1 1)" />
      </G>)}
      {/* Hinges on the left edge. */}
      <Rect x={0} y={h * 0.24} width={4} height={14} rx={1} fill={COLOR.ink} fillOpacity={0.7} />
      <Rect x={0} y={h * 0.78} width={4} height={14} rx={1} fill={COLOR.ink} fillOpacity={0.7} />
      {/* Brass knob on its plate, with a keyhole. */}
      <Rect x={knob.x - 3.5} y={knob.y - 9} width={7} height={26} rx={3.5} fill={COLOR.brassDeep} fillOpacity={0.75} />
      <Circle cx={knob.x} cy={knob.y} r={5.2} fill="url(#dpBrass)" />
      <Circle cx={knob.x - 1.6} cy={knob.y - 1.7} r={1.4} fill={COLOR.light} fillOpacity={0.85} />
      <Circle cx={knob.x} cy={knob.y + 10} r={1.3} fill={COLOR.ink} />
      <Rect x={knob.x - 0.6} y={knob.y + 10} width={1.2} height={3.4} fill={COLOR.ink} />
    </Svg>
    {!reduced ? <View style={[StyleSheet.absoluteFill, styles.leafClip]}>
      <Animated.View style={[styles.sheen, {
        animationName: {
          from: { transform: [{ translateX: -w }, { rotate: '18deg' }], opacity: 0 },
          '30%': { opacity: 1 },
          to: { transform: [{ translateX: w * 1.6 }, { rotate: '18deg' }], opacity: 0 },
        },
        animationDuration: 1000,
        animationDelay: BEAT.sheen,
        animationTimingFunction: EASE.inOut,
        animationFillMode: 'both',
      }]}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="dpSheen" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={COLOR.light} stopOpacity={0} />
              <Stop offset="0.5" stopColor={COLOR.light} stopOpacity={0.32} />
              <Stop offset="1" stopColor={COLOR.light} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#dpSheen)" />
        </Svg>
      </Animated.View>
    </View> : null}
  </View>;
}

/** The staircase of "Cette nuit", rising into the light: fainter and narrower as it climbs. */
function Staircase({ width: w, height: h }: { width: number; height: number }) {
  const steps = 8;
  const base = h;
  const summit = h * 0.42;
  return <G>
    {Array.from({ length: steps }, (_, index) => {
      const t0 = index / steps;
      const t1 = (index + 1) / steps;
      // Perspective: each step is shorter and narrower than the one below it.
      const y0 = base - (base - summit) * (1 - (1 - t0) ** 1.6);
      const y1 = base - (base - summit) * (1 - (1 - t1) ** 1.6);
      const half0 = (w / 2) * (0.92 - t0 * 0.62);
      const half1 = (w / 2) * (0.92 - t1 * 0.62);
      const riser = y0 - (y0 - y1) * 0.45;
      const fade = 0.5 * (1 - t0 * 0.85);
      return <G key={index}>
        <Path d={`M${w / 2 - half0} ${y0} H${w / 2 + half0} V${riser} H${w / 2 - half0} Z`} fill={COLOR.amber} fillOpacity={fade} />
        <Path d={`M${w / 2 - half0} ${riser} H${w / 2 + half0} L${w / 2 + half1} ${y1} H${w / 2 - half1} Z`} fill={COLOR.gold} fillOpacity={fade * 0.7} />
      </G>;
    })}
    {/* A banister climbing on the right, and a second rail behind it. */}
    <Path d={`M${w * 0.9} ${base - 6} L${w * 0.66} ${summit + 4}`} stroke={COLOR.amber} strokeOpacity={0.45} strokeWidth={1.5} />
    <Path d={`M${w * 0.93} ${base - 22} L${w * 0.68} ${summit - 10}`} stroke={COLOR.amber} strokeOpacity={0.3} strokeWidth={1} />
  </G>;
}

const styles = StyleSheet.create({
  root: { zIndex: 100 },
  // The door stands a little below the middle, where the eye rests on a portrait screen.
  stage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  scene: { width: DOOR.width, height: DOOR.height },
  glow: { position: 'absolute', left: -DOOR.width * 0.9, top: -DOOR.height * 0.45, width: DOOR.width * 2.8, height: DOOR.height * 1.9 },
  rays: { position: 'absolute', left: -DOOR.width * 0.6, top: DOOR.height - 4, width: DOOR.width * 2.2, height: 150, transformOrigin: 'top center' },
  opening: {
    position: 'absolute', left: DOOR.stone, top: DOOR.stone, width: OPENING.width, height: OPENING.height,
    overflow: 'hidden', borderTopLeftRadius: OPENING.width / 2, borderTopRightRadius: OPENING.width / 2,
  },
  mote: { position: 'absolute', backgroundColor: COLOR.light },
  leaf: {
    width: LEAF.width, height: LEAF.height, overflow: 'hidden', transformOrigin: 'left center',
    borderTopLeftRadius: LEAF.width / 2, borderTopRightRadius: LEAF.width / 2,
  },
  leafClip: { overflow: 'hidden', borderTopLeftRadius: LEAF.width / 2, borderTopRightRadius: LEAF.width / 2 },
  sheen: { position: 'absolute', top: -40, bottom: -40, width: LEAF.width * 0.55 },
  edge: { position: 'absolute', top: LEAF.width / 2, bottom: 0, right: 0, width: 2, backgroundColor: COLOR.light },
  crack: {
    position: 'absolute', left: DOOR.stone + 4, right: DOOR.stone + 4, top: DOOR.height - DOOR.sill - 1.5, height: 2.5,
    borderRadius: 2, backgroundColor: COLOR.light,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 10, spreadDistance: 2, color: COLOR.gold }],
  },
  // The gap on the free edge, from the spring of the arch down to the sill.
  seam: {
    position: 'absolute', right: DOOR.stone, top: DOOR.stone + OPENING.width / 2, width: 2, height: OPENING.height - OPENING.width / 2,
    backgroundColor: COLOR.light, boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 8, spreadDistance: 1, color: COLOR.gold }],
  },
  bloom: { position: 'absolute' },
});
