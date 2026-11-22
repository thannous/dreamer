import { Stack, useGlobalSearchParams, usePathname } from 'expo-router';
import React, { useMemo } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import { LucidSpace, LucidType, getLucidPalette } from '@/constants/lucidTheme';
import {
  LucidArtStatusBarProvider,
  useLucidArtStatusBarActive,
} from '@/components/lucid/LucidArtStatusBar';
import { LucidButton } from '@/components/lucid/LucidUI';
import { LucidTrainerProvider, useLucidTrainer } from '@/context/LucidTrainerContext';
import { ThemeAmbienceScope, useTheme } from '@/context/ThemeContext';
import { useLucidReducedMotion } from '@/hooks/useLucidReducedMotion';
import { LUCID_HEALTH_IMPORT_ENABLED } from '@/lib/lucid/healthKitSleep';
import { LUCID_PLUS_SALES_ENABLED } from '@/lib/lucid/plusEntitlements';
import {
  isLucidAccountPath,
  LUCID_ACCOUNT_HREF,
  LUCID_HOME_HREF,
  LUCID_ONBOARDING_HREF,
} from '@/lib/lucid/routes';
import { isThemeAmbience } from '@/lib/themeAmbience';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

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
  const {
    state,
    content,
    loading,
    error,
    reload,
    guestImportAvailable = false,
  } = useLucidTrainer();
  const pathname = usePathname();
  const reduceMotion = useLucidReducedMotion();
  const artOverStatusBar = useLucidArtStatusBarActive();
  const onboardingComplete = state?.onboarding.status === 'completed';
  const onAccountRoute = isLucidAccountPath(pathname);
  // In a native Stack, routes below `account` (like `(tabs)`) remain mounted.
  // When an active guest signs into a fresh account, `(tabs)` becomes guarded
  // immediately; redirecting to Account keeps the user on Account so they can
  // review and import their guest training instead of being sent to Step 1.
  const incompleteRedirect = onAccountRoute ? LUCID_ACCOUNT_HREF : LUCID_ONBOARDING_HREF;
  const completeRedirect = onAccountRoute && guestImportAvailable
    ? LUCID_ACCOUNT_HREF
    : LUCID_HOME_HREF;
  const iosStatusBarStyle = mode === 'dark' || artOverStatusBar
    ? ('light' as const)
    : ('dark' as const);
  const stackScreenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: { backgroundColor: palette.background },
      animation: reduceMotion ? ('fade' as const) : ('default' as const),
      ...(Platform.OS === 'ios' ? { statusBarStyle: iosStatusBarStyle } : {}),
    }),
    [iosStatusBarStyle, palette.background, reduceMotion]
  );

  if (loading || !state) {
    return (
      <View style={[styles.loading, { backgroundColor: palette.background }]}>
        {loading ? <ActivityIndicator color={palette.accent} size="large" /> : null}
        <Text style={[styles.loadingText, { color: palette.textSecondary }]}>Lucid</Text>
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
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Protected guard={!onboardingComplete} redirectTo={completeRedirect}>
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      </Stack.Protected>
      {/* Account stays reachable before and after onboarding so signing in as an
          active guest keeps the user on Account to review guest import, and
          returning users can sign in from onboarding. */}
      <Stack.Screen name="account" />
      <Stack.Protected guard={onboardingComplete} redirectTo={incompleteRedirect}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="program/[id]" />
        <Stack.Screen name="session/[program]/[session]" />
        <Stack.Screen name="reality-check" options={{ presentation: 'modal' }} />
        <Stack.Screen name="dream-signs" />
        <Stack.Screen name="dream-atlas" />
        <Stack.Screen name="dream-rehearsal" />
        <Stack.Screen name="stabilization-lab" />
        <Stack.Screen name="ssild-lab" />
        <Stack.Screen name="morning" options={{ presentation: 'modal' }} />
        <Stack.Screen name="morning-voice" />
        <Stack.Screen name="observation" />
        <Stack.Screen name="weekly" />
        <Stack.Screen name="permissions" />
        <Stack.Screen name="science" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="data" />
        <Stack.Screen name="help" />
        <Stack.Screen name="about" />
      </Stack.Protected>
      {/* v1 ships without Plus sales or Apple Health: keep deep links out too. */}
      <Stack.Protected
        guard={onboardingComplete && LUCID_HEALTH_IMPORT_ENABLED}
        redirectTo={onboardingComplete ? LUCID_HOME_HREF : incompleteRedirect}
      >
        <Stack.Screen name="sleep-integration" />
      </Stack.Protected>
      <Stack.Protected
        guard={onboardingComplete && LUCID_PLUS_SALES_ENABLED}
        redirectTo={onboardingComplete ? LUCID_HOME_HREF : incompleteRedirect}
      >
        <Stack.Screen name="subscription" />
      </Stack.Protected>
    </Stack>
  );
}

export default function LucidLayout() {
  return (
    <LucidTrainerProvider>
      <LucidThemePreview>
        <LucidArtStatusBarProvider>
          <LucidRouter />
        </LucidArtStatusBarProvider>
      </LucidThemePreview>
    </LucidTrainerProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: LucidSpace.lg, padding: LucidSpace.xl },
  loadingText: { fontFamily: 'Outfit_700Bold', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  error: { fontFamily: 'Outfit_400Regular', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1], textAlign: 'center' },
  retry: { minWidth: 180, marginTop: LucidSpace.sm },
});
