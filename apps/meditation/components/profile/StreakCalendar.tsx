import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import type { CalendarDay } from '@/lib/streak';

type Props = { days: CalendarDay[] };

const WEEKDAY_KEYS = [
  'profile.weekday.mon',
  'profile.weekday.tue',
  'profile.weekday.wed',
  'profile.weekday.thu',
  'profile.weekday.fri',
  'profile.weekday.sat',
  'profile.weekday.sun',
] as const;

/**
 * Five weeks of practice, one dot per day.
 *
 * A calendar, not a scoreboard: a missed day is a quiet outline, never a red
 * mark. The point is to show a rhythm, and shaming someone into meditating has
 * never worked.
 */
export function StreakCalendar({ days }: Props) {
  const { t } = useTranslation();

  return (
    <View className="gap-2">
      <View className="flex-row">
        {WEEKDAY_KEYS.map((key) => (
          <View key={key} className="flex-1 items-center">
            <Text variant="caption">{t(key)}</Text>
          </View>
        ))}
      </View>

      {/* One summary instead of thirty-five dates: a screen reader reading out
          every day of five weeks buries the number that actually matters. */}
      <View
        className="flex-row flex-wrap"
        // `accessible` is what collapses the thirty-five dots into one element;
        // without it the role is never exposed and each dot is read separately.
        accessible
        accessibilityRole="summary"
        accessibilityLabel={t('profile.calendar.summary', {
          practised: days.filter((day) => day.practised).length,
          total: days.length,
        })}>
        {days.map((day) => (
          <View
            key={day.day}
            className="w-[14.28%] items-center py-1.5"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            <View
              className={[
                'h-6 w-6 rounded-full border',
                day.practised ? 'border-champagne bg-champagne' : 'border-hairline',
                day.isToday && !day.practised ? 'border-champagne-soft' : '',
              ].join(' ')}
            />
          </View>
        ))}
      </View>
    </View>
  );
}
