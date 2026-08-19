import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { GlassCard } from '@/components/inspiration/GlassCard';
import { DURATION, EASE, ProgressFill, SPRING } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { ScrollPerfProvider } from '@/context/ScrollPerfContext';
import { useTheme } from '@/context/ThemeContext';
import { useScrollIdle } from '@/hooks/useScrollIdle';
import { useTranslation } from '@/hooks/useTranslation';
import {
  RITUALS,
  type RitualId,
} from '@/lib/inspirationRituals';
import { getSleepSoundCopy } from '@/lib/sleepSoundCopy';
import { isSleepSoundsAvailable } from '@/lib/sleepSoundsFeature';
import {
  getLocalDateKey,
} from '@/lib/ritualProgressUtils';
import {
  getRitualStepProgress,
  saveRitualPreference,
  saveRitualStepProgress,
} from '@/services/storageService';

type IconName = Parameters<typeof IconSymbol>[0]['name'];

/**
 * The checkbox of a ritual step.
 *
 * Purpose: feedback. The tick is the whole reward for doing the step, and a box that
 * simply appears filled reads as a repaint rather than as something the user just did.
 *
 * The dot settles with a spring because a finger caused it — the small overshoot is the
 * difference between "the state changed" and "you did that". The box's own colours cross
 * over as a CSS transition on the UI thread, so the whole row costs one React render per
 * tap and none per frame. Under "reduce motion" both land immediately; the tick is still
 * there, it just does not travel.
 */
function RitualStepCheckbox({
  done,
  accentColor,
  restingBorderColor,
  dotColor,
}: {
  done: boolean;
  accentColor: string;
  restingBorderColor: string;
  dotColor: string;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(done ? 1 : 0);

  useEffect(() => {
    const target = done ? 1 : 0;
    progress.set(reduced ? target : withSpring(target, SPRING.snapBack));
  }, [done, progress, reduced]);

  const dotStyle = useAnimatedStyle(() => {
    const value = progress.get();
    return {
      // The spring overshoots past 1, which is what gives the tick its pop. Opacity is
      // clamped so the overshoot only ever reaches the scale.
      opacity: Math.min(1, Math.max(0, value)),
      transform: [{ scale: 0.4 + 0.6 * value }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.checkbox,
        {
          borderColor: done ? accentColor : restingBorderColor,
          backgroundColor: done ? accentColor : 'transparent',
        },
        reduced
          ? null
          : {
              transitionProperty: ['borderColor', 'backgroundColor'],
              transitionDuration: DURATION.fast,
              transitionTimingFunction: EASE.out,
            },
      ]}
    >
      <Animated.View style={[styles.checkboxInner, { backgroundColor: dotColor }, dotStyle]} />
    </Animated.View>
  );
}

const RITUAL_ICONS: Record<RitualId, IconName> = {
  starter: 'moon.stars.fill',
  memory: 'lightbulb.fill',
  lucid: 'eye.fill',
};

const LUCID_TRAINER_BRIDGE_COPY = {
  en: {
    title: 'Continue with Lucid Trainer',
    body: 'Open a structured daytime, bedtime and morning practice. Your Noctalia journal stays here, and dream text is never transferred automatically.',
    action: 'Open Lucid Trainer',
  },
  fr: {
    title: 'Continuer avec Lucid Trainer',
    body: 'Ouvrez un entraînement structuré en journée, au coucher et au réveil. Votre journal Noctalia reste ici et aucun texte de rêve n’est transféré automatiquement.',
    action: 'Ouvrir Lucid Trainer',
  },
  es: {
    title: 'Continuar con Lucid Trainer',
    body: 'Abre una práctica estructurada para el día, la noche y la mañana. Tu diario Noctalia permanece aquí y el texto de tus sueños nunca se transfiere automáticamente.',
    action: 'Abrir Lucid Trainer',
  },
  de: {
    title: 'Mit Lucid Trainer fortfahren',
    body: 'Öffne ein strukturiertes Training für Tag, Einschlafen und Morgen. Dein Noctalia-Tagebuch bleibt hier; Traumtexte werden nie automatisch übertragen.',
    action: 'Lucid Trainer öffnen',
  },
  it: {
    title: 'Continua con Lucid Trainer',
    body: 'Apri una pratica strutturata per il giorno, la sera e il mattino. Il diario Noctalia resta qui e il testo dei sogni non viene mai trasferito automaticamente.',
    action: 'Apri Lucid Trainer',
  },
  pt: {
    title: 'Continuar com o Lucid Trainer',
    body: 'Abra uma prática estruturada para o dia, a hora de dormir e a manhã. O diário Noctalia permanece aqui e o texto dos sonhos nunca é transferido automaticamente.',
    action: 'Abrir o Lucid Trainer',
  },
} as const;

function getLucidTrainerBridgeCopy(language: string) {
  const baseLanguage = language.trim().toLowerCase().split(/[-_]/)[0];
  if (baseLanguage in LUCID_TRAINER_BRIDGE_COPY) {
    return LUCID_TRAINER_BRIDGE_COPY[
      baseLanguage as keyof typeof LUCID_TRAINER_BRIDGE_COPY
    ];
  }
  return LUCID_TRAINER_BRIDGE_COPY.en;
}

export default function RitualDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ritualId = id as RitualId;
  const { colors, mode, shadows } = useTheme();
  const noctalia = getNoctaliaDesignTokens(colors, mode);
  const { t, currentLang } = useTranslation();
  const sleepSoundCopy = useMemo(() => getSleepSoundCopy(currentLang), [currentLang]);
  const lucidTrainerBridgeCopy = useMemo(
    () => getLucidTrainerBridgeCopy(currentLang),
    [currentLang],
  );
  const sleepSoundsAvailable = isSleepSoundsAvailable();
  const insets = useSafeAreaInsets();
  const scrollPerf = useScrollIdle();

  const ritual = useMemo(
    () => RITUALS.find((r) => r.id === ritualId) ?? RITUALS[0],
    [ritualId],
  );

  const [ritualProgress, setRitualProgress] = useState<
    Partial<Record<RitualId, Record<string, boolean>>>
  >({});
  const [progressDate, setProgressDate] = useState<string>(getLocalDateKey());

  // Load progress from storage
  useEffect(() => {
    let isMounted = true;

    (async () => {
      const todayKey = getLocalDateKey();
      try {
        const storedProgress = await getRitualStepProgress();
        if (!isMounted) return;

        if (storedProgress && storedProgress.date === todayKey) {
          setRitualProgress(storedProgress.steps ?? {});
          setProgressDate(storedProgress.date);
        } else {
          setRitualProgress({});
          setProgressDate(todayKey);
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[RitualDetail] Failed to load progress', error);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Save this ritual as active preference
  useEffect(() => {
    void saveRitualPreference(ritualId).catch((error) => {
      if (__DEV__) {
        console.error('[RitualDetail] Failed to save ritual preference', error);
      }
    });
  }, [ritualId]);

  const handleToggleStep = useCallback(
    (stepId: string) => {
      const todayKey = getLocalDateKey();

      // One haptic per tap, fired here rather than inside the state updater: React is
      // free to run an updater more than once, and a doubled buzz reads as a glitch.
      // Finishing the last step is the only moment on this screen that earns the success
      // pattern; every other tick is a selection. Both land with a visible change, so a
      // user with haptics off loses nothing.
      const stepsBefore = progressDate === todayKey ? (ritualProgress[ritualId] ?? {}) : {};
      const stepCount = RITUALS.find((entry) => entry.id === ritualId)?.steps.length ?? 0;
      const doneCount = Object.values({ ...stepsBefore, [stepId]: !stepsBefore[stepId] })
        .filter(Boolean).length;
      void (stepCount > 0 && doneCount === stepCount
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : Haptics.selectionAsync()
      ).catch(() => {});

      setRitualProgress((prev) => {
        const base = progressDate === todayKey ? prev : {};
        const ritualSteps = base[ritualId] ?? {};
        const updatedRitualSteps = {
          ...ritualSteps,
          [stepId]: !ritualSteps[stepId],
        };
        const nextProgress = { ...base, [ritualId]: updatedRitualSteps };

        setProgressDate(todayKey);
        void saveRitualStepProgress({
          date: todayKey,
          steps: nextProgress,
        }).catch((error) => {
          if (__DEV__) {
            console.error('[RitualDetail] Failed to save progress', error);
          }
        });
        return nextProgress;
      });
    },
    [progressDate, ritualId, ritualProgress],
  );

  const handleOpenSleepSounds = useCallback(() => {
    router.push('/sleep-sounds' as any);
  }, []);

  const handleOpenLucidTrainer = useCallback(() => {
    router.push('/lucid' as any);
  }, []);

  const completedSteps = ritualProgress[ritualId] ?? {};
  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const totalSteps = ritual.steps.length;
  const progressPercent = totalSteps > 0 ? completedCount / totalSteps : 0;

  const backButtonTop = insets.top + ThemeLayout.spacing.sm;
  const contentPaddingTop = backButtonTop + 44 + ThemeLayout.spacing.md;

  const checkboxBorderColor =
    mode === 'dark' ? noctalia.surface.border : noctalia.text.secondary;

  const iconName = RITUAL_ICONS[ritual.id] ?? 'moon.stars.fill';

  return (
    <ScrollPerfProvider isScrolling={scrollPerf.isScrolling}>
      <View style={[styles.container, { backgroundColor: noctalia.screen.background }]}>
        <AtmosphericBackground />

        {/* Floating Back Button */}
        <Pressable
          onPress={() => router.back()}
          style={[styles.floatingBackButton, { top: backButtonTop }, shadows.lg, {
            backgroundColor: noctalia.surface.raised,
            borderWidth: 1,
            borderColor: noctalia.surface.border,
          }]}
          accessibilityRole="button"
          accessibilityLabel={t('journal.back_button')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IconSymbol name="chevron.left" size={22} color={noctalia.accent.text} />
        </Pressable>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          onScrollBeginDrag={scrollPerf.onScrollBeginDrag}
          onScrollEndDrag={scrollPerf.onScrollEndDrag}
          onMomentumScrollBegin={scrollPerf.onMomentumScrollBegin}
          onMomentumScrollEnd={scrollPerf.onMomentumScrollEnd}
        >
          <View style={[styles.content, { paddingTop: contentPaddingTop }]}>
          {/* Ritual icon and name */}
          <View style={styles.titleSection}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: noctalia.surface.soft },
              ]}
            >
              <IconSymbol
                name={iconName}
                size={28}
                color={noctalia.accent.text}
              />
            </View>
            <Text style={[styles.title, { color: noctalia.text.primary }]}>
              {t(ritual.labelKey)}
            </Text>
            <Text style={[styles.description, { color: noctalia.text.secondary }]}>
              {t(ritual.descriptionKey)}
            </Text>
          </View>

          {/* Progress bar */}
          <View style={styles.progressSection}>
            <View
              style={[
                styles.progressBarBg,
                { backgroundColor: noctalia.surface.soft },
              ]}
            >
              <ProgressFill
                percent={Math.round(progressPercent * 100)}
                style={[styles.progressBarFill, { backgroundColor: noctalia.accent.base }]}
              />
            </View>
            <Text style={[styles.progressText, { color: noctalia.accent.text }]}>
              {t('inspiration.ritual.steps_progress')
                .replace('{completed}', String(completedCount))
                .replace('{total}', String(totalSteps))}
            </Text>
          </View>

          {ritual.id === 'lucid' ? (
            <GlassCard intensity="moderate" style={styles.lucidTrainerCard} animationDelay={100}>
              <Pressable
                onPress={handleOpenLucidTrainer}
                testID="ritual-lucid-trainer-bridge"
                accessibilityRole="button"
                accessibilityLabel={lucidTrainerBridgeCopy.action}
                accessibilityHint={lucidTrainerBridgeCopy.body}
                style={({ pressed }) => [
                  styles.lucidTrainerButton,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <View
                  style={[
                    styles.lucidTrainerIcon,
                    { backgroundColor: noctalia.surface.soft },
                  ]}
                >
                  <IconSymbol
                    name="eye.fill"
                    size={25}
                    color={noctalia.accent.base}
                  />
                </View>
                <View style={styles.lucidTrainerCopy}>
                  <Text style={[styles.lucidTrainerTitle, { color: noctalia.text.primary }]}>
                    {lucidTrainerBridgeCopy.title}
                  </Text>
                  <Text style={[styles.lucidTrainerBody, { color: noctalia.text.secondary }]}>
                    {lucidTrainerBridgeCopy.body}
                  </Text>
                  <Text style={[styles.lucidTrainerAction, { color: noctalia.accent.base }]}>
                    {lucidTrainerBridgeCopy.action}
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={20} color={noctalia.accent.base} />
              </Pressable>
            </GlassCard>
          ) : null}

          {sleepSoundsAvailable ? (
            <GlassCard intensity="moderate" style={styles.sleepSoundCard} animationDelay={100}>
              <Pressable
                onPress={handleOpenSleepSounds}
                testID="ritual-sleep-sounds"
                accessibilityRole="button"
                accessibilityLabel={sleepSoundCopy.entryTitle}
                accessibilityHint={sleepSoundCopy.entryBody}
                style={({ pressed }) => [
                  styles.sleepSoundButton,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <View
                  style={[
                    styles.sleepSoundIcon,
                    { backgroundColor: noctalia.surface.soft },
                  ]}
                >
                  <IconSymbol
                    name="speaker.wave.2.fill"
                    size={24}
                    color={noctalia.accent.text}
                  />
                </View>
                <View style={styles.sleepSoundCopy}>
                  <Text style={[styles.sleepSoundTitle, { color: noctalia.text.primary }]}>
                    {sleepSoundCopy.entryTitle}
                  </Text>
                  <Text style={[styles.sleepSoundBody, { color: noctalia.text.secondary }]}>
                    {sleepSoundCopy.entryBody}
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={20} color={noctalia.accent.text} />
              </Pressable>
            </GlassCard>
          ) : null}

          {/* Steps checklist */}
          <GlassCard
            intensity="moderate"
            style={styles.stepsCard}
            animationDelay={150}
          >
            <View style={styles.stepsContainer}>
              {ritual.steps.map((step) => {
                const done = completedSteps?.[step.id];
                return (
                  <Pressable
                    key={step.id}
                    onPress={() => handleToggleStep(step.id)}
                    style={({ pressed }) => [
                      styles.stepRow,
                      { opacity: pressed ? 0.8 : 1 },
                    ]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: !!done }}
                    accessibilityLabel={t(step.titleKey)}
                    accessibilityHint={t(step.bodyKey)}
                  >
                    <RitualStepCheckbox
                      done={!!done}
                      accentColor={noctalia.accent.base}
                      restingBorderColor={checkboxBorderColor}
                      dotColor={noctalia.text.onAccent}
                    />
                    <View style={styles.stepContent}>
                      <Text
                        style={[
                          styles.stepTitle,
                          {
                            color: noctalia.text.primary,
                            textDecorationLine: done ? 'line-through' : 'none',
                            opacity: done ? 0.6 : 1,
                          },
                        ]}
                      >
                        {t(step.titleKey)}
                      </Text>
                      <Text
                        style={[
                          styles.stepBody,
                          {
                            color: noctalia.text.secondary,
                            opacity: done ? 0.5 : 1,
                          },
                        ]}
                      >
                        {t(step.bodyKey)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>
          </View>
        </ScrollView>
      </View>
    </ScrollPerfProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  floatingBackButton: {
    position: 'absolute',
    top: 0,
    left: 20,
    zIndex: 50,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 0,
    gap: 24,
  },
  titleSection: {
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.fraunces.bold,
    fontSize: 28,
    textAlign: 'center',
  },
  description: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  progressSection: {
    gap: 8,
    alignItems: 'center',
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 13,
  },
  sleepSoundCard: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  lucidTrainerCard: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  lucidTrainerButton: {
    minHeight: 126,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  lucidTrainerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lucidTrainerCopy: {
    flex: 1,
    gap: 5,
  },
  lucidTrainerTitle: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
    lineHeight: 21,
  },
  lucidTrainerBody: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  lucidTrainerAction: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 13,
    lineHeight: 18,
  },
  sleepSoundButton: {
    minHeight: 94,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  sleepSoundIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepSoundCopy: {
    flex: 1,
    gap: 4,
  },
  sleepSoundTitle: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
    lineHeight: 21,
  },
  sleepSoundBody: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  stepsCard: {
    borderRadius: 24,
    padding: 24,
  },
  stepsContainer: {
    gap: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    marginTop: 2,
  },
  checkboxInner: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  stepContent: {
    flex: 1,
    gap: 4,
  },
  stepTitle: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 16,
  },
  stepBody: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
    lineHeight: 20,
  },
});
