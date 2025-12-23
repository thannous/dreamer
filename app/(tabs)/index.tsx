import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenContainer } from '@/components/ScreenContainer';
import { DreamIcon } from '@/components/icons/DreamIcons';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { ADD_BUTTON_RESERVED_SPACE, DESKTOP_BREAKPOINT, LAYOUT_MAX_WIDTH, TAB_BAR_HEIGHT } from '@/constants/layout';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useAppState } from '@/hooks/useAppState';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useTranslation } from '@/hooks/useTranslation';
import { RITUALS, type RitualConfig, type RitualId } from '@/lib/inspirationRituals';
import { MotiText } from '@/lib/moti';
import { TID } from '@/lib/testIDs';
import type { NotificationSettings, ThemeMode } from '@/lib/types';
import { scheduleRitualReminder } from '@/services/notificationService';
import {
  getNotificationSettings,
  getRitualPreference,
  getRitualStepProgress,
  saveRitualPreference,
  saveRitualStepProgress,
} from '@/services/storageService';

type IconName = Parameters<typeof IconSymbol>[0]['name'];

const TIP_KEYS = [
  'inspiration.tips.captureImmediately',
  'inspiration.tips.titleLater',
  'inspiration.tips.focusEmotion',
  'inspiration.tips.observePatterns',
  'inspiration.tips.prepareNight',
] as const;

const DATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Returns a local-time YYYY-MM-DD key used to scope daily ritual progress.
 */
const getLocalDateKey = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

type CopyCard = {
  id: string;
  icon: IconName;
  titleKey: string;
  bodyKey: string;
};

const PROMPT_CARDS: CopyCard[] = [
  {
    id: 'people',
    icon: 'lightbulb.fill',
    titleKey: 'inspiration.prompts.people.title',
    bodyKey: 'inspiration.prompts.people.body',
  },
  {
    id: 'emotion',
    icon: 'sparkles',
    titleKey: 'inspiration.prompts.emotions.title',
    bodyKey: 'inspiration.prompts.emotions.body',
  },
  {
    id: 'symbols',
    icon: 'moon.stars.fill',
    titleKey: 'inspiration.prompts.symbols.title',
    bodyKey: 'inspiration.prompts.symbols.body',
  },
];

const EXERCISE_CARDS: CopyCard[] = [
  {
    id: 'intention',
    icon: 'moon.stars.fill',
    titleKey: 'inspiration.exercises.intention.title',
    bodyKey: 'inspiration.exercises.intention.body',
  },
  {
    id: 'patterns',
    icon: 'calendar',
    titleKey: 'inspiration.exercises.patterns.title',
    bodyKey: 'inspiration.exercises.patterns.body',
  },
  {
    id: 'micro',
    icon: 'pencil',
    titleKey: 'inspiration.exercises.microjournaling.title',
    bodyKey: 'inspiration.exercises.microjournaling.body',
  },
];

const MYTH_CARDS: CopyCard[] = [
  {
    id: 'memory',
    icon: 'quote.opening',
    titleKey: 'inspiration.myths.memory.title',
    bodyKey: 'inspiration.myths.memory.body',
  },
  {
    id: 'recurrence',
    icon: 'figure.walk',
    titleKey: 'inspiration.myths.recurrence.title',
    bodyKey: 'inspiration.myths.recurrence.body',
  },
];

/**
 * Inspiration / rituals screen.
 *
 * Tracks daily ritual progress and resets it when the local date changes.
 */
export default function InspirationScreen() {
  const { colors, shadows, mode } = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  useClearWebFocus();
  // Note: guestLimitReached was removed - quota is now enforced on analysis, not recording
  const [tipIndex, setTipIndex] = useState(0);
  const [selectedRitualId, setSelectedRitualId] = useState<RitualId>('starter');
  const [ritualProgress, setRitualProgress] = useState<Partial<Record<RitualId, Record<string, boolean>>>>({});
  const [progressDate, setProgressDate] = useState<string>(getLocalDateKey());
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [showAnimations, setShowAnimations] = useState(false);

  const isDesktopLayout = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;

  const fallbackTabHeight = TAB_BAR_HEIGHT;
  const floatingOffset = fallbackTabHeight;
  // Always show add button - quota is enforced on analysis, not recording
  const showAddButton = true;
  const scrollContentBottomPadding = floatingOffset + (showAddButton ? ADD_BUTTON_RESERVED_SPACE + ThemeLayout.spacing.sm : ThemeLayout.spacing.sm);

  const tips = useMemo(() => TIP_KEYS.map((key) => t(key)), [t]);
  const prompts = useMemo(
    () => PROMPT_CARDS.map((card) => ({
      id: card.id,
      icon: card.icon,
      title: t(card.titleKey),
      body: t(card.bodyKey),
    })),
    [t]
  );
  const exercises = useMemo(
    () => EXERCISE_CARDS.map((card) => ({
      id: card.id,
      icon: card.icon,
      title: t(card.titleKey),
      body: t(card.bodyKey),
    })),
    [t]
  );
  const myths = useMemo(
    () => MYTH_CARDS.map((card) => ({
      id: card.id,
      icon: card.icon,
      title: t(card.titleKey),
      body: t(card.bodyKey),
    })),
    [t]
  );

  const activeRitual = useMemo(() => {
    const found = RITUALS.find((ritual) => ritual.id === selectedRitualId);
    return found ?? RITUALS[0];
  }, [selectedRitualId]);

  const refreshProgressOnDateChange = useCallback(() => {
    const todayKey = getLocalDateKey();
    if (progressDate !== todayKey) {
      if (__DEV__) {
        console.log('[InspirationScreen] Date changed, resetting ritual progress', {
          old: progressDate,
          new: todayKey,
        });
      }
      setRitualProgress({});
      setProgressDate(todayKey);
      void saveRitualStepProgress({ date: todayKey, steps: {} }).catch((error) => {
        if (__DEV__) {
          console.error('[InspirationScreen] Failed to reset ritual progress', error);
        }
      });
    }
  }, [progressDate]);

  // Check on focus
  useFocusEffect(
    useCallback(() => {
      refreshProgressOnDateChange();
    }, [refreshProgressOnDateChange])
  );

  // Check when returning to foreground
  useAppState(refreshProgressOnDateChange);

  // Periodic check to reset progress if the date changes while the screen stays open
  useEffect(() => {
    const timer = setInterval(refreshProgressOnDateChange, DATE_CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refreshProgressOnDateChange]);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const stored = await getRitualPreference();
        if (!isMounted || !stored) return;
        const match = RITUALS.find((ritual) => ritual.id === stored);
        if (match) {
          setSelectedRitualId(match.id);
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[InspirationScreen] Failed to load ritual preference', error);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

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
          await saveRitualStepProgress({ date: todayKey, steps: {} });
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[InspirationScreen] Failed to load ritual step progress', error);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const savedSettings = await getNotificationSettings();
        if (isMounted) {
          setNotificationSettings(savedSettings);
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[InspirationScreen] Failed to load notification settings', error);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRitualChange = async (id: RitualId) => {
    setSelectedRitualId(id);
    try {
      await saveRitualPreference(id);
      if (notificationSettings && (notificationSettings.weekdayEnabled || notificationSettings.weekendEnabled)) {
        await scheduleRitualReminder(notificationSettings, id);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[InspirationScreen] Failed to save ritual preference', error);
      }
    }
  };

  const handleToggleRitualStep = (stepId: string) => {
    const todayKey = getLocalDateKey();
    setRitualProgress((prev) => {
      const base = progressDate === todayKey ? prev : {};
      const ritualSteps = base[selectedRitualId] ?? {};
      const updatedRitualSteps = { ...ritualSteps, [stepId]: !ritualSteps[stepId] };
      const nextProgress = { ...base, [selectedRitualId]: updatedRitualSteps };

      setProgressDate(todayKey);
      void saveRitualStepProgress({ date: todayKey, steps: nextProgress }).catch((error) => {
        if (__DEV__) {
          console.error('[InspirationScreen] Failed to save ritual step progress', error);
        }
      });
      return nextProgress;
    });
  };

  useEffect(() => {
    // Defer randomization to the client to avoid SSR hydration mismatches.
    setTipIndex(Math.floor(Math.random() * TIP_KEYS.length));
  }, []);

  const completedSteps = ritualProgress[selectedRitualId] ?? {};

  useFocusEffect(
    useCallback(() => {
      setShowAnimations(true);
      return () => setShowAnimations(false);
    }, [])
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDark }]}>
      <ScreenContainer>
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + ThemeLayout.spacing.sm },
          ]}
        >
          <MotiText
            key={`header-${showAnimations}`}
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 650 }}
            style={[styles.headerTitle, { color: colors.textPrimary }]}
          >
            {t('inspiration.title')}
          </MotiText>
        </View>
      </ScreenContainer>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: scrollContentBottomPadding }}
      >
        <ScreenContainer
          style={[
            styles.contentContainer,
            !isDesktopLayout && styles.mobileRootContainer,
          ]}
        >
          <View style={isDesktopLayout ? styles.desktopGrid : undefined}>
            <View style={[styles.sectionSpacing, isDesktopLayout && styles.desktopHeroSection]}>
              <View>
                <RitualCard
                  colors={colors}
                  shadows={shadows}
                  mode={mode}
                  rituals={RITUALS}
                  activeRitual={activeRitual}
                  selectedRitualId={selectedRitualId}
                  completedSteps={completedSteps}
                  onChangeRitual={handleRitualChange}
                  onToggleStep={handleToggleRitualStep}
                />
              </View>
            </View>

            <View
              style={[
                styles.sectionSpacing,
                !isDesktopLayout && styles.mobileSectionPadding,
                isDesktopLayout && styles.desktopSideSection,
              ]}
            >
              <TipCard
                colors={colors}
                shadows={shadows}
                tip={tips[tipIndex]}
                onNext={() => setTipIndex((prev) => (prev + 1) % tips.length)}
                title={t('inspiration.tip.title')}
                subtitle={t('inspiration.tip.subtitle')}
                nextLabel={t('inspiration.tip.next')}
              />
            </View>

            <View
              style={[
                styles.sectionSpacing,
                !isDesktopLayout && styles.mobileSectionPadding,
                isDesktopLayout && styles.desktopHalfSection,
              ]}
            >
              <SectionHeading
                title={t('inspiration.prompts.title')}
                subtitle={t('inspiration.prompts.subtitle')}
                colors={colors}
              />
              <View style={styles.stack16}>
                {prompts.map((prompt) => (
                  <InfoCard key={prompt.id} colors={colors} icon={prompt.icon} title={prompt.title} body={prompt.body} />
                ))}
              </View>
            </View>

            <View
              style={[
                styles.sectionSpacing,
                !isDesktopLayout && styles.mobileSectionPadding,
                isDesktopLayout && styles.desktopHalfSection,
              ]}
            >
              <SectionHeading
                title={t('inspiration.exercises.title')}
                subtitle={t('inspiration.exercises.subtitle')}
                colors={colors}
              />
              <View style={styles.stack16}>
                {exercises.map((exercise) => (
                  <InfoCard
                    key={exercise.id}
                    colors={colors}
                    icon={exercise.icon}
                    title={exercise.title}
                    body={exercise.body}
                  />
                ))}
              </View>
            </View>

            <View
              style={[
                styles.sectionSpacing,
                !isDesktopLayout && styles.mobileSectionPadding,
                isDesktopLayout && styles.desktopHalfSection,
              ]}
            >
              <SectionHeading
                title={t('inspiration.myths.title')}
                subtitle={t('inspiration.myths.subtitle')}
                colors={colors}
              />
              <View style={styles.stack16}>
                {myths.map((myth) => (
                  <InfoCard key={myth.id} colors={colors} icon={myth.icon} title={myth.title} body={myth.body} />
                ))}
              </View>
            </View>

            <View
              style={[
                styles.sectionSpacing,
                !isDesktopLayout && styles.mobileSectionPadding,
                isDesktopLayout && styles.desktopHalfSection,
              ]}
            >
              <QuoteCard colors={colors} />
            </View>
          </View>
        </ScreenContainer>
      </ScrollView>

      {showAddButton && (
        <View
          style={[
            styles.floatingButtonContainer,
            isDesktopLayout && styles.floatingButtonDesktop,
            { bottom: floatingOffset },
          ]}
        >
          <Pressable
            style={[styles.addButton, shadows.xl, { backgroundColor: colors.accent }]}
            onPress={() => router.push('/recording')}
            accessibilityRole="button"
            testID={TID.Button.AddDream}
            accessibilityLabel={t('journal.add_button.accessibility')}
          >
            <DreamIcon size={24} color={colors.backgroundCard} />
            <Text style={[styles.addButtonText, { color: colors.backgroundCard }]}>
              {t('journal.add_button.label')}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

type SectionHeadingProps = {
  title: string;
  subtitle?: string;
  colors: ReturnType<typeof useTheme>['colors'];
};

function SectionHeading({ title, subtitle, colors }: SectionHeadingProps) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
      {subtitle ? <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
    </View>
  );
}

type RitualCardProps = {
  colors: ReturnType<typeof useTheme>['colors'];
  shadows: ReturnType<typeof useTheme>['shadows'];
  mode: ThemeMode;
  rituals: RitualConfig[];
  activeRitual: RitualConfig;
  selectedRitualId: RitualId;
  onChangeRitual: (id: RitualId) => void;
  completedSteps: Record<string, boolean>;
  onToggleStep: (stepId: string) => void;
};

function RitualCard({
  colors,
  shadows,
  mode,
  rituals,
  activeRitual,
  selectedRitualId,
  onChangeRitual,
  completedSteps,
  onToggleStep,
}: RitualCardProps) {
  const { t } = useTranslation();

  const checkboxBorderColor = mode === 'dark' ? colors.divider : colors.textSecondary;

  return (
    <View
      style={[
        styles.heroCard,
        { backgroundColor: colors.backgroundCard },
        { marginHorizontal: 16 },
        shadows.lg,
      ]}
    >
      <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>{t('inspiration.ritual.title')}</Text>
      <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>{t('inspiration.ritual.subtitle')}</Text>

      <View style={styles.ritualSelectorRow}>
        {rituals.map((ritual) => {
          const isActive = ritual.id === selectedRitualId;
          return (
            <Pressable
              key={ritual.id}
              testID={TID.Button.InspirationRitualVariant(ritual.id)}
              onPress={() => onChangeRitual(ritual.id)}
              style={({ pressed }) => [
                styles.ritualChip,
                {
                  backgroundColor: isActive ? colors.accent : 'transparent',
                  borderColor: isActive ? colors.accent : colors.divider,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.ritualChipLabel,
                  { color: isActive ? colors.textOnAccentSurface : colors.textSecondary },
                ]}
              >
                {t(ritual.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.ritualDescription, { color: colors.textSecondary }]}>
        {t(activeRitual.descriptionKey)}
      </Text>

      <View style={styles.ritualSteps}>
        {activeRitual.steps.map((step) => {
          const done = completedSteps?.[step.id];
          return (
            <Pressable
              key={step.id}
              onPress={() => onToggleStep(step.id)}
              style={({ pressed }) => [
                styles.ritualStep,
                { opacity: pressed ? 0.8 : 1 },
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!done }}
              accessibilityLabel={t(step.titleKey)}
              accessibilityHint={t(step.bodyKey)}
            >
              <View
                style={[
                  styles.ritualCheckbox,
                  {
                    borderColor: done ? colors.accent : checkboxBorderColor,
                    backgroundColor: done ? colors.accent : 'transparent',
                  },
                ]}
              >
                {done ? (
                  <View
                    style={[
                      styles.ritualCheckboxInner,
                      { backgroundColor: colors.textOnAccentSurface },
                    ]}
                  />
                ) : null}
              </View>
              <View style={styles.ritualContent}>
                <Text style={[styles.ritualTitle, { color: colors.textPrimary }]}>
                  {t(step.titleKey)}
                </Text>
                <Text style={[styles.ritualBody, { color: colors.textSecondary }]}>
                  {t(step.bodyKey)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type TipCardProps = {
  colors: ReturnType<typeof useTheme>['colors'];
  shadows: ReturnType<typeof useTheme>['shadows'];
  title: string;
  subtitle: string;
  tip: string;
  nextLabel: string;
  onNext: () => void;
};

function TipCard({ colors, shadows, title, subtitle, tip, nextLabel, onNext }: TipCardProps) {
  return (
    <View style={[styles.tipCard, { backgroundColor: colors.backgroundCard }, shadows.md]} testID={TID.Component.InspirationTip}>
      <IconSymbol name="sparkles" size={24} color={colors.accent} style={styles.tipBadge} />
      <View style={styles.tipHeader}>
        <Text style={[styles.tipTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.tipSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
      <Text style={[styles.tipBody, { color: colors.textPrimary }]}>{tip}</Text>
      <Pressable
        onPress={onNext}
        style={({ pressed }) => [styles.tipButton, { opacity: pressed ? 0.6 : 1 }]}
        testID={TID.Button.InspirationTipNext}
      >
        <IconSymbol name="arrow.triangle.2.circlepath" size={18} color={colors.accent} />
        <Text style={[styles.tipButtonLabel, { color: colors.accent }]}>{nextLabel}</Text>
      </Pressable>
    </View>
  );
}

// QuickAccess section intentionally removed to keep the home
// focused on guidance, rituals and inspiration rather than navigation.

type InfoCardProps = {
  colors: ReturnType<typeof useTheme>['colors'];
  icon: IconName;
  title: string;
  body: string;
};

function InfoCard({ colors, icon, title, body }: InfoCardProps) {
  return (
    <View style={[styles.infoCard, { backgroundColor: colors.backgroundCard, borderColor: colors.divider }]}>
      <View style={[styles.infoIconWrapper, { backgroundColor: colors.backgroundSecondary }]}>
        <IconSymbol name={icon} size={20} color={colors.textOnAccentSurface} />
      </View>
      <View style={styles.infoContent}>
        <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.infoBody, { color: colors.textSecondary }]}>{body}</Text>
      </View>
    </View>
  );
}

function QuoteCard({ colors }: { colors: ReturnType<typeof useTheme>['colors'] }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.quoteCard, { backgroundColor: colors.backgroundCard, borderColor: colors.divider }]}>
      <IconSymbol name="quote.opening" size={28} color={colors.accent} />
      <Text style={[styles.quoteText, { color: colors.textPrimary }]}>{t('inspiration.quote.text')}</Text>
      <Text style={[styles.quoteAuthor, { color: colors.textSecondary }]}>{t('inspiration.quote.author')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: ThemeLayout.spacing.sm,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: -0.3,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: ThemeLayout.spacing.sm,
  },
  mobileRootContainer: {
    paddingHorizontal: 0,
  },
  mobileSectionPadding: {
    paddingHorizontal: 20,
  },
  desktopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -12,
  },
  desktopHeroSection: {
    width: '66.6667%',
    minWidth: 360,
    paddingHorizontal: 12,
  },
  desktopSideSection: {
    width: '33.3333%',
    minWidth: 320,
    paddingHorizontal: 12,
  },
  desktopHalfSection: {
    width: '50%',
    minWidth: 320,
    paddingHorizontal: 12,
  },
  sectionSpacing: {
    marginBottom: 32,
  },
  sectionHeading: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 20,
    letterSpacing: 0.3,
  },
  sectionSubtitle: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
    marginTop: 4,
  },
  stack16: {
    gap: 16,
  },
  heroCard: {
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
  },
  overline: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  heroTitle: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 28,
    lineHeight: 34,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 12,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  heroButtonText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 15,
  },
  heroButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: ThemeLayout.spacing.lg,
    gap: 12,
  },
  heroPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: ThemeLayout.borderRadius.xl,
    flex: 1,
    gap: 8,
  },
  heroPrimaryLabel: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 15,
  },
  heroSecondaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: ThemeLayout.borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    gap: 6,
  },
  heroSecondaryText: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 13,
  },
  tipCard: {
    borderRadius: 20,
    padding: 20,
    position: 'relative',
  },
  tipHeader: {
    marginBottom: 12,
    paddingRight: 36,
  },
  tipBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  tipTitle: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 18,
    marginBottom: 4,
  },
  tipSubtitle: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
  },
  tipBody: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 16,
  },
  tipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tipButtonLabel: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
  },
  floatingButtonContainer: {
    position: 'absolute',
    width: '100%',
    padding: ThemeLayout.spacing.md,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  floatingButtonDesktop: {
    alignSelf: 'center',
    maxWidth: LAYOUT_MAX_WIDTH,
  },
  addButton: {
    borderRadius: ThemeLayout.borderRadius.full,
    paddingVertical: ThemeLayout.spacing.md,
    paddingHorizontal: ThemeLayout.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  ritualSteps: {
    marginTop: 8,
    gap: 12,
  },
  ritualActions: {
    marginTop: 16,
  },
  ritualStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  ritualCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  ritualCheckboxInner: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  ritualContent: {
    flex: 1,
    gap: 4,
  },
  ritualTitle: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 15,
  },
  ritualBody: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  ritualSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  ritualChip: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  ritualChipLabel: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 13,
  },
  ritualDescription: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 13,
    marginBottom: 8,
  },
  ritualCta: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  ritualCtaText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 15,
  },
  infoCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
  },
  infoIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    flex: 1,
    gap: 6,
  },
  infoTitle: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 16,
  },
  infoBody: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  quoteCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'flex-start',
    gap: 12,
  },
  quoteText: {
    fontFamily: Fonts.lora.regularItalic,
    fontSize: 18,
    lineHeight: 26,
  },
  quoteAuthor: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
    letterSpacing: 0.2,
  },
});
