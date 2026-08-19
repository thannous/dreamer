import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useMemo, type ComponentProps } from 'react';
import { Platform, StyleSheet, useWindowDimensions, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { getLucidPalette } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function LucidTabsLayout() {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { content } = useLucidTrainer();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const labels = content.chrome.tabs;
  const compact = width < 370;

  // Expo Router applies each Screen's options in an effect. Keep the option
  // objects stable so applying them cannot trigger a setOptions/render loop.
  const tabOptions = useMemo(() => {
    const screen = (title: string, icon: IconName, testID: string) => ({
      title,
      tabBarButton: (props: ComponentProps<typeof HapticTab>) => (
        <HapticTab {...props} testID={testID} accessibilityLabel={title} />
      ),
      // L'icône reste seule dans son emplacement : le libellé est posé par le
      // navigateur, qui seul connaît la hauteur disponible sous elle.
      tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => (
        <Ionicons name={focused ? icon : (`${icon}-outline` as IconName)} size={22} color={color} />
      ),
    });

    return {
      today: screen(labels.today, 'sparkles', 'lucid-tab-today'),
      programs: screen(labels.programs, 'map', 'lucid-tab-programs'),
      night: screen(labels.night, 'moon', 'lucid-tab-night'),
      progress: screen(labels.progress, 'stats-chart', 'lucid-tab-progress'),
      settings: screen(labels.settings, 'settings', 'lucid-tab-settings'),
    };
  }, [labels.night, labels.programs, labels.progress, labels.settings, labels.today]);

  const navigatorOptions = useMemo(
    () => ({
      headerShown: false,
      sceneStyle: { backgroundColor: palette.background },
      tabBarShowLabel: true,
      tabBarLabelStyle: styles.tabLabel,
      tabBarActiveTintColor: palette.accentStrong,
      tabBarInactiveTintColor: palette.textMuted,
      tabBarHideOnKeyboard: true,
      tabBarButton: HapticTab,
      tabBarItemStyle: styles.tabBarItem,
      tabBarStyle: {
        position: 'absolute' as const,
        left: width > 760 ? (width - 720) / 2 : 12,
        right: width > 760 ? (width - 720) / 2 : 12,
        bottom: Math.max(insets.bottom, 10),
        height: compact ? 62 : 70,
        paddingTop: 7,
        paddingBottom: 6,
        paddingHorizontal: 4,
        backgroundColor: palette.overlay,
        borderTopColor: palette.border,
        borderColor: palette.border,
        borderWidth: 1,
        borderRadius: 24,
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: mode === 'dark' ? 0.38 : 0.12,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        ...(Platform.OS === 'web' ? { maxWidth: 720, alignSelf: 'center' as const } : {}),
      },
    }),
    [
      compact,
      insets.bottom,
      mode,
      palette.accentStrong,
      palette.background,
      palette.border,
      palette.overlay,
      palette.textMuted,
      width,
    ]
  );

  return (
    <Tabs screenOptions={navigatorOptions}>
      <Tabs.Screen name="index" options={tabOptions.today} />
      <Tabs.Screen name="programs" options={tabOptions.programs} />
      <Tabs.Screen name="night" options={tabOptions.night} />
      <Tabs.Screen name="progress" options={tabOptions.progress} />
      <Tabs.Screen name="settings" options={tabOptions.settings} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarItem: { height: '100%' },
  tabLabel: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 10, lineHeight: 13, textAlign: 'center' },
});
