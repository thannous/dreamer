import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { OnboardingScreen } from '@/components/onboarding/OnboardingScreen';
import { SelectableCard } from '@/components/onboarding/SelectableCard';
import { Chip, Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import { TID } from '@/lib/testIDs';
import { useOnboarding } from '@/context/OnboardingContext';
import { useSettings } from '@/context/SettingsContext';
import { requestPermission, syncReminders } from '@/services/notificationService';

/** Evening slots. A meditation reminder at 08:00 would miss the point. */
const SLOTS: { hour: number; minute: number }[] = [
  { hour: 20, minute: 0 },
  { hour: 21, minute: 0 },
  { hour: 21, minute: 30 },
  { hour: 22, minute: 0 },
];

const formatSlot = (hour: number, minute: number) =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

/**
 * Last step.
 *
 * Opting in here has to reach the same scheduler the settings screen drives:
 * the onboarding state is its own store, so capturing the choice in it alone
 * left the reminder switched on in the interface and scheduled nowhere, with
 * the permission never even asked for. Skipping stays a pure skip — someone
 * who taps "not now" after ticking the box means not now.
 */
export default function ReminderStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { state, update, complete } = useOnboarding();
  const { setReminders } = useSettings();

  const leave = async () => {
    await complete();
    router.replace('/(drawer)/(tabs)');
  };

  const finish = async () => {
    if (state.reminder.enabled) {
      const granted = await requestPermission();

      if (granted) {
        const schedule = {
          enabled: true,
          hour: state.reminder.hour,
          minute: state.reminder.minute,
          days: [],
        };

        await setReminders(schedule);
        // A refused or failed scheduling must not strand the user in
        // onboarding: the reminder is a nicety, reaching the app is not.
        await syncReminders(schedule, {
          title: t('reminders.notification.title'),
          body: t('reminders.notification.body'),
        }).catch(() => {});
      }
    }

    await leave();
  };

  return (
    <OnboardingScreen
      testID={TID.Screen.OnboardingReminder}
      step={4}
      totalSteps={4}
      title={t('onboarding.reminder.title')}
      subtitle={t('onboarding.reminder.subtitle')}
      ctaLabel={t('onboarding.reminder.done')}
      onContinue={finish}
      onSkip={leave}
      skipLabel={t('common.later')}>
      <SelectableCard
        label={t('onboarding.reminder.enable')}
        hint={t('onboarding.reminder.hour', {
          time: formatSlot(state.reminder.hour, state.reminder.minute),
        })}
        selected={state.reminder.enabled}
        onPress={() =>
          update((current) => ({
            reminder: { ...current.reminder, enabled: !current.reminder.enabled },
          }))
        }
      />

      {state.reminder.enabled ? (
        <View className="gap-3">
          <Text variant="overline">{t('onboarding.reminder.at')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {SLOTS.map((slot) => (
              <Chip
                key={formatSlot(slot.hour, slot.minute)}
                label={formatSlot(slot.hour, slot.minute)}
                selected={
                  state.reminder.hour === slot.hour && state.reminder.minute === slot.minute
                }
                onPress={() => update((current) => ({ reminder: { ...current.reminder, ...slot } }))}
              />
            ))}
          </View>
        </View>
      ) : null}
    </OnboardingScreen>
  );
}
