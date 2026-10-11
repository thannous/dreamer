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
import { Stack, useGlobalSearchParams, usePathname, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets, SafeAreaProvider } from 'react-native-safe-area-context';

import { Duration } from '@/constants/motion';
import { LibraryPersistenceNotice } from '@/components/library/LibraryPersistenceNotice';
import { BreathProvider } from '@/context/BreathContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { LibraryProvider } from '@/context/LibraryContext';
import { OnboardingProvider } from '@/context/OnboardingContext';
import { PlayerProvider, usePlayerState } from '@/context/PlayerContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { SubscriptionProvider } from '@/context/SubscriptionContext';
import { ThemeScope, ThemeProvider, useTheme } from '@/context/ThemeContext';
import { WorldProvider, useWorld } from '@/context/WorldContext';
import { WorldPurchaseProvider } from '@/context/WorldPurchaseContext';

import { isCompactPlayerScreen, MiniPlayer } from '@/components/player/MiniPlayer';
import { CompactTabBar, TabBar } from '@/constants/layout';
import { isWorldId, WORLD_BY_ID } from '@/constants/worlds';
import { useCompactLayout } from '@/hooks/useCompactLayout';
import { accessibleTabBarHeight } from '@/hooks/useTabBarInset';

/** One compact player across tabs and session detail; never two overlays. */
function MiniPlayerDock() {
  const segments = useSegments();
  const pathname = usePathname();
  const { worldId } = useGlobalSearchParams<{ worldId?: string }>();
  const { world, presentationWorld } = useWorld();
  const { session, status } = usePlayerState();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const compact = useCompactLayout();
  const tabBar = compact ? CompactTabBar : TabBar;
  const inTabs = segments.some((segment) => segment === '(tabs)');
  const inSession = segments.some((segment) => segment === 'session');
  const visible = !!session && status !== 'idle' && status !== 'unavailable' && isCompactPlayerScreen(segments);
  const chromeWorld = (inSession || segments.some((segment) => segment === 'journey')) && worldId && isWorldId(worldId)
    ? WORLD_BY_ID[worldId]
    : inTabs && pathname === '/' ? presentationWorld : world;

  return (
    <ThemeScope mode={chromeWorld.appearance}>
      <View pointerEvents="box-none" className={!inTabs && visible ? 'bg-ink-raised' : undefined} style={inTabs ? {
        position: 'absolute', left: 0, right: 0,
        bottom: accessibleTabBarHeight(tabBar.height, fontScale) + insets.bottom + tabBar.margin,
        zIndex: 10,
      } : { paddingBottom: visible ? insets.bottom : 0 }}>
        <MiniPlayer />
      </View>
    </ThemeScope>
  );
}

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
    <View style={{ flex: 1 }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <LibraryPersistenceNotice />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          ...rootStackMotion,
          fullScreenGestureEnabled: false,
        }}
      />
      <MiniPlayerDock />
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LanguageProvider>
          <ThemeProvider>
            <WorldProvider>
              <WorldPurchaseProvider>
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
              </WorldPurchaseProvider>
            </WorldProvider>
          </ThemeProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
