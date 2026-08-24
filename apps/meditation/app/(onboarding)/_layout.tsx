import { Stack } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { Duration } from '@/constants/motion';

const onboardingStackMotion =
  Platform.OS === 'android'
    ? ({ animation: 'none' } as const)
    : ({
        animation: 'fade',
        animationDuration: Duration.base,
        animationMatchesGesture: true,
      } as const);

/**
 * Nested stacks inherit no `screenOptions` from the root. iOS repeats the
 * Noctalia fade; Android stays immediate to avoid the RN 0.86/Fabric teardown
 * race triggered by rapid consecutive back actions.
 */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        ...onboardingStackMotion,
        fullScreenGestureEnabled: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
}
