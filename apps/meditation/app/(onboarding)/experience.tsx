import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Screen } from '@/components/atmosphere/Screen';
import {
  ExperienceJourney,
  type ExperienceJourneyItem,
} from '@/components/onboarding/ExperienceJourney';
import { StepDots } from '@/components/onboarding/StepDots';
import { BackLink, Button, Rule, Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import { TID } from '@/lib/testIDs';
import { useOnboarding } from '@/context/OnboardingContext';
import type { TranslationKey } from '@/lib/i18n';
import { EXPERIENCE_LEVELS } from '@/lib/types';

const EXPERIENCE_ARTWORK = {
  beginner: require('@/assets/onboarding/experience/beginner-v1.webp'),
  occasional: require('@/assets/onboarding/experience/occasional-v1.webp'),
  regular: require('@/assets/onboarding/experience/regular-v1.webp'),
} satisfies Record<(typeof EXPERIENCE_LEVELS)[number], number>;

export default function ExperienceStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { state, update } = useOnboarding();
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale >= 1.5;

  const items: ExperienceJourneyItem[] = EXPERIENCE_LEVELS.map((level) => ({
    artwork: EXPERIENCE_ARTWORK[level],
    hint: t(`onboarding.experience.${level}.hint` as TranslationKey),
    label: t(`onboarding.experience.${level}` as TranslationKey),
    level,
    testID: level === 'beginner' ? TID.Option.ExperienceBeginner : undefined,
  }));

  const footer = (
    <View className="px-gutter pb-4 pt-1">
      <Button
        testID={TID.Button.OnboardingContinue}
        label={t('common.continue')}
        labelVariant="body"
        disabled={state.experience === null}
        onPress={() => router.push('/intention')}
      />
    </View>
  );

  return (
    <Screen variant="subtle">
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.atmosphereVeil]} />
      <View testID={TID.Screen.OnboardingExperience} className="flex-1">
        <View className="flex-row items-center justify-between px-7 pb-2 pt-2">
          <BackLink
            label={t('common.back')}
            fallbackHref="/goals"
            testID={TID.Button.OnboardingBack}
          />
          <StepDots current={2} total={4} />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-2 pt-5"
          showsVerticalScrollIndicator={false}>
          <View className="gap-3 px-7">
            <Text variant="h1">{t('onboarding.experience.title')}</Text>
            <Rule className="self-start" />
            <Text variant="bodySm">{t('onboarding.experience.subtitle')}</Text>
          </View>

          <View style={styles.journeyOffset}>
            <ExperienceJourney
              items={items}
              selected={state.experience}
              onSelect={(experience) => update({ experience })}
            />
          </View>

          {largeText ? footer : null}
        </ScrollView>

        {largeText ? null : footer}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  atmosphereVeil: {
    backgroundColor: 'rgba(3, 4, 13, 0.58)',
  },
  journeyOffset: {
    marginTop: 20,
  },
});
