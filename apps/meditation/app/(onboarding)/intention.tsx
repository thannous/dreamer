import { useRouter } from 'expo-router';
import React from 'react';

import { OnboardingScreen } from '@/components/onboarding/OnboardingScreen';
import { SelectableCard } from '@/components/onboarding/SelectableCard';
import { useTranslation } from '@/context/LanguageContext';
import { TID } from '@/lib/testIDs';
import { useOnboarding } from '@/context/OnboardingContext';
import type { TranslationKey } from '@/lib/i18n';
import { DAILY_INTENTIONS } from '@/lib/types';

export default function IntentionStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { state, update } = useOnboarding();

  return (
    <OnboardingScreen
      testID={TID.Screen.OnboardingIntention}
      step={3}
      totalSteps={4}
      title={t('onboarding.intention.title')}
      subtitle={t('onboarding.intention.subtitle')}
      ctaLabel={t('common.continue')}
      canContinue={state.dailyIntentionMin !== null}
      onContinue={() => router.push('/reminder')}>
      {DAILY_INTENTIONS.map((minutes) => (
        <SelectableCard
          key={minutes}
          mode="single"
          label={t('onboarding.intention.minutes', { count: minutes })}
          hint={t(`onboarding.intention.hint.${minutes}` as TranslationKey)}
          selected={state.dailyIntentionMin === minutes}
          onPress={() => update({ dailyIntentionMin: minutes })}
        />
      ))}
    </OnboardingScreen>
  );
}
