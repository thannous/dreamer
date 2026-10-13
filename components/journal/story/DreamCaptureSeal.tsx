import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { type CSSAnimationKeyframes, type CSSStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';

import { JournalPaper } from '@/components/journal/JournalPaper';
import { EASE } from '@/components/motion/motion';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { getNoctaliaPalette } from '@/constants/noctaliaPalette';
import { useTheme } from '@/context/ThemeContext';
import { TID } from '@/lib/testIDs';

import { DREAM_EASE, DREAM_STORY } from './dreamStoryMotion';
import { sparklePath } from './sparkle';

const IVORY_JOURNAL = require('@/assets/images/dream-seal-book.webp');
const NIGHT_JOURNAL = require('@/assets/images/dream-seal-book-night.webp');
const PEN_ART = require('@/assets/images/dream-seal-pen.webp');
const ASTRAL_ART = require('@/assets/images/onboarding-astral-background.webp');

/** The journal art's aspect, and its right page in fractions of the art (both journals share it). */
const JOURNAL_RATIO = 1536 / 1024;
const RIGHT_PAGE = { left: 785 / 1536, top: 105 / 1024, right: 1380 / 1536, bottom: 850 / 1024 } as const;
/** The pen art's nib in fractions of the art, and the pen's size against the journal. */
const NIB = { x: 0.148, y: 0.874 } as const;
const PEN_SCALE = 0.215;
const MAX_LINES = 3;
/** The saved moment's medallion, and where it opens on the next screen, below its navigation. */
const MEDALLION = 148;
const MEDALLION_CENTER_FROM_TOP = 76 + 120;
/** The pen draws the medallion's ring in this many strokes. */
const RING_STROKES = 24;
/** The lamp is warm light in both themes. */
const LAMP = getNoctaliaPalette('dark').accent;

/**
 * The seal's beats, in percent of the prologue. Every keyframe below is placed against
 * these, so the story keeps its proportions whatever the prologue lasts.
 */
const BEAT = {
  night: 13,
  journalIn: 9,
  /** The view glides from the whole journal to its right page, the ring's place already centred. */
  framed: 18,
  /** The lamp lights the page while the pen works. */
  lampOn: 18,
  lampOff: 58,
  /** The pen glides in, writes the dream's first lines, then draws the ring above them. */
  penIn: 4,
  write: 18,
  written: 39.5,
  lineGap: 2.75,
  ringFrom: 41.5,
  ringClosed: 47,
  penGone: 51.5,
  /** A breath once the pen has gone, then the reader dives into the page around the ring. */
  diveFrom: 52.5,
  diveTo: 82,
  /** The words stay legible well into the dive; the page's own grain takes over as the art's fades. */
  inkGone: [58, 70],
  pageCover: [62, 76],
  grainIn: [66, 80],
  ringSettles: [76, 82],
  /** The night fills the ring, which becomes the saved moment's window. */
  skyIn: [82, 94],
} as const;

/** The night sky behind the journal, in fractions of the screen. Fixed so every save shows the same sky. */
const SKY = [
  { x: 0.14, y: 0.12, size: 3, at: 6, pulse: 30 },
  { x: 0.78, y: 0.08, size: 2, at: 9 },
  { x: 0.9, y: 0.22, size: 2.5, at: 12, pulse: 40 },
  { x: 0.32, y: 0.2, size: 2, at: 15 },
  { x: 0.62, y: 0.15, size: 3, at: 8 },
  { x: 0.06, y: 0.36, size: 2, at: 18 },
  { x: 0.94, y: 0.4, size: 2, at: 11, pulse: 34 },
  { x: 0.2, y: 0.74, size: 2.5, at: 20 },
  { x: 0.84, y: 0.7, size: 3, at: 14 },
  { x: 0.5, y: 0.82, size: 2, at: 22, pulse: 46 },
  { x: 0.1, y: 0.88, size: 3, at: 17 },
  { x: 0.7, y: 0.9, size: 2, at: 24 },
  { x: 0.38, y: 0.94, size: 2.5, at: 26 },
  { x: 0.9, y: 0.84, size: 2, at: 19, pulse: 28 },
] as const;

const pct = (value: number) => `${Math.round(value * 10) / 10}%`;
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const fade = (from: number, to: number, start = 0, end = 1): CSSAnimationKeyframes<ViewStyle> => ({
  '0%': { opacity: start }, [pct(from)]: { opacity: start }, [pct(to)]: { opacity: end }, '100%': { opacity: end },
});

/** The dream's first words as the pen writes them: up to three lines, closed with an ellipsis when it goes on. */
const pageLines = (text: string, maxChars: number): string[] => {
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
  return lines.filter((line) => line.length).map((line) => line.join(' '));
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

/** An arc of the ring, from `start` to `end` degrees clockwise from the top, around (r, r). */
const arcPath = (r: number, start: number, end: number) => {
  const point = (degrees: number) => {
    const radians = ((degrees - 90) * Math.PI) / 180;
    return `${r + (r - 1) * Math.cos(radians)} ${r + (r - 1) * Math.sin(radians)}`;
  };
  return `M${point(start)} A${r - 1} ${r - 1} 0 0 1 ${point(end)}`;
};

/**
 * The prologue of the dream story, played on the capture screen once the dream is
 * durably saved. Night falls over the draft and its sky lights as the dream journal opens
 * under a lamp, and the view glides to its right page so that the ring's place is already
 * where the saved moment's window will open. A fountain pen writes the dream's first words,
 * then draws the ring above them and lifts away. The reader then dives into the page around
 * the ring, which never moves: the page grows until it fills the screen and its paper
 * becomes the dream page's own, and the night sky fills the ring. The next
 * page fades in around that window. In the night theme the journal's paper is night
 * paper written in gold; in the paper theme it is ivory written in ink. Two touches mark
 * the ring closing and the sky filling it, after the save's own success haptic. It holds
 * touch for its moment so nothing is pressed twice, and is decorative to assistive
 * technology: the next screen announces the save. The caller skips it under reduce motion.
 */
export function DreamCaptureSeal({ text }: { text: string }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const night = mode === 'dark';
  const ink = night ? noctalia.accent.text : noctalia.text.primary;
  const ringInk = noctalia.accent.text;
  const star = noctalia.atmosphere.star;

  // The journal, centred; its right page; and the dive that turns that page into the screen.
  const journalWidth = Math.min(width - 12, 460);
  const journalHeight = journalWidth / JOURNAL_RATIO;
  const page = {
    x: RIGHT_PAGE.left * journalWidth,
    y: RIGHT_PAGE.top * journalHeight,
    w: (RIGHT_PAGE.right - RIGHT_PAGE.left) * journalWidth,
    h: (RIGHT_PAGE.bottom - RIGHT_PAGE.top) * journalHeight,
  };
  const medallionY = insets.top + MEDALLION_CENTER_FROM_TOP;
  const zoom = Math.max(width / page.w, height / page.h) * 1.02;
  // Where the ring sits on the page so that, once the page covers the screen, it is the medallion.
  const ring = {
    x: page.x + page.w / 2,
    y: page.y + (page.h + (2 * medallionY - height) / zoom) / 2,
    r: MEDALLION / 2 / zoom,
  };
  const fontSize = Math.round(journalWidth * 0.034);
  const lineHeight = Math.round(fontSize * 1.6);
  const lineLeft = page.x + page.w * 0.1;
  const linesTop = ring.y + ring.r + lineHeight * 0.6;
  const pen = journalWidth * PEN_SCALE;
  const lines = useMemo(
    () => pageLines(text, Math.floor((page.w * 0.8) / (fontSize * 0.5))),
    [text, page.w, fontSize]
  );

  useEffect(() => {
    if (process.env.EXPO_OS === 'web') return;
    const haptic = (style: Haptics.ImpactFeedbackStyle) => {
      void Haptics.impactAsync(style).catch(() => {});
    };
    const at = (beat: number) => (DREAM_STORY.prologue * beat) / 100;
    const timers = [
      setTimeout(() => haptic(Haptics.ImpactFeedbackStyle.Light), at(BEAT.ringClosed)),
      setTimeout(() => haptic(Haptics.ImpactFeedbackStyle.Soft), at((BEAT.skyIn[0] + BEAT.skyIn[1]) / 2)),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // The ink is revealed under the nib, so each line's width waits for layout. A later layout
  // that changes it (web can lay text out twice) replaces the first; it lands before the pen.
  const [widths, setWidths] = useState<number[] | null>(null);
  const measured = useRef<(number | undefined)[]>([]);
  const onLineLayout = useCallback((index: number, event: LayoutChangeEvent) => {
    measured.current[index] = event.nativeEvent.layout.width;
    if (measured.current.filter((value) => value !== undefined).length < lines.length) return;
    const next = lines.map((_, line) => measured.current[line]!);
    setWidths((current) => (current && current.every((value, line) => Math.abs(value - next[line]) < 0.5) ? current : next));
  }, [lines]);

  const motion = useMemo(() => {
    const base = {
      animationDuration: DREAM_STORY.prologue,
      animationTimingFunction: DREAM_EASE,
      animationFillMode: 'both',
    } as const;
    const animate = <S extends object>(animationName: CSSAnimationKeyframes<S>, extra?: Partial<CSSStyle<S>>) =>
      ({ ...base, animationName, ...extra }) as CSSStyle<S>;

    // The framing: once the journal has settled, the view glides until the ring's place on the
    // page is where the medallion will open, so the ring is drawn there and never travels.
    const centre = { x: journalWidth / 2, y: journalHeight / 2 };
    const framed = { translateX: centre.x - ring.x, translateY: medallionY - height / 2 - (ring.y - centre.y) };
    const frame: CSSAnimationKeyframes<ViewStyle> = {
      '0%': { transform: [{ translateX: 0 }, { translateY: 0 }] },
      [pct(BEAT.journalIn)]: { transform: [{ translateX: 0 }, { translateY: 0 }] },
      [pct(BEAT.framed)]: { transform: [{ translateX: framed.translateX }, { translateY: framed.translateY }] },
      '100%': { transform: [{ translateX: framed.translateX }, { translateY: framed.translateY }] },
    };
    // The dive: the page grows around the ring, which stays put, the scale growing
    // geometrically so it reads as a steady approach rather than a rush at the end.
    const dive: CSSAnimationKeyframes<ViewStyle> = {
      '0%': { opacity: 0, transform: [{ translateX: 0 }, { translateY: 8 }, { scale: 0.985 }] },
      '2%': { opacity: 0, transform: [{ translateX: 0 }, { translateY: 8 }, { scale: 0.985 }] },
      [pct(BEAT.journalIn)]: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] },
    };
    const steps = 10;
    for (let step = 0; step <= steps; step += 1) {
      const scale = zoom ** smoothstep(step / steps);
      // Each step is already eased, so the steps join linearly.
      dive[pct(BEAT.diveFrom + ((BEAT.diveTo - BEAT.diveFrom) * step) / steps)] = {
        opacity: 1,
        transform: [
          { translateX: -(scale - 1) * (ring.x - centre.x) },
          { translateY: -(scale - 1) * (ring.y - centre.y) },
          { scale },
        ],
        animationTimingFunction: 'linear',
      };
    }
    dive['100%'] = dive[pct(BEAT.diveTo)];

    const lamp: CSSAnimationKeyframes<ViewStyle> = {
      '0%': { opacity: 0 },
      [pct(BEAT.journalIn + 4)]: { opacity: 0 },
      [pct(BEAT.lampOn)]: { opacity: 0.55 },
      '25%': { opacity: 0.47 },
      '31%': { opacity: 0.58 },
      '36%': { opacity: 0.5 },
      '43%': { opacity: 0.56 },
      '50%': { opacity: 0.5 },
      [pct(BEAT.lampOff)]: { opacity: 0 },
      '100%': { opacity: 0 },
    };

    return {
      veil: animate<ViewStyle>({
        '0%': { opacity: 0 }, [pct(BEAT.night)]: { opacity: 0.96 }, '100%': { opacity: 0.96 },
      }, { animationTimingFunction: EASE.out }),
      // The stars part as the reader dives towards the page.
      sky: animate<ViewStyle>({
        '0%': { opacity: 1, transform: [{ scale: 1 }] },
        [pct(BEAT.diveFrom)]: { opacity: 1, transform: [{ scale: 1 }] },
        [pct(BEAT.diveTo)]: { opacity: 0, transform: [{ scale: 1.35 }] },
        '100%': { opacity: 0, transform: [{ scale: 1.35 }] },
      }),
      stars: SKY.map((point) => animate<ViewStyle>(skyStar(point.at, 'pulse' in point ? point.pulse : undefined))),
      frame: animate<ViewStyle>(frame),
      dive: animate<ViewStyle>(dive),
      lamp: animate<ViewStyle>(lamp),
      ink: animate<ViewStyle>(fade(BEAT.inkGone[0], BEAT.inkGone[1], 1, 0)),
      pageCover: animate<ViewStyle>(fade(BEAT.pageCover[0], BEAT.pageCover[1])),
      grain: animate<ViewStyle>(fade(BEAT.grainIn[0], BEAT.grainIn[1])),
      drawnRing: animate<ViewStyle>(fade(BEAT.ringSettles[0], BEAT.ringSettles[1], 1, 0)),
      ring: animate<ViewStyle>(fade(BEAT.ringSettles[0], BEAT.ringSettles[1])),
      ringStrokes: Array.from({ length: RING_STROKES }, (_, stroke) => {
        const drawn = BEAT.ringFrom + ((BEAT.ringClosed - BEAT.ringFrom) * (stroke + 1)) / RING_STROKES;
        return animate<ViewStyle>(fade(drawn - 0.3, drawn), { animationTimingFunction: 'linear' });
      }),
      glint: animate<ViewStyle>({
        '0%': { opacity: 0, transform: [{ rotate: '-30deg' }, { scale: 0 }] },
        [pct(BEAT.ringClosed - 1.5)]: { opacity: 0, transform: [{ rotate: '-30deg' }, { scale: 0 }] },
        [pct(BEAT.ringClosed)]: { opacity: 1, transform: [{ rotate: '0deg' }, { scale: 1 }] },
        [pct(BEAT.penGone + 2)]: { opacity: 0, transform: [{ rotate: '45deg' }, { scale: 0.6 }] },
        '100%': { opacity: 0, transform: [{ rotate: '45deg' }, { scale: 0.6 }] },
      }),
      skyFill: animate<ViewStyle>({
        '0%': { opacity: 0, transform: [{ scale: 1.08 }] },
        [pct(BEAT.skyIn[0])]: { opacity: 0, transform: [{ scale: 1.08 }] },
        [pct(BEAT.skyIn[1])]: { opacity: 1, transform: [{ scale: 1 }] },
        '100%': { opacity: 1, transform: [{ scale: 1 }] },
      }),
      halo: animate<ViewStyle>({
        '0%': { opacity: 0, transform: [{ scale: 0.8 }] },
        [pct(BEAT.skyIn[0])]: { opacity: 0, transform: [{ scale: 0.8 }] },
        [pct((BEAT.skyIn[0] + BEAT.skyIn[1]) / 2)]: { opacity: 0.9, transform: [{ scale: 1.05 }] },
        '100%': { opacity: 0.45, transform: [{ scale: 1 }] },
      }),
    };
  }, [height, journalHeight, journalWidth, medallionY, ring.x, ring.y, zoom]);

  // The pen glides in, writes each line at a steady pace, glides up to draw the ring, then away.
  const penMotion = useMemo(() => {
    if (!widths) return null;
    const schedule = writingSchedule(widths);
    const nibAt = (opacity: number, x: number, y: number, away = 0, glide = false) => {
      const frame: CSSAnimationKeyframes<ViewStyle>[string] = {
        opacity,
        transform: [{ translateX: x - NIB.x * pen + away }, { translateY: y - NIB.y * pen - away }],
      };
      // React Native's ViewStyle declares a string `animationTimingFunction`, which narrows the
      // keyframe block's type; Reanimated reads the curve object at run time.
      return glide ? ({ ...frame, animationTimingFunction: DREAM_EASE } as unknown as typeof frame) : frame;
    };
    const baseline = (row: number) => linesTop + row * lineHeight + lineHeight * 0.74;
    const frames: CSSAnimationKeyframes<ViewStyle> = {
      '0%': nibAt(0, lineLeft, baseline(0), 30),
      [pct(BEAT.write - BEAT.penIn)]: nibAt(0, lineLeft, baseline(0), 30, true),
    };
    schedule.forEach((line, row) => {
      const strokes = Math.max(4, Math.round((line.to - line.from) / 1.6));
      frames[pct(line.from)] = nibAt(1, lineLeft, baseline(row));
      for (let stroke = 1; stroke < strokes; stroke += 1) {
        // A writing hand never runs on a rail: the nib rises and dips along the line.
        const wobble = (stroke % 2 ? -1 : 1) * fontSize * 0.06;
        frames[pct(line.from + ((line.to - line.from) * stroke) / strokes)] =
          nibAt(1, lineLeft + (widths[row] * stroke) / strokes, baseline(row) + wobble);
      }
      frames[pct(line.to)] = nibAt(1, lineLeft + widths[row], baseline(row), 0, true);
    });
    // Up to the top of the ring, around it once, then away.
    for (let stroke = 0; stroke <= RING_STROKES; stroke += 1) {
      const radians = ((stroke / RING_STROKES) * 360 - 90) * (Math.PI / 180);
      frames[pct(BEAT.ringFrom + ((BEAT.ringClosed - BEAT.ringFrom) * stroke) / RING_STROKES)] = nibAt(
        1, ring.x + ring.r * Math.cos(radians), ring.y + ring.r * Math.sin(radians), 0, stroke === RING_STROKES
      );
    }
    frames[pct(BEAT.penGone)] = nibAt(0, ring.x, ring.y - ring.r, 30);
    frames['100%'] = nibAt(0, ring.x, ring.y - ring.r, 30);
    return {
      pen: {
        animationName: frames,
        animationDuration: DREAM_STORY.prologue,
        animationTimingFunction: 'linear',
        animationFillMode: 'both',
      } as CSSStyle<ViewStyle>,
      masks: schedule.map((line, row) => ({
        animationName: {
          '0%': { width: 0 },
          [pct(line.from)]: { width: 0 },
          [pct(line.to)]: { width: widths[row] },
          '100%': { width: widths[row] },
        },
        animationDuration: DREAM_STORY.prologue,
        animationTimingFunction: 'linear',
        animationFillMode: 'both',
      }) as CSSStyle<ViewStyle>),
    };
  }, [widths, pen, linesTop, lineHeight, lineLeft, fontSize, ring.x, ring.y, ring.r]);

  const lineStyle = { fontSize, lineHeight, color: ink };
  const ringBox = ring.r * 2;

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

      {/* Lines laid out unseen, to reveal the ink under the nib at each line's own width. */}
      <View className="absolute opacity-0" style={{ width: journalWidth, height: journalHeight }}>
        {lines.map((line, index) => (
          <Text key={index} numberOfLines={1} onLayout={(event) => onLineLayout(index, event)}
            className="absolute left-0 top-0 font-serif-italic" style={lineStyle}>{line}</Text>
        ))}
      </View>

      <Animated.View className="absolute" style={[{ width: journalWidth, height: journalHeight }, motion.frame] as StyleProp<ViewStyle>}>
        <Animated.View className="absolute inset-0" style={motion.dive as StyleProp<ViewStyle>}>
          <Image source={night ? NIGHT_JOURNAL : IVORY_JOURNAL} resizeMode="contain"
            style={{ width: journalWidth, height: journalHeight }} />
          <Animated.View className="absolute" style={[{
            left: page.x - page.w * 0.4, top: page.y - page.h * 0.25, width: page.w * 1.8, height: page.h * 1.5,
          }, motion.lamp] as StyleProp<ViewStyle>}>
            <Svg width="100%" height="100%">
              <Defs>
                <RadialGradient id="seal-lamp" cx="50%" cy="45%" r="50%">
                  <Stop offset="0" stopColor={LAMP} stopOpacity={0.42} />
                  <Stop offset="0.5" stopColor={LAMP} stopOpacity={0.12} />
                  <Stop offset="1" stopColor={LAMP} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill="url(#seal-lamp)" />
            </Svg>
          </Animated.View>
          {/* The page itself, which takes over from the art as it fills the screen. */}
          <Animated.View className="absolute bg-ink" style={[{ left: page.x, top: page.y, width: page.w, height: page.h },
            motion.pageCover] as StyleProp<ViewStyle>} />
          <Animated.View className="absolute inset-0" style={motion.ink as StyleProp<ViewStyle>}>
            {penMotion && widths ? lines.map((line, row) => (
              <Animated.View key={row} className="absolute overflow-hidden"
                style={[{ left: lineLeft, top: linesTop + row * lineHeight, height: lineHeight }, penMotion.masks[row]] as StyleProp<ViewStyle>}>
                {/* Wider than the line, so the mask alone decides what is written. */}
                <Text className="font-serif-italic" style={[lineStyle, { width: widths[row] + fontSize }]}>{line}</Text>
              </Animated.View>
            )) : null}
          </Animated.View>
          <Animated.View className="absolute" style={[{ left: ring.x - ring.r, top: ring.y - ring.r, width: ringBox, height: ringBox },
            motion.drawnRing] as StyleProp<ViewStyle>}>
            {motion.ringStrokes.map((stroke, index) => (
              <Animated.View key={index} className="absolute inset-0" style={stroke as StyleProp<ViewStyle>}>
                <Svg width={ringBox} height={ringBox}>
                  <Path d={arcPath(ring.r, (index * 360) / RING_STROKES, ((index + 1) * 360) / RING_STROKES + 1)}
                    stroke={ringInk} strokeWidth={0.7} strokeOpacity={0.9} strokeLinecap="round" fill="none" />
                </Svg>
              </Animated.View>
            ))}
          </Animated.View>
        </Animated.View>

        {penMotion ? (
          <Animated.View className="absolute left-0 top-0" style={[{ width: pen, height: pen }, penMotion.pen] as StyleProp<ViewStyle>}>
            {/* The pen's soft shadow on the paper, then the pen. */}
            <Image source={PEN_ART} resizeMode="contain" tintColor="#000000"
              style={{ position: 'absolute', left: 5, top: 7, width: pen, height: pen, opacity: 0.22 }} />
            <Image source={PEN_ART} resizeMode="contain" style={{ width: pen, height: pen }} />
          </Animated.View>
        ) : null}
        <Animated.View className="absolute items-center justify-center" style={[{
          left: ring.x - 9, top: ring.y - ring.r - 9, width: 18, height: 18,
        }, motion.glint] as StyleProp<ViewStyle>}>
          <Svg width={18} height={18}><Path d={sparklePath(9, 9, 9)} fill={ringInk} /></Svg>
        </Animated.View>
      </Animated.View>

      {/* The dream page's own grain, then its window: the ring settles crisp and fills with night. */}
      <Animated.View className="absolute inset-0" style={motion.grain as StyleProp<ViewStyle>}>
        <JournalPaper />
      </Animated.View>
      <Animated.View className="absolute" style={[{
        left: width / 2 - 170, top: medallionY - 140, width: 340, height: 280,
      }, motion.halo] as StyleProp<ViewStyle>}>
        <Svg width={340} height={280}>
          <Defs>
            <RadialGradient id="seal-halo" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={noctalia.atmosphere.glow} stopOpacity={night ? 0.24 : 0.16} />
              <Stop offset="0.55" stopColor={noctalia.atmosphere.glow} stopOpacity={night ? 0.07 : 0.05} />
              <Stop offset="1" stopColor={noctalia.atmosphere.glow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={170} cy={140} rx={170} ry={140} fill="url(#seal-halo)" />
        </Svg>
      </Animated.View>
      <Animated.View className="absolute overflow-hidden rounded-full bg-ink" style={[{
        left: width / 2 - MEDALLION / 2, top: medallionY - MEDALLION / 2, width: MEDALLION, height: MEDALLION,
      }, motion.skyFill] as StyleProp<ViewStyle>}>
        <Image source={ASTRAL_ART} resizeMode="cover" style={{ width: MEDALLION, height: MEDALLION }} />
      </Animated.View>
      <Animated.View className="absolute" style={[{
        left: width / 2 - MEDALLION / 2, top: medallionY - MEDALLION / 2, width: MEDALLION, height: MEDALLION,
      }, motion.ring] as StyleProp<ViewStyle>}>
        <Svg width={MEDALLION} height={MEDALLION}>
          <Circle cx={MEDALLION / 2} cy={MEDALLION / 2} r={MEDALLION / 2 - 0.75} fill="none"
            stroke={ringInk} strokeOpacity={0.7} strokeWidth={1.5} />
        </Svg>
      </Animated.View>
    </View>
  );
}
