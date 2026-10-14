import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type CSSStyle,
} from 'react-native-reanimated';

import { EASING } from '@/components/motion/motion';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';

/** A hand's pace on a title, and the bounds of the whole writing. */
const PER_CHARACTER = 42;
const SHORTEST = 700;
const LONGEST = 1700;
/** The pen lifts between two lines. */
const LINE_LIFT = 90;

const writingDuration = (text: string) => Math.min(LONGEST, Math.max(SHORTEST, text.length * PER_CHARACTER));

/**
 * A dream's title as its page names it. Until the name is known a fine ink line waits
 * where it will stand; then the name is written in, line after line, at a hand's pace.
 * The block's height follows the name it holds, so the page below makes room smoothly
 * rather than jumping. The words are laid out once, unseen, for reading, for assistive
 * technology and for the measure; the ink is that layout uncovered line by line. The
 * writing always ends, measured or not, and under reduce motion the name simply appears.
 */
export function WrittenTitle({ text, writing, onWritten, lineHeight, style, className }: {
  text: string;
  /** The name is known: write it. Until then the line waits. */
  writing: boolean;
  onWritten: () => void;
  lineHeight: number;
  style: StyleProp<TextStyle>;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const { colors, mode } = useTheme();
  const ink = useMemo(() => getNoctaliaDesignTokens(colors, mode).accent.text, [colors, mode]);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  // Each line's own width, where the platform reports the lines (not on web).
  const [lineWidths, setLineWidths] = useState<number[] | null>(null);

  const height = useSharedValue(lineHeight);
  const room = useAnimatedStyle(() => ({ height: Math.max(height.get(), lineHeight) }));

  const finished = useRef(onWritten);
  useEffect(() => { finished.current = onWritten; }, [onWritten]);
  useEffect(() => {
    if (!writing) return;
    const timer = setTimeout(() => finished.current(), reduced ? 0 : writingDuration(text) + 120);
    return () => clearTimeout(timer);
  }, [reduced, text, writing]);

  const rows = useMemo(() => {
    if (!box || reduced) return null;
    const widths = lineWidths?.length
      ? lineWidths
      : Array.from({ length: Math.max(1, Math.round(box.height / lineHeight)) }, () => box.width);
    const inked = writingDuration(text) - LINE_LIFT * (widths.length - 1);
    const total = widths.reduce((sum, width) => sum + width, 0) || 1;
    let from = 0;
    return widths.map((width) => {
      const duration = Math.max(120, (inked * width) / total);
      const row = {
        width,
        from,
        motion: {
          animationName: { from: { width: 0 }, to: { width } },
          animationDuration: duration,
          animationDelay: from,
          animationTimingFunction: 'linear',
          animationFillMode: 'both',
        } as CSSStyle<ViewStyle>,
      };
      from += duration + LINE_LIFT;
      return row;
    });
  }, [box, lineHeight, lineWidths, reduced, text]);

  // The waiting line holds one line's room; then the page makes room for each line as the pen comes to it.
  useEffect(() => {
    if (!box) return;
    if (!writing) {
      height.set(lineHeight);
      return;
    }
    if (!rows) {
      height.set(box.height);
      return;
    }
    const timers = rows.map((row, index) => setTimeout(() => {
      const room = index === rows.length - 1 ? box.height : (index + 1) * lineHeight;
      height.set(withTiming(room, { duration: 220, easing: EASING.out }));
    }, Math.max(0, row.from - 160)));
    return () => timers.forEach(clearTimeout);
  }, [box, height, lineHeight, rows, writing]);

  const waiting = useMemo(() => (reduced ? { opacity: 0.35 } : {
    animationName: { from: { opacity: 0.18 }, to: { opacity: 0.5 } },
    animationDuration: 1100,
    animationIterationCount: 'infinite',
    animationDirection: 'alternate',
    animationTimingFunction: 'ease-in-out',
  }) as CSSStyle<ViewStyle>, [reduced]);

  return (
    <Animated.View style={room}>
      <Text allowFontScaling={false} accessibilityRole="header" className={className}
        onLayout={({ nativeEvent: { layout } }) => setBox((current) => (
          current && Math.abs(current.width - layout.width) < 0.5 && Math.abs(current.height - layout.height) < 0.5
            ? current : { width: layout.width, height: layout.height }))}
        onTextLayout={({ nativeEvent }) => setLineWidths(nativeEvent.lines.map((line) => line.width))}
        style={[style, { position: 'absolute', left: 0, right: 0, top: 0, opacity: writing && (reduced || !rows) ? 1 : 0 }]}>
        {text}
      </Text>
      {!writing ? (
        <Animated.View pointerEvents="none" style={[{
          position: 'absolute', left: 0, top: lineHeight * 0.8, height: 1,
          width: Math.min(140, (box?.width ?? 280) * 0.45), backgroundColor: ink,
        }, waiting] as StyleProp<ViewStyle>} />
      ) : rows && box ? rows.map((row, index) => (
        <Animated.View key={index} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden style={[{
            position: 'absolute', left: 0, top: index * lineHeight, height: lineHeight, overflow: 'hidden',
          }, row.motion] as StyleProp<ViewStyle>}>
          <Text allowFontScaling={false} className={className}
            style={[style, { position: 'absolute', left: 0, top: -index * lineHeight, width: box.width }]}>
            {text}
          </Text>
        </Animated.View>
      )) : null}
    </Animated.View>
  );
}
