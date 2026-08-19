import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, type GestureResponderEvent, type PressableProps } from 'react-native';
import Animated from 'react-native-reanimated';

import { usePressMotion } from '@/hooks/usePressMotion';

import { Text } from './Text';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  selected?: boolean;
  className?: string;
};

/**
 * The pill is 36 pt tall for the row rhythm, which is under both platform
 * minimums. The slop lifts the target to 48 pt without touching the visual;
 * 4 pt on each side is the ceiling, since neighbours sit on an 8 pt gap and
 * anything wider would make two chips fight for the same pixels.
 */
const HIT_SLOP = { top: 6, bottom: 6, left: 4, right: 4 } as const;

/** Chips are packed tight — a thumb rolling off-centre still means the press. */
const PRESS_RETENTION = { top: 12, bottom: 12, left: 12, right: 12 } as const;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pill filter — durations, categories, themes. */
export function Chip({
  label,
  selected = false,
  className,
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  // Outside the `selected` ternary: an active filter has to answer a touch
  // exactly like an inactive one.
  const { style, handlePressIn, handlePressOut } = usePressMotion({
    surface: 'chip',
    onPressIn,
    onPressOut,
  });

  const handlePress = (event: GestureResponderEvent) => {
    // A segmented choice is a value ticking past a step — a selection tick,
    // never an impact, and never on a chip that is only a label.
    if (!onPress) return;
    // Optional native module: absent until the next native build, and an
    // ignored rejection would warn on every single tap until then.
    Haptics.selectionAsync().catch(() => {});
    onPress(event);
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={HIT_SLOP}
      pressRetentionOffset={PRESS_RETENTION}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={style}
      className={[
        'h-9 items-center justify-center rounded-full border px-4',
        selected ? 'border-champagne-soft bg-champagne' : 'border-hairline bg-ink-panel/60',
        className ?? '',
      ].join(' ')}
      {...rest}>
      <Text variant="bodySm" tone={selected ? 'onAccent' : 'muted'} className="font-medium">
        {label}
      </Text>
    </AnimatedPressable>
  );
}
