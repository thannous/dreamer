import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import Animated, { useReducedMotion, type CSSStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EASE, PressableScale, Reveal } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { ThemeModeScope, useTheme } from '@/context/ThemeContext';
import { useSleepSoundPlayer } from '@/hooks/useSleepSoundPlayer';
import { useTranslation } from '@/hooks/useTranslation';
import { getSleepSoundCopy } from '@/lib/sleepSoundCopy';
import {
  DEFAULT_SLEEP_SOUND_ID,
  DEFAULT_SLEEP_TIMER_MINUTES,
  SLEEP_SOUNDS,
  SLEEP_SOUND_TIMER_OPTIONS,
  type SleepSoundId,
  type SleepTimerMinutes,
} from '@/lib/sleepSounds';
import {
  getSleepSoundPreferences,
  saveSleepSoundPreferences,
} from '@/services/sleepSoundPreferences';

import { SleepAmbienceScene } from './SleepAmbienceScene';
import { SLEEP_AMBIENCE_SCENES } from './sleepAmbienceScenes';
import { SleepTimerRing } from './SleepTimerRing';

/**
 * Selected state on this screen is carried by colour and a ring, so colour crosses over
 * rather than repainting. The options are 44pt+ already and sit apart, which is why every
 * one of them opts out of the default hit slop: overlapping slop in a radio group makes
 * the gap between two options ambiguous.
 */
const SELECTION_TRANSITION = ['backgroundColor', 'borderColor'] as const;

const PLAYER_SIZE = 92;
const BUTTON_SIZE = 68;

/**
 * The play button breathes while audio plays.
 *
 * Purpose: state indication. The sound itself is the kind of thing a user starts and
 * then stops trusting they actually started. A 4 s cycle is slower than anything else in
 * the app on purpose: this screen's job is to put someone to sleep.
 */
const BREATHING = {
  animationName: {
    from: { transform: [{ scale: 1 }], opacity: 0.35 },
    to: { transform: [{ scale: 1.18 }], opacity: 0 },
  },
  animationDuration: 4000,
  animationIterationCount: 'infinite',
  animationTimingFunction: 'ease-out',
} as const;

function formatRemainingTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function SleepSoundsContent() {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { currentLang, t } = useTranslation();
  const copy = useMemo(() => getSleepSoundCopy(currentLang), [currentLang]);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [soundId, setSoundId] = useState<SleepSoundId>(DEFAULT_SLEEP_SOUND_ID);
  const [durationMinutes, setDurationMinutes] = useState<SleepTimerMinutes>(
    DEFAULT_SLEEP_TIMER_MINUTES,
  );
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  const sound = useMemo(
    () => SLEEP_SOUNDS.find((candidate) => candidate.id === soundId) ?? SLEEP_SOUNDS[0],
    [soundId],
  );
  const soundCopy = copy.sounds[sound.id];
  const player = useSleepSoundPlayer({
    sound,
    durationMinutes,
    title: soundCopy.title,
    albumTitle: copy.screenTitle,
  });

  useEffect(() => {
    let mounted = true;
    void getSleepSoundPreferences().then((preferences) => {
      if (!mounted) return;
      setSoundId(preferences.soundId);
      setDurationMinutes(preferences.durationMinutes);
      setPreferencesLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const persistPreferences = useCallback(
    (nextSoundId: SleepSoundId, nextDuration: SleepTimerMinutes) => {
      void saveSleepSoundPreferences({
        soundId: nextSoundId,
        durationMinutes: nextDuration,
      });
    },
    [],
  );

  const handleSelectSound = useCallback(
    (nextSoundId: SleepSoundId) => {
      if (player.isPlaying || nextSoundId === soundId) return;
      void player.stop();
      setSoundId(nextSoundId);
      persistPreferences(nextSoundId, durationMinutes);
    },
    [durationMinutes, persistPreferences, player, soundId],
  );

  const handleSelectDuration = useCallback(
    (nextDuration: SleepTimerMinutes) => {
      if (player.isPlaying || nextDuration === durationMinutes) return;
      void player.stop();
      setDurationMinutes(nextDuration);
      persistPreferences(soundId, nextDuration);
    },
    [durationMinutes, persistPreferences, player, soundId],
  );

  const handleTogglePlayback = useCallback(() => {
    if (player.isPlaying) {
      player.pause();
      return;
    }
    void player.play();
  }, [player]);

  const downloadFailed = player.error === 'download_failed';
  const isPreparing =
    !preferencesLoaded ||
    (!downloadFailed && !player.hasStarted && (!player.isLoaded || player.isBuffering));
  const primaryLabel = isPreparing
    ? copy.loading
    : player.isPlaying
      ? copy.pause
      : player.hasStarted && player.remainingSeconds > 0
        ? copy.resume
        : copy.play;
  const progress = player.remainingSeconds / (durationMinutes * 60);

  // Once the sound plays, the choices step back and the night takes the screen.
  const choicesStyle = useMemo<CSSStyle<ViewStyle>>(() => ({
    opacity: player.isPlaying ? 0 : 1,
    transform: [{ translateY: player.isPlaying && !reducedMotion ? 8 : 0 }],
    transitionProperty: ['opacity', 'transform'],
    transitionDuration: 900,
    transitionTimingFunction: EASE.out,
  }), [player.isPlaying, reducedMotion]);
  const restingStyle = useMemo<CSSStyle<ViewStyle>>(() => ({
    opacity: player.isPlaying ? 1 : 0,
    transitionProperty: 'opacity',
    transitionDuration: 900,
    transitionDelay: player.isPlaying ? 500 : 0,
    transitionTimingFunction: EASE.out,
  }), [player.isPlaying]);

  return (
    <View
      style={[styles.container, { backgroundColor: noctalia.screen.background }]}
      testID="screen.sleepSounds"
    >
      <SleepAmbienceScene
        soundId={soundId}
        playing={player.isPlaying}
        ground={noctalia.screen.background}
      />

      <View style={[styles.header, { top: insets.top + ThemeLayout.spacing.md }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            { borderColor: noctalia.surface.border },
            pressed && styles.pressed,
          ]}
          testID="sleep-sounds-back"
          accessibilityRole="button"
          accessibilityLabel={t('journal.back_button')}
        >
          <IconSymbol name="chevron.left" size={21} color={noctalia.text.primary} />
        </Pressable>
        <View style={styles.kicker}>
          <View style={[styles.kickerRule, { backgroundColor: noctalia.accent.text }]} />
          <Text style={[styles.kickerText, { color: noctalia.text.secondary }]} accessibilityRole="header">
            {copy.screenTitle}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 96,
            paddingBottom: insets.bottom + ThemeLayout.spacing.lg,
          },
        ]}
      >
        <View style={styles.content}>
          <Reveal key={sound.id} distance={10} style={styles.story}>
            <Text style={[styles.eyebrow, { color: noctalia.accent.text }]}>
              {soundCopy.description}
            </Text>
            <Text style={[styles.title, { color: noctalia.text.primary }]}>
              {soundCopy.title}
            </Text>
            <Text style={[styles.storyText, { color: noctalia.text.secondary }]}>
              {soundCopy.story}
            </Text>
          </Reveal>

          <View>
            <Animated.View
              pointerEvents={player.isPlaying ? 'none' : 'auto'}
              accessibilityElementsHidden={player.isPlaying}
              importantForAccessibility={player.isPlaying ? 'no-hide-descendants' : 'auto'}
              style={[styles.choices, choicesStyle] as StyleProp<ViewStyle>}
            >
              <View accessibilityRole="radiogroup" accessibilityLabel={copy.chooseSound} style={styles.scenes}>
                <View style={[styles.sceneLine, { backgroundColor: noctalia.surface.border }]} />
                {SLEEP_SOUNDS.map((candidate) => {
                  const selected = candidate.id === soundId;
                  const scene = SLEEP_AMBIENCE_SCENES[candidate.id];
                  return (
                    <PressableScale
                      key={candidate.id}
                      onPress={() => handleSelectSound(candidate.id)}
                      disabled={player.isPlaying}
                      haptic={player.isPlaying ? 'none' : 'selection'}
                      hitSlop={0}
                      testID={`sleep-sound-${candidate.id}`}
                      accessibilityRole="radio"
                      accessibilityLabel={copy.sounds[candidate.id].title}
                      accessibilityState={{ checked: selected, disabled: player.isPlaying }}
                      style={styles.sceneOption}
                    >
                      <View
                        style={[
                          styles.sceneThumb,
                          {
                            borderColor: selected ? noctalia.action.primary : noctalia.surface.border,
                            backgroundColor: noctalia.surface.soft,
                          },
                        ]}
                      >
                        <Image
                          source={scene.source}
                          contentFit="cover"
                          contentPosition={scene.thumbnailPosition}
                          cachePolicy="memory"
                          accessible={false}
                          style={styles.sceneImage}
                        />
                      </View>
                      <Text
                        numberOfLines={2}
                        style={[
                          styles.sceneLabel,
                          { color: selected ? noctalia.accent.text : noctalia.text.secondary },
                        ]}
                      >
                        {copy.sounds[candidate.id].title}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>

              <View style={styles.durations}>
                <Text style={[styles.groupLabel, { color: noctalia.text.tertiary }]}>
                  {copy.chooseDuration}
                </Text>
                <View accessibilityRole="radiogroup" accessibilityLabel={copy.chooseDuration} style={styles.durationRow}>
                  {SLEEP_SOUND_TIMER_OPTIONS.map((minutes) => {
                    const selected = durationMinutes === minutes;
                    return (
                      <PressableScale
                        key={minutes}
                        onPress={() => handleSelectDuration(minutes)}
                        disabled={player.isPlaying}
                        haptic={player.isPlaying ? 'none' : 'selection'}
                        hitSlop={0}
                        transitionProperties={SELECTION_TRANSITION}
                        testID={`sleep-duration-${minutes}`}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected, disabled: player.isPlaying }}
                        style={[
                          styles.durationOption,
                          {
                            // Declared on both branches so the transition has a value to
                            // cross from; `undefined` would make it snap.
                            backgroundColor: selected ? noctalia.surface.active : 'transparent',
                            borderColor: selected ? noctalia.action.primary : noctalia.surface.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.durationText,
                            { color: selected ? noctalia.accent.text : noctalia.text.secondary },
                          ]}
                        >
                          {minutes} {copy.minutes}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </View>
            </Animated.View>

            <Animated.View
              pointerEvents="none"
              style={[styles.resting, restingStyle] as StyleProp<ViewStyle>}
            >
              {player.isPlaying ? (
                <Text style={[styles.restingText, { color: noctalia.text.secondary }]}>
                  {copy.backgroundHint}
                </Text>
              ) : null}
            </Animated.View>
          </View>

          <View style={styles.player}>
            <View style={styles.playerControl}>
              {player.isPlaying && !reducedMotion ? (
                <Animated.View
                  style={[
                    styles.halo,
                    { borderColor: noctalia.action.primary },
                    BREATHING,
                  ] as StyleProp<ViewStyle>}
                />
              ) : null}
              <SleepTimerRing
                size={PLAYER_SIZE}
                progress={progress}
                track={noctalia.surface.border}
                fill={noctalia.action.primary}
              />
              <PressableScale
                onPress={handleTogglePlayback}
                disabled={isPreparing}
                // Starting or stopping the sound is a commit, and on this screen it is
                // the one action whose result the user may not hear for a second.
                haptic={isPreparing ? 'none' : 'light'}
                hitSlop={0}
                transitionProperties={SELECTION_TRANSITION}
                testID="sleep-playback-toggle"
                accessibilityRole="button"
                accessibilityLabel={primaryLabel}
                style={[
                  styles.playButton,
                  {
                    backgroundColor: isPreparing ? noctalia.action.disabled : noctalia.action.primary,
                    borderColor: isPreparing ? noctalia.action.disabledBorder : noctalia.action.primaryBorder,
                  },
                ]}
              >
                <IconSymbol
                  name={player.isPlaying ? 'pause.fill' : 'play.fill'}
                  size={26}
                  color={isPreparing ? noctalia.action.disabledText : noctalia.action.primaryText}
                />
              </PressableScale>
            </View>
            <View style={styles.playerCopy}>
              <Text
                testID="sleep-remaining-time"
                style={[styles.remainingTime, { color: noctalia.text.primary }]}
              >
                {formatRemainingTime(player.remainingSeconds)}
              </Text>
              <Text style={[styles.playerLabel, { color: noctalia.text.secondary }]}>
                {primaryLabel}
              </Text>
            </View>
          </View>

          {player.error ? (
            <Text style={[styles.errorText, { color: noctalia.status.danger.text }]}>
              {downloadFailed ? copy.downloadError : copy.error}
            </Text>
          ) : (
            <Text style={[styles.hintText, { color: noctalia.text.tertiary }]}>
              {copy.volumeHint}
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/** The sleep screen is always a night scene, whatever the app's theme. */
export function SleepSoundsScreen() {
  return (
    <ThemeModeScope mode="dark">
      {/* The root bars follow the app's theme; over this night scene they stay light. */}
      <SystemBars style="light" />
      <SleepSoundsContent />
    </ThemeModeScope>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'flex-end' },
  header: {
    position: 'absolute',
    left: ThemeLayout.spacing.lg20,
    right: ThemeLayout.spacing.lg20,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(3, 4, 13, 0.35)',
  },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  kickerRule: { width: 22, height: 1 },
  kickerText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: 24,
    gap: 26,
  },
  story: { gap: 10 },
  eyebrow: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.fraunces.regular,
    fontSize: 50,
    lineHeight: 56,
    letterSpacing: -0.5,
  },
  storyText: {
    fontFamily: Fonts.lora.regularItalic,
    fontSize: 17,
    lineHeight: 26,
    maxWidth: 440,
  },
  choices: { gap: 22 },
  scenes: { flexDirection: 'row', justifyContent: 'space-between' },
  // Links the three places, like the steps of a path.
  sceneLine: { position: 'absolute', top: 31, left: '16%', right: '16%', height: 1 },
  sceneOption: { flex: 1, alignItems: 'center', gap: 8, minHeight: 44 },
  sceneThumb: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    padding: 3,
    overflow: 'hidden',
  },
  sceneImage: { flex: 1, borderRadius: 26 },
  sceneLabel: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  durations: { gap: 10 },
  groupLabel: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  durationRow: { flexDirection: 'row', gap: 10 },
  durationOption: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  resting: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
  },
  restingText: {
    fontFamily: Fonts.lora.regularItalic,
    fontSize: 16,
    lineHeight: 24,
  },
  player: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  playerControl: {
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    borderRadius: PLAYER_SIZE / 2,
    borderWidth: 1,
  },
  playButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerCopy: { flex: 1, gap: 2 },
  remainingTime: {
    fontFamily: Fonts.fraunces.regular,
    fontSize: 40,
    lineHeight: 46,
    fontVariant: ['tabular-nums'],
  },
  playerLabel: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
    lineHeight: 19,
  },
  errorText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  hintText: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  pressed: { opacity: 0.76 },
});
