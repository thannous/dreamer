import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { isMockModeEnabled } from '@/lib/env';
import { TID } from '@/lib/testIDs';

const isMockMode = isMockModeEnabled();

const ITEMS = [
  { label: 'H', testID: TID.Button.MockNavHome, href: '/(tabs)' as const },
  { label: 'J', testID: TID.Button.MockNavJournal, href: '/(tabs)/journal' as const },
  { label: 'S', testID: TID.Button.MockNavStats, href: '/(tabs)/statistics' as const },
  { label: 'G', testID: TID.Button.MockNavSettings, href: '/(tabs)/settings' as const },
];

export function MockNavigationRail() {
  const { colors } = useTheme();

  if (!isMockMode) {
    return null;
  }

  return (
    <View style={styles.container} collapsable={false}>
      <View
        style={[styles.rail, { backgroundColor: colors.backgroundCard, borderColor: colors.divider }]}
        collapsable={false}
      >
        {ITEMS.map((item) => (
          <Pressable
            key={item.testID}
            onPress={() => router.push(item.href)}
            style={[styles.button, { borderColor: colors.divider }]}
            testID={item.testID}
            collapsable={false}
            accessible
            accessibilityRole="button"
            accessibilityLabel={item.testID}
          >
            <Text style={[styles.label, { color: colors.textSecondary }]}>{item.label}</Text>
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
    alignSelf: 'flex-end',
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
    letterSpacing: 0.4,
  },
});
