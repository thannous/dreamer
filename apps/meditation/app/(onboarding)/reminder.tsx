import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ScopedTheme } from 'uniwind';

import { Screen } from '@/components/atmosphere/Screen';
import { ReminderOrbitalClock } from '@/components/onboarding/ReminderOrbitalClock';
import { StepDots } from '@/components/onboarding/StepDots';
import { BackLink, Button, Rule, Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { useSettings } from '@/context/SettingsContext';
import { formatHour, formatTimeEntry, parseTimeEntry } from '@/lib/reminders';
import { TID } from '@/lib/testIDs';
import { requestPermission, syncReminders } from '@/services/notificationService';

/**
 * Last step. Opting in reaches the same scheduler as Settings; opting out
 * remains a pure exit and never requests notification permission.
 */
export default function ReminderStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { state, update, complete } = useOnboarding();
  const { setReminders } = useSettings();
  const { fontScale } = useWindowDimensions();
  const [timeDraft, setTimeDraft] = useState<string | null>(null);
  const largeText = fontScale >= 1.5;
  const timeEntry = timeDraft ?? formatHour(state.reminder.hour, state.reminder.minute);
  const parsedTime = parseTimeEntry(timeEntry);
  const invalidTime = state.reminder.enabled && parsedTime === null;

  const changeTime = (value: string) => {
    const formatted = formatTimeEntry(value);
    const parsed = parseTimeEntry(formatted);

    setTimeDraft(formatted);
    if (parsed) {
      void update((current) => ({ reminder: { ...current.reminder, ...parsed } }));
    }
  };

  const stepTime = (minutes: number) => {
    const base = parsedTime ?? {
      hour: state.reminder.hour,
      minute: state.reminder.minute,
    };
    const totalMinutes = (base.hour * 60 + base.minute + minutes + 24 * 60) % (24 * 60);
    const next = {
      hour: Math.floor(totalMinutes / 60),
      minute: totalMinutes % 60,
    };

    setTimeDraft(null);
    void update((current) => ({ reminder: { ...current.reminder, ...next } }));
  };

  const toggleReminder = () => {
    void update((current) => ({
      reminder: { ...current.reminder, enabled: !current.reminder.enabled },
    }));
  };

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
        await syncReminders(schedule, {
          title: t('reminders.notification.title'),
          body: t('reminders.notification.body'),
        }).catch(() => {});
      }
    }

    await leave();
  };

  const footer = (
    <View className="gap-2 px-gutter pb-4 pt-1">
      <Button
        testID={TID.Button.OnboardingContinue}
        label={t('onboarding.reminder.done')}
        labelVariant="body"
        disabled={invalidTime}
        onPress={finish}
      />
      <Button
        label={t('common.later')}
        labelVariant="body"
        variant="ghost"
        onPress={leave}
      />
    </View>
  );

  return (
    <ScopedTheme theme="dark">
      <Screen variant="subtle">
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.atmosphereVeil]} />
        <View testID={TID.Screen.OnboardingReminder} className="flex-1">
          <View className="flex-row items-center justify-between px-7 pb-2 pt-2">
            <BackLink
              label={t('common.back')}
              fallbackHref="/intention"
              testID={TID.Button.OnboardingBack}
            />
            <StepDots current={4} total={4} />
          </View>

          <ScrollView
            className="flex-1"
            contentContainerClassName="pb-2 pt-5"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View className="gap-3 px-7">
              <Text variant="h1">{t('onboarding.reminder.title')}</Text>
              <Rule className="self-start" />
              <Text variant="bodySm">{t('onboarding.reminder.subtitle')}</Text>
            </View>

            <ReminderOrbitalClock
              enabled={state.reminder.enabled}
              enableLabel={t('onboarding.reminder.enable')}
              error={invalidTime ? t('onboarding.reminder.time.error') : undefined}
              onChangeTime={changeTime}
              onStepTime={stepTime}
              onToggle={toggleReminder}
              time={timeEntry}
              timeHint={t(
                state.reminder.enabled
                  ? 'onboarding.reminder.time.hint'
                  : 'onboarding.reminder.time.disabled'
              )}
              timeLabel={t('onboarding.reminder.at')}
            />

            {largeText ? footer : null}
          </ScrollView>

          {largeText ? null : footer}
        </View>
      </Screen>
    </ScopedTheme>
  );
}

const styles = StyleSheet.create({
  atmosphereVeil: {
    backgroundColor: 'rgba(3, 4, 13, 0.74)',
  },
});
