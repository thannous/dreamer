import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Fonts } from '@/constants/theme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { isMockModeEnabled } from '@/lib/env';
import { TID } from '@/lib/testIDs';

const isMockMode = isMockModeEnabled();
const shouldShowMockRail = isMockMode && Platform.OS !== 'web';

const ITEMS = [
  { label: 'H', testID: TID.Button.MockNavHome, href: '/(tabs)' as const },
  { label: 'J', testID: TID.Button.MockNavJournal, href: '/(tabs)/journal' as const },
  { label: 'S', testID: TID.Button.MockNavStats, href: '/(tabs)/statistics' as const },
  { label: 'G', testID: TID.Button.MockNavSettings, href: '/(tabs)/settings' as const },
];

export function MockNavigationRail() {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const insets = useSafeAreaInsets();

  if (!shouldShowMockRail) {
    return null;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} collapsable={false}>
      <View
        style={[styles.rail, { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border }]}
        collapsable={false}
      >
        {ITEMS.map((item) => (
          <Pressable
            key={item.testID}
            onPress={() => router.push(item.href)}
            style={[styles.button, { borderColor: noctalia.surface.border }]}
            testID={item.testID}
            collapsable={false}
            accessible
            accessibilityRole="button"
            accessibilityLabel={item.testID}
          >
            <Text style={[styles.label, { color: noctalia.text.secondary }]}>{item.label}</Text>
          </Pressable>
        ))}
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
