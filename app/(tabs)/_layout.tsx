import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';

type IconName = Parameters<typeof IconSymbol>[0]['name'];

type TabPalette = {
  barBg: string;
  barBorder: string;
  iconBg: string;
  iconActiveBg: string;
  text: string;
  textActive: string;
};

function TabBarItem({ label, icon, focused, palette, colors }: {
  label: string;
  icon: IconName;
  focused: boolean;
  palette: TabPalette;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={styles.tabItem}>
      <View
        style={[
          styles.iconBadge,
          { backgroundColor: focused ? palette.iconActiveBg : palette.iconBg },
        ]}>
        <IconSymbol
          size={20}
          name={icon}
          color={focused ? colors.backgroundCard : palette.text}
        />
      </View>
      <Text
        style={[
          styles.tabLabel,
          { color: focused ? palette.textActive : palette.text },
        ]}>
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const { colors, shadows, mode } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const TAB_BAR_HEIGHT = 58;
  const TAB_BAR_MARGIN = 24;
  const bottomSpacing = TAB_BAR_MARGIN + insets.bottom;

  const palette: TabPalette = mode === 'dark'
    ? {
        barBg: '#120721',
        barBorder: '#2f2147',
        iconBg: '#35224f',
        iconActiveBg: colors.accent,
        text: colors.textSecondary,
        textActive: colors.textPrimary,
      }
    : {
        barBg: colors.backgroundCard,
        barBorder: colors.divider,
        iconBg: colors.accentLight,
        iconActiveBg: colors.accent,
        text: colors.textSecondary,
        textActive: colors.textPrimary,
      };

  const tabBarStyle: ViewStyle = {
    position: 'absolute',
    borderTopWidth: 0,
    backgroundColor: palette.barBg,
    borderRadius: 28,
    marginHorizontal: 20,
    marginBottom: bottomSpacing,
    paddingHorizontal: 20,
    paddingVertical: 8,
    height: TAB_BAR_HEIGHT,
    borderWidth: 1,
    borderColor: palette.barBorder,
    ...shadows.xl,
  };

  return (
    <Tabs
      sceneContainerStyle={{
        paddingBottom: TAB_BAR_HEIGHT + bottomSpacing,
      }}
      screenOptions={{
        headerShown: false,
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
        options={{
          title: t('nav.home'),
          tabBarButton: (props) => (
            <HapticTab {...props} testID={TID.Tab.Home} accessibilityLabel={t('nav.home')} />
          ),
          tabBarIcon: ({ focused }) => (
            <TabBarItem icon="house.fill" label={t('nav.home')} focused={focused} palette={palette} colors={colors} />
          ),
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: t('nav.journal'),
          tabBarButton: (props) => (
            <HapticTab {...props} testID={TID.Tab.Journal} accessibilityLabel={t('nav.journal')} />
          ),
          tabBarIcon: ({ focused }) => (
            <TabBarItem icon="book.fill" label={t('nav.journal')} focused={focused} palette={palette} colors={colors} />
          ),
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: t('nav.stats'),
          tabBarButton: (props) => (
            <HapticTab {...props} testID={TID.Tab.Stats} accessibilityLabel={t('nav.stats')} />
          ),
          tabBarIcon: ({ focused }) => (
            <TabBarItem icon="chart.bar.fill" label={t('nav.stats')} focused={focused} palette={palette} colors={colors} />
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
            <TabBarItem icon="gear" label={t('nav.settings')} focused={focused} palette={palette} colors={colors} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 20,
    gap: 4,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 11,
    letterSpacing: 0.2,
  },
});
