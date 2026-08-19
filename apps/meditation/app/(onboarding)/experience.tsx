import { useRouter } from 'expo-router';
import React from 'react';

import { OnboardingScreen } from '@/components/onboarding/OnboardingScreen';
import { SelectableCard } from '@/components/onboarding/SelectableCard';
import { useTranslation } from '@/context/LanguageContext';
import { TID } from '@/lib/testIDs';
import { useOnboarding } from '@/context/OnboardingContext';
import type { TranslationKey } from '@/lib/i18n';
import { EXPERIENCE_LEVELS } from '@/lib/types';

export default function ExperienceStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { state, update } = useOnboarding();

  return (
    <OnboardingScreen
      testID={TID.Screen.OnboardingExperience}
      step={2}
      totalSteps={4}
      title={t('onboarding.experience.title')}
      subtitle={t('onboarding.experience.subtitle')}
      ctaLabel={t('common.continue')}
      canContinue={state.experience !== null}
      onContinue={() => router.push('/intention')}>
      {EXPERIENCE_LEVELS.map((level) => (
        <SelectableCard
          key={level}
          mode="single"
          label={t(`onboarding.experience.${level}` as TranslationKey)}
          hint={t(`onboarding.experience.${level}.hint` as TranslationKey)}
          selected={state.experience === level}
          onPress={() => update({ experience: level })}
        />
      ))}
    </OnboardingScreen>
  );
}
