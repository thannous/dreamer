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

import { JournalPageEdges } from '@/components/journal/JournalPageEdges';
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
 * The seal's beats in milliseconds, at the story's own pace. The whole seal follows
 * `DREAM_STORY.prologue`, so a slower or faster story keeps these proportions.
 */
const PACE = 4800;
const OPEN = {
  night: 620,
  journalIn: 430,
  framed: 900,
  lampOn: 1000,
  /** The previous dream's page turns over, when the journal has one. */
  turnFrom: 1000,
  turn: 900,
  /** The pen glides in as the page settles, draws the ring, then waits where the name will start. */
  penLead: 250,
  penIn: 150,
  ring: 600,
  toName: 350,
} as const;
/** How long after the save the pre-analysis is waited for before the first words name the dream. */
const NAME_DEADLINE = 5000;
const CLOSE = {
  perCharacter: 45,
  shortest: 700,
  longest: 1500,
  lineLift: 120,
  penAway: 320,
  breath: 100,
  /** From the dive's start: the page grows around the ring, the name's ink gives way to the page's own. */
  dive: 1420,
  inkGone: [260, 840],
  pageCover: [460, 1130],
  grainIn: [650, 1320],
  ringSettles: [1130, 1420],
  skyIn: [1420, 1990],
  end: 2280,
} as const;

/** The night sky behind the journal, in fractions of the screen; `at` and `pulse` in milliseconds. */
const SKY = [
  { x: 0.14, y: 0.12, size: 3, at: 290, pulse: 1440 },
  { x: 0.78, y: 0.08, size: 2, at: 430 },
  { x: 0.9, y: 0.22, size: 2.5, at: 580, pulse: 1920 },
  { x: 0.32, y: 0.2, size: 2, at: 720 },
  { x: 0.62, y: 0.15, size: 3, at: 380 },
  { x: 0.06, y: 0.36, size: 2, at: 860 },
  { x: 0.94, y: 0.4, size: 2, at: 530, pulse: 1630 },
  { x: 0.2, y: 0.74, size: 2.5, at: 960 },
  { x: 0.84, y: 0.7, size: 3, at: 670 },
  { x: 0.5, y: 0.82, size: 2, at: 1060, pulse: 2200 },
  { x: 0.1, y: 0.88, size: 3, at: 820 },
  { x: 0.7, y: 0.9, size: 2, at: 1150 },
  { x: 0.38, y: 0.94, size: 2.5, at: 1250 },
  { x: 0.9, y: 0.84, size: 2, at: 910, pulse: 1340 },
] as const;

/** The previous dream's page, sketched as a skeleton: its title, its date, its story. */
const SKELETON_LINES = [0.8, 0.74, 0.8, 0.66, 0.78, 0.5] as const;

/** Keyframe offsets are kept to a hundredth of a percent, so beats a few milliseconds apart stay apart. */
const pct = (value: number) => `${Math.round(value * 100) / 100}%`;
const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** The name as the pen writes it: up to three lines, closed with an ellipsis when it goes on. */
const nameLines = (text: string, maxChars: number): string[] => {
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

/** An arc of the ring, from `start` to `end` degrees clockwise from the top, around (r, r). */
const arcPath = (r: number, start: number, end: number) => {
  const point = (degrees: number) => {
    const radians = ((degrees - 90) * Math.PI) / 180;
    return `${r + (r - 1) * Math.cos(radians)} ${r + (r - 1) * Math.sin(radians)}`;
  };
  return `M${point(start)} A${r - 1} ${r - 1} 0 0 1 ${point(end)}`;
};

/**
 * The prologue of the dream story, played on the capture screen once the dream is durably
 * saved, while its pre-analysis names it. Night falls over the draft and its sky lights as
 * the dream journal opens under a lamp, the view gliding to its right page so that the
 * ring's place is already where the saved moment's window will open. When the journal
 * already holds a dream, its page lies there sketched, and turns over to a fresh one. A
 * fountain pen draws the ring, then waits where the name will start until the pre-analysis
 * has named the dream, a few seconds at most, after which the dream's first words name it.
 * The pen writes the name and lifts away, and the reader dives into the page around the
 * ring, which never moves: the page grows until it fills the screen and its paper becomes
 * the dream page's own, and the night fills the ring. In the night theme the journal's
 * paper is night paper, in the paper theme ivory; both are written in the accent ink of
 * the dream page. Two touches mark the ring closing and the sky filling it. It holds touch
 * for its moment so nothing is pressed twice, and is decorative to assistive technology:
 * the next screen announces the save. The caller skips it under reduce motion.
 */
export function DreamCaptureSeal({ name, provisionalName, previousPage, onNamed, onSealed }: {
  /** The pre-analysis's name for the dream, once it has given one. */
  name: string | null;
  /** The dream's first words, written instead when the pre-analysis has not named it in time. */
  provisionalName: string;
  /** The journal already holds a dream, whose page is turned over first. */
  previousPage: boolean;
  /** The name the pen is about to write: from then on it is the dream's. */
  onNamed: (name: string) => void;
  /** The window is open: the dream's page can take over. */
  onSealed: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const night = mode === 'dark';
  // One ink in both themes: the same as the dream page's story.
  const ink = noctalia.accent.text;
  const star = noctalia.atmosphere.star;
  const pace = DREAM_STORY.prologue / PACE;
  const ms = useCallback((value: number) => value * pace, [pace]);

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
  const fontSize = Math.round(journalWidth * 0.038);
  const lineHeight = Math.round(fontSize * 1.3);
  const lineLeft = page.x + page.w * 0.1;
  const nameTop = ring.y + ring.r + fontSize * 1.1;
  const maxChars = Math.floor((page.w * 0.8) / (fontSize * 0.56));
  const baseline = useCallback((row: number) => nameTop + row * lineHeight + lineHeight * 0.78, [lineHeight, nameTop]);
  const pen = journalWidth * PEN_SCALE;

  // The first act's length: the page turn only when there is a page to turn.
  const turnEnd = OPEN.turnFrom + (previousPage ? OPEN.turn : 0);
  const ringFrom = turnEnd + OPEN.penIn;
  const ringTo = ringFrom + OPEN.ring;
  const openTotal = ringTo + OPEN.toName;

  // The candidates for the name are laid out unseen as soon as they are known, so the pen
  // can write whichever is chosen at its own width. A later layout of the same text (web can
  // lay text out twice) replaces the first; the name is fixed once the pen starts.
  const candidates = useMemo(() => [...new Set([name, provisionalName].filter((text): text is string => !!text))],
    [name, provisionalName]);
  const [measures, setMeasures] = useState<Record<string, (number | undefined)[]>>({});
  const onMeasure = useCallback((text: string, row: number, rows: number, event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.width;
    setMeasures((current) => {
      const widths = current[text] ?? Array.from({ length: rows }, () => undefined);
      if (widths[row] !== undefined && Math.abs(widths[row]! - measured) < 0.5) return current;
      const next = [...widths];
      next[row] = measured;
      return { ...current, [text]: next };
    });
  }, []);

  const [opened, setOpened] = useState(false);
  const [late, setLate] = useState(false);
  const [closing, setClosing] = useState<{ text: string; lines: string[]; widths: number[] } | null>(null);
  useEffect(() => {
    const opening = setTimeout(() => setOpened(true), ms(openTotal));
    const deadline = setTimeout(() => setLate(true), ms(NAME_DEADLINE));
    return () => { clearTimeout(opening); clearTimeout(deadline); };
  }, [ms, openTotal]);
  // Once the ring is drawn, the pen writes the pre-analysis's name as soon as it is known, or
  // the first words once the wait is over. Decided while rendering, so no stale name is written.
  if (opened && !closing) {
    for (const text of [name, late ? provisionalName : null]) {
      if (!text) continue;
      const lines = nameLines(text, maxChars);
      const measured = measures[text];
      const widths = measured && measured.length === lines.length && measured.every((value) => value !== undefined)
        ? measured as number[]
        // Past the wait, an unmeasured name is written at an estimate rather than not at all.
        : late ? lines.map((line) => line.length * fontSize * 0.52) : null;
      if (widths) {
        setClosing({ text, lines, widths });
        break;
      }
    }
  }

  const named = useRef(onNamed);
  const sealed = useRef(onSealed);
  useEffect(() => { named.current = onNamed; sealed.current = onSealed; }, [onNamed, onSealed]);

  // The name's writing and the dive's beats, once the name is known.
  const close = useMemo(() => {
    if (!closing) return null;
    const characters = closing.lines.join('').length;
    const writing = Math.min(CLOSE.longest, Math.max(CLOSE.shortest, characters * CLOSE.perCharacter));
    const inked = writing - CLOSE.lineLift * (closing.lines.length - 1);
    const total = closing.widths.reduce((sum, value) => sum + value, 0) || 1;
    let from = 0;
    const schedule = closing.widths.map((lineWidth) => {
      const line = { from, to: from + Math.max(120, (inked * lineWidth) / total) };
      from = line.to + CLOSE.lineLift;
      return line;
    });
    const written = schedule[schedule.length - 1].to;
    const diveFrom = written + CLOSE.penAway + CLOSE.breath;
    return { schedule, written, diveFrom, total: diveFrom + CLOSE.end };
  }, [closing]);

  useEffect(() => {
    if (process.env.EXPO_OS === 'web') return;
    const timer = setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, ms(ringTo));
    return () => clearTimeout(timer);
  }, [ms, ringTo]);
  const closingText = closing?.text;
  useEffect(() => {
    if (!closingText || !close) return;
    named.current(closingText);
    const timers = [setTimeout(() => sealed.current(), ms(close.total))];
    if (process.env.EXPO_OS !== 'web') {
      timers.push(setTimeout(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
      }, ms(close.diveFrom + (CLOSE.skyIn[0] + CLOSE.skyIn[1]) / 2)));
    }
    return () => timers.forEach(clearTimeout);
    // The name and its beats are fixed once the pen starts writing, so this runs once.
  }, [close, closingText, ms]);

  const centre = { x: journalWidth / 2, y: journalHeight / 2 };
  const framed = { translateX: centre.x - ring.x, translateY: medallionY - height / 2 - (ring.y - centre.y) };
  const nibAt = useCallback((opacity: number, x: number, y: number, away = 0, glide = false) => {
    const frame: CSSAnimationKeyframes<ViewStyle>[string] = {
      opacity,
      transform: [{ translateX: x - NIB.x * pen + away }, { translateY: y - NIB.y * pen - away }],
    };
    // React Native's ViewStyle declares a string `animationTimingFunction`, which narrows the
    // keyframe block's type; Reanimated reads the curve object at run time.
    return glide ? ({ ...frame, animationTimingFunction: DREAM_EASE } as unknown as typeof frame) : frame;
  }, [pen]);

  // The first act: night, the journal, the previous page turned, the ring, the pen waiting.
  const opening = useMemo(() => {
    const at = (value: number) => pct((value / openTotal) * 100);
    const animate = <S extends object>(animationName: CSSAnimationKeyframes<S>, extra?: Partial<CSSStyle<S>>) => ({
      animationName,
      animationDuration: ms(openTotal),
      animationTimingFunction: DREAM_EASE,
      animationFillMode: 'both',
      ...extra,
    }) as CSSStyle<S>;
    const fade = (from: number, to: number, start = 0, end = 1): CSSAnimationKeyframes<ViewStyle> => ({
      '0%': { opacity: start }, [at(from)]: { opacity: start }, [at(to)]: { opacity: end }, '100%': { opacity: end },
    });
    const still = { opacity: 1, transform: [{ scale: 1 }] };
    const skyStar = (from: number, pulse?: number): CSSAnimationKeyframes<ViewStyle> => ({
      '0%': { opacity: 0, transform: [{ scale: 1 }] },
      [at(from)]: { opacity: 0, transform: [{ scale: 1 }] },
      [at(from + 340)]: still,
      ...(pulse && pulse + 480 < openTotal ? {
        [at(pulse)]: still,
        [at(pulse + 190)]: { opacity: 1, transform: [{ scale: 2 }] },
        [at(pulse + 480)]: still,
      } : null),
      '100%': still,
    });
    const halfway = OPEN.turnFrom + OPEN.turn / 2;
    const pen: CSSAnimationKeyframes<ViewStyle> = {
      '0%': nibAt(0, ring.x, ring.y - ring.r, 30),
      [at(turnEnd - OPEN.penLead)]: nibAt(0, ring.x, ring.y - ring.r, 30, true),
      [at(ringFrom)]: nibAt(1, ring.x, ring.y - ring.r, 0),
    };
    for (let stroke = 1; stroke <= RING_STROKES; stroke += 1) {
      const radians = ((stroke / RING_STROKES) * 360 - 90) * (Math.PI / 180);
      pen[at(ringFrom + (OPEN.ring * stroke) / RING_STROKES)] = nibAt(
        1, ring.x + ring.r * Math.cos(radians), ring.y + ring.r * Math.sin(radians), 0, stroke === RING_STROKES
      );
    }
    pen['100%'] = nibAt(1, lineLeft, baseline(0));

    return {
      veil: animate<ViewStyle>({ '0%': { opacity: 0 }, [at(OPEN.night)]: { opacity: 0.96 }, '100%': { opacity: 0.96 } },
        { animationTimingFunction: EASE.out }),
      stars: SKY.map((point) => animate<ViewStyle>(skyStar(point.at, 'pulse' in point ? point.pulse : undefined))),
      frame: animate<ViewStyle>({
        '0%': { transform: [{ translateX: 0 }, { translateY: 0 }] },
        [at(OPEN.journalIn)]: { transform: [{ translateX: 0 }, { translateY: 0 }] },
        [at(OPEN.framed)]: { transform: [{ translateX: framed.translateX }, { translateY: framed.translateY }] },
        '100%': { transform: [{ translateX: framed.translateX }, { translateY: framed.translateY }] },
      }),
      journal: animate<ViewStyle>({
        '0%': { opacity: 0, transform: [{ translateX: 0 }, { translateY: 8 }, { scale: 0.985 }] },
        [at(OPEN.journalIn * 0.25)]: { opacity: 0, transform: [{ translateX: 0 }, { translateY: 8 }, { scale: 0.985 }] },
        [at(OPEN.journalIn)]: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] },
        '100%': { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] },
      }),
      lamp: animate<ViewStyle>({
        '0%': { opacity: 0 },
        [at(OPEN.journalIn + 190)]: { opacity: 0 },
        [at(OPEN.lampOn)]: { opacity: 0.55 },
        [at(OPEN.lampOn + 300)]: { opacity: 0.47 },
        [at(OPEN.lampOn + 600)]: { opacity: 0.58 },
        '100%': { opacity: 0.52 },
      }),
      // The previous page lifts from the binding and lies over the left page, which it then is.
      sheet: animate<ViewStyle>({
        '0%': { opacity: 1, transform: [{ perspective: 700 }, { rotateY: '0deg' }] },
        [at(OPEN.turnFrom)]: { opacity: 1, transform: [{ perspective: 700 }, { rotateY: '0deg' }] },
        [at(turnEnd)]: { opacity: 1, transform: [{ perspective: 700 }, { rotateY: '-180deg' }] },
        [at(turnEnd + 120)]: { opacity: 0, transform: [{ perspective: 700 }, { rotateY: '-180deg' }] },
        '100%': { opacity: 0, transform: [{ perspective: 700 }, { rotateY: '-180deg' }] },
      }, { animationTimingFunction: 'linear' }),
      sheetFront: animate<ViewStyle>({
        '0%': { opacity: 1 }, [at(halfway)]: { opacity: 1 }, [at(halfway + 12)]: { opacity: 0 }, '100%': { opacity: 0 },
      }, { animationTimingFunction: 'linear' }),
      sheetBack: animate<ViewStyle>({
        '0%': { opacity: 0 }, [at(halfway)]: { opacity: 0 }, [at(halfway + 12)]: { opacity: 1 }, '100%': { opacity: 1 },
      }, { animationTimingFunction: 'linear' }),
      sheetShade: animate<ViewStyle>({
        '0%': { opacity: 0 }, [at(OPEN.turnFrom)]: { opacity: 0 }, [at(halfway)]: { opacity: 0.22 },
        [at(turnEnd)]: { opacity: 0 }, '100%': { opacity: 0 },
      }),
      ringStrokes: Array.from({ length: RING_STROKES }, (_, stroke) => {
        const drawn = ringFrom + (OPEN.ring * (stroke + 1)) / RING_STROKES;
        return animate<ViewStyle>(fade(drawn - 15, drawn), { animationTimingFunction: 'linear' });
      }),
      glint: animate<ViewStyle>({
        '0%': { opacity: 0, transform: [{ rotate: '-30deg' }, { scale: 0 }] },
        [at(ringTo - 70)]: { opacity: 0, transform: [{ rotate: '-30deg' }, { scale: 0 }] },
        [at(ringTo)]: { opacity: 1, transform: [{ rotate: '0deg' }, { scale: 1 }] },
        '100%': { opacity: 0, transform: [{ rotate: '45deg' }, { scale: 0.6 }] },
      }),
      pen: { ...animate<ViewStyle>(pen), animationTimingFunction: 'linear' } as CSSStyle<ViewStyle>,
    };
  }, [baseline, framed.translateX, framed.translateY, lineLeft, ms, nibAt, openTotal, ring.r, ring.x, ring.y, ringFrom, ringTo, turnEnd]);

  // While the pre-analysis is awaited, the pen hovers where the name will start.
  const hovering = useMemo(() => ({
    animationName: {
      from: nibAt(1, lineLeft, baseline(0)),
      to: nibAt(1, lineLeft + 1.5, baseline(0) - 3),
    },
    animationDuration: 760,
    animationIterationCount: 'infinite',
    animationDirection: 'alternate',
    animationTimingFunction: 'ease-in-out',
  }) as CSSStyle<ViewStyle>, [baseline, lineLeft, nibAt]);

  // The last act: the name written, the pen away, the dive, the night in the ring.
  const closingMotion = useMemo(() => {
    if (!closing || !close) return null;
    const at = (value: number) => pct((value / close.total) * 100);
    const animate = <S extends object>(animationName: CSSAnimationKeyframes<S>, extra?: Partial<CSSStyle<S>>) => ({
      animationName,
      animationDuration: ms(close.total),
      animationTimingFunction: DREAM_EASE,
      animationFillMode: 'both',
      ...extra,
    }) as CSSStyle<S>;
    const dive = (value: number) => close.diveFrom + value;
    const fade = (from: number, to: number, start = 0, end = 1): CSSAnimationKeyframes<ViewStyle> => ({
      '0%': { opacity: start }, [at(from)]: { opacity: start }, [at(to)]: { opacity: end }, '100%': { opacity: end },
    });

    const zoomFrames: CSSAnimationKeyframes<ViewStyle> = {
      '0%': { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] },
    };
    const steps = 10;
    for (let step = 0; step <= steps; step += 1) {
      const scale = zoom ** smoothstep(step / steps);
      // Each step is already eased, so the steps join linearly.
      zoomFrames[at(dive((CLOSE.dive * step) / steps))] = {
        opacity: 1,
        transform: [
          { translateX: -(scale - 1) * (ring.x - centre.x) },
          { translateY: -(scale - 1) * (ring.y - centre.y) },
          { scale },
        ],
        animationTimingFunction: 'linear',
      };
    }
    zoomFrames['100%'] = zoomFrames[at(dive(CLOSE.dive))];

    const pen: CSSAnimationKeyframes<ViewStyle> = { '0%': nibAt(1, lineLeft, baseline(0)) };
    close.schedule.forEach((line, row) => {
      const strokes = Math.max(4, Math.round((line.to - line.from) / 77));
      pen[at(line.from)] = nibAt(1, lineLeft, baseline(row));
      for (let stroke = 1; stroke < strokes; stroke += 1) {
        // A writing hand never runs on a rail: the nib rises and dips along the line.
        const wobble = (stroke % 2 ? -1 : 1) * fontSize * 0.06;
        pen[at(line.from + ((line.to - line.from) * stroke) / strokes)] =
          nibAt(1, lineLeft + (closing.widths[row] * stroke) / strokes, baseline(row) + wobble);
      }
      pen[at(line.to)] = nibAt(1, lineLeft + closing.widths[row], baseline(row), 0, true);
    });
    const last = closing.widths.length - 1;
    pen[at(close.written + CLOSE.penAway)] = nibAt(0, lineLeft + closing.widths[last], baseline(last), 30);
    pen['100%'] = nibAt(0, lineLeft + closing.widths[last], baseline(last), 30);

    return {
      sky: animate<ViewStyle>({
        '0%': { opacity: 1, transform: [{ scale: 1 }] },
        [at(dive(0))]: { opacity: 1, transform: [{ scale: 1 }] },
        [at(dive(CLOSE.dive))]: { opacity: 0, transform: [{ scale: 1.35 }] },
        '100%': { opacity: 0, transform: [{ scale: 1.35 }] },
      }),
      journal: animate<ViewStyle>(zoomFrames),
      lamp: animate<ViewStyle>({ '0%': { opacity: 0.52 }, [at(dive(CLOSE.inkGone[0]))]: { opacity: 0 }, '100%': { opacity: 0 } }),
      pen: { ...animate<ViewStyle>(pen), animationTimingFunction: 'linear' } as CSSStyle<ViewStyle>,
      masks: close.schedule.map((line, row) => animate<ViewStyle>({
        '0%': { width: 0 },
        [at(line.from)]: { width: 0 },
        [at(line.to)]: { width: closing.widths[row] },
        '100%': { width: closing.widths[row] },
      }, { animationTimingFunction: 'linear' })),
      ink: animate<ViewStyle>(fade(dive(CLOSE.inkGone[0]), dive(CLOSE.inkGone[1]), 1, 0)),
      pageCover: animate<ViewStyle>(fade(dive(CLOSE.pageCover[0]), dive(CLOSE.pageCover[1]))),
      grain: animate<ViewStyle>(fade(dive(CLOSE.grainIn[0]), dive(CLOSE.grainIn[1]))),
      drawnRing: animate<ViewStyle>(fade(dive(CLOSE.ringSettles[0]), dive(CLOSE.ringSettles[1]), 1, 0)),
      ring: animate<ViewStyle>(fade(dive(CLOSE.ringSettles[0]), dive(CLOSE.ringSettles[1]))),
      skyFill: animate<ViewStyle>({
        '0%': { opacity: 0, transform: [{ scale: 1.08 }] },
        [at(dive(CLOSE.skyIn[0]))]: { opacity: 0, transform: [{ scale: 1.08 }] },
        [at(dive(CLOSE.skyIn[1]))]: { opacity: 1, transform: [{ scale: 1 }] },
        '100%': { opacity: 1, transform: [{ scale: 1 }] },
      }),
      halo: animate<ViewStyle>({
        '0%': { opacity: 0, transform: [{ scale: 0.8 }] },
        [at(dive(CLOSE.skyIn[0]))]: { opacity: 0, transform: [{ scale: 0.8 }] },
        [at(dive((CLOSE.skyIn[0] + CLOSE.skyIn[1]) / 2))]: { opacity: 0.9, transform: [{ scale: 1.05 }] },
        '100%': { opacity: 0.45, transform: [{ scale: 1 }] },
      }),
    };
  }, [baseline, centre.x, centre.y, close, closing, fontSize, lineLeft, ms, nibAt, ring.x, ring.y, zoom]);

  const hidden = { opacity: 0 };
  const ringBox = ring.r * 2;
  const nameStyle = { fontSize, lineHeight, color: ink };
  const sheetFrame = { position: 'absolute' as const, left: 0, top: 0, width: page.w, height: page.h };
  const art = night ? NIGHT_JOURNAL : IVORY_JOURNAL;
  const penStyle = closingMotion?.pen ?? (opened ? hovering : opening.pen);

  return (
    <View
      testID={TID.Component.DreamCaptureSeal}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      className="absolute inset-0 items-center justify-center"
    >
      <Animated.View className="absolute inset-0 bg-ink" style={opening.veil as StyleProp<ViewStyle>} />
      <Animated.View className="absolute inset-0" style={closingMotion?.sky as StyleProp<ViewStyle>}>
        {SKY.map((point, index) => (
          <Animated.View key={index} className="absolute rounded-full" style={[{
            left: point.x * width - point.size / 2,
            top: point.y * height - point.size / 2,
            width: point.size,
            height: point.size,
            backgroundColor: star,
          }, opening.stars[index]] as StyleProp<ViewStyle>} />
        ))}
      </Animated.View>

      {/* The names laid out unseen, so the pen writes each line at its own width. */}
      <View className="absolute opacity-0" style={{ width: journalWidth, height: journalHeight }}>
        {candidates.map((text) => {
          const lines = nameLines(text, maxChars);
          return lines.map((line, row) => (
            <Text key={`${text}:${row}`} numberOfLines={1} onLayout={(event) => onMeasure(text, row, lines.length, event)}
              className="absolute left-0 top-0 font-display-semibold" style={nameStyle}>{line}</Text>
          ));
        })}
      </View>

      <Animated.View className="absolute" style={[{ width: journalWidth, height: journalHeight }, opening.frame] as StyleProp<ViewStyle>}>
        <Animated.View className="absolute inset-0" style={(closingMotion?.journal ?? opening.journal) as StyleProp<ViewStyle>}>
          <Image source={art} resizeMode="contain" style={{ width: journalWidth, height: journalHeight }} />
          <Animated.View className="absolute" style={[{
            left: page.x - page.w * 0.4, top: page.y - page.h * 0.25, width: page.w * 1.8, height: page.h * 1.5,
          }, closingMotion?.lamp ?? opening.lamp] as StyleProp<ViewStyle>}>
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

          {/* The previous dream's page, sketched, turning over at the binding onto the left page. */}
          {previousPage ? (
            <Animated.View pointerEvents="none" style={[{
              position: 'absolute', left: page.x, top: page.y, width: page.w, height: page.h, transformOrigin: 'left center',
            }, opening.sheet] as StyleProp<ViewStyle>}>
              <Animated.View className="overflow-hidden" style={[sheetFrame, opening.sheetFront] as StyleProp<ViewStyle>}>
                <Image source={art} resizeMode="contain"
                  style={{ position: 'absolute', left: -page.x, top: -page.y, width: journalWidth, height: journalHeight }} />
                <Svg width={page.w} height={page.h} style={{ position: 'absolute', left: 0, top: 0 }}>
                  <Circle cx={ring.x - page.x} cy={ring.y - page.y} r={ring.r - 0.5} fill="none"
                    stroke={ink} strokeOpacity={0.3} strokeWidth={0.7} />
                </Svg>
                <View className="absolute rounded-full" style={{
                  left: page.w * 0.1, top: nameTop - page.y + lineHeight * 0.25, width: page.w * 0.62,
                  height: fontSize * 0.5, backgroundColor: ink, opacity: 0.2,
                }} />
                <View className="absolute rounded-full" style={{
                  left: page.w * 0.1, top: nameTop - page.y + lineHeight * 1.25, width: page.w * 0.4,
                  height: fontSize * 0.5, backgroundColor: ink, opacity: 0.2,
                }} />
                {SKELETON_LINES.map((share, row) => (
                  <View key={row} className="absolute rounded-full" style={{
                    left: page.w * 0.1, top: nameTop - page.y + lineHeight * (2.6 + row * 0.8), width: page.w * share,
                    height: 2, backgroundColor: ink, opacity: 0.14,
                  }} />
                ))}
              </Animated.View>
              <Animated.View className="overflow-hidden" style={[sheetFrame, opening.sheetBack] as StyleProp<ViewStyle>}>
                {/* Mirrored, so that once turned it lies over the left page as the left page itself. */}
                <View style={[sheetFrame, { transform: [{ scaleX: -1 }] }]}>
                  <Image source={art} resizeMode="contain"
                    style={{ position: 'absolute', left: -(page.x - page.w), top: -page.y, width: journalWidth, height: journalHeight }} />
                </View>
              </Animated.View>
              <Animated.View className="absolute inset-0 bg-black" style={opening.sheetShade as StyleProp<ViewStyle>} />
            </Animated.View>
          ) : null}

          {/* The page itself, which takes over from the art as it fills the screen. */}
          <Animated.View className="absolute bg-ink" style={[{ left: page.x, top: page.y, width: page.w, height: page.h },
            closingMotion?.pageCover ?? hidden] as StyleProp<ViewStyle>} />
          <Animated.View className="absolute inset-0" style={closingMotion?.ink as StyleProp<ViewStyle>}>
            {closing && closingMotion ? closing.lines.map((line, row) => (
              <Animated.View key={row} className="absolute overflow-hidden"
                style={[{ left: lineLeft, top: nameTop + row * lineHeight, height: lineHeight }, closingMotion.masks[row]] as StyleProp<ViewStyle>}>
                {/* Wider than the line, so the mask alone decides what is written. */}
                <Text className="font-display-semibold" style={[nameStyle, { width: closing.widths[row] + fontSize }]}>{line}</Text>
              </Animated.View>
            )) : null}
          </Animated.View>
          <Animated.View className="absolute" style={[{ left: ring.x - ring.r, top: ring.y - ring.r, width: ringBox, height: ringBox },
            closingMotion?.drawnRing] as StyleProp<ViewStyle>}>
            {opening.ringStrokes.map((stroke, index) => (
              <Animated.View key={index} className="absolute inset-0" style={stroke as StyleProp<ViewStyle>}>
                <Svg width={ringBox} height={ringBox}>
                  <Path d={arcPath(ring.r, (index * 360) / RING_STROKES, ((index + 1) * 360) / RING_STROKES + 1)}
                    stroke={ink} strokeWidth={0.7} strokeOpacity={0.9} strokeLinecap="round" fill="none" />
                </Svg>
              </Animated.View>
            ))}
          </Animated.View>
        </Animated.View>

        <Animated.View className="absolute left-0 top-0" style={[{ width: pen, height: pen }, penStyle] as StyleProp<ViewStyle>}>
          {/* The pen's soft shadow on the paper, then the pen. */}
          <Image source={PEN_ART} resizeMode="contain" tintColor="#000000"
            style={{ position: 'absolute', left: 5, top: 7, width: pen, height: pen, opacity: 0.22 }} />
          <Image source={PEN_ART} resizeMode="contain" style={{ width: pen, height: pen }} />
        </Animated.View>
        <Animated.View className="absolute items-center justify-center" style={[{
          left: ring.x - 9, top: ring.y - ring.r - 9, width: 18, height: 18,
        }, opening.glint] as StyleProp<ViewStyle>}>
          <Svg width={18} height={18}><Path d={sparklePath(9, 9, 9)} fill={ink} /></Svg>
        </Animated.View>
      </Animated.View>

      {/* The dream page's own grain, then its window: the ring settles crisp and fills with night. */}
      <Animated.View className="absolute inset-0" style={(closingMotion?.grain ?? hidden) as StyleProp<ViewStyle>}>
        <JournalPaper />
        <JournalPageEdges />
      </Animated.View>
      <Animated.View className="absolute" style={[{
        left: width / 2 - 170, top: medallionY - 140, width: 340, height: 280,
      }, closingMotion?.halo ?? hidden] as StyleProp<ViewStyle>}>
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
      }, closingMotion?.skyFill ?? hidden] as StyleProp<ViewStyle>}>
        <Image source={ASTRAL_ART} resizeMode="cover" style={{ width: MEDALLION, height: MEDALLION }} />
      </Animated.View>
      <Animated.View className="absolute" style={[{
        left: width / 2 - MEDALLION / 2, top: medallionY - MEDALLION / 2, width: MEDALLION, height: MEDALLION,
      }, closingMotion?.ring ?? hidden] as StyleProp<ViewStyle>}>
        <Svg width={MEDALLION} height={MEDALLION}>
          <Circle cx={MEDALLION / 2} cy={MEDALLION / 2} r={MEDALLION / 2 - 0.75} fill="none"
            stroke={ink} strokeOpacity={0.7} strokeWidth={1.5} />
        </Svg>
      </Animated.View>
    </View>
  );
}
