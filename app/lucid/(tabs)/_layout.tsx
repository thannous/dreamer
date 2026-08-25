import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useMemo, type ComponentProps } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { getLucidPalette } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';

type IconName = ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  icon,
  label,
  focused,
  activeColor,
  inactiveColor,
  textColor,
}: {
  icon: IconName;
  label: string;
  focused: boolean;
  activeColor: string;
  inactiveColor: string;
  textColor: string;
}) {
  return (
    <View style={styles.tabItem}>
      <Ionicons
        name={focused ? icon : (`${icon}-outline` as IconName)}
        size={22}
        color={focused ? activeColor : inactiveColor}
      />
      <Text
        numberOfLines={1}
        style={[styles.tabLabel, { color: focused ? textColor : inactiveColor }]}
      >
        {label}
      </Text>
    </View>
  );
}

export default function LucidTabsLayout() {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { content } = useLucidTrainer();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const labels = content.chrome.tabs;
  const compact = width < 370;

  // Expo Router applies each Screen's options in an effect. Keep the option
  // objects stable and the tab icons presentational. The navigator passes its
  // palette into icon renderers instead of reading context there.
  const tabOptions = useMemo(() => {
    const screen = (title: string, icon: IconName, testID: string) => ({
      title,
      tabBarButton: (props: ComponentProps<typeof HapticTab>) => (
        <HapticTab {...props} testID={testID} accessibilityLabel={title} />
      ),
      tabBarIcon: ({ focused }: { focused: boolean }) => (
        <TabIcon
          focused={focused}
          icon={icon}
          label={title}
          activeColor={palette.accentStrong}
          inactiveColor={palette.textMuted}
          textColor={palette.text}
        />
      ),
    });

    return {
      today: screen(labels.today, 'sparkles', 'lucid-tab-today'),
      programs: screen(labels.programs, 'map', 'lucid-tab-programs'),
      night: screen(labels.night, 'moon', 'lucid-tab-night'),
      progress: screen(labels.progress, 'stats-chart', 'lucid-tab-progress'),
      settings: screen(labels.settings, 'settings', 'lucid-tab-settings'),
    };
  }, [
    labels.night,
    labels.programs,
    labels.progress,
    labels.settings,
    labels.today,
    palette.accentStrong,
    palette.text,
    palette.textMuted,
  ]);

  const navigatorOptions = useMemo(
    () => ({
      headerShown: false,
      sceneStyle: { backgroundColor: palette.background },
      tabBarShowLabel: false,
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
      palette.background,
      palette.border,
      palette.overlay,
      width,
    ]
  );

  return (
    // Tabs are peers; keep the navigator default (`none`) and avoid adding
    // transition configuration to this high-frequency surface.
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
  tabItem: { flex: 1, minWidth: 46, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabLabel: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 10, maxWidth: 70, textAlign: 'center' },
});
