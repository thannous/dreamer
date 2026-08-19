import { UpsellCard } from '@/components/guest/UpsellCard';
import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { PageHeaderContent } from '@/components/inspiration/PageHeader';
import { MockNavigationRail } from '@/components/dev/MockNavigationRail';
import { AdvancedFilterSheet, type JournalSortOrder } from '@/components/journal/AdvancedFilterSheet';
import { AtlasDreamRow } from '@/components/journal/AtlasDreamRow';
import { DateRangePicker } from '@/components/journal/DateRangePicker';
import { DreamCard } from '@/components/journal/DreamCard';
import { EmptyState } from '@/components/journal/EmptyState';
import { FilterBar } from '@/components/journal/FilterBar';
import { PressableScale } from '@/components/motion';
import { NoctaliaScreenHeader, type NoctaliaHeaderChip } from '@/components/NoctaliaScreenHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { JOURNAL_LIST } from '@/constants/appConfig';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import {
  DESKTOP_BREAKPOINT,
  LAYOUT_MAX_WIDTH,
  TABLET_BREAKPOINT,
  getBottomNavigationLayout,
} from '@/constants/layout';
import { useDreams } from '@/context/DreamsContext';
import { ScrollPerfProvider } from '@/context/ScrollPerfContext';
import { useTheme } from '@/context/ThemeContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useJournalLayoutPreference } from '@/hooks/useJournalLayoutPreference';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useTranslation } from '@/hooks/useTranslation';
import { blurActiveElement } from '@/lib/accessibility';
import { applyFilters, getUniqueDreamTypes, getUniqueThemes, sortDreamsByDate } from '@/lib/dreamFilters';
import { getDreamThemeLabel, getDreamTypeLabel } from '@/lib/dreamLabels';
import { isDreamAnalyzed, isDreamExplored } from '@/lib/dreamUsage';
import { getDreamThumbnailUri, preloadImage } from '@/lib/imageUtils';
import { trackProductEvent } from '@/lib/analytics';
import { TID } from '@/lib/testIDs';
import type { DreamAnalysis, DreamTheme, DreamType } from '@/lib/types';
import { FlashList, type FlashListRef, type ListRenderItemInfo } from '@shopify/flash-list';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  Text,
  type TextInput,
  View,
  type ViewToken,
  useWindowDimensions,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

const SCROLL_IDLE_MS = 140;
const PREFETCH_CACHE_LIMIT = 250;
const PREFETCH_MAX_PER_FLUSH = 8;

/**
 * FlashList owns these through props that take a style object, and the desktop max
 * width comes from a TS constant, so both stay in TypeScript.
 */
const DESKTOP_MAX_WIDTH_STYLE = { alignSelf: 'center', width: '100%', maxWidth: LAYOUT_MAX_WIDTH } as const;
const LIST_CONTENT_STYLE = { paddingHorizontal: ThemeLayout.spacing.md } as const;
const LIST_CONTENT_ATLAS_STYLE = { paddingHorizontal: ThemeLayout.spacing.lg } as const;

const MODAL_OPTION_CLASS = 'mb-2 rounded-sm border px-4 py-3';
const MODAL_OPTION_TEXT_CLASS = 'text-center font-sans-medium text-[16px] capitalize';
const MODAL_CHECK_BADGE_CLASS =
  'absolute right-4 top-1/2 h-[22px] w-[22px] -translate-y-[11px] items-center justify-center rounded-full bg-ink-raised';

const isLikelyOptimizedThumbnailUri = (uri: string): boolean => {
  // Supabase thumbnails use a `-thumb` filename suffix (see `services/supabaseDreamService.ts`).
  if (uri.includes('-thumb')) return true;
  // Cloudinary transforms often include w_/h_ in path.
  if (uri.includes('cloudinary.com') && uri.includes('/upload/') && (uri.includes('w_') || uri.includes('h_'))) return true;
  // Firebase/GCS uses a size query (if supported by the host).
  if (uri.includes('size=')) return true;
  // Imgur "small square" suffix.
  if (/[a-zA-Z0-9]s\.(png|jpe?g|webp)(\?|$)/.test(uri)) return true;
  return false;
};

export default function JournalListScreen() {
  const { dreams } = useDreams();
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  useClearWebFocus();
  const { formatDate, formatShortDate: formatDreamListDate } = useLocaleFormatting();
  const flatListRef = useRef<FlashListRef<DreamAnalysis>>(null);
  const searchInputRef = useRef<TextInput>(null);
  const pendingSearchFocusRef = useRef(false);
  const { width, height } = useWindowDimensions();
  const { preference: journalLayoutPreference } = useJournalLayoutPreference();

  const isWeb = Platform.OS === 'web';
  const isDesktopLayout = isWeb && width >= DESKTOP_BREAKPOINT;
  const isTabletLayout = !isDesktopLayout && width >= TABLET_BREAKPOINT;
  const useAtlasHeader = !isDesktopLayout && !isTabletLayout;
  const isAtlasLayout = journalLayoutPreference === 'compact' && !isDesktopLayout && !isTabletLayout;
  const isCompactJournalFilters = !isDesktopLayout && !isTabletLayout;
  const desktopColumns = width >= 1440 ? 4 : 3;
  const navigationLayout = getBottomNavigationLayout(width, height);

  const [showHeaderAnimations, setShowHeaderAnimations] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setShowHeaderAnimations(true);
      return () => setShowHeaderAnimations(false);
    }, []),
  );

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedTheme, setSelectedTheme] = useState<DreamTheme | null>(null);
  const [selectedDreamType, setSelectedDreamType] = useState<DreamType | null>(null);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showAnalyzedOnly, setShowAnalyzedOnly] = useState(false);
  const [showExploredOnly, setShowExploredOnly] = useState(false);
  const [showRememberedOnly, setShowRememberedOnly] = useState(false);
  const [showNeedsExplorationOnly, setShowNeedsExplorationOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<JournalSortOrder>('newest');
  const [showAtlasSearch, setShowAtlasSearch] = useState(false);

  const focusSearchInput = useCallback(() => {
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      setTimeout(() => searchInputRef.current?.focus(), 80);
    });
  }, []);

  const handleAtlasSearchPress = useCallback(() => {
    pendingSearchFocusRef.current = true;
    setShowAtlasSearch(true);
    focusSearchInput();
  }, [focusSearchInput]);

  useEffect(() => {
    if (!pendingSearchFocusRef.current || !(showAtlasSearch || searchQuery.length > 0)) {
      return;
    }
    pendingSearchFocusRef.current = false;
    focusSearchInput();
  }, [focusSearchInput, searchQuery.length, showAtlasSearch]);

  // Modal states
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  useEffect(() => {
    if (showThemeModal || showDateModal || showAdvancedFilters) {
      blurActiveElement();
    }
  }, [showAdvancedFilters, showDateModal, showThemeModal]);

  const prefetchedImageUrisRef = useRef(new Set<string>());
  const isNavigatingRef = useRef(false);
  const viewableRangeRef = useRef<{ min: number; max: number } | null>(null);
  const viewabilityConfigRef = useRef({
    itemVisiblePercentThreshold: JOURNAL_LIST.VIEWABILITY_THRESHOLD,
    minimumViewTime: JOURNAL_LIST.MINIMUM_VIEW_TIME,
  });

  const isScrollingRef = useRef(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollIdleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setScrolling = useCallback((next: boolean) => {
    if (isScrollingRef.current === next) return;
    isScrollingRef.current = next;
    setIsScrolling(next);
  }, []);

  const listBottomPadding = isDesktopLayout
    ? ThemeLayout.spacing.xl
    : navigationLayout.barHeight
      + navigationLayout.minimumBottomInset
      + ThemeLayout.spacing.lg;
  const listContentStyle = useMemo(
    () => [LIST_CONTENT_STYLE, { paddingBottom: listBottomPadding }],
    [listBottomPadding]
  );
  const listContentAtlasStyle = useMemo(
    () => [LIST_CONTENT_ATLAS_STYLE, { paddingBottom: listBottomPadding }],
    [listBottomPadding]
  );
  const listContentDesktopStyle = useMemo(
    () => [LIST_CONTENT_STYLE, DESKTOP_MAX_WIDTH_STYLE, { paddingBottom: listBottomPadding }],
    [listBottomPadding]
  );
  const listExtraData = useMemo(
    () => ({ isAtlasLayout, isScrolling }),
    [isAtlasLayout, isScrolling],
  );

  // Get available themes
  const availableThemes = useMemo(() => getUniqueThemes(dreams), [dreams]);
  const availableDreamTypes = useMemo(() => getUniqueDreamTypes(dreams), [dreams]);

  // Apply filters. `useDreamPersistence` stores dreams newest-first and filtering preserves order,
  // so avoid a redundant sort/copy in this hot path.
  const resolveDreamMemorySearchLabel = useCallback(
    (field: 'kind' | 'period' | 'fragment' | 'origin', value: string) => {
      const key = field === 'origin'
        ? 'recording.activation_insight.signal.memory'
        : `recording.remembered_profile.${field}.${value}`;
      const label = t(key);
      return label === key ? undefined : label;
    },
    [t]
  );

  const filteredDreams = useMemo(() => {
    const baseDreams = applyFilters(dreams, {
      searchQuery: deferredSearchQuery,
      theme: selectedTheme,
      dreamType: selectedDreamType,
      startDate: dateRange.start,
      endDate: dateRange.end,
      favoritesOnly: showFavoritesOnly,
      analyzedOnly: showAnalyzedOnly,
      exploredOnly: showExploredOnly,
      rememberedOnly: showRememberedOnly,
    }, {
      searchOptions: {
        dreamTypeLabelResolver: (dreamType) => getDreamTypeLabel(dreamType, t),
        dreamMemoryLabelResolver: resolveDreamMemorySearchLabel,
      },
    });

    const orderedDreams = showNeedsExplorationOnly
      ? baseDreams.filter((dream) => isDreamAnalyzed(dream) && !isDreamExplored(dream))
      : baseDreams;

    // Stored order is newest-first; only the opposite order needs a sort.
    return sortOrder === 'oldest' ? sortDreamsByDate(orderedDreams, true) : orderedDreams;
  }, [
    dreams,
    deferredSearchQuery,
    selectedTheme,
    selectedDreamType,
    dateRange,
    showFavoritesOnly,
    showAnalyzedOnly,
    showExploredOnly,
    showRememberedOnly,
    showNeedsExplorationOnly,
    resolveDreamMemorySearchLabel,
    t,
    sortOrder,
  ]);

  const rememberPrefetchedUri = useCallback((uri: string): boolean => {
    const cache = prefetchedImageUrisRef.current;
    if (cache.has(uri)) return false;
    cache.add(uri);
    while (cache.size > PREFETCH_CACHE_LIMIT) {
      const oldest = cache.values().next().value as string | undefined;
      if (!oldest) break;
      cache.delete(oldest);
    }
    return true;
  }, []);

  // Preload first items to warm expo-image cache (no setState during scroll)
  useEffect(() => {
    prefetchedImageUrisRef.current.clear();
    const initial = filteredDreams.slice(0, JOURNAL_LIST.INITIAL_VISIBLE_COUNT + JOURNAL_LIST.PRELOAD_BUFFER);
    initial.forEach((dream) => {
      const thumbnailUri = getDreamThumbnailUri(dream);
      if (!thumbnailUri) {
        return;
      }
      if (!isLikelyOptimizedThumbnailUri(thumbnailUri)) {
        return;
      }
      if (!rememberPrefetchedUri(thumbnailUri)) {
        return;
      }
      void preloadImage(thumbnailUri);
    });
  }, [filteredDreams, rememberPrefetchedUri]);

  // Scroll to top when filters change
  useEffect(() => {
    if (filteredDreams.length > 0) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    deferredSearchQuery,
    selectedTheme,
    selectedDreamType,
    dateRange,
    showFavoritesOnly,
    showAnalyzedOnly,
    showExploredOnly,
    showRememberedOnly,
    showNeedsExplorationOnly,
  ]);

  useFocusEffect(
    useCallback(() => {
      isNavigatingRef.current = false;
    }, [])
  );

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedTheme(null);
    setSelectedDreamType(null);
    setDateRange({ start: null, end: null });
    setShowFavoritesOnly(false);
    setShowAnalyzedOnly(false);
    setShowExploredOnly(false);
    setShowRememberedOnly(false);
    setShowNeedsExplorationOnly(false);
    setSortOrder('newest');
  }, []);

  const toggleThemeFilter = useCallback((theme: DreamTheme) => {
    setSelectedTheme(theme === selectedTheme ? null : theme);
  }, [selectedTheme]);

  const toggleDreamTypeFilter = useCallback((dreamType: DreamType) => {
    setSelectedDreamType((current) => (dreamType === current ? null : dreamType));
  }, []);

  const handleThemeSelect = useCallback((theme: DreamTheme) => {
    toggleThemeFilter(theme);
    setShowThemeModal(false);
  }, [toggleThemeFilter]);

  const handleDreamTypeSelect = useCallback((dreamType: DreamType) => {
    toggleDreamTypeFilter(dreamType);
    setShowThemeModal(false);
  }, [toggleDreamTypeFilter]);

  const handleDateRangeChange = useCallback((start: Date | null, end: Date | null) => {
    setDateRange({ start, end });
  }, []);

  const handleFavoritesToggle = useCallback(() => {
    setShowFavoritesOnly((prev) => !prev);
  }, []);

  const handleAnalyzedToggle = useCallback(() => {
    setShowAnalyzedOnly((prev) => !prev);
  }, []);

  const handleExploredToggle = useCallback(() => {
    setShowExploredOnly((prev) => !prev);
  }, []);

  const handleRememberedToggle = useCallback(() => {
    setShowRememberedOnly((prev) => !prev);
  }, []);

  const handleNeedsExplorationToggle = useCallback(() => {
    setShowNeedsExplorationOnly((prev) => !prev);
  }, []);

  const handleRecurringToggle = useCallback(() => {
    setSelectedDreamType((current) => (current === 'Recurring Dream' ? null : 'Recurring Dream'));
  }, []);

  const handleNightmareToggle = useCallback(() => {
    setSelectedDreamType((current) => (current === 'Nightmare' ? null : 'Nightmare'));
  }, []);

  const handleDreamPress = useCallback((dreamId: number) => {
    if (isNavigatingRef.current) {
      return;
    }
    isNavigatingRef.current = true;
    router.push(`/journal/${dreamId}`);
  }, []);

  // Track viewable items and prefetch thumbnails once scrolling is idle.
  const filteredDreamsRef = useRef(filteredDreams);
  useEffect(() => {
    filteredDreamsRef.current = filteredDreams;
  }, [filteredDreams]);

  interface ViewabilityInfo {
    viewableItems: ViewToken[];
    changed: ViewToken[];
  }

  const flushPrefetch = useCallback(async () => {
    if (isScrollingRef.current) return;

    const range = viewableRangeRef.current;
    const currentFilteredDreams = filteredDreamsRef.current;
    if (!range || currentFilteredDreams.length === 0) return;

    const start = Math.max(0, range.min - JOURNAL_LIST.PRELOAD_BUFFER);
    const end = Math.min(currentFilteredDreams.length - 1, range.max + JOURNAL_LIST.PRELOAD_BUFFER);
    const urisToPrefetch: string[] = [];

    for (let idx = start; idx <= end && urisToPrefetch.length < PREFETCH_MAX_PER_FLUSH; idx++) {
      const dream = currentFilteredDreams[idx];
      const thumbnailUri = getDreamThumbnailUri(dream);
      if (!thumbnailUri) continue;
      if (!isLikelyOptimizedThumbnailUri(thumbnailUri)) continue;
      if (!rememberPrefetchedUri(thumbnailUri)) continue;
      urisToPrefetch.push(thumbnailUri);
    }

    for (const uri of urisToPrefetch) {
      await preloadImage(uri);
    }
  }, [rememberPrefetchedUri]);

  const onViewableItemsChanged = useRef(({ viewableItems }: ViewabilityInfo) => {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    viewableItems.forEach((item) => {
      if (typeof item.index !== 'number') {
        return;
      }
      if (item.index < min) min = item.index;
      if (item.index > max) max = item.index;
    });

    if (min !== Number.POSITIVE_INFINITY && max !== Number.NEGATIVE_INFINITY) {
      viewableRangeRef.current = { min, max };
    }
  }).current;

  const scheduleIdle = useCallback(() => {
    if (scrollIdleTimeoutRef.current) {
      clearTimeout(scrollIdleTimeoutRef.current);
    }

    scrollIdleTimeoutRef.current = setTimeout(() => {
      setScrolling(false);
      void flushPrefetch();
    }, SCROLL_IDLE_MS);
  }, [flushPrefetch, setScrolling]);

  const handleScrollBegin = useCallback(() => {
    setScrolling(true);
    if (scrollIdleTimeoutRef.current) {
      clearTimeout(scrollIdleTimeoutRef.current);
    }
  }, [setScrolling]);

  useEffect(() => {
    return () => {
      if (scrollIdleTimeoutRef.current) {
        clearTimeout(scrollIdleTimeoutRef.current);
      }
    };
  }, []);

  // No `entering` on a row: FlashList recycles them, so an entrance replays on every
  // scroll. The list itself is the thing that appeared, and it appeared with the screen.
  const renderDreamItem = useCallback(({ item, index }: ListRenderItemInfo<DreamAnalysis>) => {
    const dreamTypeLabel = item.dreamType ? getDreamTypeLabel(item.dreamType, t) ?? item.dreamType : null;
    const dateStr = formatDreamListDate(item.id) + (dreamTypeLabel ? ` • ${dreamTypeLabel}` : '');
    const isFirstItem = index === 0;

    if (isAtlasLayout) {
      const monthLabel = formatDate(item.id, { month: 'short', year: 'numeric' }).replace('.', '').toUpperCase();
      const previousDream = filteredDreams[index - 1];
      const previousMonthLabel = previousDream
        ? formatDate(previousDream.id, { month: 'short', year: 'numeric' }).replace('.', '').toUpperCase()
        : null;
      const sectionLabel = index === 0 || monthLabel !== previousMonthLabel ? monthLabel : null;

      return (
        <AtlasDreamRow
          dream={item}
          onPress={handleDreamPress}
          scrollState={isScrolling ? 'scrolling' : 'idle'}
          testID={TID.List.DreamItem(item.id)}
          dateLabel={formatDreamListDate(item.id)}
          sectionLabel={sectionLabel}
        />
      );
    }

    return (
      <View className="mb-6">
        <DreamCard
          dream={item}
          onPress={handleDreamPress}
          scrollState={isScrolling ? 'scrolling' : 'idle'}
          testID={TID.List.DreamItem(item.id)}
          dateLabel={dateStr}
          variant={isFirstItem ? 'featured' : 'standard'}
        />
      </View>
    );
  }, [filteredDreams, formatDate, formatDreamListDate, t, handleDreamPress, isAtlasLayout, isScrolling]);

  const renderDreamItemTablet = useCallback(({ item }: ListRenderItemInfo<DreamAnalysis>) => {
    const dreamTypeLabel = item.dreamType ? getDreamTypeLabel(item.dreamType, t) ?? item.dreamType : null;
    const dateStr = formatDreamListDate(item.id) + (dreamTypeLabel ? ` • ${dreamTypeLabel}` : '');

    return (
      <View className="mb-4 flex-1 px-1">
        <DreamCard
          dream={item}
          onPress={handleDreamPress}
          scrollState={isScrolling ? 'scrolling' : 'idle'}
          testID={TID.List.DreamItem(item.id)}
          dateLabel={dateStr}
          variant="standard"
        />
      </View>
    );
  }, [formatDreamListDate, t, handleDreamPress, isScrolling]);

  const renderDreamItemDesktop = useCallback(({ item, index }: ListRenderItemInfo<DreamAnalysis>) => {
    const hasImage = !item.imageGenerationFailed && Boolean(item.thumbnailUrl || item.imageUrl);
    const isRecent = index < 3;
    const isFavorite = !!item.isFavorite;
    const isAnalyzed = isDreamAnalyzed(item);
    const dreamTypeLabel = item.dreamType ? getDreamTypeLabel(item.dreamType, t) ?? item.dreamType : null;

    const isHero = isRecent && hasImage;
    const weightClass = isHero
      ? 'flex-[2]'
      : isFavorite
        ? 'flex-[1.5]'
        : isAnalyzed
          ? 'flex-[1.3]'
          : hasImage
            ? 'flex-[1.2]'
            : 'flex-1';

    return (
      <View className={`mb-8 min-w-0 px-1 ${weightClass}`}>
        <View className="mb-1 flex-row items-center justify-between">
          <Text className="font-sans text-[14px] text-ivory-muted">
            {formatDreamListDate(item.id)}
            {dreamTypeLabel ? ` • ${dreamTypeLabel}` : ''}
          </Text>
        </View>
        <DreamCard
          dream={item}
          onPress={handleDreamPress}
          scrollState={isScrolling ? 'scrolling' : 'idle'}
          testID={TID.List.DreamItem(item.id)}
        />
      </View>
    );
  }, [formatDreamListDate, t, handleDreamPress, isScrolling]);

  const hasActiveFilter = !!(
    searchQuery ||
    selectedTheme ||
    selectedDreamType ||
    dateRange.start ||
    dateRange.end ||
    showFavoritesOnly ||
    showAnalyzedOnly ||
    showExploredOnly ||
    showRememberedOnly ||
    showNeedsExplorationOnly
  );
  const hasActiveNonSearchFilter = !!(
    selectedTheme ||
    selectedDreamType ||
    dateRange.start ||
    dateRange.end ||
    showFavoritesOnly ||
    showAnalyzedOnly ||
    showExploredOnly ||
    showRememberedOnly ||
    showNeedsExplorationOnly
  );
  const advancedFilterCount = Number(Boolean(selectedTheme)) + Number(Boolean(selectedDreamType)) + Number(Boolean(dateRange.start || dateRange.end));
  const advancedFilterLabel = advancedFilterCount > 0
    ? t('journal.filter.more_count', { count: advancedFilterCount })
    : t('journal.filter.more');
  const canStartRememberedDreamFromEmpty = dreams.length === 0 && !hasActiveFilter;
  const handleStartRememberedDreamFromEmpty = useCallback(() => {
    void trackProductEvent('empty_journal_remembered_cta_clicked', {
      source: 'journal_empty_state',
    });
    router.push({
      pathname: '/recording',
      params: { intent: 'remembered', source: 'journal' },
    });
  }, []);
  const advancedFiltersMaxHeight = Math.min(760, Math.max(420, Math.round(height * 0.86)));
  const journalFilterItems = useMemo(() => {
    if (isCompactJournalFilters) {
      return [
        {
          id: 'favorites' as const,
          label: t('journal.filter.favorites'),
          active: showFavoritesOnly,
          onPress: handleFavoritesToggle,
          testID: TID.Button.FilterFavorites,
        },
        {
          id: 'analyzed' as const,
          label: t('journal.filter.analyzed'),
          active: showAnalyzedOnly,
          onPress: handleAnalyzedToggle,
          testID: TID.Button.FilterAnalyzed,
        },
        {
          id: 'explored' as const,
          label: t('journal.filter.explored'),
          active: showExploredOnly,
          onPress: handleExploredToggle,
          testID: TID.Button.FilterExplored,
        },
        {
          id: 'more' as const,
          label: advancedFilterLabel,
          active: advancedFilterCount > 0,
          onPress: () => setShowAdvancedFilters(true),
          testID: TID.Button.FilterMore,
        },
      ];
    }

    return [
      {
        id: 'theme' as const,
        label: t('journal.filter.theme'),
        active: selectedTheme !== null || selectedDreamType !== null,
        onPress: () => setShowThemeModal(true),
        testID: TID.Button.FilterTheme,
      },
      {
        id: 'date' as const,
        label: t('journal.filter.date'),
        active: dateRange.start !== null || dateRange.end !== null,
        onPress: () => setShowDateModal(true),
        testID: TID.Button.FilterDate,
      },
      {
        id: 'favorites' as const,
        label: t('journal.filter.favorites'),
        active: showFavoritesOnly,
        onPress: handleFavoritesToggle,
        testID: TID.Button.FilterFavorites,
      },
      {
        id: 'analyzed' as const,
        label: t('journal.filter.analyzed'),
        active: showAnalyzedOnly,
        onPress: handleAnalyzedToggle,
        testID: TID.Button.FilterAnalyzed,
      },
      {
        id: 'explored' as const,
        label: t('journal.filter.explored'),
        active: showExploredOnly,
        onPress: handleExploredToggle,
        testID: TID.Button.FilterExplored,
      },
    ];
  }, [
    advancedFilterCount,
    advancedFilterLabel,
    dateRange.end,
    dateRange.start,
    handleAnalyzedToggle,
    handleExploredToggle,
    handleFavoritesToggle,
    isCompactJournalFilters,
    selectedDreamType,
    selectedTheme,
    showAnalyzedOnly,
    showExploredOnly,
    showFavoritesOnly,
    t,
  ]);
  const atlasQuickFilters = useMemo<NoctaliaHeaderChip[]>(() => [
    {
      id: 'favorites',
      label: t('journal.filter.favorites'),
      icon: 'heart',
      active: showFavoritesOnly,
      onPress: handleFavoritesToggle,
      accessibilityLabel: t('journal.filter.accessibility.favorites'),
      testID: TID.Button.FilterFavorites,
    },
    {
      id: 'remembered',
      label: t('recording.activation_insight.signal.memory'),
      icon: 'moon.stars.fill',
      active: showRememberedOnly,
      onPress: handleRememberedToggle,
      accessibilityLabel: t('recording.activation_insight.signal.memory'),
    },
    {
      id: 'to-explore',
      label: t('journal.atlas.filter.to_explore'),
      icon: 'sparkles',
      active: showNeedsExplorationOnly,
      onPress: handleNeedsExplorationToggle,
      accessibilityLabel: t('journal.atlas.filter.to_explore'),
    },
    {
      id: 'analyzed',
      label: t('journal.filter.analyzed'),
      icon: 'brain',
      active: showAnalyzedOnly,
      onPress: handleAnalyzedToggle,
      accessibilityLabel: t('journal.filter.accessibility.analyzed'),
      testID: TID.Button.FilterAnalyzed,
    },
    {
      id: 'recurring',
      label: t('journal.atlas.filter.recurring'),
      icon: 'arrow.triangle.2.circlepath',
      active: selectedDreamType === 'Recurring Dream',
      onPress: handleRecurringToggle,
      accessibilityLabel: t('journal.atlas.filter.recurring'),
    },
    {
      id: 'nightmares',
      label: t('journal.atlas.filter.nightmares'),
      icon: 'moon.stars.fill',
      active: selectedDreamType === 'Nightmare',
      onPress: handleNightmareToggle,
      accessibilityLabel: t('journal.atlas.filter.nightmares'),
    },
  ], [
    handleAnalyzedToggle,
    handleFavoritesToggle,
    handleRememberedToggle,
    handleNeedsExplorationToggle,
    handleNightmareToggle,
    handleRecurringToggle,
    selectedDreamType,
    showAnalyzedOnly,
    showFavoritesOnly,
    showRememberedOnly,
    showNeedsExplorationOnly,
    t,
  ]);
  const renderEmptyState = useCallback(() => (
    <EmptyState
      hasActiveFilter={hasActiveFilter}
      onClearFilters={handleClearFilters}
      onStartRememberedDream={
        canStartRememberedDreamFromEmpty ? handleStartRememberedDreamFromEmpty : undefined
      }
    />
  ), [
    canStartRememberedDreamFromEmpty,
    handleClearFilters,
    handleStartRememberedDreamFromEmpty,
    hasActiveFilter,
  ]);

  const keyExtractor = useCallback((item: DreamAnalysis) => String(item.id), []);
  const getDreamItemType = useCallback((item: DreamAnalysis | undefined, index: number) => {
    if (isAtlasLayout) {
      return 'atlas-row';
    }
    if (!item) {
      // FlashList can query item types during layout passes where data isn't resolved yet.
      return 'text-only';
    }
    if (index === 0) {
      return 'featured';
    }
    return !item.imageGenerationFailed && (item.thumbnailUrl || item.imageUrl)
      ? 'with-image'
      : 'text-only';
  }, [isAtlasLayout]);

  return (
    <ScrollPerfProvider isScrolling={isScrolling}>
      <View className="flex-1 bg-ink" testID={TID.Screen.Journal}>
        {/* Atmospheric dreamlike background */}
        <AtmosphericBackground variant="subtle" />

        {useAtlasHeader ? (
          <NoctaliaScreenHeader
            titleKey="nav.journal"
            chips={atlasQuickFilters}
            actions={[
              {
                icon: 'magnifyingglass',
                onPress: handleAtlasSearchPress,
                accessibilityLabel: t('journal.atlas.search'),
                active: showAtlasSearch || searchQuery.length > 0,
                testID: TID.Button.FilterSearch,
              },
              {
                icon: 'slider.horizontal.3',
                onPress: () => setShowAdvancedFilters(true),
                accessibilityLabel: t('journal.filter.accessibility.more'),
                active: hasActiveNonSearchFilter,
                testID: TID.Button.FilterMore,
              },
            ]}
            slot={
              showAtlasSearch || searchQuery.length > 0 ? (
                <SearchBar
                  autoFocus
                  ref={searchInputRef}
                  testID={TID.Component.SearchBar}
                  inputTestID={TID.Input.SearchDreams}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={t('journal.search_placeholder')}
                />
              ) : null
            }
          />
        ) : (
          <>
            {/* Header */}
            <PageHeaderContent
              titleKey="journal.title"
              animationSeed={showHeaderAnimations ? 1 : 0}
              style={isDesktopLayout ? DESKTOP_MAX_WIDTH_STYLE : undefined}
            />

            {/* Search and Filters */}
            <View
              className="gap-4 p-4"
              style={isDesktopLayout ? DESKTOP_MAX_WIDTH_STYLE : undefined}
            >
              <MockNavigationRail />
              {/* SearchBar */}
              <SearchBar
                testID={TID.Component.SearchBar}
                inputTestID={TID.Input.SearchDreams}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t('journal.search_placeholder')}
              />
              <FilterBar
                items={journalFilterItems}
                onClear={handleClearFilters}
                dateRange={dateRange}
                selectedTheme={selectedTheme}
                selectedDreamType={selectedDreamType}
                clearTestID={TID.Button.ClearFilters}
              />
              <PressableScale
                onPress={handleRememberedToggle}
                haptic="selection"
                accessibilityRole="button"
                accessibilityState={{ selected: showRememberedOnly }}
                accessibilityLabel={t('recording.activation_insight.signal.memory')}
                className={`flex-row items-center gap-1.5 self-start rounded-full border border-continuous px-3 py-2 ${
                  showRememberedOnly ? 'border-champagne-soft bg-champagne' : 'border-line bg-ink-soft'
                }`}
              >
                <IconSymbol
                  name="moon.stars.fill"
                  size={16}
                  color={showRememberedOnly ? noctalia.action.primaryText : noctalia.text.primary}
                />
                <Text
                  className={`font-sans-medium text-[14px] ${
                    showRememberedOnly ? 'text-on-champagne' : 'text-ivory'
                  }`}
                >
                  {t('recording.activation_insight.signal.memory')}
                </Text>
                {showRememberedOnly ? (
                  <IconSymbol name="checkmark" size={12} color={noctalia.action.primaryText} />
                ) : null}
              </PressableScale>
            </View>
          </>
        )}

      {/* Guest Upsell */}
      <View
        className="mb-2 px-4"
        style={isDesktopLayout ? DESKTOP_MAX_WIDTH_STYLE : undefined}
      >
        <UpsellCard />
      </View>

      {/* List */}
      {isDesktopLayout ? (
        <FlashList
          testID={TID.List.Dreams}
          ref={flatListRef}
          key={`desktop-${desktopColumns}`}
          data={filteredDreams}
          extraData={listExtraData}
          keyExtractor={keyExtractor}
          renderItem={renderDreamItemDesktop}
          // Perf: helps FlashList recycle views by layout type to reduce scroll-time layout work.
          getItemType={getDreamItemType}
          numColumns={desktopColumns}
          contentContainerStyle={listContentDesktopStyle}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          viewabilityConfig={viewabilityConfigRef.current}
          onViewableItemsChanged={onViewableItemsChanged}
          onScrollBeginDrag={handleScrollBegin}
          onScrollEndDrag={scheduleIdle}
          onMomentumScrollBegin={handleScrollBegin}
          onMomentumScrollEnd={scheduleIdle}
        />
      ) : (
        <FlashList
          testID={TID.List.Dreams}
          ref={flatListRef}
          key={isTabletLayout ? 'tablet-2col' : isAtlasLayout ? 'mobile-compact-1col' : 'mobile-cards-1col'}
          data={filteredDreams}
          extraData={listExtraData}
          keyExtractor={keyExtractor}
          renderItem={isTabletLayout ? renderDreamItemTablet : renderDreamItem}
          numColumns={isTabletLayout ? 2 : 1}
          // Perf: helps FlashList recycle views by layout type to reduce scroll-time layout work.
          getItemType={getDreamItemType}
          contentContainerStyle={isAtlasLayout ? listContentAtlasStyle : listContentStyle}
          contentInsetAdjustmentBehavior="automatic"
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          viewabilityConfig={viewabilityConfigRef.current}
          onViewableItemsChanged={onViewableItemsChanged}
          onScrollBeginDrag={handleScrollBegin}
          onScrollEndDrag={scheduleIdle}
          onMomentumScrollBegin={handleScrollBegin}
          onMomentumScrollEnd={scheduleIdle}
        />
      )}

      <AdvancedFilterSheet
        visible={showAdvancedFilters}
        onClose={() => setShowAdvancedFilters(false)}
        onClear={handleClearFilters}
        maxHeight={advancedFiltersMaxHeight}
        availableThemes={availableThemes}
        availableDreamTypes={availableDreamTypes}
        selectedTheme={selectedTheme}
        selectedDreamType={selectedDreamType}
        dateRange={dateRange}
        onThemeSelect={toggleThemeFilter}
        onDreamTypeSelect={toggleDreamTypeFilter}
        onDateRangeChange={handleDateRangeChange}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
      />

      {/* Theme Selection BottomSheet */}
      <BottomSheet
        visible={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        style={{ backgroundColor: noctalia.surface.raised }}
        testID={TID.Modal.Theme}
      >
        <Text className="mb-4 text-center font-sans-bold text-[20px] text-ivory">
          {t('journal.theme_modal.title')}
        </Text>
        <Text className="mb-4 text-center font-sans text-[14px] text-ivory-muted">
          {t('journal.detail.theme_label')}
        </Text>
        {availableThemes.map((theme) => (
          <PressableScale
            key={theme}
            className={`${MODAL_OPTION_CLASS} ${
              selectedTheme === theme ? 'border-champagne-soft bg-champagne' : 'border-line bg-ink-soft'
            }`}
            onPress={() => handleThemeSelect(theme)}
          >
            <Text
              className={`${MODAL_OPTION_TEXT_CLASS} ${
                selectedTheme === theme ? 'text-on-champagne' : 'text-ivory'
              }`}
            >
              {getDreamThemeLabel(theme, t) ?? theme}
            </Text>
            {selectedTheme === theme && (
              <View className="absolute inset-0">
                <View className={MODAL_CHECK_BADGE_CLASS}>
                  <IconSymbol name="checkmark" size={14} color={noctalia.accent.text} />
                </View>
              </View>
            )}
          </PressableScale>
        ))}
        <View style={{ height: 16 }} />
        <Text className="mb-4 text-center font-sans text-[14px] text-ivory-muted">
          {t('journal.detail.dream_type_label')}
        </Text>
        {availableDreamTypes.map((dreamType) => (
          <PressableScale
            key={dreamType}
            className={`${MODAL_OPTION_CLASS} ${
              selectedDreamType === dreamType ? 'border-champagne-soft bg-champagne' : 'border-line bg-ink-soft'
            }`}
            onPress={() => handleDreamTypeSelect(dreamType)}
          >
            <Text
              className={`${MODAL_OPTION_TEXT_CLASS} ${
                selectedDreamType === dreamType ? 'text-on-champagne' : 'text-ivory'
              }`}
            >
              {getDreamTypeLabel(dreamType, t) ?? dreamType}
            </Text>
            {selectedDreamType === dreamType && (
              <View className="absolute inset-0">
                <View className={MODAL_CHECK_BADGE_CLASS}>
                  <IconSymbol name="checkmark" size={14} color={noctalia.accent.text} />
                </View>
              </View>
            )}
          </PressableScale>
        ))}
        <Pressable
          className="mt-4 py-3"
          onPress={() => setShowThemeModal(false)}
        >
          <Text className="text-center font-sans-medium text-[16px] text-ivory-muted">
            {t('common.cancel')}
          </Text>
        </Pressable>
      </BottomSheet>

      {/* Date Range BottomSheet */}
      <BottomSheet
        visible={showDateModal}
        onClose={() => setShowDateModal(false)}
        style={{ backgroundColor: noctalia.surface.raised }}
        testID={TID.Modal.DateRange}
      >
        <DateRangePicker
          startDate={dateRange.start}
          endDate={dateRange.end}
          onRangeChange={handleDateRangeChange}
          onClose={() => setShowDateModal(false)}
        />
      </BottomSheet>
      </View>
    </ScrollPerfProvider>
  );
}
