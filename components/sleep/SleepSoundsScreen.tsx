import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { GlassCard } from '@/components/inspiration/GlassCard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { ScrollPerfProvider } from '@/context/ScrollPerfContext';
import { useTheme } from '@/context/ThemeContext';
import { useScrollIdle } from '@/hooks/useScrollIdle';
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

function formatRemainingTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function SleepSoundsScreen() {
  const { colors, mode, shadows } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { currentLang, t } = useTranslation();
  const copy = useMemo(() => getSleepSoundCopy(currentLang), [currentLang]);
  const insets = useSafeAreaInsets();
  const scrollPerf = useScrollIdle();
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

  const backButtonTop = insets.top + ThemeLayout.spacing.sm;
  const contentPaddingTop = backButtonTop + 44 + ThemeLayout.spacing.md;
  const isPreparing =
    !preferencesLoaded ||
    (!player.hasStarted && (!player.isLoaded || player.isBuffering));
  const primaryLabel = isPreparing
    ? copy.loading
    : player.isPlaying
      ? copy.pause
      : player.hasStarted && player.remainingSeconds > 0
        ? copy.resume
        : copy.play;

  return (
    <ScrollPerfProvider isScrolling={scrollPerf.isScrolling}>
      <View style={[styles.container, { backgroundColor: noctalia.screen.background }]}>
        <AtmosphericBackground />

        <Pressable
          onPress={() => router.back()}
          style={[
            styles.floatingBackButton,
            { top: backButtonTop, backgroundColor: noctalia.surface.raised },
            shadows.lg,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('journal.back_button')}
        >
          <IconSymbol name="chevron.left" size={22} color={noctalia.accent.base} />
        </Pressable>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{
            paddingBottom: insets.bottom + ThemeLayout.spacing.xl,
            paddingTop: contentPaddingTop,
          }}
          onScrollBeginDrag={scrollPerf.onScrollBeginDrag}
          onScrollEndDrag={scrollPerf.onScrollEndDrag}
          onMomentumScrollBegin={scrollPerf.onMomentumScrollBegin}
          onMomentumScrollEnd={scrollPerf.onMomentumScrollEnd}
        >
          <View style={styles.content}>
            <View style={styles.titleSection}>
              <View style={[styles.heroIcon, { backgroundColor: noctalia.surface.soft }]}>
                <IconSymbol
                  name="speaker.wave.2.fill"
                  size={30}
                  color={noctalia.accent.base}
                />
              </View>
              <Text style={[styles.title, { color: noctalia.text.primary }]}>
                {copy.screenTitle}
              </Text>
              <Text style={[styles.subtitle, { color: noctalia.text.secondary }]}>
                {copy.screenSubtitle}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: noctalia.text.primary }]}>
                {copy.chooseSound}
              </Text>
              <View style={styles.soundList}>
                {SLEEP_SOUNDS.map((candidate) => {
                  const selected = candidate.id === soundId;
                  const candidateCopy = copy.sounds[candidate.id];
                  return (
                    <Pressable
                      key={candidate.id}
                      onPress={() => handleSelectSound(candidate.id)}
                      disabled={player.isPlaying}
                      testID={`sleep-sound-${candidate.id}`}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected, disabled: player.isPlaying }}
                      style={({ pressed }) => [
                        styles.soundCard,
                        {
                          backgroundColor: selected
                            ? noctalia.surface.active
                            : noctalia.surface.raised,
                          borderColor: selected
                            ? noctalia.accent.base
                            : noctalia.surface.border,
                          opacity: pressed ? 0.82 : 1,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.soundIcon,
                          { backgroundColor: noctalia.surface.soft },
                        ]}
                      >
                        <IconSymbol
                          name={candidate.icon}
                          size={24}
                          color={selected ? noctalia.accent.base : noctalia.text.secondary}
                        />
                      </View>
                      <View style={styles.soundCopy}>
                        <Text style={[styles.soundTitle, { color: noctalia.text.primary }]}>
                          {candidateCopy.title}
                        </Text>
                        <Text
                          style={[styles.soundDescription, { color: noctalia.text.secondary }]}
                        >
                          {candidateCopy.description}
                        </Text>
                      </View>
                      {selected ? (
                        <IconSymbol
                          name="checkmark.circle.fill"
                          size={22}
                          color={noctalia.accent.base}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: noctalia.text.primary }]}>
                {copy.chooseDuration}
              </Text>
              <View
                style={[
                  styles.timerGroup,
                  { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border },
                ]}
              >
                {SLEEP_SOUND_TIMER_OPTIONS.map((minutes) => {
                  const selected = durationMinutes === minutes;
                  return (
                    <Pressable
                      key={minutes}
                      onPress={() => handleSelectDuration(minutes)}
                      disabled={player.isPlaying}
                      testID={`sleep-duration-${minutes}`}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected, disabled: player.isPlaying }}
                      style={[
                        styles.timerOption,
                        selected && { backgroundColor: noctalia.accent.base },
                      ]}
                    >
                      <Text
                        style={[
                          styles.timerText,
                          {
                            color: selected
                              ? noctalia.text.onAccent
                              : noctalia.text.secondary,
                          },
                        ]}
                      >
                        {minutes} {copy.minutes}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <GlassCard intensity="strong" style={styles.playerCard}>
              <Text style={[styles.nowPlayingLabel, { color: noctalia.text.secondary }]}>
                {soundCopy.title}
              </Text>
              <Text
                testID="sleep-remaining-time"
                style={[styles.remainingTime, { color: noctalia.text.primary }]}
              >
                {formatRemainingTime(player.remainingSeconds)}
              </Text>
              <Pressable
                onPress={handleTogglePlayback}
                disabled={isPreparing}
                testID="sleep-playback-toggle"
                accessibilityRole="button"
                accessibilityLabel={primaryLabel}
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: isPreparing
                      ? noctalia.action.disabled
                      : noctalia.action.primary,
                    borderColor: isPreparing
                      ? noctalia.action.disabledBorder
                      : noctalia.action.primaryBorder,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                {!isPreparing ? (
                  <IconSymbol
                    name={player.isPlaying ? 'pause.fill' : 'play.fill'}
                    size={22}
                    color={noctalia.action.primaryText}
                  />
                ) : null}
                <Text
                  style={[
                    styles.primaryButtonText,
                    {
                      color: isPreparing
                        ? noctalia.action.disabledText
                        : noctalia.action.primaryText,
                    },
                  ]}
                >
                  {primaryLabel}
                </Text>
              </Pressable>

              {player.error ? (
                <Text style={[styles.errorText, { color: noctalia.status.danger.text }]}>
                  {copy.error}
                </Text>
              ) : null}
            </GlassCard>

            <View style={styles.hints}>
              <Text style={[styles.hintText, { color: noctalia.text.secondary }]}>
                {copy.volumeHint}
              </Text>
              <Text style={[styles.hintText, { color: noctalia.text.tertiary }]}>
                {copy.backgroundHint}
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </ScrollPerfProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  floatingBackButton: {
    position: 'absolute',
    left: 20,
    zIndex: 50,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    gap: 26,
  },
  titleSection: {
    alignItems: 'center',
    gap: 10,
  },
  heroIcon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.fraunces.bold,
    fontSize: 30,
    lineHeight: 36,
    textAlign: 'center',
  },
  subtitle: {
    maxWidth: 420,
    paddingHorizontal: 12,
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  section: { gap: 12 },
  sectionTitle: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  soundList: { gap: 10 },
  soundCard: {
    minHeight: 78,
    padding: 14,
    borderWidth: 1,
    borderRadius: 20,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  soundIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundCopy: { flex: 1, gap: 3 },
  soundTitle: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  soundDescription: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  timerGroup: {
    padding: 5,
    borderWidth: 1,
    borderRadius: 18,
    borderCurve: 'continuous',
    flexDirection: 'row',
    gap: 5,
  },
  timerOption: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  playerCard: {
    padding: 24,
    borderRadius: 26,
    alignItems: 'center',
    gap: 14,
  },
  nowPlayingLabel: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
    lineHeight: 19,
  },
  remainingTime: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 42,
    lineHeight: 48,
    fontVariant: ['tabular-nums'],
  },
  primaryButton: {
    width: '100%',
    minHeight: 54,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderRadius: 18,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  primaryButtonText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 15,
  },
  errorText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  hints: {
    paddingHorizontal: 12,
    gap: 7,
  },
  hintText: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
