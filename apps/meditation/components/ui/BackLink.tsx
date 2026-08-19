import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useTheme } from '@/context/ThemeContext';
import { usePressMotion } from '@/hooks/usePressMotion';

import { IconSymbol } from './icon-symbol';
import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  label: string;
  /** Where to land when there is no history — a deep link opened cold. */
  fallbackHref?: '/' | '/(tabs)' | '/search';
  className?: string;
  testID?: string;
};

/**
 * Back affordance for screens with no header. The OS gesture is not enough on
 * its own: it does not exist on Android hardware-button setups, and a
 * deep-linked screen may have nothing to go back to at all.
 */
export function BackLink({ label, fallbackHref = '/(tabs)', className, testID }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const { style, handlePressIn, handlePressOut } = usePressMotion({ surface: 'link' });

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(fallbackHref);
  };

  return (
    <View className={className}>
      <AnimatedPressable
        testID={testID}
        accessibilityRole="button"
        onPress={goBack}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        hitSlop={12}
        style={style}
        className="flex-row items-center gap-1 self-start">
        <IconSymbol name="chevron.left" color={colors.accentText} size={18} />
        <Text variant="bodySm" tone="accent">
          {label}
        </Text>
      </AnimatedPressable>
    </View>
  );
}
