import '@/global.css';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Fraunces_400Regular } from '@expo-google-fonts/fraunces/400Regular';
import { Fraunces_500Medium } from '@expo-google-fonts/fraunces/500Medium';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { Lora_400Regular } from '@expo-google-fonts/lora/400Regular';
import { Lora_400Regular_Italic } from '@expo-google-fonts/lora/400Regular_Italic';
import { Lora_700Bold } from '@expo-google-fonts/lora/700Bold';
import { Lora_700Bold_Italic } from '@expo-google-fonts/lora/700Bold_Italic';
import { SpaceGrotesk_400Regular } from '@expo-google-fonts/space-grotesk/400Regular';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router/react-navigation';
import { useFonts } from 'expo-font';
import { useLocales } from 'expo-localization';
import * as Notifications from 'expo-notifications';
import { Stack, router, useNavigationContainerRef, usePathname, useRootNavigationState, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Linking, LogBox, NativeModules, Platform } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';

import AnimatedSplashScreen, {
  getSplashMinimumVisibleMs,
} from '@/components/AnimatedSplashScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AnalysisFlightIndicator } from '@/components/analysis/AnalysisFlightIndicator';
import { EngagementRemindersHost } from '@/components/reminders/EngagementRemindersHost';
import { OfflineModelPromptHost } from '@/components/speech/OfflineModelPromptHost';
import { WhatsNewModalHost } from '@/components/releases/WhatsNewModal';
import { VercelAnalytics } from '@/components/VercelAnalytics';
import { VercelSpeedInsights } from '@/components/VercelSpeedInsights';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { DreamsProvider } from '@/context/DreamsContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { OnboardingProvider, useOnboarding } from '@/context/OnboardingContext';
import { StartupRouteProvider } from '@/context/StartupRouteContext';
import { SubscriptionProvider } from '@/context/SubscriptionContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { useAppState } from '@/hooks/useAppState';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useSplashFailsafe } from '@/hooks/useSplashFailsafe';
import { useSubscriptionInitialize } from '@/hooks/useSubscriptionInitialize';
// useSubscriptionMonitor est maintenant intégré dans useSubscription
import { trackProductEvent } from '@/lib/analytics';
import { isLucidTrainer } from '@/lib/appVariant';
import { isPasswordResetPath } from '@/lib/authRoutes';
import { loadTranslations } from '@/lib/i18n';
import {
  isSafeLucidNotificationRoute,
  resolveObservedLucidWebStartupDestination,
} from '@/lib/lucid/routes';
import { isSafeAppNotificationRoute } from '@/lib/notificationRoutes';
import { normalizeAppLanguage, resolveEffectiveLanguage } from '@/lib/language';
import { createNotificationResponseTracker } from '@/lib/notificationResponse';
import {
  canReuseObservedStartupDestination,
  isStartupDestinationObserved,
  resolveExplicitStartupDestination,
  resolveStartupDecision,
  type StartupDestinationDecision,
} from '@/lib/onboardingState';
import { markPerformance } from '@/lib/performanceTrace';
import { setProductAnalyticsLocale } from '@/lib/productAnalytics';
import { scheduleAfterStartupPaint } from '@/lib/startupPaint';
import type { LanguagePreference } from '@/lib/types';
import { configureNotificationHandler } from '@/services/notificationService';
import {
  clearPendingRecordingNotification,
  getLanguagePreference,
  getPendingRecordingNotification,
  savePendingRecordingNotification,
} from '@/services/storageService';

// Expo devtools keeps the screen awake in development, which can throw when the native activity
// isn't ready (seen as "Unable to activate keep awake"). Swallow the failure to avoid red screens
// while keeping production behavior unchanged.
if (__DEV__) {
  void (async () => {
    try {
      const { requireOptionalNativeModule } = await import('expo');
      const nativeKeepAwake = requireOptionalNativeModule<{
        activate?: (...args: unknown[]) => Promise<void>;
      }>('ExpoKeepAwake');

      const originalActivate = nativeKeepAwake?.activate;

      if (nativeKeepAwake && typeof originalActivate === 'function') {
        nativeKeepAwake.activate = async (...args: Parameters<typeof originalActivate>) => {
          try {
            await originalActivate(...args);
          } catch (error) {
            console.warn('[dev] keep-awake activation failed, continuing without it', error);
          }
        };
      }
    } catch {
      // Optional module; ignore if missing in this build.
    }
  })();
}

// Prevent the splash screen from auto-hiding before fonts are loaded.
void SplashScreen.preventAutoHideAsync().catch((error) => {
  if (__DEV__) {
    console.warn('[RootLayout] Unable to keep the native splash visible', error);
  }
});

const ROOT_VIEW_STYLE = { flex: 1 } as const;

function resolveAppStartupDecision(
  input: Parameters<typeof resolveStartupDecision>[0]
): StartupDestinationDecision {
  if (!isLucidTrainer) return resolveStartupDecision(input);
  const explicit = input.defaultDestination;
  const explicitPath = typeof explicit === 'string' ? explicit : String(explicit?.pathname ?? '');
  return {
    destination: explicit && explicitPath.startsWith('/lucid') ? explicit : '/lucid',
    reason: 'default',
  };
}

function runAfterNavigationMount(callback: () => void) {
  const timeout = setTimeout(callback, 0);

  return () => {
    clearTimeout(timeout);
  };
}

if (__DEV__) {
  // Expo Router can emit this React 19 development warning while resolving the
  // async initial URL before the navigation container finishes mounting.
  // Supabase also logs a revoked persisted refresh token once before removing
  // that stale local session. Both are expected recovery paths; keep every
  // other warning and auth error visible.
  LogBox.ignoreLogs([
    "Can't perform a React state update on a component that hasn't mounted yet",
    'Invalid Refresh Token: Refresh Token Not Found',
  ]);
}

const KeyboardProviderComponent: React.ComponentType<React.PropsWithChildren> =
  Platform.OS !== 'web' && NativeModules?.KeyboardController
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react-native-keyboard-controller').KeyboardProvider
    : ({ children }) => <>{children}</>;

/**
 * Expo Router settings for this app.
 *
 * See: https://docs.expo.dev/router/reference/unstable-settings/
 */
export const unstable_settings = {
  anchor: isLucidTrainer ? 'lucid' : '(tabs)',
};

/**
 * Returns `true` once the root navigation container is fully ready.
 *
 * This is used to avoid redirects and side-effects before navigation is mounted.
 */
function useNavigationIsReady(): boolean {
  const navigationRef = useNavigationContainerRef();
  const rootNavigationState = useRootNavigationState();
  const [navigationReady, setNavigationReady] = useState(() => navigationRef.isReady());

  useEffect(() => {
    if (!rootNavigationState?.key) {
      return;
    }

    if (navigationRef.isReady()) {
      setNavigationReady(true);
      return;
    }

    const unsubscribe = navigationRef.addListener?.('state', () => {
      if (navigationRef.isReady()) {
        setNavigationReady(true);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [navigationRef, rootNavigationState?.key]);

  return navigationReady && !!rootNavigationState?.key;
}

/**
 * Navigation wrapper that applies route guards and initial redirects.
 *
 * - Redirects returning guests to settings when blocked
 * - Redirects to `/recording` on initial launch and on foreground
 * - Handles notification deep links (native only)
 */
function RootLayoutNav({
  nonCriticalStartupEnabled,
  onStartupCommitted,
}: {
  nonCriticalStartupEnabled: boolean;
  onStartupCommitted: () => void;
}) {
  const { mode } = useTheme();
  const { user, returningGuestBlocked, loading: authLoading } = useAuth();
  const {
    state: onboardingState,
    loading: onboardingLoading,
    scope: onboardingScope,
  } = useOnboarding();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const initialWebHrefRef = useRef<string | null>(
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}${window.location.hash}`
      : null
  );
  const hasInitialNavigated = useRef(false);
  const hasTrackedColdStart = useRef(false);
  const previousOnboardingScope = useRef(onboardingScope);
  const notificationMutationVersion = useRef(0);
  const notificationNavigationClaimed = useRef(false);
  const notificationResponseTracker = useMemo(
    () => createNotificationResponseTracker(),
    []
  );
  const [pendingNotificationUrl, setPendingNotificationUrl] = useState<'/recording' | null>(null);
  const [pendingLucidNotificationUrl, setPendingLucidNotificationUrl] = useState<Href | null>(null);
  const [notificationQueueLoaded, setNotificationQueueLoaded] = useState(false);
  const [initialLaunchUrl, setInitialLaunchUrl] = useState<string | null | undefined>(
    Platform.OS === 'web' ? null : undefined
  );
  const [startupDestination, setStartupDestination] = useState<Href | null>(null);
  const [startupDestinationEngaged, setStartupDestinationEngaged] = useState(false);
  const [notificationWinningDestination, setNotificationWinningDestination] =
    useState<Href | null>(null);
  const [notificationWinningEngaged, setNotificationWinningEngaged] = useState(false);
  const isNavigationReady = useNavigationIsReady();
  const startupReady =
    !authLoading &&
    !onboardingLoading &&
    notificationQueueLoaded &&
    initialLaunchUrl !== undefined;

  useSubscriptionInitialize({ enabled: nonCriticalStartupEnabled });
  // Note: useSubscriptionMonitor est maintenant intégré dans useSubscription

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let active = true;
    void Linking.getInitialURL()
      .then((url) => {
        if (active) setInitialLaunchUrl(url);
      })
      .catch((error) => {
        if (__DEV__) {
          console.warn('[RootLayoutNav] Unable to read initial launch URL', error);
        }
        if (active) setInitialLaunchUrl(null);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (previousOnboardingScope.current === onboardingScope) return;
    previousOnboardingScope.current = onboardingScope;
    hasInitialNavigated.current = false;
    setStartupDestination(null);
    setStartupDestinationEngaged(false);
  }, [onboardingScope]);

  const enqueueNotification = useCallback(async (notification: Notifications.Notification) => {
    const notificationUrl = notification.request.content.data?.url;
    if (
      notificationUrl !== '/recording' &&
      !isSafeLucidNotificationRoute(notificationUrl) &&
      !isSafeAppNotificationRoute(notificationUrl)
    ) {
      return;
    }

    const responseIdentifier = notification.request.identifier;
    if (!notificationResponseTracker.claim(responseIdentifier)) {
      markPerformance('startup.notification_response_coalesced');
      try {
        Notifications.clearLastNotificationResponse();
      } catch (error) {
        if (__DEV__) {
          console.warn('[RootLayoutNav] Unable to clear duplicate notification response', error);
        }
      }
      return;
    }

    if (isSafeLucidNotificationRoute(notificationUrl) || isSafeAppNotificationRoute(notificationUrl)) {
      // In-memory pending route (Lucid screens and the weekly recap): no
      // persisted intent, the destination is consumed once navigation is ready.
      setPendingLucidNotificationUrl(notificationUrl as Href);
      try {
        Notifications.clearLastNotificationResponse();
      } catch (error) {
        if (__DEV__) console.warn('[RootLayoutNav] Unable to clear Lucid notification response', error);
      }
      return;
    }

    const mutationVersion = notificationMutationVersion.current + 1;
    notificationMutationVersion.current = mutationVersion;
    try {
      await savePendingRecordingNotification('/recording');
      if (notificationMutationVersion.current === mutationVersion) {
        setPendingNotificationUrl('/recording');
      }
      try {
        Notifications.clearLastNotificationResponse();
      } catch (error) {
        if (__DEV__) {
          console.warn('[RootLayoutNav] Unable to clear notification response', error);
        }
      }
    } catch (error) {
      notificationResponseTracker.release(responseIdentifier);
      if (__DEV__) {
        console.warn('[RootLayoutNav] Unable to persist notification intent', error);
      }
    }
  }, [notificationResponseTracker]);

  useEffect(() => {
    let active = true;
    const restore = async () => {
      const versionAtStart = notificationMutationVersion.current;
      try {
        const storedUrl = await getPendingRecordingNotification();
        if (active && notificationMutationVersion.current === versionAtStart) {
          setPendingNotificationUrl(storedUrl);
        }

        if (Platform.OS !== 'web') {
          const response = Notifications.getLastNotificationResponse();
          if (response?.notification) {
            await enqueueNotification(response.notification);
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.warn('[RootLayoutNav] Unable to restore notification intent', error);
        }
      } finally {
        if (active) setNotificationQueueLoaded(true);
      }
    };
    void restore();

    return () => {
      active = false;
    };
  }, [enqueueNotification]);

  const consumeWinningNotification = useCallback(async () => {
    const mutationVersion = notificationMutationVersion.current + 1;
    notificationMutationVersion.current = mutationVersion;
    try {
      await clearPendingRecordingNotification();
      if (notificationMutationVersion.current === mutationVersion) {
        notificationNavigationClaimed.current = false;
        setPendingNotificationUrl(null);
        setPendingLucidNotificationUrl(null);
        setNotificationWinningDestination(null);
        setNotificationWinningEngaged(false);
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('[RootLayoutNav] Unable to consume notification intent', error);
      }
    }
  }, []);

  const engageDecision = useCallback(
    (decision: StartupDestinationDecision, options?: { startup?: boolean }) => {
      const isStartup = options?.startup === true;
      if (decision.reason === 'notification') {
        if (notificationNavigationClaimed.current) {
          markPerformance('startup.notification_navigation_coalesced');
          return;
        }
        notificationNavigationClaimed.current = true;
      }
      if (isStartup) {
        setStartupDestination(decision.destination);
        setStartupDestinationEngaged(false);
      }
      if (decision.reason === 'notification') {
        setNotificationWinningDestination(decision.destination);
        setNotificationWinningEngaged(false);
      }

      runAfterNavigationMount(() => {
        const reuseObservedRoute = canReuseObservedStartupDestination(
          decision.destination,
          pathnameRef.current
        );
        if (reuseObservedRoute) {
          markPerformance('startup.navigation_reused', { reason: decision.reason });
        } else {
          markPerformance('startup.navigation_replace', { reason: decision.reason });
          router.replace(decision.destination);
        }
        if (isStartup) setStartupDestinationEngaged(true);
        if (decision.reason === 'notification') setNotificationWinningEngaged(true);
      });
    },
    []
  );

  useEffect(() => {
    if (
      !startupDestinationEngaged ||
      !isStartupDestinationObserved(startupDestination, pathname)
    ) {
      return;
    }

    setStartupDestination(null);
    setStartupDestinationEngaged(false);
    onStartupCommitted();
    if (!hasTrackedColdStart.current) {
      hasTrackedColdStart.current = true;
      if (!isLucidTrainer) {
        InteractionManager.runAfterInteractions(() => {
          void trackProductEvent('app_session_started', { source: 'cold_start' });
        });
      }
    }
  }, [onStartupCommitted, pathname, startupDestination, startupDestinationEngaged]);

  useEffect(() => {
    if (
      !notificationWinningEngaged ||
      !isStartupDestinationObserved(notificationWinningDestination, pathname)
    ) {
      return;
    }
    void consumeWinningNotification();
  }, [
    consumeWinningNotification,
    notificationWinningDestination,
    notificationWinningEngaged,
    pathname,
  ]);

  // Guard: Redirect returning guests (account created but logged out) to settings
  useEffect(() => {
    if (isLucidTrainer || !isNavigationReady || !startupReady || !returningGuestBlocked || user) {
      return;
    }

    const currentPath = pathnameRef.current ?? pathname;
    const allowedRoutes = ['/settings', '/(tabs)/settings'];
    const isOnAllowedRoute =
      allowedRoutes.some(
        (route) => currentPath === route || currentPath?.startsWith(`${route}/`)
      ) || isPasswordResetPath(currentPath);

    if (!isOnAllowedRoute) {
      if (__DEV__) {
        console.log('[RootLayoutNav] Redirecting returning guest to settings', {
          currentPath,
        });
      }
      router.replace('/(tabs)/settings');
    }
  }, [isNavigationReady, pathname, returningGuestBlocked, startupReady, user]);

  const navigateForForeground = useCallback(
    () => {
      if (!isNavigationReady || !startupReady) {
        return;
      }

      const decision = pendingLucidNotificationUrl
        ? { destination: pendingLucidNotificationUrl, reason: 'notification' as const }
        : resolveAppStartupDecision({
        returningGuestBlocked,
        hasUser: Boolean(user),
        onboardingState,
        pendingNotificationUrl,
        });
      if (decision.reason !== 'default') {
        engageDecision(decision);
        return;
      }

      const currentPath = pathnameRef.current ?? pathname;
      const isInSettings =
        currentPath?.includes('/settings') ||
        currentPath?.startsWith('/(tabs)/settings') ||
        pathname?.startsWith('/(tabs)/settings');
      const isInPasswordReset = isPasswordResetPath(currentPath);
      const isInPaywall = currentPath === '/paywall';
      const isInJournalList =
        currentPath === '/journal' ||
        currentPath === '/(tabs)/journal';
      const isInStatistics =
        currentPath === '/statistics' ||
        currentPath === '/(tabs)/statistics';
      const isInOnboarding = currentPath === '/onboarding';
      const isInLucid = currentPath?.startsWith('/lucid');
      const isInJournalDetail =
        currentPath?.startsWith('/journal/') ||
        currentPath?.startsWith('/dream-chat/') ||
        currentPath?.startsWith('/dream-categories/') ||
        currentPath?.startsWith('/symbol-dictionary') ||
        currentPath?.startsWith('/symbol-detail/') ||
        currentPath?.startsWith('/dream-guides') ||
        currentPath?.startsWith('/dream-guide/') ||
        currentPath?.startsWith('/ritual/') ||
        currentPath?.startsWith('/sleep-sounds') ||
        currentPath?.startsWith('/weekly-recap');

      if (__DEV__) {
        console.log('[RootLayoutNav] navigateForForeground', {
          currentPath,
        });
      }

      if (isInSettings) {
        if (__DEV__) {
          console.log('[RootLayoutNav] stay on settings, skip redirect');
        }
        return;
      }

      if (isInPasswordReset) return;

      if (isInPaywall) {
        if (__DEV__) {
          console.log('[RootLayoutNav] stay on paywall, skip redirect');
        }
        return;
      }

      if (isInJournalList) {
        if (__DEV__) {
          console.log('[RootLayoutNav] stay on journal, skip redirect');
        }
        return;
      }

      if (isInStatistics) {
        if (__DEV__) {
          console.log('[RootLayoutNav] stay on statistics, skip redirect');
        }
        return;
      }

      if (isInOnboarding) {
        if (__DEV__) {
          console.log('[RootLayoutNav] stay on onboarding, skip redirect');
        }
        return;
      }

      if (isInLucid) return;

      if (isInJournalDetail) {
        if (__DEV__) {
          console.log('[RootLayoutNav] stay on journal detail, skip redirect');
        }
        return;
      }

      if (currentPath !== '/recording') {
        engageDecision(decision);
      }
    },
    [
      engageDecision,
      isNavigationReady,
      onboardingState,
      pathname,
      pendingNotificationUrl,
      pendingLucidNotificationUrl,
      returningGuestBlocked,
      startupReady,
      user,
    ]
  );

  const handleForeground = useCallback(() => {
    if (!isNavigationReady) {
      return;
    }

    if (!isLucidTrainer) {
      void trackProductEvent('app_session_started', { source: 'foreground' });
    }

    if (__DEV__) {
      console.log('[RootLayoutNav] App returned to foreground, checking recording redirect', {
        currentPath: pathnameRef.current,
      });
    }
    navigateForForeground();
  }, [isNavigationReady, navigateForForeground]);

  useAppState(handleForeground);

  useEffect(() => {
    if (!isNavigationReady || !startupReady || hasInitialNavigated.current) {
      return;
    }

    hasInitialNavigated.current = true;
    if (isPasswordResetPath(pathnameRef.current ?? pathname)) {
      // The password-recovery link must land on its own screen (web opens it
      // directly, native via app link); that screen decides where to go next.
      markPerformance('startup.navigation_reused', { reason: 'password_reset' });
      onStartupCommitted();
      return;
    }
    const explicitDestination = resolveExplicitStartupDestination(
      initialLaunchUrl,
      pathnameRef.current
    ) ??
      (Platform.OS === 'web'
        ? resolveObservedLucidWebStartupDestination(
            initialWebHrefRef.current ?? pathnameRef.current ?? pathname
          )
        : undefined);
    initialWebHrefRef.current = null;
    const decision = pendingLucidNotificationUrl
      ? { destination: pendingLucidNotificationUrl, reason: 'notification' as const }
      : resolveAppStartupDecision({
      returningGuestBlocked,
      hasUser: Boolean(user),
      onboardingState,
      pendingNotificationUrl,
      defaultDestination: explicitDestination,
    });
    engageDecision(decision, { startup: true });
  }, [
    engageDecision,
    isNavigationReady,
    initialLaunchUrl,
    onboardingState,
    onStartupCommitted,
    pathname,
    pendingNotificationUrl,
    pendingLucidNotificationUrl,
    returningGuestBlocked,
    startupReady,
    user,
  ]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        void enqueueNotification(response.notification);
      });

      return () => {
        subscription.remove();
      };
    }
  }, [enqueueNotification]);

  useEffect(() => {
    if (
      (!pendingNotificationUrl && !pendingLucidNotificationUrl) ||
      !isNavigationReady ||
      !startupReady ||
      !hasInitialNavigated.current ||
      notificationWinningDestination
    ) {
      return;
    }

    const decision = pendingLucidNotificationUrl
      ? { destination: pendingLucidNotificationUrl, reason: 'notification' as const }
      : resolveAppStartupDecision({
      returningGuestBlocked,
      hasUser: Boolean(user),
      onboardingState,
      pendingNotificationUrl,
        });
    if (decision.reason === 'notification') {
      engageDecision(decision);
    }
  }, [
    engageDecision,
    isNavigationReady,
    notificationWinningDestination,
    onboardingState,
    pendingNotificationUrl,
    pendingLucidNotificationUrl,
    returningGuestBlocked,
    startupReady,
    user,
  ]);

  return (
    <NavigationThemeProvider value={mode === 'dark' ? DarkTheme : DefaultTheme}>
      <KeyboardProviderComponent>
        <DreamsProvider>
          {/* Startup redirects happen behind the custom splash. Disabling that
              one native transition avoids scheduling transition work for a
              surface that is immediately detached; later navigation keeps the
              normal platform animation. */}
          <Stack
            screenOptions={{
              animation: nonCriticalStartupEnabled ? 'default' : 'none',
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="recording" options={{ headerShown: false }} />
            <Stack.Screen name="journal/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="dream-chat/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="dream-categories/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="symbol-dictionary" options={{ headerShown: false }} />
            <Stack.Screen name="symbol-detail/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="dream-guides" options={{ headerShown: false }} />
            <Stack.Screen name="dream-guide/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="ritual/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="lucid" options={{ headerShown: false }} />
            <Stack.Screen name="sleep-sounds" options={{ headerShown: false }} />
            <Stack.Screen name="paywall" options={{ headerShown: false }} />
            <Stack.Screen name="auth/reset-password" options={{ headerShown: false }} />
            <Stack.Screen name="weekly-recap" options={{ headerShown: false }} />
            <Stack.Screen name="dev/voice-live-spike" options={{ headerShown: false }} />
          </Stack>
          <OfflineModelPromptHost />
          <EngagementRemindersHost />
          <AnalysisFlightIndicator />
          {!isLucidTrainer ? <VercelAnalytics /> : null}
          {!isLucidTrainer ? <VercelSpeedInsights /> : null}
        </DreamsProvider>
        <SystemBars
          style={{
            statusBar: mode === 'dark' ? 'light' : 'dark',
            navigationBar: mode === 'dark' ? 'light' : 'dark',
          }}
        />
      </KeyboardProviderComponent>
    </NavigationThemeProvider>
  );
}

/**
 * App root layout.
 *
 * Bootstraps fonts and language preference, mounts providers, and renders the
 * navigation tree (plus the animated splash overlay).
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Lora_400Regular,
    Lora_400Regular_Italic,
    Lora_700Bold,
    Lora_700Bold_Italic,
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  });
  const [showCustomSplash, setShowCustomSplash] = useState(true);
  const [splashDelayElapsed, setSplashDelayElapsed] = useState(false);
  const [languageBootstrapped, setLanguageBootstrapped] = useState(false);
  const [startupDestinationCommitted, setStartupDestinationCommitted] = useState(false);
  const [startupDestinationPainted, setStartupDestinationPainted] = useState(
    Platform.OS !== 'android'
  );
  const [initialLanguagePreference, setInitialLanguagePreference] = useState<LanguagePreference>('auto');
  const splashTimedOut = useSplashFailsafe(showCustomSplash);
  const shouldShowCustomSplash = showCustomSplash;
  const fontsSettled = fontsLoaded || Boolean(fontError) || splashTimedOut;
  const prefersReducedMotion = usePrefersReducedMotion();
  const splashMinimumVisibleMs = getSplashMinimumVisibleMs(Platform.OS);
  const minimumSplashElapsed =
    prefersReducedMotion || splashTimedOut || splashDelayElapsed;
  const startupSplashPrerequisitesReady =
    minimumSplashElapsed && languageBootstrapped && startupDestinationCommitted;
  const shouldFadeSplash =
    startupSplashPrerequisitesReady && startupDestinationPainted;
  const locales = useLocales();
  const primaryLocale = locales[0];
  const hasBootstrappedLanguage = useRef(false);

  const systemLanguage = useMemo(
    () => normalizeAppLanguage(primaryLocale?.languageCode),
    [primaryLocale?.languageCode]
  );

  useEffect(() => {
    markPerformance('startup.root_mounted');
  }, []);

  useEffect(() => {
    if (hasBootstrappedLanguage.current) {
      return;
    }

    hasBootstrappedLanguage.current = true;
    let active = true;

    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    (async () => {
      try {
        const preference = await Promise.race([
          getLanguagePreference(),
          sleep(750).then(() => 'auto' as LanguagePreference),
        ]);
        if (!active) {
          return;
        }
        setInitialLanguagePreference(preference);

        const effectiveLanguage = resolveEffectiveLanguage(preference, systemLanguage);
        setProductAnalyticsLocale(effectiveLanguage);

        await Promise.race([loadTranslations(effectiveLanguage).then(() => undefined), sleep(1500)]);
      } catch (error) {
        if (__DEV__) {
          console.warn('[RootLayout] Failed to bootstrap language preference', error);
        }
      } finally {
        if (active) {
          markPerformance('startup.language_ready');
          setLanguageBootstrapped(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [systemLanguage]);

  useEffect(() => {
    if (!fontsSettled) {
      return;
    }

    const hideAsync = async () => {
      try {
        await SplashScreen.hideAsync();
        markPerformance('startup.native_splash_hidden');
      } catch (error) {
        console.warn('Unable to hide native splash screen', error);
      }
    };

    void hideAsync();
  }, [fontsSettled]);

  useEffect(() => {
    if (!fontsSettled) return;
    if (prefersReducedMotion || splashTimedOut) return;

    const timer = setTimeout(
      () => setSplashDelayElapsed(true),
      splashMinimumVisibleMs
    );
    return () => clearTimeout(timer);
  }, [fontsSettled, prefersReducedMotion, splashMinimumVisibleMs, splashTimedOut]);

  useEffect(() => {
    if (
      Platform.OS !== 'android' ||
      !startupSplashPrerequisitesReady ||
      startupDestinationPainted
    ) {
      return;
    }

    return scheduleAfterStartupPaint(() => {
      markPerformance('startup.destination_painted');
      setStartupDestinationPainted(true);
    });
  }, [startupDestinationPainted, startupSplashPrerequisitesReady]);

  useEffect(() => {
    if (!shouldFadeSplash) return;
    markPerformance('startup.custom_splash_outro_started');
  }, [shouldFadeSplash]);

  useEffect(() => {
    configureNotificationHandler();
  }, []);

  useEffect(() => {
    if (!startupDestinationCommitted) return;

    const task = InteractionManager.runAfterInteractions(() => {
      void import('@/lib/guestSession')
        .then(({ initGuestSession }) => initGuestSession())
        .catch((error) => {
          if (__DEV__) console.warn('[RootLayout] Guest session init failed:', error);
        });

      void import('@/lib/auth').then(({ initializeGoogleSignIn }) => {
        initializeGoogleSignIn();
      });

      void Promise.all([
        import('@/services/quota/GuestAnalysisCounter').then(
          ({ migrateExistingGuestQuota }) => migrateExistingGuestQuota()
        ),
        import('@/services/quota/GuestDreamCounter').then(
          ({ migrateExistingGuestDreamRecording }) => migrateExistingGuestDreamRecording()
        ),
      ]).catch((error) => {
        if (__DEV__) console.warn('[RootLayout] Guest counter migration failed:', error);
      });
    });

    return () => task.cancel();
  }, [startupDestinationCommitted]);

  const handleSplashFinished = useCallback(() => {
    markPerformance('startup.interactive');
    setShowCustomSplash(false);
  }, []);

  const handleStartupCommitted = useCallback(() => {
    markPerformance('startup.route_committed');
    setStartupDestinationCommitted(true);
  }, []);

  if (!fontsSettled) {
    return null;
  }

  return (
    <GestureHandlerRootView style={ROOT_VIEW_STYLE}>
      <ErrorBoundary>
        {languageBootstrapped ? (
          <LanguageProvider initialPreference={initialLanguagePreference}>
            <ThemeProvider>
              <AuthProvider>
                <OnboardingProvider>
                  <SubscriptionProvider>
                    <StartupRouteProvider routeCommitted={startupDestinationCommitted}>
                      <RootLayoutNav
                        nonCriticalStartupEnabled={startupDestinationCommitted}
                        onStartupCommitted={handleStartupCommitted}
                      />
                    </StartupRouteProvider>
                    <WhatsNewModalHost ready={!shouldShowCustomSplash} />
                  </SubscriptionProvider>
                </OnboardingProvider>
              </AuthProvider>
            </ThemeProvider>
          </LanguageProvider>
        ) : null}
      </ErrorBoundary>
      {shouldShowCustomSplash && (
        <AnimatedSplashScreen
          status={shouldFadeSplash ? 'outro' : 'intro'}
          // Android uses a lightweight bitmap-only implementation while iOS
          // retains the animated treatment.
          forceStatic={Platform.OS === 'android' || splashTimedOut}
          onAnimationEnd={handleSplashFinished}
        />
      )}
    </GestureHandlerRootView>
  );
}
