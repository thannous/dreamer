import React from 'react';
import { StyleSheet } from 'react-native';

import { ArtworkGlassPanel, Text } from '@/components/ui';
import { Themes, type ThemeMode } from '@/constants/theme';

type Props = {
  value: string | number;
  label: string;
  /** The one tile that carries the breathing accent stripe. */
  featured?: boolean;
  testID?: string;
  compact?: boolean;
  appearance: ThemeMode;
};

/** A number in Fraunces, its name underneath. Nothing else. */
export function StatTile({
  value,
  label,
  featured = false,
  testID,
  compact = false,
  appearance,
}: Props) {
  return (
    <ArtworkGlassPanel
      appearance={appearance}
      testID={testID}
      className="flex-1"
      contentStyle={[styles.content, compact ? styles.compactContent : styles.regularContent]}
      style={featured ? { borderColor: Themes[appearance].accentLight } : undefined}>
      <Text variant={compact ? 'h1' : 'display'}>{value}</Text>
      <Text variant="caption" className="text-center">
        {label}
      </Text>
    </ArtworkGlassPanel>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  compactContent: {
    paddingVertical: 12,
  },
  regularContent: {
    paddingVertical: 16,
  },
});
