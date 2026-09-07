import { UpsellCard } from '@/components/guest/UpsellCard';
import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { PageHeaderContent } from '@/components/inspiration/PageHeader';
import { MockNavigationRail } from '@/components/dev/MockNavigationRail';
import { AdvancedFilterSheet, type JournalSortOrder } from '@/components/journal/AdvancedFilterSheet';
import { DreamCard } from '@/components/journal/DreamCard';
import { EmptyState } from '@/components/journal/EmptyState';
import { JournalPersistenceNotice } from '@/components/journal/JournalPersistenceNotice';
import { FilterBar } from '@/components/journal/FilterBar';
import { PressableScale } from '@/components/motion';
import { SearchBar, searchBarLayout } from '@/components/ui/SearchBar';
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
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useTranslation } from '@/hooks/useTranslation';
import { blurActiveElement } from '@/lib/accessibility';
import { applyFilters, getUniqueDreamTypes, getUniqueThemes, sortDreamsByDate, type JournalAnalysisStatusFilter, type JournalQuickFilter } from '@/lib/dreamFilters';
import { getDreamTypeLabel } from '@/lib/dreamLabels';
import { isDreamAnalyzed } from '@/lib/dreamUsage';
import { getDreamThumbnailUri, preloadImage } from '@/lib/imageUtils';
import { trackProductEvent } from '@/lib/analytics';
import { TID } from '@/lib/testIDs';
import type { DreamAnalysis, DreamTheme, DreamType } from '@/lib/types';
import { FlashList, type FlashListRef, type ListRenderItemInfo } from '@shopify/flash-list';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  Text,
  type GestureResponderEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextInput,
  View,
  type ViewToken,
  useWindowDimensions,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

const SCROLL_IDLE_MS = 140;
const PREFETCH_CACHE_LIMIT = 250;
const PREFETCH_MAX_PER_FLUSH = 8;
const MIN_MOBILE_JOURNAL_LIST_VIEWPORT = 120;
const OVERLAY_SEARCH_DRAG_SLOP = 8;

/**
 * FlashList owns these through props that take a style object, and the desktop max
 * width comes from a TS constant, so both stay in TypeScript.
 */
const DESKTOP_MAX_WIDTH_STYLE = { alignSelf: 'center', width: '100%', maxWidth: LAYOUT_MAX_WIDTH } as const;
const LIST_CONTENT_STYLE = { paddingHorizontal: ThemeLayout.spacing.md } as const;

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

function getInitialKeyboardVisibility(): boolean {
  // RN Web 0.21's Keyboard shim does not implement isVisible.
  if (Platform.OS === 'web') {
    return false;
  }
  return typeof Keyboard.isVisible === 'function' ? Keyboard.isVisible() : false;
}

export default function JournalListScreen() {
  const { dreams, persistenceState, retryPersistence } = useDreams();
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  useClearWebFocus();
  const { formatShortDate: formatDreamListDate } = useLocaleFormatting();
  const flatListRef = useRef<FlashListRef<DreamAnalysis>>(null);
  const searchInputRef = useRef<TextInput>(null);
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isWeb = Platform.OS === 'web';
  const isDesktopLayout = isWeb && width >= DESKTOP_BREAKPOINT;
  const isTabletLayout = !isDesktopLayout && width >= TABLET_BREAKPOINT;
  const desktopColumns = width >= 1440 ? 4 : 3;
  const navigationLayout = getBottomNavigationLayout(width, height, fontScale);
  // Keep only the search input outside the column-keyed FlashList so rotation
  // across the tablet breakpoint does not remount it. The remaining header,
  // including the guest upsell, stays ListHeaderComponent so it can scroll away
  // on short landscape viewports.
  const scrollHeader = !isDesktopLayout;
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(getInitialKeyboardVisibility);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const navigationClearance = navigationLayout.barHeight + Math.max(insets.bottom, navigationLayout.minimumBottomInset);
  // The tab bar in app/(tabs)/_layout.tsx is position:absolute, so FlashList must
  // reserve the full overlay from the viewport. Capping marginBottom would leave
  // the remaining list box covered by the bar. Production SearchBar is 112dp at
  // fontScale 2 plus 16dp chrome and the top inset; when that would consume the
  // uncovered viewport, keep the input mounted outside the column-keyed list but
  // out of flow so the list can fill the space above the overlay. A header spacer
  // and scroll translation let a dream card move into that uncovered box.
  const mobileSearchHeaderHeight = isDesktopLayout
    ? 0
    : insets.top + ThemeLayout.spacing.sm + searchBarLayout(fontScale).minHeight + ThemeLayout.spacing.sm;
  const overlayNavClearance = isDesktopLayout || isKeyboardVisible ? 0 : navigationClearance;
  const viewportAboveNav = Math.max(0, height - overlayNavClearance);
  // iOS software keyboards overlay the window and do not shrink
  // useWindowDimensions(). Subtract that occlusion, and if iOS reports no
  // height keep search out of flow so results can still scroll.
  const keyboardAvoidedViewport = !isKeyboardVisible || Platform.OS !== 'ios'
    ? viewportAboveNav
    : keyboardHeight > 0
      ? Math.max(0, viewportAboveNav - keyboardHeight)
      : 0;
  const searchConsumesLayout = isDesktopLayout
    || keyboardAvoidedViewport - mobileSearchHeaderHeight >= MIN_MOBILE_JOURNAL_LIST_VIEWPORT;
  const searchLayoutKey = `${searchConsumesLayout ? 'flow' : 'overlay'}:${isTabletLayout ? 'tablet' : 'mobile'}`;
  // Column count, not overlay vs flow. Keyboard and viewport-height changes can
  // flip searchConsumesLayout without remounting FlashList or clearing its offset.
  const mobileListKey = isTabletLayout ? 'tablet-2col' : 'mobile-cards-1col';
  const [searchCollapse, setSearchCollapse] = useState({ key: searchLayoutKey, offset: 0 });
  if (searchCollapse.key !== searchLayoutKey) {
    // Comparing keys only hid a stale offset. Reinitialize so a rotation back
    // to overlay:tablet cannot reuse the previous layout's collapse.
    setSearchCollapse({ key: searchLayoutKey, offset: 0 });
  }
  const searchCollapseOffset = searchCollapse.key === searchLayoutKey ? searchCollapse.offset : 0;

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e: { endCoordinates?: { height?: number } }) => {
        setIsKeyboardVisible(true);
        setKeyboardHeight(e?.endCoordinates?.height ?? 0);
      },
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        setKeyboardHeight(0);
      },
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

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
  const [quickFilter, setQuickFilter] = useState<JournalQuickFilter>('all');
  const [showRememberedOnly, setShowRememberedOnly] = useState(false);
  const [showRecurringOnly, setShowRecurringOnly] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<JournalAnalysisStatusFilter | null>(null);
  const [sortOrder, setSortOrder] = useState<JournalSortOrder>('newest');

  // Modal states
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  useEffect(() => {
    if (showAdvancedFilters) {
      blurActiveElement();
    }
  }, [showAdvancedFilters]);

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
  const listScrollOffsetRef = useRef(0);
  const overlaySearchDragOriginRef = useRef({ pageX: 0, pageY: 0, offset: 0 });

  useLayoutEffect(() => {
    // The column-keyed FlashList remounts at offset 0 when this key changes.
    // Desktop unmounts that list while mobileListKey stays mobile-cards-1col,
    // so include the desktop switch. Keep the origin when only
    // searchConsumesLayout flips so a later overlay drag continues from the
    // retained list offset instead of jumping to the top.
    listScrollOffsetRef.current = 0;
  }, [mobileListKey, isDesktopLayout]);

  const setScrolling = useCallback((next: boolean) => {
    if (isScrollingRef.current === next) return;
    isScrollingRef.current = next;
    setIsScrolling(next);
  }, []);

  const listBottomPadding = isDesktopLayout
    ? ThemeLayout.spacing.xl
    : ThemeLayout.spacing.lg;
  const listContentStyle = useMemo(
    () => [LIST_CONTENT_STYLE, { paddingBottom: listBottomPadding }],
    [listBottomPadding]
  );
  const listContentDesktopStyle = useMemo(
    () => [LIST_CONTENT_STYLE, DESKTOP_MAX_WIDTH_STYLE, { paddingBottom: listBottomPadding }],
    [listBottomPadding]
  );
  const listExtraData = useMemo(
    () => ({ isScrolling }),
    [isScrolling],
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
      favoritesOnly: quickFilter === 'favorites',
      rememberedOnly: showRememberedOnly,
      recurringOnly: showRecurringOnly,
      needsExplorationOnly: quickFilter === 'to_deepen',
      analysisStatus,
    }, {
      searchOptions: {
        dreamTypeLabelResolver: (dreamType) => getDreamTypeLabel(dreamType, t),
        dreamMemoryLabelResolver: resolveDreamMemorySearchLabel,
      },
    });

    const orderedDreams = baseDreams;

    // Stored order is newest-first; only the opposite order needs a sort.
    return sortOrder === 'oldest' ? sortDreamsByDate(orderedDreams, true) : orderedDreams;
  }, [
    dreams,
    deferredSearchQuery,
    selectedTheme,
    selectedDreamType,
    dateRange,
    quickFilter,
    showRememberedOnly,
    showRecurringOnly,
    analysisStatus,
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
    quickFilter,
    showRememberedOnly,
    showRecurringOnly,
    analysisStatus,
    sortOrder,
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
    setQuickFilter('all');
    setShowRememberedOnly(false);
    setShowRecurringOnly(false);
    setAnalysisStatus(null);
    setSortOrder('newest');
  }, []);

  const handleQuickFilterPress = useCallback((next: JournalQuickFilter) => {
    if (next === 'all') {
      handleClearFilters();
      return;
    }
    setQuickFilter((current) => (current === next ? 'all' : next));
  }, [handleClearFilters]);

  const toggleThemeFilter = useCallback((theme: DreamTheme) => {
    setSelectedTheme((current) => (theme === current ? null : theme));
  }, []);

  const toggleDreamTypeFilter = useCallback((dreamType: DreamType) => {
    setSelectedDreamType((current) => (dreamType === current ? null : dreamType));
  }, []);

  const handleDateRangeChange = useCallback((start: Date | null, end: Date | null) => {
    setDateRange({ start, end });
  }, []);

  const handleRememberedToggle = useCallback(() => {
    setShowRememberedOnly((prev) => !prev);
  }, []);

  const handleRecurringToggle = useCallback(() => {
    setShowRecurringOnly((prev) => !prev);
  }, []);

  const handleAnalysisStatusChange = useCallback((status: JournalAnalysisStatusFilter | null) => {
    setAnalysisStatus(status);
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

  const handleListScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    listScrollOffsetRef.current = y;
    if (searchConsumesLayout) return;
    const next = Math.max(0, Math.min(y, mobileSearchHeaderHeight));
    setSearchCollapse((current) => {
      if (current.key === searchLayoutKey && Math.abs(current.offset - next) < 0.5) return current;
      return { key: searchLayoutKey, offset: next };
    });
  }, [mobileSearchHeaderHeight, searchConsumesLayout, searchLayoutKey]);

  const handleOverlaySearchTouchStart = useCallback((event: GestureResponderEvent) => {
    overlaySearchDragOriginRef.current = {
      pageX: event.nativeEvent.pageX,
      pageY: event.nativeEvent.pageY,
      offset: listScrollOffsetRef.current,
    };
  }, []);

  const shouldForwardOverlaySearchDrag = useCallback((event: GestureResponderEvent) => {
    if (searchConsumesLayout) return false;
    const origin = overlaySearchDragOriginRef.current;
    const dx = event.nativeEvent.pageX - origin.pageX;
    const dy = event.nativeEvent.pageY - origin.pageY;
    return Math.abs(dy) > OVERLAY_SEARCH_DRAG_SLOP && Math.abs(dy) >= Math.abs(dx);
  }, [searchConsumesLayout]);

  const handleOverlaySearchDragGrant = useCallback(() => {
    // Forwarded overlay drags use scrollToOffset, so FlashList
    // keyboardDismissMode on-drag never runs.
    if (typeof Keyboard.dismiss === 'function') {
      Keyboard.dismiss();
    }
  }, []);

  const handleOverlaySearchDragMove = useCallback((event: GestureResponderEvent) => {
    if (searchConsumesLayout) return;
    const dy = event.nativeEvent.pageY - overlaySearchDragOriginRef.current.pageY;
    const next = Math.max(0, overlaySearchDragOriginRef.current.offset - dy);
    handleScrollBegin();
    flatListRef.current?.scrollToOffset({ offset: next, animated: false });
  }, [handleScrollBegin, searchConsumesLayout]);

  const handleOverlaySearchDragEnd = useCallback(() => {
    scheduleIdle();
  }, [scheduleIdle]);

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
  }, [formatDreamListDate, t, handleDreamPress, isScrolling]);

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

  const hasNonDefaultSort = sortOrder !== 'newest';
  const hasActiveFilter = !!(
    searchQuery ||
    selectedTheme ||
    selectedDreamType ||
    dateRange.start ||
    dateRange.end ||
    quickFilter !== 'all' ||
    showRememberedOnly ||
    showRecurringOnly ||
    analysisStatus ||
    hasNonDefaultSort
  );
  const hasActiveAdvancedFilter = !!(
    selectedTheme ||
    selectedDreamType ||
    dateRange.start ||
    dateRange.end ||
    showRememberedOnly ||
    showRecurringOnly ||
    analysisStatus ||
    hasNonDefaultSort
  );
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
  const journalFilterItems = useMemo(() => [
    {
      id: 'all' as const,
      label: t('journal.filter.all'),
      active: quickFilter === 'all' && !hasActiveAdvancedFilter && !searchQuery.trim(),
      onPress: () => handleQuickFilterPress('all'),
      accessibilityLabel: t('journal.filter.accessibility.all'),
      testID: TID.Button.FilterAll,
    },
    {
      id: 'favorites' as const,
      label: t('journal.filter.favorites'),
      active: quickFilter === 'favorites',
      onPress: () => handleQuickFilterPress('favorites'),
      accessibilityLabel: t('journal.filter.accessibility.favorites'),
      testID: TID.Button.FilterFavorites,
    },
    {
      id: 'to_deepen' as const,
      label: t('journal.filter.to_deepen'),
      active: quickFilter === 'to_deepen',
      onPress: () => handleQuickFilterPress('to_deepen'),
      accessibilityLabel: t('journal.filter.accessibility.to_deepen'),
      testID: TID.Button.FilterToDeepen,
    },
    ...(selectedTheme ? [{
      id: 'theme' as const,
      label: t('journal.filter.theme'),
      active: true,
      onPress: () => toggleThemeFilter(selectedTheme),
      accessibilityLabel: t('journal.filter.accessibility.theme'),
      testID: TID.Button.FilterTheme,
    }] : []),
    ...(selectedDreamType ? [{
      id: 'type' as const,
      label: getDreamTypeLabel(selectedDreamType, t) ?? selectedDreamType,
      active: true,
      onPress: () => toggleDreamTypeFilter(selectedDreamType),
      accessibilityLabel: t('journal.filter.accessibility.theme'),
    }] : []),
    ...(dateRange.start || dateRange.end ? [{
      id: 'date' as const,
      label: t('journal.filter.date'),
      active: true,
      onPress: () => handleDateRangeChange(null, null),
      accessibilityLabel: t('journal.filter.accessibility.date'),
      testID: TID.Button.FilterDate,
    }] : []),
    ...(showRememberedOnly ? [{
      id: 'remembered' as const,
      label: t('journal.filter.remembered'),
      active: true,
      onPress: handleRememberedToggle,
      accessibilityLabel: t('journal.filter.accessibility.remembered'),
      testID: TID.Button.FilterRemembered,
    }] : []),
    ...(showRecurringOnly ? [{
      id: 'recurring' as const,
      label: t('journal.filter.recurring'),
      active: true,
      onPress: handleRecurringToggle,
      accessibilityLabel: t('journal.filter.accessibility.recurring'),
      testID: TID.Button.FilterRecurring,
    }] : []),
    ...(searchQuery.trim() ? [{
      id: 'search' as const,
      label: searchQuery.trim(),
      active: true,
      onPress: () => setSearchQuery(''),
      accessibilityLabel: t('journal.search_placeholder'),
      testID: TID.Button.FilterSearch,
    }] : []),
    ...(hasNonDefaultSort ? [{
      id: 'sort' as const,
      label: t(`journal.filter_sheet.sort.${sortOrder}`),
      active: true,
      onPress: () => setSortOrder('newest'),
      accessibilityLabel: t(`journal.filter_sheet.sort.${sortOrder}`),
    }] : []),
    ...(analysisStatus === 'unanalyzed' ? [{
      id: 'unanalyzed' as const,
      label: t('journal.filter_sheet.status.unanalyzed'),
      active: true,
      onPress: () => handleAnalysisStatusChange(null),
      accessibilityLabel: t('journal.filter_sheet.status.unanalyzed'),
      testID: TID.Button.FilterAnalyzed,
    }] : []),
    ...(analysisStatus === 'analyzed' ? [{
      id: 'analyzed' as const,
      label: t('journal.filter.analyzed'),
      active: true,
      onPress: () => handleAnalysisStatusChange(null),
      accessibilityLabel: t('journal.filter.accessibility.analyzed'),
      testID: TID.Button.FilterAnalyzed,
    }] : []),
    ...(analysisStatus === 'explored' ? [{
      id: 'explored' as const,
      label: t('journal.filter.explored'),
      active: true,
      onPress: () => handleAnalysisStatusChange(null),
      accessibilityLabel: t('journal.filter.accessibility.explored'),
      testID: TID.Button.FilterExplored,
    }] : []),
  ], [
    analysisStatus,
    dateRange.end,
    dateRange.start,
    handleAnalysisStatusChange,
    handleDateRangeChange,
    handleQuickFilterPress,
    handleRememberedToggle,
    handleRecurringToggle,
    hasActiveAdvancedFilter,
    hasNonDefaultSort,
    quickFilter,
    searchQuery,
    selectedDreamType,
    selectedTheme,
    showRememberedOnly,
    showRecurringOnly,
    sortOrder,
    t,
    toggleDreamTypeFilter,
    toggleThemeFilter,
  ]);
  const renderEmptyState = useCallback(() => (
    persistenceState.status === 'loading' ||
    (persistenceState.status === 'error' && persistenceState.operation === 'read') ? null : <EmptyState
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
    persistenceState,
  ]);

  const keyExtractor = useCallback((item: DreamAnalysis) => String(item.id), []);
  const getDreamItemType = useCallback((item: DreamAnalysis | undefined, index: number) => {
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
  }, []);

  // An element, not a component factory: typing must not create a new header
  // component type and remount the search input when it lives outside FlashList.
  const searchBar = (
    <SearchBar
      ref={searchInputRef}
      testID={TID.Component.SearchBar}
      inputTestID={TID.Input.SearchDreams}
      value={searchQuery}
      onChangeText={setSearchQuery}
      placeholder={t('journal.search_placeholder')}
    />
  );

  const listHeader = (
    <View style={scrollHeader ? { marginHorizontal: -ThemeLayout.spacing.md } : undefined}>
      {!searchConsumesLayout ? (
        <View testID="journal-search-scroll-slot" style={{ height: mobileSearchHeaderHeight }} />
      ) : null}
      <PageHeaderContent
        titleKey="journal.title"
        animationSeed={showHeaderAnimations ? 1 : 0}
        style={
          isDesktopLayout
            ? DESKTOP_MAX_WIDTH_STYLE
            : { paddingTop: ThemeLayout.spacing.sm }
        }
      />

      <View
        className="gap-4 p-4"
        style={isDesktopLayout ? DESKTOP_MAX_WIDTH_STYLE : undefined}
      >
        <MockNavigationRail />
        <JournalPersistenceNotice
          state={persistenceState}
          onRetry={() => void retryPersistence().catch(() => undefined)}
        />
        {isDesktopLayout ? searchBar : null}
        <View className="flex-row flex-wrap items-start gap-2">
          <View className="min-w-0 flex-1 basis-[220px]">
            <FilterBar
              items={journalFilterItems}
              onClear={handleClearFilters}
              dateRange={dateRange}
              selectedTheme={selectedTheme}
              selectedDreamType={selectedDreamType}
              clearTestID={TID.Button.ClearFilters}
            />
          </View>
          <View className="ml-auto flex-row items-center gap-2">
            <PressableScale
              onPress={() => router.push('/(tabs)/settings')}
              haptic="selection"
              accessibilityRole="button"
              accessibilityLabel={t('nav.settings')}
              testID={TID.Button.HeaderJournalSettings}
              className="h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-continuous border-line bg-ink-soft"
            >
              <IconSymbol
                name="gear"
                size={18}
                color={noctalia.text.primary}
              />
            </PressableScale>
            <PressableScale
              onPress={() => setShowAdvancedFilters(true)}
              haptic="selection"
              accessibilityRole="button"
              accessibilityState={{ selected: hasActiveAdvancedFilter }}
              accessibilityLabel={t('journal.filter.accessibility.more')}
              testID={TID.Button.FilterMore}
              className={`h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-continuous ${
                hasActiveAdvancedFilter ? 'border-champagne-soft bg-champagne' : 'border-line bg-ink-soft'
              }`}
            >
              <IconSymbol
                name="slider.horizontal.3"
                size={18}
                color={hasActiveAdvancedFilter ? noctalia.action.primaryText : noctalia.text.primary}
              />
            </PressableScale>
          </View>
        </View>
      </View>

      {/* Guest Upsell */}
      <View
        className="mb-2 px-4"
        style={isDesktopLayout ? DESKTOP_MAX_WIDTH_STYLE : undefined}
      >
        <UpsellCard />
      </View>

    </View>
  );

  return (
    <ScrollPerfProvider isScrolling={isScrolling}>
      <View className="flex-1 bg-ink" testID={TID.Screen.Journal}>
        {/* Atmospheric dreamlike background */}
        <AtmosphericBackground variant="subtle" />

        {isDesktopLayout ? listHeader : (
          <View
            testID="journal-search-chrome"
            className="px-4 pb-2"
            // Overlay chrome is taller than the uncovered list box on short
            // landscape. box-none lets FlashList receive drags that miss the
            // SearchBar. Vertical drags that start on the controls are forwarded
            // to the list so the bar can collapse, while taps still reach the
            // input and clear button.
            pointerEvents={searchConsumesLayout ? 'auto' : 'box-none'}
            style={{
              paddingTop: insets.top + ThemeLayout.spacing.sm,
              ...(searchConsumesLayout
                ? null
                : {
                    position: 'absolute' as const,
                    top: 0,
                    start: 0,
                    end: 0,
                    zIndex: 2,
                    transform: [{ translateY: -searchCollapseOffset }],
                  }),
            }}
          >
            <View
              pointerEvents="auto"
              testID="journal-search-controls"
              onTouchStart={searchConsumesLayout ? undefined : handleOverlaySearchTouchStart}
              onStartShouldSetResponderCapture={searchConsumesLayout ? undefined : () => false}
              onMoveShouldSetResponderCapture={searchConsumesLayout ? undefined : shouldForwardOverlaySearchDrag}
              onMoveShouldSetResponder={searchConsumesLayout ? undefined : shouldForwardOverlaySearchDrag}
              onResponderGrant={searchConsumesLayout ? undefined : handleOverlaySearchDragGrant}
              onResponderMove={searchConsumesLayout ? undefined : handleOverlaySearchDragMove}
              onResponderRelease={searchConsumesLayout ? undefined : handleOverlaySearchDragEnd}
              onResponderTerminate={searchConsumesLayout ? undefined : handleOverlaySearchDragEnd}
            >
              {searchBar}
            </View>
          </View>
        )}

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
          key={mobileListKey}
          data={filteredDreams}
          extraData={listExtraData}
          keyExtractor={keyExtractor}
          renderItem={isTabletLayout ? renderDreamItemTablet : renderDreamItem}
          numColumns={isTabletLayout ? 2 : 1}
          // Perf: helps FlashList recycle views by layout type to reduce scroll-time layout work.
          getItemType={getDreamItemType}
          contentContainerStyle={listContentStyle}
          // The navigator hides its tab bar while the keyboard is shown.
          // Always reserve the full absolute overlay, never a capped remainder.
          style={{ flex: 1, marginBottom: overlayNavClearance }}
          ListHeaderComponent={listHeader}
          onScroll={handleListScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentInsetAdjustmentBehavior="never"
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
        rememberedOnly={showRememberedOnly}
        recurringOnly={showRecurringOnly}
        analysisStatus={analysisStatus}
        onThemeSelect={toggleThemeFilter}
        onDreamTypeSelect={toggleDreamTypeFilter}
        onDateRangeChange={handleDateRangeChange}
        onRememberedToggle={handleRememberedToggle}
        onRecurringToggle={handleRecurringToggle}
        onAnalysisStatusChange={handleAnalysisStatusChange}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
      />
      </View>
    </ScrollPerfProvider>
  );
}
