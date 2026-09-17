import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';

type Props = {
  /** 0 → 1 through the current phase. */
  progress: number;
  remainingSec: number;
  compact?: boolean;
};

/**
 * The reduced-motion substitute for the ring: a linear gauge and a count, with
 * nothing that expands, pulses or loops. Same information, no vestibular load.
 */
export function BreathGauge({ progress, remainingSec, compact = false }: Props) {
  return (
    <View className={`w-full ${compact ? 'gap-1 px-4' : 'gap-4 px-8'}`}>
      <View className="h-2 w-full overflow-hidden rounded-full bg-ink-panel">
        <View
          className="h-full rounded-full bg-champagne"
          style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
        />
      </View>
      <Text
        variant={compact ? 'h1' : 'display'}
        className="text-center">
        {remainingSec > 0 ? remainingSec : '·'}
      </Text>
    </View>
  );
}
