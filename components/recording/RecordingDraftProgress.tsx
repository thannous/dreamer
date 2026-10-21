import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useDreamLengthLabel } from '@/components/recording/DreamLengthCounter';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import { getRecordingDraftProgress } from '@/lib/recordingDraftProgress';

type RecordingDraftProgressProps = {
  value: string;
};

export function RecordingDraftProgress({ value }: RecordingDraftProgressProps) {
  const { colors, mode } = useTheme();
  const { fontScale } = useWindowDimensions();
  const controlFontScale = Math.min(1.3, Math.max(1, fontScale));
  const hintTypography = { fontSize: 13 * controlFontScale, lineHeight: 16 * controlFontScale };
  const captionTypography = { fontSize: 12 * controlFontScale, lineHeight: 16 * controlFontScale };
  const { t } = useTranslation();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const progress = useMemo(() => getRecordingDraftProgress(value), [value]);
  // Near a dream's maximum length, the count says how far it is.
  const nearMaximum = useDreamLengthLabel(progress.charCount);
  const countLabel = nearMaximum?.text
    ?? t(progress.charCount === 1 ? 'recording.draft_progress.count_one' : 'recording.draft_progress.count', { count: progress.charCount });
  const hint = t(`recording.draft_progress.${progress.state}`);
  const shouldShowHint = progress.state !== 'empty';

  return (
    <View
      style={styles.container}
      testID={TID.Component.RecordingDraftProgress}
    >
      <View style={styles.headerRow}>
        {shouldShowHint ? (
          <Text key={`hint-${fontScale}`} allowFontScaling={false} style={[styles.hint, hintTypography, { color: noctalia.text.secondary }]}>
            {hint}
          </Text>
        ) : null}
        {/* An empty draft needs no counter: "0 characters" reads as a warning. */}
        {progress.charCount > 0 ? (
          <Text
            key={`count-${fontScale}`}
            allowFontScaling={false}
            testID={TID.Component.RecordingDraftProgressCount}
            accessibilityLabel={nearMaximum?.accessibilityLabel}
            style={[styles.count, captionTypography, { color: noctalia.text.secondary }]}
          >
            {countLabel}
          </Text>
        ) : null}
      </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  hint: {
    flex: 1,
    fontFamily: Fonts.outfit.medium,
    fontSize: 13,
    lineHeight: 16,
  },
  count: {
    fontFamily: Fonts.outfit.medium,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
