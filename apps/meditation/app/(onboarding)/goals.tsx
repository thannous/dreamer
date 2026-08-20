import { useRouter } from 'expo-router';
import React from 'react';

import { OnboardingScreen } from '@/components/onboarding/OnboardingScreen';
import { SelectableCard } from '@/components/onboarding/SelectableCard';
import { useTranslation } from '@/context/LanguageContext';
import { TID } from '@/lib/testIDs';
import { useOnboarding } from '@/context/OnboardingContext';
import type { TranslationKey } from '@/lib/i18n';
import { PRACTICE_GOALS, type PracticeGoal } from '@/lib/types';

export default function GoalsStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { state, update } = useOnboarding();

  // Functional form: two quick taps must both land, not race each other.
  const toggle = (goal: PracticeGoal) =>
    update((current) => ({
      goals: current.goals.includes(goal)
        ? current.goals.filter((item) => item !== goal)
        : [...current.goals, goal],
    }));

  return (
    <OnboardingScreen
      testID={TID.Screen.OnboardingGoals}
      step={1}
      totalSteps={4}
      title={t('onboarding.goals.title')}
      subtitle={t('onboarding.goals.subtitle')}
      ctaLabel={t('common.continue')}
      canContinue={state.goals.length > 0}
      onContinue={() => router.push('/experience')}>
      {PRACTICE_GOALS.map((goal) => (
        <SelectableCard
          key={goal}
          testID={goal === 'sleep' ? TID.Option.GoalSleep : undefined}
          label={t(`onboarding.goals.${goal}` as TranslationKey)}
          selected={state.goals.includes(goal)}
          onPress={() => toggle(goal)}
        />
      ))}
    </OnboardingScreen>
  );
}
