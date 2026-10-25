import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type ViewProps } from 'react-native';

import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useDreamLengthLabel } from '@/components/recording/DreamLengthCounter';
import { useTheme } from '@/context/ThemeContext';
import { TID } from '@/lib/testIDs';

type RecordingDraftProgressProps = {
  value: string;
  onLayout?: ViewProps['onLayout'];
};

// A dream's text needs no running commentary: the count shows only near its maximum length.
export function RecordingDraftProgress({ value, onLayout }: RecordingDraftProgressProps) {
  const { colors, mode } = useTheme();
  const { fontScale } = useWindowDimensions();
  const controlFontScale = Math.min(1.3, Math.max(1, fontScale));
  const captionTypography = { fontSize: 12 * controlFontScale, lineHeight: 16 * controlFontScale };
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const nearMaximum = useDreamLengthLabel(value.length);
  if (!nearMaximum) return null;

  return (
    <View
      style={styles.container}
      testID={TID.Component.RecordingDraftProgress}
      onLayout={onLayout}
    >
      <Text
        key={`count-${fontScale}`}
        allowFontScaling={false}
        testID={TID.Component.RecordingDraftProgressCount}
        accessibilityLabel={nearMaximum.accessibilityLabel}
        style={[styles.count, captionTypography, { color: noctalia.text.secondary }]}
      >
        {nearMaximum.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 512,
    alignSelf: 'center',
    gap: 8,
  },
  count: {
    alignSelf: 'flex-end',
    fontFamily: Fonts.outfit.medium,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
