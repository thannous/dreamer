import { Stack, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
  // Every onboarding scene is a night scene, whatever the device theme. Like
  // welcome, the group can stay mounted under the app, so it only owns the
  // status bar while focused.
  const isFocused = useIsFocused();

  return (
    <>
      {isFocused ? <StatusBar style="light" /> : null}
      <Stack
        screenOptions={{
          headerShown: false,
          ...onboardingStackMotion,
          fullScreenGestureEnabled: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
    </>
  );
}
