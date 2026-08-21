import { Stack } from 'expo-router';
import React from 'react';

/** Fades only — nothing in this app slides. */
export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
}
