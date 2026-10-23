import * as Haptics from 'expo-haptics';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing, Extrapolation, interpolate, useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence,
  withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { JournalPageEdges } from '@/components/journal/JournalPageEdges';
import { JournalPagePreview } from '@/components/journal/JournalPagePreview';
import { JournalPaper } from '@/components/journal/JournalPaper';
import { PageTurnsContext } from '@/components/journal/journalPageTurns';
import { JournalTonightPage } from '@/components/journal/JournalTonightPage';
import { useJournalSpread } from '@/components/journal/useJournalSpread';
import { EASING } from '@/components/motion/motion';
import type { JournalSpread } from '@/constants/layout';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useContentWindow } from '@/context/ContentWindowContext';
import { useTheme } from '@/context/ThemeContext';
import { scheduleIdleTask } from '@/lib/scheduleIdleTask';
import type { DreamAnalysis } from '@/lib/types';

/** Turning to a later page lifts this one over the binding; an earlier page comes back over it. */
const FORWARD = -1;
const BACKWARD = 1;
/** How far the page has turned when it is let go, past which it finishes turning. */
const COMMIT = 0.35;
/** The binding's own gesture: the system back swipe starts here, so turning starts past it. */
const BINDING = 28;
/**
 * Once turned to, the dream page takes over from its likeness: only when it has laid
 * itself out (or, failing that, after a while), and by a crossfade, so nothing jumps.
 */
const SETTLE_MS = 240;
const SETTLE_AT_LATEST = 900;
/** While the turned-to page settles in over (forward) or under (back) its likeness. */
const IDLE = 0;
const SETTLING_FORWARD = 1;
const SETTLING_BACK = 2;
/** The depth from which the turning page is seen, and how far it turns from lying flat to over. */
const PERSPECTIVE = 1600;
const TURN_DEGREES = 92;
/**
 * Each dream page opened arrives still lifted a little off the next one and falls shut on
 * it as a page does: slowly at first, then faster, landing with a slight rebound. The
 * journal can be leafed through. Pages turned to on the same screen do not fall again.
 */
const HINT_LIFT = 0.18;
const HINT_HOLD = 220;
const HINT_FALL = 560;
const HINT_REBOUND = 0.02;
const HINT_REBOUND_RISE = 150;
const HINT_REBOUND_FALL = 220;
/**
 * On two facing pages the right-hand page turns about the binding and nothing covers the
 * page beneath it: arriving, it lifts only enough to show the paper's edge underneath.
 */
const HINT_LIFT_SPREAD = 0.06;
/** A leaf of two facing pages stands on edge half way through its turn, then lies down on the other side. */
const ON_EDGE = 0.5;
/**
 * Lifted as little as on its arrival, the page still covers the one beneath it whole (it
 * comes towards the reader), so the pages either side need not be drawn with it: they are
 * drawn once it has come in and fallen shut, or at the first touch. Until they are, a turn
 * lifts the page no further than it still covers them, and a page let go to turn waits
 * there, lifted, for the page it turns to (at most a while), then turns.
 */
const LIKENESSES_AFTER = HINT_HOLD + HINT_FALL + HINT_REBOUND_RISE + HINT_REBOUND_FALL;

/** Let go, the page falls shut as under its own weight, landing with a slight rebound. */
function fallingShut(direction: SharedValue<number>) {
  'worklet';
  return [
    withTiming(0, { duration: HINT_FALL, easing: Easing.in(Easing.quad) }),
    withTiming(HINT_REBOUND, { duration: HINT_REBOUND_RISE, easing: EASING.out }),
    withTiming(0, { duration: HINT_REBOUND_FALL, easing: EASING.inOut }, (done) => {
      if (done) direction.set(0);
    }),
  ] as const;
}

/** How far a leaf of two facing pages has turned `way` (0 unless it is turning that way). */
function leafTurn(phase: number, direction: number, progress: number, way: number) {
  'worklet';
  return phase === IDLE && direction === way ? progress : 0;
}

/** Whether the page beneath a leaf turning `way` shows: while it turns, and until the page turned to has faded in. */
function leafBeneath(phase: number, direction: number, way: number) {
  'worklet';
  return direction === way && (phase === IDLE || phase === SETTLING_FORWARD) ? 1 : 0;
}

/** The other side of a leaf turning `way`: hidden until the leaf stands on edge, then lying down at the binding. */
function overleaf(phase: number, direction: number, progress: number, settle: number, way: number) {
  'worklet';
  const sign = way === FORWARD ? 1 : -1;
  if (direction !== way || (phase !== IDLE && phase !== SETTLING_FORWARD)) {
    return { opacity: 0, transform: [{ perspective: PERSPECTIVE }, { rotateY: `${sign * 90}deg` }] };
  }
  if (phase === SETTLING_FORWARD) {
    return { opacity: 1 - settle, transform: [{ perspective: PERSPECTIVE }, { rotateY: '0deg' }] };
  }
  return {
    opacity: progress >= ON_EDGE ? 1 : 0,
    transform: [{ perspective: PERSPECTIVE }, { rotateY: `${sign * 180 * (1 - Math.max(progress, ON_EDGE))}deg` }],
  };
}

/** How far a page this wide turns (as a turn's progress) before what lies beneath shows past its edge. */
function coveringTurn(width: number) {
  return (2 * Math.atan(width / PERSPECTIVE) * 180) / Math.PI / TURN_DEGREES;
}

const PageTurnLockContext = createContext<(locked: boolean) => void>(() => {});
/** The turn in progress, which each of two facing pages follows. */
const SpreadTurnContext = createContext<{
  phase: SharedValue<number>;
  direction: SharedValue<number>;
  progress: SharedValue<number>;
} | null>(null);

/** The halves of two facing pages, each turning about the binding between them. */
function spreadHalf(side: 'left' | 'right', spread: JournalSpread) {
  return side === 'left'
    ? { position: 'absolute' as const, top: 0, bottom: 0, left: 0, width: spread.spine, overflow: 'hidden' as const, transformOrigin: 'right center' }
    : { position: 'absolute' as const, top: 0, bottom: 0, left: spread.spine, right: 0, overflow: 'hidden' as const, transformOrigin: 'left center' };
}

/**
 * One of a dream's two facing pages, on its own paper, with its edges: the crease at the
 * binding and the block of leaves at its outer side. The page turner turns it about the
 * binding (the right-hand page towards a later dream, the left-hand page back to an earlier
 * one). Without a `spread` it is the single page itself, laid out as before. It is the same
 * view either way, so folding or unfolding the device keeps what the page holds.
 */
export function JournalSpreadLeaf({ side, spread, edges = true, children }: {
  side: 'left' | 'right';
  spread: JournalSpread | null;
  /** The page's edges, which an editor laid over the page hides. */
  edges?: boolean;
  children: React.ReactNode;
}) {
  const turn = useContext(SpreadTurnContext);
  const still = useSharedValue(0);
  const turns = Boolean(spread && turn);
  const phase = spread && turn ? turn.phase : still;
  const direction = spread && turn ? turn.direction : still;
  const progress = spread && turn ? turn.progress : still;
  const { colors, mode } = useTheme();
  const shadow = useMemo(() => getNoctaliaDesignTokens(colors, mode).surface.overlay, [colors, mode]);
  // The right-hand leaf turns over towards a later dream, the left-hand one back to an earlier one;
  // each lies under the other as it comes over. A leaf lifts towards the reader from the binding.
  const over = side === 'right' ? FORWARD : BACKWARD;
  const under = side === 'right' ? BACKWARD : FORWARD;
  const lift = side === 'right' ? -180 : 180;
  const leaf = useAnimatedStyle(() => {
    const turned = leafTurn(phase.get(), direction.get(), progress.get(), over);
    return {
      opacity: turned < ON_EDGE ? 1 : 0,
      transform: [{ perspective: PERSPECTIVE }, { rotateY: `${lift * Math.min(turned, ON_EDGE)}deg` }],
    };
  });
  // It darkens as it stands on edge, and as the leaf coming over casts its shadow on it.
  const shade = useAnimatedStyle(() => ({
    opacity: Math.max(
      interpolate(leafTurn(phase.get(), direction.get(), progress.get(), over), [0, ON_EDGE], [0, 0.45], Extrapolation.CLAMP),
      interpolate(leafTurn(phase.get(), direction.get(), progress.get(), under), [ON_EDGE, 1], [0, 0.35], Extrapolation.CLAMP)),
  }));
  return (
    <Animated.View collapsable={false} style={[spread ? spreadHalf(side, spread) : styles.page, turns ? leaf : null]}>
      {spread ? (
        <View pointerEvents="none" className="absolute inset-0 bg-ink">
          <JournalPaper />
        </View>
      ) : null}
      {children}
      {spread && edges ? <JournalPageEdges side={side} /> : null}
      {turns ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: shadow }, shade]} /> : null}
    </Animated.View>
  );
}
const PageArrivalContext = createContext<{ laidOut: () => void; arriving: () => boolean }>({
  laidOut: () => {},
  arriving: () => false,
});

/** The dream page says it has laid itself out, so a page just turned to can take over. */
export function useJournalPageLaidOut(): () => void {
  return useContext(PageArrivalContext).laidOut;
}

/**
 * Whether this dream page is being turned to: its likeness already shows it whole, so it
 * shows its own pictures at once instead of letting them fade in.
 */
export function useJournalPageTurnedTo(): boolean {
  const { arriving } = useContext(PageArrivalContext);
  const [turnedTo] = useState(arriving);
  return turnedTo;
}

/** While a page is being written in, it cannot be turned. */
export function useJournalPageTurnLock(locked: boolean) {
  const setLocked = useContext(PageTurnLockContext);
  useEffect(() => {
    setLocked(locked);
    return () => setLocked(false);
  }, [locked, setLocked]);
}

/**
 * The dream page as a page of the journal that can be leafed through. A horizontal drag
 * turns it around the binding on its left: towards the left it lifts and turns over,
 * revealing the next, later dream beneath it; towards the right the earlier dream's page
 * comes back over it. Let go past a third of the way, or with a flick, the page finishes
 * turning and the real page takes the place of its likeness; otherwise it falls back.
 * After the last dream lies tonight's page, still blank: the last dream's page turns over
 * onto it and stays turned, and turning back brings it down again. Without a page on one
 * side it only lifts a little. Vertical scrolling and the system back swipe at the binding
 * stay as they are; under reduce motion the page changes at once.
 */
export function JournalPageTurner({ dream, newer, older, folio, tonight = false, hint = true, opensOnLikeness = false, onTurn, children }: {
  /** This page's dream. */
  dream: DreamAnalysis;
  /** The dream after this one, turned to towards the left. */
  newer: DreamAnalysis | null;
  /** The dream before this one, turned back to towards the right. */
  older: DreamAnalysis | null;
  /** This page's number, from which the pages either side take theirs. */
  folio?: number;
  /** After the last dream, tonight's blank page can be turned to. */
  tonight?: boolean;
  /** The page may show on arrival that it can be turned (not under the capture seal's own arrival). */
  hint?: boolean;
  /**
   * Opened as it lies in the journal, the page shows its likeness at once and is laid out
   * beneath it a moment later, then takes its place as a page turned to does.
   */
  opensOnLikeness?: boolean;
  onTurn: (dream: DreamAnalysis) => void;
  children: React.ReactNode;
}) {
  const { width, height } = useContentWindow();
  // Two facing pages turn their leaves about the binding instead of the page about its left edge.
  const spread = useJournalSpread();
  const spreadOpen = spread !== null;
  const [pageHeight, setPageHeight] = useState(height);
  // The page's own width, narrower than the window beside the desktop sidebar.
  const [pageWidth, setPageWidth] = useState(width);
  const reduced = useReducedMotion();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const shadow = noctalia.surface.overlay;
  const [locked, setLocked] = useState(false);
  const lockedNow = useRef(locked);
  useEffect(() => { lockedNow.current = locked; }, [locked]);
  // The likenesses stay those of the turn in progress until the turned-to page has settled.
  const [frozen, setFrozen] = useState<{ newer: DreamAnalysis | null; older: DreamAnalysis | null; folio?: number } | null>(null);
  const shown = frozen ?? { newer, older, folio };
  // Arriving from the capture seal, the page keeps its likenesses from the start: its own
  // arrival is choreographed and is not held up by them. Under reduce motion a page turns
  // at once and its likenesses never show.
  const [likenesses, setLikenesses] = useState(!hint && !reduced);
  const drawLikenesses = useCallback(() => setLikenesses(true), []);
  const likenessesDrawn = useSharedValue(false);
  const likenessLaidOut = useCallback(() => likenessesDrawn.set(true), [likenessesDrawn]);
  useEffect(() => {
    if (likenesses || reduced) return;
    let task: { cancel: () => void } | undefined;
    const timer = setTimeout(() => { task = scheduleIdleTask(drawLikenesses); }, LIKENESSES_AFTER);
    return () => {
      clearTimeout(timer);
      task?.cancel();
    };
  }, [drawLikenesses, likenesses, reduced]);

  const direction = useSharedValue(0);
  const progress = useSharedValue(0);
  const settle = useSharedValue(1);
  const phase = useSharedValue(IDLE);
  // The turn let go before the page that way was drawn, waiting for it (0: none).
  const held = useSharedValue(0);
  const heldTimer = useSharedValue<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    const timer = heldTimer.get();
    if (timer) clearTimeout(timer);
  }, [heldTimer]);
  // The turn waiting for its page to lay itself out before that page takes over (0: none).
  const awaiting = useSharedValue(0);
  const awaitTimer = useSharedValue<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    const timer = awaitTimer.get();
    if (timer) clearTimeout(timer);
  }, [awaitTimer]);
  // On tonight's page: the last dream's page lies turned over, and turns back from there.
  const [atTonight, setAtTonight] = useState(false);
  const turnedOver = useSharedValue(false);
  const reachTonight = useCallback(() => {
    void Haptics.selectionAsync().catch(() => {});
    setAtTonight(true);
  }, []);
  const leaveTonight = useCallback(() => {
    void Haptics.selectionAsync().catch(() => {});
    setAtTonight(false);
  }, []);

  const settled = useCallback(() => setFrozen(null), []);

  // Opening on its likeness, the page is laid out two frames on, once the likeness is on screen.
  const [opening, setOpening] = useState(opensOnLikeness);
  const [pageDrawn, setPageDrawn] = useState(!opensOnLikeness);
  const openingNow = useSharedValue(opensOnLikeness);
  const likenessShown = useSharedValue(1);
  // Opening so, the page arriving is held lifted (see the hint below) until it has taken its
  // place, then falls shut: its fall is not drawn while the page is laid out beneath.
  const hintWaits = useSharedValue(false);
  // Read where it was written: from here, a hint held a moment ago may not read as held yet.
  const releaseHint = useCallback(() => scheduleOnUI(() => {
    'worklet';
    if (!hintWaits.get()) return;
    hintWaits.set(false);
    progress.set(withSequence(...fallingShut(direction)));
  }), [direction, hintWaits, progress]);
  const opened = useCallback(() => setOpening(false), []);
  const openPage = useCallback(() => {
    if (!openingNow.get()) return;
    openingNow.set(false);
    likenessShown.set(withTiming(0, { duration: reduced ? 0 : SETTLE_MS, easing: EASING.out }, (done) => {
      if (done) scheduleOnRN(opened);
    }));
    releaseHint();
  }, [likenessShown, opened, openingNow, reduced, releaseHint]);
  // A page turned meanwhile leaves its likeness at once.
  const endOpening = useCallback(() => {
    if (!openingNow.get()) return;
    openingNow.set(false);
    likenessShown.set(0);
    setPageDrawn(true);
    setOpening(false);
    releaseHint();
  }, [likenessShown, openingNow, releaseHint]);
  useEffect(() => {
    if (!opensOnLikeness) return;
    let live = true;
    // A screen reader is given the page itself at once, not a picture of it.
    AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (live && on) endOpening();
    }).catch(() => {});
    return () => { live = false; };
  }, [endOpening, opensOnLikeness]);
  useEffect(() => {
    if (pageDrawn) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setPageDrawn(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [pageDrawn]);
  useEffect(() => {
    if (!pageDrawn) return;
    // Its picture slow to come, the page takes over all the same: it holds its card's painting.
    const timer = setTimeout(openPage, SETTLE_AT_LATEST);
    return () => clearTimeout(timer);
  }, [openPage, pageDrawn]);

  // The page turned to fades in over its likeness (forward), or its likeness fades off it (back).
  const settleIn = useCallback((turnedTo: number) => {
    awaiting.set(0);
    const timer = awaitTimer.get();
    if (timer) clearTimeout(timer);
    awaitTimer.set(null);
    // Two facing pages turned either way show the pages turned to as likenesses over which the
    // dream page, set back flat but unseen, fades in, as a single page turned forward does.
    settle.set(withTiming(spreadOpen || turnedTo === FORWARD ? 1 : 0, { duration: SETTLE_MS, easing: EASING.out }, (done) => {
      if (!done) return;
      phase.set(IDLE);
      direction.set(0);
      progress.set(0);
      settle.set(1);
      scheduleOnRN(settled);
    }));
  }, [awaitTimer, awaiting, direction, phase, progress, settle, settled, spreadOpen]);

  // Two frames on, the page laid out is painted too before it is let in.
  const pageLaidOut = useCallback(() => {
    if (openingNow.get()) requestAnimationFrame(() => requestAnimationFrame(openPage));
    const turnedTo = awaiting.get();
    if (turnedTo === 0) return;
    awaiting.set(0);
    requestAnimationFrame(() => requestAnimationFrame(() => settleIn(turnedTo)));
  }, [awaiting, openPage, openingNow, settleIn]);
  const arriving = useCallback(() => openingNow.get() || awaiting.get() !== 0, [awaiting, openingNow]);
  const arrival = useMemo(() => ({ laidOut: pageLaidOut, arriving }), [arriving, pageLaidOut]);

  const finishTurn = useCallback((turnedTo: number) => {
    endOpening();
    if (turnedTo === FORWARD && !shown.newer) {
      reachTonight();
      return;
    }
    const target = turnedTo === FORWARD ? shown.newer : shown.older;
    if (!target) return;
    setFrozen({ newer: shown.newer, older: shown.older, folio: shown.folio });
    void Haptics.selectionAsync().catch(() => {});
    // The likeness holds the place while the page turned to lays itself out: forward, the
    // turned page is set back flat but unseen over it; back, the likeness stays on top. Two
    // facing pages hold the turned leaf where it lies, and set their dream page back unseen.
    if (spreadOpen) {
      settle.set(0);
      phase.set(SETTLING_FORWARD);
    } else if (turnedTo === FORWARD) {
      settle.set(0);
      progress.set(0);
      phase.set(SETTLING_FORWARD);
    } else {
      settle.set(1);
      phase.set(SETTLING_BACK);
    }
    awaiting.set(turnedTo);
    awaitTimer.set(setTimeout(() => {
      if (awaiting.get() !== 0) settleIn(awaiting.get());
    }, SETTLE_AT_LATEST));
    onTurn(target);
  }, [awaitTimer, awaiting, endOpening, onTurn, phase, progress, reachTonight, settle, settleIn, shown.folio, shown.newer, shown.older,
    spreadOpen]);

  const turnAtOnce = useCallback((turnedTo: number) => {
    endOpening();
    if (turnedTo === FORWARD && !shown.newer && tonight) {
      direction.set(FORWARD);
      progress.set(1);
      turnedOver.set(true);
      reachTonight();
      return;
    }
    const target = turnedTo === FORWARD ? shown.newer : shown.older;
    if (!target) return;
    void Haptics.selectionAsync().catch(() => {});
    onTurn(target);
  }, [direction, endOpening, onTurn, progress, reachTonight, shown.newer, shown.older, tonight, turnedOver]);

  // A page let go to turn before the page that way was drawn turns once it is, from where it waits.
  useAnimatedReaction(() => (likenessesDrawn.get() ? held.get() : 0), (turnedTo) => {
    if (turnedTo === 0) return;
    held.set(0);
    progress.set(withTiming(1, { duration: 260 * (1 - progress.get()) + 90, easing: EASING.inOut }, (done) => {
      if (done) scheduleOnRN(finishTurn, turnedTo);
    }));
  }, [finishTurn]);
  // Should that page not come, the waiting page falls back.
  const holdAtMost = useCallback(() => {
    const timer = heldTimer.get();
    if (timer) clearTimeout(timer);
    heldTimer.set(setTimeout(() => {
      heldTimer.set(null);
      if (held.get() === 0) return;
      held.set(0);
      progress.set(withSpring(0, { duration: 320, dampingRatio: 0.85 }, (done) => {
        if (done) direction.set(0);
      }));
    }, SETTLE_AT_LATEST));
  }, [direction, held, heldTimer, progress]);

  // The controls at a page's foot share the same targets as swipes. A discrete action
  // changes page at once.
  const navigatePage = useCallback((turnedTo: number) => {
    if (lockedNow.current || phase.get() !== IDLE || held.get() !== 0) return;
    hintWaits.set(false);
    if (atTonight) {
      if (turnedTo !== BACKWARD) return;
      turnedOver.set(false);
      progress.set(0);
      direction.set(0);
      leaveTonight();
      return;
    }
    direction.set(0);
    progress.set(0);
    turnAtOnce(turnedTo);
  }, [atTonight, direction, held, hintWaits, leaveTonight, phase, progress, turnAtOnce, turnedOver]);

  // The hint: arriving, the page falls shut over the next one, once per opening.
  const hinted = useRef(false);
  useEffect(() => {
    if (!hint || reduced || hinted.current || (!newer && !tonight)) return;
    if (lockedNow.current || direction.get() !== 0 || turnedOver.get()) return;
    hinted.current = true;
    direction.set(FORWARD);
    const lift = spreadOpen ? HINT_LIFT_SPREAD : HINT_LIFT;
    if (openingNow.get()) {
      progress.set(lift);
      hintWaits.set(true);
      return;
    }
    progress.set(withSequence(
      withTiming(lift, { duration: 0 }),
      // Held while the screen comes in, then let go.
      withTiming(lift, { duration: HINT_HOLD }),
      ...fallingShut(direction),
    ));
  }, [direction, hint, hintWaits, newer, openingNow, progress, reduced, spreadOpen, tonight, turnedOver]);

  const hasLaterDream = shown.newer != null;
  const hasNewer = hasLaterDream || tonight;
  const hasOlder = shown.older != null;
  const covering = coveringTurn(pageWidth);
  const turnsValue = useMemo(() => ({
    atTonight, hasOlder, hasNewer, locked,
    turn: (forward: boolean) => navigatePage(forward ? FORWARD : BACKWARD),
  }), [atTonight, hasNewer, hasOlder, locked, navigatePage]);
  const pan = useMemo(() => Gesture.Pan()
    .enabled(!locked)
    .activeOffsetX([-18, 18])
    .failOffsetY([-12, 12])
    .hitSlop({ left: -BINDING })
    .onBegin(() => {
      if (!reduced) scheduleOnRN(drawLikenesses);
    })
    .onStart(() => {
      if (phase.get() !== IDLE || held.get() !== 0) return;
      // The hand takes the page from its arrival.
      hintWaits.set(false);
      if (!turnedOver.get()) direction.set(0);
    })
    .onUpdate((event) => {
      if (phase.get() !== IDLE || held.get() !== 0) return;
      // On tonight's page only a turn back moves anything: the last dream's page comes down again.
      if (turnedOver.get()) {
        if (!reduced) progress.set(Math.max(0, 1 - Math.max(0, event.translationX) / (width * 0.8)));
        return;
      }
      // The way the page turns is the way the hand first moves: activation may report no travel yet.
      if (direction.get() === 0) {
        if (Math.abs(event.translationX) < 2) return;
        direction.set(event.translationX < 0 ? FORWARD : BACKWARD);
      }
      if (reduced) return;
      const turnedTo = direction.get();
      const available = turnedTo === FORWARD ? hasNewer : hasOlder;
      const amount = Math.max(0, (turnedTo === FORWARD ? -event.translationX : event.translationX) / (width * 0.8));
      // Until the page that way is drawn, this one lifts only as far as it still covers it,
      // and an earlier one does not come over yet. A leaf of two facing pages covers nothing
      // beneath once lifted: it waits for that page.
      const drawnThatWay = turnedTo === FORWARD ? !hasLaterDream || likenessesDrawn.get() : likenessesDrawn.get();
      const reach = drawnThatWay ? 1 : turnedTo === FORWARD && !spreadOpen ? covering : 0;
      // Without a page on that side, the page only lifts a little and resists.
      progress.set(available ? Math.min(reach, amount) : Math.min(0.06, amount * 0.15));
    })
    .onEnd((event) => {
      if (phase.get() !== IDLE || held.get() !== 0) return;
      if (turnedOver.get()) {
        const back = event.velocityX > 700 || (reduced ? event.translationX > width * COMMIT : 1 - progress.get() > COMMIT);
        if (!back) {
          progress.set(withSpring(1, { duration: 320, dampingRatio: 0.85 }));
          return;
        }
        const down = () => {
          'worklet';
          turnedOver.set(false);
          direction.set(0);
          scheduleOnRN(leaveTonight);
        };
        if (reduced) {
          progress.set(0);
          down();
          return;
        }
        progress.set(withTiming(0, { duration: 260 * progress.get() + 90, easing: EASING.inOut }, (done) => {
          if (done) down();
        }));
        return;
      }
      const turnedTo = direction.get();
      const available = turnedTo === FORWARD ? hasNewer : hasOlder;
      const flick = turnedTo === FORWARD ? event.velocityX < -700 : event.velocityX > 700;
      const drawn = likenessesDrawn.get() || (turnedTo === FORWARD && !hasLaterDream);
      if (reduced) {
        if (available && (flick || Math.abs(event.translationX) > width * COMMIT)) scheduleOnRN(turnAtOnce, turnedTo);
        return;
      }
      // How far the hand took the page, which may have lifted less while its neighbour was not drawn.
      const amount = Math.max(0, (turnedTo === FORWARD ? -event.translationX : event.translationX) / (width * 0.8));
      const turns = available && (amount > COMMIT || flick);
      // A page whose neighbour is not drawn yet waits for it rather than turn onto nothing.
      if (turns && !drawn) {
        held.set(turnedTo);
        scheduleOnRN(holdAtMost);
        return;
      }
      if (turns) {
        const ontoTonight = turnedTo === FORWARD && !hasLaterDream;
        progress.set(withTiming(1, { duration: 260 * (1 - progress.get()) + 90, easing: EASING.inOut }, (done) => {
          if (!done) return;
          if (ontoTonight) turnedOver.set(true);
          scheduleOnRN(finishTurn, turnedTo);
        }));
      } else {
        progress.set(withSpring(0, { duration: 320, dampingRatio: 0.85 }, (done) => {
          if (done) direction.set(0);
        }));
      }
    }), [covering, direction, drawLikenesses, finishTurn, hasLaterDream, hasNewer, hasOlder, held, hintWaits, holdAtMost,
    leaveTonight, likenessesDrawn, locked, phase, progress, reduced, spreadOpen, turnAtOnce, turnedOver, width]);

  // The page turning over: it lifts from the binding, darkening as it stands on edge. Once
  // turned forward it is set back flat, unseen, and the page turned to fades in there.
  const currentPage = useAnimatedStyle(() => {
    const idle = phase.get() === IDLE;
    const turn = !spreadOpen && idle && direction.get() === FORWARD ? progress.get() : 0;
    return {
      opacity: phase.get() === SETTLING_FORWARD ? settle.get() : 1,
      transform: [{ perspective: PERSPECTIVE }, { rotateY: `${-TURN_DEGREES * turn}deg` }],
    };
  });
  const currentShade = useAnimatedStyle(() => ({
    opacity: !spreadOpen && phase.get() === IDLE && direction.get() === FORWARD
      ? interpolate(progress.get(), [0, 1], [0, 0.45], Extrapolation.CLAMP) : 0,
  }));
  // The later page, lying beneath: in shadow while the turning page still covers it.
  const laterPage = useAnimatedStyle(() => ({
    opacity: (phase.get() === IDLE && direction.get() === FORWARD) || phase.get() === SETTLING_FORWARD ? 1 : 0,
  }));
  const laterShade = useAnimatedStyle(() => ({
    opacity: phase.get() === IDLE && direction.get() === FORWARD
      ? interpolate(progress.get(), [0, 1], [0.4, 0], Extrapolation.CLAMP) : 0,
  }));
  // The earlier page, coming back over: from on edge at the binding to lying flat, then
  // fading off the page turned to once it has laid itself out beneath.
  const earlierPage = useAnimatedStyle(() => {
    if (phase.get() === SETTLING_BACK) {
      return { opacity: settle.get(), transform: [{ perspective: PERSPECTIVE }, { rotateY: '0deg' }] };
    }
    const turn = phase.get() === IDLE && direction.get() === BACKWARD ? progress.get() : 0;
    return {
      opacity: turn > 0 ? 1 : 0,
      transform: [{ perspective: PERSPECTIVE }, { rotateY: `${-TURN_DEGREES * (1 - turn)}deg` }],
    };
  });
  const earlierShade = useAnimatedStyle(() => ({
    opacity: phase.get() === IDLE && direction.get() === BACKWARD
      ? interpolate(progress.get(), [0, 1], [0.45, 0], Extrapolation.CLAMP) : 0,
  }));
  // The shadow the earlier page casts as it comes over. Once it lies flat it covers the
  // page whole, so the shadow is gone before the page shows through it.
  const currentUnderShade = useAnimatedStyle(() => ({
    opacity: !spreadOpen && phase.get() === IDLE && direction.get() === BACKWARD
      ? interpolate(progress.get(), [0, 1], [0, 0.4], Extrapolation.CLAMP) : 0,
  }));

  // Opening, the page's likeness lies over it, and fades off it once it has laid itself out.
  const openingLikeness = useAnimatedStyle(() => ({ opacity: likenessShown.get() }));

  // Two facing pages. Towards a later dream the right-hand leaf lifts from the binding, stands
  // on edge half way, and its other side, the later dream's left-hand page, lies down over the
  // left; beneath it lay that dream's right-hand page. Back, the left-hand leaf turns over the
  // same way to the right (`JournalSpreadLeaf` turns the dream page's own leaves). Each side
  // shows only while it faces the reader. Each style reads the shared values itself: a mapper
  // follows only those its own worklet captures, not those of a worklet it calls.
  // Beneath the turning leaf, in its shadow until it stands on edge; shown on until the dream
  // page turned to has faded in over it.
  const beneathRight = useAnimatedStyle(() => ({ opacity: leafBeneath(phase.get(), direction.get(), FORWARD) }));
  const beneathLeft = useAnimatedStyle(() => ({ opacity: leafBeneath(phase.get(), direction.get(), BACKWARD) }));
  // The shadows fall only while a hand or the page's own weight turns the leaf: once it lies
  // down, the pages turned to show as they are until the dream page fades in over them.
  const beneathRightShade = useAnimatedStyle(() => ({
    opacity: phase.get() !== IDLE ? 0
      : interpolate(leafTurn(phase.get(), direction.get(), progress.get(), FORWARD), [0, ON_EDGE], [0.4, 0], Extrapolation.CLAMP)
        * leafBeneath(phase.get(), direction.get(), FORWARD),
  }));
  const beneathLeftShade = useAnimatedStyle(() => ({
    opacity: phase.get() !== IDLE ? 0
      : interpolate(leafTurn(phase.get(), direction.get(), progress.get(), BACKWARD), [0, ON_EDGE], [0.4, 0], Extrapolation.CLAMP)
        * leafBeneath(phase.get(), direction.get(), BACKWARD),
  }));
  // The turning leaf's other side, from on edge at the binding to lying flat; once the leaf
  // is down, it fades off the dream page turned to as that page fades in beneath it.
  const overleafLeft = useAnimatedStyle(() => overleaf(phase.get(), direction.get(), progress.get(), settle.get(), FORWARD));
  const overleafRight = useAnimatedStyle(() => overleaf(phase.get(), direction.get(), progress.get(), settle.get(), BACKWARD));
  const overleafLeftShade = useAnimatedStyle(() => ({
    opacity: phase.get() !== IDLE ? 0
      : interpolate(leafTurn(phase.get(), direction.get(), progress.get(), FORWARD), [ON_EDGE, 1], [0.45, 0], Extrapolation.CLAMP),
  }));
  const overleafRightShade = useAnimatedStyle(() => ({
    opacity: phase.get() !== IDLE ? 0
      : interpolate(leafTurn(phase.get(), direction.get(), progress.get(), BACKWARD), [ON_EDGE, 1], [0.45, 0], Extrapolation.CLAMP),
  }));
  const spreadTurn = useMemo(() => (spreadOpen ? { phase, direction, progress } : null), [direction, phase, progress, spreadOpen]);

  const pageFrame = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, transformOrigin: 'left center' };
  // Android draws each layer of a fading view with its opacity, so a page's veils darken
  // what lies beneath it as it fades: composed apart, a page fading fades whole.
  const fadesWhole = { needsOffscreenAlphaCompositing: true } as const;

  return (
    <PageTurnLockContext.Provider value={setLocked}>
      <PageArrivalContext.Provider value={arrival}>
      <PageTurnsContext.Provider value={turnsValue}>
      <SpreadTurnContext.Provider value={spreadTurn}>
      <View className="flex-1 bg-ink">
      <GestureDetector gesture={pan} touchAction="pan-y">
        <View className="flex-1 bg-ink" onLayout={({ nativeEvent: { layout } }) => {
          setPageHeight(layout.height);
          setPageWidth(layout.width);
        }}>
          {spread ? <JournalPaper /> : null}
          {spread ? (
            <>
              {/* Beneath the turning leaves: the later dream's right-hand page (or tonight's), the earlier one's left-hand page. */}
              {shown.newer ? (likenesses ? (
                <Animated.View pointerEvents="none" style={[spreadHalf('right', spread), beneathRight]} onLayout={likenessLaidOut}>
                  <JournalPagePreview height={pageHeight} dream={shown.newer} folio={shown.folio ? shown.folio + 1 : undefined} side="right" />
                  <Animated.View className="absolute inset-0" style={[{ backgroundColor: shadow }, beneathRightShade]} />
                </Animated.View>
              ) : null) : tonight ? (
                <Animated.View pointerEvents={atTonight ? 'box-none' : 'none'} style={[spreadHalf('right', spread), beneathRight]}>
                  <JournalTonightPage folio={shown.folio ? shown.folio + 1 : undefined} interactive={atTonight} />
                  <Animated.View pointerEvents="none" className="absolute inset-0" style={[{ backgroundColor: shadow }, beneathRightShade]} />
                </Animated.View>
              ) : null}
              {shown.older && likenesses ? (
                <Animated.View pointerEvents="none" style={[spreadHalf('left', spread), beneathLeft]} onLayout={likenessLaidOut}>
                  <JournalPagePreview height={pageHeight} dream={shown.older} folio={shown.folio ? shown.folio - 1 : undefined} side="left" />
                  <Animated.View className="absolute inset-0" style={[{ backgroundColor: shadow }, beneathLeftShade]} />
                </Animated.View>
              ) : null}
            </>
          ) : shown.newer ? (likenesses ? (
            <Animated.View pointerEvents="none" style={[pageFrame, laterPage]} onLayout={likenessLaidOut}>
              <JournalPagePreview height={pageHeight} dream={shown.newer} folio={shown.folio ? shown.folio + 1 : undefined} />
              <Animated.View className="absolute inset-0" style={[{ backgroundColor: shadow }, laterShade]} />
            </Animated.View>
          ) : null) : tonight ? (
            <Animated.View pointerEvents={atTonight ? 'box-none' : 'none'} style={[pageFrame, laterPage]}>
              <JournalTonightPage folio={shown.folio ? shown.folio + 1 : undefined} interactive={atTonight} />
              <Animated.View pointerEvents="none" className="absolute inset-0" style={[{ backgroundColor: shadow }, laterShade]} />
            </Animated.View>
          ) : null}
          <Animated.View pointerEvents={atTonight ? 'none' : 'auto'} accessibilityElementsHidden={atTonight}
            importantForAccessibility={atTonight ? 'no-hide-descendants' : 'auto'}
            {...(Platform.OS === 'web' ? { 'aria-hidden': atTonight, inert: atTonight } : {})} {...fadesWhole}
            style={[pageFrame, currentPage]}
            // Touched once laid out beneath its likeness, the page shows itself at once.
            onTouchStart={opening && pageDrawn ? openPage : undefined}>
            {pageDrawn ? children : null}
            {opening ? (
              <Animated.View pointerEvents="none" testID="journal.page.opening" {...fadesWhole} renderToHardwareTextureAndroid
                style={[StyleSheet.absoluteFill, openingLikeness]}>
                <JournalPagePreview height={pageHeight} dream={dream} folio={shown.folio} />
              </Animated.View>
            ) : null}
            <Animated.View pointerEvents="none" className="absolute inset-0" style={[{ backgroundColor: shadow }, currentShade]} />
            <Animated.View pointerEvents="none" className="absolute inset-0" style={[{ backgroundColor: shadow }, currentUnderShade]} />
          </Animated.View>
          {spread ? (
            <>
              {/* The turning leaf's other side: the later dream's left-hand page (a blank verso before tonight's), the earlier one's right-hand page. */}
              {shown.newer ? (likenesses ? (
                <Animated.View pointerEvents="none" {...fadesWhole} style={[spreadHalf('left', spread), overleafLeft]}>
                  <JournalPagePreview height={pageHeight} dream={shown.newer} folio={shown.folio ? shown.folio + 1 : undefined} side="left" />
                  <Animated.View className="absolute inset-0" style={[{ backgroundColor: shadow }, overleafLeftShade]} />
                </Animated.View>
              ) : null) : tonight ? (
                <Animated.View pointerEvents="none" {...fadesWhole} style={[spreadHalf('left', spread), overleafLeft]}>
                  <View className="flex-1 bg-ink">
                    <JournalPaper />
                    <JournalPageEdges side="left" />
                  </View>
                  <Animated.View className="absolute inset-0" style={[{ backgroundColor: shadow }, overleafLeftShade]} />
                </Animated.View>
              ) : null}
              {shown.older && likenesses ? (
                <Animated.View pointerEvents="none" {...fadesWhole} style={[spreadHalf('right', spread), overleafRight]}>
                  <JournalPagePreview height={pageHeight} dream={shown.older} folio={shown.folio ? shown.folio - 1 : undefined} side="right" />
                  <Animated.View className="absolute inset-0" style={[{ backgroundColor: shadow }, overleafRightShade]} />
                </Animated.View>
              ) : null}
            </>
          ) : shown.older && likenesses ? (
            <Animated.View pointerEvents="none" {...fadesWhole} style={[pageFrame, earlierPage]} onLayout={likenessLaidOut}>
              <JournalPagePreview height={pageHeight} dream={shown.older} folio={shown.folio ? shown.folio - 1 : undefined} />
              <Animated.View className="absolute inset-0" style={[{ backgroundColor: shadow }, earlierShade]} />
            </Animated.View>
          ) : null}
        </View>
      </GestureDetector>
      </View>
      </SpreadTurnContext.Provider>
      </PageTurnsContext.Provider>
      </PageArrivalContext.Provider>
    </PageTurnLockContext.Provider>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
});
