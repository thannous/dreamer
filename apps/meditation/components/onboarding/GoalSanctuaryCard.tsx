import * as Haptics from 'expo-haptics';
import { Image, type ImageProps } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ScopedTheme } from 'uniwind';

import { IconSymbol, Text } from '@/components/ui';
import { Curve, Duration } from '@/constants/motion';
import { ArtworkScrim, NightTheme, Radius } from '@/constants/theme';
import { FontFamily } from '@/constants/typography';
import { usePressMotion } from '@/hooks/usePressMotion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  artwork: ImageProps['source'];
  height: number;
  label: string;
  onPress: () => void;
  selected: boolean;
  testID?: string;
};

/**
 * One illustrated destination in the goals mosaic.
 *
 * The artwork carries the emotional distinction; selection remains an
 * unambiguous checkbox with a champagne rim, so this never reads as a radio
 * group or as six decorative images.
 */
export function GoalSanctuaryCard({
  artwork,
  height,
  label,
  onPress,
  selected,
  testID,
}: Props) {
  const reducedMotion = useReducedMotion();
  const { press, scaleTo, opacityTo, handlePressIn, handlePressOut } = usePressMotion({
    surface: 'card',
  });
  const selection = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    selection.set(
      withTiming(selected ? 1 : 0, {
        duration: Duration.fast,
        easing: Curve.standard,
      })
    );
  }, [selected, selection]);

  const cardStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      selection.get(),
      [0, 1],
      [NightTheme.divider, NightTheme.accentLight]
    ),
    opacity: interpolate(press.get(), [0, 1], [1, opacityTo]),
    transform: [
      { scale: reducedMotion ? 1 : interpolate(press.get(), [0, 1], [1, scaleTo]) },
    ],
  }));

  const checkboxStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      selection.get(),
      [0, 1],
      ['rgba(3, 4, 13, 0.62)', NightTheme.accent]
    ),
    borderColor: interpolateColor(
      selection.get(),
      [0, 1],
      [NightTheme.textTertiary, NightTheme.accentLight]
    ),
  }));

  const checkStyle = useAnimatedStyle(() => ({ opacity: selection.get() }));

  const handlePress = () => {
    Haptics.selectionAsync().catch(() => {});
    onPress();
  };

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      pressRetentionOffset={12}
      style={[styles.card, { height, borderRadius: Radius.md }, cardStyle]}>
      <Image
        accessible={false}
        source={artwork}
        contentFit="cover"
        recyclingKey={`goal-${label}`}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.artworkVeil} />
      <LinearGradient
        pointerEvents="none"
        colors={[ArtworkScrim.transparent, ArtworkScrim.strong]}
        locations={[0.18, 1]}
        style={StyleSheet.absoluteFill}
      />
      <ScopedTheme theme="dark">
        <View className="flex-1 justify-between p-2">
          <View className="items-end">
            <Animated.View
              style={checkboxStyle}
              className="h-7 w-7 items-center justify-center rounded-md border">
              <Animated.View style={checkStyle}>
                <IconSymbol
                  name="checkmark"
                  size={14}
                  color={NightTheme.textOnAccent}
                  weight="semibold"
                />
              </Animated.View>
            </Animated.View>
          </View>

          <Text variant="h2" numberOfLines={3} className="px-1 pb-1" style={styles.label}>
            {label}
          </Text>
        </View>
      </ScopedTheme>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.25,
    overflow: 'hidden',
  },
  artworkVeil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(3, 4, 13, 0.14)',
  },
  label: {
    fontFamily: FontFamily.displayLight,
    fontSize: 19,
  },
});
