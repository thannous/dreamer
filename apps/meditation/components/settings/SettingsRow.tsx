import React from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { IconSymbol, Text } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';
import { usePressMotion } from '@/hooks/usePressMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  label: string;
  /** Current value, shown on the right. */
  value?: string;
  onPress?: () => void;
  disabled?: boolean;
  /** The row acts in place instead of opening a screen — no chevron. */
  inline?: boolean;
  testID?: string;
};

/** One line of settings: a name, its current value, and somewhere to go. */
export function SettingsRow({
  label,
  value,
  onPress,
  disabled = false,
  inline = false,
  testID,
}: Props) {
  const { colors } = useTheme();
  const { style, handlePressIn, handlePressOut } = usePressMotion({
    surface: 'card',
    restOpacity: disabled ? 0.4 : 1,
  });

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={style}
      className="flex-row items-center justify-between border-b border-hairline px-gutter py-4">
      <Text variant="body">{label}</Text>
      <View className="flex-row items-center gap-2">
        {value ? (
          <Text variant="bodySm" tone="accent">
            {value}
          </Text>
        ) : null}
        {/* Only rows that lead somewhere get the chevron: it promises a screen,
            and the theme row cycles in place. */}
        {onPress && !inline ? (
          <IconSymbol name="chevron.right" color={colors.textTertiary} size={18} />
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

/** Groups rows under a quiet heading. */
export function SettingsGroup({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <View className="gap-2">
      <Text variant="overline" className="px-gutter">
        {title}
      </Text>
      <View className="overflow-hidden rounded-xl border border-hairline bg-ink-card">
        {children}
      </View>
    </View>
  );
}
