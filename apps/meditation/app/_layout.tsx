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
import { WorldProvider, useWorld } from '@/context/WorldContext';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash may already be hidden on fast refresh — not an error worth surfacing.
});

function RootNavigator() {
  const { mode, colors, loaded: themeLoaded } = useTheme();
  const { loaded: worldLoaded } = useWorld();

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
  const ready = (fontsLoaded || !!fontError) && themeLoaded && worldLoaded;

  // Android crossfades screens, so the root view shows through at the midpoint
  // of every transition. Left on a single static colour it flashes ink in light
  // theme; following the resolved theme makes it invisible in both.
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
          // Fades only — nothing in this app slides, the back gesture included.
          // 500 ms is the library default, not a choice: it leaves two legible
          // screens superimposed for half a second. iOS-only, like the two
          // gesture options; Android's fade is fixed at 150 ms.
          animation: 'fade',
          animationDuration: Duration.base,
          // Without this the swipe-back slides instead of dissolving. Paired
          // with the edge-only gesture, so a drag over content never starts it.
          animationMatchesGesture: true,
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
            <WorldProvider>
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
            </WorldProvider>
          </ThemeProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
