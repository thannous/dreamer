import { Image, type ImageSource } from 'expo-image';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { EASING } from '@/components/motion/motion';
import { useContentWindow } from '@/context/ContentWindowContext';

/** The illustration's flight from the seal's window to the plate, and its fade once the plate shows under it. */
const FLIGHT = 1150;
const FADE = 320;
/** Until the picture reports its own shape, it is taken for the portrait the illustrations are painted in. */
const PORTRAIT = 2 / 3;

/** The picture's own shape, covering a frame of the given size, as `contentFit="cover"` lays it out. */
const covering = (ratio: number, width: number, height: number) => (ratio > width / height
  ? { width: height * ratio, height }
  : { width, height: width / ratio });

/**
 * The dream's illustration leaving its seal for the top of the page, where the dream page
 * then sets it as its plate, as every illustrated dream opens, above the reading, which
 * does not move. The picture keeps its own shape all the way and only moves and grows: it
 * starts exactly as the seal's round window shows it and ends exactly as the plate lays it
 * out, while the frame around it opens from the window into the plate. Once the plate
 * shows under it (`landed`), it fades, uncovering the plate's veil and the dream's name at
 * its foot. Decorative: the plate carries the illustration for assistive technologies.
 */
export function CoverFlight({ source, from, to, height, travel, landed, onArrived, onGone }: {
  source: ImageSource;
  /** The seal's window on the screen: its centre and diameter. */
  from: { x: number; y: number; size: number };
  /**
   * Where the plate will lie on the screen, mostly above it, and how its picture drifts there;
   * across the page unless it is the left-hand page of two facing pages (`left`, `width`).
   */
  to: { top: number; drift: number; left?: number; width?: number };
  /** The plate's height, as the page lays it out at the top. */
  height: number;
  /** How far the plate's picture overhangs it above and below. */
  travel: number;
  landed: boolean;
  onArrived: () => void;
  onGone: () => void;
}) {
  const { width: window } = useContentWindow();
  const plateLeft = to.left ?? 0;
  const width = to.width ?? window;
  const [ratio, setRatio] = useState(PORTRAIT);
  const flight = useSharedValue(0);
  const fade = useSharedValue(1);
  const arrived = useRef(onArrived);
  const gone = useRef(onGone);
  useEffect(() => { arrived.current = onArrived; gone.current = onGone; }, [onArrived, onGone]);
  const arrive = useCallback(() => arrived.current(), []);
  const leave = useCallback(() => gone.current(), []);

  useEffect(() => {
    flight.set(withTiming(1, { duration: FLIGHT, easing: EASING.inOut }, (done) => {
      if (done) scheduleOnRN(arrive);
    }));
  }, [arrive, flight]);
  useEffect(() => {
    if (!landed) return;
    fade.set(withTiming(0, { duration: FADE, easing: EASING.out }, (done) => {
      if (done) scheduleOnRN(leave);
    }));
  }, [fade, landed, leave]);

  // The picture as the plate lays it out (its own size), and the scale it starts at in the window.
  const plate = covering(ratio, width, height + 2 * travel);
  const start = covering(ratio, from.size, from.size).width / plate.width;
  const end = { x: plateLeft + width / 2, y: to.top + height / 2 + to.drift };

  // The frame: from the round window to the plate, which mostly lies above the screen.
  const frame = useAnimatedStyle(() => {
    const opened = flight.get();
    return {
      left: (from.x - from.size / 2) * (1 - opened) + plateLeft * opened,
      top: (from.y - from.size / 2) * (1 - opened) + to.top * opened,
      width: from.size + (width - from.size) * opened,
      height: from.size + (height - from.size) * opened,
      borderRadius: (from.size / 2) * Math.max(0, 1 - opened * 1.6),
      opacity: fade.get(),
    };
  });
  // The picture: its centre glides from the window's to the plate's, and it grows evenly
  // (by the same ratio each moment), placed within the frame as the frame moves.
  const picture = useAnimatedStyle(() => {
    const opened = flight.get();
    const frameLeft = (from.x - from.size / 2) * (1 - opened) + plateLeft * opened;
    const frameTop = (from.y - from.size / 2) * (1 - opened) + to.top * opened;
    const centreX = from.x + (end.x - from.x) * opened;
    const centreY = from.y + (end.y - from.y) * opened;
    return {
      transform: [
        { translateX: centreX - frameLeft - plate.width / 2 },
        { translateY: centreY - frameTop - plate.height / 2 },
        { scale: start * Math.pow(1 / start, opened) },
      ],
    };
  });

  return (
    <Animated.View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden style={[{ position: 'absolute', overflow: 'hidden' }, frame]}>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: plate.width, height: plate.height }, picture]}>
        <Image source={source} contentFit="cover" style={{ width: '100%', height: '100%' }}
          onLoad={({ source: loaded }) => {
            if (loaded.width > 0 && loaded.height > 0) setRatio(loaded.width / loaded.height);
          }} />
      </Animated.View>
    </Animated.View>
  );
}
