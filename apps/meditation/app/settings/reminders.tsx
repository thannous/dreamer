import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Screen } from '@/components/atmosphere/Screen';
import { SelectableCard } from '@/components/onboarding/SelectableCard';
import { BackLink, Chip, Rule, Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import { useSettings } from '@/context/SettingsContext';
import { formatHour, nextOccurrence, toggleDay, WEEKDAYS, type Weekday } from '@/lib/reminders';
import { requestPermission, syncReminders } from '@/services/notificationService';

/** Evening slots. A meditation reminder at 08:00 would miss the point. */
const SLOTS = [
  { hour: 20, minute: 0 },
  { hour: 21, minute: 0 },
  { hour: 21, minute: 30 },
  { hour: 22, minute: 0 },
];

const WEEKDAY_KEYS = [
  'profile.weekday.mon',
  'profile.weekday.tue',
  'profile.weekday.wed',
  'profile.weekday.thu',
  'profile.weekday.fri',
  'profile.weekday.sat',
  'profile.weekday.sun',
] as const;

export default function RemindersScreen() {
  const { t } = useTranslation();
  const { reminders, setReminders } = useSettings();
  const [denied, setDenied] = useState(false);

  /**
   * The schedule is rewritten whenever it changes rather than on a save button:
   * a settings screen that needs confirming is a settings screen people leave
   * in the wrong state.
   */
  useEffect(() => {
    syncReminders(reminders, {
      title: t('reminders.notification.title'),
      body: t('reminders.notification.body'),
    }).catch(() => {});
  }, [reminders, t]);

  const enable = async (next: boolean) => {
    if (next) {
      const granted = await requestPermission();
      setDenied(!granted);
      if (!granted) return;
    }
    await setReminders({ enabled: next });
  };

  const next = nextOccurrence(reminders, new Date());

  return (
    <Screen variant="subtle" edges={['top']}>
      <BackLink label={t('common.back')} className="px-gutter pt-2" />

      <ScrollView
        contentContainerClassName="px-gutter pb-16 pt-2 gap-6"
        showsVerticalScrollIndicator={false}>
        <View className="gap-3">
          <Text variant="h1">{t('reminders.title')}</Text>
          <Rule className="self-start" />
          <Text variant="bodySm">{t('reminders.subtitle')}</Text>
        </View>

        <SelectableCard
          label={t('reminders.enable')}
          hint={formatHour(reminders.hour, reminders.minute)}
          selected={reminders.enabled}
          onPress={() => enable(!reminders.enabled)}
        />

        {denied ? <Text variant="bodySm">{t('reminders.denied')}</Text> : null}

        {reminders.enabled ? (
          <>
            <View className="gap-3">
              <Text variant="overline">{t('reminders.hour')}</Text>
              <View className="flex-row flex-wrap gap-2">
                {SLOTS.map((slot) => (
                  <Chip
                    key={formatHour(slot.hour, slot.minute)}
                    label={formatHour(slot.hour, slot.minute)}
                    selected={reminders.hour === slot.hour && reminders.minute === slot.minute}
                    onPress={() => setReminders(slot)}
                  />
                ))}
              </View>
            </View>

            <View className="gap-3">
              <Text variant="overline">{t('reminders.days')}</Text>
              <View className="flex-row gap-2">
                {WEEKDAYS.map((day: Weekday, index) => (
                  <Chip
                    key={day}
                    label={t(WEEKDAY_KEYS[index])}
                    // An empty selection means every day, so all read as on.
                    selected={reminders.days.length === 0 || reminders.days.includes(day)}
                    onPress={() => setReminders({ days: toggleDay(reminders.days, day) })}
                  />
                ))}
              </View>
              {reminders.days.length === 0 ? (
                <Text variant="caption">{t('reminders.days.every')}</Text>
              ) : null}
            </View>

            {next ? (
              <Text variant="caption">
                {t('reminders.next', {
                  when: `${next.toLocaleDateString()} ${formatHour(next.getHours(), next.getMinutes())}`,
                })}
              </Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
