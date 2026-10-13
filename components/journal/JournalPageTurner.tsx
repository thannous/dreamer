import * as Haptics from 'expo-haptics';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { JournalPagePreview } from '@/components/journal/JournalPagePreview';
import { EASING } from '@/components/motion/motion';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import type { DreamAnalysis } from '@/lib/types';

/** Turning to a later page lifts this one over the binding; an earlier page comes back over it. */
const FORWARD = -1;
const BACKWARD = 1;
/** How far the page has turned when it is let go, past which it finishes turning. */
const COMMIT = 0.35;
/** The binding's own gesture: the system back swipe starts here, so turning starts past it. */
const BINDING = 28;
/** The new page settles in over its likeness once it has been turned to. */
const SETTLE_MS = 220;

const PageTurnLockContext = createContext<(locked: boolean) => void>(() => {});

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
 * Without a page on one side it only lifts a little. Vertical scrolling and the system
 * back swipe at the binding stay as they are; under reduce motion the page changes at
 * once.
 */
export function JournalPageTurner({ newer, older, onTurn, children }: {
  /** The dream after this one, turned to towards the left. */
  newer: DreamAnalysis | null;
  /** The dream before this one, turned back to towards the right. */
  older: DreamAnalysis | null;
  onTurn: (dream: DreamAnalysis) => void;
  children: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const { colors, mode } = useTheme();
  const shadow = useMemo(() => getNoctaliaDesignTokens(colors, mode).surface.overlay, [colors, mode]);
  const [locked, setLocked] = useState(false);
  // The likenesses stay those of the turn in progress until the turned-to page has settled.
  const [frozen, setFrozen] = useState<{ newer: DreamAnalysis | null; older: DreamAnalysis | null } | null>(null);
  const shown = frozen ?? { newer, older };

  const direction = useSharedValue(0);
  const progress = useSharedValue(0);
  const settle = useSharedValue(1);

  const settled = useCallback(() => setFrozen(null), []);

  const finishTurn = useCallback((turnedTo: number) => {
    const target = turnedTo === FORWARD ? shown.newer : shown.older;
    if (!target) return;
    setFrozen({ newer: shown.newer, older: shown.older });
    void Haptics.selectionAsync().catch(() => {});
    onTurn(target);
    // Give the real page a moment to lay itself out under the turned page, then let it in.
    setTimeout(() => {
      if (turnedTo === FORWARD) {
        settle.set(0);
        progress.set(0);
        direction.set(0);
        settle.set(withTiming(1, { duration: SETTLE_MS, easing: EASING.out }, (done) => {
          if (done) scheduleOnRN(settled);
        }));
      } else {
        settle.set(withTiming(0, { duration: SETTLE_MS, easing: EASING.out }, (done) => {
          if (!done) return;
          progress.set(0);
          direction.set(0);
          settle.set(1);
          scheduleOnRN(settled);
        }));
      }
    }, 60);
  }, [direction, onTurn, progress, settle, settled, shown.newer, shown.older]);

  const turnAtOnce = useCallback((turnedTo: number) => {
    const target = turnedTo === FORWARD ? shown.newer : shown.older;
    if (!target) return;
    void Haptics.selectionAsync().catch(() => {});
    onTurn(target);
  }, [onTurn, shown.newer, shown.older]);

  const hasNewer = shown.newer != null;
  const hasOlder = shown.older != null;
  const pan = useMemo(() => Gesture.Pan()
    .enabled(!locked)
    .activeOffsetX([-18, 18])
    .failOffsetY([-12, 12])
    .hitSlop({ left: -BINDING })
    .onStart(() => {
      direction.set(0);
    })
    .onUpdate((event) => {
      // The way the page turns is the way the hand first moves: activation may report no travel yet.
      if (direction.get() === 0) {
        if (Math.abs(event.translationX) < 2) return;
        direction.set(event.translationX < 0 ? FORWARD : BACKWARD);
      }
      if (reduced) return;
      const turnedTo = direction.get();
      const available = turnedTo === FORWARD ? hasNewer : hasOlder;
      const amount = Math.max(0, (turnedTo === FORWARD ? -event.translationX : event.translationX) / (width * 0.8));
      // Without a page on that side, the page only lifts a little and resists.
      progress.set(available ? Math.min(1, amount) : Math.min(0.06, amount * 0.15));
    })
    .onEnd((event) => {
      const turnedTo = direction.get();
      const available = turnedTo === FORWARD ? hasNewer : hasOlder;
      const flick = turnedTo === FORWARD ? event.velocityX < -700 : event.velocityX > 700;
      if (reduced) {
        if (available && (flick || Math.abs(event.translationX) > width * COMMIT)) scheduleOnRN(turnAtOnce, turnedTo);
        return;
      }
      if (available && (progress.get() > COMMIT || flick)) {
        progress.set(withTiming(1, { duration: 260 * (1 - progress.get()) + 90, easing: EASING.inOut }, (done) => {
          if (done) scheduleOnRN(finishTurn, turnedTo);
        }));
      } else {
        progress.set(withSpring(0, { duration: 320, dampingRatio: 0.85 }, (done) => {
          if (done) direction.set(0);
        }));
      }
    }), [direction, finishTurn, hasNewer, hasOlder, locked, progress, reduced, turnAtOnce, width]);

  // The page turning over: it lifts from the binding, darkening as it stands on edge.
  const currentPage = useAnimatedStyle(() => {
    const forward = direction.get() === FORWARD;
    const turn = forward ? progress.get() : 0;
    return {
      opacity: settle.get(),
      transform: [{ perspective: 1600 }, { rotateY: `${-92 * turn}deg` }],
    };
  });
  const currentShade = useAnimatedStyle(() => ({
    opacity: direction.get() === FORWARD ? interpolate(progress.get(), [0, 1], [0, 0.45], Extrapolation.CLAMP) : 0,
  }));
  // The later page, lying beneath: in shadow while the turning page still covers it.
  const laterPage = useAnimatedStyle(() => ({ opacity: direction.get() === FORWARD ? 1 : 0 }));
  const laterShade = useAnimatedStyle(() => ({
    opacity: direction.get() === FORWARD ? interpolate(progress.get(), [0, 1], [0.4, 0], Extrapolation.CLAMP) : 0,
  }));
  // The earlier page, coming back over: from on edge at the binding to lying flat.
  const earlierPage = useAnimatedStyle(() => {
    const backward = direction.get() === BACKWARD;
    const turn = backward ? progress.get() : 0;
    return {
      opacity: backward && turn > 0 ? settle.get() : 0,
      transform: [{ perspective: 1600 }, { rotateY: `${-92 * (1 - turn)}deg` }],
    };
  });
  const earlierShade = useAnimatedStyle(() => ({
    opacity: direction.get() === BACKWARD ? interpolate(progress.get(), [0, 1], [0.45, 0], Extrapolation.CLAMP) : 0,
  }));
  const currentUnderShade = useAnimatedStyle(() => ({
    opacity: direction.get() === BACKWARD ? interpolate(progress.get(), [0, 1], [0, 0.4], Extrapolation.CLAMP) : 0,
  }));

  const pageFrame = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, transformOrigin: 'left center' };

  return (
    <PageTurnLockContext.Provider value={setLocked}>
      <GestureDetector gesture={pan} touchAction="pan-y">
        <View className="flex-1 bg-ink">
          {shown.newer ? (
            <Animated.View pointerEvents="none" style={[pageFrame, laterPage]}>
              <JournalPagePreview dream={shown.newer} />
              <Animated.View className="absolute inset-0" style={[{ backgroundColor: shadow }, laterShade]} />
            </Animated.View>
          ) : null}
          <Animated.View style={[pageFrame, currentPage]}>
            {children}
            <Animated.View pointerEvents="none" className="absolute inset-0" style={[{ backgroundColor: shadow }, currentShade]} />
            <Animated.View pointerEvents="none" className="absolute inset-0" style={[{ backgroundColor: shadow }, currentUnderShade]} />
          </Animated.View>
          {shown.older ? (
            <Animated.View pointerEvents="none" style={[pageFrame, earlierPage]}>
              <JournalPagePreview dream={shown.older} />
              <Animated.View className="absolute inset-0" style={[{ backgroundColor: shadow }, earlierShade]} />
            </Animated.View>
          ) : null}
        </View>
      </GestureDetector>
    </PageTurnLockContext.Provider>
  );
}
