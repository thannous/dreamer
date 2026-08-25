import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui';
import {
  Breath,
  BreathScale,
  Curve,
  Duration,
  PressOpacity,
  PressScale,
} from '@/constants/motion';
import { useBreath } from '@/context/BreathContext';
import { useTranslation } from '@/context/LanguageContext';
import { TID } from '@/lib/testIDs';
import * as audio from '@/services/audioService';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const HALO_ASSET = require('@/assets/onboarding/breath-halo-v2.png');
const BREATH_CUE = require('@/assets/audio/ui/first-breath.m4a');
const styles = StyleSheet.create({
  fill: { position: 'absolute', inset: 0 },
  image: { width: '100%', height: '100%' },
});

/**
 * A first, optional encounter with the app-wide breath.
 *
 * The halo rests until the launch action, then reads exactly one 11-second
 * cycle from BreathProvider. Press feedback stays on the UI thread, and the
 * preview never creates a second competing breath loop or visual pulse.
 */
type Props = {
  soundEnabled?: boolean;
};

type DemoPhase = 'idle' | 'inhale' | 'exhale' | 'complete';

export function InteractiveBreathHalo({ soundEnabled = true }: Props) {
  const { t } = useTranslation();
  const { progress, isStill, holdAtExhale, playOneCycle, resumeAmbient } = useBreath();
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();
  const haloSize = Math.min(width - 40, 390);
  const [engaged, setEngaged] = useState(false);
  const [phase, setPhase] = useState<DemoPhase>('idle');
  const pressed = useSharedValue(0);
  const cuePlayerRef = useRef<audio.PlayerHandle | null>(null);
  const engagedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopCue = useCallback(() => {
    const cuePlayer = cuePlayerRef.current;
    if (!cuePlayer) return;
    audio.pause(cuePlayer);
    audio.seekTo(cuePlayer, 0).catch(() => {});
  }, []);

  const stopTransientFeedback = useCallback(() => {
    stopCue();
    setEngaged(false);
    setPhase('idle');
    if (engagedTimerRef.current) {
      clearTimeout(engagedTimerRef.current);
      engagedTimerRef.current = null;
    }
    if (phaseTimerRef.current) {
      clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
    cancelAnimation(pressed);
    pressed.set(0);
  }, [pressed, stopCue]);

  useEffect(() => {
    if (!isFocused) return;

    // This screen is a demo, not ambient decoration: every focus starts at
    // rest, then plays exactly one shared cycle after the person's touch.
    holdAtExhale();

    // A pushed route keeps this screen mounted. Focus cleanup, rather than
    // unmount cleanup, is therefore where every transient effect must stop.
    return () => {
      stopTransientFeedback();
      resumeAmbient();
    };
  }, [holdAtExhale, isFocused, resumeAmbient, stopTransientFeedback]);

  useEffect(() => {
    audio.configureLocalCueSession().catch(() => {
      // Playback can still work with the platform's default audio mode.
    });

    try {
      const player = audio.createLocalCuePlayer(BREATH_CUE);
      audio.setVolume(player, 0.9);
      cuePlayerRef.current = player;
    } catch {
      // Audio feedback is additive; the visual and haptic remain functional.
    }

    return () => {
      if (engagedTimerRef.current) clearTimeout(engagedTimerRef.current);
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      if (!cuePlayerRef.current) return;
      audio.release(cuePlayerRef.current);
      cuePlayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (soundEnabled || !cuePlayerRef.current) return;
    stopCue();
  }, [soundEnabled, stopCue]);

  const haloStyle = useAnimatedStyle(() => {
    const breathScale = isStill
      ? 1
      : interpolate(
          progress.get(),
          [0, 1],
          [BreathScale.introHalo.exhaled, BreathScale.introHalo.inhaled]
        );

    return {
      opacity: isStill ? 0.92 : interpolate(progress.get(), [0, 1], [0.76, 1]),
      transform: [{ scale: breathScale }],
    };
  }, [isStill]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressed.get(), [0, 1], [1, PressOpacity.card]),
    transform: [{ scale: interpolate(pressed.get(), [0, 1], [1, PressScale.card]) }],
  }));

  const activate = () => {
    const cuePlayer = cuePlayerRef.current;
    if (soundEnabled && cuePlayer) {
      audio.pause(cuePlayer);
      audio
        .seekTo(cuePlayer, 0)
        .then(() => audio.play(cuePlayer))
        .catch(() => audio.play(cuePlayer));
    }

    const haptic =
      Platform.OS === 'android'
        ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    haptic.catch(() => {});

    if (engagedTimerRef.current) clearTimeout(engagedTimerRef.current);
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    playOneCycle();
    setEngaged(true);
    setPhase('inhale');
    phaseTimerRef.current = setTimeout(() => {
      setPhase('exhale');
      phaseTimerRef.current = null;
    }, Breath.inhaleMs);
    engagedTimerRef.current = setTimeout(() => {
      setEngaged(false);
      setPhase('complete');
      engagedTimerRef.current = null;
    }, Breath.cycleMs);
  };

  return (
    <View
      className="items-center justify-center self-center"
      style={{ width: haloSize, height: haloSize, flexShrink: 0 }}>
      <Animated.View pointerEvents="none" style={[styles.fill, haloStyle]}>
        <Image accessible={false} source={HALO_ASSET} contentFit="contain" style={styles.image} />
      </Animated.View>
      <AnimatedPressable
        testID={TID.Button.BreathIntroHalo}
        accessibilityRole="button"
        accessibilityLabel={t(
          engaged
            ? phase === 'exhale'
              ? 'trainer.cue.exhale'
              : 'trainer.cue.inhale'
            : phase === 'complete'
              ? 'onboarding.breathIntro.completionTitle'
              : 'onboarding.breathIntro.action'
        )}
        accessibilityHint={t('onboarding.breathIntro.subtitle')}
        accessibilityState={{ selected: engaged, disabled: engaged }}
        disabled={engaged}
        onPress={activate}
        onPressIn={() =>
          pressed.set(withTiming(1, { duration: Duration.instant, easing: Curve.standard }))
        }
        onPressOut={() =>
          pressed.set(withTiming(0, { duration: Duration.fast, easing: Curve.standard }))
        }
        hitSlop={12}
        style={[styles.fill, contentStyle]}
        className="items-center justify-center">
        {engaged ? (
          <Text variant="h1" tone="accent" className="text-center">
            {t(phase === 'exhale' ? 'trainer.cue.exhale' : 'trainer.cue.inhale')}
          </Text>
        ) : phase === 'complete' ? (
          <View className="items-center justify-center gap-2 px-8">
            <Text variant="h1" tone="accent" className="text-center">
              {t('onboarding.breathIntro.completionTitle')}
            </Text>
            <Text variant="bodySm" className="text-center">
              {t('onboarding.breathIntro.completionSubtitle')}
            </Text>
          </View>
        ) : (
          <View className="items-center justify-center gap-2 px-8">
            <Text variant="h1" tone="accent" className="text-center">
              {t('onboarding.breathIntro.prompt')}
            </Text>
            <Text variant="bodySm" className="text-center">
              {t('onboarding.breathIntro.action')}
            </Text>
          </View>
        )}
      </AnimatedPressable>
    </View>
  );
}
