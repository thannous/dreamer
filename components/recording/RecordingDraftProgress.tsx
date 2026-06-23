import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
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
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const progress = useMemo(() => getRecordingDraftProgress(value), [value]);
  const countLabel = t('recording.draft_progress.count')
    .replace('{count}', String(progress.charCount))
    .replace('{limit}', String(progress.limit));
  const hint = t(`recording.draft_progress.${progress.state}`);
  const shouldShowHint = progress.state !== 'empty';

  return (
    <View
      style={styles.container}
      testID={TID.Component.RecordingDraftProgress}
    >
      <View style={styles.headerRow}>
        {shouldShowHint ? (
          <Text style={[styles.hint, { color: noctalia.text.secondary }]}>
            {hint}
          </Text>
        ) : null}
        <Text style={[styles.count, { color: noctalia.text.secondary }]}>
          {countLabel}
        </Text>
      </View>
      <View
        style={[
          styles.track,
          {
            backgroundColor: noctalia.surface.border,
          },
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              backgroundColor: noctalia.accent.base,
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
