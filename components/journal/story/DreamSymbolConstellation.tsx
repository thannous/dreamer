import React, { useMemo, useState } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion, type CSSStyle } from 'react-native-reanimated';

import { EASE } from '@/components/motion/motion';
import { TID } from '@/lib/testIDs';

import { DREAM_STORY, reducedDelay } from './dreamStoryMotion';

/** Beyond five, labels no longer fit a phone width; the reading lists every symbol. */
export const MAX_CONSTELLATION_STARS = 5;

const HEIGHT = 136;
/** High stars carry their label above, low stars below, so no thread crosses a word. */
const HIGH_Y = 48;
const LOW_Y = 86;
const STAR = 9;
const HALO = 26;
const LABEL_GAP = 10;

type Point = { x: number; y: number; high: boolean };

const layoutStars = (count: number, width: number): Point[] => {
  if (count === 1) return [{ x: width / 2, y: (HIGH_Y + LOW_Y) / 2, high: false }];
  return Array.from({ length: count }, (_, index) => {
    const high = index % 2 === 1;
    return { x: ((index + 0.5) / count) * width, y: high ? HIGH_Y : LOW_Y, high };
  });
};

/**
 * The dream's own symbols drawn as a constellation: the visual promise of the onboarding
 * ("Repérer"), kept with the dream's real data. Each star ignites in turn and the thread
 * to the next one draws itself; on a return visit the constellation is simply lit.
 *
 * Decorative: the reading below names every symbol with its meaning, so assistive
 * technology skips this picture rather than reading the names twice.
 */
export function DreamSymbolConstellation({ names, play }: { names: readonly string[]; play: boolean }) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const stars = names.slice(0, MAX_CONSTELLATION_STARS);
  const points = useMemo(() => (width ? layoutStars(stars.length, width) : []), [stars.length, width]);
  const labelWidth = width ? Math.max(56, width / stars.length - 8) : 0;

  return (
    <View
      testID={TID.Component.DreamSymbolConstellation}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      pointerEvents="none"
      onLayout={({ nativeEvent }) => setWidth(previous => previous === nativeEvent.layout.width ? previous : nativeEvent.layout.width)}
      style={{ height: HEIGHT }}
    >
      {points.slice(0, -1).map((from, index) => (
        <Thread key={`thread-${index}`} from={from} to={points[index + 1]} index={index}
          play={play} reduced={reduced} />
      ))}
      {points.map((point, index) => (
        <Star key={`${index}:${stars[index]}`} point={point} index={index} name={stars[index]}
          labelWidth={labelWidth} play={play} reduced={reduced} />
      ))}
    </View>
  );
}

const igniteDelay = (index: number) => DREAM_STORY.revealLead + index * DREAM_STORY.starStep;

function Star({ point, index, name, labelWidth, play, reduced }: {
  point: Point; index: number; name: string; labelWidth: number; play: boolean; reduced: boolean;
}) {
  const delay = igniteDelay(index);
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
        <View className="absolute rounded-full bg-champagne" style={{ width: HALO, height: HALO, opacity: 0.16 }} />
        <View className="rounded-full bg-champagne" style={{ width: STAR, height: STAR }} />
      </Animated.View>
      <Animated.View
        className={`absolute items-center ${point.high ? 'justify-end' : 'justify-start'}`}
        style={[{
          left: point.x - labelWidth / 2,
          width: labelWidth,
          ...(point.high
            ? { bottom: HEIGHT - point.y + LABEL_GAP }
            : { top: point.y + LABEL_GAP }),
        }, label] as StyleProp<ViewStyle>}
      >
        <Text numberOfLines={2} className="text-center font-display-medium text-[14px] leading-[18px] text-ivory">
          {name}
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
