import { router } from 'expo-router';
import React, { memo, useCallback, useMemo } from 'react';
import { Text, View, type ViewStyle } from 'react-native';

import { FlatGlassCard } from '@/components/inspiration/GlassCard';
import { PressableScale } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamThemeLabel } from '@/lib/dreamLabels';
import type { PersonalReading } from '@/lib/personalReading';
import { TID } from '@/lib/testIDs';
import { WEEKLY_RECAP_ROUTE } from '@/lib/weeklyRecap';

type Props = {
  reading: PersonalReading;
  /** Next scheduled reminder, already formatted, or null when reminders are off. */
  nextReminderText: string | null;
  /**
   * `false` when the card sits inside a `Reveal` that already plays the entrance —
   * two entrances on one surface read as a stutter.
   */
  animateOnMount?: boolean;
};

const ROW_CLASS = 'flex-row items-center gap-3 border-t-[length:hairlineWidth()] border-t-line py-3';

/**
 * "Reading of the day": three lines derived from the user's own journal —
 * what keeps coming back, the next best action, and the next reminder — with a
 * link to the weekly recap. Replaces the generic tips that used to fill the
 * home screen for every user forever.
 */
export const PersonalReadingCard = memo(function PersonalReadingCard({
  reading,
  nextReminderText,
  animateOnMount = true,
}: Props) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();

  const recurringLabel = reading.recurringSymbol
    ? t('inspiration.reading.recurring_symbol', {
        name: reading.recurringSymbol.name,
        count: reading.recurringSymbol.count,
      })
    : reading.recurringTheme
      ? t('inspiration.reading.recurring_theme', {
          theme: getDreamThemeLabel(reading.recurringTheme.theme, t) ?? reading.recurringTheme.theme,
          count: reading.recurringTheme.count,
        })
      : reading.analyzedInWindow > 0
        ? t('inspiration.reading.recurring_none')
        : t('inspiration.reading.recurring_needs_analysis');

  const nextDream = reading.dreamToExplore ?? reading.dreamToAnalyze;
  const nextActionLabel = reading.dreamToExplore
    ? t('inspiration.reading.next_explore', { title: reading.dreamToExplore.title || t('weekly_recap.next.untitled') })
    : reading.dreamToAnalyze
      ? t('inspiration.reading.next_analyze', { title: reading.dreamToAnalyze.title || t('weekly_recap.next.untitled') })
      : t('inspiration.reading.next_capture');

  const handleNextAction = useCallback(() => {
    if (nextDream) {
      router.push(`/journal/${nextDream.id}`);
    } else {
      router.push('/recording');
    }
  }, [nextDream]);

  const handleOpenRecap = useCallback(() => {
    router.push(WEEKLY_RECAP_ROUTE);
  }, []);

  /**
   * `FlatGlassCard` takes a `ViewStyle`, not a `className`, and merges it *after* its
   * own frame — so the card's shape has to stay a style object to keep overriding it.
   */
  const cardStyle = useMemo<ViewStyle>(
    () => ({
      borderRadius: 24,
      borderWidth: 1,
      overflow: 'hidden',
      backgroundColor: noctalia.surface.raised,
      borderColor: noctalia.surface.border,
    }),
    [noctalia.surface.raised, noctalia.surface.border],
  );

  const rows = [
    {
      key: 'recurring',
      icon: 'arrow.triangle.2.circlepath' as const,
      label: t('inspiration.reading.recurring_label'),
      value: recurringLabel,
      testID: TID.Text.PersonalReadingRecurring,
      onPress: undefined,
    },
    {
      key: 'next',
      icon: 'moon.stars.fill' as const,
      label: t('inspiration.reading.next_label'),
      value: nextActionLabel,
      testID: TID.Text.PersonalReadingNext,
      onPress: handleNextAction,
    },
    {
      key: 'reminder',
      icon: 'bell' as const,
      label: t('inspiration.reading.reminder_label'),
      value: nextReminderText ?? t('inspiration.reading.reminder_off'),
      testID: TID.Text.PersonalReadingReminder,
      onPress: undefined,
    },
  ];

  return (
    <FlatGlassCard
      intensity="strong"
      style={cardStyle}
      animateOnMount={animateOnMount}
      testID={TID.Component.PersonalReading}
    >
      <View className="px-5 pb-3 pt-[18px]">
        <View className="mb-2 gap-1">
          <Text className="font-sans-bold text-[12px] uppercase tracking-[1.4px] text-champagne-on">
            {t('inspiration.reading.eyebrow')}
          </Text>
          <Text className="font-display-semibold text-[22px] leading-7 text-ivory">
            {t('inspiration.reading.title')}
          </Text>
        </View>
        {rows.map((row) => {
          const content = (
            <>
              <View className="h-[30px] w-[30px] items-center justify-center rounded-[15px] bg-ink-soft">
                <IconSymbol name={row.icon} size={16} color={noctalia.accent.text} />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="font-sans text-[12px] text-ivory-muted">{row.label}</Text>
                <Text
                  className="font-sans-bold text-[15px] leading-5 text-ivory"
                  numberOfLines={2}
                  testID={row.testID}
                >
                  {row.value}
                </Text>
              </View>
              {row.onPress ? (
                <IconSymbol name="chevron.right" size={16} color={noctalia.text.tertiary} />
              ) : null}
            </>
          );
          return row.onPress ? (
            <PressableScale
              key={row.key}
              accessibilityRole="button"
              onPress={row.onPress}
              testID={TID.Button.PersonalReadingNext}
              className={ROW_CLASS}
            >
              {content}
            </PressableScale>
          ) : (
            <View key={row.key} className={ROW_CLASS}>
              {content}
            </View>
          );
        })}
        <PressableScale
          accessibilityRole="button"
          onPress={handleOpenRecap}
          testID={TID.Button.PersonalReadingRecap}
          className="flex-row items-center gap-1.5 self-start py-2"
        >
          <Text className="font-sans-bold text-[14px] text-champagne-on">
            {t('inspiration.reading.recap_cta')}
          </Text>
          <IconSymbol name="chevron.right" size={14} color={noctalia.accent.text} />
        </PressableScale>
      </View>
    </FlatGlassCard>
  );
});
