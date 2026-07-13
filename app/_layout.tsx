import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import {
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  Lora_400Regular,
  Lora_400Regular_Italic,
  Lora_700Bold,
  Lora_700Bold_Italic,
} from '@expo-google-fonts/lora';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router/react-navigation';
import { useFonts } from 'expo-font';
import { useLocales } from 'expo-localization';
import * as Notifications from 'expo-notifications';
import { Stack, router, useNavigationContainerRef, usePathname, useRootNavigationState, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LogBox, NativeModules, Platform } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';

import AnimatedSplashScreen from '@/components/AnimatedSplashScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineModelPromptHost } from '@/components/speech/OfflineModelPromptHost';
import { VercelAnalytics } from '@/components/VercelAnalytics';
import { VercelSpeedInsights } from '@/components/VercelSpeedInsights';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { DreamsProvider } from '@/context/DreamsContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { OnboardingProvider, useOnboarding } from '@/context/OnboardingContext';
import { SubscriptionProvider } from '@/context/SubscriptionContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { useAppState } from '@/hooks/useAppState';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useSplashFailsafe } from '@/hooks/useSplashFailsafe';
import { useSubscriptionInitialize } from '@/hooks/useSubscriptionInitialize';
// useSubscriptionMonitor est maintenant intégré dans useSubscription
import { initializeGoogleSignIn } from '@/lib/auth';
import { configureAnalyticsProvider, trackProductEvent } from '@/lib/analytics';
import { initGuestSession } from '@/lib/guestSession';
import { loadTranslations } from '@/lib/i18n';
import { normalizeAppLanguage, resolveEffectiveLanguage } from '@/lib/language';
import {
  isStartupDestinationObserved,
  resolveStartupDecision,
  type StartupDestinationDecision,
} from '@/lib/onboardingState';
import { setProductAnalyticsLocale } from '@/lib/productAnalytics';
import type { LanguagePreference } from '@/lib/types';
import { configureNotificationHandler } from '@/services/notificationService';
import { migrateExistingGuestQuota } from '@/services/quota/GuestAnalysisCounter';
import { migrateExistingGuestDreamRecording } from '@/services/quota/GuestDreamCounter';
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
function runAfterNavigationMount(callback: () => void) {
  const timeout = setTimeout(callback, 0);

  return () => {
    clearTimeout(timeout);
  };
}

if (__DEV__) {
  // Expo Router can emit this React 19 development warning while resolving the
  // async initial URL before the navigation container finishes mounting.
  // It is outside app code and otherwise blocks device QA with a redbox.
  LogBox.ignoreLogs([
    "Can't perform a React state update on a component that hasn't mounted yet",
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
  anchor: '(tabs)',
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
function RootLayoutNav({ onStartupCommitted }: { onStartupCommitted: () => void }) {
  const { mode } = useTheme();
  const { user, returningGuestBlocked, loading: authLoading } = useAuth();
  const {
    state: onboardingState,
    loading: onboardingLoading,
    scope: onboardingScope,
  } = useOnboarding();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const hasInitialNavigated = useRef(false);
  const hasTrackedColdStart = useRef(false);
  const previousOnboardingScope = useRef(onboardingScope);
  const notificationMutationVersion = useRef(0);
  const [pendingNotificationUrl, setPendingNotificationUrl] = useState<'/recording' | null>(null);
  const [notificationQueueLoaded, setNotificationQueueLoaded] = useState(false);
  const [startupDestination, setStartupDestination] = useState<Href | null>(null);
  const [startupDestinationEngaged, setStartupDestinationEngaged] = useState(false);
  const [notificationWinningDestination, setNotificationWinningDestination] =
    useState<Href | null>(null);
  const [notificationWinningEngaged, setNotificationWinningEngaged] = useState(false);
  const isNavigationReady = useNavigationIsReady();
  const startupReady = !authLoading && !onboardingLoading && notificationQueueLoaded;

  useSubscriptionInitialize();
  // Note: useSubscriptionMonitor est maintenant intégré dans useSubscription

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (previousOnboardingScope.current === onboardingScope) return;
    previousOnboardingScope.current = onboardingScope;
    hasInitialNavigated.current = false;
    setStartupDestination(null);
    setStartupDestinationEngaged(false);
  }, [onboardingScope]);

  const enqueueNotification = useCallback(async (notification: Notifications.Notification) => {
    if (notification.request.content.data?.url !== '/recording') return;

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
      if (__DEV__) {
        console.warn('[RootLayoutNav] Unable to persist notification intent', error);
      }
    }
  }, []);

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
        setPendingNotificationUrl(null);
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
      if (isStartup) {
        setStartupDestination(decision.destination);
        setStartupDestinationEngaged(false);
      }
      if (decision.reason === 'notification') {
        setNotificationWinningDestination(decision.destination);
        setNotificationWinningEngaged(false);
      }

      runAfterNavigationMount(() => {
        router.replace(decision.destination);
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
      void trackProductEvent('app_session_started', { source: 'cold_start' });
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
    if (!isNavigationReady || !startupReady || !returningGuestBlocked || user) {
      return;
    }

    const currentPath = pathnameRef.current ?? pathname;
    const allowedRoutes = ['/settings', '/(tabs)/settings'];
    const isOnAllowedRoute = allowedRoutes.some(
      (route) => currentPath === route || currentPath?.startsWith(`${route}/`)
    );

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

      const decision = resolveStartupDecision({
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
      const isInPaywall = currentPath === '/paywall';
      const isInJournalList =
        currentPath === '/journal' ||
        currentPath === '/(tabs)/journal';
      const isInStatistics =
        currentPath === '/statistics' ||
        currentPath === '/(tabs)/statistics';
      const isInOnboarding = currentPath === '/onboarding';
      const isInJournalDetail =
        currentPath?.startsWith('/journal/') ||
        currentPath?.startsWith('/dream-chat/') ||
        currentPath?.startsWith('/dream-categories/') ||
        currentPath?.startsWith('/symbol-dictionary') ||
        currentPath?.startsWith('/symbol-detail/') ||
        currentPath?.startsWith('/ritual/');

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
      returningGuestBlocked,
      startupReady,
      user,
    ]
  );

  const handleForeground = useCallback(() => {
    if (!isNavigationReady) {
      return;
    }

    void trackProductEvent('app_session_started', { source: 'foreground' });

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
    const decision = resolveStartupDecision({
      returningGuestBlocked,
      hasUser: Boolean(user),
      onboardingState,
      pendingNotificationUrl,
    });
    engageDecision(decision, { startup: true });
  }, [
    engageDecision,
    isNavigationReady,
    onboardingState,
    pendingNotificationUrl,
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
      !pendingNotificationUrl ||
      !isNavigationReady ||
      !startupReady ||
      !hasInitialNavigated.current ||
      notificationWinningDestination
    ) {
      return;
    }

    const decision = resolveStartupDecision({
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
    returningGuestBlocked,
    startupReady,
    user,
  ]);

  return (
    <NavigationThemeProvider value={mode === 'dark' ? DarkTheme : DefaultTheme}>
      <KeyboardProviderComponent>
        <DreamsProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="recording" options={{ headerShown: false }} />
            <Stack.Screen name="journal/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="dream-chat/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="dream-categories/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="symbol-dictionary" options={{ headerShown: false }} />
            <Stack.Screen name="symbol-detail/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="ritual/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="paywall" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: false }} />
          </Stack>
          <OfflineModelPromptHost />
          <VercelAnalytics />
          <VercelSpeedInsights />
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
  const [shouldFadeSplash, setShouldFadeSplash] = useState(false);
  const [minimumSplashElapsed, setMinimumSplashElapsed] = useState(false);
  const [languageBootstrapped, setLanguageBootstrapped] = useState(false);
  const [startupDestinationCommitted, setStartupDestinationCommitted] = useState(false);
  const [initialLanguagePreference, setInitialLanguagePreference] = useState<LanguagePreference>('auto');
  const splashTimedOut = useSplashFailsafe(showCustomSplash);
  const shouldShowCustomSplash = showCustomSplash;
  const fontsSettled = fontsLoaded || Boolean(fontError) || splashTimedOut;
  const prefersReducedMotion = usePrefersReducedMotion();
  const locales = useLocales();
  const primaryLocale = locales[0];
  const hasBootstrappedLanguage = useRef(false);

  const systemLanguage = useMemo(
    () => normalizeAppLanguage(primaryLocale?.languageCode),
    [primaryLocale?.languageCode]
  );

  useEffect(() => {
    void initGuestSession();
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
      } catch (error) {
        console.warn('Unable to hide native splash screen', error);
      }
    };

    void hideAsync();
  }, [fontsSettled]);

  useEffect(() => {
    if (!fontsSettled) return;
    if (prefersReducedMotion || splashTimedOut) {
      setMinimumSplashElapsed(true);
      return;
    }

    const timer = setTimeout(() => setMinimumSplashElapsed(true), 2800);
    return () => clearTimeout(timer);
  }, [fontsSettled, prefersReducedMotion, splashTimedOut]);

  useEffect(() => {
    if (!minimumSplashElapsed || shouldFadeSplash) {
      return;
    }

    if (!languageBootstrapped || !startupDestinationCommitted) {
      return;
    }

    setShouldFadeSplash(true);
  }, [
    languageBootstrapped,
    minimumSplashElapsed,
    shouldFadeSplash,
    startupDestinationCommitted,
  ]);

  useEffect(() => {
    // Migrate existing guest quota counter (runs once, idempotent)
    migrateExistingGuestQuota().catch((err) => {
      if (__DEV__) console.warn('[RootLayout] Guest quota migration failed:', err);
    });
    migrateExistingGuestDreamRecording().catch((err) => {
      if (__DEV__) console.warn('[RootLayout] Guest dream counter migration failed:', err);
    });
  }, []);

  useEffect(() => {
    // Configure notification handler on app startup
    configureNotificationHandler();
    configureAnalyticsProvider();
    // Initialize Google Sign-In configuration early (native platforms)
    initializeGoogleSignIn();
  }, []);

  const handleSplashFinished = useCallback(() => {
    setShowCustomSplash(false);
  }, []);

  const handleStartupCommitted = useCallback(() => {
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
                    <RootLayoutNav onStartupCommitted={handleStartupCommitted} />
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
          forceStatic={splashTimedOut}
          onAnimationEnd={handleSplashFinished}
        />
      )}
    </GestureHandlerRootView>
  );
}
