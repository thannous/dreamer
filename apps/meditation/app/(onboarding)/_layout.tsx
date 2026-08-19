import { Stack } from 'expo-router';
import React from 'react';

import { Duration } from '@/constants/motion';

/**
 * Fades only — nothing in this app slides, the back gesture included.
 * Nested stacks inherit no `screenOptions` from the root, so the transition is
 * repeated here rather than shared; four questions in a row is exactly where a
 * change of character would be noticed.
 */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        animationDuration: Duration.base,
        animationMatchesGesture: true,
        fullScreenGestureEnabled: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
}
