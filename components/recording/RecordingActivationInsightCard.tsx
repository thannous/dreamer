import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import {
  type RecordingActivationInsight,
  type RecordingActivationInsightSignalId,
} from '@/lib/recordingActivationInsight';
import { TID } from '@/lib/testIDs';

type RecordingActivationInsightCardProps = {
  insight?: RecordingActivationInsight | null;
};

const signalIconById: Record<
  RecordingActivationInsightSignalId,
  React.ComponentProps<typeof IconSymbol>['name']
> = {
  emotion: 'heart.fill',
  memory: 'moon.stars.fill',
  person: 'person.2.fill',
  place: 'building.2.fill',
  recurrence: 'arrow.triangle.2.circlepath',
  symbol: 'sparkles',
};

export function RecordingActivationInsightCard({ insight }: RecordingActivationInsightCardProps) {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

  const signalLabels = useMemo(
    () => insight?.signalIds.map((signalId) => t(`recording.activation_insight.signal.${signalId}`)) ?? [],
    [insight?.signalIds, t]
  );

  if (!insight) {
    return null;
  }

  const summary = insight.tone === 'memory'
    ? t('recording.activation_insight.summary.memory')
    : insight.tone === 'signals'
      ? t('recording.activation_insight.summary.signals', { signals: signalLabels.join(', ') })
      : t('recording.activation_insight.summary.fragment');

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: noctalia.surface.raised,
          borderColor: noctalia.surface.border,
        },
      ]}
      testID={TID.Component.RecordingActivationInsight}
    >
      <View style={styles.headerRow}>
        <View
          style={[
            styles.spark,
            { backgroundColor: `${noctalia.accent.base}24` },
          ]}
        >
          <IconSymbol name="sparkles" size={16} color={noctalia.accent.base} />
        </View>
        <Text style={[styles.eyebrow, { color: noctalia.accent.base }]}>
          {t('recording.activation_insight.eyebrow')}
        </Text>
      </View>
      <Text
        style={[styles.summary, { color: noctalia.text.primary }]}
        testID={TID.Text.RecordingActivationInsightSummary}
      >
        {summary}
      </Text>
      {insight.signalIds.length > 0 ? (
        <View style={styles.chipRow}>
          {insight.signalIds.map((signalId, index) => (
            <View
              key={signalId}
              style={[
                styles.chip,
                {
                  backgroundColor: noctalia.surface.soft,
                  borderColor: noctalia.surface.border,
                },
              ]}
            >
              <IconSymbol
                name={signalIconById[signalId]}
                size={14}
                color={noctalia.accent.base}
              />
              <Text style={[styles.chipText, { color: noctalia.text.secondary }]}>
                {signalLabels[index]}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 9,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 12,
    lineHeight: 15,
    textTransform: 'uppercase',
  },
  summary: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 30,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
    lineHeight: 15,
  },
});
