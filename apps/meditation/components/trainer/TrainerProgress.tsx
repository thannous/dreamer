import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';

type Props = {
  label: string;
  current: number;
  total: number;
  compact?: boolean;
  ready?: boolean;
};

/**
 * Quiet progress for a practice: the words carry the exact information while
 * the hairline gives sighted listeners a peripheral sense of distance left.
 */
export function TrainerProgress({
  label,
  current,
  total,
  ready = false,
}: Props) {
  const safeTotal = Math.max(1, total);
  const safeCurrent = ready ? 0 : Math.min(safeTotal, Math.max(0, current));
  const progress = ready ? 0 : safeCurrent / safeTotal;
  const now = ready ? 0 : Math.max(1, safeCurrent);

  return (
    <View
      className="w-full gap-2"
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: safeTotal, now: ready ? 0 : now }}
      accessibilityLabel={label}>
      <View className="flex-row items-center justify-between">
        <Text variant="overline">
          {label}
        </Text>
      </View>
      <View className="h-px w-full overflow-hidden rounded-full bg-hairline">
        <View className="h-full rounded-full bg-champagne" style={{ width: `${progress * 100}%` }} />
      </View>
    </View>
  );
}
