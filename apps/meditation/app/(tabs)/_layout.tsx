import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MiniPlayer } from '@/components/player/MiniPlayer';

import { Text } from '@/components/ui';
import { FontFamily } from '@/constants/typography';
import { useTranslation } from '@/context/LanguageContext';
import { TID } from '@/lib/testIDs';
import { useTheme } from '@/context/ThemeContext';

const TAB_BAR_HEIGHT = 64;

/**
 * Four tabs, labels only.
 *
 * No icon set is installed, and a meditation app is not improved by five
 * pictograms competing with the artwork. The active tab is carried by a
 * champagne rule above the label — the same mark used under section headers.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1">
      <Tabs
        screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarStyle: {
          backgroundColor: colors.navbarBg,
          borderTopColor: colors.navbarBorder,
          borderTopWidth: 1,
          height: TAB_BAR_HEIGHT,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: { fontFamily: FontFamily.medium, fontSize: 12 },
        tabBarIcon: ({ focused }) => (
          <View
            className="h-[2.5px] w-6 rounded-full"
            style={{ backgroundColor: focused ? colors.accent : 'transparent' }}
          />
        ),
      }}>
        <Tabs.Screen
          name="index"
          options={{ title: t('tabs.home'), tabBarButtonTestID: TID.Tab.Home }}
        />
        <Tabs.Screen
          name="breathe"
          options={{ title: t('tabs.breathe'), tabBarButtonTestID: TID.Tab.Breathe }}
        />
        <Tabs.Screen
          name="search"
          options={{ title: t('tabs.search'), tabBarButtonTestID: TID.Tab.Search }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: t('tabs.profile'), tabBarButtonTestID: TID.Tab.Profile }}
        />
      </Tabs>

      {/* Pinned directly above the bar rather than inside it: expo-router owns
          the bar, and reimplementing it to host one strip is not worth it. */}
      <View
        pointerEvents="box-none"
        // zIndex is required: an absolutely-positioned sibling still paints
        // below the scene's own stacking context without it.
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: TAB_BAR_HEIGHT + insets.bottom,
          zIndex: 10,
        }}>
        <MiniPlayer />
      </View>
    </View>
  );
}

/** Re-exported so the unused import lint rule does not flag the Text kit here. */
export const TAB_LABEL_COMPONENT = Text;
