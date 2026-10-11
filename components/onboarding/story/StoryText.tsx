import React from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { DURATION, EASE } from '@/components/motion/motion';

/**
 * Words that arrive one after another, as if spoken or typed. Assistive
 * technology reads the sentence once, whole; reduced motion shows it at once.
 */
export function WordReveal({ text, delay = 0, stagger = 90, style, align = 'center', caret }: {
  text: string; delay?: number; stagger?: number; style: StyleProp<TextStyle>;
  align?: 'center' | 'left' | 'right'; caret?: string;
}) {
  const reduced = useReducedMotion();
  const words = text.split(/\s+/).filter(Boolean);
  const justifyContent = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
  return <View accessible accessibilityLabel={text} style={[styles.words, { justifyContent }]}>
    {words.map((word, index) => <Animated.Text key={`${index}-${word}`} accessible={false} style={[style, {
      animationName: {
        from: { opacity: 0, ...(!reduced ? { transform: [{ translateY: 6 }] } : {}) },
        to: { opacity: 1, ...(!reduced ? { transform: [{ translateY: 0 }] } : {}) },
      },
      animationDuration: DURATION.normal,
      animationDelay: reduced ? 0 : delay + index * stagger,
      animationTimingFunction: EASE.out,
      animationFillMode: 'both',
    }]}>
      {index < words.length - 1 ? `${word} ` : word}
    </Animated.Text>)}
    {caret && !reduced ? <Caret color={caret} delay={delay + words.length * stagger} /> : null}
  </View>;
}

/** A writing cursor that keeps blinking once the words have landed. */
function Caret({ color, delay }: { color: string; delay: number }) {
  // Hidden while the words land (it would wait at the end of the line), then blinking.
  return <Animated.View accessible={false} style={[styles.caret, {
    backgroundColor: color,
    opacity: 0,
    animationName: { from: { opacity: 1 }, to: { opacity: 0 } },
    animationDuration: DURATION.slow,
    animationDelay: delay,
    animationIterationCount: 'infinite',
    animationDirection: 'alternate',
    animationTimingFunction: EASE.inOut,
    animationFillMode: 'forwards',
  }]} />;
}

/**
 * Three dots while someone is writing, gone at `hideAt` so the message can take
 * their place. Reduced motion skips the wait entirely.
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
      animationIterationCount: 'infinite',
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
