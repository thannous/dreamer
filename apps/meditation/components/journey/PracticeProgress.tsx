import React from 'react';
import { View, useWindowDimensions } from 'react-native';

import { Text } from '@/components/ui';
import type { MeditationWorld } from '@/constants/worlds';
import { useTranslation } from '@/context/LanguageContext';
import type { TranslationKey } from '@/lib/i18n';

export const PRACTICE_PROGRESS_TEST_ID = 'practice.progress';

const STAGES = ['prepare', 'practice', 'settle'] as const;
export type PracticeStage = (typeof STAGES)[number];

type Props = {
  world: MeditationWorld;
  stage: PracticeStage;
  className?: string;
};

/**
 * One quiet wayfinding mark from preparation to completion. The exact stage
 * stays textual; the three hairlines make distance visible without becoming a
 * dashboard or a second focal point.
 */
export function PracticeProgress({ world, stage, className }: Props) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const stackLabels = fontScale >= 1.6;
  const stageIndex = STAGES.indexOf(stage);
  const current = stageIndex + 1;
  const stageLabel = t(`practice.stage.${stage}` as TranslationKey);
  const progressLabel = t('practice.progress', {
    current,
    total: STAGES.length,
    stage: stageLabel,
  });

  return (
    <View
      testID={PRACTICE_PROGRESS_TEST_ID}
      className={`gap-2 ${className ?? ''}`}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${t(world.nameKey)}. ${progressLabel}`}
      accessibilityValue={{ min: 1, max: STAGES.length, now: current }}>
      <View
        className={
          stackLabels
            ? 'gap-1'
            : 'flex-row items-start justify-between gap-3'
        }>
        <Text
          variant="overline"
          testID="practice.progress.world"
          className={stackLabels ? '' : 'min-w-0 shrink'}>
          {t(world.nameKey)}
        </Text>
        <Text
          variant="caption"
          tone="default"
          testID="practice.progress.stage"
          className={stackLabels ? '' : 'min-w-0 shrink'}>
          {progressLabel}
        </Text>
      </View>

      <View
        className="flex-row gap-2"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {STAGES.map((item, index) => (
          <View
            key={item}
            className={`h-px flex-1 ${index <= stageIndex ? 'bg-champagne' : 'bg-hairline'}`}
          />
        ))}
      </View>
    </View>
  );
}
