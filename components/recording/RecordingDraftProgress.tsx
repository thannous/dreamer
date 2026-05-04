import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import { getRecordingDraftProgress } from '@/lib/recordingDraftProgress';

type RecordingDraftProgressProps = {
  value: string;
};

export function RecordingDraftProgress({ value }: RecordingDraftProgressProps) {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const progress = useMemo(() => getRecordingDraftProgress(value), [value]);
  const countLabel = t('recording.draft_progress.count')
    .replace('{count}', String(progress.charCount))
    .replace('{limit}', String(progress.limit));
  const hint = t(`recording.draft_progress.${progress.state}`);

  return (
    <View
      style={styles.container}
      testID={TID.Component.RecordingDraftProgress}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {hint}
        </Text>
        <Text style={[styles.count, { color: colors.textSecondary }]}>
          {countLabel}
        </Text>
      </View>
      <View
        style={[
          styles.track,
          {
            backgroundColor:
              mode === 'dark' ? `${colors.textSecondary}24` : `${colors.textSecondary}1A`,
          },
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              backgroundColor: colors.accent,
              width: `${Math.max(4, progress.ratio * 100)}%`,
              opacity: progress.charCount === 0 ? 0.35 : 1,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
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
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  count: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});
