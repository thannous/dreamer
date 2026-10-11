import React from 'react';
import { Pressable, View } from 'react-native';

import { IconSymbol, Text } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';
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
  sessionId?: SessionId;
  onPress?: () => void;
};

/** The world's editorial path, deliberately separate from in-session progress. */
export function WorldPathProgress({ world, progress, className, sessionId, onPress }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const state = journeyStateForWorld(world.id, progress);
  const selectedIndex = world.personality.progression.findIndex((step) => step.sessionId === sessionId);
  const index = selectedIndex >= 0 ? selectedIndex : state.index;
  const current = index + 1;
  const completed = world.personality.progression.every(
    (step) => (progress[step.sessionId]?.completedCount ?? 0) > 0
  );
  const stageLabel = t(
    `world.${world.id}.progress.${world.personality.progression[index].id}` as TranslationKey
  );
  const positionLabel = t('journey.position', { current, total: world.personality.progression.length });
  const progressLabel = t('journey.step', {
    current,
    total: world.personality.progression.length,
    stage: stageLabel,
  });

  return (
    <View
      testID={WORLD_PATH_PROGRESS_TEST_ID}
      className={`gap-2 ${className ?? ''}`}
      accessible={!onPress}
      accessibilityRole={onPress ? undefined : 'progressbar'}
      accessibilityLabel={onPress ? undefined : `${t(world.nameKey)}. ${progressLabel}`}
      accessibilityValue={onPress ? undefined : { text: completed ? t('journey.complete') : progressLabel }}>
      <Pressable
        testID={onPress ? 'btn.journey.open' : undefined}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${t(world.nameKey)}. ${completed ? t('journey.complete') + '. ' : ''}${onPress ? positionLabel : progressLabel}`}
        accessibilityHint={onPress ? t('journey.open') : undefined}
        onPress={onPress}
        disabled={!onPress}
        className={onPress ? 'min-h-12 justify-center active:opacity-70' : 'justify-center'}>
        <View className="min-w-0 gap-2">
          {completed ? <Text variant="bodySm" tone="accent">{t('journey.complete')}</Text> : null}
          {onPress ? (
            <View className="flex-row items-center gap-1">
              <Text variant="bodySm">{positionLabel}</Text>
              <IconSymbol name="chevron.right" color={colors.accentText} size={16} />
            </View>
          ) : <Text variant="bodySm">{progressLabel}</Text>}
        </View>
      </Pressable>
    </View>
  );
}
