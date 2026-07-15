import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';

import { Fonts } from '@/constants/theme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { isMockModeEnabled } from '@/lib/env';
import { TID } from '@/lib/testIDs';

const isMockMode = isMockModeEnabled();
const shouldShowMockRail = isMockMode && Platform.OS !== 'web';

const ITEMS = [
  { shortLabel: 'H', translationKey: 'nav.home', route: 'home', testID: TID.Button.MockNavHome, href: '/(tabs)' as const },
  { shortLabel: 'J', translationKey: 'nav.journal', route: 'journal', testID: TID.Button.MockNavJournal, href: '/(tabs)/journal' as const },
  { shortLabel: 'S', translationKey: 'nav.stats', route: 'statistics', testID: TID.Button.MockNavStats, href: '/(tabs)/statistics' as const },
  { shortLabel: 'G', translationKey: 'nav.settings', route: 'settings', testID: TID.Button.MockNavSettings, href: '/(tabs)/settings' as const },
];

export function MockNavigationRail() {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  if (!shouldShowMockRail) {
    return null;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} collapsable={false}>
      <View
        style={[styles.rail, { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border }]}
        collapsable={false}
      >
        {ITEMS.map((item) => {
          const isSelected = item.route === 'home'
            ? pathname === '/' || pathname === '/index'
            : pathname.includes(item.route);
          const label = t(item.translationKey);

          return (
            <Pressable
              key={item.testID}
              onPress={() => router.push(item.href)}
              style={[
                styles.button,
                { borderColor: noctalia.surface.border },
                isSelected && { backgroundColor: noctalia.surface.active },
              ]}
              testID={item.testID}
              collapsable={false}
              accessible
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                style={[
                  styles.label,
                  { color: isSelected ? noctalia.accent.base : noctalia.text.secondary },
                ]}
              >
                {item.shortLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 12,
  },
  rail: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderRadius: 16,
    padding: 6,
    opacity: 0.9,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 12,
  },
});
