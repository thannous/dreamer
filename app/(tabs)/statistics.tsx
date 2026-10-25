import { useContentWindow } from '@/context/ContentWindowContext';
import { useQuickSettings } from '@/context/QuickSettingsContext';
import { JournalCompletenessNotice } from '@/components/journal/JournalCompletenessNotice';
import { DreamSymbolSheet } from '@/components/journal/symbols/DreamSymbolSheet';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import {
  Platform,
  Text,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { NoctaliaScreenHeader } from '@/components/NoctaliaScreenHeader';
import { ScreenContainer } from '@/components/ScreenContainer';
import { sparklePath } from '@/components/journal/story/sparkle';
import { PressableScale } from '@/components/motion';
import { getFreeAnalysesNudge } from '@/components/quota/FreeAnalysesNudge';
import { GuestAccountRow } from '@/components/guest/GuestAccountRow';
import { PeriodSeal, PERIOD_SEAL_SIZE } from '@/components/trends/PeriodSeal';
import { TrendsConstellations } from '@/components/trends/TrendsConstellations';
import { TrendsFigures } from '@/components/trends/TrendsFigures';
import { TrendsMoonLetters } from '@/components/trends/TrendsMoonLetters';
import { TrendsNights } from '@/components/trends/TrendsNights';
import { TrendsPeriodSwitch } from '@/components/trends/TrendsPeriodSwitch';
import { TrendsReturns } from '@/components/trends/TrendsReturns';
import { TrendsSky } from '@/components/trends/TrendsSky';
import { useEndOfLocalDay } from '@/components/trends/useEndOfLocalDay';
import { useTrendsReveal } from '@/components/trends/useTrendsReveal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DESKTOP_BREAKPOINT, getBottomNavigationLayout } from '@/constants/layout';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useAuth } from '@/context/AuthContext';
import { useDreams } from '@/context/DreamsContext';
import { useTheme } from '@/context/ThemeContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useQuota } from '@/hooks/useQuota';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamThemeLabel } from '@/lib/dreamLabels';
import { getDreamRouteParams } from '@/lib/dreamRoute';
import { buildPaywallHref } from '@/lib/paywallRoute';
import { formatQuotaResetDate, withFirstDayOrdinal } from '@/lib/quotaReset';
import { buildDreamSky } from '@/lib/dreamSky';
import { MOON_LETTER_ROUTE } from '@/lib/moonLetter';
import {
  buildDreamTrends,
  DEFAULT_DREAM_TRENDS_PERIOD,
  getLocalDateKey,
  MIN_DREAMS_FOR_TRENDS,
  type DreamTrends,
  type DreamTrendsPeriod,
} from '@/lib/dreamTrends';
import { toJournalFilterParams, type JournalFilterRequest } from '@/lib/journalFilterLink';
import { getSymbolIndex } from '@/lib/symbolLinks';
import { recordBadgeEvent } from '@/services/badgeLedgerStore';
import { getPeriodSymbols } from '@/lib/trendsSymbols';
import { TID } from '@/lib/testIDs';
import type { DreamAnalysis, DreamTheme, DreamType } from '@/lib/types';
import { CONSTELLATION_NIGHTS, getFormedWeeks, nameWeek, type WeekNights } from '@/lib/weekConstellations';
import { HeaderScrollView, useHeaderScroll } from '@/components/ui/headerStretch';
import { withHeaderScroll } from '@/components/ui/HeaderScrollScope';

const COMPACT_BREAKPOINT = 360;

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** The journal opened on some of the period's dreams; `all` carries no dates. */
function openJournal(trends: DreamTrends, request: JournalFilterRequest) {
  const dates = trends.period === 'all' ? {} : {
    from: getLocalDateKey(trends.range.start),
    to: getLocalDateKey(trends.range.end),
  };
  router.navigate({
    pathname: '/(tabs)/journal',
    params: toJournalFilterParams({ ...request, ...dates }, String(Date.now())),
  });
}

/** The sentence under the seal: what leads, what the chosen sign holds, or why nothing leads yet. */
function sealSentence(trends: DreamTrends, selected: DreamTheme | null, t: Translate, formatNumber: (value: number) => string) {
  const { counts, total, dominant, previousCounts } = trends.themes;
  if (trends.count === 0) return t('trends.seal.quiet');
  const theme = selected ?? dominant;
  if (!theme) {
    if (total === 0) return t('trends.seal.unthemed');
    if (total < MIN_DREAMS_FOR_TRENDS) {
      const missing = MIN_DREAMS_FOR_TRENDS - total;
      return t(missing === 1 ? 'trends.seal.early_one' : 'trends.seal.early', { count: formatNumber(missing) });
    }
    return t('trends.seal.tied');
  }
  const count = counts[theme];
  const sentence = selected
    ? t(count === 0 ? 'trends.seal.theme_zero' : count === 1 ? 'trends.seal.theme_one' : 'trends.seal.theme', {
      theme: getDreamThemeLabel(theme, t) ?? theme,
      count: formatNumber(count),
      total: formatNumber(trends.count),
    })
    : t('trends.seal.leans', {
      scope: t(`trends.scope.${trends.period}`),
      toward: t(`trends.seal.toward.${theme}`),
      count: formatNumber(count),
      total: formatNumber(trends.count),
    });
  if (!previousCounts || trends.period === 'all') return `${sentence}.`;
  const change = count - previousCounts[theme];
  const previous = t(`trends.previous.${trends.period}`);
  const compare = change > 0 ? t('trends.compare.more', { count: formatNumber(change), previous })
    : change < 0 ? t('trends.compare.fewer', { count: formatNumber(-change), previous })
      : t('trends.compare.same', { previous });
  return `${sentence}, ${compare}.`;
}

function StatisticsScreen() {
  // This screen's own scroll, published to its header painting and title.
  const onHeaderScroll = useHeaderScroll();
  const { dreams, loaded, completeness, reloadDreams } = useDreams();
  const { t, currentLang } = useTranslation();
  const { formatDate, formatNumber, locale } = useLocaleFormatting();
  const { user } = useAuth();
  const { tier, usage, loading: quotaLoading, error: quotaError } = useQuota();
  const analysesUsedUp = getFreeAnalysesNudge({
    tier, signedIn: Boolean(user), loading: quotaLoading, error: quotaError, usage, maxRemaining: 0,
  }) !== null;
  const { width, height, fontScale } = useContentWindow();
  const insets = useSafeAreaInsets();
  const { colors, mode } = useTheme();
  const openQuickSettings = useQuickSettings();
  const reduced = useReducedMotion();
  useClearWebFocus();

  const [period, setPeriod] = useState<DreamTrendsPeriod>(DEFAULT_DREAM_TRENDS_PERIOD);
  // The switch answers a tap at once; the page follows in a render that does not hold it up.
  const shownPeriod = useDeferredValue(period);
  // Until the page has caught up, it still shows the last period: it takes no taps meanwhile.
  const catchingUp = period !== shownPeriod;
  const [selectedTheme, setSelectedTheme] = useState<DreamTheme | null>(null);
  // A sign chosen in one period is let go once the page shows another.
  const [themePeriod, setThemePeriod] = useState(shownPeriod);
  if (themePeriod !== shownPeriod) {
    setThemePeriod(shownPeriod);
    setSelectedTheme(null);
  }
  const [openSymbol, setOpenSymbol] = useState<string | null>(null);

  const compact = width < COMPACT_BREAKPOINT;
  const largeText = Number.isFinite(fontScale) && fontScale >= 1.3;
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const isDesktopLayout = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
  const navigationLayout = getBottomNavigationLayout(width, height, fontScale);
  const scrollHeader = !isDesktopLayout && navigationLayout.compact && navigationLayout.largeText;
  const navigationClearance = navigationLayout.barHeight + Math.max(insets.bottom, navigationLayout.minimumBottomInset);
  const scrollBottomPadding = isDesktopLayout
    ? ThemeLayout.spacing.xl
    : scrollHeader ? ThemeLayout.spacing.lg : navigationClearance + ThemeLayout.spacing.lg;
  const sealSize = Math.min(PERIOD_SEAL_SIZE, Math.max(240, Math.min(width, 640) - 40));

  // Read on today's date, again whenever the journal, the period or the day changes.
  const today = useEndOfLocalDay();
  const trends = useMemo(() => buildDreamTrends(dreams, { period: shownPeriod, now: today }), [dreams, shownPeriod, today]);
  // The journal's symbols, read only once enough dreams are; the index is the one the readings share.
  // An open page keeps it, so the sheet closes as it should even if the period stops being ready.
  const { ready, analyzedIds } = trends.patterns;
  const symbolsShown = ready || openSymbol !== null;
  const symbolIndex = useMemo(
    () => (symbolsShown ? getSymbolIndex(dreams, currentLang) : null),
    [currentLang, dreams, symbolsShown],
  );
  const periodSymbols = useMemo(
    () => (symbolIndex ? getPeriodSymbols(symbolIndex, analyzedIds) : []),
    [analyzedIds, symbolIndex],
  );
  const sky = useMemo(() => buildDreamSky(dreams, trends.range, periodSymbols), [dreams, periodSymbols, trends.range]);
  // The formed weeks belong to the whole journal, whatever the period.
  const formedWeeks = useMemo(() => getFormedWeeks(dreams), [dreams]);
  // Named once per journal: each name reads the whole symbol index.
  const weekNames = useMemo(() => {
    if (formedWeeks.length === 0) return new Map<number, string>();
    const index = getSymbolIndex(dreams, currentLang);
    return new Map(formedWeeks.map((week) => {
      const name = nameWeek(week, index);
      return [week.start, !name
        ? t('trends.constellations.week_of', { date: withFirstDayOrdinal(formatDate(week.start, { day: 'numeric', month: 'long' }), locale) })
        : 'symbol' in name ? name.symbol.name : getDreamThemeLabel(name.theme, t) ?? name.theme];
    }));
  }, [currentLang, dreams, formatDate, formedWeeks, locale, t]);

  const { nightsRef, returnsRef, skyRef, nightsLit, returnsLit, skyLit, onRevealLayout, onRevealScroll } =
    useTrendsReveal(loaded && !trends.empty, trends.count > 0);
  const handleScroll = useHeaderScroll(onRevealScroll);

  // For the collection: a day the dreamer looked into their own trends, by choice.
  const noteExploration = useCallback(() => {
    if (!trends.empty) recordBadgeEvent({ type: 'trends_explored', now: Date.now() });
  }, [trends.empty]);

  const choosePeriod = useCallback((next: DreamTrendsPeriod) => {
    if (next === period) return;
    setPeriod(next);
    noteExploration();
  }, [noteExploration, period]);

  const chooseTheme = useCallback((theme: DreamTheme) => {
    setSelectedTheme((current) => (current === theme ? null : theme));
    noteExploration();
  }, [noteExploration]);

  const chooseSymbol = useCallback((key: string | null) => {
    setOpenSymbol(key);
    if (key !== null) noteExploration();
  }, [noteExploration]);

  const openDream = useCallback((dream: DreamAnalysis) => {
    router.push({ pathname: '/journal/[id]', params: getDreamRouteParams(dream) });
  }, []);

  // A formed week opens the journal on its Monday to its Sunday.
  const openWeek = useCallback((week: WeekNights) => {
    router.navigate({
      pathname: '/(tabs)/journal',
      params: toJournalFilterParams({ from: getLocalDateKey(week.start), to: getLocalDateKey(week.end - 1) }, String(Date.now())),
    });
  }, []);

  const capture = useCallback(() => {
    router.push('/recording');
  }, []);

  const header = (
    <NoctaliaScreenHeader
      scene="astral"
      titleKey="trends.title"
      variant="tab"
      immersive
      actions={[
        {
          icon: 'gear',
          onPress: openQuickSettings,
          accessibilityLabel: t('nav.settings'),
          testID: TID.Button.HeaderTrendsSettings,
        },
      ]}
    />
  );

  if (!loaded) {
    const loadingMessage = (
      <View className={`${scrollHeader ? 'shrink-0' : 'flex-1'} items-center justify-center px-6`} accessibilityLiveRegion="polite">
        <Text className="text-body font-sans text-ivory-muted text-center">
          {t('trends.loading')}
        </Text>
      </View>
    );
    return (
      <View className="flex-1 bg-ink" accessible accessibilityRole="progressbar" accessibilityLabel={t('trends.loading')}>
        {scrollHeader ? (
          <HeaderScrollView
            className="flex-1"
            onScroll={onHeaderScroll}
            scrollEventThrottle={16}
            style={{ marginBottom: navigationClearance }}
            contentInsetAdjustmentBehavior="never"
            contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
          >
            {header}
            {loadingMessage}
          </HeaderScrollView>
        ) : (
          <>
            {header}
            {loadingMessage}
          </>
        )}
      </View>
    );
  }

  const ink = noctalia.accent.text;
  const shownTheme = selectedTheme ?? trends.themes.dominant;
  const shownCount = shownTheme ? trends.themes.counts[shownTheme] : 0;
  const shortDate = (value: number) => formatDate(value, { day: 'numeric', month: 'short' });
  const rangeLabel = trends.period === 'all'
    ? t('trends.range.since', { date: formatDate(trends.range.start, { day: 'numeric', month: 'short', year: 'numeric' }) })
    : t('trends.range', { start: shortDate(trends.range.start), end: shortDate(trends.range.end) });
  const monthYear = (value: number) => formatDate(value, { month: 'short', year: 'numeric' });
  // The foot of the seal is short: the whole journal is told in months there.
  const sealDates = trends.period !== 'all'
    ? t('trends.range', { start: shortDate(trends.range.start), end: shortDate(trends.range.end) })
    : monthYear(trends.range.start) === monthYear(trends.range.end)
      ? monthYear(trends.range.end)
      : t('trends.range', { start: monthYear(trends.range.start), end: monthYear(trends.range.end) });
  // The journal's age as it is: nights for its first two weeks, then whole weeks.
  const journalNights = trends.range.nights;
  const journalWeeks = Math.floor(journalNights / 7);
  const compareLabel = trends.period === 'all'
    ? journalNights < 14
      ? t(journalNights === 1 ? 'trends.compare.all_nights_one' : 'trends.compare.all_nights', { count: formatNumber(journalNights) })
      : t('trends.compare.all', { count: formatNumber(journalWeeks) })
    : trends.countDelta != null ? t(`trends.compare.${trends.period}`) : null;

  // Each section is its own element: one that lights or changes redraws only itself.
  const periodSection = (
    <View className="gap-5" testID="trends.section.period" accessible={false} accessibilityRole="none">
      <TrendsPeriodSwitch period={period} onChange={choosePeriod} reduced={reduced} t={t} />
      <View className="flex-row items-start gap-3">
        <View className="mt-[9px] h-px w-[22px] bg-champagne" />
        <Text testID="trends.range" className="min-w-0 shrink text-caption leading-[18px] font-sans-medium uppercase tracking-[1.6px] text-champagne-on">
          {[rangeLabel, compareLabel].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <TrendsFigures trends={trends} entrance reduced={reduced} stacked={largeText}
        t={t} formatNumber={formatNumber} formatDate={formatDate} />
    </View>
  );

  const sealSection = (
    <View className="items-center gap-4" testID="trends.section.seal" accessible={false} accessibilityRole="none">
      <PeriodSeal
        counts={trends.themes.counts}
        shown={shownTheme}
        selected={selectedTheme}
        onSelect={chooseTheme}
        legend={shownTheme ? t('trends.seal.legend', {
          theme: getDreamThemeLabel(shownTheme, t) ?? shownTheme,
          count: formatNumber(shownCount),
          total: formatNumber(trends.count),
        }) : null}
        dates={sealDates}
        medalLabel={(theme) => {
          const count = trends.themes.counts[theme];
          return t(count === 0 ? 'trends.seal.medal_zero' : count === 1 ? 'trends.seal.medal_one' : 'trends.seal.medal', {
            theme: getDreamThemeLabel(theme, t) ?? theme,
            count: formatNumber(count),
          });
        }}
        ink={ink}
        glow={noctalia.atmosphere.glow}
        star={noctalia.atmosphere.star}
        entrance
        reduced={reduced}
        size={sealSize}
      />
      <Text testID="trends.seal.sentence" accessibilityLiveRegion="polite"
        className="max-w-[420px] text-center text-h3 leading-[26px] font-display text-ivory">
        {sealSentence(trends, selectedTheme, t, formatNumber)}
      </Text>
      {shownTheme && shownCount > 0 ? (
        <PressableScale testID="trends.seal.open" haptic="light" accessibilityRole="button"
          onPress={() => openJournal(trends, { theme: shownTheme })}
          className="min-h-[48px] flex-row items-center gap-2 rounded-full border border-champagne-soft px-5">
          <Text className="text-body font-sans-bold text-champagne-on">
            {t(shownCount === 1 ? 'trends.seal.open_one' : 'trends.seal.open', { count: formatNumber(shownCount) })}
          </Text>
          <IconSymbol name="arrow.right" size={14} color={ink} />
        </PressableScale>
      ) : null}
      {!selectedTheme && trends.themes.dominant ? (
        <Text className="text-center text-caption font-sans text-ivory-muted">{t('trends.seal.hint')}</Text>
      ) : null}
    </View>
  );

  const nightsSection = (
    <View ref={nightsRef} collapsable={false} onLayout={onRevealLayout} className="border-t border-line pt-7">
      <TrendsNights trends={trends} lit={nightsLit} reduced={reduced} ink={ink} onAccent={noctalia.action.primaryText}
        t={t} formatDate={formatDate} formatNumber={formatNumber} locale={locale}
        onOpenDream={openDream} onCapture={capture} />
    </View>
  );

  const returnsSection = (
    <View ref={returnsRef} collapsable={false} onLayout={onRevealLayout} className="border-t border-line pt-7">
      <TrendsReturns trends={trends} symbols={periodSymbols} lit={returnsLit || reduced} ink={ink} t={t}
        formatNumber={formatNumber}
        onOpenUnanalyzed={() => openJournal(trends, { analysis: 'unanalyzed' })}
        onOpenType={(type: DreamType) => openJournal(trends, { dreamType: type, analysis: 'analyzed' })}
        onOpenSymbol={chooseSymbol}
        plusHint={analysesUsedUp && trends.patterns.unrequested > 0 ? {
          text: t(trends.patterns.unrequested === 1 ? 'trends.returns.plus_hint_one' : 'trends.returns.plus_hint', {
            date: formatQuotaResetDate(locale),
            count: formatNumber(trends.patterns.unrequested),
          }),
          cta: t('trends.returns.plus_cta'),
          onPress: () => router.push(buildPaywallHref('stats_profile')),
        } : undefined} />
    </View>
  );

  const skySection = trends.count > 0 ? (
    <View ref={skyRef} collapsable={false} onLayout={onRevealLayout} className="border-t border-line pt-7">
      <TrendsSky sky={sky} lit={skyLit} reduced={reduced} ink={ink} glow={noctalia.atmosphere.glow}
        glowOpacity={noctalia.atmosphere.glowOpacity} dust={noctalia.atmosphere.particle} silver={noctalia.fullMoon.rim}
        t={t} formatNumber={formatNumber}
        formatDate={formatDate} onOpenDream={openDream} />
    </View>
  ) : null;

  const constellationsSection = (
    <View className="border-t border-line pt-7">
      <TrendsConstellations weeks={formedWeeks} goal={CONSTELLATION_NIGHTS} ink={ink} dust={noctalia.text.tertiary}
        t={t} formatNumber={formatNumber}
        nameOf={(week) => weekNames.get(week.start) ?? ''}
        datesOf={(week) => t('trends.range', { start: shortDate(week.start), end: shortDate(week.end - 1) })}
        onOpenWeek={openWeek} />
    </View>
  );

  // Letters are kept with an account; a guest is told what one would add to the trends.
  const moonLettersSection = user ? (
    <View className="border-t border-line pt-7">
      <TrendsMoonLetters t={t} chevron={noctalia.text.tertiary} onOpen={() => router.push(MOON_LETTER_ROUTE)} />
    </View>
  ) : <GuestAccountRow reason="trends" />;

  return (
    <View className="flex-1 bg-ink" testID="screen.trends">
      <HeaderScrollView
        className="flex-1"
        onScroll={handleScroll}
        onLayout={onRevealLayout}
        onContentSizeChange={onRevealLayout}
        scrollEventThrottle={16}
        style={scrollHeader ? { marginBottom: navigationClearance } : undefined}
        // The header scrolls away with the content, as on Today. It already owns
        // the top safe-area padding, so iOS must not add that inset again.
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        {header}
        <ScreenContainer key="resources">
          <JournalCompletenessNotice status={completeness?.status} trends onRetry={() => { void reloadDreams(); }} />
          {trends.empty ? (
            <View className="items-center gap-5 px-6 pb-5 pt-10" testID="trends.empty">
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Svg width={44} height={44}>
                  <Path d={sparklePath(22, 22, 20)} fill={ink} />
                </Svg>
              </View>
              <Text className="max-w-[320px] text-center text-h3 leading-[26px] font-display-semibold text-ivory">
                {t('trends.empty.body')}
              </Text>
              <PressableScale testID="trends.cta.primary" onPress={capture} haptic="light" accessibilityRole="button"
                accessibilityLabel={t('trends.empty.cta')}
                className="min-h-[50px] items-center justify-center rounded-[18px] border border-champagne-soft bg-champagne px-[22px]">
                <Text className="text-body font-sans-bold text-on-champagne">{t('trends.empty.cta')}</Text>
              </PressableScale>
            </View>
          ) : (
            <View className="gap-8 px-5 pb-5 pt-2">
              {periodSection}
              <View className="gap-8" pointerEvents={catchingUp ? 'none' : 'auto'}>
                {sealSection}
                {nightsSection}
                {returnsSection}
                {skySection}
                {constellationsSection}
                {moonLettersSection}
              </View>
              {compact ? <View testID="trends.layout.compact" /> : null}
            </View>
          )}
        </ScreenContainer>
      </HeaderScrollView>
      {symbolIndex ? (
        <DreamSymbolSheet index={symbolIndex} dream={null} linkKey={openSymbol} onSelect={setOpenSymbol}
          onClose={() => setOpenSymbol(null)} />
      ) : null}
    </View>
  );
}

export default withHeaderScroll(StatisticsScreen);
