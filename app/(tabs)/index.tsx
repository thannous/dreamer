import { router, useFocusEffect } from "expo-router";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import { ScreenContainer } from "@/components/ScreenContainer";
import { AtmosphericBackground } from "@/components/inspiration/AtmosphericBackground";
import { TodayCard } from "@/components/home/TodayCard";
import { ReminderOptInCard } from "@/components/reminders/ReminderOptInCard";
import { PersonalReadingCard } from "@/components/inspiration/PersonalReadingCard";
import { useNotificationSettingsController } from "@/components/settings/useNotificationSettingsController";
import { buildPersonalReading } from "@/lib/personalReading";
import { FlatGlassCard } from "@/components/inspiration/GlassCard";
import { PageHeader } from "@/components/inspiration/PageHeader";
import { NoctaliaScreenHeader } from "@/components/NoctaliaScreenHeader";
import { PressableScale, Reveal } from "@/components/motion";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ThemeLayout } from "@/constants/journalTheme";
import {
  DESKTOP_BREAKPOINT,
  getBottomNavigationLayout,
} from "@/constants/layout";
import { getNoctaliaDesignTokens, type NoctaliaDesignTokens } from "@/constants/noctaliaDesign";
import { useDreamsData } from "@/context/DreamsContext";
import { useTheme } from "@/context/ThemeContext";
import { ScrollPerfProvider } from "@/context/ScrollPerfContext";
import { useAppState } from "@/hooks/useAppState";
import { useClearWebFocus } from "@/hooks/useClearWebFocus";
import { useScrollIdle } from "@/hooks/useScrollIdle";
import { useTranslation } from "@/hooks/useTranslation";
import { trackProductEvent } from "@/lib/analytics";
import { getDreamGuideCopy } from "@/lib/dreamGuideCopy";
import type { DreamGuideLanguage } from "@/lib/dreamGuideTypes";
import { isDreamAnalyzed, isDreamExplored } from "@/lib/dreamUsage";
import { getSleepSoundCopy } from "@/lib/sleepSoundCopy";
import { isSleepSoundsAvailable } from "@/lib/sleepSoundsFeature";
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
import { resolveTodayState, type TodayState } from "@/lib/todayState";
import { getRitualPreference, getRitualStepProgress, getSavedTranscript, saveRitualStepProgress } from "@/services/storageService";

type IconName = Parameters<typeof IconSymbol>[0]["name"];
type TranslateFn = ReturnType<typeof useTranslation>["t"];
type RitualProgressState = Partial<Record<RitualId, Record<string, boolean>>>;
const TIP_KEYS = [
  "inspiration.tips.captureImmediately",
  "inspiration.tips.titleLater",
  "inspiration.tips.focusEmotion",
  "inspiration.tips.observePatterns",
  "inspiration.tips.prepareNight",
] as const;

const DATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * `ReminderOptInCard`, `FlatGlassCard` and friends take a `ViewStyle` prop rather than a
 * `className`, and `FlatGlassCard` merges that style *after* its own frame — which is the
 * only way to override the glass radius and ground. So the card frames below stay style
 * objects; everything inside them is `className`.
 */
const REMINDER_CARD_SPACING: ViewStyle = { marginBottom: 24 };
const DREAM_GUIDES_CARD_FRAME: ViewStyle = {
  borderRadius: 24,
  borderCurve: "continuous",
  overflow: "hidden",
};
const TIP_CARD_FRAME: ViewStyle = {
  borderRadius: 24,
  overflow: "hidden",
  position: "relative",
};

/**
 * Inspiration / rituals screen.
 *
 * Tracks daily ritual progress and resets it when the local date changes.
 */
export default function InspirationScreen() {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t, currentLang } = useTranslation();
  const guideCopy = useMemo(
    () => getDreamGuideCopy((currentLang ?? "en") as DreamGuideLanguage),
    [currentLang],
  );
  const { width, height } = useWindowDimensions();
  const scrollPerf = useScrollIdle();
  const { dreams, loaded: dreamsLoaded } = useDreamsData();
  useClearWebFocus();
  // Note: guestLimitReached was removed - quota is now enforced on analysis, not recording
  const [selectedRitualId, setSelectedRitualId] = useState<RitualId>("starter");
  const [ritualProgress, setRitualProgress] = useState<RitualProgressState>({});
  const [progressDate, setProgressDate] = useState<string>(getLocalDateKey());
  const [showAnimations, setShowAnimations] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const isDesktopLayout = Platform.OS === "web" && width >= DESKTOP_BREAKPOINT;
  const navigationLayout = getBottomNavigationLayout(width, height);

  // Section geometry, kept in one place so a section can't drift from its neighbours.
  const mobilePadding = isDesktopLayout ? "" : "px-5";
  const desktopFullSection = isDesktopLayout ? "w-full px-3" : "";
  const desktopSideSection = isDesktopLayout ? "w-1/3 min-w-[320px] px-3" : "";

  const scrollContentBottomPadding = isDesktopLayout
    ? ThemeLayout.spacing.xl
    : navigationLayout.barHeight
      + navigationLayout.minimumBottomInset
      + ThemeLayout.spacing.lg;
  const handleOpenSymbols = useCallback(() => {
    router.push("/symbol-dictionary" as any);
  }, []);
  const handleOpenGuides = useCallback(() => {
    router.push("/dream-guides" as any);
  }, []);

  const personalReading = useMemo(
    () => (dreamsLoaded && dreams.length > 0 ? buildPersonalReading(dreams) : null),
    [dreams, dreamsLoaded]
  );
  const notificationSettings = useNotificationSettingsController();
  const nextReminderText =
    !notificationSettings.unsupported && notificationSettings.notificationsEnabled
      ? notificationSettings.nextReminderText
      : null;
  const todayState = useMemo<TodayState | null>(() => {
    if (!dreamsLoaded) return null;
    return resolveTodayState({
      now,
      localDateKey: (timestamp) => getLocalDateKey(new Date(timestamp)),
      hasDraft,
      dreams: dreams.map((dream) => ({
        id: dream.id,
        createdAt: dream.id,
        date: dream.id,
        isAnalyzed: isDreamAnalyzed(dream),
        isExplored: isDreamExplored(dream),
      })),
    });
  }, [dreams, dreamsLoaded, hasDraft, now]);
  useEffect(() => {
    if (!todayState) return;
    void trackProductEvent("home_today_viewed", {
      state: todayState.id,
      reason: todayState.reason,
    });
  }, [todayState]);

  const sleepSoundsAvailable = isSleepSoundsAvailable(Platform.OS);
  const sleepCopy = useMemo(
    () => getSleepSoundCopy(currentLang ?? "en"),
    [currentLang],
  );

  const handleTodayCta = useCallback(() => {
    if (!todayState) return;
    void trackProductEvent("home_today_cta_clicked", {
      state: todayState.id,
      reason: todayState.reason,
      action: todayState.action.kind,
    });
    switch (todayState.action.kind) {
      case "resume_recording":
      case "start_capture":
        router.push("/recording" as any);
        return;
      case "open_dream":
        router.push(`/journal/${todayState.action.dreamId}` as any);
        return;
      case "open_journal":
        router.push("/journal" as any);
        return;
    }
  }, [todayState]);
  const handleOpenSleepSounds = useCallback(() => {
    router.push("/sleep-sounds" as any);
  }, []);
  const homeHeaderActions = useMemo(
    () => [
      {
        icon: "book" as IconName,
        onPress: () => router.push("/symbol-dictionary" as any),
        accessibilityLabel: t("header.home.dictionary"),
        testID: TID.Button.HeaderHomeDictionary,
      },
      {
        icon: "moon.stars.fill" as IconName,
        onPress: () => router.push(`/ritual/${selectedRitualId}` as any),
        accessibilityLabel: t("header.home.inspiration"),
        testID: TID.Button.HeaderHomeInspiration,
      },
    ],
    [selectedRitualId, t],
  );
  const tips = useMemo(() => TIP_KEYS.map((key) => t(key)), [t]);

  const syncTodayClock = useCallback((nextNow = Date.now()) => {
    setNow((current) => {
      const currentKey = getLocalDateKey(new Date(current));
      const nextKey = getLocalDateKey(new Date(nextNow));
      return currentKey === nextKey ? current : nextNow;
    });
  }, []);

  const refreshProgressOnDateChange = useCallback(() => {
    const nextDate = new Date(Date.now());
    if (shouldResetDailyProgress(progressDate, nextDate)) {
      const todayKey = getLocalDateKey(nextDate);
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

  const refreshTodayDraft = useCallback(async (isActive?: () => boolean) => {
    try {
      const savedTranscript = await getSavedTranscript();
      if (isActive && !isActive()) return;
      setHasDraft(savedTranscript.trim().length > 0);
    } catch (error) {
      if (__DEV__) {
        console.error(
          "[InspirationScreen] Failed to read saved transcript",
          error,
        );
      }
    }
  }, []);

  const refreshTodayForOpenScreen = useCallback(() => {
    syncTodayClock();
    refreshProgressOnDateChange();
  }, [refreshProgressOnDateChange, syncTodayClock]);

  const refreshTodayOnWake = useCallback(() => {
    refreshTodayForOpenScreen();
    void refreshTodayDraft();
  }, [refreshTodayDraft, refreshTodayForOpenScreen]);

  const loadRitualState = useCallback(async () => {
    const todayKey = getLocalDateKey(new Date(Date.now()));
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
      try {
        await saveRitualStepProgress({ date: todayKey, steps: {} });
      } catch (error) {
        if (__DEV__) {
          console.error(
            "[InspirationScreen] Failed to reset stale ritual progress",
            error,
          );
        }
      }
    }

    const preferredRitual = preferredRitualId
      ? RITUALS.find((ritual) => ritual.id === preferredRitualId)
      : undefined;
    const nextSelectedRitualId: RitualId = preferredRitual?.id ?? "starter";

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
      const stillActive = () => isActive;

      refreshTodayForOpenScreen();
      void refreshTodayDraft(stillActive);
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
    }, [loadRitualState, refreshTodayDraft, refreshTodayForOpenScreen]),
  );

  // Check when returning to foreground
  useAppState(refreshTodayOnWake);

  // Periodic check to reset progress if the date changes while the screen stays open
  useEffect(() => {
    const timer = setInterval(
      refreshTodayForOpenScreen,
      DATE_CHECK_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [refreshTodayForOpenScreen]);

  useFocusEffect(
    useCallback(() => {
      setShowAnimations(true);
      return () => setShowAnimations(false);
    }, []),
  );

  return (
    <ScrollPerfProvider isScrolling={scrollPerf.isScrolling}>
      <View className="flex-1 bg-ink">
        {/* Atmospheric dreamlike background */}
        <AtmosphericBackground />

        {isDesktopLayout ? (
          <PageHeader
            titleKey="inspiration.title"
            animationSeed={showAnimations ? 1 : 0}
            topSpacing={ThemeLayout.spacing.md}
            style={{ paddingBottom: ThemeLayout.spacing.md }}
          />
        ) : (
          <NoctaliaScreenHeader
            titleKey="nav.home"
            actions={homeHeaderActions}
          />
        )}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: scrollContentBottomPadding }}
          onScrollBeginDrag={scrollPerf.onScrollBeginDrag}
          onScrollEndDrag={scrollPerf.onScrollEndDrag}
          onMomentumScrollBegin={scrollPerf.onMomentumScrollBegin}
          onMomentumScrollEnd={scrollPerf.onMomentumScrollEnd}
        >
          <ScreenContainer className={`pt-4 ${isDesktopLayout ? "px-5" : "px-0"}`}>
            <View className={isDesktopLayout ? "-mx-3 flex-row flex-wrap" : undefined}>
              <Reveal index={0} className={`mb-[34px] ${mobilePadding} ${desktopFullSection}`}>
                <TodayCard
                  state={todayState}
                  onPressCta={handleTodayCta}
                  animateOnMount={false}
                />
              </Reveal>

              {/* Morning reminder opt-in (one-time, native only) */}
              <Reveal index={1} className={`${mobilePadding} ${desktopFullSection}`}>
                <ReminderOptInCard surface="home" style={REMINDER_CARD_SPACING} />
              </Reveal>

              {/* Reading of the day — derived from the user's own journal */}
              {personalReading ? (
                <Reveal index={2} className={`mb-[34px] ${mobilePadding} ${desktopFullSection}`}>
                  <PersonalReadingCard
                    reading={personalReading}
                    nextReminderText={nextReminderText}
                    animateOnMount={false}
                  />
                </Reveal>
              ) : null}

              <View
                testID={TID.Component.HomeResources}
                className={isDesktopLayout ? "w-full flex-row flex-wrap" : undefined}
                accessibilityRole="summary"
                accessibilityLabel={t("home.today.resources")}
              >
                <View className={`mb-4 ${mobilePadding} ${desktopFullSection}`}>
                  <Text className="font-display-semibold text-[20px] text-ivory">
                    {t("home.today.resources")}
                  </Text>
                </View>

              <Reveal index={4} className={`mb-[34px] ${desktopFullSection}`}>
                <HomeStudioSection
                  noctalia={noctalia}
                  mode={mode}
                  t={t}
                  isDesktopLayout={isDesktopLayout}
                  onOpenSymbols={handleOpenSymbols}
                />
              </Reveal>

              <Reveal index={5} className={`mb-[34px] ${desktopFullSection}`}>
                <DreamGuidesHomeCard
                  noctalia={noctalia}
                  kicker={guideCopy.practicalLabel}
                  title={guideCopy.screenTitle}
                  body={guideCopy.screenSubtitle}
                  onPress={handleOpenGuides}
                />
              </Reveal>

              {/* Sleep sounds entry (feature-flagged, native only) */}
              {sleepSoundsAvailable ? (
                <Reveal index={6} className={`mb-[34px] ${desktopFullSection}`}>
                  <DreamGuidesHomeCard
                    noctalia={noctalia}
                    kicker={sleepCopy.entryTitle}
                    title={sleepCopy.screenTitle}
                    body={sleepCopy.entryBody}
                    icon="moon.stars.fill"
                    testID={TID.Button.HomeSleepSounds}
                    onPress={handleOpenSleepSounds}
                  />
                </Reveal>
              ) : null}

              {/* Rituals with Progress Rings */}
              <Reveal index={7} className="mb-[44px]">
                <RitualScrollSection
                  noctalia={noctalia}
                  rituals={RITUALS}
                  selectedRitualId={selectedRitualId}
                  ritualProgress={ritualProgress}
                  t={t}
                />
              </Reveal>

              {/* Tip of the Day - Featured card */}
              <Reveal index={8} className={`mb-[44px] ${mobilePadding} ${desktopSideSection}`}>
                <TipCard
                  noctalia={noctalia}
                  tips={tips}
                  title={t("inspiration.tip.title")}
                  subtitle={t("inspiration.tip.subtitle")}
                  nextLabel={t("inspiration.tip.next")}
                />
              </Reveal>

              </View>

            </View>
          </ScreenContainer>
        </ScrollView>

      </View>
    </ScrollPerfProvider>
  );
}

type HomeStudioSectionProps = {
  noctalia: NoctaliaDesignTokens;
  mode: "light" | "dark";
  t: TranslateFn;
  isDesktopLayout: boolean;
  onOpenSymbols: () => void;
};

type DreamSymbolsHeroProps = HomeStudioSectionProps;

const HomeStudioSection = memo(function HomeStudioSection({
  noctalia,
  mode,
  t,
  isDesktopLayout,
  onOpenSymbols,
}: HomeStudioSectionProps) {
  return (
    <DreamSymbolsHero
      noctalia={noctalia}
      mode={mode}
      t={t}
      isDesktopLayout={isDesktopLayout}
      onOpenSymbols={onOpenSymbols}
    />
  );
});

const DreamSymbolsHero = memo(function DreamSymbolsHero({
  noctalia,
  mode,
  t,
  isDesktopLayout,
  onOpenSymbols,
}: DreamSymbolsHeroProps) {
  // `IconSymbol` takes a colour value, not a style.
  const accentText = noctalia.accent.text;
  const symbolCardStyle = useMemo<ViewStyle>(
    () => ({
      borderRadius: 26,
      borderWidth: 1,
      overflow: "hidden",
      backgroundColor: noctalia.surface.raised,
      borderColor: noctalia.surface.border,
      ...(isDesktopLayout ? { maxWidth: 760 } : null),
    }),
    [isDesktopLayout, noctalia.surface.border, noctalia.surface.raised],
  );

  return (
    <View className="px-5">
      <FlatGlassCard intensity="strong" style={symbolCardStyle} animateOnMount={false}>
        <View className="h-[3px] w-full bg-champagne" />
        <View className="gap-[13px] p-[18px]">
          <View className="flex-row items-center gap-2.5">
            <View className="h-[42px] w-[42px] items-center justify-center rounded-[15px] bg-ink-soft">
              <IconSymbol name="book.closed.fill" size={22} color={accentText} />
            </View>
            <Text className="flex-1 font-sans-bold text-[12px] uppercase text-champagne-on">
              {t("symbols.home_card_kicker")}
            </Text>
          </View>

          <Text
            className="font-display-semibold text-[33px] leading-[38px] text-ivory"
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.84}
          >
            {t("symbols.home_card_title")}
          </Text>
          <Text className="font-sans text-[15px] leading-[22px] text-ivory-muted">
            {t("symbols.home_card_body")}
          </Text>

          <PressableScale
            onPress={onOpenSymbols}
            accessibilityRole="button"
            accessibilityLabel={t("symbols.home_explore_button")}
            className="min-h-[50px] flex-row items-center justify-center gap-[9px] rounded-[18px] border border-champagne-soft bg-champagne px-4 dark:bg-ink-active"
          >
            <IconSymbol
              name="book.closed.fill"
              size={18}
              color={mode === "dark" ? accentText : noctalia.action.primaryText}
            />
            <Text
              className="font-sans-bold text-[15px] text-on-champagne dark:text-champagne-on"
              numberOfLines={1}
            >
              {t("symbols.home_explore_button")}
            </Text>
            <Text className="font-sans-bold text-[17px] leading-[19px] text-on-champagne dark:text-champagne-on">
              →
            </Text>
          </PressableScale>

        </View>
      </FlatGlassCard>
    </View>
  );
});

type DreamGuidesHomeCardProps = {
  noctalia: NoctaliaDesignTokens;
  kicker: string;
  title: string;
  body: string;
  onPress: () => void;
  icon?: IconName;
  testID?: string;
};

const DreamGuidesHomeCard = memo(function DreamGuidesHomeCard({
  noctalia,
  kicker,
  title,
  body,
  onPress,
  icon = "sparkles",
  testID = "btn.home.dreamGuides",
}: DreamGuidesHomeCardProps) {
  return (
    <View className="px-5">
      <FlatGlassCard intensity="strong" style={DREAM_GUIDES_CARD_FRAME} animateOnMount={false}>
        <PressableScale
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={title}
          testID={testID}
          className="min-h-[126px] flex-row items-center gap-3.5 p-[18px]"
        >
          <View className="h-[50px] w-[50px] items-center justify-center rounded-[17px] bg-ink-soft">
            <IconSymbol name={icon} size={23} color={noctalia.accent.text} />
          </View>
          <View className="flex-1 gap-1">
            <Text className="font-sans-bold text-[11px] uppercase leading-[15px] text-champagne-on">
              {kicker}
            </Text>
            <Text className="font-display-semibold text-[21px] leading-[26px] text-ivory">
              {title}
            </Text>
            <Text className="font-sans text-[13px] leading-[19px] text-ivory-muted" numberOfLines={2}>
              {body}
            </Text>
          </View>
          <IconSymbol name="chevron.right" size={20} color={noctalia.accent.text} />
        </PressableScale>
      </FlatGlassCard>
    </View>
  );
});

// ─── Ritual Cards with Progress Ring ─────────────────────────────────────────

const RITUAL_ICONS: Record<RitualId, string> = {
  starter: "moon.stars.fill",
  memory: "lightbulb.fill",
  lucid: "eye.fill",
};

type RitualScrollSectionProps = {
  noctalia: NoctaliaDesignTokens;
  rituals: RitualConfig[];
  selectedRitualId: RitualId;
  ritualProgress: RitualProgressState;
  t: TranslateFn;
};

const RitualScrollSection = memo(function RitualScrollSection({
  noctalia,
  rituals,
  selectedRitualId,
  ritualProgress,
  t,
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
      <View className="mb-4 px-5">
        <Text className="font-display-semibold text-[20px] text-ivory">
          {t("inspiration.ritual.title")}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3 px-5 py-2"
      >
        {ritualCards.map(({ ritual, completedCount, progressRatio, totalSteps, iconName }) => {
          const isActive = ritual.id === selectedRitualId;
          const ritualCardStyle: ViewStyle = {
            width: 200,
            borderRadius: 22,
            padding: 18,
            justifyContent: "flex-start",
            gap: 8,
            backgroundColor: noctalia.surface.raised,
            borderColor: isActive ? noctalia.accent.base : noctalia.surface.border,
            ...(isActive ? { borderWidth: 2 } : null),
          };

          return (
            <FlatGlassCard
              key={ritual.id}
              testID={TID.Button.InspirationRitualVariant(ritual.id)}
              intensity="subtle"
              style={ritualCardStyle}
              animateOnMount={false}
              onPress={() => router.push(`/ritual/${ritual.id}` as any)}
              accessibilityRole="button"
              accessibilityLabel={t(ritual.labelKey)}
            >
              {/* Icon */}
              <View className="mb-0.5 h-10 w-10 items-center justify-center rounded-md bg-ink-soft">
                <IconSymbol
                  name={iconName as any}
                  size={20}
                  color={noctalia.accent.text}
                />
              </View>

              <Text className="font-sans-medium text-[15px] text-ivory" numberOfLines={1}>
                {t(ritual.labelKey)}
              </Text>
              <Text className="font-sans text-[12px] leading-4 text-ivory-muted" numberOfLines={3}>
                {t(ritual.descriptionKey)}
              </Text>

              {/* Progress bar */}
              <View className="mt-1 gap-1.5">
                <View className="h-1 overflow-hidden rounded-[2px] bg-line">
                  <View
                    className="h-1 rounded-[2px] bg-champagne"
                    // Progress is a runtime ratio, so only its width can be inline.
                    style={{ width: `${Math.max(progressRatio * 100, 0)}%` }}
                  />
                </View>
                <Text className="font-sans-medium text-[11px] text-champagne-on">
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
  noctalia: NoctaliaDesignTokens;
  title: string;
  subtitle: string;
  tips: string[];
  nextLabel: string;
};

const TipCard = memo(function TipCard({
  noctalia,
  title,
  subtitle,
  tips,
  nextLabel,
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
      style={TIP_CARD_FRAME}
      animateOnMount={false}
      testID={TID.Component.InspirationTip}
    >
      {/* Decorative accent stripe */}
      <View className="h-[3px] w-full bg-champagne opacity-85" />
      <View className="gap-3.5 p-[22px]">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="mb-1 font-display-semibold text-[19px] text-ivory">
              {title}
            </Text>
            <Text className="font-sans text-[14px] text-ivory-muted">
              {subtitle}
            </Text>
          </View>
          <View className="h-9 w-9 items-center justify-center rounded-[18px] bg-ink-soft">
            <IconSymbol name="sparkles" size={18} color={noctalia.accent.text} />
          </View>
        </View>

        <Text className="font-sans text-body text-ivory">
          {tips[tipIndex]}
        </Text>

        <PressableScale
          onPress={handleNext}
          className="flex-row items-center gap-1.5 self-start rounded-[20px] bg-ink-soft px-3.5 py-2"
          testID={TID.Button.InspirationTipNext}
        >
          <IconSymbol
            name="arrow.triangle.2.circlepath"
            size={16}
            color={noctalia.accent.text}
          />
          <Text className="font-sans-medium text-[14px] text-champagne-on">
            {nextLabel}
          </Text>
        </PressableScale>
      </View>
    </FlatGlassCard>
  );
});

// QuickAccess section intentionally removed to keep the home
// focused on guidance, rituals and inspiration rather than navigation.
