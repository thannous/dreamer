import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, useWindowDimensions, View } from 'react-native';

import { Screen } from '@/components/atmosphere/Screen';
import { BreathGauge } from '@/components/breathe/BreathGauge';
import { BreathRing } from '@/components/breathe/BreathRing';
import { BackLink, Button, Chip, Rule, Text } from '@/components/ui';
import {
  BREATH_DURATIONS,
  isBreathingPatternId,
  PATTERN_BY_ID,
  type BreathDurationMinutes,
} from '@/content/breathing';
import { useTranslation } from '@/context/LanguageContext';
import { TID } from '@/lib/testIDs';
import { useLibrary } from '@/context/LibraryContext';
import { useBreathEngine } from '@/hooks/useBreathEngine';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useScreenReader } from '@/hooks/useScreenReader';
import { formatTime } from '@/lib/audio';
import type { TranslationKey } from '@/lib/i18n';

export default function BreatheExercise() {
  const { pattern: patternParam } = useLocalSearchParams<{ pattern: string }>();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const screenReader = useScreenReader();
  const { recordPractice } = useLibrary();

  const valid = patternParam && isBreathingPatternId(patternParam);
  const pattern = valid ? PATTERN_BY_ID[patternParam] : PATTERN_BY_ID.calm;

  const [durationMin, setDurationMin] = useState<BreathDurationMinutes>(
    pattern.defaultDurationMin
  );

  const engine = useBreathEngine({ pattern, durationMin });

  /**
   * Speak each phase change.
   *
   * The ring IS the instruction — without this, the exercise gives a blind
   * listener nothing at all. `accessibilityLiveRegion` covers Android; iOS
   * needs the explicit announcement, so both are wired.
   */
  const spokenPhaseRef = useRef<string | null>(null);

  useEffect(() => {
    if (!screenReader || !engine.running) return;
    if (spokenPhaseRef.current === engine.state.phase) return;

    spokenPhaseRef.current = engine.state.phase;
    AccessibilityInfo.announceForAccessibility(
      t(`breathe.phase.${engine.state.phase}` as TranslationKey)
    );
  }, [screenReader, engine.running, engine.state.phase, t]);

  // A finished exercise counts as practice, exactly like a guided session.
  useEffect(() => {
    if (!engine.finished) return;
    recordPractice({ patternId: pattern.id, seconds: durationMin * 60 }).catch(() => {});
  }, [engine.finished, pattern.id, durationMin, recordPractice]);

  if (!valid) {
    return (
      <Screen variant="immersive">
        <View className="flex-1 items-center justify-center px-gutter">
          <Text variant="h3">{t('search.empty.title')}</Text>
        </View>
      </Screen>
    );
  }

  const ringSize = Math.min(width * 0.62, 280);
  const started = engine.running || engine.remainingSec < durationMin * 60;

  return (
    <Screen variant="immersive">
      <BackLink label={t('player.close')} fallbackHref="/(tabs)" className="px-gutter pt-2" />

      <View
        testID={TID.Screen.BreatheExercise}
        className="flex-1 items-center justify-center gap-10 px-gutter">
        <View className="items-center gap-2">
          <Text variant="overline">
            {t(`breathe.pattern.${pattern.id}.name` as TranslationKey)}
          </Text>
          <Text
            testID={TID.Text.BreathePhase}
            variant="display"
            className="text-center"
            accessibilityLiveRegion="polite"
            accessibilityRole="header">
            {engine.finished
              ? t('breathe.complete.title')
              : t(`breathe.phase.${engine.state.phase}` as TranslationKey)}
          </Text>
          <Rule />
        </View>

        {reducedMotion ? (
          <BreathGauge
            progress={engine.state.phaseProgress}
            remainingSec={engine.state.phaseRemainingSec}
          />
        ) : (
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <BreathRing scale={engine.scale} accent={pattern.accent} size={ringSize} />
          </View>
        )}

        <View className="items-center gap-1">
          <Text variant="h2">{formatTime(engine.remainingSec)}</Text>
          <Text variant="caption">{t('breathe.cycle', { count: engine.state.cycleIndex + 1 })}</Text>
        </View>
      </View>

      <View className="gap-4 px-gutter pb-6">
        {!started ? (
          <View className="gap-3">
            <Text variant="overline">{t('breathe.duration')}</Text>
            <View className="flex-row gap-2">
              {BREATH_DURATIONS.map((minutes) => (
                <Chip
                  key={minutes}
                  label={t('common.minutes', { count: minutes })}
                  selected={durationMin === minutes}
                  onPress={() => setDurationMin(minutes)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {engine.finished ? (
          <Button label={t('breathe.again')} onPress={engine.reset} />
        ) : (
          <Button
            testID={TID.Button.BreatheStart}
            label={
              engine.running
                ? t('breathe.pause')
                : started
                  ? t('breathe.resume')
                  : t('breathe.start')
            }
            onPress={engine.running ? engine.pause : engine.start}
          />
        )}
      </View>
    </Screen>
  );
}
