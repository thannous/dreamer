import { IconSymbol } from '@/components/ui/icon-symbol';
import { DESKTOP_BREAKPOINT, getBottomNavigationLayout } from '@/constants/layout';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IconName = Parameters<typeof IconSymbol>[0]['name'];
type BottomNavKey = 'home' | 'journal' | 'addDream' | 'stats' | 'settings';

type BottomNavItem = {
  key: BottomNavKey;
  label: string;
  accessibilityLabel: string;
  icon: IconName;
  href: string;
  testID: string;
};

type NoctaliaBottomNavProps = {
  activeKey: BottomNavKey;
  addDreamIcon?: IconName;
  onBarLayout?: (event: LayoutChangeEvent) => void;
};

export function NoctaliaBottomNav({
  activeKey,
  addDreamIcon = 'pencil',
  onBarLayout,
}: NoctaliaBottomNavProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  if (width >= DESKTOP_BREAKPOINT) {
    return null;
  }

  const navigationLayout = getBottomNavigationLayout(width, height);
  const floatingBottomInset = Math.max(insets.bottom, navigationLayout.minimumBottomInset);
  const barBackground = noctalia.nav.background;
  const barBorder = noctalia.nav.border;
  const navActiveColor = noctalia.nav.active;
  const navInactiveColor = noctalia.nav.inactive;
  const addBackground = noctalia.action.primary;
  const addBorder = noctalia.action.primaryBorder;
  const addTextColor = noctalia.action.primaryText;
  const isDreamCaptureActive = activeKey === 'addDream';
  const items: BottomNavItem[] = [
    {
      key: 'home',
      label: t('nav.home'),
      accessibilityLabel: t('nav.home'),
      icon: 'house',
      href: '/',
      testID: TID.Tab.Home,
    },
    {
      key: 'journal',
      label: t('nav.journal'),
      accessibilityLabel: t('nav.journal'),
      icon: 'book',
      href: '/journal',
      testID: TID.Tab.Journal,
    },
    {
      key: 'addDream',
      label: isDreamCaptureActive ? t('nav.capture_dream') : t('nav.add_dream'),
      accessibilityLabel: isDreamCaptureActive
        ? t('nav.capture_dream_accessibility')
        : t('journal.add_button.accessibility'),
      icon: addDreamIcon,
      href: '/recording',
      testID: TID.Tab.AddDream,
    },
    {
      key: 'stats',
      label: t('nav.stats'),
      accessibilityLabel: t('nav.stats'),
      icon: 'chart.bar',
      href: '/statistics',
      testID: TID.Tab.Stats,
    },
    {
      key: 'settings',
      label: t('nav.settings'),
      accessibilityLabel: t('nav.settings'),
      icon: 'gear',
      href: '/settings',
      testID: TID.Tab.Settings,
    },
  ];

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View
        onLayout={onBarLayout}
        style={[
          styles.bar,
          navigationLayout.compact && styles.compactBar,
          {
            bottom: floatingBottomInset,
            height: navigationLayout.barHeight,
            backgroundColor: barBackground,
            borderColor: barBorder,
          },
        ]}
      >
        {items.map((item) => {
          const isCenter = item.key === 'addDream';
          const isActive = item.key === activeKey;

          return (
            <Pressable
              key={item.key}
              onPress={isActive ? undefined : () => router.push(item.href as any)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={item.accessibilityLabel}
              testID={item.testID}
              style={({ pressed }) => [
                styles.item,
                pressed && styles.pressed,
              ]}
            >
              {isCenter ? (
                <View
                  style={[
                    styles.addItem,
                    navigationLayout.compact && styles.compactAddItem,
                    {
                      backgroundColor: addBackground,
                      borderColor: addBorder,
                    },
                  ]}
                >
                  <IconSymbol
                    size={24}
                    name={item.icon}
                    color={addTextColor}
                  />
                  <Text
                    style={[styles.addLabel, { color: addTextColor }]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </View>
              ) : (
                <View
                  style={[
                    styles.standardItem,
                    navigationLayout.compact && styles.compactStandardItem,
                  ]}
                >
                  <IconSymbol
                    size={24}
                    name={item.icon}
                    color={isActive ? navActiveColor : navInactiveColor}
                  />
                  <Text
                    style={[
                      styles.label,
                      navigationLayout.compact && styles.compactLabel,
                      { color: isActive ? navActiveColor : navInactiveColor },
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.label}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    zIndex: 45,
  },
  bar: {
    position: 'absolute',
    left: 22,
    right: 22,
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 7,
    borderRadius: 36,
    borderWidth: 1,
    flexDirection: 'row',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 14,
  },
  compactBar: {
    borderRadius: 28,
    paddingTop: 4,
    paddingBottom: 4,
  },
  item: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  standardItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  compactStandardItem: {
    gap: 1,
  },
  label: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
  },
  compactLabel: {
    fontSize: 11,
  },
  addItem: {
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
  compactAddItem: {
    width: 60,
    height: 56,
    borderRadius: 22,
    gap: 1,
    transform: [{ translateY: -4 }],
  },
  addLabel: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.72,
  },
});
