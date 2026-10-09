import { useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

/**
 * Light status-bar icons for a screen painted as a night scene whatever the
 * device theme. Screens stay mounted under the app once left, and the last
 * mounted bar wins, so this one only exists while its screen is focused; the
 * root bar, which follows the theme, takes over everywhere else.
 */
export function NightStatusBar() {
  const isFocused = useIsFocused();
  return isFocused ? <StatusBar style="light" /> : null;
}
