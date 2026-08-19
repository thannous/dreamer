import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { usePressMotion } from '@/hooks/usePressMotion';

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
        className="self-start">
        <Text variant="bodySm" tone="accent">
          {label}
        </Text>
      </AnimatedPressable>
    </View>
  );
}
