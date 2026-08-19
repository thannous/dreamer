import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { OnboardingScreen } from '@/components/onboarding/OnboardingScreen';
import { SelectableCard } from '@/components/onboarding/SelectableCard';
import { Chip, Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import { useOnboarding } from '@/context/OnboardingContext';

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
 * Last step. Scheduling the notification itself is L6 — here we only capture
 * the intent, so the permission prompt lands when the app can honour it.
 */
export default function ReminderStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { state, update, complete } = useOnboarding();

  const finish = async () => {
    await complete();
    router.replace('/(tabs)');
  };

  return (
    <OnboardingScreen
      step={4}
      totalSteps={4}
      title={t('onboarding.reminder.title')}
      subtitle={t('onboarding.reminder.subtitle')}
      ctaLabel={t('onboarding.reminder.done')}
      onContinue={finish}
      onSkip={finish}
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
          <Text variant="overline">{t('onboarding.reminder.hour', { time: '' }).trim()}</Text>
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
