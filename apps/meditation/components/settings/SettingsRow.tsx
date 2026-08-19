import React from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { usePressMotion } from '@/hooks/usePressMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  label: string;
  /** Current value, shown on the right. */
  value?: string;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
};

/** One line of settings: a name, its current value, and somewhere to go. */
export function SettingsRow({ label, value, onPress, disabled = false, testID }: Props) {
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
      {value ? (
        <Text variant="bodySm" tone="accent">
          {value}
        </Text>
      ) : null}
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
