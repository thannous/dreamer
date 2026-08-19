import { router } from 'expo-router';
import React, { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FlatGlassCard } from '@/components/inspiration/GlassCard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
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
};

/**
 * "Reading of the day": three lines derived from the user's own journal —
 * what keeps coming back, the next best action, and the next reminder — with a
 * link to the weekly recap. Replaces the generic tips that used to fill the
 * home screen for every user forever.
 */
export const PersonalReadingCard = memo(function PersonalReadingCard({ reading, nextReminderText }: Props) {
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
      style={StyleSheet.flatten([
        styles.card,
        { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border },
      ])}
      testID={TID.Component.PersonalReading}
    >
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: noctalia.accent.text }]}>{t('inspiration.reading.eyebrow')}</Text>
          <Text style={[styles.title, { color: noctalia.text.primary }]}>{t('inspiration.reading.title')}</Text>
        </View>
        {rows.map((row) => {
          const content = (
            <>
              <View style={[styles.rowIcon, { backgroundColor: noctalia.surface.soft }]}>
                <IconSymbol name={row.icon} size={16} color={noctalia.accent.text} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowLabel, { color: noctalia.text.secondary }]}>{row.label}</Text>
                <Text style={[styles.rowValue, { color: noctalia.text.primary }]} numberOfLines={2} testID={row.testID}>
                  {row.value}
                </Text>
              </View>
              {row.onPress ? (
                <IconSymbol name="chevron.right" size={16} color={noctalia.text.tertiary} />
              ) : null}
            </>
          );
          return row.onPress ? (
            <Pressable
              key={row.key}
              accessibilityRole="button"
              onPress={row.onPress}
              testID={TID.Button.PersonalReadingNext}
              style={({ pressed }) => [styles.row, { borderTopColor: noctalia.surface.border }, pressed && styles.pressed]}
            >
              {content}
            </Pressable>
          ) : (
            <View key={row.key} style={[styles.row, { borderTopColor: noctalia.surface.border }]}>
              {content}
            </View>
          );
        })}
        <Pressable
          accessibilityRole="button"
          onPress={handleOpenRecap}
          testID={TID.Button.PersonalReadingRecap}
          style={({ pressed }) => [styles.recapLink, pressed && styles.pressed]}
        >
          <Text style={[styles.recapLabel, { color: noctalia.accent.text }]}>{t('inspiration.reading.recap_cta')}</Text>
          <IconSymbol name="chevron.right" size={14} color={noctalia.accent.text} />
        </Pressable>
      </View>
    </FlatGlassCard>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  inner: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  header: {
    gap: 4,
    marginBottom: 8,
  },
  eyebrow: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 22,
    lineHeight: 28,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 12,
  },
  rowValue: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  recapLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  recapLabel: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.85,
  },
});
