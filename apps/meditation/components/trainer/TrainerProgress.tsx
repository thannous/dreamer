import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';

type Props = {
  label: string;
  current: number;
  total: number;
  compact?: boolean;
};

/**
 * Quiet progress for a practice: the words carry the exact information while
 * the hairline gives sighted listeners a peripheral sense of distance left.
 */
export function TrainerProgress({ label, current, total, compact = false }: Props) {
  const safeTotal = Math.max(1, total);
  const safeCurrent = Math.min(safeTotal, Math.max(1, current));
  const progress = safeCurrent / safeTotal;

  return (
    <View
      className="w-full gap-2"
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: safeTotal, now: safeCurrent }}
      accessibilityLabel={label}>
      <View className="flex-row items-center justify-between">
        <Text variant="overline" maxFontSizeMultiplier={compact ? 1.2 : 2}>
          {label}
        </Text>
      </View>
      <View className="h-px w-full overflow-hidden rounded-full bg-hairline">
        <View className="h-full rounded-full bg-champagne" style={{ width: `${progress * 100}%` }} />
      </View>
    </View>
  );
}
