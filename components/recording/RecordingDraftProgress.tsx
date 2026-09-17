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
  persisted?: boolean;
};

export function RecordingDraftProgress({ value, persisted = false }: RecordingDraftProgressProps) {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const progress = useMemo(() => getRecordingDraftProgress(value), [value]);
  const countLabel = t('recording.draft_progress.count', { count: progress.charCount });
  const hint = t(`recording.draft_progress.${progress.state}`);
  const shouldShowHint = progress.state !== 'empty';
  const savedLabel = persisted ? String(t('recording.draft_progress.saved_locally')) : null;

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
        <Text
          testID={TID.Component.RecordingDraftProgressCount}
          style={[styles.count, { color: noctalia.text.secondary }]}
        >
          {countLabel}
        </Text>
      </View>
      {savedLabel ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.saved, { color: noctalia.text.secondary }]}
        >
          {savedLabel}
        </Text>
      ) : null}
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
  saved: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  count: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
