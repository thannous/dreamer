import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Image,
  Modal,
  Platform,
  Text,
  View,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  type StyleProp,
  type TextLayoutEvent,
  type ViewInstance,
  type ViewStyle,
} from 'react-native';
import Animated, { type CSSAnimationKeyframes, type CSSStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';

import { JOURNAL_LEAF_BLOCK, JournalPageEdges } from '@/components/journal/JournalPageEdges';

import { JournalPaper } from '@/components/journal/JournalPaper';
import { PressableScale, Reveal } from '@/components/motion';
import { EASE } from '@/components/motion/motion';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { getNoctaliaPalette } from '@/constants/noctaliaPalette';
import { Fonts } from '@/constants/theme';
import { useContentWindow } from '@/context/ContentWindowContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';

import { DREAM_EASE, DREAM_STORY } from './dreamStoryMotion';
import {
  SEAL_EMBLEMS, SEAL_GOLD, SEAL_MEASURES, SEAL_NAME_LINES, SealChoice, SealLegend, sealHeadingHeight, sealTextScales,
  type SealMark,
} from './sealMarks';
import { sparklePath } from './sparkle';

const IVORY_JOURNAL = require('@/assets/images/dream-seal-book.webp');
const NIGHT_JOURNAL = require('@/assets/images/dream-seal-book-night.webp');
const PEN_ART = require('@/assets/images/dream-seal-pen.webp');
const ASTRAL_ART = require('@/assets/images/onboarding-astral-background.webp');

/** The journal art's aspect, and its right page in fractions of the art (both journals share it). */
const JOURNAL_RATIO = 1536 / 1024;
const RIGHT_PAGE = { left: 785 / 1536, top: 105 / 1024, right: 1380 / 1536, bottom: 850 / 1024 } as const;
/**
 * The right page's own edges in the art: the binding's crease, and where its paper ends
 * and the block of leaves begins. The dive ends with the crease on the screen's left edge
 * and the paper's end where the dream page's block of leaves begins, so the journal's
 * edges become the page's own.
 */
const SPREAD = { binding: 771 / 1536, paperEnd: 1386 / 1536 } as const;
/** How far down its page, as drawn, the ring sits: the name is written above it, the journal's question below. */
const RING_DROP = 0.58;
/**
 * The journal is drawn taller than its art: its top and bottom edges (the gilt corners, the
 * spine's cap, the ribbon) keep their drawing, and the pages between them are drawn this much
 * taller, so the name and the journal's question have room on the page.
 */
const ART_BANDS = { top: 200 / 1024, bottom: 800 / 1024 } as const;
const BOOK_STRETCH = 1.4;
/** Where a height in the art, as a fraction of it, falls on the journal drawn taller. */
const onTallJournal = (fraction: number, artHeight: number) => (fraction <= ART_BANDS.top
  ? fraction
  : fraction <= ART_BANDS.bottom
    ? ART_BANDS.top + (fraction - ART_BANDS.top) * BOOK_STRETCH
    : ART_BANDS.top + (ART_BANDS.bottom - ART_BANDS.top) * BOOK_STRETCH + (fraction - ART_BANDS.bottom)) * artHeight;
/** How close the view comes to the page before the dive, against the dive's own closeness. */
const NEAREST = 0.7;

/** The journal's art drawn taller: its edges as drawn, its pages stretched between them. */
function TallJournal({ source, width, artHeight, style }: {
  source: ImageSourcePropType;
  width: number;
  artHeight: number;
  style?: StyleProp<ViewStyle>;
}) {
  const bands = [[0, ART_BANDS.top, 1], [ART_BANDS.top, ART_BANDS.bottom, BOOK_STRETCH], [ART_BANDS.bottom, 1, 1]] as const;
  return (
    <View style={[{ width, height: onTallJournal(1, artHeight) }, style]}>
      {bands.map(([from, to, stretch], index) => {
        const top = onTallJournal(from, artHeight);
        // Each band runs a hair into the next, so no seam shows between them.
        const height = onTallJournal(to, artHeight) - top + (index < bands.length - 1 ? 1 : 0);
        return (
          <View key={from} className="absolute left-0 overflow-hidden" style={{ top, width, height }}>
            <Image source={source} resizeMode="stretch"
              style={{ position: 'absolute', left: 0, top: -from * artHeight * stretch, width, height: artHeight * stretch }} />
          </View>
        );
      })}
    </View>
  );
}
/** The pen art's nib in fractions of the art, and the pen's size against the journal. */
const NIB = { x: 0.148, y: 0.874 } as const;
const PEN_SCALE = 0.215;
/** The saved moment's medallion. */
const MEDALLION = 148;
/**
 * Where the dream page sets the name on arrival: at the top of its page, under its
 * running head, inside the reading margins; its seal follows the lines kept for the name.
 * The name and the seal land there exactly, so the page takes them over as they are.
 */
const NAME_TOP_FROM_TOP = 76;
const NAME_LEFT = 24;
const NAME_RIGHT = 24;
/** The name's size on the journal page, before it rises to the dream page's own. */
const BOOK_NAME_SIZE = 17;
/** The signs on the journal page, on screen: each sign's size, and the gap between their medals and the ring. */
const BOOK_SIGN = 18;
const BOOK_SIGN_GAP = 12;
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
  /** The view comes closer to the fresh page, so the name will be read as it is written. */
  push: 600,
  /** The pen glides in as the view settles, draws the ring, then waits where the name will start. */
  penLead: 250,
  penIn: 150,
  ring: 600,
  toName: 350,
} as const;
const CLOSE = {
  perCharacter: 45,
  shortest: 700,
  longest: 1500,
  lineLift: 120,
  penAway: 320,
  breath: 100,
  /** The signs turn at least this long while the name is written; the chosen one then glides into the ring. */
  choiceAtLeast: 1000,
  glide: 420,
  /** The struck seal is seen on the page before the dive carries it. */
  struckHold: 300,
  /**
   * Asked whether to read the dream now, the page holds still: the question comes this
   * long into the hold, and the dive waits this long past it, so it is caught standing.
   */
  askAfter: 100,
  askLead: 700,
  /** From the dive's start: the page grows around the ring while the name rises to its place. */
  dive: 1420,
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

/**
 * The seal covers the whole capture screen, its navigation and save bar included: they are
 * raised above the screen's own layers, which its layout-only views do not contain once
 * flattened, so the seal is raised above them, or they would show through the dream page as
 * it fades in.
 */
const ABOVE_THE_SCREEN = { zIndex: 100, elevation: 20 } as const;

/** The question leaves with the answer, as the dive takes up. */
const ANSWERED = {
  animationName: { from: { opacity: 1 }, to: { opacity: 0 } }, animationDuration: 180, animationFillMode: 'both',
} as CSSStyle<ViewStyle>;

/** The previous dream's page, sketched as a skeleton: its title, its date, its story. */
const SKELETON_LINES = [0.8, 0.74, 0.8, 0.66, 0.78, 0.5] as const;

/** Keyframe offsets are kept to a hundredth of a percent, so beats a few milliseconds apart stay apart. */
const pct = (value: number) => `${Math.round(value * 100) / 100}%`;
const smoothstep = (t: number) => t * t * (3 - 2 * t);

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
 * already holds a dream, its page lies there sketched, and turns over to a fresh one. The
 * view comes closer, a fountain pen draws the ring, then waits where the name will start
 * until the pre-analysis has named the dream, a few seconds at most, after which the
 * dream's first words name it. While the pen writes the name, the signs a dream can bear
 * turn around the ring, and the dream's own, from the same pre-analysis, glides into the
 * ring and is struck there in ink, its type and theme engraved around its top and the date
 * around its foot, and the pen lifts away. The reader dives into the page around the ring, which never moves: the page
 * grows until it fills the screen and its paper becomes the dream page's own, the night
 * fills the ring, where the emblem turns to gold, the struck seal grows with the page to
 * the saved moment's size, and the name rises to the very place the dream page sets it,
 * so that page takes everything over as it is. The name is laid out as the dream page lays
 * it out, only smaller on the journal page, so it keeps its lines all the way. In the
 * night theme the journal's paper is night paper, in the paper theme ivory. Two touches
 * mark the ring closing and the sky filling it. It holds touch for its moment so nothing
 * is pressed twice, and is decorative to assistive technology: the next screen announces
 * the save. The caller skips it under reduce motion.
 */
export function DreamCaptureSeal({ name, mark, provisionalName, date, previousPage, askReading = false, onNamed, onSealed }: {
  /** The pre-analysis's name for the dream, once it has given one. */
  name: string | null;
  /** What the same pre-analysis classed the dream as, struck into the seal with its name. */
  mark: SealMark | null;
  /** The dream's first words, written instead when the pre-analysis has not named it in time. */
  provisionalName: string;
  /** The dream's date and time, engraved along the foot of the seal's rim as its page shows it. */
  date: string;
  /** The journal already holds a dream, whose page is turned over first. */
  previousPage: boolean;
  /** The name the pen is about to write, whether it is the first words standing in, and the seal it strikes. */
  onNamed: (name: string, provisional: boolean, mark: SealMark | null) => void;
  /**
   * Whether the dream can be read now: once the seal is struck, the journal asks, and the
   * dive waits for the answer.
   */
  askReading?: boolean;
  /** The window is open: the dream's page can take over, reading the dream if so answered. */
  onSealed: (read: boolean) => void;
}) {
  const { width, height, fontScale } = useContentWindow();
  const insets = useSafeAreaInsets();
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const night = mode === 'dark';
  // The ring in the accent ink of the dream page's story; the name in the page's own text.
  const ink = noctalia.accent.text;
  const star = noctalia.atmosphere.star;
  const pace = DREAM_STORY.prologue / PACE;
  const ms = useCallback((value: number) => value * pace, [pace]);

  // The journal, centred; its right page; and the dive that turns that page into the screen.
  const journalWidth = Math.min(width - 12, 460);
  const artHeight = journalWidth / JOURNAL_RATIO;
  const journalHeight = onTallJournal(1, artHeight);
  const page = {
    x: RIGHT_PAGE.left * journalWidth,
    y: onTallJournal(RIGHT_PAGE.top, artHeight),
    w: (RIGHT_PAGE.right - RIGHT_PAGE.left) * journalWidth,
    h: onTallJournal(RIGHT_PAGE.bottom, artHeight) - onTallJournal(RIGHT_PAGE.top, artHeight),
  };
  const medallionY = insets.top + NAME_TOP_FROM_TOP + sealHeadingHeight(fontScale) + SEAL_MEASURES.orbit / 2;
  // The dive ends with the spread's edges on the screen's: that fixes how far it goes.
  const zoom = (width - JOURNAL_LEAF_BLOCK) / ((SPREAD.paperEnd - SPREAD.binding) * journalWidth);
  // Where the ring sits on the page: half a screen from the binding, so that once the edges
  // are in place it is the medallion.
  const ring = {
    x: journalWidth * SPREAD.binding + width / (2 * zoom),
    y: page.y + (RIGHT_PAGE.bottom - RIGHT_PAGE.top) * artHeight * RING_DROP,
    r: MEDALLION / 2 / zoom,
  };
  const centre = { x: journalWidth / 2, y: journalHeight / 2 };
  const framed = { translateX: centre.x - ring.x, translateY: medallionY - height / 2 - (ring.y - centre.y) };
  // From the screen to the journal's own frame, once it has been framed on the ring.
  const origin = { x: (width - journalWidth) / 2 + framed.translateX, y: (height - journalHeight) / 2 + framed.translateY };

  // The name and date as the dream page sets them, and the same block, smaller, on the journal page.
  const titleScale = sealTextScales(fontScale).title;
  const nameStyle = { fontSize: 26 * titleScale, lineHeight: 32 * titleScale };
  const target = {
    left: NAME_LEFT,
    top: insets.top + NAME_TOP_FROM_TOP,
    width: width - NAME_LEFT - NAME_RIGHT,
  };
  // The view comes close enough for the name to fit the page's text measure; when it would
  // come too close, the name is written a little smaller instead, so it stays on the paper.
  const measure = page.w * 0.8;
  const small = Math.min(BOOK_NAME_SIZE / nameStyle.fontSize, (measure * zoom * NEAREST) / target.width);
  const push = Math.min(zoom * NEAREST, Math.max(1, (small * target.width) / measure));
  // The seal is struck at the saved moment's size and shown at the page's scale; on the
  // journal page its signs ride a wider orbit, larger, so they read there, clear of the name.
  const onTheJournal = push / zoom;
  const bookSign = BOOK_SIGN / onTheJournal;
  const bookOrbit = (push * ring.r + BOOK_SIGN * 0.73 + BOOK_SIGN_GAP) / onTheJournal;
  // The signs' reach around the ring, on the screen; the name is written above it in the
  // lines the dream page keeps for it, and the journal's question asked below it.
  const signsReach = bookOrbit * onTheJournal + BOOK_SIGN * 0.73;
  const book = {
    x: width / 2 + push * (page.x + page.w * 0.1 - ring.x),
    y: medallionY - signsReach - 14 - SEAL_NAME_LINES * nameStyle.lineHeight * small,
  };
  const pen = journalWidth * PEN_SCALE * push;

  // The first act's length: the page turn only when there is a page to turn.
  const turnEnd = OPEN.turnFrom + (previousPage ? OPEN.turn : 0);
  const pushEnd = turnEnd + OPEN.push;
  const ringFrom = pushEnd + OPEN.penIn;
  const ringTo = ringFrom + OPEN.ring;
  const openTotal = ringTo + OPEN.toName;

  // The candidates for the name are laid out unseen as the dream page will lay them out, so
  // the pen writes each line at its own width. A later layout of the same text (web can lay
  // text out twice) replaces the first; the name is fixed once the pen starts.
  const candidates = useMemo(() => [...new Set([name, provisionalName].filter((text): text is string => !!text))],
    [name, provisionalName]);
  const [measures, setMeasures] = useState<Record<string, { height?: number; lines?: number[] }>>({});
  const onMeasureBlock = useCallback((text: string, event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.height;
    setMeasures((current) => (current[text]?.height !== undefined && Math.abs(current[text].height! - measured) < 0.5
      ? current : { ...current, [text]: { ...current[text], height: measured } }));
  }, []);
  const onMeasureLines = useCallback((text: string, event: TextLayoutEvent) => {
    const lines = event.nativeEvent.lines.map((line) => line.width);
    setMeasures((current) => ({ ...current, [text]: { ...current[text], lines } }));
  }, []);

  const [opened, setOpened] = useState(false);
  const [late, setLate] = useState(false);
  const [closing, setClosing] = useState<{
    text: string; widths: number[]; provisional: boolean; mark: SealMark | null; ask: boolean;
  } | null>(null);
  useEffect(() => {
    const opening = setTimeout(() => setOpened(true), ms(openTotal));
    const deadline = setTimeout(() => setLate(true), ms(DREAM_STORY.nameDeadline));
    return () => { clearTimeout(opening); clearTimeout(deadline); };
  }, [ms, openTotal]);
  // Once the ring is drawn, the pen writes the pre-analysis's name as soon as it is known, or
  // the first words once the wait is over. Decided while rendering, so no stale name is written.
  if (opened && !closing) {
    for (const text of [name, late ? provisionalName : null]) {
      if (!text) continue;
      const measured = measures[text];
      // Each line at its own width where the platform reports lines; otherwise full lines.
      const widths = measured?.lines?.length
        ? measured.lines
        : measured?.height !== undefined
          ? Array.from({ length: Math.max(1, Math.round(measured.height / nameStyle.lineHeight)) }, () => target.width)
          // Past the wait, an unmeasured name is written at an estimate rather than not at all.
          : late ? [target.width] : null;
      if (widths) {
        setClosing({ text, widths, provisional: text !== name, mark: text === name ? mark : null, ask: askReading });
        break;
      }
    }
  }

  const named = useRef(onNamed);
  const sealed = useRef(onSealed);
  const finished = useRef(false);
  useEffect(() => { named.current = onNamed; sealed.current = onSealed; }, [onNamed, onSealed]);
  const finish = useCallback((read: boolean) => {
    if (finished.current) return;
    finished.current = true;
    sealed.current(read);
  }, []);

  // The name's writing and the dive's beats, once the name is known.
  const close = useMemo(() => {
    if (!closing) return null;
    const characters = closing.text.length;
    const writing = Math.min(CLOSE.longest, Math.max(CLOSE.shortest, characters * CLOSE.perCharacter));
    const inked = writing - CLOSE.lineLift * (closing.widths.length - 1);
    const total = closing.widths.reduce((sum, value) => sum + value, 0) || 1;
    let from = 0;
    const schedule = closing.widths.map((lineWidth) => {
      const line = { from, to: from + Math.max(120, (inked * lineWidth) / total) };
      from = line.to + CLOSE.lineLift;
      return line;
    });
    const written = schedule[schedule.length - 1].to;
    const choice = Math.max(written, CLOSE.choiceAtLeast);
    const contact = choice + CLOSE.glide;
    const still = Math.max(written + CLOSE.penAway + CLOSE.breath, closing.mark ? contact + CLOSE.struckHold : 0);
    const pauseAt = closing.ask ? still + CLOSE.askAfter : null;
    const diveFrom = still + (closing.ask ? CLOSE.askLead : 0);
    return { schedule, written, choice, contact, diveFrom, pauseAt, total: diveFrom + CLOSE.end };
  }, [closing]);

  useEffect(() => {
    if (process.env.EXPO_OS === 'web') return;
    const timer = setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, ms(ringTo));
    return () => clearTimeout(timer);
  }, [ms, ringTo]);
  // Asked, the page holds still from the question to the answer; the timeline is then
  // as far on as it had run, and the dive takes up from there.
  const [asking, setAsking] = useState(false);
  const questionRef = useRef<ViewInstance | null>(null);
  useEffect(() => {
    if (!asking) return;
    const timer = setTimeout(() => {
      if (Platform.OS === 'web') questionRef.current?.focus();
      else {
        const node = findNodeHandle(questionRef.current);
        if (node) AccessibilityInfo.setAccessibilityFocus(node);
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [asking]);
  const [answer, setAnswer] = useState<boolean | null>(null);
  // Persistence has already completed when this modal mounts. Reading the page
  // must not depend on the optional naming/pen/dive sequence or a network result.
  const openDream = useCallback(() => {
    if (finished.current) return;
    const text = closing?.text ?? name ?? provisionalName;
    const provisional = closing?.provisional ?? !name;
    named.current(text, provisional, closing ? closing.mark : (name ? mark : null));
    finish(answer === true);
  }, [answer, closing, finish, mark, name, provisionalName]);

  const startedAt = useRef(0);
  const heldAt = useRef(0);
  useEffect(() => {
    if (!closing || !close) return;
    named.current(closing.text, closing.provisional, closing.mark);
    startedAt.current = Date.now();
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (close.pauseAt !== null) {
      timers.push(setTimeout(() => {
        heldAt.current = Date.now() - startedAt.current;
        setAsking(true);
      }, ms(close.pauseAt)));
    }
    if (closing.mark && process.env.EXPO_OS !== 'web') {
      timers.push(setTimeout(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
      }, ms(close.contact)));
    }
    return () => timers.forEach(clearTimeout);
    // The name and its beats are fixed once the pen starts writing, so this runs once.
  }, [close, closing, ms]);
  useEffect(() => {
    if (!close || (close.pauseAt !== null && answer === null)) return;
    const ran = close.pauseAt !== null ? heldAt.current : 0;
    const read = answer === true;
    const timers = [setTimeout(() => finish(read), Math.max(0, ms(close.total) - ran))];
    if (process.env.EXPO_OS !== 'web') {
      timers.push(setTimeout(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
      }, Math.max(0, ms(close.diveFrom + (CLOSE.skyIn[0] + CLOSE.skyIn[1]) / 2) - ran)));
    }
    return () => timers.forEach(clearTimeout);
  }, [answer, close, finish, ms]);
  const answerReading = useCallback((read: boolean) => {
    if (process.env.EXPO_OS !== 'web') void Haptics.selectionAsync().catch(() => {});
    setAsking(false);
    setAnswer(read);
  }, []);
  const playing = { animationPlayState: asking ? 'paused' : 'running' } as const;

  // The pen, placed by its nib at a point on the screen.
  const nibAt = useCallback((opacity: number, x: number, y: number, away = 0, glide = false) => {
    const frame: CSSAnimationKeyframes<ViewStyle>[string] = {
      opacity,
      transform: [
        { translateX: x - origin.x - NIB.x * pen + away },
        { translateY: y - origin.y - NIB.y * pen - away },
      ],
    };
    // React Native's ViewStyle declares a string `animationTimingFunction`, which narrows the
    // keyframe block's type; Reanimated reads the curve object at run time.
    return glide ? ({ ...frame, animationTimingFunction: DREAM_EASE } as unknown as typeof frame) : frame;
  }, [origin.x, origin.y, pen]);
  // Where the name's lines run on the journal page, on the screen.
  const nameStart = { x: book.x, y: book.y + small * nameStyle.lineHeight * 0.8 };
  const dive = useCallback((scale: number) => ({
    transform: [
      { translateX: -(scale - 1) * (ring.x - centre.x) },
      { translateY: -(scale - 1) * (ring.y - centre.y) },
      { scale },
    ],
  }), [centre.x, centre.y, ring.x, ring.y]);
  const onTheBook = useMemo(() => ({
    transform: [{ translateX: book.x - target.left }, { translateY: book.y - target.top }, { scale: small }],
  }), [book.x, book.y, small, target.left, target.top]);

  // The first act: night, the journal, the previous page turned, the view closer, the ring, the pen waiting.
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
    const ringTop = { x: width / 2, y: medallionY - push * ring.r };
    const pen: CSSAnimationKeyframes<ViewStyle> = {
      '0%': nibAt(0, ringTop.x, ringTop.y, 30),
      [at(pushEnd - OPEN.penLead)]: nibAt(0, ringTop.x, ringTop.y, 30, true),
      [at(ringFrom)]: nibAt(1, ringTop.x, ringTop.y),
    };
    for (let stroke = 1; stroke <= RING_STROKES; stroke += 1) {
      const radians = ((stroke / RING_STROKES) * 360 - 90) * (Math.PI / 180);
      pen[at(ringFrom + (OPEN.ring * stroke) / RING_STROKES)] = nibAt(
        1, width / 2 + push * ring.r * Math.cos(radians), medallionY + push * ring.r * Math.sin(radians), 0,
        stroke === RING_STROKES
      );
    }
    pen['100%'] = nibAt(1, nameStart.x, nameStart.y);
    const entering = { opacity: 0, transform: [{ translateX: 0 }, { translateY: 8 }, { scale: 0.985 }] };

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
      // The journal comes in, then the view comes closer around the ring once the page has turned.
      journal: animate<ViewStyle>({
        '0%': entering,
        [at(OPEN.journalIn * 0.25)]: entering,
        [at(OPEN.journalIn)]: { opacity: 1, ...dive(1) },
        [at(turnEnd)]: { opacity: 1, ...dive(1) },
        [at(pushEnd)]: { opacity: 1, ...dive(push) },
        '100%': { opacity: 1, ...dive(push) },
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
  }, [dive, framed.translateX, framed.translateY, medallionY, ms, nameStart.x, nameStart.y, nibAt, openTotal, push,
    pushEnd, ring.r, ringFrom, ringTo, turnEnd, width]);

  // While the pre-analysis is awaited, the pen hovers where the name will start.
  const hovering = useMemo(() => ({
    animationName: {
      from: nibAt(1, nameStart.x, nameStart.y),
      to: nibAt(1, nameStart.x + 1.5, nameStart.y - 3),
    },
    animationDuration: 760,
    animationIterationCount: 'infinite',
    animationDirection: 'alternate',
    animationTimingFunction: 'ease-in-out',
  }) as CSSStyle<ViewStyle>, [nameStart.x, nameStart.y, nibAt]);

  // The last act: the name written and dated, the pen away, the dive, the name in its place, the night in the ring.
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
    const diving = (value: number) => close.diveFrom + value;
    const fade = (from: number, to: number, start = 0, end = 1): CSSAnimationKeyframes<ViewStyle> => ({
      '0%': { opacity: start }, [at(from)]: { opacity: start }, [at(to)]: { opacity: end }, '100%': { opacity: end },
    });

    const zoomFrames: CSSAnimationKeyframes<ViewStyle> = { '0%': { opacity: 1, ...dive(push) } };
    const steps = 10;
    for (let step = 0; step <= steps; step += 1) {
      const scale = push * (zoom / push) ** smoothstep(step / steps);
      // Each step is already eased, so the steps join linearly.
      zoomFrames[at(diving((CLOSE.dive * step) / steps))] = { opacity: 1, ...dive(scale), animationTimingFunction: 'linear' };
    }
    zoomFrames['100%'] = zoomFrames[at(diving(CLOSE.dive))];

    const row = (index: number) => nameStart.y + small * index * nameStyle.lineHeight;
    const pen: CSSAnimationKeyframes<ViewStyle> = { '0%': nibAt(1, nameStart.x, nameStart.y) };
    close.schedule.forEach((line, index) => {
      const lineWidth = closing.widths[index] * small;
      const strokes = Math.max(4, Math.round((line.to - line.from) / 77));
      pen[at(line.from)] = nibAt(1, nameStart.x, row(index));
      for (let stroke = 1; stroke < strokes; stroke += 1) {
        // A writing hand never runs on a rail: the nib rises and dips along the line.
        const wobble = (stroke % 2 ? -1 : 1) * BOOK_NAME_SIZE * 0.06;
        pen[at(line.from + ((line.to - line.from) * stroke) / strokes)] =
          nibAt(1, nameStart.x + (lineWidth * stroke) / strokes, row(index) + wobble);
      }
      pen[at(line.to)] = nibAt(1, nameStart.x + lineWidth, row(index), 0, true);
    });
    const last = closing.widths.length - 1;
    const lifted = nibAt(0, nameStart.x + closing.widths[last] * small, row(last), 30);
    pen[at(close.written + CLOSE.penAway)] = lifted;
    pen['100%'] = lifted;

    // The struck seal is laid out at the saved moment's size and scaled with the page, so
    // it stays on the ring through the dive and arrives crisp at its own size.
    const sealScale: CSSAnimationKeyframes<ViewStyle> = { '0%': { transform: [{ scale: onTheJournal }] } };
    for (let step = 0; step <= steps; step += 1) {
      const scale = push * (zoom / push) ** smoothstep(step / steps);
      sealScale[at(diving((CLOSE.dive * step) / steps))] = { transform: [{ scale: scale / zoom }], animationTimingFunction: 'linear' };
    }
    sealScale['100%'] = { transform: [{ scale: 1 }] };
    const cut = close.total * 0.004;
    const night = [diving(CLOSE.skyIn[0]), diving(CLOSE.skyIn[1])] as const;

    return {
      seal: animate<ViewStyle>(sealScale),
      // The sign meets the ring and is pressed into it.
      struck: animate<ViewStyle>({
        '0%': { opacity: 0, transform: [{ scale: 1.1 }] },
        [at(close.contact)]: { opacity: 0, transform: [{ scale: 1.1 }] },
        [at(close.contact + cut)]: { opacity: 1, transform: [{ scale: 1.1 }] },
        [at(close.contact + 130)]: { opacity: 1, transform: [{ scale: 0.94 }] },
        [at(close.contact + 380)]: { opacity: 1, transform: [{ scale: 1 }] },
        '100%': { opacity: 1, transform: [{ scale: 1 }] },
      }, { animationTimingFunction: EASE.out }),
      // In ink on the page's paper, in gold once the night fills the ring.
      struckInk: animate<ViewStyle>(fade(night[0], night[1], 1, 0)),
      struckGold: animate<ViewStyle>(fade(night[0], night[1])),
      ripple: animate<ViewStyle>({
        '0%': { opacity: 0, transform: [{ scale: 1 }] },
        [at(close.contact)]: { opacity: 0, transform: [{ scale: 1 }] },
        [at(close.contact + cut)]: { opacity: 0.6, transform: [{ scale: 1 }] },
        [at(close.contact + 720)]: { opacity: 0, transform: [{ scale: 1.24 }] },
        '100%': { opacity: 0, transform: [{ scale: 1.24 }] },
      }, { animationTimingFunction: EASE.out }),
      // The night dims a little under the emblem, as on the saved moment.
      wash: animate<ViewStyle>(fade(night[0], night[1], 0, 0.32)),
      sky: animate<ViewStyle>({
        '0%': { opacity: 1, transform: [{ scale: 1 }] },
        [at(diving(0))]: { opacity: 1, transform: [{ scale: 1 }] },
        [at(diving(CLOSE.dive))]: { opacity: 0, transform: [{ scale: 1.35 }] },
        '100%': { opacity: 0, transform: [{ scale: 1.35 }] },
      }),
      journal: animate<ViewStyle>(zoomFrames),
      lamp: animate<ViewStyle>({ '0%': { opacity: 0.52 }, [at(diving(260))]: { opacity: 0 }, '100%': { opacity: 0 } }),
      pen: { ...animate<ViewStyle>(pen), animationTimingFunction: 'linear' } as CSSStyle<ViewStyle>,
      masks: close.schedule.map((line, index) => animate<ViewStyle>({
        '0%': { width: 0 },
        [at(line.from)]: { width: 0 },
        [at(line.to)]: { width: closing.widths[index] },
        '100%': { width: closing.widths[index] },
      }, { animationTimingFunction: 'linear' })),
      // The name leaves the journal page for its place on the dream page.
      rise: animate<ViewStyle>({
        '0%': onTheBook,
        [at(diving(0))]: onTheBook,
        [at(diving(CLOSE.dive))]: { transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] },
        '100%': { transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] },
      }),
      pageCover: animate<ViewStyle>(fade(diving(CLOSE.pageCover[0]), diving(CLOSE.pageCover[1]))),
      grain: animate<ViewStyle>(fade(diving(CLOSE.grainIn[0]), diving(CLOSE.grainIn[1]))),
      drawnRing: animate<ViewStyle>(fade(diving(CLOSE.ringSettles[0]), diving(CLOSE.ringSettles[1]), 1, 0)),
      ring: animate<ViewStyle>(fade(diving(CLOSE.ringSettles[0]), diving(CLOSE.ringSettles[1]))),
      skyFill: animate<ViewStyle>({
        '0%': { opacity: 0, transform: [{ scale: 1.08 }] },
        [at(diving(CLOSE.skyIn[0]))]: { opacity: 0, transform: [{ scale: 1.08 }] },
        [at(diving(CLOSE.skyIn[1]))]: { opacity: 1, transform: [{ scale: 1 }] },
        '100%': { opacity: 1, transform: [{ scale: 1 }] },
      }),
      halo: animate<ViewStyle>({
        '0%': { opacity: 0, transform: [{ scale: 0.8 }] },
        [at(diving(CLOSE.skyIn[0]))]: { opacity: 0, transform: [{ scale: 0.8 }] },
        [at(diving((CLOSE.skyIn[0] + CLOSE.skyIn[1]) / 2))]: { opacity: 0.9, transform: [{ scale: 1.05 }] },
        '100%': { opacity: 0.45, transform: [{ scale: 1 }] },
      }),
    };
  }, [close, closing, dive, nameStart.x, nameStart.y, nameStyle.lineHeight, nibAt, ms, onTheBook, onTheJournal, push, small, zoom]);
  const sealBox = { left: width / 2 - SEAL_MEASURES.orbit / 2, top: medallionY - SEAL_MEASURES.orbit / 2 };
  const emblemBox = {
    position: 'absolute' as const,
    left: (SEAL_MEASURES.orbit - SEAL_MEASURES.emblem) / 2,
    top: (SEAL_MEASURES.orbit - SEAL_MEASURES.emblem) / 2,
    width: SEAL_MEASURES.emblem,
    height: SEAL_MEASURES.emblem,
  };

  const hidden = { opacity: 0 };
  const ringBox = ring.r * 2;
  const sheetFrame = { position: 'absolute' as const, left: 0, top: 0, width: page.w, height: page.h };
  const art = night ? NIGHT_JOURNAL : IVORY_JOURNAL;
  const penStyle = closingMotion?.pen ?? (opened ? hovering : opening.pen);
  const nameClass = 'font-display-semibold text-[26px] leading-8 text-ivory';
  const glintAt = { x: width / 2 - origin.x, y: medallionY - push * ring.r - origin.y };

  // The question, in the journal's ink on its page under the seal, at the reader's own size.
  const askTop = medallionY + signsReach + 12;
  const pageRight = width / 2 + push * (page.x + page.w - ring.x);
  const question = close?.pauseAt != null && (asking || answer !== null) ? (
    <Animated.View pointerEvents={asking ? 'box-none' : 'none'} className="absolute"
      style={[ABOVE_THE_SCREEN, { left: book.x, top: askTop, width: Math.max(180, pageRight - book.x - 12) },
        answer !== null ? ANSWERED : null] as StyleProp<ViewStyle>}>
      <Reveal distance={4}>
        <View ref={questionRef} accessible accessibilityRole="header" tabIndex={-1}>
          <Text allowFontScaling={false}
            style={{ fontFamily: Fonts.lora.regularItalic, fontSize: 13, lineHeight: 18, color: ink }}>
            {t('journal.seal.ask_reading')}
          </Text>
        </View>
        <View className="mt-2 flex-row items-center gap-6">
          {/* The answer that reads the dream is the one drawn as a button. */}
          <PressableScale onPress={() => answerReading(true)} disabled={!asking} testID="btn.dreamCaptureSeal.readNow"
            accessibilityRole="button" hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            className="min-h-[36px] flex-row items-center gap-1.5 rounded-full bg-champagne px-4">
            <Svg width={10} height={10}><Path d={sparklePath(5, 5, 5)} fill={noctalia.action.primaryText} /></Svg>
            <Text allowFontScaling={false} className="font-sans-bold text-[14px] leading-[18px] text-on-champagne">
              {t('journal.seal.read_now')}
            </Text>
          </PressableScale>
          <PressableScale onPress={() => answerReading(false)} disabled={!asking} testID="btn.dreamCaptureSeal.readLater"
            accessibilityRole="button" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text allowFontScaling={false} className="font-sans-medium text-[13px] leading-[18px] text-ivory-muted">
              {t('journal.seal.read_later')}
            </Text>
          </PressableScale>
        </View>
      </Reveal>
    </Animated.View>
  ) : null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent
      onRequestClose={openDream}>
    <View
      testID={TID.Component.DreamCaptureSeal}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      {...(Platform.OS === 'web' ? { 'aria-hidden': true, inert: true } : {})}
      className="absolute inset-0 items-center justify-center"
      style={ABOVE_THE_SCREEN}
    >
      <Animated.View className="absolute inset-0 bg-ink" style={opening.veil as StyleProp<ViewStyle>} />
      <Animated.View className="absolute inset-0" style={[closingMotion?.sky, playing] as StyleProp<ViewStyle>}>
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

      {/* The names laid out unseen, as the dream page lays them out, so the pen writes each line at its width. */}
      <View className="absolute left-0 top-0 opacity-0" style={{ width: target.width }}>
        {candidates.map((text) => (
          <Text key={text} allowFontScaling={false} className={`absolute left-0 top-0 ${nameClass}`}
            style={[nameStyle, { width: target.width }]}
            onLayout={(event) => onMeasureBlock(text, event)} onTextLayout={(event) => onMeasureLines(text, event)}>
            {text}
          </Text>
        ))}
      </View>

      <Animated.View className="absolute" style={[{ width: journalWidth, height: journalHeight }, opening.frame] as StyleProp<ViewStyle>}>
        <Animated.View className="absolute inset-0" style={[closingMotion?.journal ?? opening.journal, playing] as StyleProp<ViewStyle>}>
          <TallJournal source={art} width={journalWidth} artHeight={artHeight} />
          <Animated.View className="absolute" style={[{
            left: page.x - page.w * 0.4, top: page.y - page.h * 0.25, width: page.w * 1.8, height: page.h * 1.5,
          }, closingMotion?.lamp ?? opening.lamp, playing] as StyleProp<ViewStyle>}>
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
                <TallJournal source={art} width={journalWidth} artHeight={artHeight}
                  style={{ position: 'absolute', left: -page.x, top: -page.y }} />
                <Svg width={page.w} height={page.h} style={{ position: 'absolute', left: 0, top: 0 }}>
                  <Circle cx={ring.x - page.x} cy={ring.y - page.y} r={ring.r - 0.5} fill="none"
                    stroke={ink} strokeOpacity={0.3} strokeWidth={0.7} />
                </Svg>
                {[0.62, 0.4].map((share, index) => (
                  <View key={share} className="absolute rounded-full" style={{
                    left: page.w * 0.1, top: ring.y - page.y + ring.r + 8 + index * 9, width: page.w * share,
                    height: 5, backgroundColor: ink, opacity: 0.2,
                  }} />
                ))}
                {SKELETON_LINES.map((share, index) => (
                  <View key={index} className="absolute rounded-full" style={{
                    left: page.w * 0.1, top: ring.y - page.y + ring.r + 34 + index * 11, width: page.w * share,
                    height: 2, backgroundColor: ink, opacity: 0.14,
                  }} />
                ))}
              </Animated.View>
              <Animated.View className="overflow-hidden" style={[sheetFrame, opening.sheetBack] as StyleProp<ViewStyle>}>
                {/* Mirrored, so that once turned it lies over the left page as the left page itself. */}
                <View style={[sheetFrame, { transform: [{ scaleX: -1 }] }]}>
                  <TallJournal source={art} width={journalWidth} artHeight={artHeight}
                    style={{ position: 'absolute', left: -(page.x - page.w), top: -page.y }} />
                </View>
              </Animated.View>
              <Animated.View className="absolute inset-0 bg-black" style={opening.sheetShade as StyleProp<ViewStyle>} />
            </Animated.View>
          ) : null}

          {/* The page itself, which takes over from the art as it fills the screen. */}
          <Animated.View className="absolute bg-ink" style={[{ left: page.x, top: page.y, width: page.w, height: page.h },
            closingMotion?.pageCover ?? hidden, playing] as StyleProp<ViewStyle>} />
          <Animated.View className="absolute" style={[{ left: ring.x - ring.r, top: ring.y - ring.r, width: ringBox, height: ringBox },
            closingMotion?.drawnRing, playing] as StyleProp<ViewStyle>}>
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
          left: glintAt.x - 9, top: glintAt.y - 9, width: 18, height: 18,
        }, opening.glint] as StyleProp<ViewStyle>}>
          <Svg width={18} height={18}><Path d={sparklePath(9, 9, 9)} fill={ink} /></Svg>
        </Animated.View>
      </Animated.View>

      {/* The dream page's own grain, then its window: the ring settles crisp and fills with night. */}
      {/* Opaque, so it takes over from the journal above and below its page as well. */}
      <Animated.View className="absolute inset-0 bg-ink" style={[closingMotion?.grain ?? hidden, playing] as StyleProp<ViewStyle>}>
        <JournalPaper />
        <JournalPageEdges />
      </Animated.View>
      <Animated.View className="absolute" style={[{
        left: width / 2 - 170, top: medallionY - 140, width: 340, height: 280,
      }, closingMotion?.halo ?? hidden, playing] as StyleProp<ViewStyle>}>
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
      }, closingMotion?.skyFill ?? hidden, playing] as StyleProp<ViewStyle>}>
        <Image source={ASTRAL_ART} resizeMode="cover" style={{ width: MEDALLION, height: MEDALLION }} />
      </Animated.View>
      {closing?.mark && closingMotion ? (
        <Animated.View className="absolute rounded-full bg-black" style={[{
          left: width / 2 - MEDALLION / 2, top: medallionY - MEDALLION / 2, width: MEDALLION, height: MEDALLION,
        }, closingMotion.wash, playing] as StyleProp<ViewStyle>} />
      ) : null}
      <Animated.View className="absolute" style={[{
        left: width / 2 - MEDALLION / 2, top: medallionY - MEDALLION / 2, width: MEDALLION, height: MEDALLION,
      }, closingMotion?.ring ?? hidden, playing] as StyleProp<ViewStyle>}>
        <Svg width={MEDALLION} height={MEDALLION}>
          <Circle cx={MEDALLION / 2} cy={MEDALLION / 2} r={MEDALLION / 2 - 0.75} fill="none"
            stroke={ink} strokeOpacity={0.7} strokeWidth={1.5} />
        </Svg>
      </Animated.View>

      {/* The seal choosing while the name is written, then struck: it grows with the page into the saved moment. */}
      {closing && close && closingMotion ? (
        <Animated.View testID="component.dreamCaptureSeal.seal" className="absolute" style={[{
          left: sealBox.left, top: sealBox.top, width: SEAL_MEASURES.orbit, height: SEAL_MEASURES.orbit,
        }, closingMotion.seal, playing] as StyleProp<ViewStyle>}>
          <SealChoice mark={closing.mark} ink={ink} choice={ms(close.choice)} contact={ms(close.contact)} gold={false}
            sign={bookSign} orbit={bookOrbit} />
          <SealLegend text={date} side="bottom" reduced={false}
            from={ms(closing.mark ? close.contact + 240 : close.written + CLOSE.penAway)} />
          {closing.mark ? (
            <>
              <Animated.View className="absolute rounded-full" style={[{
                left: (SEAL_MEASURES.orbit - MEDALLION) / 2, top: (SEAL_MEASURES.orbit - MEDALLION) / 2,
                width: MEDALLION, height: MEDALLION, borderWidth: 1.5, borderColor: ink,
              }, closingMotion.ripple] as StyleProp<ViewStyle>} />
              <Animated.View style={[emblemBox, closingMotion.struck] as StyleProp<ViewStyle>}>
                <Animated.View className="absolute inset-0" style={[closingMotion.struckInk, playing] as StyleProp<ViewStyle>}>
                  <Image source={SEAL_EMBLEMS[closing.mark.theme]} tintColor={ink} resizeMode="contain"
                    style={{ width: SEAL_MEASURES.emblem, height: SEAL_MEASURES.emblem }} />
                </Animated.View>
                <Animated.View className="absolute inset-0" style={[closingMotion.struckGold, playing] as StyleProp<ViewStyle>}>
                  <Image source={SEAL_EMBLEMS[closing.mark.theme]} tintColor={SEAL_GOLD} resizeMode="contain"
                    style={{ width: SEAL_MEASURES.emblem, height: SEAL_MEASURES.emblem }} />
                </Animated.View>
              </Animated.View>
              <SealLegend text={closing.mark.legend} reduced={false} from={ms(close.contact)} />
            </>
          ) : null}
        </Animated.View>
      ) : null}

      {/* The name, written small on the journal page, rising to where the dream page sets it. */}
      {closing && closingMotion ? (
        <Animated.View testID="component.dreamCaptureSeal.name" className="absolute" style={[{
          left: target.left, top: target.top, width: target.width, transformOrigin: 'left top',
        }, closingMotion.rise, playing] as StyleProp<ViewStyle>}>
          <View style={{ height: closing.widths.length * nameStyle.lineHeight }}>
            {closing.widths.map((lineWidth, index) => (
              <Animated.View key={index} className="absolute overflow-hidden" style={[{
                left: 0, top: index * nameStyle.lineHeight, height: nameStyle.lineHeight,
              }, closingMotion.masks[index]] as StyleProp<ViewStyle>}>
                <Text allowFontScaling={false} className={nameClass}
                  style={[nameStyle, { position: 'absolute', left: 0, top: -index * nameStyle.lineHeight, width: target.width }]}>
                  {closing.text}
                </Text>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      ) : null}
    </View>
    {question}
    <View pointerEvents="box-none" className="absolute bottom-0 left-0 right-0 items-center px-6"
      style={[ABOVE_THE_SCREEN, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
      <PressableScale onPress={openDream} testID="btn.dreamCaptureSeal.openDream" accessibilityRole="button"
        className="min-h-[48px] items-center justify-center rounded-full border border-line bg-ink px-6 py-3">
        <Text className="text-center font-sans-medium text-[15px] text-ivory">{t('journal.seal.open_dream')}</Text>
      </PressableScale>
    </View>
    </Modal>
  );
}
