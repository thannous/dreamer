import { Stack, router, usePathname } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { LucidSpace, LucidType, getLucidPalette } from '@/constants/lucidTheme';
import { LucidButton } from '@/components/lucid/LucidUI';
import { LucidTrainerProvider, useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import { resolveLucidOnboardingGate } from '@/lib/lucid/routes';

function LucidRouter() {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const pathname = usePathname();
  const { state, content, loading, error, reload } = useLucidTrainer();
  const pendingGateHref = useRef<string | null>(null);
  const onboardingStatus = state?.onboarding.status;

  useEffect(() => {
    const next = resolveLucidOnboardingGate({
      pathname,
      onboardingStatus,
      loading,
    });
    if (!next) {
      pendingGateHref.current = null;
      return;
    }
    if (pendingGateHref.current === next) return;
    pendingGateHref.current = next;
    router.replace(next);
  }, [loading, onboardingStatus, pathname]);

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
    <Stack
      initialRouteName="(tabs)"
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }}
    >
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
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
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: LucidSpace.lg, padding: LucidSpace.xl },
  loadingText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  error: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1], textAlign: 'center' },
  retry: { minWidth: 180, marginTop: LucidSpace.sm },
});
