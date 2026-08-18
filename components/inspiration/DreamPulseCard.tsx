import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FlatGlassCard } from '@/components/inspiration/GlassCard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import type { DreamPulse, DreamPulseState } from '@/lib/dreamPulse';
import { TID } from '@/lib/testIDs';

type PulseCopyState = DreamPulseState | 'loading';

type DreamPulseCardProps = {
  /** Null while the journal is still loading from storage. */
  pulse: DreamPulse | null;
  onPressCta: (state: DreamPulseState) => void;
};

/**
 * Personal "night pulse" summary at the top of the home screen: one actionable
 * state (capture, analyze, restart…) plus the journal's key numbers.
 */
export const DreamPulseCard = memo(function DreamPulseCard({
  pulse,
  onPressCta,
}: DreamPulseCardProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();

  const copyState: PulseCopyState = pulse?.state ?? 'loading';
  const showMetrics = pulse !== null && pulse.state !== 'empty';

  const lastLabel = useMemo(() => {
    if (!pulse || pulse.daysSinceLastDream === null) {
      return t('inspiration.pulse.last.none');
    }
    if (pulse.daysSinceLastDream === 0) return t('inspiration.pulse.last.today');
    if (pulse.daysSinceLastDream === 1) return t('inspiration.pulse.last.yesterday');
    return t('inspiration.pulse.last.days', { count: pulse.daysSinceLastDream });
  }, [pulse, t]);

  const metrics = useMemo(
    () =>
      pulse
        ? [
            { id: 'total', label: t('inspiration.pulse.metric.total'), value: String(pulse.totalCount) },
            { id: 'analyzed', label: t('inspiration.pulse.metric.analyzed'), value: String(pulse.analyzedCount) },
            { id: 'favorites', label: t('inspiration.pulse.metric.favorites'), value: String(pulse.favoriteCount) },
            { id: 'last', label: t('inspiration.pulse.metric.last'), value: lastLabel },
          ]
        : [],
    [pulse, lastLabel, t],
  );

  const cardStyle = useMemo(
    () =>
      StyleSheet.flatten([
        styles.card,
        {
          backgroundColor: noctalia.surface.raised,
          borderColor: noctalia.surface.border,
        },
      ]),
    [noctalia.surface.raised, noctalia.surface.border],
  );

  return (
    <FlatGlassCard
      intensity="strong"
      style={cardStyle}
      testID={TID.Component.InspirationPulse}
    >
      <View style={[styles.accentLine, { backgroundColor: noctalia.accent.base }]} />
      <View style={styles.inner}>
        <View style={styles.eyebrowRow}>
          <View style={[styles.eyebrowIcon, { backgroundColor: noctalia.surface.soft }]}>
            <IconSymbol name="waveform" size={16} color={noctalia.accent.text} />
          </View>
          <Text style={[styles.eyebrow, { color: noctalia.accent.text }]}>
            {t('inspiration.pulse.eyebrow')}
          </Text>
        </View>

        <Text style={[styles.title, { color: noctalia.text.primary }]}>
          {t(`inspiration.pulse.${copyState}.title`)}
        </Text>
        <Text style={[styles.body, { color: noctalia.text.secondary }]}>
          {t(`inspiration.pulse.${copyState}.body`)}
        </Text>

        {showMetrics ? (
          <View style={[styles.metricsRow, { borderColor: noctalia.surface.border }]}>
            {metrics.map((metric) => (
              <View
                key={metric.id}
                style={[styles.metricCell, metric.id === 'last' && styles.metricCellWide]}
              >
                <Text
                  style={[
                    styles.metricValue,
                    metric.id === 'last' && styles.metricValueText,
                    { color: noctalia.text.primary },
                  ]}
                  numberOfLines={1}
                >
                  {metric.value}
                </Text>
                <Text
                  style={[styles.metricLabel, { color: noctalia.text.secondary }]}
                  numberOfLines={1}
                >
                  {metric.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {pulse ? (
          <Pressable
            onPress={() => onPressCta(pulse.state)}
            accessibilityRole="button"
            accessibilityLabel={t(`inspiration.pulse.${pulse.state}.cta`)}
            testID={TID.Button.InspirationPulseCta}
            style={({ pressed }) => [
              styles.ctaButton,
              {
                backgroundColor:
                  mode === 'dark' ? noctalia.surface.active : noctalia.action.primary,
                borderColor: noctalia.action.primaryBorder,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.ctaLabel,
                {
                  color: mode === 'dark' ? noctalia.accent.base : noctalia.action.primaryText,
                },
              ]}
              numberOfLines={1}
            >
              {t(`inspiration.pulse.${pulse.state}.cta`)}
            </Text>
            <Text
              style={[
                styles.ctaArrow,
                {
                  color: mode === 'dark' ? noctalia.accent.base : noctalia.action.primaryText,
                },
              ]}
            >
              →
            </Text>
          </Pressable>
        ) : null}
      </View>
    </FlatGlassCard>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    borderWidth: 1,
    overflow: 'hidden',
  },
  accentLine: {
    height: 3,
    width: 52,
    borderRadius: 2,
    marginLeft: 24,
    marginTop: 22,
  },
  inner: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 24,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  eyebrowIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 26,
    lineHeight: 32,
    marginBottom: 8,
  },
  body: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  metricsRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 18,
    paddingTop: 16,
  },
  metricCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  metricCellWide: {
    flex: 1.5,
  },
  metricValue: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 18,
  },
  metricValueText: {
    fontSize: 14,
    lineHeight: 24,
  },
  metricLabel: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 12,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 20,
    marginTop: 18,
  },
  ctaLabel: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 15,
  },
  ctaArrow: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 15,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
});
