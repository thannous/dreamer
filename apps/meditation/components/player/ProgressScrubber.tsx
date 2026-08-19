import React, { useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';

import { Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import { formatTime, SEEK_STEP_SEC } from '@/lib/audio';

type Props = {
  positionSec: number;
  durationSec: number;
  onSeek: (seconds: number) => void;
};

/**
 * Position bar. Tap anywhere on it to seek — a drag handle on a 4 px bar is a
 * fiddly target, and this screen is used with the lights off.
 */
export function ProgressScrubber({ positionSec, durationSec, onSeek }: Props) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);

  const ratio = durationSec > 0 ? Math.min(1, positionSec / durationSec) : 0;
  const remaining = Math.max(0, durationSec - positionSec);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <View className="gap-2">
      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel={t('player.scrub')}
        accessibilityValue={{ min: 0, max: Math.round(durationSec), now: Math.round(positionSec) }}
        // Tapping a position on a 4px bar is not something a screen reader can
        // do. These give it the same control by increments.
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          const delta = event.nativeEvent.actionName === 'increment' ? SEEK_STEP_SEC : -SEEK_STEP_SEC;
          onSeek(Math.min(durationSec, Math.max(0, positionSec + delta)));
        }}
        onLayout={onLayout}
        // Generous vertical padding: the visible bar stays thin, the target does not.
        className="py-3"
        onPress={(event) => {
          if (width <= 0 || durationSec <= 0) return;
          onSeek((event.nativeEvent.locationX / width) * durationSec);
        }}>
        <View className="h-1 w-full overflow-hidden rounded-full bg-ink-panel">
          <View className="h-full rounded-full bg-champagne" style={{ width: `${ratio * 100}%` }} />
        </View>
      </Pressable>

      <View className="flex-row justify-between">
        <Text variant="caption">{formatTime(positionSec)}</Text>
        <Text variant="caption">-{formatTime(remaining)}</Text>
      </View>
    </View>
  );
}
