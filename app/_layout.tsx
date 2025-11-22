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
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
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
import { getFirstLaunchCompleted, saveFirstLaunchCompleted } from '@/services/storageService';

// Expo devtools keeps the screen awake in development, which can throw when the native activity
// isn't ready (seen as "Unable to activate keep awake"). Swallow the failure to avoid red screens
// while keeping production behavior unchanged.
if (__DEV__) {
  void import('expo-keep-awake')
    .then(({ default: keepAwakeModule }: { default?: { activate?: (...args: unknown[]) => Promise<void> } }) => {
      const originalActivate = keepAwakeModule?.activate;

      if (typeof originalActivate === 'function') {
        keepAwakeModule.activate = async (...args: Parameters<typeof originalActivate>) => {
          try {
            await originalActivate(...args);
          } catch (error) {
            console.warn('[dev] keep-awake activation failed, continuing without it', error);
          }
        };
      }
    })
    .catch(() => {
      // Optional module; ignore if missing in this build.
    });
}

// Prevent the splash screen from auto-hiding before fonts are loaded
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const { mode } = useTheme();

  useSubscriptionInitialize();
  useSubscriptionMonitor();

  useEffect(() => {
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
  }, []);

  return (
    <NavigationThemeProvider value={mode === 'dark' ? DarkTheme : DefaultTheme}>
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
          if (!isMounted) {
            return;
          }
          await NavigationBar.setBackgroundColorAsync(SurrealTheme.bgStart);
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
    if (!fontsLoaded || fontError || hasHandledFirstLaunch) {
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
  }, [fontsLoaded, fontError, hasHandledFirstLaunch]);

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
