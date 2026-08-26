import React, { useMemo } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import { shiftDay } from '@/lib/streak';
import type { PracticeEntry } from '@/lib/types';

type Props = {
  practiceLog: PracticeEntry[];
  today: string;
};

type JourneyDay = {
  day: string;
  practised: boolean;
  isToday: boolean;
};

function mondayOf(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  const weekday = (new Date(Date.UTC(year, month - 1, date)).getUTCDay() + 6) % 7;
  return shiftDay(day, -weekday);
}

export function weekJourney(practiceLog: PracticeEntry[], today: string): JourneyDay[] {
  const firstDay = mondayOf(today);
  const practisedDays = new Set(practiceLog.map((entry) => entry.dateISO));

  return Array.from({ length: 7 }, (_, index) => {
    const day = shiftDay(firstDay, index);
    return {
      day,
      practised: practisedDays.has(day),
      isToday: day === today,
    };
  });
}

/**
 * A seven-step ritual path, rather than a dashboard chart. The line stays
 * quiet; completed practices become the constellation drawn over it.
 */
export function WeeklyJourney({ practiceLog, today }: Props) {
  const { language, t } = useTranslation();
  const days = useMemo(() => weekJourney(practiceLog, today), [practiceLog, today]);
  const completedCount = days.filter((day) => day.practised).length;
  const progressLabel = t('home.journey.progressLabel', {
    count: Math.round((completedCount / days.length) * 100),
  });

  return (
    <View className="gap-3" accessible accessibilityLabel={progressLabel}>
      <View className="flex-row items-end justify-between gap-3">
        <Text variant="overline">{t('home.journey.progress')}</Text>
        <Text variant="caption" tone="default" className="shrink text-right">
          {progressLabel}
        </Text>
      </View>

      <View className="relative flex-row items-start justify-between">
        <View
          className="absolute left-3 right-3 top-2 h-px bg-hairline"
          pointerEvents="none"
        />
        {days.map((item) => {
          const weekday = new Date(`${item.day}T12:00:00Z`).toLocaleDateString(language, {
            weekday: 'narrow',
            timeZone: 'UTC',
          });

          return (
            <View key={item.day} importantForAccessibility="no-hide-descendants" className="gap-2">
              <View
                className={[
                  'h-4 w-4 rounded-full border',
                  item.practised
                    ? 'border-champagne-soft bg-champagne'
                    : item.isToday
                      ? 'border-champagne bg-ink-raised'
                      : 'border-hairline bg-ink-panel',
                ].join(' ')}
              />
              <Text variant="caption" tone={item.isToday ? 'default' : 'muted'}>
                {weekday}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
