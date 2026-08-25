import { Stack } from 'expo-router';
import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getLucidPalette } from '@/constants/lucidTheme';
import { LucidButton } from '@/components/lucid/LucidUI';
import { LucidTrainerProvider, useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import { useLucidReducedMotion } from '@/hooks/useLucidReducedMotion';

function LucidRouter() {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { state, content, loading, error, reload } = useLucidTrainer();
  const reduceMotion = useLucidReducedMotion();
  const onboardingComplete = state?.onboarding.status === 'completed';
  const stackScreenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: { backgroundColor: palette.background },
      // Native stack only. Reduced motion keeps a fade so the destination still
      // explains the route change without sliding.
      animation: reduceMotion ? ('fade' as const) : ('default' as const),
    }),
    [palette.background, reduceMotion]
  );

  if (loading || !state) {
    return (
      <View style={[styles.loading, { backgroundColor: palette.background }]}>
        {loading ? <ActivityIndicator color={palette.accent} size="large" /> : null}
        <Text style={[styles.loadingText, { color: palette.textSecondary }]}>Lucid Trainer</Text>
        {error ? <Text style={[styles.error, { color: palette.danger }]}>{error}</Text> : null}
        {!loading && error ? (
          <View style={styles.retry}>
            <LucidButton label={content.chrome.common.retry} icon="refresh" onPress={() => void reload()} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <Stack initialRouteName={onboardingComplete ? '(tabs)' : 'onboarding'} screenOptions={stackScreenOptions}>
      <Stack.Protected guard={!onboardingComplete}>
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={onboardingComplete}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="program/[id]" />
        <Stack.Screen name="session/[program]/[session]" />
        <Stack.Screen name="reality-check" options={{ presentation: 'modal' }} />
        <Stack.Screen name="morning" options={{ presentation: 'modal' }} />
        <Stack.Screen name="weekly" />
        <Stack.Screen name="permissions" />
        <Stack.Screen name="science" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="data" />
        <Stack.Screen name="help" />
        <Stack.Screen name="about" />
        <Stack.Screen name="account" />
        <Stack.Screen name="subscription" />
      </Stack.Protected>
    </Stack>
  );
}

export default function LucidLayout() {
  return (
    <LucidTrainerProvider>
      <LucidRouter />
    </LucidTrainerProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  loadingText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15 },
  error: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, textAlign: 'center' },
  retry: { minWidth: 180, marginTop: 6 },
});
