import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Curve, Duration } from '@/constants/motion';
import { useTheme } from '@/context/ThemeContext';
import { usePressMotion } from '@/hooks/usePressMotion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type Props = {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
  /** Single-choice steps announce as radios, multi-choice as checkboxes. */
  mode?: 'single' | 'multiple';
  testID?: string;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * One option in an onboarding step. Selection is carried by the border and a
 * champagne mark, never by colour alone — the fill stays subtle so a screen of
 * six options does not turn into a wall of gold. Exclusive steps keep a radio
 * disc; multi-select steps keep a rounded square with a check, so a tap does
 * not look like it replaced the other choices.
 *
 * Border, fill and dot cross-fade on one curve, so the card settles as a single
 * gesture instead of four simultaneous jump cuts. The animated colours are the
 * only source for them: the matching `border-*` / `bg-*` classes are gone, not
 * merely overridden, because a class the inline style always beats is dead code
 * that desyncs the day a token moves.
 */
export function SelectableCard({
  label,
  hint,
  selected,
  onPress,
  mode = 'multiple',
  testID,
}: Props) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const exclusive = mode === 'single';
  // Same driver as the rest of the kit, consumed as a raw value: press has to
  // merge with the selection colours inside ONE style (see below).
  const { press, scaleTo, opacityTo, handlePressIn, handlePressOut } = usePressMotion({
    surface: 'card',
  });
  const sel = useSharedValue(selected ? 1 : 0);

  // Mirrored in an effect, never written during render.
  useEffect(() => {
    sel.set(withTiming(selected ? 1 : 0, { duration: Duration.fast, easing: Curve.standard }));
  }, [selected, sel]);

  /**
   * Press and selection share one style — a second `useAnimatedStyle` would
   * silently replace this `transform` rather than merge with it. The scale is
   * the shallowest of the kit: these run the full content width, six at a time,
   * and any deeper the goals step looks like it is flinching.
   */
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: reducedMotion ? 1 : interpolate(press.get(), [0, 1], [1, scaleTo]) },
    ],
    opacity: interpolate(press.get(), [0, 1], [1, opacityTo]),
    borderColor: interpolateColor(sel.get(), [0, 1], [colors.divider, colors.accent]),
    backgroundColor: interpolateColor(
      sel.get(),
      [0, 1],
      [colors.backgroundCard, colors.backgroundSecondary]
    ),
  }));

  // The ring starts on the card's own fill, so unselected reads as empty.
  const ringStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(sel.get(), [0, 1], [colors.divider, colors.accent]),
    backgroundColor: interpolateColor(sel.get(), [0, 1], [colors.backgroundCard, colors.accent]),
  }));

  // Permanently mounted: mounting it would be a jump cut inside a cross-fade.
  const dotStyle = useAnimatedStyle(() => ({ opacity: sel.get() }));

  const handlePress = () => {
    // Select and deselect alike — both are the value moving. The module is
    // optional at runtime, so the rejection is swallowed rather than left to
    // warn on every tap.
    Haptics.selectionAsync().catch(() => {});
    onPress();
  };

  return (
    <AnimatedPressable
      testID={testID}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole={exclusive ? 'radio' : 'checkbox'}
      accessibilityState={{ checked: selected }}
      // react-native-web does not map accessibilityState.checked onto
      // aria-checked; RN maps the aria prop natively, so pass both.
      aria-checked={selected}
      style={cardStyle}
      className="flex-row items-center gap-4 rounded-xl border p-gutter">
      <Animated.View
        style={ringStyle}
        className={`h-5 w-5 items-center justify-center border ${
          exclusive ? 'rounded-full' : 'rounded-sm'
        }`}>
        {exclusive ? (
          <Animated.View style={dotStyle} className="h-2 w-2 rounded-full bg-champagne-on" />
        ) : (
          <Animated.View style={dotStyle} className="items-center justify-center">
            <IconSymbol name="checkmark" size={12} color={colors.textOnAccent} />
          </Animated.View>
        )}
      </Animated.View>
      <View className="flex-1">
        <Text variant="h3">{label}</Text>
        {hint ? (
          <Text variant="bodySm" className="mt-1">
            {hint}
          </Text>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}
