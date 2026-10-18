import React, { useMemo, useState } from 'react';
import { Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion, type CSSStyle } from 'react-native-reanimated';

import { EASE } from '@/components/motion/motion';
import type { LinkedSymbol } from '@/lib/symbolLinks';
import { TID } from '@/lib/testIDs';
import { useLiveTestID } from '../DecorativeCopy';
import { SymbolMedallion } from '../symbols/SymbolMedallion';

import { DREAM_STORY, reducedDelay } from './dreamStoryMotion';

/** Beyond five, labels no longer fit a phone width; the reading lists every symbol. */
export const MAX_CONSTELLATION_STARS = 5;

/** A star without a linked symbol is a point of light; a linked one wears its face. */
const STAR = 9;
const FACE = 44;
const HALO = 60;
const LABEL_GAP = 8;
const LABEL_LINE = 18;
/** Vertical distance between the high and the low row of stars. */
const ROW_GAP = 44;

type Point = { x: number; y: number; high: boolean };

export type ConstellationStar = {
  name: string;
  /** Dreams of the journal the symbol appears in, this one included. */
  count: number;
  /** The dreamer's own symbol, born in this dream and not opened yet. */
  fresh: boolean;
  /** The symbol followed through the journal, whose face the star wears. */
  symbol?: LinkedSymbol;
};
type Rows = { high: number; low: number; height: number };

/**
 * High stars carry their label above, low stars below, so no thread crosses a word.
 * Each label keeps room for its two lines at the reader's text size (182 points at 100 %).
 */
const rowsFor = (fontScale: number): Rows => {
  const label = 2 * LABEL_LINE * Math.max(fontScale, 1);
  const high = label + LABEL_GAP + FACE / 2 + 2;
  const low = high + ROW_GAP;
  return { high, low, height: low + FACE / 2 + LABEL_GAP + label + 4 };
};

const layoutStars = (count: number, width: number, rows: Rows): Point[] => {
  if (count === 1) return [{ x: width / 2, y: (rows.high + rows.low) / 2, high: false }];
  return Array.from({ length: count }, (_, index) => {
    const high = index % 2 === 1;
    return { x: ((index + 0.5) / count) * width, y: high ? rows.high : rows.low, high };
  });
};

/**
 * The dream's own symbols drawn as a constellation: the visual promise of the onboarding
 * ("Repérer"), kept with the dream's real data. Each star wears its symbol's face, the
 * dictionary's plate or the painting of the dream it was born in, as the reading below
 * does. Each star ignites in turn and the thread to the next one draws itself; on a
 * return visit the constellation is simply lit.
 * As in the onboarding, a symbol that returns carries the number of its dreams and,
 * as it lights, breathes twice, so the eye finds what repeats.
 *
 * Decorative: the reading below names every symbol with its meaning, so assistive
 * technology skips this picture rather than reading the names twice.
 */
export function DreamSymbolConstellation({ stars: all, play }: { stars: readonly ConstellationStar[]; play: boolean }) {
  const reduced = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const stars = all.slice(0, MAX_CONSTELLATION_STARS);
  const tid = useLiveTestID();
  const rows = useMemo(() => rowsFor(fontScale), [fontScale]);
  const points = useMemo(() => (width ? layoutStars(stars.length, width, rows) : []), [rows, stars.length, width]);
  const labelWidth = width ? Math.max(56, width / stars.length - 8) : 0;

  return (
    <View
      testID={tid(TID.Component.DreamSymbolConstellation)}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      pointerEvents="none"
      onLayout={({ nativeEvent }) => setWidth(previous => previous === nativeEvent.layout.width ? previous : nativeEvent.layout.width)}
      style={{ height: rows.height }}
    >
      {points.slice(0, -1).map((from, index) => (
        <Thread key={`thread-${index}`} from={from} to={points[index + 1]} index={index}
          play={play} reduced={reduced} />
      ))}
      {points.map((point, index) => (
        <Star key={`${index}:${stars[index].name}`} point={point} index={index} star={stars[index]}
          labelWidth={labelWidth} height={rows.height} play={play} reduced={reduced} />
      ))}
    </View>
  );
}

const igniteDelay = (index: number) => DREAM_STORY.revealLead + index * DREAM_STORY.starStep;

function Star({ point, index, star, labelWidth, height, play, reduced }: {
  point: Point; index: number; star: ConstellationStar; labelWidth: number; height: number; play: boolean; reduced: boolean;
}) {
  const delay = igniteDelay(index);
  const returns = star.count > 1;
  // Once lit, a returning or newborn symbol breathes twice, then rests; a return visit is at rest.
  const breathe = useMemo<CSSStyle<ViewStyle>>(() => (play && !reduced && (returns || star.fresh) ? {
    animationName: {
      from: { opacity: 0.16, transform: [{ scale: 1 }] },
      to: { opacity: 0.42, transform: [{ scale: 1.45 }] },
    },
    animationDuration: 1100,
    animationDelay: delay + DREAM_STORY.starIgnite + 300,
    animationIterationCount: 4,
    animationDirection: 'alternate',
    animationTimingFunction: EASE.inOut,
    animationFillMode: 'both',
  } : {}), [delay, play, reduced, returns, star.fresh]);
  const ignite = useMemo<CSSStyle<ViewStyle>>(() => (play ? {
    animationName: {
      '0%': { opacity: 0, transform: [{ scale: reduced ? 1 : 0.6 }] },
      '60%': { opacity: 1, transform: [{ scale: reduced ? 1 : 1.15 }] },
      '100%': { opacity: 1, transform: [{ scale: 1 }] },
    },
    animationDuration: DREAM_STORY.starIgnite,
    animationDelay: reduced ? reducedDelay(delay) : delay,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  } : {}), [delay, play, reduced]);
  const label = useMemo<CSSStyle<ViewStyle>>(() => (play ? {
    animationName: {
      from: { opacity: 0, transform: [{ translateY: reduced ? 0 : point.high ? -4 : 4 }] },
      to: { opacity: 1, transform: [{ translateY: 0 }] },
    },
    animationDuration: DREAM_STORY.starIgnite,
    animationDelay: reduced ? reducedDelay(delay) : delay + 120,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  } : {}), [delay, play, point.high, reduced]);

  return (
    <>
      <Animated.View
        className="absolute items-center justify-center"
        style={[{ left: point.x - HALO / 2, top: point.y - HALO / 2, width: HALO, height: HALO }, ignite] as StyleProp<ViewStyle>}
      >
        <Animated.View className="absolute rounded-full bg-champagne"
          style={[{ width: HALO, height: HALO, opacity: 0.16 }, breathe] as StyleProp<ViewStyle>} />
        {star.symbol
          ? <SymbolMedallion symbol={star.symbol} size={FACE} />
          : <View className="rounded-full bg-champagne" style={{ width: STAR, height: STAR }} />}
        {returns ? (
          <View className="absolute items-center justify-center rounded-full border border-champagne bg-ink"
            // On the face's upper right rim, clear of the labels above and below it.
            style={{ left: HALO / 2 + FACE / 2 - 14, top: HALO / 2 - FACE / 2 - 6, minWidth: 18, height: 18, paddingHorizontal: 3 }}>
            <Text allowFontScaling={false} className="font-sans-medium text-[10px] leading-[14px] text-champagne-on">{star.count}</Text>
          </View>
        ) : null}
      </Animated.View>
      <Animated.View
        className={`absolute items-center ${point.high ? 'justify-end' : 'justify-start'}`}
        style={[{
          left: point.x - labelWidth / 2,
          width: labelWidth,
          ...(point.high
            ? { bottom: height - point.y + FACE / 2 + LABEL_GAP }
            : { top: point.y + FACE / 2 + LABEL_GAP }),
        }, label] as StyleProp<ViewStyle>}
      >
        <Text numberOfLines={2} className="text-center font-display-medium text-[14px] leading-[18px] text-ivory">
          {star.name}
        </Text>
      </Animated.View>
    </>
  );
}

/** The line to the next star, drawn from this one as the next ignites. */
function Thread({ from, to, index, play, reduced }: {
  from: Point; to: Point; index: number; play: boolean; reduced: boolean;
}) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const angle = `${Math.atan2(to.y - from.y, to.x - from.x)}rad`;
  const delay = igniteDelay(index) + 180;
  const draw = useMemo<CSSStyle<ViewStyle>>(() => (play ? {
    animationName: reduced
      ? { from: { opacity: 0 }, to: { opacity: 0.5 } }
      : {
          from: { opacity: 0.5, transform: [{ rotate: angle }, { scaleX: 0 }] },
          to: { opacity: 0.5, transform: [{ rotate: angle }, { scaleX: 1 }] },
        },
    animationDuration: DREAM_STORY.thread,
    animationDelay: reduced ? reducedDelay(delay) : delay,
    animationTimingFunction: EASE.inOut,
    animationFillMode: 'both',
  } : {}), [angle, delay, play, reduced]);

  return (
    <Animated.View
      className="absolute bg-champagne"
      style={[{
        left: from.x,
        top: from.y,
        width: length,
        height: 1,
        opacity: 0.5,
        transformOrigin: 'left',
        transform: [{ rotate: angle }],
      }, draw] as StyleProp<ViewStyle>}
    />
  );
}
