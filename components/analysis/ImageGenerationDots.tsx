import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

const GRID_COUNT = 31;
const GRID_SIZE = 300;
const STEP = GRID_SIZE / (GRID_COUNT - 1);

// Each wave is one SVG path rather than hundreds of animated native views.
// Crossfading two precomputed fields keeps every animation frame on the UI thread.
function dotField(phase: number): string {
  const segments: string[] = [];
  const middle = (GRID_COUNT - 1) / 2;
  for (let row = 0; row < GRID_COUNT; row += 1) {
    for (let column = 0; column < GRID_COUNT; column += 1) {
      const x = column * STEP;
      const y = row * STEP;
      const distanceX = (column - middle) / middle;
      const distanceY = (row - middle) / middle;
      const edge = Math.max(0.2, 1 - 0.42 * (distanceX ** 2 + distanceY ** 2));
      const diagonal = (1 + Math.sin(column * 0.29 + row * 0.14 + phase)) / 2;
      const counterWave = (1 + Math.sin(row * 0.24 - column * 0.17 - phase * 0.72)) / 2;
      const radius = Math.round((0.36 + edge * (0.75 * diagonal + 0.55 * counterWave)) * 10) / 10;
      const left = Math.round((x - radius) * 10) / 10;
      const diameter = Math.round(radius * 20) / 10;
      segments.push(`M${left} ${Math.round(y * 10) / 10}a${radius} ${radius} 0 1 0 ${diameter} 0a${radius} ${radius} 0 1 0 -${diameter} 0`);
    }
  }
  return segments.join('');
}

const FIELD_A = dotField(0);
const FIELD_B = dotField(2.4);
const WAVE_A = {
  animationName: { from: { opacity: 0.9 }, to: { opacity: 0.15 } },
  animationDuration: 3200,
  animationIterationCount: 'infinite',
  animationDirection: 'alternate',
  animationTimingFunction: 'ease-in-out',
} as const;
const WAVE_B = {
  animationName: { from: { opacity: 0.15 }, to: { opacity: 0.9 } },
  animationDuration: 3200,
  animationIterationCount: 'infinite',
  animationDirection: 'alternate',
  animationTimingFunction: 'ease-in-out',
} as const;

export function ImageGenerationDots({ color, size = 260, testID }: { color: string; size?: number; testID?: string }) {
  const reducedMotion = useReducedMotion();
  return (
    <View style={[styles.frame, { width: size, height: size }]} testID={testID}
      accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.layer, !reducedMotion && WAVE_A]}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${GRID_SIZE} ${GRID_SIZE}`}>
          <Path d={FIELD_A} fill={color} />
        </Svg>
      </Animated.View>
      {!reducedMotion ? (
        <Animated.View style={[styles.layer, WAVE_B]}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${GRID_SIZE} ${GRID_SIZE}`}>
            <Path d={FIELD_B} fill={color} />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'center', overflow: 'hidden' },
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
});
