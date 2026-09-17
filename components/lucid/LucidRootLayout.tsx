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
import * as Notifications from 'expo-notifications';
import { Stack, router, usePathname, useRootNavigationState, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager, Linking, NativeModules, Platform } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import AnimatedSplashScreen, { getSplashMinimumVisibleMs } from '@/components/AnimatedSplashScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LanguageProvider, useLanguage } from '@/context/LanguageContext';
import { StartupRouteProvider } from '@/context/StartupRouteContext';
import { SubscriptionProvider } from '@/context/SubscriptionContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useSplashFailsafe } from '@/hooks/useSplashFailsafe';
import { useSubscriptionInitialize } from '@/hooks/useSubscriptionInitialize';
import { initializeGoogleSignIn } from '@/lib/auth';
import { isMockModeEnabled } from '@/lib/env';
import { loadTranslations } from '@/lib/i18n';
import { isSafeLucidNotificationRoute } from '@/lib/lucid/routes';
import { createNotificationResponseTracker } from '@/lib/notificationResponse';
import { markPerformance } from '@/lib/performanceTrace';
import { scheduleAfterStartupPaint } from '@/lib/startupPaint';
import { lucidStartupDestination, normalizedLucidDestination } from './lucidRootNavigation';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
const ROOT_VIEW_STYLE = { flex: 1 } as const;
const KeyboardProviderComponent: React.ComponentType<React.PropsWithChildren> =
  Platform.OS !== 'web' && NativeModules?.KeyboardController
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ? require('react-native-keyboard-controller').KeyboardProvider
    : ({ children }) => <>{children}</>;

function LucidRootNavigation({ nonCriticalStartupEnabled, onStartupCommitted }: {
  nonCriticalStartupEnabled: boolean; onStartupCommitted: () => void;
}) {
  const { mode } = useTheme();
  const { loading } = useAuth();
  const pathname = usePathname();
  const navigation = useRootNavigationState();
  const tracker = useRef(createNotificationResponseTracker());
  const started = useRef(false);
  const [launchUrl, setLaunchUrl] = useState<string | null | undefined>(undefined);
  const [notificationsReady, setNotificationsReady] = useState(false);
  const [pending, setPending] = useState<Href | null>(null);
  const [destination, setDestination] = useState<Href | null>(null);
  const [engaged, setEngaged] = useState<Href | null>(null);
  useSubscriptionInitialize({ enabled: nonCriticalStartupEnabled });

  useEffect(() => {
    let active = true;
    if (Platform.OS === 'web') {
      setLaunchUrl(typeof window === 'undefined' ? null : window.location.href);
    } else {
      void Linking.getInitialURL().then(
        (url) => { if (active) setLaunchUrl(url); },
        () => { if (active) setLaunchUrl(null); }
      );
    }
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') { setNotificationsReady(true); return; }
    const enqueue = (notification: Notifications.Notification) => {
      const url = notification.request.content.data?.url;
      if (!isSafeLucidNotificationRoute(url)) return;
      if (tracker.current.claim(notification.request.identifier)) setPending(url);
      else markPerformance('startup.notification_response_coalesced');
    };
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => enqueue(response.notification));
    try {
      const response = Notifications.getLastNotificationResponse();
      if (response) enqueue(response.notification);
    } catch (error) {
      if (__DEV__) console.warn('[LucidRootLayout] Notification restoration failed', error);
    } finally { setNotificationsReady(true); }
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!navigation?.key || loading || launchUrl === undefined || !notificationsReady) return;
    if (!started.current) {
      started.current = true;
      setDestination(pending ?? lucidStartupDestination(launchUrl, pathname, Platform.OS === 'web'));
    } else if (pending && pending !== engaged) setDestination(pending);
  }, [launchUrl, loading, navigation?.key, notificationsReady, pathname, pending, engaged]);

  useEffect(() => {
    if (!destination || (pending && pending !== destination)) return;
    if (engaged !== destination) {
      setEngaged(destination);
      if (String(destination).includes('?') || String(destination).includes('#') ||
          normalizedLucidDestination(destination) !== normalizedLucidDestination(pathname)) {
        router.replace(destination);
        return;
      }
    }
    if (normalizedLucidDestination(destination) === normalizedLucidDestination(pathname) ||
        (String(destination).startsWith('/lucid') && pathname === '/lucid/onboarding') ||
        (String(destination).startsWith('/auth/callback') && pathname.startsWith('/lucid'))) {
      if (pending === destination && Platform.OS !== 'web') {
        try { Notifications.clearLastNotificationResponse(); } catch { /* Retry remains harmless through the response tracker. */ }
      }
      onStartupCommitted();
      setDestination(null);
      setPending(null);
      setEngaged(null);
    }
  }, [destination, engaged, onStartupCommitted, pathname, pending]);

  return <NavigationThemeProvider value={mode === 'dark' ? DarkTheme : DefaultTheme}>
    <KeyboardProviderComponent>
      <Stack screenOptions={{ animation: nonCriticalStartupEnabled ? 'default' : 'none' }}>
        <Stack.Screen name="lucid" options={{ headerShown: false }} />
        <Stack.Screen name="auth/reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        <Stack.Screen name="auth/callback/success" options={{ headerShown: false }} />
      </Stack>
      <SystemBars style={{ statusBar: mode === 'dark' ? 'light' : 'dark', navigationBar: mode === 'dark' ? 'light' : 'dark' }} />
    </KeyboardProviderComponent>
  </NavigationThemeProvider>;
}

export default function LucidRootLayout() {
  return <LanguageProvider><LucidRootContent /></LanguageProvider>;
}

function LucidRootContent() {
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
  const { language, loaded: preferenceLoaded } = useLanguage();
  const [preferenceTimedOut, setPreferenceTimedOut] = useState(false);
  useEffect(() => {
    const timeout = setTimeout(() => setPreferenceTimedOut(true), 750);
    return () => clearTimeout(timeout);
  }, []);
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
  useEffect(() => {
    markPerformance('startup.root_mounted');
  }, []);

  useEffect(() => {
    if (!preferenceLoaded && !preferenceTimedOut) return;
    let active = true;

    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    (async () => {
      try {
        await Promise.race([loadTranslations(language).then(() => undefined), sleep(1500)]);
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
  }, [language, preferenceLoaded, preferenceTimedOut]);

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
    if (Platform.OS === 'web' || isMockModeEnabled()) return;
    Notifications.setNotificationHandler({ handleNotification: async () => ({
      shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false,
      shouldShowBanner: true, shouldShowList: true,
    }) });
  }, []);

  useEffect(() => {
    if (!startupDestinationCommitted) return;

    const task = InteractionManager.runAfterInteractions(() => {
      try { initializeGoogleSignIn(); } catch (error) {
        if (__DEV__) console.warn('[LucidRootLayout] Google initialization failed', error);
      }
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
          <>
            <ThemeProvider>
              <AuthProvider>

                  <SubscriptionProvider>
                    <StartupRouteProvider routeCommitted={startupDestinationCommitted}>
                      <LucidRootNavigation
                        nonCriticalStartupEnabled={startupDestinationCommitted}
                        onStartupCommitted={handleStartupCommitted}
                      />
                    </StartupRouteProvider>

                  </SubscriptionProvider>

              </AuthProvider>
            </ThemeProvider>
          </>
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
