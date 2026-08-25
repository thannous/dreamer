import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, useWindowDimensions, View } from 'react-native';

import { TrainerControls } from '@/components/trainer/TrainerControls';
import { TrainerFocus } from '@/components/trainer/TrainerFocus';
import { PracticeProgress } from '@/components/journey/PracticeProgress';
import { BackLink, Text } from '@/components/ui';
import { WorldScene } from '@/components/worlds/WorldScene';
import {
  BREATH_DURATIONS,
  isBreathingPatternId,
  PATTERN_BY_ID,
  type BreathPhaseType,
  type BreathDurationMinutes,
} from '@/content/breathing';
import { useTranslation } from '@/context/LanguageContext';
import { TID } from '@/lib/testIDs';
import { useLibrary } from '@/context/LibraryContext';
import { usePlayer } from '@/context/PlayerContext';
import { useWorld } from '@/context/WorldContext';
import { cycleDurationMs, useBreathEngine } from '@/hooks/useBreathEngine';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useScreenReader } from '@/hooks/useScreenReader';
import { useWorldSoundscape } from '@/hooks/useWorldSoundscape';
import { formatTime } from '@/lib/audio';
import type { TranslationKey } from '@/lib/i18n';

const TRAINER_PHASES = ['inhale', 'hold', 'exhale'] as const;

function hasTrainerCopy(
  phase: BreathPhaseType
): phase is (typeof TRAINER_PHASES)[number] {
  return (TRAINER_PHASES as readonly BreathPhaseType[]).includes(phase);
}

export default function BreatheExercise() {
  const { pattern: patternParam } = useLocalSearchParams<{ pattern: string }>();
  const { t } = useTranslation();
  const { width, height, fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const screenReader = useScreenReader();
  const { recordPractice } = useLibrary();
  const player = usePlayer();
  const { world } = useWorld();

  const valid = patternParam && isBreathingPatternId(patternParam);
  const pattern = valid ? PATTERN_BY_ID[patternParam] : PATTERN_BY_ID.calm;

  const [durationMin, setDurationMin] = useState<BreathDurationMinutes>(
    pattern.defaultDurationMin
  );

  const engine = useBreathEngine({ pattern, durationMin });
  const soundscape = useWorldSoundscape(
    world.id,
    engine.running && !engine.finished
  );

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
      <WorldScene world={world} artwork="trainer" scrimStrength={1.1}>
        <View className="flex-1">
          <BackLink
            testID={TID.Button.BreatheClose}
            label={t('player.close')}
            fallbackHref="/(drawer)/(tabs)"
            className="px-gutter pt-2"
          />
          <View className="flex-1 items-center justify-center px-gutter">
            <Text variant="h3">{t('search.empty.title')}</Text>
          </View>
        </View>
      </WorldScene>
    );
  }

  const started = engine.running || engine.remainingSec < durationMin * 60;
  const compact = fontScale >= 1.5 || height < 720;
  const ringSize = Math.min(
    width * 0.68,
    height * (compact ? 0.18 : started ? 0.31 : 0.25),
    compact ? 200 : 300
  );
  const cycleTotal = Math.max(
    1,
    Math.ceil((durationMin * 60 * 1000) / cycleDurationMs(pattern))
  );
  const cycleCurrent = engine.finished
    ? cycleTotal
    : Math.min(cycleTotal, engine.state.cycleIndex + 1);
  const cycleLabel = t('trainer.cycles', {
    current: cycleCurrent,
    total: cycleTotal,
  });
  const nextPhase = pattern.phases[(engine.state.phaseIndex + 1) % pattern.phases.length].type;
  const phaseLabel = engine.finished
    ? t('breathe.complete.title')
    : t(`breathe.phase.${engine.state.phase}` as TranslationKey);
  const translatedCue =
    started && !engine.finished && hasTrainerCopy(engine.state.phase)
      ? t(`trainer.cue.${engine.state.phase}` as TranslationKey)
      : null;
  // Several locales intentionally use the same terse word for the instruction
  // and its cue. Repeating it under itself adds noise, so only show the cue
  // when the translation contributes something new.
  const worldRitual = t(`world.${world.id}.ritual` as TranslationKey);
  const phaseCue = !started
    ? worldRitual
    : translatedCue === phaseLabel
      ? null
      : translatedCue;
  const nextLabel =
    started && !engine.finished && hasTrainerCopy(nextPhase)
      ? t(`trainer.next.${nextPhase}` as TranslationKey)
      : null;
  const durationOptions = BREATH_DURATIONS.map((minutes) => ({
    value: minutes,
    label: t('common.minutes', { count: minutes }),
  }));
  const actionLabel = engine.finished
    ? t('breathe.again')
    : engine.running
      ? t('breathe.pause')
      : started
        ? t('breathe.resume')
        : t('breathe.start');
  const handleAction = () => {
    if (engine.finished) {
      engine.reset();
      return;
    }
    if (engine.running) {
      engine.pause();
      return;
    }

    // A trainer owns the soundscape while it runs. Preserve the other
    // session's position in the mini-player, but never mix both experiences.
    if (player.status === 'playing') player.toggle();
    engine.start();
  };

  return (
    <WorldScene world={world} artwork="trainer" scrimStrength={1.1} breathMotion={false}>
      <View className="flex-1">
        <BackLink
          testID={TID.Button.BreatheClose}
          label={t('player.close')}
          fallbackHref="/(drawer)/(tabs)"
          className="px-gutter pt-2"
        />

        <View testID={TID.Screen.BreatheExercise} className="flex-1 px-gutter">
          <PracticeProgress world={world} stage="practice" className="pt-1" />
          {!compact ? (
            <View className="items-center gap-1 pt-1">
              <Text variant="overline">
                {t(`breathe.pattern.${pattern.id}.name` as TranslationKey)}
              </Text>
            </View>
          ) : null}

          <TrainerFocus
            accent={pattern.accent}
            compact={compact}
            cycleCurrent={cycleCurrent}
            cycleLabel={cycleLabel}
            cycleTotal={cycleTotal}
            finished={engine.finished}
            nextLabel={nextLabel}
            phaseCue={phaseCue}
            phaseLabel={phaseLabel}
            phaseProgress={engine.state.phaseProgress}
            phaseRemainingSec={engine.state.phaseRemainingSec}
            phaseTestID={TID.Text.BreathePhase}
            reducedMotion={reducedMotion}
            remainingLabel={formatTime(engine.remainingSec)}
            ringSize={ringSize}
            scale={engine.scale}
            worldMotion={world.motion}
          />
        </View>

        <TrainerControls
          actionLabel={actionLabel}
          appearance={world.appearance}
          compact={compact}
          durationLabel={t('breathe.duration')}
          durationMin={durationMin}
          durations={durationOptions}
          showDurations={!started}
          soundEnabled={soundscape.soundEnabled}
          soundLabel={t('trainer.sound')}
          soundTestID={TID.Button.BreatheSound}
          testID={TID.Button.BreatheStart}
          onAction={handleAction}
          onDurationChange={setDurationMin}
          onToggleSound={soundscape.toggleSound}
        />
      </View>
    </WorldScene>
  );
}
