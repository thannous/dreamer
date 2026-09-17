import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import type { MeditationWorld } from '@/constants/worlds';
import { useTranslation } from '@/context/LanguageContext';
import type { TranslationKey } from '@/lib/i18n';
import type { SessionId, SessionProgress } from '@/lib/types';
import { journeyStateForWorld } from '@/lib/worldJourneys';

export const WORLD_PATH_PROGRESS_TEST_ID = 'world.path.progress';

type Props = {
  world: MeditationWorld;
  progress: Record<SessionId, SessionProgress>;
  className?: string;
};

/** The world's editorial path, deliberately separate from in-session progress. */
export function WorldPathProgress({ world, progress, className }: Props) {
  const { t } = useTranslation();
  const state = journeyStateForWorld(world.id, progress);
  const current = state.index + 1;
  const stageLabel = t(
    `world.${world.id}.progress.${state.stageId}` as TranslationKey
  );
  const progressLabel = t('practice.progress', {
    current,
    total: world.personality.progression.length,
    stage: stageLabel,
  });

  return (
    <View
      testID={WORLD_PATH_PROGRESS_TEST_ID}
      className={`gap-2 ${className ?? ''}`}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${t(world.nameKey)}. ${progressLabel}`}
      accessibilityValue={{
        min: 1,
        max: world.personality.progression.length,
        now: current,
      }}>
      <Text variant="bodySm" numberOfLines={2}>
        {progressLabel}
      </Text>
      <View
        className="flex-row gap-2"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {world.personality.progression.map((step, index) => (
          <View
            key={step.id}
            className={`h-px flex-1 ${index <= state.index ? 'bg-champagne' : 'bg-hairline'}`}
          />
        ))}
      </View>
    </View>
  );
}
