import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  Lora_400Regular,
  Lora_400Regular_Italic,
  Lora_700Bold,
  Lora_700Bold_Italic,
} from '@expo-google-fonts/lora';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { DreamsProvider } from '@/context/DreamsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { configureNotificationHandler } from '@/services/notificationService';

// Prevent the splash screen from auto-hiding before fonts are loaded
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Lora_400Regular,
    Lora_400Regular_Italic,
    Lora_700Bold,
    Lora_700Bold_Italic,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      // Hide the splash screen after fonts are loaded
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    // Configure notification handler on app startup
    configureNotificationHandler();
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ErrorBoundary>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <DreamsProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="recording" options={{ headerShown: false }} />
            <Stack.Screen name="journal/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="dream-chat/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="dream-categories/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: false }} />
          </Stack>
        </DreamsProvider>
        <StatusBar style="auto" />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
