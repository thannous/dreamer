import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { DURATION, EASE } from '@/components/motion/motion';

/**
 * Words that arrive one after another, as if spoken or typed. Assistive
 * technology reads the sentence once, whole; reduced motion shows it at once.
 * Each word rises on a view around its text: on native, animating a text node
 * itself re-measures it and lays its ancestors out again on every frame.
 * `caretUntil` stops the caret once its scene has faded it out (ms from mount).
 */
export function WordReveal({ text, delay = 0, stagger = 90, style, align = 'center', caret, caretUntil }: {
  text: string; delay?: number; stagger?: number; style: StyleProp<TextStyle>;
  align?: 'center' | 'left' | 'right'; caret?: string; caretUntil?: number;
}) {
  const reduced = useReducedMotion();
  const words = text.split(/\s+/).filter(Boolean);
  const justifyContent = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
  const caretDelay = delay + words.length * stagger;
  return <View accessible accessibilityLabel={text} style={[styles.words, { justifyContent }]}>
    {words.map((word, index) => <Animated.View key={`${index}-${word}`} accessible={false} style={{
      animationName: {
        from: { opacity: 0, ...(!reduced ? { transform: [{ translateY: 6 }] } : {}) },
        to: { opacity: 1, ...(!reduced ? { transform: [{ translateY: 0 }] } : {}) },
      },
      animationDuration: DURATION.normal,
      animationDelay: reduced ? 0 : delay + index * stagger,
      animationTimingFunction: EASE.out,
      animationFillMode: 'both',
    }}>
      <Text accessible={false} style={style}>{index < words.length - 1 ? `${word} ` : word}</Text>
    </Animated.View>)}
    {caret && !reduced ? <Caret color={caret} delay={caretDelay}
      blinks={caretUntil === undefined ? 'infinite' : loopsUntil(caretUntil - caretDelay, DURATION.slow)} /> : null}
  </View>;
}

/** Enough iterations of `period` to cover `span` ms, so a loop never outlives what hides it. */
export const loopsUntil = (span: number, period: number) => Math.max(1, Math.ceil(span / period) + 1);

/** A writing cursor that keeps blinking once the words have landed, `blinks` times. */
function Caret({ color, delay, blinks }: { color: string; delay: number; blinks: number | 'infinite' }) {
  // Hidden while the words land (it would wait at the end of the line), then blinking.
  return <Animated.View accessible={false} style={[styles.caret, {
    backgroundColor: color,
    opacity: 0,
    animationName: { from: { opacity: 1 }, to: { opacity: 0 } },
    animationDuration: DURATION.slow,
    animationDelay: delay,
    animationIterationCount: blinks,
    animationDirection: 'alternate',
    animationTimingFunction: EASE.inOut,
    animationFillMode: 'forwards',
  }]} />;
}

/**
 * Three dots while someone is writing, gone at `hideAt` so the message can take
 * their place. They stop bouncing once hidden. Reduced motion skips the wait entirely.
 */
export function TypingDots({ color, hideAt, style }: { color: string; hideAt: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return <Animated.View accessible={false} pointerEvents="none" style={[styles.dots, style, {
    animationName: { from: { opacity: 1 }, to: { opacity: 0 } },
    animationDuration: DURATION.fast,
    animationDelay: hideAt,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  }]}>
    {[0, 1, 2].map((index) => <Animated.View key={index} style={[styles.dot, {
      backgroundColor: color,
      animationName: { from: { opacity: 0.25, transform: [{ translateY: 0 }] }, to: { opacity: 1, transform: [{ translateY: -3 }] } },
      animationDuration: DURATION.normal,
      animationDelay: index * 140,
      animationIterationCount: loopsUntil(hideAt + DURATION.fast, DURATION.normal),
      animationDirection: 'alternate',
      animationTimingFunction: EASE.inOut,
    }]} />)}
  </Animated.View>;
}

/** How long a sentence takes to arrive once its words start. */
export const wordRevealDuration = (text: string, stagger = 90) =>
  text.split(/\s+/).filter(Boolean).length * stagger + DURATION.normal;

/** When a message hidden behind typing dots should start to appear. */
export const afterTyping = (hideAt: number) => hideAt + 80;

const styles = StyleSheet.create({
  words: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  caret: { width: 2, height: 22, borderRadius: 1, marginLeft: 3 },
  dots: { position: 'absolute', flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
