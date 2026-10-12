import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Text,
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
import { getNoctaliaPalette } from '@/constants/noctaliaPalette';
import { useTheme } from '@/context/ThemeContext';
import { TID } from '@/lib/testIDs';

import { DREAM_EASE, DREAM_STORY } from './dreamStoryMotion';
import { sparklePath } from './sparkle';

const BOOK_ART = require('@/assets/images/dream-seal-book.webp');
const PEN_ART = require('@/assets/images/dream-seal-pen.webp');

/** The notebook art's aspect, and its left page's writing area in fractions of the art. */
const BOOK_RATIO = 1536 / 1024;
const PAGE = { left: 190 / 1536, top: 280 / 1024, width: 520 / 1536 } as const;
/** The pen art's nib in fractions of the art, and the pen's size against the book. */
const NIB = { x: 0.148, y: 0.874 } as const;
const PEN_SCALE = 0.215;
const MAX_LINES = 3;
/** The page is paper in both themes, so its ink is the paper theme's text. */
const PAGE_INK = getNoctaliaPalette('light').title;

const GLOW = 280;
const SPARK = 28;
const GLINT = 44;
const RING = 200;
/** Where the saved moment's medallion opens on the next screen, below its navigation. */
const MEDALLION_CENTER_FROM_TOP = 76 + 120;
/** How far a word travels toward the glow before it is gone. */
const WORD_PULL = 0.9;

/**
 * The seal's beats, in percent of the prologue. Every keyframe below is placed against
 * these, so the story keeps its proportions whatever the prologue lasts.
 */
const BEAT = {
  night: 18,
  bookIn: 16,
  /** The pen glides in, writes the dream's first lines between these two beats, then glides away. */
  penIn: 3,
  write: 16,
  written: 46,
  lineGap: 4,
  penOut: 6,
  /** The ink leaves the page as words of light, which reach the glow in reading order. */
  lift: 49,
  gather: 52,
  gatherSpread: 8,
  wordFlight: 12,
  /** The journal fades as its ink lifts, so the words of light leave over the night. */
  bookOut: 49,
  bookGone: 66,
  starBorn: 74,
  starSettled: 79,
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
  { x: 0.2, y: 0.7, size: 2.5, at: 22 },
  { x: 0.84, y: 0.68, size: 3, at: 16 },
  { x: 0.5, y: 0.8, size: 2, at: 24, pulse: 56 },
  { x: 0.1, y: 0.86, size: 3, at: 19 },
  { x: 0.7, y: 0.9, size: 2, at: 26 },
  { x: 0.38, y: 0.93, size: 2.5, at: 28 },
  { x: 0.9, y: 0.82, size: 2, at: 21, pulse: 34 },
] as const;

/** Motes of light drawn in from around the book, each from its own point of an ellipse. */
const MOTES = [1, 0.7, 0.9, 0.6, 1, 0.75, 0.95, 0.65, 0.85, 0.8].map((reach, index) => {
  const angle = ((index * 36 + 12) * Math.PI) / 180;
  return { x: Math.cos(angle) * 160 * reach, y: Math.sin(angle) * 100 * reach, from: 50 + index * 1.1 };
});

/** The comet's tail: echoes of the star that follow it up, each later, smaller and fainter. */
const TRAIL = [
  { delay: 70, size: 8, opacity: 0.5 },
  { delay: 140, size: 6, opacity: 0.3 },
  { delay: 210, size: 4, opacity: 0.15 },
] as const;

type PlacedRow = { width: number; height: number; words: LayoutRectangle[] };

const pct = (value: number) => `${Math.round(value * 10) / 10}%`;

const near = (a: number, b: number) => Math.abs(a - b) < 0.5;
const samePlacement = (a: PlacedRow[], b: PlacedRow[]) => a.length === b.length && a.every((row, index) =>
  near(row.width, b[index].width) && row.words.every((word, at) =>
    near(word.x, b[index].words[at].x) && near(word.width, b[index].words[at].width)));

/** The dream's first words as the pen writes them: up to three lines, closed with an ellipsis when it goes on. */
const pageLines = (text: string, maxChars: number): string[][] => {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[][] = [[]];
  for (const word of words) {
    const line = lines[lines.length - 1];
    if (line.length && [...line, word].join(' ').length > maxChars) {
      if (lines.length === MAX_LINES) {
        line[line.length - 1] = `${line[line.length - 1]}…`;
        break;
      }
      lines.push([word]);
    } else {
      line.push(word);
    }
  }
  return lines.filter((line) => line.length);
};

/** When each line is written: the writing time is shared by the lines' lengths. */
const writingSchedule = (widths: number[]) => {
  const total = widths.reduce((sum, width) => sum + width, 0) || 1;
  const span = BEAT.written - BEAT.write - BEAT.lineGap * Math.max(widths.length - 1, 0);
  let from: number = BEAT.write;
  return widths.map((width) => {
    const line = { from, to: from + (span * width) / total };
    from = line.to + BEAT.lineGap;
    return line;
  });
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
    [pct(from + 13)]: gathered,
    '100%': gathered,
  };
};

/**
 * A written word leaving the page: it takes over from the ink, then flies into the glow in
 * one glide, catching the light on the way. Each property keeps its own keyframes, so the
 * colour change never stops the flight.
 */
const wordFlight = (
  index: number, count: number, dx: number, dy: number, lit: string
): CSSAnimationKeyframes<TextStyle> => {
  const from = BEAT.gather + (count > 1 ? (BEAT.gatherSpread * index) / (count - 1) : 0);
  const home = { transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] };
  const gone = { opacity: 0, color: lit, transform: [{ translateX: dx }, { translateY: dy }, { scale: 0.35 }] };
  return {
    '0%': { opacity: 0, color: PAGE_INK, ...home },
    [pct(BEAT.lift)]: { opacity: 0 },
    [pct(BEAT.lift + 2)]: { opacity: 1 },
    [pct(from)]: { color: PAGE_INK, ...home },
    [pct(from + 4)]: { color: lit },
    [pct(from + BEAT.wordFlight * 0.6)]: { opacity: 1 },
    [pct(from + BEAT.wordFlight)]: gone,
    '100%': gone,
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
 * durably saved. Night falls over the draft and its sky lights star by star as the dream
 * journal opens, and a fountain pen writes the dream's first words on its page. The ink
 * then leaves the page as words of light that fly, in reading order, into a breathing glow
 * with motes drawn in around them, while the journal fades into the night. The glow
 * condenses into a single star, born with a glint and a ring of light, which rises with a
 * comet's tail to where the saved moment's window will open as the sky sinks below it.
 * Two touches mark the star's birth and its arrival, after the save's own success haptic.
 * The page is paper in both themes, and so is its ink. It holds touch for its moment so
 * nothing is pressed twice, and is decorative to assistive technology: the next screen
 * announces the save. The caller skips it under reduce motion.
 */
export function DreamCaptureSeal({ text }: { text: string }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const light = noctalia.accent.base;
  const lit = noctalia.accent.text;
  const star = noctalia.atmosphere.star;
  const rise = insets.top + MEDALLION_CENTER_FROM_TOP - height / 2;

  const bookWidth = Math.min(width - 12, 460);
  const bookHeight = bookWidth / BOOK_RATIO;
  const fontSize = Math.round(bookWidth * 0.04);
  const lineHeight = Math.round(fontSize * 1.6);
  const pageLeft = PAGE.left * bookWidth;
  const pageTop = PAGE.top * bookHeight;
  const pen = bookWidth * PEN_SCALE;
  const lines = useMemo(
    () => pageLines(text, Math.floor((PAGE.width * bookWidth) / (fontSize * 0.5))),
    [text, bookWidth, fontSize]
  );

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

  // The pen's path and each word's flight follow the written lines, so they wait for layout.
  // A later layout that moves them (web applies a word's margin after its first layout)
  // replaces the first one; it lands before the pen starts.
  const [placed, setPlaced] = useState<PlacedRow[] | null>(null);
  const layout = useRef<{ rows: (LayoutRectangle | undefined)[]; words: (LayoutRectangle | undefined)[][] }>({
    rows: [], words: [],
  });
  const settle = useCallback(() => {
    const { rows, words } = layout.current;
    const complete = lines.every((line, row) => rows[row] && line.every((_, index) => words[row]?.[index]));
    if (!lines.length || !complete) return;
    const next = lines.map((line, row) => ({
      width: rows[row]!.width,
      height: rows[row]!.height,
      words: line.map((_, index) => words[row]![index]!),
    }));
    setPlaced((current) => (current && samePlacement(current, next) ? current : next));
  }, [lines]);
  const onRowLayout = useCallback((row: number, event: LayoutChangeEvent) => {
    layout.current.rows[row] = event.nativeEvent.layout;
    settle();
  }, [settle]);
  const onWordLayout = useCallback((row: number, index: number, event: LayoutChangeEvent) => {
    (layout.current.words[row] ??= [])[index] = event.nativeEvent.layout;
    settle();
  }, [settle]);

  const motion = useMemo(() => {
    const base = {
      animationDuration: DREAM_STORY.prologue,
      animationTimingFunction: DREAM_EASE,
      animationFillMode: 'both',
    } as const;
    const animate = <S extends object>(animationName: CSSAnimationKeyframes<S>, extra?: Partial<CSSStyle<S>>) =>
      ({ ...base, animationName, ...extra }) as CSSStyle<S>;
    const spark = animate<ViewStyle>({
      '0%': { opacity: 0, transform: [{ translateY: 0 }, { scale: 0.6 }] },
      [pct(BEAT.starBorn - 8)]: { opacity: 0, transform: [{ translateY: 0 }, { scale: 0.6 }] },
      [pct(BEAT.starBorn)]: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1.06 }] },
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
      book: animate<ViewStyle>({
        '0%': { opacity: 0, transform: [{ translateY: 8 }, { scale: 0.985 }] },
        '3%': { opacity: 0, transform: [{ translateY: 8 }, { scale: 0.985 }] },
        [pct(BEAT.bookIn)]: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
        [pct(BEAT.bookOut)]: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
        [pct(BEAT.bookGone)]: { opacity: 0, transform: [{ translateY: 10 }, { scale: 0.96 }] },
        '100%': { opacity: 0, transform: [{ translateY: 10 }, { scale: 0.96 }] },
      }),
      // The written ink hands over to the words of light, which take its exact place.
      ink: animate<ViewStyle>({
        '0%': { opacity: 1 },
        [pct(BEAT.lift)]: { opacity: 1 },
        [pct(BEAT.lift + 2)]: { opacity: 0 },
        '100%': { opacity: 0 },
      }, { animationTimingFunction: 'linear' }),
      glow: animate<ViewStyle>({
        '0%': { opacity: 0, transform: [{ scale: 1.2 }] },
        '40%': { opacity: 0, transform: [{ scale: 1.2 }] },
        '54%': { opacity: 0.85, transform: [{ scale: 1 }] },
        '60%': { opacity: 0.72, transform: [{ scale: 1.04 }] },
        '66%': { opacity: 0.9, transform: [{ scale: 0.97 }] },
        [pct(BEAT.starBorn)]: { opacity: 0, transform: [{ scale: 0.12 }] },
        '100%': { opacity: 0, transform: [{ scale: 0.12 }] },
      }),
      motes: MOTES.map((mote) => animate<ViewStyle>(moteFlight(mote.x, mote.y, mote.from))),
      rings: [
        animate<ViewStyle>(ringWave(BEAT.starBorn - 2, 90, 1.1, 0.5)),
        animate<ViewStyle>(ringWave(BEAT.starBorn + 1, 96, 1.5, 0.3)),
      ],
      spark,
      trail: TRAIL.map((echo) => ({ ...spark, animationDelay: echo.delay })),
      halo: animate<ViewStyle>({
        '0%': { opacity: 0.3, transform: [{ scale: 1 }] },
        '90%': { opacity: 0.3, transform: [{ scale: 1 }] },
        '100%': { opacity: 0.45, transform: [{ scale: 1.6 }] },
      }),
      glint: animate<ViewStyle>({
        '0%': { opacity: 0, transform: [{ rotate: '-30deg' }, { scale: 0 }] },
        [pct(BEAT.starBorn - 7)]: { opacity: 0, transform: [{ rotate: '-30deg' }, { scale: 0 }] },
        [pct(BEAT.starBorn)]: { opacity: 1, transform: [{ rotate: '0deg' }, { scale: 1.1 }] },
        [pct(BEAT.starSettled + 2)]: { opacity: 0.8, transform: [{ rotate: '15deg' }, { scale: 0.75 }] },
        '94%': { opacity: 0.8, transform: [{ rotate: '60deg' }, { scale: 0.75 }] },
        '100%': { opacity: 0.9, transform: [{ rotate: '90deg' }, { scale: 0.95 }] },
      }),
    };
  }, [rise]);

  // Once the lines are laid out, the ink is revealed under the nib, the pen follows it,
  // and each word knows its way to the glow at the book's centre.
  const writing = useMemo(() => {
    if (!placed) return null;
    const schedule = writingSchedule(placed.map((row) => row.width));
    const linear = { animationDuration: DREAM_STORY.prologue, animationTimingFunction: 'linear', animationFillMode: 'both' } as const;
    // Writing runs at a steady pace; arriving, changing line and leaving glide on the story's curve.
    const penAt = (
      opacity: number, x: number, row: number, wobble = 0, away = 0, glide = false
    ): CSSAnimationKeyframes<ViewStyle>[string] => {
      const frame: CSSAnimationKeyframes<ViewStyle>[string] = {
        opacity,
        transform: [
          { translateX: x - NIB.x * pen + away },
          { translateY: pageTop + row * lineHeight + lineHeight * 0.74 - NIB.y * pen + wobble - away },
        ],
      };
      // React Native's ViewStyle declares a string `animationTimingFunction`, which narrows the
      // keyframe block's type; Reanimated reads the curve object at run time.
      return glide ? ({ ...frame, animationTimingFunction: DREAM_EASE } as unknown as typeof frame) : frame;
    };
    const last = schedule.length - 1;
    const lineEnd = (row: number) => pageLeft + placed[row].width;
    const penFrames: CSSAnimationKeyframes<ViewStyle> = {
      '0%': penAt(0, pageLeft, 0, 0, 16),
      [pct(BEAT.write - BEAT.penIn)]: penAt(0, pageLeft, 0, 0, 16, true),
    };
    schedule.forEach((line, row) => {
      const strokes = Math.max(4, Math.round((line.to - line.from) / 1.6));
      penFrames[pct(line.from)] = penAt(1, pageLeft, row);
      for (let stroke = 1; stroke < strokes; stroke += 1) {
        // A writing hand never runs on a rail: the nib rises and dips along the line.
        const wobble = (stroke % 2 ? -1 : 1) * fontSize * 0.06;
        penFrames[pct(line.from + ((line.to - line.from) * stroke) / strokes)] =
          penAt(1, pageLeft + (placed[row].width * stroke) / strokes, row, wobble);
      }
      penFrames[pct(line.to)] = penAt(1, lineEnd(row), row, 0, 0, true);
    });
    penFrames[pct(schedule[last].to + BEAT.penOut)] = penAt(0, lineEnd(last), last, 0, 20);
    penFrames['100%'] = penAt(0, lineEnd(last), last, 0, 20);

    const count = placed.reduce((sum, row) => sum + row.words.length, 0);
    let order = 0;
    return {
      pen: { ...linear, animationName: penFrames } as CSSStyle<ViewStyle>,
      masks: placed.map((row, rowIndex) => ({
        ...linear,
        animationName: {
          '0%': { width: 0 },
          [pct(schedule[rowIndex].from)]: { width: 0 },
          [pct(schedule[rowIndex].to)]: { width: row.width },
          '100%': { width: row.width },
        },
      }) as CSSStyle<ViewStyle>),
      words: placed.map((row, rowIndex) => row.words.map((word) => {
        const dx = (bookWidth / 2 - (pageLeft + word.x + word.width / 2)) * WORD_PULL;
        const dy = (bookHeight / 2 - (pageTop + rowIndex * lineHeight + word.y + word.height / 2)) * WORD_PULL;
        const style = {
          ...linear,
          animationTimingFunction: DREAM_EASE,
          animationName: wordFlight(order, count, dx, dy, lit),
        } as CSSStyle<TextStyle>;
        order += 1;
        return style;
      })),
    };
  }, [placed, pen, pageLeft, pageTop, lineHeight, fontSize, bookWidth, bookHeight, lit]);

  const wordStyle = { fontSize, lineHeight, marginRight: fontSize * 0.28 };
  const rowFrame = (row: number) => ({ position: 'absolute' as const, left: pageLeft, top: pageTop + row * lineHeight });

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

      {/* The journal and its pen. The written ink fades with the page; its words leave it. */}
      <View className="absolute" style={{ width: bookWidth, height: bookHeight }}>
        <Animated.View className="absolute inset-0" style={motion.book as StyleProp<ViewStyle>}>
          <Image source={BOOK_ART} resizeMode="contain" style={{ width: bookWidth, height: bookHeight }} />
          <Animated.View className="absolute inset-0" style={motion.ink as StyleProp<ViewStyle>}>
            {writing && placed ? placed.map((row, rowIndex) => (
              <Animated.View key={rowIndex} className="overflow-hidden"
                style={[rowFrame(rowIndex), { height: row.height }, writing.masks[rowIndex]] as StyleProp<ViewStyle>}>
                <View className="flex-row" style={{ width: row.width }}>
                  {lines[rowIndex].map((word, index) => (
                    <Text key={index} className="font-serif-italic" style={[wordStyle, { color: PAGE_INK }]}>{word}</Text>
                  ))}
                </View>
              </Animated.View>
            )) : null}
          </Animated.View>
        </Animated.View>
        {writing ? (
          <Animated.View className="absolute left-0 top-0"
            style={[{ width: pen, height: pen }, writing.pen] as StyleProp<ViewStyle>}>
            <Image source={PEN_ART} resizeMode="contain" style={{ width: pen, height: pen }} />
          </Animated.View>
        ) : null}
      </View>

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

      {/* The same lines again: laid out first to place the pen, then flown into the glow. */}
      <View className="absolute" pointerEvents="none" style={{ width: bookWidth, height: bookHeight }}>
        {lines.map((line, rowIndex) => (
          <View key={rowIndex} className="flex-row" style={rowFrame(rowIndex)}
            onLayout={(event) => onRowLayout(rowIndex, event)}>
            {line.map((word, index) => (
              <Animated.Text
                key={index}
                onLayout={(event) => onWordLayout(rowIndex, index, event)}
                className="font-serif-italic"
                style={[wordStyle, writing?.words[rowIndex][index] ?? { opacity: 0 }] as StyleProp<TextStyle>}
              >
                {word}
              </Animated.Text>
            ))}
          </View>
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
