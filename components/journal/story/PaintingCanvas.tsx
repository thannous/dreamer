import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';

import { brushStroke, paintSweep } from './dreamStoryMotion';

/**
 * Act III on the picture itself while the illustration is made: the canvas dims, a band of
 * light crosses it and a brush lays strokes at its centre, so the window or the plate reads
 * as being painted rather than as a picture at rest. It lies over what the canvas held and
 * never takes a press. Without a label it is decoration; the words near it carry the state.
 */
export function PaintingCanvas({ travel, ink, brush = 28, label, centre, testID }: {
  /** The canvas width: the band crosses it from one side to the other. */
  travel: number;
  /** The light and the brush. */
  ink: string;
  brush?: number;
  /** Said under the brush, where the canvas is wide enough for words. */
  label?: string;
  /** Where the brush stands, when part of the canvas is covered (the plate's title band). */
  centre?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const reduced = useReducedMotion();
  const sweep = useMemo(() => paintSweep(travel, reduced), [reduced, travel]);
  const stroke = useMemo(() => brushStroke(reduced), [reduced]);
  const disc = Math.round(brush * 1.9);

  return (
    <View testID={testID} pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View className="absolute inset-0 bg-black" style={{ opacity: 0.38 }} />
      <Animated.View className="absolute"
        style={[{ top: '-25%', bottom: '-25%', left: travel * 0.25, width: travel * 0.5 }, sweep] as StyleProp<ViewStyle>}>
        <LinearGradient start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          colors={[`${ink}00`, `${ink}73`, `${ink}00`]} style={{ width: '100%', height: '100%' }} />
      </Animated.View>
      <View className="absolute inset-0 items-center justify-center gap-3" style={centre}>
        <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
          className="items-center justify-center rounded-full bg-black/40"
          style={{ width: disc, height: disc, borderWidth: 1, borderColor: `${ink}80` }}>
          <Animated.View style={stroke as StyleProp<ViewStyle>}>
            <IconSymbol name="paintbrush.pointed.fill" size={brush} color={ink} />
          </Animated.View>
        </View>
        {label ? (
          <View className="max-w-[86%] rounded-full border border-line bg-ink-raised px-4 py-2">
            <Text accessibilityLiveRegion="polite" className="text-center font-sans-medium text-[14px] leading-5 text-ivory">
              {label}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
