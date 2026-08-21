import React, { memo, useMemo } from 'react';
import { Text, View, type ViewStyle } from 'react-native';

import { FlatGlassCard } from '@/components/inspiration/GlassCard';
import { PressableScale } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
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
  /**
   * `false` when the card sits inside a `Reveal` that already plays the entrance —
   * two entrances on one surface read as a stutter.
   */
  animateOnMount?: boolean;
};

/**
 * Personal "night pulse" summary at the top of the home screen: one actionable
 * state (capture, analyze, restart…) plus the journal's key numbers.
 */
export const DreamPulseCard = memo(function DreamPulseCard({
  pulse,
  onPressCta,
  animateOnMount = true,
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

  /**
   * `FlatGlassCard` takes a `ViewStyle`, not a `className`, and merges it *after* its
   * own frame — so the card's shape has to stay a style object to keep overriding it.
   */
  const cardStyle = useMemo<ViewStyle>(
    () => ({
      borderRadius: 26,
      borderWidth: 1,
      overflow: 'hidden',
      backgroundColor: noctalia.surface.raised,
      borderColor: noctalia.surface.border,
    }),
    [noctalia.surface.raised, noctalia.surface.border],
  );

  return (
    <FlatGlassCard
      intensity="strong"
      style={cardStyle}
      animateOnMount={animateOnMount}
      testID={TID.Component.InspirationPulse}
    >
      <View className="ml-6 mt-[22px] h-[3px] w-[52px] rounded-[2px] bg-champagne" />
      <View className="px-6 pb-6 pt-3.5">
        <View className="mb-3 flex-row items-center gap-2.5">
          <View className="h-[30px] w-[30px] items-center justify-center rounded-[15px] bg-ink-soft">
            <IconSymbol name="waveform" size={16} color={noctalia.accent.text} />
          </View>
          <Text className="font-sans-bold text-[12px] uppercase tracking-[1.4px] text-champagne-on">
            {t('inspiration.pulse.eyebrow')}
          </Text>
        </View>

        <Text className="mb-2 font-display-semibold text-[26px] leading-8 text-ivory">
          {t(`inspiration.pulse.${copyState}.title`)}
        </Text>
        <Text className="font-sans text-[15px] leading-[22px] text-ivory-muted">
          {t(`inspiration.pulse.${copyState}.body`)}
        </Text>

        {showMetrics && pulse.currentStreak > 0 ? (
          <View
            accessibilityRole="text"
            testID={TID.Component.InspirationStreak}
            className="mt-3.5 flex-row items-center gap-2 self-start rounded-full border-[length:hairlineWidth()] border-line bg-ink-soft px-3 py-1.5"
          >
            <IconSymbol name="flame.fill" size={16} color={noctalia.accent.text} />
            <Text className="font-sans-bold text-[13px] text-ivory" numberOfLines={1}>
              {pulse.currentStreak === 1
                ? t('inspiration.pulse.streak.days_one', { count: pulse.currentStreak })
                : t('inspiration.pulse.streak.days', { count: pulse.currentStreak })}
            </Text>
            {pulse.longestStreak > pulse.currentStreak ? (
              <Text className="font-sans text-[12px] text-ivory-muted" numberOfLines={1}>
                {t('inspiration.pulse.streak.best', { count: pulse.longestStreak })}
              </Text>
            ) : null}
          </View>
        ) : null}

        {showMetrics ? (
          <View className="mt-[18px] flex-row border-t-[length:hairlineWidth()] border-t-line pt-4">
            {metrics.map((metric) => (
              <View
                key={metric.id}
                className={`items-center gap-0.5 ${metric.id === 'last' ? 'flex-[1.5]' : 'flex-1'}`}
              >
                <Text
                  className={`font-display-semibold text-ivory ${
                    metric.id === 'last' ? 'text-[14px] leading-6' : 'text-[18px]'
                  }`}
                  numberOfLines={1}
                >
                  {metric.value}
                </Text>
                <Text className="font-sans text-[12px] text-ivory-muted" numberOfLines={1}>
                  {metric.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {pulse ? (
          <PressableScale
            onPress={() => onPressCta(pulse.state)}
            accessibilityRole="button"
            accessibilityLabel={t(`inspiration.pulse.${pulse.state}.cta`)}
            testID={TID.Button.InspirationPulseCta}
            className="mt-[18px] flex-row items-center justify-center gap-2 rounded-full border border-champagne-soft bg-champagne px-5 py-[13px] dark:bg-ink-active"
          >
            <Text
              className="font-sans-bold text-[15px] text-on-champagne dark:text-champagne-on"
              numberOfLines={1}
            >
              {t(`inspiration.pulse.${pulse.state}.cta`)}
            </Text>
            <Text className="font-sans-bold text-[15px] text-on-champagne dark:text-champagne-on">
              →
            </Text>
          </PressableScale>
        ) : null}
      </View>
    </FlatGlassCard>
  );
});
