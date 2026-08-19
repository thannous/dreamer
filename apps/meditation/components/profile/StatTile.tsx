import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';

type Props = {
  value: string | number;
  label: string;
  /** The one tile that carries the breathing accent stripe. */
  featured?: boolean;
};

/** A number in Fraunces, its name underneath. Nothing else. */
export function StatTile({ value, label, featured = false }: Props) {
  return (
    <View
      className={`flex-1 items-center gap-1 rounded-xl border px-2 py-4 ${
        featured ? 'border-champagne-soft bg-ink-panel' : 'border-hairline bg-ink-card'
      }`}>
      <Text variant="display">{value}</Text>
      <Text variant="caption" className="text-center">
        {label}
      </Text>
    </View>
  );
}
