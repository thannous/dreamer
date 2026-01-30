import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { GlassCard } from '@/components/inspiration/GlassCard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { Ionicons } from '@expo/vector-icons';
import {
  RITUALS,
  type RitualId,
} from '@/lib/inspirationRituals';
import {
  getLocalDateKey,
} from '@/lib/ritualProgressUtils';
import {
  getRitualStepProgress,
  saveRitualPreference,
  saveRitualStepProgress,
} from '@/services/storageService';

const RITUAL_ICONS: Record<RitualId, string> = {
  starter: 'moon.stars.fill',
  memory: 'lightbulb.fill',
  lucid: 'eye.fill',
};

export default function RitualDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ritualId = id as RitualId;
  const { colors, mode, shadows } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

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
    [progressDate, ritualId],
  );

  const completedSteps = ritualProgress[ritualId] ?? {};
  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const totalSteps = ritual.steps.length;
  const progressPercent = totalSteps > 0 ? completedCount / totalSteps : 0;

  const checkboxBorderColor =
    mode === 'dark' ? colors.divider : colors.textSecondary;

  const iconName = RITUAL_ICONS[ritual.id] ?? 'moon.stars.fill';

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDark }]}>
      <AtmosphericBackground />

      {/* Floating Back Button */}
      <Pressable
        onPress={() => router.back()}
        style={[styles.floatingBackButton, shadows.lg, {
          backgroundColor: mode === 'dark' ? 'rgba(35, 26, 63, 0.85)' : colors.backgroundCard,
          borderWidth: 1,
          borderColor: mode === 'dark' ? 'rgba(160, 151, 184, 0.25)' : colors.divider,
        }]}
        accessibilityRole="button"
        accessibilityLabel={t('journal.back_button')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
      </Pressable>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        <View style={styles.content}>
          {/* Ritual icon and name */}
          <View style={styles.titleSection}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: colors.backgroundSecondary },
              ]}
            >
              <IconSymbol
                name={iconName as any}
                size={28}
                color={colors.accent}
              />
            </View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {t(ritual.labelKey)}
            </Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {t(ritual.descriptionKey)}
            </Text>
          </View>

          {/* Progress bar */}
          <View style={styles.progressSection}>
            <View
              style={[
                styles.progressBarBg,
                { backgroundColor: colors.divider },
              ]}
            >
              <View
                style={[
                  styles.progressBarFill,
                  {
                    backgroundColor: colors.accent,
                    width: `${Math.round(progressPercent * 100)}%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: colors.accent }]}>
              {t('inspiration.ritual.steps_progress')
                .replace('{completed}', String(completedCount))
                .replace('{total}', String(totalSteps))}
            </Text>
          </View>

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
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: done ? colors.accent : checkboxBorderColor,
                          backgroundColor: done ? colors.accent : 'transparent',
                        },
                      ]}
                    >
                      {done ? (
                        <View
                          style={[
                            styles.checkboxInner,
                            { backgroundColor: colors.textOnAccentSurface },
                          ]}
                        />
                      ) : null}
                    </View>
                    <View style={styles.stepContent}>
                      <Text
                        style={[
                          styles.stepTitle,
                          {
                            color: colors.textPrimary,
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
                            color: colors.textSecondary,
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  floatingBackButton: {
    position: 'absolute',
    top: 50,
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
    paddingTop: ThemeLayout.spacing.md,
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
    letterSpacing: 0.3,
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
