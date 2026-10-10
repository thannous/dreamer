import type { ViewStyle } from 'react-native';
import type { CSSStyle } from 'react-native-reanimated';

import { EASE } from '@/components/motion/motion';

/**
 * The dream story's choreography, in one place: what happens to a dream after capture,
 * told on one object (the saved moment's medallion) and the reading below it.
 *
 *   I.  Saved — the astrolabe settles once around a window onto the night sky.
 *   II. Read  — while the analysis runs, its stars light one after another (no fake
 *       progress: the loop says "working", never "73 %"). When the reading lands, the
 *       dream's real symbols ignite as a constellation, the thread draws itself, then the
 *       reading follows chapter by chapter.
 *   III. Painted — while the illustration is made, a band of light sweeps the window like
 *       a brush. When it lands, the painting settles into the medallion and into the page
 *       where the reader is, never above them: the cover is the at-rest state of a later
 *       visit, so nothing the reader is looking at moves.
 *   Epilogue — back in the journal, the dream's card glows once.
 *
 * Every authored entrance plays once, when the state change is observed on screen.
 * A return visit shows the settled state. Under reduce motion nothing travels and the
 * staggers collapse; the waiting stars hold still and the copy carries the state.
 *
 * Milliseconds.
 */
export const DREAM_STORY = {
  /** One full pass of the waiting stars; each star takes its turn within it. */
  twinkleCycle: 2400,
  /** Leaves time for the reading to scroll into view before the first star ignites. */
  revealLead: 450,
  starIgnite: 520,
  starStep: 360,
  thread: 420,
  /** The reading chapters start once the last star is lit. */
  chapterLead: 240,
  /** One pass of the light band across a canvas being painted. */
  paintSweep: 2600,
  /** A landed painting settling into its frame. */
  paintSettle: 1200,
  /** The journal card's single glow, in and out. */
  epilogueHalo: 1800,
} as const;

/** Under reduce motion a stagger is still motion; it collapses to a near-simultaneous fade. */
export const reducedDelay = (delay: number): number => Math.min(delay, 120);

type Transform = NonNullable<ViewStyle['transform']>;

/** A one-time entrance. Reduced motion keeps the fade and drops the travel. */
export const entrance = (
  travel: { from: Transform; to: Transform } | null,
  durationMs: number,
  delayMs: number,
  reduced: boolean
): CSSStyle => {
  const moves = travel && !reduced;
  return {
    animationName: {
      from: { opacity: 0, ...(moves ? { transform: travel.from } : null) },
      to: { opacity: 1, ...(moves ? { transform: travel.to } : null) },
    },
    animationDuration: durationMs,
    animationDelay: reduced ? reducedDelay(delayMs) : delayMs,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  };
};

/**
 * Star `index` of `count` taking its turn in the waiting loop. A state indication that
 * runs only while the analysis does. Reduced motion holds every star at rest instead.
 */
export const twinkle = (index: number, count: number, reduced: boolean): CSSStyle => (reduced
  ? { opacity: 0.55 }
  : {
      animationName: {
        '0%': { opacity: 0.14, transform: [{ scale: 0.8 }] },
        '16%': { opacity: 1, transform: [{ scale: 1.25 }] },
        '42%': { opacity: 0.14, transform: [{ scale: 0.8 }] },
        '100%': { opacity: 0.14, transform: [{ scale: 0.8 }] },
      },
      animationDuration: DREAM_STORY.twinkleCycle,
      animationDelay: (DREAM_STORY.twinkleCycle / count) * index,
      animationIterationCount: 'infinite',
      animationTimingFunction: EASE.inOut,
      animationFillMode: 'both',
    });

/** When the reading chapters may start after `count` stars have ignited. */
export const chaptersDelay = (count: number): number =>
  DREAM_STORY.revealLead + Math.max(count - 1, 0) * DREAM_STORY.starStep + DREAM_STORY.starIgnite
  + DREAM_STORY.chapterLead;

/**
 * The band of light crossing a canvas while the illustration is made: a state indication
 * that runs only while the image job does. Reduced motion holds the band still.
 */
export const paintSweep = (travel: number, reduced: boolean): CSSStyle => (reduced
  ? { opacity: 0.5 }
  : {
      animationName: {
        from: { transform: [{ translateX: -travel }, { rotate: '18deg' }] },
        to: { transform: [{ translateX: travel }, { rotate: '18deg' }] },
      },
      animationDuration: DREAM_STORY.paintSweep,
      animationIterationCount: 'infinite',
      animationTimingFunction: EASE.inOut,
    });

/** A painting that has just landed, settling into its frame once. */
export const paintSettle = (reduced: boolean): CSSStyle =>
  entrance({ from: [{ scale: 1.08 }], to: [{ scale: 1 }] }, DREAM_STORY.paintSettle, 0, reduced);
