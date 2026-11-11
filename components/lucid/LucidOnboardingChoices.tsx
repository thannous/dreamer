import React from 'react';
import { StyleSheet, View } from 'react-native';

import { getLucidPalette, LucidRadius, LucidSpace } from '@/constants/lucidTheme';
import { useTheme } from '@/context/ThemeContext';

export function LucidSegmentedProgress({
  current,
  label,
  total,
}: {
  current: number;
  label: string;
  total: number;
}) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: current }}
      style={styles.progress}
    >
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[
            styles.progressSegment,
            { backgroundColor: index < current ? palette.accent : palette.border },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { width: 152, flexDirection: 'row', gap: LucidSpace.sm },
  progressSegment: { flex: 1, height: 4, borderRadius: LucidRadius.full },
});
