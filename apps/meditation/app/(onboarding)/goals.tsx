import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import { Screen } from '@/components/atmosphere/Screen';
import { GoalSanctuaryCard } from '@/components/onboarding/GoalSanctuaryCard';
import { StepDots } from '@/components/onboarding/StepDots';
import { BackLink, Button, Rule, Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import { TID } from '@/lib/testIDs';
import { useOnboarding } from '@/context/OnboardingContext';
import type { TranslationKey } from '@/lib/i18n';
import type { PracticeGoal } from '@/lib/types';

const LEFT_GOALS: PracticeGoal[] = ['sleep', 'focus', 'gratitude'];
const RIGHT_GOALS: PracticeGoal[] = ['stress', 'anxiety', 'dream-prep'];

const GOAL_ARTWORK = {
  sleep: require('@/assets/onboarding/goals/sleep-v1.webp'),
  stress: require('@/assets/onboarding/goals/stress-v1.webp'),
  focus: require('@/assets/onboarding/goals/focus-v1.webp'),
  anxiety: require('@/assets/onboarding/goals/anxiety-v1.webp'),
  gratitude: require('@/assets/onboarding/goals/positive-v1.webp'),
  'dream-prep': require('@/assets/onboarding/goals/dreams-v1.webp'),
} satisfies Record<PracticeGoal, number>;

const GOAL_HEIGHT = {
  sleep: 226,
  stress: 191,
  focus: 227,
  anxiety: 213,
  gratitude: 201,
  'dream-prep': 242,
} satisfies Record<PracticeGoal, number>;

export default function GoalsStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { state, update } = useOnboarding();
  const { fontScale } = useWindowDimensions();
  const cardHeightScale = Math.max(1, Math.min(fontScale, 1.6));

  // Functional form: two quick taps must both land, not race each other.
  const toggle = (goal: PracticeGoal) =>
    update((current) => ({
      goals: current.goals.includes(goal)
        ? current.goals.filter((item) => item !== goal)
        : [...current.goals, goal],
    }));

  const renderGoal = (goal: PracticeGoal) => (
    <GoalSanctuaryCard
      key={goal}
      artwork={GOAL_ARTWORK[goal]}
      height={GOAL_HEIGHT[goal] * cardHeightScale}
      label={t(`onboarding.goals.${goal}` as TranslationKey)}
      selected={state.goals.includes(goal)}
      testID={goal === 'sleep' ? TID.Option.GoalSleep : undefined}
      onPress={() => toggle(goal)}
    />
  );

  return (
    <Screen variant="subtle">
      <View testID={TID.Screen.OnboardingGoals} className="flex-1">
        <View className="flex-row items-center justify-between px-gutter pb-2 pt-2">
          <BackLink
            label={t('common.back')}
            fallbackHref="/breath-intro"
            testID={TID.Button.OnboardingBack}
          />
          <StepDots current={1} total={4} />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-2 px-gutter pb-5 pt-3"
          showsVerticalScrollIndicator={false}>
          <View className="gap-3">
            <Text variant="h1">{t('onboarding.goals.title')}</Text>
            <Rule className="self-start" />
            <Text variant="bodySm">{t('onboarding.goals.subtitle')}</Text>
          </View>

          <View className="flex-row items-start gap-2">
            <View className="flex-1 gap-2">{LEFT_GOALS.map(renderGoal)}</View>
            <View className="flex-1 gap-2 pt-1">{RIGHT_GOALS.map(renderGoal)}</View>
          </View>
        </ScrollView>

        <View className="px-gutter pb-4 pt-2">
          <Button
            testID={TID.Button.OnboardingContinue}
            label={t('common.continue')}
            disabled={state.goals.length === 0}
            onPress={() => router.push('/experience')}
          />
        </View>
      </View>
    </Screen>
  );
}
