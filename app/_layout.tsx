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
import * as Notifications from 'expo-notifications';
import { Stack, router, useNavigationContainerRef, usePathname, useRootNavigationState } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, NativeModules, Platform } from 'react-native';
import 'react-native-reanimated';

import AnimatedSplashScreen from '@/components/AnimatedSplashScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SurrealTheme } from '@/constants/theme';
import { AuthProvider } from '@/context/AuthContext';
import { DreamsProvider } from '@/context/DreamsContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { useSubscriptionInitialize } from '@/hooks/useSubscriptionInitialize';
import { useSubscriptionMonitor } from '@/hooks/useSubscriptionMonitor';
import { initializeGoogleSignIn } from '@/lib/auth';
import { configureNotificationHandler } from '@/services/notificationService';
import { migrateExistingGuestQuota } from '@/services/quota/GuestAnalysisCounter';
import { getFirstLaunchCompleted, saveFirstLaunchCompleted } from '@/services/storageService';

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
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const hasInitialNavigated = useRef(false);
  const isNavigationReady = useNavigationIsReady();

  useSubscriptionInitialize();
  useSubscriptionMonitor();

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!isNavigationReady) {
      return;
    }

    const navigateToRecording = (reason: 'initial' | 'appState') => {
      if (__DEV__) {
        console.log('[RootLayoutNav] navigateToRecording', {
          reason,
          currentPath: pathnameRef.current,
        });
      }
      // Do not override the settings tab – when the user is explicitly
      // managing their account we should not force navigation away,
      // which can happen when password managers trigger app focus changes.
      if (pathnameRef.current.includes('/settings')) {
        if (__DEV__) {
          console.log('[RootLayoutNav] stay on settings, skip redirect');
        }
        return;
      }
      if (pathnameRef.current !== '/recording') {
        if (__DEV__) {
          console.log('[RootLayoutNav] redirecting to /recording');
        }
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
  }, [isNavigationReady]);

  useEffect(() => {
    if (!isNavigationReady) {
      return;
    }

    function redirect(notification: Notifications.Notification) {
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
  }, [isNavigationReady]);

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
  const [hasHandledFirstLaunch, setHasHandledFirstLaunch] = useState(false);
  const isNavigationReady = useNavigationIsReady();

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
        outroTimer = setTimeout(() => setShouldFadeSplash(true), 2800);
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
    // Migrate existing guest quota counter (runs once, idempotent)
    migrateExistingGuestQuota().catch((err) => {
      if (__DEV__) console.warn('[RootLayout] Guest quota migration failed:', err);
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
        <LanguageProvider>
          <ThemeProvider>
            <AuthProvider>
              <RootLayoutNav />
            </AuthProvider>
          </ThemeProvider>
        </LanguageProvider>
      </ErrorBoundary>
      {showCustomSplash && (
        <AnimatedSplashScreen status={shouldFadeSplash ? 'outro' : 'intro'} onAnimationEnd={handleSplashFinished} />
      )}
    </>
  );
}
