import { Redirect, Stack } from 'expo-router';
import React from 'react';

import { Duration } from '@/constants/motion';
import { areAccountsEnabled } from '@/lib/env';

/**
 * The auth screens are built, but v1.0 store builds ship without accounts.
 * The gate lives here rather than on each screen, so there is exactly one place
 * that can let an unreachable sign-in button escape into a release.
 */
export default function AuthLayout() {
  if (!areAccountsEnabled()) return <Redirect href="/" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Same transition as everywhere else. The flag flips one day and this
        // stack has to already feel like the rest of the app when it does.
        animation: 'fade',
        animationDuration: Duration.base,
        animationMatchesGesture: true,
        fullScreenGestureEnabled: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
}
