import '@/global.css';

import { Fraunces_400Regular } from '@expo-google-fonts/fraunces/400Regular';
import { Fraunces_500Medium } from '@expo-google-fonts/fraunces/500Medium';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { Lora_400Regular } from '@expo-google-fonts/lora/400Regular';
import { Lora_400Regular_Italic } from '@expo-google-fonts/lora/400Regular_Italic';
import { Lora_700Bold } from '@expo-google-fonts/lora/700Bold';
import { SpaceGrotesk_400Regular } from '@expo-google-fonts/space-grotesk/400Regular';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Duration } from '@/constants/motion';
import { BreathProvider } from '@/context/BreathContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { LibraryProvider } from '@/context/LibraryContext';
import { OnboardingProvider } from '@/context/OnboardingContext';
import { PlayerProvider } from '@/context/PlayerContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { SubscriptionProvider } from '@/context/SubscriptionContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash may already be hidden on fast refresh — not an error worth surfacing.
});

// RN 0.86 + Fabric can race Reanimated updates against Android native-stack
// teardown. The failure is intermittent and happens most often on rapid back
// navigation, so Android uses an immediate platform transition until the
// upstream SurfaceMountingManager issue is fixed. iOS keeps Noctalia's fade.
const rootStackMotion =
  Platform.OS === 'android'
    ? ({ animation: 'none' } as const)
    : ({
        animation: 'fade',
        animationDuration: Duration.base,
        animationMatchesGesture: true,
      } as const);

function RootNavigator() {
  const { mode, colors, loaded: themeLoaded } = useTheme();

  const [fontsLoaded, fontError] = useFonts({
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Lora_400Regular,
    Lora_400Regular_Italic,
    Lora_700Bold,
  });

  // A missing font must not strand the user on the splash screen.
  const ready = (fontsLoaded || !!fontError) && themeLoaded;

  // The native surface can briefly expose the root view while routes mount.
  // Following the resolved theme keeps that hand-off invisible in both themes.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          ...rootStackMotion,
          fullScreenGestureEnabled: false,
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LanguageProvider>
          <ThemeProvider>
            {/* One breath for the whole app — a single UI-thread animation. */}
            <BreathProvider>
              <OnboardingProvider>
                <SettingsProvider>
                  <LibraryProvider>
                    {/* Below LibraryProvider: the monthly quota is counted
                        from the practice log. */}
                    <SubscriptionProvider>
                      <PlayerProvider>
                        <RootNavigator />
                      </PlayerProvider>
                    </SubscriptionProvider>
                  </LibraryProvider>
                </SettingsProvider>
              </OnboardingProvider>
            </BreathProvider>
          </ThemeProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
