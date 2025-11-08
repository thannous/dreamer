import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { JournalTheme } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type IconName = Parameters<typeof IconSymbol>[0]['name'];

type TabPalette = {
  barBg: string;
  barBorder: string;
  itemBg: string;
  itemActiveBg: string;
  iconBg: string;
  iconActiveBg: string;
  text: string;
  textActive: string;
};

function TabBarItem({
  label,
  icon,
  focused,
  palette,
}: {
  label: string;
  icon: IconName;
  focused: boolean;
  palette: TabPalette;
}) {
  return (
    <View
      style={[
        styles.tabItem,
        { backgroundColor: focused ? palette.itemActiveBg : palette.itemBg },
      ]}>
      <View
        style={[
          styles.iconBadge,
          { backgroundColor: focused ? palette.iconActiveBg : palette.iconBg },
        ]}>
        <IconSymbol
          size={20}
          name={icon}
          color={focused ? JournalTheme.backgroundCard : palette.text}
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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const palette: TabPalette = isDark
    ? {
        barBg: '#120721',
        barBorder: '#2f2147',
        itemBg: '#1b1230',
        itemActiveBg: '#2d1a45',
        iconBg: '#35224f',
        iconActiveBg: JournalTheme.accent,
        text: JournalTheme.textSecondary,
        textActive: JournalTheme.textPrimary,
      }
    : {
        barBg: '#f2ecff',
        barBorder: '#cdbbf0',
        itemBg: '#e1d5f6',
        itemActiveBg: '#cbb7ef',
        iconBg: '#bea5e5',
        iconActiveBg: JournalTheme.accent,
        text: '#463368',
        textActive: '#1f1230',
      };

  const tabBarStyle: ViewStyle = {
    position: 'absolute',
    borderTopWidth: 0,
    backgroundColor: palette.barBg,
    borderRadius: 28,
    marginHorizontal: 20,
    marginBottom: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: palette.barBorder,
    shadowColor: isDark ? '#000' : '#3d2561',
    shadowOpacity: 0.35,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 24,
  };

  return (
    <Tabs
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
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabBarItem icon="house.fill" label="Home" focused={focused} palette={palette} />
          ),
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          tabBarIcon: ({ focused }) => (
            <TabBarItem icon="book.fill" label="Journal" focused={focused} palette={palette} />
          ),
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: 'Stats',
          tabBarIcon: ({ focused }) => (
            <TabBarItem icon="chart.bar.fill" label="Stats" focused={focused} palette={palette} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => (
            <TabBarItem icon="gear" label="Settings" focused={focused} palette={palette} />
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
