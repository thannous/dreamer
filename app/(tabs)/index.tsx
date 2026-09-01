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

const DATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * `ReminderOptInCard` takes a `ViewStyle` prop rather than a `className`, and merges that
 * style after its own frame. Keep that spacing as a style object.
 */
const REMINDER_CARD_SPACING: ViewStyle = { marginBottom: 24 };

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
  const [progressDate, setProgressDate] = useState<string>(getLocalDateKey());
  const [showAnimations, setShowAnimations] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const isDesktopLayout = Platform.OS === "web" && width >= DESKTOP_BREAKPOINT;
  const navigationLayout = getBottomNavigationLayout(width, height);

  // Section geometry, kept in one place so a section can't drift from its neighbours.
  const mobilePadding = isDesktopLayout ? "" : "px-5";
  const desktopFullSection = isDesktopLayout ? "w-full px-3" : "";

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
      {
        icon: "gear" as IconName,
        onPress: () => router.push("/(tabs)/settings" as any),
        accessibilityLabel: t("nav.settings"),
        testID: TID.Button.HeaderHomeSettings,
      },
    ],
    [selectedRitualId, t],
  );

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

    let nextProgressDate = todayKey;
    if (storedProgress && storedProgress.date === todayKey) {
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

              <Reveal index={4} className={`mb-6 ${mobilePadding} ${desktopFullSection}`}>
                <HomeResourcesRow
                  t={t}
                  noctalia={noctalia}
                  selectedRitualId={selectedRitualId}
                  sleepSoundsAvailable={sleepSoundsAvailable}
                  symbolsLabel={t("symbols.home_card_title")}
                  guidesLabel={guideCopy.screenTitle}
                  ritualLabel={t("inspiration.ritual.title")}
                  sleepLabel={sleepCopy.screenTitle}
                  onOpenSymbols={handleOpenSymbols}
                  onOpenGuides={handleOpenGuides}
                  onOpenSleepSounds={handleOpenSleepSounds}
                />
              </Reveal>

            </View>
          </ScreenContainer>
        </ScrollView>

      </View>
    </ScrollPerfProvider>
  );
}

type HomeResourcesRowProps = {
  t: TranslateFn;
  noctalia: NoctaliaDesignTokens;
  selectedRitualId: RitualId;
  sleepSoundsAvailable: boolean;
  symbolsLabel: string;
  guidesLabel: string;
  ritualLabel: string;
  sleepLabel: string;
  onOpenSymbols: () => void;
  onOpenGuides: () => void;
  onOpenSleepSounds: () => void;
};

const HomeResourcesRow = memo(function HomeResourcesRow({
  t,
  noctalia,
  selectedRitualId,
  sleepSoundsAvailable,
  symbolsLabel,
  guidesLabel,
  ritualLabel,
  sleepLabel,
  onOpenSymbols,
  onOpenGuides,
  onOpenSleepSounds,
}: HomeResourcesRowProps) {
  const items = [
    {
      key: 'symbols',
      icon: 'book.closed.fill' as IconName,
      label: symbolsLabel,
      onPress: onOpenSymbols,
      testID: TID.Button.HomeResourcesSymbols,
    },
    {
      key: 'guides',
      icon: 'sparkles' as IconName,
      label: guidesLabel,
      onPress: onOpenGuides,
      testID: TID.Button.HomeResourcesGuides,
    },
    {
      key: 'ritual',
      icon: 'moon.stars.fill' as IconName,
      label: ritualLabel,
      onPress: () => router.push(`/ritual/${selectedRitualId}` as any),
      testID: TID.Button.HomeResourcesRitual,
    },
    ...(sleepSoundsAvailable
      ? [{
          key: 'sleep',
          icon: 'moon.stars.fill' as IconName,
          label: sleepLabel,
          onPress: onOpenSleepSounds,
          testID: TID.Button.HomeSleepSounds,
        }]
      : []),
  ];

  return (
    <View
      testID={TID.Component.HomeResources}
      accessibilityRole="summary"
      accessibilityLabel={t('home.today.resources')}
      className="gap-3"
    >
      <Text className="font-sans-bold text-[12px] uppercase text-ivory-muted">
        {t('home.today.resources')}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {items.map((item) => (
          <PressableScale
            key={item.key}
            onPress={item.onPress}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            testID={item.testID}
            className="min-h-[44px] min-w-[44px] flex-row items-center gap-2 rounded-full border border-line bg-ink-soft px-3.5 py-2"
          >
            <IconSymbol name={item.icon} size={16} color={noctalia.accent.text} />
            <Text className="font-sans-medium text-[13px] text-ivory" numberOfLines={1}>
              {item.label}
            </Text>
          </PressableScale>
        ))}
      </View>
    </View>
  );
});

// QuickAccess section intentionally removed to keep the home
// focused on guidance, rituals and inspiration rather than navigation.
