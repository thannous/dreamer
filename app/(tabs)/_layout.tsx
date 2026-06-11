import { Tabs, router } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, View, ViewStyle, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { DesktopSidebar } from '@/components/navigation/DesktopSidebar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DESKTOP_BREAKPOINT, TAB_BAR_HEIGHT } from '@/constants/layout';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';

type IconName = Parameters<typeof IconSymbol>[0]['name'];

type TabPalette = {
  barBg: string;
  barBorder: string;
  accent: string;
  accentLight: string;
  textOnAccentSurface: string;
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

function AddDreamTabItem({ label, palette }: {
  label: string;
  palette: TabPalette;
}) {
  return (
    <View
      style={[
        styles.addTabItem,
        {
          backgroundColor: palette.accent,
          borderColor: palette.accentLight,
        },
      ]}
    >
      <View
        style={styles.addTabIconShell}
      >
        <IconSymbol
          size={24}
          name="pencil"
          color={palette.textOnAccentSurface}
        />
      </View>
      <Text
        style={[styles.addTabLabel, { color: palette.textActive }]}
        numberOfLines={1}
        ellipsizeMode="tail">
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const { colors, mode } = useTheme();
  const { returningGuestBlocked } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const floatingBottomInset = Math.max(insets.bottom, 14);
  const isDesktopWeb = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;

  const palette: TabPalette = {
    barBg: mode === 'dark' ? 'rgba(31, 22, 54, 0.97)' : colors.navbarBg,
    barBorder: colors.navbarBorder,
    accent: colors.accent,
    accentLight: colors.accentLight,
    textOnAccentSurface: colors.textOnAccentSurface,
    text: colors.navbarTextInactive,
    textActive: colors.navbarTextActive,
  };

  const handleAddDreamPress = () => {
    router.push('/recording');
  };

  const baseTabBarStyle: ViewStyle = {
    position: 'absolute',
    bottom: floatingBottomInset,
    left: 22,
    right: 22,
    backgroundColor: palette.barBg,
    height: TAB_BAR_HEIGHT,
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 7,
    borderRadius: 36,
    borderWidth: 1,
    borderTopColor: palette.barBorder,
    borderColor: palette.barBorder,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 14,
    overflow: 'visible',
  };

  // On desktop web with sidebar, hide the tab bar
  const tabBarStyle: ViewStyle | { display: 'none' } = isDesktopWeb
    ? { display: 'none' }
    : baseTabBarStyle;

  const tabs = (
    <Tabs
      screenOptions={{
        sceneStyle: {
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
          height: '100%',
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
        name="add-dream"
        options={returningGuestBlocked ? {
          href: null,
          title: t('nav.add_dream'),
        } : {
          title: t('journal.add_button.label'),
          tabBarButton: (props) => (
            <HapticTab
              {...props}
              onPress={handleAddDreamPress}
              testID={TID.Tab.AddDream}
              accessibilityLabel={t('journal.add_button.accessibility')}
            />
          ),
          tabBarIcon: () => (
            <AddDreamTabItem label={t('nav.add_dream')} palette={palette} />
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
    gap: 5,
  },
  tabLabel: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
    letterSpacing: 0,
  },
  addTabItem: {
    width: 72,
    height: 76,
    borderRadius: 27,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    transform: [{ translateY: -8 }],
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 8,
  },
  addTabIconShell: {
    width: 32,
    height: 30,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTabLabel: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 12,
    letterSpacing: 0,
  },
});
