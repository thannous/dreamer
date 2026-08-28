import React from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
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
  const { fontScale } = useWindowDimensions();
  const { colors } = useTheme();
  const stackValue = fontScale >= 1.5 && !!value;
  const interactive = Boolean(onPress);
  const { style, handlePressIn, handlePressOut } = usePressMotion({
    surface: 'card',
    restOpacity: disabled ? 0.4 : 1,
  });

  const rowClassName = [
    'border-b border-hairline px-gutter py-4',
    stackValue ? 'gap-2' : 'flex-row items-center justify-between',
  ].join(' ');
  const accessibilityLabel = value ? `${label}. ${value}` : label;

  const content = (
    <>
      <Text variant="body" className={stackValue ? '' : 'flex-1'}>
        {label}
      </Text>
      <View
        className={[
          'flex-shrink-0 flex-row items-center gap-2',
          stackValue ? 'justify-end' : 'ml-3',
        ].join(' ')}>
        {value ? (
          <Text variant="bodySm" tone="accent">
            {value}
          </Text>
        ) : null}
        {/* Only rows that lead somewhere get the chevron: it promises a screen,
            and the theme row cycles in place. */}
        {interactive && !inline ? (
          <IconSymbol name="chevron.right" color={colors.textTertiary} size={18} />
        ) : null}
      </View>
    </>
  );

  if (!interactive) {
    // A disabled Pressable still lands in Android as clickable/focusable.
    // Static facts such as Reduce animations must be a real View.
    return (
      <View
        testID={testID}
        accessible
        accessibilityRole="text"
        accessibilityLabel={accessibilityLabel}
        className={rowClassName}>
        {content}
      </View>
    );
  }

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={style}
      className={rowClassName}>
      {content}
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
