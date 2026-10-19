import { useQuickSettings } from '@/context/QuickSettingsContext';
import { router, useFocusEffect, useIsFocused } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TodayHero } from "@/components/home/TodayHero";
import { PersonalReadingCard } from "@/components/inspiration/PersonalReadingCard";
import { FreeAnalysesNudge, getFreeAnalysesNudge } from "@/components/quota/FreeAnalysesNudge";
import { useNotificationSettingsController } from "@/components/settings/useNotificationSettingsController";
import { buildPersonalReading } from "@/lib/personalReading";
import { PressableScale } from "@/components/motion";
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
import { useAuth } from "@/context/AuthContext";
import { useQuota } from "@/hooks/useQuota";
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
import { HeaderScrollView, useHeaderScroll } from '@/components/ui/headerStretch';
import { withHeaderScroll } from '@/components/ui/HeaderScrollScope';

type IconName = Parameters<typeof IconSymbol>[0]["name"];
type TranslateFn = ReturnType<typeof useTranslation>["t"];

const DATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

// Storage reads of the Today screen live outside it: React Compiler does not compile a
// component whose try/catch holds a conditional expression, and Home re-renders on focus.
async function readDraftSaved(): Promise<boolean | null> {
  try {
    const savedTranscript = await getSavedTranscript();
    return savedTranscript.trim().length > 0;
  } catch (error) {
    if (__DEV__) {
      console.error(
        "[InspirationScreen] Failed to read saved transcript",
        error,
      );
    }
    return null;
  }
}

async function loadRitualState() {
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
}

/**
 * Inspiration / rituals screen.
 *
 * Tracks daily ritual progress and resets it when the local date changes.
 */
function InspirationScreen() {
  // This screen's own scroll, published to its header painting and title.
  const onHeaderScroll = useHeaderScroll();
  const { colors, mode } = useTheme();
  const openQuickSettings = useQuickSettings();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t, currentLang } = useTranslation();
  const guideCopy = useMemo(
    () => getDreamGuideCopy((currentLang ?? "en") as DreamGuideLanguage),
    [currentLang],
  );
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollPerf = useScrollIdle();
  const { dreams, loaded: dreamsLoaded } = useDreamsData();
  const { user } = useAuth();
  const { tier, usage, loading: quotaLoading, error: quotaError } = useQuota();
  const freeAnalysesNudge = getFreeAnalysesNudge({
    tier, signedIn: Boolean(user), loading: quotaLoading, error: quotaError, usage,
  });
  useClearWebFocus();
  // Note: guestLimitReached was removed - quota is now enforced on analysis, not recording
  const [selectedRitualId, setSelectedRitualId] = useState<RitualId>("starter");
  const [progressDate, setProgressDate] = useState<string>(getLocalDateKey());
  const [hasDraft, setHasDraft] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const isDesktopLayout = Platform.OS === "web" && width >= DESKTOP_BREAKPOINT;
  const navigationLayout = getBottomNavigationLayout(width, height, fontScale);
  const scrollHeader = !isDesktopLayout && navigationLayout.compact && navigationLayout.largeText;
  const navigationClearance = navigationLayout.barHeight + Math.max(insets.bottom, navigationLayout.minimumBottomInset);

  const scrollContentBottomPadding = isDesktopLayout
    ? ThemeLayout.spacing.xl
    : scrollHeader ? ThemeLayout.spacing.lg : navigationLayout.barHeight
      + navigationLayout.minimumBottomInset
      + ThemeLayout.spacing.lg;
  const handleOpenSymbols = useCallback(() => {
    router.push("/symbol-dictionary" as any);
  }, []);
  const handleOpenGuides = useCallback(() => {
    router.push("/dream-guides" as any);
  }, []);

  const personalReading = useMemo(
    () => (dreamsLoaded && dreams.length > 0 ? buildPersonalReading(dreams, now) : null),
    [dreams, dreamsLoaded, now]
  );
  const notificationSettings = useNotificationSettingsController();
  const nextReminderText =
    !notificationSettings.unsupported && notificationSettings.notificationsEnabled && notificationSettings.hasPermissions
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
  const featuredDream = useMemo(() => {
    if (todayState?.action.kind === 'open_dream') {
      const id = todayState.action.dreamId;
      return dreams.find((dream) => dream.id === id) ?? null;
    }
    if (todayState?.id !== 'rest') return null;
    const todayKey = getLocalDateKey(new Date(now));
    return dreams.reduce<(typeof dreams)[number] | null>((latest, dream) =>
      getLocalDateKey(new Date(dream.id)) === todayKey && (!latest || dream.id > latest.id) ? dream : latest, null);
  }, [dreams, now, todayState]);
  // Reported when seen: Home stays mounted behind the other tabs, where every dream saved
  // or synced recomputes this state. Each day's state is reported once while Home is
  // visible, or when Home is shown again after it changed; a new local day is a new view.
  const homeFocused = useIsFocused();
  const reportedTodayStateRef = useRef<string | null>(null);
  useEffect(() => {
    if (!todayState || !homeFocused) return;
    const shown = JSON.stringify([getLocalDateKey(new Date(now)), todayState.id, todayState.reason]);
    if (reportedTodayStateRef.current === shown) return;
    reportedTodayStateRef.current = shown;
    void trackProductEvent("home_today_viewed", {
      state: todayState.id,
      reason: todayState.reason,
    });
  }, [homeFocused, now, todayState]);

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
    const draftSaved = await readDraftSaved();
    if (draftSaved === null || (isActive && !isActive())) return;
    setHasDraft(draftSaved);
  }, []);

  const refreshTodayForOpenScreen = useCallback(() => {
    syncTodayClock();
    refreshProgressOnDateChange();
  }, [refreshProgressOnDateChange, syncTodayClock]);

  const refreshTodayOnWake = useCallback(() => {
    refreshTodayForOpenScreen();
    void refreshTodayDraft();
  }, [refreshTodayDraft, refreshTodayForOpenScreen]);

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
    }, [refreshTodayDraft, refreshTodayForOpenScreen]),
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

  return (
    <ScrollPerfProvider activity={scrollPerf.activity}>
      <View testID="screen.home" className="flex-1 bg-ink">
        <HeaderScrollView
          className="flex-1"
          onScroll={onHeaderScroll}
          scrollEventThrottle={16}
          style={scrollHeader ? { marginBottom: navigationClearance } : undefined}
          contentInsetAdjustmentBehavior={scrollHeader ? 'never' : undefined}
          contentContainerStyle={{ paddingBottom: scrollContentBottomPadding }}
          onScrollBeginDrag={scrollPerf.onScrollBeginDrag}
          onScrollEndDrag={scrollPerf.onScrollEndDrag}
          onMomentumScrollBegin={scrollPerf.onMomentumScrollBegin}
          onMomentumScrollEnd={scrollPerf.onMomentumScrollEnd}
        >
          <ScreenContainer maxWidth={760} desktopPaddingHorizontal={0} className={isDesktopLayout ? 'px-8' : undefined}>
            <TodayHero state={todayState} dream={featuredDream} now={now}
              onPressCta={handleTodayCta} onOpenSettings={openQuickSettings} />
            <View className="px-6">
              {personalReading ? (
                <PersonalReadingCard reading={personalReading} nextReminderText={nextReminderText}
                  animateOnMount={false} compact />
              ) : null}
              {freeAnalysesNudge ? <FreeAnalysesNudge nudge={freeAnalysesNudge} /> : null}
              {!notificationSettings.unsupported ? <Pressable
                onPress={() => router.push('/settings')}
                accessibilityRole="button" accessibilityLabel={nextReminderText ?? t('home.today.add_reminder')}
                testID="btn.home.reminder"
                className="min-h-[60px] flex-row items-center gap-3 border-t border-line py-4 active:opacity-70">
                <View className="w-10 items-center"><IconSymbol name="bell" size={23} color={noctalia.accent.text} /></View>
                <Text className="min-w-0 flex-1 font-sans text-[15px] leading-[22px] text-ivory-muted">
                  {nextReminderText ?? t('home.today.add_reminder')}
                </Text>
                <IconSymbol name="chevron.right" size={18} color={noctalia.text.tertiary} />
              </Pressable> : null}
              <View className="pb-6 pt-8">
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
              </View>
            </View>
          </ScreenContainer>
        </HeaderScrollView>

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
      <View className="flex-row items-start gap-3">
        <View className="mt-[9px] h-px w-[22px] bg-champagne" />
        <Text className="min-w-0 shrink font-sans-medium text-[12px] leading-[18px] uppercase tracking-[1.6px] text-champagne-on">
          {t('home.today.resources')}
        </Text>
      </View>
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

export default withHeaderScroll(InspirationScreen);
