import { Stack, useGlobalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { LucidSpace, LucidType, getLucidPalette } from '@/constants/lucidTheme';
import { LucidButton } from '@/components/lucid/LucidUI';
import { LucidTrainerProvider, useLucidTrainer } from '@/context/LucidTrainerContext';
import { ThemeAmbienceScope, useTheme } from '@/context/ThemeContext';
import { useLucidReducedMotion } from '@/hooks/useLucidReducedMotion';
import { isThemeAmbience } from '@/lib/themeAmbience';

function LucidThemePreview({ children }: React.PropsWithChildren) {
  const params = useGlobalSearchParams<{ ambience?: string | string[] }>();
  const requestedAmbience = Array.isArray(params.ambience)
    ? params.ambience[0]
    : params.ambience;

  if (!__DEV__ || !isThemeAmbience(requestedAmbience)) {
    return children;
  }

  return (
    <ThemeAmbienceScope ambience={requestedAmbience}>
      {children}
    </ThemeAmbienceScope>
  );
}

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
        <Stack.Screen name="dream-signs" />
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
      <LucidThemePreview>
        <LucidRouter />
      </LucidThemePreview>
    </LucidTrainerProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: LucidSpace.lg, padding: LucidSpace.xl },
  loadingText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  error: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1], textAlign: 'center' },
  retry: { minWidth: 180, marginTop: LucidSpace.sm },
});
