import React from 'react';
import { View, useWindowDimensions } from 'react-native';

import { IconSymbol, Text } from '@/components/ui';
import { Themes } from '@/constants/theme';
import type { MeditationWorld } from '@/constants/worlds';
import { useTranslation } from '@/context/LanguageContext';
import type { TranslationKey } from '@/lib/i18n';

export const PRACTICE_PROGRESS_TEST_ID = 'practice.progress';

const STAGES = ['prepare', 'practice', 'settle'] as const;
export type PracticeStage = (typeof STAGES)[number];

const STAGE_ICON = {
  prepare: 'sparkles',
  practice: 'wind',
  settle: 'sun.horizon',
} as const;

/** Circle size of a step; the connecting hairline runs through its centre.
 * The trainer keeps the small marks, its ring needs the height. */
const STEP = 34;
const STEP_SMALL = 22;

type Props = {
  world: MeditationWorld;
  stage: PracticeStage;
  /** Stage names under the marks; off where the trainer needs the height. */
  labels?: boolean;
  className?: string;
};

/**
 * The three moments of a practice, drawn like the onboarding of Noctalia
 * Dreams: circled marks on one hairline, the current one filled. The exact
 * stage stays textual for every reader; the marks are decoration.
 */
export function PracticeProgress({ world, stage, labels = true, className }: Props) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const stackLabels = fontScale >= 1.6;
  const stageIndex = STAGES.indexOf(stage);
  const step = labels ? STEP : STEP_SMALL;
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
        className="mt-1 flex-row"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {STAGES.map((item, index) => {
          const reached = index <= stageIndex;
          const currentStage = index === stageIndex;
          return (
            <View key={item} className="flex-1 items-center gap-1.5">
              {index > 0 ? (
                <View
                  className={`absolute h-px ${reached ? 'bg-champagne' : 'bg-hairline'}`}
                  style={{ top: step / 2, right: '50%', width: '100%' }}
                />
              ) : null}
              <View
                className={`items-center justify-center rounded-full border ${
                  currentStage
                    ? 'border-champagne bg-champagne'
                    : reached
                      ? 'border-champagne bg-ink'
                      : 'border-hairline bg-ink'
                }`}
                style={{ width: step, height: step }}>
                <IconSymbol
                  name={STAGE_ICON[item]}
                  size={labels ? 16 : 12}
                  color={
                    currentStage
                      ? Themes[world.appearance].textOnAccent
                      : Themes[world.appearance].accentText
                  }
                />
              </View>
              {stackLabels || !labels ? null : (
                <Text variant="caption" tone={currentStage ? 'default' : 'muted'} className="font-display-light">
                  {t(`practice.stage.${item}` as TranslationKey)}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
