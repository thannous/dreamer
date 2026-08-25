import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { useTheme } from '@/context/ThemeContext';
import { usePressMotion } from '@/hooks/usePressMotion';

import { Text, type TextTone, type TextVariant } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'md' | 'lg';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  className?: string;
  labelVariant?: TextVariant;
  labelTone?: TextTone;
  luminous?: boolean;
};

const CONTAINER: Record<ButtonVariant, string> = {
  // `champagne` is a FILL here — the label uses `champagne-on` for contrast.
  primary: 'bg-champagne border border-champagne-soft',
  secondary: 'bg-ink-card/60 border border-hairline',
  ghost: 'bg-transparent border border-transparent',
};

const LABEL_TONE: Record<ButtonVariant, TextTone> = {
  primary: 'onAccent',
  secondary: 'default',
  ghost: 'accent',
};

/**
 * Minimum heights, not fixed ones: at 200% text scaling a fixed height clips
 * the label instead of growing with it. The minimum still guarantees the 44pt
 * touch target at normal scale.
 */
const SIZE: Record<ButtonSize, string> = {
  md: 'min-h-12 px-5 py-3',
  lg: 'min-h-14 px-6 py-4',
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  label,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled,
  className,
  labelVariant = 'h3',
  labelTone,
  luminous = false,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const isInert = disabled || loading;

  const { style, handlePressIn, handlePressOut } = usePressMotion({
    surface: 'button',
    restOpacity: isInert ? 0.4 : 1,
    onPressIn,
    onPressOut,
  });

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isInert, busy: loading }}
      disabled={isInert}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={style}
      className={[
        'flex-row items-center justify-center overflow-hidden rounded-full',
        CONTAINER[variant],
        SIZE[size],
        className ?? '',
      ].join(' ')}
      {...rest}>
      {luminous && variant === 'primary' ? (
        <LinearGradient
          pointerEvents="none"
          colors={[colors.accentLight, colors.accent, colors.accent]}
          locations={[0, 0.58, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.textOnAccent : colors.accentText}
        />
      ) : (
        <View className="flex-row items-center gap-2">
          <Text variant={labelVariant} tone={labelTone ?? LABEL_TONE[variant]}>
            {label}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}
