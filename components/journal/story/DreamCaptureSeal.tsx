import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type LayoutRectangle,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { type CSSAnimationKeyframes, type CSSStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { EASE } from '@/components/motion/motion';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { TID } from '@/lib/testIDs';

import { DREAM_STORY } from './dreamStoryMotion';
import { sparklePath } from './sparkle';

const GLOW = 280;
const SPARK = 28;
const GLINT = 44;
const RING = 200;
/** Where the saved moment's medallion opens on the next screen, below its navigation. */
const MEDALLION_CENTER_FROM_TOP = 76 + 120;
const WORDS = 180;
/** How far a word travels toward the glow before it is gone. */
const WORD_PULL = 0.8;

/**
 * The seal's beats, in percent of the prologue. Every keyframe below is placed against
 * these, so the story keeps its proportions whatever the prologue lasts.
 */
const BEAT = {
  /** The veil is down and the words are read. */
  night: 20,
  wordsIn: 18,
  /** The first word leaves for the glow; the last one leaves `gatherSpread` later. */
  gather: 40,
  gatherSpread: 14,
  wordFlight: 10,
  /** The glow has swallowed the words and the star is lit. */
  starBorn: 66,
  starSettled: 72,
} as const;

/** The night sky behind the seal, in fractions of the screen. Fixed so every save shows the same sky. */
const SKY = [
  { x: 0.14, y: 0.12, size: 3, at: 8, pulse: 38 },
  { x: 0.78, y: 0.08, size: 2, at: 11 },
  { x: 0.9, y: 0.22, size: 2.5, at: 14, pulse: 50 },
  { x: 0.32, y: 0.24, size: 2, at: 17 },
  { x: 0.62, y: 0.17, size: 3, at: 10 },
  { x: 0.06, y: 0.38, size: 2, at: 20 },
  { x: 0.94, y: 0.44, size: 2, at: 13, pulse: 44 },
  { x: 0.2, y: 0.66, size: 2.5, at: 22 },
  { x: 0.84, y: 0.62, size: 3, at: 16 },
  { x: 0.5, y: 0.78, size: 2, at: 24, pulse: 56 },
  { x: 0.1, y: 0.86, size: 3, at: 19 },
  { x: 0.7, y: 0.9, size: 2, at: 26 },
  { x: 0.38, y: 0.93, size: 2.5, at: 28 },
  { x: 0.9, y: 0.82, size: 2, at: 21, pulse: 34 },
] as const;

/** Motes of light drawn in from around the words, each from its own point of an ellipse. */
const MOTES = [1, 0.7, 0.9, 0.6, 1, 0.75, 0.95, 0.65, 0.85, 0.8].map((reach, index) => {
  const angle = ((index * 36 + 12) * Math.PI) / 180;
  return { x: Math.cos(angle) * 150 * reach, y: Math.sin(angle) * 96 * reach, from: 42 + index * 1.2 };
});

/** The comet's tail: echoes of the star that follow it up, each later, smaller and fainter. */
const TRAIL = [
  { delay: 70, size: 8, opacity: 0.5 },
  { delay: 140, size: 6, opacity: 0.3 },
  { delay: 210, size: 4, opacity: 0.15 },
] as const;

const pct = (value: number) => `${Math.round(value * 10) / 10}%`;

const excerpt = (text: string) => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > WORDS ? `${flat.slice(0, WORDS - 1).trimEnd()}…` : flat;
};

const skyStar = (at: number, pulse?: number): CSSAnimationKeyframes<ViewStyle> => {
  const still = { opacity: 1, transform: [{ scale: 1 }] };
  return {
    '0%': { opacity: 0, transform: [{ scale: 1 }] },
    [pct(at)]: { opacity: 0, transform: [{ scale: 1 }] },
    [pct(at + 7)]: still,
    ...(pulse ? {
      [pct(pulse)]: still,
      [pct(pulse + 4)]: { opacity: 1, transform: [{ scale: 2 }] },
      [pct(pulse + 10)]: still,
    } : null),
    '100%': still,
  };
};

const moteFlight = (x: number, y: number, from: number): CSSAnimationKeyframes<ViewStyle> => {
  const away = (opacity: number, scale: number) => ({ opacity, transform: [{ translateX: x }, { translateY: y }, { scale }] });
  const gathered = { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 0.3 }] };
  return {
    '0%': away(0, 0.5),
    [pct(from)]: away(0, 0.5),
    [pct(from + 3)]: away(1, 1),
    [pct(from + 12)]: gathered,
    '100%': gathered,
  };
};

/** A word, read, then catching the light in reading order and flying into the glow. */
const wordFlight = (
  index: number, count: number, dx: number, dy: number, ink: string, light: string
): CSSAnimationKeyframes<TextStyle> => {
  const from = BEAT.gather + (count > 1 ? (BEAT.gatherSpread * index) / (count - 1) : 0);
  const at = (opacity: number, pull: number, y: number, scale: number, color: string) => ({
    opacity, color, transform: [{ translateX: dx * pull }, { translateY: dy * pull + y }, { scale }],
  });
  return {
    '0%': at(0, 0, 8, 1, ink),
    [pct(BEAT.wordsIn)]: at(1, 0, 0, 1, ink),
    [pct(from)]: at(1, 0, 0, 1, ink),
    [pct(from + 3)]: at(1, 0.15, 0, 1.06, light),
    [pct(from + BEAT.wordFlight)]: at(0, 1, 0, 0.3, light),
    '100%': at(0, 1, 0, 0.3, light),
  };
};

const ringWave = (born: number, fade: number, reach: number, peak: number): CSSAnimationKeyframes<ViewStyle> => ({
  '0%': { opacity: 0, transform: [{ scale: 0.08 }] },
  [pct(born)]: { opacity: 0, transform: [{ scale: 0.08 }] },
  [pct(born + 2)]: { opacity: peak, transform: [{ scale: 0.2 }] },
  [pct(fade)]: { opacity: 0, transform: [{ scale: reach }] },
  '100%': { opacity: 0, transform: [{ scale: reach }] },
});

/**
 * The prologue of the dream story, played on the capture screen once the dream is
 * durably saved. Night falls over the draft and its sky lights star by star; the dream's
 * own words are read, then catch the light one by one and fly into a breathing glow while
 * motes of light are drawn in with them. The glow condenses into a single star, born with
 * a glint and a ring of light, which rises with a comet's tail to where the saved moment's
 * window will open as the sky sinks below it. Two touches mark the star's birth and its
 * arrival, after the save's own success haptic. The glow is a radial light with no edge, so
 * it reads as light on the night ground and as a warm haze on the paper ground. It holds
 * touch for its moment so nothing is pressed twice, and is decorative to assistive
 * technology: the next screen announces the save. The caller skips it under reduce motion.
 */
export function DreamCaptureSeal({ text }: { text: string }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const light = noctalia.accent.base;
  const ink = noctalia.text.primary;
  const lit = noctalia.accent.text;
  const star = noctalia.atmosphere.star;
  const rise = insets.top + MEDALLION_CENTER_FROM_TOP - height / 2;
  const words = useMemo(() => excerpt(text).split(' '), [text]);

  useEffect(() => {
    if (process.env.EXPO_OS === 'web') return;
    const haptic = (style: Haptics.ImpactFeedbackStyle) => {
      void Haptics.impactAsync(style).catch(() => {});
    };
    const timers = [
      setTimeout(() => haptic(Haptics.ImpactFeedbackStyle.Light), (DREAM_STORY.prologue * BEAT.starBorn) / 100),
      setTimeout(() => haptic(Haptics.ImpactFeedbackStyle.Soft), DREAM_STORY.prologue),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // Each word flies toward the glow from where it was laid out, so its path waits for layout.
  const [flights, setFlights] = useState<{ dx: number; dy: number }[] | null>(null);
  const layout = useRef<{ box?: LayoutRectangle; words: (LayoutRectangle | undefined)[] }>({ words: [] });
  const settleFlights = useCallback(() => {
    const { box, words: placed } = layout.current;
    if (flights || !box || placed.filter(Boolean).length < words.length) return;
    setFlights(placed.map((word) => ({
      dx: (box.width / 2 - (word!.x + word!.width / 2)) * WORD_PULL,
      dy: (box.height / 2 - (word!.y + word!.height / 2)) * WORD_PULL,
    })));
  }, [flights, words.length]);
  const onBoxLayout = useCallback((event: LayoutChangeEvent) => {
    layout.current.box = event.nativeEvent.layout;
    settleFlights();
  }, [settleFlights]);
  const onWordLayout = useCallback((index: number, event: LayoutChangeEvent) => {
    layout.current.words[index] = event.nativeEvent.layout;
    settleFlights();
  }, [settleFlights]);

  const motion = useMemo(() => {
    const base = {
      animationDuration: DREAM_STORY.prologue,
      animationTimingFunction: EASE.inOut,
      animationFillMode: 'both',
    } as const;
    const animate = <S extends object>(animationName: CSSAnimationKeyframes<S>, extra?: Partial<CSSStyle<S>>) =>
      ({ ...base, animationName, ...extra }) as CSSStyle<S>;
    const spark = animate<ViewStyle>({
      '0%': { opacity: 0, transform: [{ translateY: 0 }, { scale: 0.6 }] },
      [pct(BEAT.starBorn - 8)]: { opacity: 0, transform: [{ translateY: 0 }, { scale: 0.6 }] },
      [pct(BEAT.starBorn)]: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1.15 }] },
      [pct(BEAT.starSettled)]: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
      '100%': { opacity: 1, transform: [{ translateY: rise }, { scale: 1 }] },
    });
    return {
      veil: animate<ViewStyle>({
        '0%': { opacity: 0 }, [pct(BEAT.night)]: { opacity: 0.96 }, '100%': { opacity: 0.96 },
      }, { animationTimingFunction: EASE.out }),
      // The sky sinks as the star rises, so the eye travels up with it.
      sky: animate<ViewStyle>({
        '0%': { transform: [{ translateY: 0 }] },
        [pct(BEAT.starSettled)]: { transform: [{ translateY: 0 }] },
        '100%': { transform: [{ translateY: 22 }] },
      }),
      stars: SKY.map((point) => animate<ViewStyle>(skyStar(point.at, 'pulse' in point ? point.pulse : undefined))),
      glow: animate<ViewStyle>({
        '0%': { opacity: 0, transform: [{ scale: 1.3 }] },
        '24%': { opacity: 0.8, transform: [{ scale: 1 }] },
        '34%': { opacity: 0.65, transform: [{ scale: 1.06 }] },
        '44%': { opacity: 0.95, transform: [{ scale: 0.96 }] },
        [pct(BEAT.starBorn)]: { opacity: 0, transform: [{ scale: 0.12 }] },
        '100%': { opacity: 0, transform: [{ scale: 0.12 }] },
      }),
      motes: MOTES.map((mote) => animate<ViewStyle>(moteFlight(mote.x, mote.y, mote.from))),
      rings: [
        animate<ViewStyle>(ringWave(BEAT.starBorn - 4, 84, 1.1, 0.7)),
        animate<ViewStyle>(ringWave(BEAT.starBorn, 92, 1.6, 0.4)),
      ],
      spark,
      trail: TRAIL.map((echo) => ({ ...spark, animationDelay: echo.delay })),
      halo: animate<ViewStyle>({
        '0%': { opacity: 0.3, transform: [{ scale: 1 }] },
        '90%': { opacity: 0.3, transform: [{ scale: 1 }] },
        '100%': { opacity: 0.55, transform: [{ scale: 2.2 }] },
      }),
      glint: animate<ViewStyle>({
        '0%': { opacity: 0, transform: [{ rotate: '-45deg' }, { scale: 0 }] },
        [pct(BEAT.starBorn - 6)]: { opacity: 0, transform: [{ rotate: '-45deg' }, { scale: 0 }] },
        [pct(BEAT.starBorn)]: { opacity: 1, transform: [{ rotate: '0deg' }, { scale: 1.4 }] },
        [pct(BEAT.starSettled + 2)]: { opacity: 0.8, transform: [{ rotate: '20deg' }, { scale: 0.7 }] },
        '94%': { opacity: 0.8, transform: [{ rotate: '70deg' }, { scale: 0.7 }] },
        '100%': { opacity: 1, transform: [{ rotate: '90deg' }, { scale: 1.1 }] },
      }),
    };
  }, [rise]);

  const wordMotion = useMemo(() => flights?.map((flight, index) => ({
    animationName: wordFlight(index, flights.length, flight.dx, flight.dy, ink, lit),
    animationDuration: DREAM_STORY.prologue,
    animationTimingFunction: EASE.inOut,
    animationFillMode: 'both',
  }) as CSSStyle<TextStyle>), [flights, ink, lit]);

  return (
    <View
      testID={TID.Component.DreamCaptureSeal}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      className="absolute inset-0 items-center justify-center"
    >
      <Animated.View className="absolute inset-0 bg-ink" style={motion.veil as StyleProp<ViewStyle>} />
      <Animated.View className="absolute inset-0" style={motion.sky as StyleProp<ViewStyle>}>
        {SKY.map((point, index) => (
          <Animated.View key={index} className="absolute rounded-full" style={[{
            left: point.x * width - point.size / 2,
            top: point.y * height - point.size / 2,
            width: point.size,
            height: point.size,
            backgroundColor: star,
          }, motion.stars[index]] as StyleProp<ViewStyle>} />
        ))}
      </Animated.View>
      <Animated.View className="absolute" style={[{ width: GLOW, height: GLOW }, motion.glow] as StyleProp<ViewStyle>}>
        <Svg width={GLOW} height={GLOW}>
          <Defs>
            <RadialGradient id="seal-glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={light} stopOpacity={0.5} />
              <Stop offset="0.45" stopColor={light} stopOpacity={0.18} />
              <Stop offset="1" stopColor={light} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill="url(#seal-glow)" />
        </Svg>
      </Animated.View>
      <View className="absolute flex-row flex-wrap justify-center px-10" style={{ width }} onLayout={onBoxLayout}>
        {words.map((word, index) => (
          <Animated.Text
            key={index}
            onLayout={(event) => onWordLayout(index, event)}
            className="font-serif text-[18px] leading-7 text-ivory"
            style={[{ marginHorizontal: 2.5 }, wordMotion?.[index] ?? { opacity: 0 }] as StyleProp<TextStyle>}
          >
            {word}
          </Animated.Text>
        ))}
      </View>
      {MOTES.map((_, index) => (
        <Animated.View key={index} className="absolute h-1 w-1 rounded-full bg-champagne"
          style={motion.motes[index] as StyleProp<ViewStyle>} />
      ))}
      {motion.rings.map((ring, index) => (
        <Animated.View key={index} className="absolute rounded-full" style={[{
          width: RING, height: RING, borderWidth: 1.5, borderColor: light,
        }, ring] as StyleProp<ViewStyle>} />
      ))}
      {TRAIL.map((echo, index) => (
        <View key={index} className="absolute inset-0 items-center justify-center" style={{ opacity: echo.opacity }}>
          <Animated.View className="items-center justify-center"
            style={[{ width: SPARK, height: SPARK }, motion.trail[index]] as StyleProp<ViewStyle>}>
            <View className="rounded-full bg-champagne" style={{ width: echo.size, height: echo.size }} />
          </Animated.View>
        </View>
      ))}
      <Animated.View className="items-center justify-center"
        style={[{ width: SPARK, height: SPARK }, motion.spark] as StyleProp<ViewStyle>}>
        <Animated.View className="absolute rounded-full bg-champagne"
          style={[{ width: SPARK, height: SPARK }, motion.halo] as StyleProp<ViewStyle>} />
        <Animated.View className="absolute" style={[{ width: GLINT, height: GLINT }, motion.glint] as StyleProp<ViewStyle>}>
          <Svg width={GLINT} height={GLINT}>
            <Path d={sparklePath(GLINT / 2, GLINT / 2, GLINT / 2)} fill={light} />
          </Svg>
        </Animated.View>
        <View className="h-2.5 w-2.5 rounded-full bg-champagne" />
      </Animated.View>
    </View>
  );
}
