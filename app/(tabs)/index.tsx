import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/ScreenContainer";
import { DreamIcon } from "@/components/icons/DreamIcons";
import { AtmosphericBackground } from "@/components/inspiration/AtmosphericBackground";
import { GlassCard } from "@/components/inspiration/GlassCard";
import { GradientText } from "@/components/inspiration/GradientText";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ThemeLayout } from "@/constants/journalTheme";
import {
  ADD_BUTTON_RESERVED_SPACE,
  DESKTOP_BREAKPOINT,
  LAYOUT_MAX_WIDTH,
  TAB_BAR_HEIGHT,
} from "@/constants/layout";
import { Fonts } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useAppState } from "@/hooks/useAppState";
import { useClearWebFocus } from "@/hooks/useClearWebFocus";
import { useTranslation } from "@/hooks/useTranslation";
import {
  RITUALS,
  type RitualConfig,
  type RitualId,
} from "@/lib/inspirationRituals";
import { MotiView } from "@/lib/moti";
import {
  getLocalDateKey,
  shouldResetDailyProgress,
} from "@/lib/ritualProgressUtils";
import type { SymbolLanguage } from "@/lib/symbolTypes";
import { TID } from "@/lib/testIDs";
import {
  getRitualPreference,
  getRitualStepProgress,
  saveRitualStepProgress,
} from "@/services/storageService";
import {
  getPopularSymbols,
  getSymbolIcon,
} from "@/services/symbolDictionaryService";

type IconName = Parameters<typeof IconSymbol>[0]["name"];

const TIP_KEYS = [
  "inspiration.tips.captureImmediately",
  "inspiration.tips.titleLater",
  "inspiration.tips.focusEmotion",
  "inspiration.tips.observePatterns",
  "inspiration.tips.prepareNight",
] as const;

const DATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

type CopyCard = {
  id: string;
  icon: IconName;
  titleKey: string;
  bodyKey: string;
};

const PROMPT_CARDS: CopyCard[] = [
  {
    id: "people",
    icon: "lightbulb.fill",
    titleKey: "inspiration.prompts.people.title",
    bodyKey: "inspiration.prompts.people.body",
  },
  {
    id: "emotion",
    icon: "sparkles",
    titleKey: "inspiration.prompts.emotions.title",
    bodyKey: "inspiration.prompts.emotions.body",
  },
  {
    id: "symbols",
    icon: "moon.stars.fill",
    titleKey: "inspiration.prompts.symbols.title",
    bodyKey: "inspiration.prompts.symbols.body",
  },
];

const EXERCISE_CARDS: CopyCard[] = [
  {
    id: "intention",
    icon: "moon.stars.fill",
    titleKey: "inspiration.exercises.intention.title",
    bodyKey: "inspiration.exercises.intention.body",
  },
  {
    id: "patterns",
    icon: "calendar",
    titleKey: "inspiration.exercises.patterns.title",
    bodyKey: "inspiration.exercises.patterns.body",
  },
  {
    id: "micro",
    icon: "pencil",
    titleKey: "inspiration.exercises.microjournaling.title",
    bodyKey: "inspiration.exercises.microjournaling.body",
  },
];

const MYTH_CARDS: CopyCard[] = [
  {
    id: "memory",
    icon: "quote.opening",
    titleKey: "inspiration.myths.memory.title",
    bodyKey: "inspiration.myths.memory.body",
  },
  {
    id: "recurrence",
    icon: "figure.walk",
    titleKey: "inspiration.myths.recurrence.title",
    bodyKey: "inspiration.myths.recurrence.body",
  },
];

/**
 * Inspiration / rituals screen.
 *
 * Tracks daily ritual progress and resets it when the local date changes.
 */
export default function InspirationScreen() {
  const { colors, mode } = useTheme();
  const { t, currentLang } = useTranslation();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  useClearWebFocus();
  // Note: guestLimitReached was removed - quota is now enforced on analysis, not recording
  const [tipIndex, setTipIndex] = useState(0);
  const [selectedRitualId, setSelectedRitualId] = useState<RitualId>("starter");
  const [ritualProgress, setRitualProgress] = useState<
    Partial<Record<RitualId, Record<string, boolean>>>
  >({});
  const [progressDate, setProgressDate] = useState<string>(getLocalDateKey());
  const [showAnimations, setShowAnimations] = useState(false);

  const isDesktopLayout = Platform.OS === "web" && width >= DESKTOP_BREAKPOINT;
  const headerGradientColors = useMemo(
    () =>
      mode === "dark"
        ? ([colors.accentLight, colors.accent] as const)
        : ([colors.textPrimary, colors.accentDark] as const),
    [
      colors.accent,
      colors.accentDark,
      colors.accentLight,
      colors.textPrimary,
      mode,
    ],
  );

  const fallbackTabHeight = TAB_BAR_HEIGHT;
  const floatingOffset = fallbackTabHeight;
  // Always show add button - quota is enforced on analysis, not recording
  const showAddButton = true;
  const scrollContentBottomPadding =
    floatingOffset +
    (showAddButton
      ? ADD_BUTTON_RESERVED_SPACE + ThemeLayout.spacing.sm
      : ThemeLayout.spacing.sm);

  const tips = useMemo(() => TIP_KEYS.map((key) => t(key)), [t]);
  const prompts = useMemo(
    () =>
      PROMPT_CARDS.map((card) => ({
        id: card.id,
        icon: card.icon,
        title: t(card.titleKey),
        body: t(card.bodyKey),
      })),
    [t],
  );
  const exercises = useMemo(
    () =>
      EXERCISE_CARDS.map((card) => ({
        id: card.id,
        icon: card.icon,
        title: t(card.titleKey),
        body: t(card.bodyKey),
      })),
    [t],
  );
  const myths = useMemo(
    () =>
      MYTH_CARDS.map((card) => ({
        id: card.id,
        icon: card.icon,
        title: t(card.titleKey),
        body: t(card.bodyKey),
      })),
    [t],
  );

  const refreshProgressOnDateChange = useCallback(() => {
    const now = new Date();
    if (shouldResetDailyProgress(progressDate, now)) {
      const todayKey = getLocalDateKey(now);
      if (__DEV__) {
        console.log(
          "[InspirationScreen] Date changed, resetting ritual progress",
          {
            old: progressDate,
            new: todayKey,
          },
        );
      }
      setRitualProgress({});
      setProgressDate(todayKey);
      void saveRitualStepProgress({ date: todayKey, steps: {} }).catch(
        (error) => {
          if (__DEV__) {
            console.error(
              "[InspirationScreen] Failed to reset ritual progress",
              error,
            );
          }
        },
      );
    }
  }, [progressDate]);

  // Reload progress from storage on focus (picks up changes from ritual detail page)
  useFocusEffect(
    useCallback(() => {
      refreshProgressOnDateChange();
      const todayKey = getLocalDateKey();
      void (async () => {
        try {
          const stored = await getRitualStepProgress();
          if (stored && stored.date === todayKey) {
            setRitualProgress(stored.steps ?? {});
          }
          const pref = await getRitualPreference();
          if (pref) {
            const match = RITUALS.find((r) => r.id === pref);
            if (match) setSelectedRitualId(match.id);
          }
        } catch {
          // ignore
        }
      })();
    }, [refreshProgressOnDateChange]),
  );

  // Check when returning to foreground
  useAppState(refreshProgressOnDateChange);

  // Periodic check to reset progress if the date changes while the screen stays open
  useEffect(() => {
    const timer = setInterval(
      refreshProgressOnDateChange,
      DATE_CHECK_INTERVAL_MS,
    );
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
          console.error(
            "[InspirationScreen] Failed to load ritual preference",
            error,
          );
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
          console.error(
            "[InspirationScreen] Failed to load ritual step progress",
            error,
          );
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    // Defer randomization to the client to avoid SSR hydration mismatches.
    setTipIndex(Math.floor(Math.random() * TIP_KEYS.length));
  }, []);

  useFocusEffect(
    useCallback(() => {
      setShowAnimations(true);
      return () => setShowAnimations(false);
    }, []),
  );

  return (
    <View
      style={[styles.container, { backgroundColor: colors.backgroundDark }]}
    >
      {/* Atmospheric dreamlike background */}
      <AtmosphericBackground />

      <ScreenContainer>
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + ThemeLayout.spacing.md },
          ]}
        >
          <MotiView
            key={`header-${showAnimations}`}
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 700 }}
          >
            <GradientText
              colors={headerGradientColors}
              style={styles.headerTitle}
            >
              {t("inspiration.title")}
            </GradientText>
          </MotiView>
          <MotiView
            key={`header-rule-${showAnimations}`}
            from={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ type: "timing", duration: 600, delay: 350 }}
          >
            <View
              style={[styles.headerRule, { backgroundColor: colors.accent }]}
            />
          </MotiView>
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
            {/* Popular Symbols - Constellation style */}
            <View style={styles.sectionSpacing}>
              <PopularSymbolsSection
                colors={colors}
                mode={mode}
                language={currentLang as SymbolLanguage}
                t={t}
                showAnimations={showAnimations}
              />
            </View>

            {/* Rituals with Progress Rings */}
            <View style={styles.sectionSpacing}>
              <RitualScrollSection
                colors={colors}
                rituals={RITUALS}
                selectedRitualId={selectedRitualId}
                ritualProgress={ritualProgress}
                t={t}
                mode={mode}
              />
            </View>

            {/* Tip of the Day - Featured card */}
            <View
              style={[
                styles.sectionSpacing,
                !isDesktopLayout && styles.mobileSectionPadding,
                isDesktopLayout && styles.desktopSideSection,
              ]}
            >
              <TipCard
                colors={colors}
                tip={tips[tipIndex]}
                onNext={() => setTipIndex((prev) => (prev + 1) % tips.length)}
                title={t("inspiration.tip.title")}
                subtitle={t("inspiration.tip.subtitle")}
                nextLabel={t("inspiration.tip.next")}
                mode={mode}
              />
            </View>

            {/* Prompts */}
            <View
              style={[
                styles.sectionSpacing,
                !isDesktopLayout && styles.mobileSectionPadding,
                isDesktopLayout && styles.desktopHalfSection,
              ]}
            >
              <SectionHeading
                title={t("inspiration.prompts.title")}
                subtitle={t("inspiration.prompts.subtitle")}
                colors={colors}
                icon="lightbulb.fill"
              />
              <View style={styles.stack}>
                {prompts.map((prompt, index) => (
                  <InfoCard
                    key={prompt.id}
                    colors={colors}
                    icon={prompt.icon}
                    title={prompt.title}
                    body={prompt.body}
                    index={index}
                  />
                ))}
              </View>
            </View>

            {/* Exercises */}
            <View
              style={[
                styles.sectionSpacing,
                !isDesktopLayout && styles.mobileSectionPadding,
                isDesktopLayout && styles.desktopHalfSection,
              ]}
            >
              <SectionHeading
                title={t("inspiration.exercises.title")}
                subtitle={t("inspiration.exercises.subtitle")}
                colors={colors}
                icon="pencil"
              />
              <View style={styles.stack}>
                {exercises.map((exercise, index) => (
                  <InfoCard
                    key={exercise.id}
                    colors={colors}
                    icon={exercise.icon}
                    title={exercise.title}
                    body={exercise.body}
                    index={index}
                  />
                ))}
              </View>
            </View>

            {/* Myths */}
            <View
              style={[
                styles.sectionSpacing,
                !isDesktopLayout && styles.mobileSectionPadding,
                isDesktopLayout && styles.desktopHalfSection,
              ]}
            >
              <SectionHeading
                title={t("inspiration.myths.title")}
                subtitle={t("inspiration.myths.subtitle")}
                colors={colors}
                icon="quote.opening"
              />
              <View style={styles.stack}>
                {myths.map((myth, index) => (
                  <InfoCard
                    key={myth.id}
                    colors={colors}
                    icon={myth.icon}
                    title={myth.title}
                    body={myth.body}
                    index={index}
                  />
                ))}
              </View>
            </View>

            {/* Closing Quote */}
            <View
              style={[
                styles.sectionSpacing,
                !isDesktopLayout && styles.mobileSectionPadding,
                isDesktopLayout && styles.desktopHalfSection,
              ]}
            >
              <QuoteCard colors={colors} mode={mode} />
            </View>
          </View>
        </ScreenContainer>
      </ScrollView>

      {showAddButton && (
        <View
          style={[
            styles.floatingButtonContainer,
            isDesktopLayout && styles.floatingButtonDesktop,
            { bottom: floatingOffset - 60 },
          ]}
        >
          <MotiView
            from={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              type: "spring",
              damping: 14,
              stiffness: 120,
              delay: 400,
            }}
          >
            <Pressable
              style={({ pressed }) => [
                styles.addButton,
                { backgroundColor: colors.accent },
                pressed && styles.addButtonPressed,
              ]}
              onPress={() => router.push("/recording")}
              accessibilityRole="button"
              testID={TID.Button.AddDream}
              accessibilityLabel={t("journal.add_button.accessibility")}
            >
              <DreamIcon size={22} color={colors.backgroundCard} />
              <Text
                style={[styles.addButtonText, { color: colors.backgroundCard }]}
              >
                {t("journal.add_button.label")}
              </Text>
            </Pressable>
          </MotiView>
        </View>
      )}
    </View>
  );
}

// ─── Popular Symbols (Constellation Cards) ───────────────────────────────────

type PopularSymbolsSectionProps = {
  colors: ReturnType<typeof useTheme>["colors"];
  mode: "light" | "dark";
  language: SymbolLanguage;
  t: (key: string) => string;
  showAnimations: boolean;
};

function PopularSymbolsSection({
  colors,
  mode,
  language,
  t,
  showAnimations,
}: PopularSymbolsSectionProps) {
  const popularSymbols = useMemo(() => getPopularSymbols(), []);

  return (
    <View>
      <View style={styles.popularHeader}>
        <Text style={[styles.popularTitle, { color: colors.textPrimary }]}>
          {t("symbols.popular_title")}
        </Text>
        <Pressable
          onPress={() => router.push("/symbol-dictionary" as any)}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          accessibilityRole="link"
          accessibilityLabel={t("symbols.view_all")}
        >
          <Text style={[styles.popularViewAll, { color: colors.accent }]}>
            {t("symbols.view_all")} →
          </Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.popularScrollContent}
      >
        {popularSymbols.map((symbol, index) => {
          const content = symbol[language] ?? symbol.en;
          const symbolIcon = getSymbolIcon(symbol.id, symbol.category);

          return (
            <MotiView
              key={symbol.id}
              from={{ opacity: 0, scale: 0.8, translateY: 12 }}
              animate={
                showAnimations
                  ? { opacity: 1, scale: 1, translateY: 0 }
                  : { opacity: 0, scale: 0.8, translateY: 12 }
              }
              transition={{
                type: "spring",
                damping: 16,
                stiffness: 100,
                delay: 80 * index,
              }}
            >
              <Pressable
                onPress={() =>
                  router.push(`/symbol-detail/${symbol.id}` as any)
                }
                style={({ pressed }) => [
                  styles.symbolCard,
                  {
                    backgroundColor: `${colors.backgroundCard}B3`,
                    borderColor: colors.divider,
                  },
                  pressed && { transform: [{ scale: 0.95 }], opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={content.name}
              >
                {/* Large background icon */}
                <View style={styles.symbolBgIcon}>
                  <IconSymbol
                    name={symbolIcon}
                    size={82}
                    color={mode === "dark" ? `${colors.accent}40` : `${colors.accent}55`}
                  />
                </View>
                <Text
                  style={[styles.symbolName, { color: colors.textPrimary }]}
                  numberOfLines={3}
                >
                  {content.name}
                </Text>
              </Pressable>
            </MotiView>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Section Heading ─────────────────────────────────────────────────────────

type SectionHeadingProps = {
  title: string;
  subtitle?: string;
  colors: ReturnType<typeof useTheme>["colors"];
  icon?: IconName;
};

function SectionHeading({
  title,
  subtitle,
  colors,
  icon,
}: SectionHeadingProps) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionHeadingRow}>
        {icon && (
          <View
            style={[
              styles.sectionHeadingIcon,
              { backgroundColor: `${colors.accent}30` },
            ]}
          >
            <IconSymbol name={icon} size={14} color={colors.accent} />
          </View>
        )}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {title}
        </Text>
      </View>
      {subtitle ? (
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Ritual Cards with Progress Ring ─────────────────────────────────────────

const RITUAL_ICONS: Record<RitualId, string> = {
  starter: "moon.stars.fill",
  memory: "lightbulb.fill",
  lucid: "eye.fill",
};

type RitualScrollSectionProps = {
  colors: ReturnType<typeof useTheme>["colors"];
  rituals: RitualConfig[];
  selectedRitualId: RitualId;
  ritualProgress: Partial<Record<RitualId, Record<string, boolean>>>;
  t: (key: string) => string;
  mode: "light" | "dark";
};

function RitualScrollSection({
  colors,
  rituals,
  selectedRitualId,
  ritualProgress,
  t,
  mode,
}: RitualScrollSectionProps) {
  return (
    <View>
      <View style={styles.popularHeader}>
        <Text style={[styles.popularTitle, { color: colors.textPrimary }]}>
          {t("inspiration.ritual.title")}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.ritualScrollContainer}
      >
        {rituals.map((ritual, index) => {
          const isActive = ritual.id === selectedRitualId;
          const steps = ritualProgress[ritual.id] ?? {};
          const completedCount = Object.values(steps).filter(Boolean).length;
          const totalSteps = ritual.steps.length;
          const progressRatio =
            totalSteps > 0 ? completedCount / totalSteps : 0;
          const iconName = RITUAL_ICONS[ritual.id] ?? "moon.stars.fill";

          return (
            <GlassCard
              key={ritual.id}
              intensity="subtle"
              disableShadow
              style={{
                ...styles.ritualCard,
                ...(isActive
                  ? {
                      borderColor: colors.accent,
                      borderWidth: 1.5,
                    }
                  : undefined),
              }}
              enableAnimation={true}
              animationDelay={120 * index}
              onPress={() => router.push(`/ritual/${ritual.id}` as any)}
              accessibilityRole="button"
              accessibilityLabel={t(ritual.labelKey)}
            >
              {/* Icon */}
              <View
                style={[
                  styles.ritualIconWrapper,
                  { backgroundColor: `${colors.accent}20` },
                ]}
              >
                <IconSymbol
                  name={iconName as any}
                  size={20}
                  color={colors.accent}
                />
              </View>

              <Text
                style={[styles.ritualName, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {t(ritual.labelKey)}
              </Text>
              <Text
                style={[
                  styles.ritualDescription,
                  { color: colors.textSecondary },
                ]}
                numberOfLines={3}
              >
                {t(ritual.descriptionKey)}
              </Text>

              {/* Progress bar */}
              <View style={styles.ritualProgressBar}>
                <View
                  style={[
                    styles.ritualProgressBarTrack,
                    {
                      backgroundColor:
                        mode === "dark"
                          ? `${colors.accent}30`
                          : `${colors.accent}20`,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.ritualProgressBarFill,
                      {
                        backgroundColor: colors.accent,
                        width: `${Math.max(progressRatio * 100, 0)}%` as any,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[styles.ritualProgressText, { color: colors.accent }]}
                >
                  {t("inspiration.ritual.steps_progress")
                    .replace("{completed}", String(completedCount))
                    .replace("{total}", String(totalSteps))}
                </Text>
              </View>
            </GlassCard>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Tip Card ────────────────────────────────────────────────────────────────

type TipCardProps = {
  colors: ReturnType<typeof useTheme>["colors"];
  title: string;
  subtitle: string;
  tip: string;
  nextLabel: string;
  onNext: () => void;
  mode: "light" | "dark";
};

function TipCard({
  colors,
  title,
  subtitle,
  tip,
  nextLabel,
  onNext,
  mode,
}: TipCardProps) {
  return (
    <GlassCard
      intensity="moderate"
      disableShadow
      style={styles.tipCard}
      enableAnimation={true}
      animationDelay={300}
      testID={TID.Component.InspirationTip}
    >
      {/* Decorative accent stripe */}
      <View
        style={[styles.tipAccentStripe, { backgroundColor: colors.accent }]}
      />
      <View style={styles.tipInner}>
        <View style={styles.tipHeaderRow}>
          <View style={styles.tipHeader}>
            <Text style={[styles.tipTitle, { color: colors.textPrimary }]}>
              {title}
            </Text>
            <Text style={[styles.tipSubtitle, { color: colors.textSecondary }]}>
              {subtitle}
            </Text>
          </View>
          <View
            style={[
              styles.tipBadgeCircle,
              {
                backgroundColor:
                  mode === "dark" ? `${colors.accent}45` : `${colors.accent}25`,
              },
            ]}
          >
            <IconSymbol name="sparkles" size={18} color={colors.accent} />
          </View>
        </View>

        <Text style={[styles.tipBody, { color: colors.textPrimary }]}>
          {tip}
        </Text>

        <Pressable
          onPress={onNext}
          style={({ pressed }) => [
            styles.tipButton,
            {
              backgroundColor:
                mode === "dark" ? `${colors.accent}35` : `${colors.accent}18`,
            },
            pressed && { opacity: 0.6 },
          ]}
          testID={TID.Button.InspirationTipNext}
        >
          <IconSymbol
            name="arrow.triangle.2.circlepath"
            size={16}
            color={colors.accent}
          />
          <Text style={[styles.tipButtonLabel, { color: colors.accent }]}>
            {nextLabel}
          </Text>
        </Pressable>
      </View>
    </GlassCard>
  );
}

// QuickAccess section intentionally removed to keep the home
// focused on guidance, rituals and inspiration rather than navigation.

// ─── Info Card ───────────────────────────────────────────────────────────────

type InfoCardProps = {
  colors: ReturnType<typeof useTheme>["colors"];
  icon: IconName;
  title: string;
  body: string;
  index?: number;
};

function InfoCard({ colors, icon, title, body, index = 0 }: InfoCardProps) {
  const { mode } = useTheme();
  const opacity = mode === "dark" ? 0.3 : 0.7;
  const opacityHex = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0");
  const cardBackgroundColor = `${colors.backgroundCard}${opacityHex}`;

  return (
    <MotiView
      from={{ opacity: 0, translateX: -8 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: "timing", duration: 500, delay: 100 * index }}
    >
      <View
        style={[
          styles.infoCard,
          { borderColor: colors.divider, backgroundColor: cardBackgroundColor },
        ]}
      >
        <View
          style={[
            styles.infoIconWrapper,
            { backgroundColor: colors.backgroundSecondary },
          ]}
        >
          <IconSymbol
            name={icon}
            size={18}
            color={colors.textOnAccentSurface}
          />
        </View>
        <View style={styles.infoContent}>
          <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>
            {title}
          </Text>
          <Text style={[styles.infoBody, { color: colors.textSecondary }]}>
            {body}
          </Text>
        </View>
      </View>
    </MotiView>
  );
}

// ─── Quote Card ──────────────────────────────────────────────────────────────

function QuoteCard({
  colors,
  mode,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  mode: "light" | "dark";
}) {
  const { t } = useTranslation();

  return (
    <GlassCard
      intensity="subtle"
      disableShadow
      style={{ ...styles.quoteCard, borderColor: colors.divider }}
      enableAnimation={true}
      animationDelay={600}
    >
      {/* Top decorative line */}
      <View
        style={[
          styles.quoteDecoLine,
          {
            backgroundColor:
              mode === "dark" ? `${colors.accent}60` : `${colors.accent}40`,
          },
        ]}
      />
      <View style={styles.quoteInner}>
        <IconSymbol name="quote.opening" size={24} color={colors.accent} />
        <Text style={[styles.quoteText, { color: colors.textPrimary }]}>
          {t("inspiration.quote.text")}
        </Text>
        <View style={styles.quoteAttribution}>
          <View
            style={[
              styles.quoteAttributionDash,
              { backgroundColor: colors.accent },
            ]}
          />
          <Text style={[styles.quoteAuthor, { color: colors.textSecondary }]}>
            {t("inspiration.quote.author")}
          </Text>
        </View>
      </View>
    </GlassCard>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingTop: Platform.OS === "ios" ? 60 : 20,
    paddingBottom: ThemeLayout.spacing.md,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Fonts.fraunces.semiBold,
    letterSpacing: 0.5,
  },
  headerRule: {
    width: 36,
    height: 2.5,
    borderRadius: 1.5,
    marginTop: 10,
    opacity: 0.7,
  },

  // Scroll & Content
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: ThemeLayout.spacing.md,
  },
  mobileRootContainer: {
    paddingHorizontal: 0,
  },
  mobileSectionPadding: {
    paddingHorizontal: 20,
  },
  desktopGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -12,
  },
  desktopSideSection: {
    width: "33.3333%",
    minWidth: 320,
    paddingHorizontal: 12,
  },
  desktopHalfSection: {
    width: "50%",
    minWidth: 320,
    paddingHorizontal: 12,
  },
  sectionSpacing: {
    marginBottom: 44,
  },

  // Section Heading
  sectionHeading: {
    marginBottom: 18,
  },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionHeadingIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 22,
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },

  // Info cards stack
  stack: {
    gap: 14,
  },

  // Popular Symbols
  popularHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  popularTitle: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 20,
    letterSpacing: 0.3,
  },
  popularViewAll: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
  },
  popularScrollContent: {
    paddingHorizontal: 20,
    gap: 12,
  },

  // Symbol constellation cards
  symbolCard: {
    width: 110,
    height: 110,
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    overflow: "hidden",
  },
  symbolBgIcon: {
    position: "absolute",
    top: -10,
    right: -14,
    opacity: 1,
  },
  symbolName: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 16,
  },

  // Ritual Cards
  ritualScrollContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 12,
  },
  ritualCard: {
    width: 200,
    borderRadius: 22,
    padding: 18,
    justifyContent: "flex-start",
    gap: 8,
  },
  ritualIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  ritualName: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 15,
  },
  ritualDescription: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  ritualProgressBar: {
    marginTop: 4,
    gap: 6,
  },
  ritualProgressBarTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  ritualProgressBarFill: {
    height: 4,
    borderRadius: 2,
  },
  ritualProgressText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 11,
    letterSpacing: 0.2,
  },

  // Tip Card
  tipCard: {
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
  },
  tipAccentStripe: {
    height: 3,
    width: "100%",
    opacity: 0.85,
  },
  tipInner: {
    padding: 22,
    gap: 14,
  },
  tipHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  tipHeader: {
    flex: 1,
    paddingRight: 12,
  },
  tipBadgeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  tipTitle: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 19,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  tipSubtitle: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
  },
  tipBody: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  tipButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  tipButtonLabel: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
  },

  // Info Card
  infoCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
  },
  infoIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  infoContent: {
    flex: 1,
    gap: 4,
  },
  infoTitle: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 15,
    letterSpacing: 0.1,
  },
  infoBody: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
    lineHeight: 20,
  },

  // Quote Card
  quoteCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },
  quoteDecoLine: {
    height: 2,
    width: "100%",
  },
  quoteInner: {
    padding: 26,
    gap: 14,
  },
  quoteText: {
    fontFamily: Fonts.fraunces.regular,
    fontSize: 18,
    lineHeight: 28,
    fontStyle: "italic",
    letterSpacing: 0.2,
  },
  quoteAttribution: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  quoteAttributionDash: {
    width: 16,
    height: 1.5,
    borderRadius: 1,
    opacity: 0.5,
  },
  quoteAuthor: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 13,
    letterSpacing: 0.3,
  },

  // Floating Action Button
  floatingButtonContainer: {
    position: "absolute",
    width: "100%",
    padding: ThemeLayout.spacing.md,
    backgroundColor: "transparent",
    alignItems: "center",
  },
  floatingButtonDesktop: {
    alignSelf: "center",
    maxWidth: LAYOUT_MAX_WIDTH,
  },
  addButton: {
    borderRadius: ThemeLayout.borderRadius.full,
    paddingVertical: 14,
    paddingHorizontal: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  addButtonPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  addButtonText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
    letterSpacing: 0.2,
  },
});
