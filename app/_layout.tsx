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
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { useLocales } from 'expo-localization';
import * as Notifications from 'expo-notifications';
import { Stack, router, useNavigationContainerRef, usePathname, useRootNavigationState } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, NativeModules, Platform } from 'react-native';
import 'react-native-reanimated';

import AnimatedSplashScreen from '@/components/AnimatedSplashScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineModelPromptHost } from '@/components/speech/OfflineModelPromptHost';
import { SurrealTheme } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { DreamsProvider } from '@/context/DreamsContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { useSubscriptionInitialize } from '@/hooks/useSubscriptionInitialize';
import { useSubscriptionMonitor } from '@/hooks/useSubscriptionMonitor';
import { initializeGoogleSignIn } from '@/lib/auth';
import { loadTranslations } from '@/lib/i18n';
import { normalizeAppLanguage, resolveEffectiveLanguage } from '@/lib/language';
import type { LanguagePreference } from '@/lib/types';
import { configureNotificationHandler } from '@/services/notificationService';
import { migrateExistingGuestQuota } from '@/services/quota/GuestAnalysisCounter';
import { migrateExistingGuestDreamRecording } from '@/services/quota/GuestDreamCounter';
import { getFirstLaunchCompleted, getLanguagePreference, saveFirstLaunchCompleted } from '@/services/storageService';

// Expo devtools keeps the screen awake in development, which can throw when the native activity
// isn't ready (seen as "Unable to activate keep awake"). Swallow the failure to avoid red screens
// while keeping production behavior unchanged.
if (__DEV__) {
  void (async () => {
    try {
      const { requireOptionalNativeModule } = await import('expo-modules-core');
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

// Prevent the splash screen from auto-hiding before fonts are loaded
SplashScreen.preventAutoHideAsync();

const KeyboardProviderComponent: React.ComponentType<React.PropsWithChildren> =
  Platform.OS !== 'web' && NativeModules?.KeyboardController
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('react-native-keyboard-controller').KeyboardProvider
    : ({ children }) => <>{children}</>;

export const unstable_settings = {
  anchor: '(tabs)',
};

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

function RootLayoutNav() {
  const { mode } = useTheme();
  const { user, returningGuestBlocked } = useAuth();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const hasInitialNavigated = useRef(false);
  const isNavigationReady = useNavigationIsReady();

  useSubscriptionInitialize();
  useSubscriptionMonitor();

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Guard: Redirect returning guests (account created but logged out) to settings
  useEffect(() => {
    if (!isNavigationReady || !returningGuestBlocked || user) {
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
  }, [isNavigationReady, returningGuestBlocked, user, pathname]);

  useEffect(() => {
    if (!isNavigationReady) {
      return;
    }

    const navigateToRecording = (reason: 'initial' | 'appState') => {
      // Don't navigate to recording if returning guest is blocked
      if (returningGuestBlocked && !user) {
        if (__DEV__) {
          console.log('[RootLayoutNav] skip recording redirect, returning guest blocked');
        }
        return;
      }

      const currentPath = pathnameRef.current ?? pathname;
      const isInSettings =
        currentPath?.includes('/settings') ||
        currentPath?.startsWith('/(tabs)/settings') ||
        pathname?.startsWith('/(tabs)/settings');
      const isInPaywall = currentPath === '/paywall';
      const isInJournalDetail =
        currentPath?.startsWith('/journal/') ||
        currentPath?.startsWith('/dream-chat/') ||
        currentPath?.startsWith('/dream-categories/');

      if (__DEV__) {
        console.log('[RootLayoutNav] navigateToRecording', {
          reason,
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

      if (isInJournalDetail) {
        if (__DEV__) {
          console.log('[RootLayoutNav] stay on journal detail, skip redirect');
        }
        return;
      }

      if (currentPath !== '/recording') {
        router.replace('/recording');
      }
    };

    // Only navigate to recording on initial app launch, not on subsequent
    // isNavigationReady changes (e.g., language change causing navigation state reset)
    if (!hasInitialNavigated.current) {
      hasInitialNavigated.current = true;
      navigateToRecording('initial');
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (__DEV__) {
        console.log('[RootLayoutNav] AppState change', {
          state,
          currentPath: pathnameRef.current,
        });
      }
      if (state === 'active') {
        navigateToRecording('appState');
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isNavigationReady, pathname, returningGuestBlocked, user]);

  useEffect(() => {
    if (!isNavigationReady) {
      return;
    }

    function redirect(notification: Notifications.Notification) {
      // Don't allow deep linking if returning guest is blocked
      if (returningGuestBlocked && !user) {
        if (__DEV__) {
          console.log('[RootLayoutNav] Blocking notification deep link for returning guest');
        }
        router.replace('/(tabs)/settings');
        return;
      }

      const url = notification.request.content.data?.url;

      // For now we only support deep linking into the recording screen
      if (url === '/recording') {
        router.push('/recording');
      }
    }

    if (Platform.OS !== 'web') {
      const response = Notifications.getLastNotificationResponse();
      if (response?.notification) {
        redirect(response.notification);
      }

      const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        redirect(response.notification);
      });

      return () => {
        subscription.remove();
      };
    }
  }, [isNavigationReady, returningGuestBlocked, user]);

  return (
    <NavigationThemeProvider value={mode === 'dark' ? DarkTheme : DefaultTheme}>
      <KeyboardProviderComponent>
        <DreamsProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="recording" options={{ headerShown: false }} />
            <Stack.Screen name="journal/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="dream-chat/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="dream-categories/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="paywall" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: false }} />
          </Stack>
          <OfflineModelPromptHost />
        </DreamsProvider>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      </KeyboardProviderComponent>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Lora_400Regular,
    Lora_400Regular_Italic,
    Lora_700Bold,
    Lora_700Bold_Italic,
  });
  const [showCustomSplash, setShowCustomSplash] = useState(true);
  const [shouldFadeSplash, setShouldFadeSplash] = useState(false);
  const [minimumSplashElapsed, setMinimumSplashElapsed] = useState(false);
  const [languageBootstrapped, setLanguageBootstrapped] = useState(false);
  const [initialLanguagePreference, setInitialLanguagePreference] = useState<LanguagePreference>('auto');
  const [hasHandledFirstLaunch, setHasHandledFirstLaunch] = useState(false);
  const isNavigationReady = useNavigationIsReady();
  const locales = useLocales();
  const primaryLocale = locales[0];
  const hasBootstrappedLanguage = useRef(false);

  const systemLanguage = useMemo(
    () => normalizeAppLanguage(primaryLocale?.languageCode),
    [primaryLocale?.languageCode]
  );

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
    if (!fontsLoaded && !fontError) {
      return;
    }

    let outroTimer: ReturnType<typeof setTimeout> | undefined;

    const hideAsync = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (error) {
        console.warn('Unable to hide native splash screen', error);
      } finally {
        // Wait for the new 3s animation to mostly complete (Phase 1+2 = 1.8s, + part of 3)
        outroTimer = setTimeout(() => setMinimumSplashElapsed(true), 2800);
      }
    };

    hideAsync();

    return () => {
      if (outroTimer) {
        clearTimeout(outroTimer);
      }
    };
  }, [fontError, fontsLoaded]);

  useEffect(() => {
    if (!minimumSplashElapsed || shouldFadeSplash) {
      return;
    }

    if (!languageBootstrapped) {
      return;
    }

    setShouldFadeSplash(true);
  }, [languageBootstrapped, minimumSplashElapsed, shouldFadeSplash]);

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
    let isMounted = true;

    // Configure notification handler on app startup
    configureNotificationHandler();
    // Initialize Google Sign-In configuration early (native platforms)
    initializeGoogleSignIn();

    // Configure Android navigation bar to match app theme lazily to avoid importing
    // native-only modules on unsupported platforms (e.g., web builds).
    if (Platform.OS === 'android') {
      (async () => {
        try {
          const NavigationBar = await import('expo-navigation-bar');
          const { isEdgeToEdge } = await import('react-native-is-edge-to-edge');
          if (!isMounted) {
            return;
          }
          if (!isEdgeToEdge()) {
            await NavigationBar.setBackgroundColorAsync(SurrealTheme.bgStart);
          }
          await NavigationBar.setButtonStyleAsync('light');
        } catch (error) {
          if (__DEV__) {
            console.warn('[RootLayout] Failed to configure Android navigation bar', error);
          }
        }
      })();
    }

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isNavigationReady || !fontsLoaded || fontError || hasHandledFirstLaunch) {
      return;
    }

    let isMounted = true;

    (async () => {
      try {
        const completed = await getFirstLaunchCompleted();
        if (!isMounted) return;

        if (!completed) {
          await saveFirstLaunchCompleted(true);
          if (!isMounted) return;
          router.replace('/recording');
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[RootLayout] Failed to handle first launch redirect', error);
        }
      } finally {
        if (isMounted) {
          setHasHandledFirstLaunch(true);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isNavigationReady, fontsLoaded, fontError, hasHandledFirstLaunch]);

  const handleSplashFinished = useCallback(() => {
    setShowCustomSplash(false);
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <>
      <ErrorBoundary>
        {languageBootstrapped ? (
          <LanguageProvider initialPreference={initialLanguagePreference}>
            <ThemeProvider>
              <AuthProvider>
                <RootLayoutNav />
              </AuthProvider>
            </ThemeProvider>
          </LanguageProvider>
        ) : null}
      </ErrorBoundary>
      {showCustomSplash && (
        <AnimatedSplashScreen status={shouldFadeSplash ? 'outro' : 'intro'} onAnimationEnd={handleSplashFinished} />
      )}
    </>
  );
}
