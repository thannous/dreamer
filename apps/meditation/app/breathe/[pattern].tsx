import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, useWindowDimensions, View } from 'react-native';

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
import { speakBreathPhase, stopBreathVoice } from '@/lib/breathGuidance';
import type { TranslationKey } from '@/lib/i18n';

const TRAINER_PHASES = ['inhale', 'hold', 'exhale'] as const;

function hasTrainerCopy(
  phase: BreathPhaseType
): phase is (typeof TRAINER_PHASES)[number] {
  return (TRAINER_PHASES as readonly BreathPhaseType[]).includes(phase);
}

export default function BreatheExercise() {
  const { pattern: patternParam } = useLocalSearchParams<{ pattern: string }>();
  const { language, t } = useTranslation();
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
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [hapticEnabled, setHapticEnabled] = useState(true);

  const engine = useBreathEngine({
    pattern,
    durationMin,
    hapticsEnabled: hapticEnabled,
  });
  const soundscape = useWorldSoundscape(
    world.id,
    engine.running && !engine.finished
  );

  /**
   * Speak each phase change once, by one channel only.
   *
   * TalkBack owns the announcement when it is running. Optional TTS is for
   * eyes-closed practice without a screen reader, never both at once.
   */
  const announcedPhaseRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (engine.status !== 'active') {
      announcedPhaseRef.current = null;
      void stopBreathVoice();
      return;
    }

    const phrase = t(`breathe.phase.${engine.state.phase}` as TranslationKey);
    if (screenReader) {
      const phaseKey = `talkback:${engine.state.cycleIndex}:${engine.state.phase}`;
      if (announcedPhaseRef.current !== phaseKey) {
        announcedPhaseRef.current = phaseKey;
        void stopBreathVoice();
        AccessibilityInfo.announceForAccessibility(phrase);
      }
      return () => {
        cancelled = true;
      };
    }

    if (!voiceEnabled) {
      void stopBreathVoice();
      announcedPhaseRef.current = null;
      return;
    }

    const phaseKey = `voice:${engine.state.cycleIndex}:${engine.state.phase}`;
    if (announcedPhaseRef.current === phaseKey) return;
    announcedPhaseRef.current = phaseKey;
    void speakBreathPhase(phrase, language).then(() => {
      if (cancelled) void stopBreathVoice();
    });
    return () => {
      cancelled = true;
      void stopBreathVoice();
    };
  }, [
    engine.status,
    engine.state.cycleIndex,
    engine.state.phase,
    language,
    screenReader,
    t,
    voiceEnabled,
  ]);

  useEffect(() => () => {
    void stopBreathVoice();
  }, []);

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

  const started = engine.started;
  const paused = engine.status === 'paused';
  const live = engine.status === 'active';
  // Compact reflow only. Never clamp the user's type size: 160% and 200% must
  // still render the full labels, countdown and CTA.
  const compact = fontScale >= 1.5 || height < 720;
  const ringSize = Math.min(
    width * 0.68,
    height * (compact ? 0.12 : started ? 0.31 : 0.25),
    compact ? 128 : 300
  );
  const cycleTotal = Math.max(
    1,
    Math.ceil((durationMin * 60 * 1000) / cycleDurationMs(pattern))
  );
  const cycleCurrent = engine.status === 'ready' || paused
    ? 0
    : engine.finished
      ? cycleTotal
      : Math.min(cycleTotal, engine.state.cycleIndex + 1);
  const cycleLabel = t('trainer.cycles', {
    current: Math.max(1, cycleCurrent),
    total: cycleTotal,
  });
  const nextPhase = pattern.phases[(engine.state.phaseIndex + 1) % pattern.phases.length].type;
  const phaseLabel = engine.status === 'ready'
    ? t('breathe.ready')
    : engine.finished
      ? t('breathe.complete.title')
      : paused
        ? t('breathe.paused')
        : t(`breathe.phase.${engine.state.phase}` as TranslationKey);
  const translatedCue =
    live && hasTrainerCopy(engine.state.phase)
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
    live && hasTrainerCopy(nextPhase)
      ? t(`trainer.next.${nextPhase}` as TranslationKey)
      : null;
  const durationOptions = BREATH_DURATIONS.map((minutes) => ({
    value: minutes,
    label: t('common.minutes', { count: minutes }),
  }));
  const actionLabel = engine.status === 'finished'
    ? t('breathe.again')
    : engine.status === 'active'
      ? t('breathe.pause')
      : engine.status === 'paused'
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

  const focus = (
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
      phaseProgress={live ? engine.state.phaseProgress : 0}
      phaseRemainingSec={live ? engine.state.phaseRemainingSec : 0}
      phaseTestID={TID.Text.BreathePhase}
      ready={!live && !engine.finished}
      reducedMotion={reducedMotion}
      remainingLabel={formatTime(engine.remainingSec)}
      ringSize={ringSize}
      scale={engine.scale}
      worldMotion={world.motion}
    />
  );
  const controls = (
    <TrainerControls
      actionLabel={actionLabel}
      appearance={world.appearance}
      compact={compact}
      durationLabel={t('breathe.duration')}
      durationMin={durationMin}
      durations={durationOptions}
      showDurations={engine.status === 'ready'}
      soundEnabled={soundscape.soundEnabled}
      soundLabel={soundscape.soundEnabled ? t('trainer.sound.on') : t('trainer.sound.off')}
      soundName={t('trainer.sound')}
      soundTestID={TID.Button.BreatheSound}
      voiceEnabled={voiceEnabled}
      voiceLabel={voiceEnabled ? t('trainer.voice.on') : t('trainer.voice.off')}
      voiceName={t('trainer.voice')}
      voiceTestID="btn.breathe.voice"
      onToggleVoice={() => setVoiceEnabled((value) => !value)}
      hapticEnabled={hapticEnabled}
      hapticLabel={hapticEnabled ? t('trainer.haptic.on') : t('trainer.haptic.off')}
      hapticName={t('trainer.haptic')}
      hapticTestID="btn.breathe.haptic"
      onToggleHaptic={() => setHapticEnabled((value) => !value)}
      testID={TID.Button.BreatheStart}
      onAction={handleAction}
      onDurationChange={setDurationMin}
      onToggleSound={soundscape.toggleSound}
    />
  );

  return (
    <WorldScene world={world} artwork="trainer" scrimStrength={1.1} breathMotion={false}>
      <View className="flex-1 overflow-hidden">
        <BackLink
          testID={TID.Button.BreatheClose}
          label={t('player.close')}
          fallbackHref="/(drawer)/(tabs)"
          className="px-gutter pt-2"
        />

        {compact ? (
          <ScrollView
            testID={TID.Screen.BreatheExercise}
            className="min-h-0 flex-1"
            contentContainerClassName="grow justify-between gap-3 pb-2"
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled">
            <View className="px-gutter">{focus}</View>
            {controls}
          </ScrollView>
        ) : (
          <>
            <View testID={TID.Screen.BreatheExercise} className="min-h-0 flex-1 px-gutter">
              <PracticeProgress world={world} stage="practice" className="pt-1" />
              <View className="items-center gap-1 pt-1">
                <Text variant="overline">
                  {t(`breathe.pattern.${pattern.id}.name` as TranslationKey)}
                </Text>
              </View>
              {focus}
            </View>
            {controls}
          </>
        )}
      </View>
    </WorldScene>
  );
}
