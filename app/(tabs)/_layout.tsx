import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, View, ViewStyle, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { DesktopSidebar } from '@/components/navigation/DesktopSidebar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DESKTOP_BREAKPOINT, TAB_BAR_CONTENT_BOTTOM_PADDING, TAB_BAR_HEIGHT } from '@/constants/layout';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';

type IconName = Parameters<typeof IconSymbol>[0]['name'];

type TabPalette = {
  barBg: string;
  barBorder: string;
  text: string;
  textActive: string;
};

function TabBarItem({ label, icon, focused, palette }: {
  label: string;
  icon: IconName;
  focused: boolean;
  palette: TabPalette;
}) {
  return (
    <View style={styles.tabItem}>
      <IconSymbol
        size={24}
        name={icon}
        color={focused ? palette.textActive : palette.text}
      />
      <Text
        style={[
          styles.tabLabel,
          { color: focused ? palette.textActive : palette.text },
        ]}
        numberOfLines={1}
        ellipsizeMode="tail">
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const { colors } = useTheme();
  const { returningGuestBlocked } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const sceneBottomPadding = TAB_BAR_HEIGHT + insets.bottom + TAB_BAR_CONTENT_BOTTOM_PADDING;
  const isDesktopWeb = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;

  const palette: TabPalette = {
    barBg: colors.navbarBg,
    barBorder: colors.navbarBorder,
    text: colors.navbarTextInactive,
    textActive: colors.navbarTextActive,
  };

  const baseTabBarStyle: ViewStyle = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: palette.barBg,
    height: TAB_BAR_HEIGHT + insets.bottom,
    paddingBottom: insets.bottom,
    shadowColor: 'transparent',
  };

  // On desktop web with sidebar, hide the tab bar
  const tabBarStyle: ViewStyle | { display: 'none' } = isDesktopWeb
    ? { display: 'none' }
    : baseTabBarStyle;

  const tabs = (
    <Tabs
      screenOptions={{
        sceneStyle: {
          paddingBottom: isDesktopWeb ? 0 : sceneBottomPadding,
          backgroundColor: colors.backgroundDark,
        },
        headerShown: false,
        tabBarIconStyle: {
          flex: 1,
          width: '100%',
          height: '100%',
        },
        tabBarButton: HapticTab,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: false,
        tabBarItemStyle: {
          flex: 1,
        },
        tabBarStyle,
      }}>
      <Tabs.Screen
        name="index"
        options={returningGuestBlocked ? {
          href: null,
          title: t('nav.home'),
        } : {
          title: t('nav.home'),
          tabBarButton: (props) => (
            <HapticTab {...props} testID={TID.Tab.Home} accessibilityLabel={t('nav.home')} />
          ),
          tabBarIcon: ({ focused }) => (
            <TabBarItem icon="house" label={t('nav.home')} focused={focused} palette={palette} />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={returningGuestBlocked ? {
          href: null,
          title: t('nav.journal'),
        } : {
          title: t('nav.journal'),
          tabBarButton: (props) => (
            <HapticTab {...props} testID={TID.Tab.Journal} accessibilityLabel={t('nav.journal')} />
          ),
          tabBarIcon: ({ focused }) => (
            <TabBarItem icon="book" label={t('nav.journal')} focused={focused} palette={palette} />
          ),
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={returningGuestBlocked ? {
          href: null,
          title: t('nav.stats'),
        } : {
          title: t('nav.stats'),
          tabBarButton: (props) => (
            <HapticTab {...props} testID={TID.Tab.Stats} accessibilityLabel={t('nav.stats')} />
          ),
          tabBarIcon: ({ focused }) => (
            <TabBarItem icon="chart.bar" label={t('nav.stats')} focused={focused} palette={palette} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('nav.settings'),
          tabBarButton: (props) => (
            <HapticTab {...props} testID={TID.Tab.Settings} accessibilityLabel={t('nav.settings')} />
          ),
          tabBarIcon: ({ focused }) => (
            <TabBarItem icon="gear" label={t('nav.settings')} focused={focused} palette={palette} />
          ),
        }}
      />
    </Tabs>
  );

  // Desktop web layout with sidebar
  if (isDesktopWeb) {
    return (
      <View style={styles.desktopContainer}>
        <DesktopSidebar />
        <View style={styles.desktopContent}>
          {tabs}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.backgroundDark }}>
      {tabs}
    </View>
  );
}

const styles = StyleSheet.create({
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  desktopContent: {
    flex: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabLabel: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 10,
    letterSpacing: 0.3,
  },
});
