import { BlurView } from 'expo-blur';
import { Tabs, useNavigation } from 'expo-router';
import type { DrawerNavigationProp } from 'expo-router/drawer';
import React from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MiniPlayer } from '@/components/player/MiniPlayer';
import { TabBar } from '@/constants/layout';

import { IconSymbol, Text } from '@/components/ui';
import { usePressMotion } from '@/hooks/usePressMotion';
import { Radius } from '@/constants/theme';
import { FontFamily } from '@/constants/typography';
import { useTranslation } from '@/context/LanguageContext';
import { TID } from '@/lib/testIDs';
import { useChromeTheme } from '@/hooks/useChromeTheme';

/**
 * Four tabs, in a pill that floats over the screen.
 *
 * The bar is absolutely positioned so the atmosphere keeps running underneath
 * it instead of stopping at a hard edge — which is the whole reason the surface
 * reads as glass. Nothing reserves that space in layout any more, so every tab
 * screen pads its scroll view by `useTabBarInset()`.
 */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Opens the drawer from anywhere in the tabs.
 *
 * Rendered here rather than in each of the four screens: it belongs to the tab
 * shell, not to any one screen, and the top-right corner is free on all of
 * them. This layout is the drawer's own screen, so `useNavigation` hands back
 * the drawer's navigation directly — no reaching for a parent by id.
 */
function DrawerButton() {
  const { t } = useTranslation();
  const { colors, mode } = useChromeTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const { style, handlePressIn, handlePressOut } = usePressMotion({ surface: 'card' });

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={t('drawer.open')}
      onPress={() => navigation.openDrawer()}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, { position: 'absolute', right: 20, top: insets.top + 8, zIndex: 20 }]}>
      <BlurView
        intensity={mode === 'dark' ? 32 : 40}
        tint={mode === 'dark' ? 'dark' : 'light'}
        style={{
          height: 40,
          width: 40,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: Radius.full,
          borderColor: colors.navbarBorder,
          borderWidth: 1,
          backgroundColor: colors.navbarBg,
          overflow: 'hidden',
        }}>
        <IconSymbol name="line.3.horizontal" size={19} color={colors.textPrimary} />
      </BlurView>
    </AnimatedPressable>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors, mode } = useChromeTheme();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1">
      <Tabs
        screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: TabBar.height + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom,
        },
        // The pill is drawn behind the items rather than by styling the bar
        // itself: the bar has to span the full width to lay the four tabs out,
        // the pill does not.
        //
        // The one real blur in the app, and the place it earns its cost: a
        // single surface that never scrolls, sitting over content that moves
        // under it. A flat translucent fill let the text underneath ghost
        // through; frosting it is what makes the bar read as glass instead.
        tabBarBackground: () => (
          <BlurView
            intensity={mode === 'dark' ? 32 : 40}
            tint={mode === 'dark' ? 'dark' : 'light'}
            style={{
              position: 'absolute',
              left: TabBar.margin,
              right: TabBar.margin,
              top: 0,
              bottom: Math.max(insets.bottom - TabBar.margin, TabBar.margin),
              backgroundColor: colors.navbarBg,
              borderColor: colors.navbarBorder,
              borderWidth: 1,
              borderRadius: Radius.full,
              overflow: 'hidden',
            }}
          />
        ),
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: { fontFamily: FontFamily.medium, fontSize: 12 },
        tabBarIcon: ({ color }) => <IconSymbol name="house" color={color} size={22} />,
      }}>
        <Tabs.Screen
          name="index"
          options={{ title: t('tabs.home'), tabBarButtonTestID: TID.Tab.Home }}
        />
        <Tabs.Screen
          name="breathe"
          options={{
            title: t('tabs.breathe'),
            tabBarButtonTestID: TID.Tab.Breathe,
            tabBarIcon: ({ color }) => <IconSymbol name="wind" color={color} size={22} />,
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: t('tabs.search'),
            tabBarButtonTestID: TID.Tab.Search,
            tabBarIcon: ({ color }) => (
              <IconSymbol name="magnifyingglass" color={color} size={22} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('tabs.profile'),
            tabBarButtonTestID: TID.Tab.Profile,
            tabBarIcon: ({ color }) => <IconSymbol name="person" color={color} size={22} />,
          }}
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
          bottom: TabBar.height + insets.bottom + TabBar.margin,
          zIndex: 10,
        }}>
        <MiniPlayer />
      </View>

      <DrawerButton />
    </View>
  );
}

/** Re-exported so the unused import lint rule does not flag the Text kit here. */
export const TAB_LABEL_COMPONENT = Text;
