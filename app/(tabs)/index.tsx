import { router, useFocusEffect } from "expo-router";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { ScreenContainer } from "@/components/ScreenContainer";
import { AtmosphericBackground } from "@/components/inspiration/AtmosphericBackground";
import { FlatGlassCard } from "@/components/inspiration/GlassCard";
import { PageHeader } from "@/components/inspiration/PageHeader";
import { SectionHeading } from "@/components/inspiration/SectionHeading";
import { FloatingAddDreamButton } from "@/components/ui/FloatingAddDreamButton";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { DecoLines, ThemeLayout } from "@/constants/journalTheme";
import {
  ADD_BUTTON_RESERVED_SPACE,
  DESKTOP_BREAKPOINT,
  TAB_BAR_HEIGHT,
} from "@/constants/layout";
import { Fonts } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { ScrollPerfProvider } from "@/context/ScrollPerfContext";
import { useAppState } from "@/hooks/useAppState";
import { useClearWebFocus } from "@/hooks/useClearWebFocus";
import { useScrollIdle } from "@/hooks/useScrollIdle";
import { useTranslation } from "@/hooks/useTranslation";
import {
  RITUALS,
  type RitualConfig,
  type RitualId,
} from "@/lib/inspirationRituals";
import {
  getLocalDateKey,
  shouldResetDailyProgress,
} from "@/lib/ritualProgressUtils";
import { TID } from "@/lib/testIDs";
import { getRitualPreference, getRitualStepProgress, saveRitualStepProgress } from "@/services/storageService";

type IconName = Parameters<typeof IconSymbol>[0]["name"];
type TranslateFn = ReturnType<typeof useTranslation>["t"];
type RitualProgressState = Partial<Record<RitualId, Record<string, boolean>>>;
type ResolvedCopyCard = {
  id: string;
  icon: IconName;
  title: string;
  body: string;
};

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
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const scrollPerf = useScrollIdle();
  useClearWebFocus();
  // Note: guestLimitReached was removed - quota is now enforced on analysis, not recording
  const [selectedRitualId, setSelectedRitualId] = useState<RitualId>("starter");
  const [ritualProgress, setRitualProgress] = useState<RitualProgressState>({});
  const [progressDate, setProgressDate] = useState<string>(getLocalDateKey());
  const [showAnimations, setShowAnimations] = useState(false);

  const isDesktopLayout = Platform.OS === "web" && width >= DESKTOP_BREAKPOINT;

  const fallbackTabHeight = TAB_BAR_HEIGHT;
  const floatingOffset = fallbackTabHeight;
  // Always show add button - quota is enforced on analysis, not recording
  const showAddButton = true;
  const scrollContentBottomPadding =
    floatingOffset +
    (showAddButton
      ? ADD_BUTTON_RESERVED_SPACE + ThemeLayout.spacing.sm
      : ThemeLayout.spacing.sm);
  const handleAddDream = useCallback(() => {
    router.push("/recording");
  }, []);

  const tips = useMemo(() => TIP_KEYS.map((key) => t(key)), [t]);
  const prompts = useMemo(
    (): ResolvedCopyCard[] =>
      PROMPT_CARDS.map((card) => ({
        id: card.id,
        icon: card.icon,
        title: t(card.titleKey),
        body: t(card.bodyKey),
      })),
    [t],
  );
  const exercises = useMemo(
    (): ResolvedCopyCard[] =>
      EXERCISE_CARDS.map((card) => ({
        id: card.id,
        icon: card.icon,
        title: t(card.titleKey),
        body: t(card.bodyKey),
      })),
    [t],
  );
  const myths = useMemo(
    (): ResolvedCopyCard[] =>
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

  const loadRitualState = useCallback(async () => {
    const todayKey = getLocalDateKey();
    const [storedProgress, preferredRitualId] = await Promise.all([
      getRitualStepProgress(),
      getRitualPreference(),
    ]);

    let nextProgress: RitualProgressState = {};
    let nextProgressDate = todayKey;

    if (storedProgress && storedProgress.date === todayKey) {
      nextProgress = storedProgress.steps ?? {};
      nextProgressDate = storedProgress.date;
    } else {
      await saveRitualStepProgress({ date: todayKey, steps: {} });
    }

    const nextSelectedRitualId =
      preferredRitualId && RITUALS.some((ritual) => ritual.id === preferredRitualId)
        ? preferredRitualId
        : "starter";

    return {
      nextProgress,
      nextProgressDate,
      nextSelectedRitualId,
    };
  }, []);

  // Reload progress from storage on focus (picks up changes from ritual detail page)
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      refreshProgressOnDateChange();
      void (async () => {
        try {
          const state = await loadRitualState();
          if (!isActive) return;
          setRitualProgress(state.nextProgress);
          setProgressDate(state.nextProgressDate);
          setSelectedRitualId(state.nextSelectedRitualId);
        } catch (error) {
          if (__DEV__) {
            console.error(
              "[InspirationScreen] Failed to load ritual state",
              error,
            );
          }
        }
      })();

      return () => {
        isActive = false;
      };
    }, [loadRitualState, refreshProgressOnDateChange]),
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

  useFocusEffect(
    useCallback(() => {
      setShowAnimations(true);
      return () => setShowAnimations(false);
    }, []),
  );

  return (
    <ScrollPerfProvider isScrolling={scrollPerf.isScrolling}>
      <View
        style={[styles.container, { backgroundColor: colors.backgroundDark }]}
      >
        {/* Atmospheric dreamlike background */}
        <AtmosphericBackground />

        <PageHeader
          titleKey="inspiration.title"
          animationSeed={showAnimations ? 1 : 0}
          topSpacing={ThemeLayout.spacing.md}
          style={styles.pageHeader}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: scrollContentBottomPadding },
          ]}
          onScrollBeginDrag={scrollPerf.onScrollBeginDrag}
          onScrollEndDrag={scrollPerf.onScrollEndDrag}
          onMomentumScrollBegin={scrollPerf.onMomentumScrollBegin}
          onMomentumScrollEnd={scrollPerf.onMomentumScrollEnd}
        >
          <ScreenContainer
            style={[
              styles.contentContainer,
              !isDesktopLayout && styles.mobileRootContainer,
            ]}
          >
            <View style={isDesktopLayout ? styles.desktopGrid : undefined}>
              {/* Dream dictionary card */}
              <View style={styles.sectionSpacing}>
                <DictionaryCardSection colors={colors} t={t} />
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
                  tips={tips}
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
                <InfoCardsSection colors={colors} cards={prompts} />
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
                <InfoCardsSection colors={colors} cards={exercises} />
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
                <InfoCardsSection colors={colors} cards={myths} />
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
          <FloatingAddDreamButton
            onPress={handleAddDream}
            label={t("journal.add_button.label")}
            accessibilityLabel={t("journal.add_button.accessibility")}
            bottomOffset={floatingOffset - 60}
            isDesktopLayout={isDesktopLayout}
            testID={TID.Button.AddDream}
          />
        )}
      </View>
    </ScrollPerfProvider>
  );
}

type DictionaryCardSectionProps = {
  colors: ReturnType<typeof useTheme>["colors"];
  t: TranslateFn;
};

const DictionaryCardSection = memo(function DictionaryCardSection({ colors, t }: DictionaryCardSectionProps) {
  return (
    <View style={styles.dictionaryCardContainer}>
      <FlatGlassCard
        intensity="moderate"
        style={styles.dictionaryCard}
        onPress={() => router.push("/symbol-dictionary" as any)}
        accessibilityRole="button"
        accessibilityLabel={t("symbols.home_card_title")}
      >
        <View style={styles.dictionaryCardContent}>
          <View
            style={[
              styles.dictionaryCardIconWrap,
              { backgroundColor: `${colors.accent}22` },
            ]}
          >
            <IconSymbol name="book.closed.fill" size={22} color={colors.accent} />
          </View>
          <View style={styles.dictionaryCardCopy}>
            <Text
              style={[styles.dictionaryCardTitle, { color: colors.textPrimary }]}
            >
              {t("symbols.home_card_title")}
            </Text>
            <Text
              style={[
                styles.dictionaryCardBody,
                { color: colors.textSecondary },
              ]}
            >
              {t("symbols.home_card_body")}
            </Text>
          </View>
          <Text style={[styles.dictionaryCardCta, { color: colors.accent }]}>
            {t("symbols.open_dictionary")} →
          </Text>
        </View>
      </FlatGlassCard>
    </View>
  );
});

// SectionHeading is now imported from @/components/inspiration/SectionHeading

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
  ritualProgress: RitualProgressState;
  t: TranslateFn;
  mode: "light" | "dark";
};

const RitualScrollSection = memo(function RitualScrollSection({
  colors,
  rituals,
  selectedRitualId,
  ritualProgress,
  t,
  mode,
}: RitualScrollSectionProps) {
  const ritualCards = useMemo(
    () =>
      rituals.map((ritual) => {
        const steps = ritualProgress[ritual.id] ?? {};
        const completedCount = Object.values(steps).filter(Boolean).length;
        const totalSteps = ritual.steps.length;

        return {
          ritual,
          completedCount,
          progressRatio: totalSteps > 0 ? completedCount / totalSteps : 0,
          totalSteps,
          iconName: RITUAL_ICONS[ritual.id] ?? "moon.stars.fill",
        };
      }),
    [ritualProgress, rituals],
  );

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
        {ritualCards.map(({ ritual, completedCount, progressRatio, totalSteps, iconName }, index) => {
          const isActive = ritual.id === selectedRitualId;

          return (
            <FlatGlassCard
              key={ritual.id}
              intensity="subtle"
              style={[
                styles.ritualCard,
                isActive && styles.ritualCardActive,
                isActive && { borderColor: colors.accent },
              ]}
              animationDelay={120 * index}
              onPress={() => router.push(`/ritual/${ritual.id}` as any)}
              accessibilityRole="button"
              accessibilityLabel={t(ritual.labelKey)}
            >
              {/* Icon */}
              <View
                style={[
                  styles.ritualIconWrapper,
                  { backgroundColor: `${colors.accent}35` },
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
            </FlatGlassCard>
          );
        })}
      </ScrollView>
    </View>
  );
});

// ─── Tip Card ────────────────────────────────────────────────────────────────

type TipCardProps = {
  colors: ReturnType<typeof useTheme>["colors"];
  title: string;
  subtitle: string;
  tips: string[];
  nextLabel: string;
  mode: "light" | "dark";
};

const TipCard = memo(function TipCard({
  colors,
  title,
  subtitle,
  tips,
  nextLabel,
  mode,
}: TipCardProps) {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    // Defer randomization to the client to avoid SSR hydration mismatches.
    setTipIndex(Math.floor(Math.random() * tips.length));
  }, [tips]);

  const handleNext = useCallback(() => {
    setTipIndex((prev) => (prev + 1) % tips.length);
  }, [tips.length]);

  return (
    <FlatGlassCard
      intensity="moderate"
      style={styles.tipCard}
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
                  mode === "dark" ? `${colors.accent}60` : `${colors.accent}30`,
              },
            ]}
          >
            <IconSymbol name="sparkles" size={18} color={colors.accent} />
          </View>
        </View>

        <Text style={[styles.tipBody, { color: colors.textPrimary }]}>
          {tips[tipIndex]}
        </Text>

        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [
            styles.tipButton,
            {
              backgroundColor:
                mode === "dark" ? `${colors.accent}50` : `${colors.accent}25`,
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
    </FlatGlassCard>
  );
});

// QuickAccess section intentionally removed to keep the home
// focused on guidance, rituals and inspiration rather than navigation.

// ─── Info Card ───────────────────────────────────────────────────────────────

type InfoCardProps = {
  colors: ReturnType<typeof useTheme>["colors"];
  icon: IconName;
  title: string;
  body: string;
};

const InfoCardsSection = memo(function InfoCardsSection({
  colors,
  cards,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  cards: ResolvedCopyCard[];
}) {
  return (
    <View style={styles.stack}>
      {cards.map((card) => (
        <InfoCard
          key={card.id}
          colors={colors}
          icon={card.icon}
          title={card.title}
          body={card.body}
        />
      ))}
    </View>
  );
});

const InfoCard = memo(function InfoCard({ colors, icon, title, body }: InfoCardProps) {
  const cardBackgroundColor = colors.backgroundCard;

  return (
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
  );
});

// ─── Quote Card ──────────────────────────────────────────────────────────────

const QuoteCard = memo(function QuoteCard({
  colors,
  mode,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  mode: "light" | "dark";
}) {
  const { t } = useTranslation();
  const quoteCardStyle = useMemo(
    () => StyleSheet.flatten([styles.quoteCard, { borderColor: colors.divider }]),
    [colors.divider],
  );

  return (
    <FlatGlassCard
      intensity="subtle"
      style={quoteCardStyle}
      animateOnMount={false}
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
    </FlatGlassCard>
  );
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Scroll & Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: ThemeLayout.spacing.md,
  },
  pageHeader: {
    paddingBottom: ThemeLayout.spacing.md,
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

  // Info cards stack
  stack: {
    gap: 14,
  },

  dictionaryCardContainer: {
    paddingHorizontal: 20,
  },
  dictionaryCard: {
    borderRadius: 24,
  },
  dictionaryCardContent: {
    minHeight: 132,
    padding: 22,
    gap: 14,
    justifyContent: "space-between",
  },
  dictionaryCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dictionaryCardCopy: {
    gap: 6,
  },
  dictionaryCardTitle: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 22,
    letterSpacing: 0.3,
  },
  dictionaryCardBody: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  dictionaryCardCta: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
  },

  // Ritual Cards
  popularHeader: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  popularTitle: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 20,
    letterSpacing: 0.3,
  },
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
  ritualCardActive: {
    borderWidth: 2,
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
    ...DecoLines.stripe,
    height: 3,
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

});
