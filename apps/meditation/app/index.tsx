import { Redirect } from 'expo-router';
import React from 'react';

import { useOnboarding } from '@/context/OnboardingContext';

/**
 * Startup router. Holds the splash (returns null) until the stored onboarding
 * state has been read, so a returning user never sees the welcome screen flash
 * before being sent home.
 */
export default function StartupRoute() {
  const { state, loaded } = useOnboarding();

  if (!loaded) return null;

  return <Redirect href={state.completed ? '/(tabs)' : '/welcome'} />;
}
