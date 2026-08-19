import React from 'react';
import { ActivityIndicator, Pressable, View, type PressableProps } from 'react-native';
import Animated from 'react-native-reanimated';

import { useTheme } from '@/context/ThemeContext';
import { usePressMotion } from '@/hooks/usePressMotion';

import { Text, type TextTone } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'md' | 'lg';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  className?: string;
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
        'flex-row items-center justify-center rounded-full',
        CONTAINER[variant],
        SIZE[size],
        className ?? '',
      ].join(' ')}
      {...rest}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.textOnAccent : colors.accentText}
        />
      ) : (
        <View className="flex-row items-center gap-2">
          <Text variant="h3" tone={LABEL_TONE[variant]}>
            {label}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}
