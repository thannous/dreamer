import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ScopedTheme } from 'uniwind';

import { Screen } from '@/components/atmosphere/Screen';
import { DurationLunarDial } from '@/components/onboarding/DurationLunarDial';
import { StepDots } from '@/components/onboarding/StepDots';
import { BackLink, Button, Rule, Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import { useOnboarding } from '@/context/OnboardingContext';
import type { TranslationKey } from '@/lib/i18n';
import { TID } from '@/lib/testIDs';
import type { DailyIntention } from '@/lib/types';

const DEFAULT_INTENTION: DailyIntention = 10;

export default function IntentionStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { state, update } = useOnboarding();
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale >= 1.5;
  const selected = state.dailyIntentionMin ?? DEFAULT_INTENTION;

  useEffect(() => {
    if (state.dailyIntentionMin === null) {
      void update({ dailyIntentionMin: DEFAULT_INTENTION });
    }
  }, [state.dailyIntentionMin, update]);

  const footer = (
    <View className="pb-4 pt-1" style={styles.footer}>
      <Button
        testID={TID.Button.OnboardingContinue}
        label={t('common.continue')}
        labelVariant="body"
        onPress={() => router.push('/reminder')}
      />
    </View>
  );

  return (
    <ScopedTheme theme="dark">
      <Screen variant="subtle">
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.atmosphereVeil]} />
        <View testID={TID.Screen.OnboardingIntention} className="flex-1">
          <View className="flex-row items-center justify-between px-7 pb-2 pt-2">
            <BackLink
              label={t('common.back')}
              fallbackHref="/experience"
              testID={TID.Button.OnboardingBack}
            />
            <StepDots current={3} total={4} />
          </View>

          <ScrollView
            className="flex-1"
            contentContainerClassName="pb-2 pt-5"
            showsVerticalScrollIndicator={false}>
            <View className="gap-3 px-7" style={styles.copyBlock}>
              <Text variant="h1">{t('onboarding.intention.title')}</Text>
              <Rule className="self-start" />
              <Text variant="bodySm">{t('onboarding.intention.subtitle')}</Text>
            </View>

            <DurationLunarDial
              value={selected}
              valueLabel={t('onboarding.intention.minutes', { count: selected })}
              description={t(`onboarding.intention.hint.${selected}` as TranslationKey)}
              previousLabel={t('onboarding.intention.previous')}
              nextLabel={t('onboarding.intention.next')}
              onChange={(value) => void update({ dailyIntentionMin: value })}
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
  copyBlock: {
    maxWidth: 330,
  },
  footer: {
    paddingHorizontal: 24,
  },
});
