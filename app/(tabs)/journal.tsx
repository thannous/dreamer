import { markPerformance } from '@/lib/performanceTrace';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useContentWindow } from '@/context/ContentWindowContext';
import { useQuickSettings } from '@/context/QuickSettingsContext';
import { getDreamRouteParams } from '@/lib/dreamRoute';
import { getDreamIdentityKey, matchesDreamTarget } from '@/lib/dreamIdentity';
import { UpsellCard } from '@/components/guest/UpsellCard';
import { DreamerArtworkWindow } from '@/components/ui/DreamerBackground';
import { PageHeaderContent } from '@/components/inspiration/PageHeader';
import { AdvancedFilterSheet, type JournalSortOrder } from '@/components/journal/AdvancedFilterSheet';
import { RemoteJournalList } from '@/components/journal/RemoteJournalList';
import type { DreamListItem } from '@/lib/journalReadContracts';
import { DreamCard } from '@/components/journal/DreamCard';
import { DreamShareComposer } from '@/components/journal/DreamShareComposer';
import { takeDreamStoryEpilogue } from '@/lib/dreamStoryEpilogue';
import { EmptyState } from '@/components/journal/EmptyState';
import { NoctaliaScreenHeader } from '@/components/NoctaliaScreenHeader';
import { JournalFirstPage } from '@/components/journal/JournalFirstPage';
import { useJournalListPagination } from '@/hooks/useJournalListPagination';
import { JournalCompletenessNotice } from '@/components/journal/JournalCompletenessNotice';
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
  getBottomNavigationLayout,
  getWindowClass,
} from '@/constants/layout';
import { useDreams } from '@/context/DreamsContext';
import { AuthContext } from '@/context/AuthContext';
import { resolveWithDiskCache } from '@/lib/dreamMediaDiskCache';
import { useTheme } from '@/context/ThemeContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useTranslation } from '@/hooks/useTranslation';
import { blurActiveElement } from '@/lib/accessibility';
import { createNarrowingFilter, getUniqueDreamTypes, getUniqueThemes, sortDreamsByDate, type JournalAnalysisStatusFilter, type JournalQuickFilter } from '@/lib/dreamFilters';
import { getDreamThemeLabel, getDreamTypeLabel } from '@/lib/dreamLabels';
import { parseJournalFilterParams, type JournalFilterRouteParams } from '@/lib/journalFilterLink';
import { getSymbolIndex } from '@/lib/symbolLinks';
import { getDreamThumbnailCacheKey, getDreamThumbnailUri, preloadImage } from '@/lib/imageUtils';
import { trackProductEvent } from '@/lib/analytics';
import { TID } from '@/lib/testIDs';
import type { DreamAnalysis, DreamTheme, DreamType } from '@/lib/types';
import { recordBadgeEvent } from '@/services/badgeLedgerStore';
import { FlashList, type FlashListRef, type ListRenderItemInfo, type ViewToken } from '@shopify/flash-list';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useCallback, useContext, useDeferredValue, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Text,
  type GestureResponderEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextInputInstance,
  View,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { withHeaderScroll } from '@/components/ui/HeaderScrollScope';
import { useHeaderScrollY } from '@/components/ui/scrollDepth';

const SCROLL_IDLE_MS = 140;
const PREFETCH_CACHE_LIMIT = 250;
const PREFETCH_MAX_PER_FLUSH = 8;
const OVERLAY_SEARCH_DRAG_SLOP = 8;
// A list scroll this soon after the user's wheel or touch on the web is theirs.
const USER_SCROLL_INPUT_MS = 150;

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

// FlashList spreads its style into a DOM view on web. Reanimated passes an array,
// which creates numeric CSS properties; the native wrapper still handles worklets.
const AnimatedDreamList = Platform.OS === 'web'
  ? FlashList<DreamAnalysis>
  : Animated.createAnimatedComponent(FlashList<DreamAnalysis>);

function JournalListScreen() {
  const { dreams, completeness, remotePreviewAllowed, loadRemoteDreamForPreview, persistenceState, refreshState, reloadDreams, retryPersistence, toggleFavorite } = useDreams();
  const { colors, mode } = useTheme();
  const openQuickSettings = useQuickSettings();
  const { t, currentLang } = useTranslation();
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  useClearWebFocus();
  const { formatShortDate: formatDreamListDate } = useLocaleFormatting();
  const firstUsefulList = useRef(false);
  const firstUsefulContent = useRef(false);
  const flatListRef = useRef<FlashListRef<DreamAnalysis>>(null);
  // The dream at the top of the list, and the one kept when its columns change (an iPhone
  // Duo folded or opened, a phone turned): the list remounts in its new columns and opens on
  // that dream. Kept by identity, so it is only found again among the same dreams.
  const topDreamKeyRef = useRef<string | null>(null);
  const resumeDreamKeyRef = useRef<string | null>(null);
  const listItemsRef = useRef<DreamAnalysis[]>([]);
  const searchInputRef = useRef<TextInputInstance>(null);
  const { width, height, fontScale } = useContentWindow();
  const insets = useSafeAreaInsets();
  const onListLoaded = useCallback(() => {
    if (!firstUsefulList.current) {
      firstUsefulList.current = true;
      markPerformance('journal.first_list_painted');
    }
    const resumeKey = resumeDreamKeyRef.current;
    resumeDreamKeyRef.current = null;
    const resumeIndex = resumeKey ? listItemsRef.current.findIndex((item) => getDreamIdentityKey(item) === resumeKey) : -1;
    if (resumeIndex > 0) {
      // Below the status bar: the search has scrolled away by then.
      void flatListRef.current?.scrollToIndex({ index: resumeIndex, animated: false, viewOffset: -(insets.top + ThemeLayout.spacing.sm) });
    }
  }, [insets.top]);

  const isWeb = Platform.OS === 'web';
  const isDesktopLayout = isWeb && width >= DESKTOP_BREAKPOINT;
  // One column on a phone or the folded Duo, two open, three when the open Duo lies on its side.
  // The web window follows the visual viewport, which the on-screen keyboard shrinks; the
  // page keeps its height, so focusing the search never regroups the dreams.
  const columnsHeight = isWeb && typeof document !== 'undefined'
    ? Math.max(height, document.documentElement.clientHeight)
    : height;
  const windowClass = getWindowClass(width, columnsHeight);
  const listColumns = windowClass === 'expanded' ? 3 : windowClass === 'large' ? 2 : 1;
  const desktopColumns = width >= 1440 ? 4 : 3;
  const navigationLayout = getBottomNavigationLayout(width, height, fontScale);
  // Keep the shared brand header and search outside the column-keyed list so
  // rotation cannot remount the input. Filters remain in ListHeaderComponent;
  // on short viewports the measured chrome can collapse as the list scrolls.
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(getInitialKeyboardVisibility);
  const navigationClearance = navigationLayout.barHeight + Math.max(insets.bottom, navigationLayout.minimumBottomInset);
  // The tab bar in app/(tabs)/_layout.tsx is position:absolute glass, so dreams scroll
  // behind it and the list's bottom padding clears it for the last one. On phones the header and search stay
  // mounted outside the column-keyed list but float over it: a header spacer and a
  // scroll translation carry them away with the first dreams, so the list gets the
  // whole screen once it scrolls.
  // The spacer takes the chrome's last measured height, whatever width it was read at:
  // on the web a resize can report it before the screen renders at the new width, and a
  // chrome that keeps its height reports nothing more, so the spacer would otherwise
  // stay on the estimate below and hide the filters under the header.
  const [measuredHeaderHeight, setMeasuredHeaderHeight] = useState(0);
  const mobileSearchHeaderHeight = isDesktopLayout
    ? 0
    : measuredHeaderHeight > 0
      ? measuredHeaderHeight
      : insets.top + ThemeLayout.spacing.sm + searchBarLayout(fontScale).minHeight + ThemeLayout.spacing.sm;
  const overlayNavClearance = isDesktopLayout || isKeyboardVisible ? 0 : navigationClearance;
  // A column change remounts the list, which opens on the same dream; the keyboard keeps
  // its columns and offset.
  const mobileListKey = listColumns > 1 ? `tablet-${listColumns}col` : 'mobile-cards-1col';
  // The columns of the list on screen: the desktop grid keeps its own.
  const columnsKey = isDesktopLayout ? `desktop-${desktopColumns}` : mobileListKey;
  const listScrollY = useSharedValue(0);
  // The journal's own scroll, read by its header, painting and dream cards.
  const headerScrollY = useHeaderScrollY();
  const staticScrollY = useRef(0);
  const scrollLayoutKey = useRef(columnsKey);
  // Open at the top and gone once scrolled past: those two hand back the same transform on
  // each scroll frame, since Reanimated commits a style each time it gets a new one.
  const searchEnds = useMemo(() => ({
    open: [{ translateY: 0 }],
    collapsed: [{ translateY: -mobileSearchHeaderHeight }],
  }), [mobileSearchHeaderHeight]);
  const searchCollapseStyle = useAnimatedStyle(() => {
    const y = listScrollY.get();
    if (isDesktopLayout || y <= 0) return { transform: searchEnds.open };
    if (y >= mobileSearchHeaderHeight) return { transform: searchEnds.collapsed };
    return { transform: [{ translateY: -y }] };
  });

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false),
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
  // A symbol's link key: only the dreams of its thread.
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  // For the collection: whether the dreamer chose a filter here. Another screen's preset is not theirs.
  const [filtersSetByHand, setFiltersSetByHand] = useState(false);
  const badgeNarrowingRef = useRef({ searched: false, filtered: false });

  // Another screen (Tendances, a symbol's sheet) can open the journal on a set of dreams:
  // its filters replace the current ones and then stay like filters set by hand (shown as
  // chips, kept while a dream is open). The params leave the route so they apply only once.
  const filterParams = useLocalSearchParams<JournalFilterRouteParams>();
  const filterLink = parseJournalFilterParams(filterParams);
  // This consumes an external navigation command once, then preserves filters edited by hand.
  // Applied while rendering, once per link (its parsed dates are new objects on every
  // render): the list never renders with the previous filters, and no effect needs a
  // lint suppression, which would keep React Compiler off this screen.
  const filterLinkKey = filterLink?.key ?? null;
  const [appliedFilterLinkKey, setAppliedFilterLinkKey] = useState<string | null>(null);
  if (filterLinkKey !== appliedFilterLinkKey) {
    setAppliedFilterLinkKey(filterLinkKey);
    if (filterLink) {
      setSearchQuery('');
      setSelectedTheme(filterLink.theme);
      setSelectedDreamType(filterLink.dreamType);
      setDateRange({ start: filterLink.start, end: filterLink.end });
      setQuickFilter('all');
      setShowRememberedOnly(false);
      setShowRecurringOnly(false);
      setAnalysisStatus(filterLink.analysis);
      setSelectedSymbol(filterLink.symbol);
      setSortOrder('newest');
      setFiltersSetByHand(false);
    }
  }
  // The params leave the route so they apply only once.
  useEffect(() => {
    if (filterLinkKey) {
      router.setParams({ filter: undefined, theme: undefined, type: undefined, from: undefined, to: undefined, analysis: undefined, symbol: undefined });
    }
  }, [filterLinkKey]);

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
  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: JOURNAL_LIST.VIEWABILITY_THRESHOLD,
    minimumViewTime: JOURNAL_LIST.MINIMUM_VIEW_TIME,
  }), []);

  // A ref only: prefetch waits for scroll to rest, and no element of this screen reads it,
  // so starting or ending a scroll does not render the screen again.
  const isScrollingRef = useRef(false);
  const scrollIdleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlaySearchDragOriginRef = useRef({ pageX: 0, pageY: 0, offset: 0 });

  useLayoutEffect(() => {
    if (scrollLayoutKey.current !== columnsKey) {
      // The dream at the top, before the remount's own first rows replace it.
      resumeDreamKeyRef.current = topDreamKeyRef.current;
      staticScrollY.current = 0;
      listScrollY.set(0);
    }
    scrollLayoutKey.current = columnsKey;
  }, [columnsKey, listScrollY]);

  const setScrolling = useCallback((next: boolean) => {
    isScrollingRef.current = next;
  }, []);

  const listBottomPadding = isDesktopLayout
    ? ThemeLayout.spacing.xl
    : ThemeLayout.spacing.lg;
  const listContentStyle = useMemo(
    () => [LIST_CONTENT_STYLE, { paddingBottom: listBottomPadding + overlayNavClearance }],
    [listBottomPadding, overlayNavClearance]
  );
  const listContentDesktopStyle = useMemo(
    () => [LIST_CONTENT_STYLE, DESKTOP_MAX_WIDTH_STYLE, { paddingBottom: listBottomPadding }],
    [listBottomPadding]
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

  // Perf: the index is built (and the dictionary loaded) only once a symbol filters the journal.
  // An older name may since have joined the dreamer's own symbol; a symbol whose dreams are
  // all gone filters nothing rather than emptying the journal.
  const symbolThread = useMemo(() => {
    if (!selectedSymbol) return null;
    const index = getSymbolIndex(dreams, currentLang);
    return index.symbols.get(index.aliases.get(selectedSymbol) ?? selectedSymbol) ?? null;
  }, [currentLang, dreams, selectedSymbol]);
  const symbolDreamIds = useMemo(
    () => (symbolThread ? new Set(symbolThread.appearances.map(({ dream }) => dream.id)) : null),
    [symbolThread],
  );

  // Typing narrows the previous matches instead of searching the whole journal again.
  const [narrowingFilter] = useState(createNarrowingFilter);
  const filteredDreams = useMemo(() => {
    const baseDreams = narrowingFilter(dreams, {
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
      dreamIds: symbolDreamIds,
    }, {
      searchOptions: {
        dreamTypeLabelResolver: (dreamType) => getDreamTypeLabel(dreamType, t),
        dreamMemoryLabelResolver: resolveDreamMemorySearchLabel,
      },
      // Both resolvers read the current language through `t`.
      labelsSource: t,
    });

    // Stored order is newest-first; only the opposite order needs a sort.
    return sortOrder === 'oldest' ? sortDreamsByDate(baseDreams, true) : baseDreams;
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
    symbolDreamIds,
    resolveDreamMemorySearchLabel,
    t,
    sortOrder,
    narrowingFilter,
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

  const mediaUserId = useContext(AuthContext)?.user?.id ?? null;
  const previewEligible = Boolean(remotePreviewAllowed && mediaUserId && dreams.length === 0);
  const previewMounted = useRef(true);
  useEffect(() => { previewMounted.current = true; return () => { previewMounted.current = false; }; }, []);
  const previewScopeRef = useRef({ userId: mediaUserId, eligible: previewEligible });
  useLayoutEffect(() => {
    previewScopeRef.current = { userId: mediaUserId, eligible: previewEligible };
  }, [mediaUserId, previewEligible]);
  const openRemoteDream = useCallback(async (item: DreamListItem) => {
    const userId = mediaUserId;
    if (!userId || !item.remoteId || !previewScopeRef.current.eligible) return;
    const full = await loadRemoteDreamForPreview(item.remoteId);
    if (!previewMounted.current || previewScopeRef.current.userId !== userId) return;
    void reloadDreams();
    router.push({ pathname: '/journal/[id]', params: getDreamRouteParams(full) });
    // This list only shows under a search, never under a filter.
    if (badgeNarrowingRef.current.searched) {
      recordBadgeEvent({ type: 'journal_result_opened', searched: true, filtered: false, now: Date.now() });
    }
  }, [mediaUserId, loadRemoteDreamForPreview, reloadDreams]);
  const previewFiltersSupported = !selectedTheme && !selectedDreamType && !dateRange.start && !dateRange.end &&
    quickFilter === 'all' && !showRememberedOnly && !showRecurringOnly && !analysisStatus && !symbolThread &&
    sortOrder !== 'oldest';
  const paginationScope = JSON.stringify([mediaUserId, deferredSearchQuery, selectedTheme, selectedDreamType,
    dateRange.start, dateRange.end, quickFilter, showRememberedOnly, showRecurringOnly, analysisStatus,
    symbolThread?.linkKey ?? null, sortOrder]);
  const { visibleItems, hasMore, loadMore } = useJournalListPagination(filteredDreams, paginationScope);
  useLayoutEffect(() => {
    listItemsRef.current = visibleItems;
  }, [visibleItems]);
  useLayoutEffect(() => {
    // New results: the dream kept for a column change belonged to the previous ones.
    topDreamKeyRef.current = null;
    resumeDreamKeyRef.current = null;
  }, [paginationScope]);
  const paginationFooter = hasMore ? (
    <PressableScale onPress={loadMore} accessibilityRole="button" className="min-h-[48px] items-center justify-center p-4">
      <Text className="font-sans-bold text-body text-champagne-on">{t('journal.pagination.more')}</Text>
    </PressableScale>
  ) : filteredDreams.length > 0 ? (
    <Text className="p-4 text-center font-sans text-body-sm text-ivory-muted">{t('journal.pagination.end')}</Text>
  ) : null;
  const listFooter = (
    <View>
      <View className="px-4 py-2"><UpsellCard /></View>
      {paginationFooter}
    </View>
  );
  const mediaGeneration = useRef(0);
  const mediaFocused = useRef(false);
  // A new list cancels the warm-up still running for the previous one. The thumbnails already
  // warmed stay known until the account changes: their keys name the exact image, so a search
  // keystroke or a favourite does not decode the first thumbnails again.
  useLayoutEffect(() => {
    mediaGeneration.current += 1;
    return () => { mediaGeneration.current += 1; };
  }, [mediaUserId, filteredDreams]);
  useLayoutEffect(() => {
    prefetchedImageUrisRef.current.clear();
  }, [mediaUserId]);

  const prefetchDreamMedia = useCallback(async (entries: DreamAnalysis[]) => {
    if (!mediaFocused.current || isScrollingRef.current) return;
    const generation = mediaGeneration.current;
    const resolved = await Promise.all(entries.slice(0, PREFETCH_MAX_PER_FLUSH).map(async (dream) => ({
      ...dream,
      ...await resolveWithDiskCache(dream, mediaUserId, false, { variant: 'thumbnail' }),
    })));
    for (const dream of resolved) {
      if (!mediaFocused.current || isScrollingRef.current || generation !== mediaGeneration.current) return;
      const uri = getDreamThumbnailUri(dream);
      if (uri && isLikelyOptimizedThumbnailUri(uri) && rememberPrefetchedUri(getDreamThumbnailCacheKey(dream) ?? uri)) {
        await preloadImage(uri, getDreamThumbnailCacheKey(dream));
      }
    }
  }, [mediaUserId, rememberPrefetchedUri]);

  // Only warm a bounded, focused window. A hidden journal must not compete with reading.
  useFocusEffect(useCallback(() => {
    mediaFocused.current = true;
    void prefetchDreamMedia(filteredDreams.slice(0, PREFETCH_MAX_PER_FLUSH));
    return () => { mediaFocused.current = false; mediaGeneration.current += 1; };
  }, [filteredDreams, prefetchDreamMedia]));

  // Scroll to top when filters change, not when the filtered dreams merely update.
  const scrollFilteredListToTop = useEffectEvent(() => {
    if (filteredDreams.length > 0) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  });
  useEffect(() => {
    scrollFilteredListToTop();
  }, [
    deferredSearchQuery,
    selectedTheme,
    selectedDreamType,
    dateRange,
    quickFilter,
    showRememberedOnly,
    showRecurringOnly,
    analysisStatus,
    symbolThread,
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
    setSelectedSymbol(null);
    setSortOrder('newest');
    setFiltersSetByHand(false);
  }, []);

  const handleQuickFilterPress = useCallback((next: JournalQuickFilter) => {
    if (next === 'all') {
      handleClearFilters();
      return;
    }
    setFiltersSetByHand(true);
    setQuickFilter((current) => (current === next ? 'all' : next));
  }, [handleClearFilters]);

  const toggleThemeFilter = useCallback((theme: DreamTheme) => {
    setFiltersSetByHand(true);
    setSelectedTheme((current) => (theme === current ? null : theme));
  }, []);

  const toggleDreamTypeFilter = useCallback((dreamType: DreamType) => {
    setFiltersSetByHand(true);
    setSelectedDreamType((current) => (dreamType === current ? null : dreamType));
  }, []);

  const handleDateRangeChange = useCallback((start: Date | null, end: Date | null) => {
    setFiltersSetByHand(true);
    setDateRange({ start, end });
  }, []);

  const handleRememberedToggle = useCallback(() => {
    setFiltersSetByHand(true);
    setShowRememberedOnly((prev) => !prev);
  }, []);

  const handleRecurringToggle = useCallback(() => {
    setFiltersSetByHand(true);
    setShowRecurringOnly((prev) => !prev);
  }, []);

  const handleAnalysisStatusChange = useCallback((status: JournalAnalysisStatusFilter | null) => {
    setFiltersSetByHand(true);
    setAnalysisStatus(status);
  }, []);

  const handleDreamPress = useCallback((dream: DreamAnalysis) => {
    markPerformance('journal.interaction');
    if (isNavigatingRef.current) {
      return;
    }
    isNavigatingRef.current = true;
    router.push({ pathname: '/journal/[id]', params: getDreamRouteParams(dream) });
    const { searched, filtered } = badgeNarrowingRef.current;
    if (searched || filtered) recordBadgeEvent({ type: 'journal_result_opened', searched, filtered, now: Date.now() });
  }, []);

  // On a phone, sharing from a card lets the dreamer choose what the shared card shows, over
  // the journal they stay in. The web, with no reliable share sheet, opens the dream, whose
  // share falls back to copying.
  const [shareTarget, setShareTarget] = useState<{ dream: DreamAnalysis; open: boolean } | null>(null);
  const handleDreamShare = useCallback((dream: DreamAnalysis) => {
    if (Platform.OS !== 'web') {
      setShareTarget({ dream, open: true });
      return;
    }
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    router.push({ pathname: '/journal/[id]', params: { ...getDreamRouteParams(dream), share: '1' } });
  }, []);
  const closeDreamShare = useCallback(() => setShareTarget((current) => current && { ...current, open: false }), []);
  // Once its sheet has slid away, the composer lets go of the dream.
  useEffect(() => {
    if (!shareTarget || shareTarget.open) return undefined;
    const timer = setTimeout(() => setShareTarget((current) => (current && !current.open ? null : current)), 600);
    return () => clearTimeout(timer);
  }, [shareTarget]);
  // The dream as the journal holds it now, through a sync that names it anew. A dream deleted
  // meanwhile, or gone with its account, ends the share: it never reopens by itself.
  const sharedDream = shareTarget ? dreams.find((dream) => matchesDreamTarget(dream, shareTarget.dream)) ?? null : null;
  if (shareTarget && !sharedDream) setShareTarget(null);

  const handleDreamFavorite = useCallback((dream: DreamAnalysis) => {
    setFavoriteError(null);
    void toggleFavorite(dream).catch(() => setFavoriteError(t('journal.detail.favorite.error')));
  }, [toggleFavorite, t]);

  // Track viewable items and prefetch thumbnails once scrolling is idle.
  const filteredDreamsRef = useRef(filteredDreams);
  useEffect(() => {
    filteredDreamsRef.current = filteredDreams;
  }, [filteredDreams]);

  interface ViewabilityInfo {
    viewableItems: ViewToken<DreamAnalysis>[];
    changed: ViewToken<DreamAnalysis>[];
  }

  const flushPrefetch = useCallback(async () => {
    if (isScrollingRef.current) return;

    const range = viewableRangeRef.current;
    const currentFilteredDreams = filteredDreamsRef.current;
    if (!range || currentFilteredDreams.length === 0) return;

    const start = Math.max(0, range.min - JOURNAL_LIST.PRELOAD_BUFFER);
    const end = Math.min(currentFilteredDreams.length - 1, range.max + JOURNAL_LIST.PRELOAD_BUFFER);
    await prefetchDreamMedia(currentFilteredDreams.slice(start, end + 1));
  }, [prefetchDreamMedia]);

  // The dream at the top is the first one at least half in view, not the last sliver of a
  // row the reader has nearly scrolled past.
  const viewabilityConfigCallbackPairs = useMemo(() => [{
    viewabilityConfig: { itemVisiblePercentThreshold: 50, minimumViewTime: JOURNAL_LIST.MINIMUM_VIEW_TIME },
    onViewableItemsChanged: ({ viewableItems }: ViewabilityInfo) => {
      let top: ViewToken<DreamAnalysis> | null = null;
      for (const token of viewableItems) {
        if (typeof token.index === 'number' && (top === null || token.index < (top.index ?? 0))) top = token;
      }
      topDreamKeyRef.current = top?.item ? getDreamIdentityKey(top.item) : null;
    },
  }], []);

  const onViewableItemsChanged = useCallback(({ viewableItems }: ViewabilityInfo) => {
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
      if (!firstUsefulContent.current) {
        firstUsefulContent.current = true;
        markPerformance('journal.first_useful_content');
      }
    }
  }, []);

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

  // react-native-web dismisses the keyboard on every scroll event when asked to on drag,
  // the list's own animated return to the top included: a search typed in a scrolled
  // journal lost its field after the first letter. On the web the list dismisses it only
  // when it moves under a wheel or touch of the user's, as a drag does natively; a swipe
  // of the filter chips or a wheel over a list that cannot move leaves the field alone.
  const lastUserScrollInputRef = useRef(Number.NEGATIVE_INFINITY);
  const markUserScrollInput = useCallback(() => {
    lastUserScrollInputRef.current = performance.now();
  }, []);
  const webUserScrollInput = isWeb
    ? { onWheel: markUserScrollInput, onTouchMove: markUserScrollInput }
    : null;
  // Typing is not scrolling: the list's return to the top that a letter starts stays its own.
  const handleSearchQueryChange = useCallback((text: string) => {
    lastUserScrollInputRef.current = Number.NEGATIVE_INFINITY;
    setSearchQuery(text);
  }, []);

  // A fixed header needs only an offset for a future viewport change. FlashList
  // already delivers JS scroll events; avoid a UI worklet for every such frame.
  const handleStaticListScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    staticScrollY.current = event.nativeEvent.contentOffset.y;
    headerScrollY.set(staticScrollY.current);
    listScrollY.set(staticScrollY.current);
    if (isWeb && performance.now() - lastUserScrollInputRef.current < USER_SCROLL_INPUT_MS
      && typeof Keyboard.dismiss === 'function') {
      Keyboard.dismiss();
    }
  }, [headerScrollY, isWeb, listScrollY]);

  const handleListScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      listScrollY.set(event.contentOffset.y);
      headerScrollY.set(event.contentOffset.y);
    },
  });

  const handleOverlaySearchTouchStart = useCallback((event: GestureResponderEvent) => {
    overlaySearchDragOriginRef.current = {
      pageX: event.nativeEvent.pageX,
      pageY: event.nativeEvent.pageY,
      offset: listScrollY.get(),
    };
  }, [listScrollY]);

  const shouldForwardOverlaySearchDrag = useCallback((event: GestureResponderEvent) => {
    const origin = overlaySearchDragOriginRef.current;
    const dx = event.nativeEvent.pageX - origin.pageX;
    const dy = event.nativeEvent.pageY - origin.pageY;
    return Math.abs(dy) > OVERLAY_SEARCH_DRAG_SLOP && Math.abs(dy) >= Math.abs(dx);
  }, []);

  const handleOverlaySearchDragGrant = useCallback(() => {
    // Forwarded overlay drags use scrollToOffset, so FlashList
    // keyboardDismissMode on-drag never runs.
    if (typeof Keyboard.dismiss === 'function') {
      Keyboard.dismiss();
    }
  }, []);

  const handleOverlaySearchDragMove = useCallback((event: GestureResponderEvent) => {
    const dy = event.nativeEvent.pageY - overlaySearchDragOriginRef.current.pageY;
    const next = Math.max(0, overlaySearchDragOriginRef.current.offset - dy);
    handleScrollBegin();
    flatListRef.current?.scrollToOffset({ offset: next, animated: false });
  }, [handleScrollBegin]);

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

  // Epilogue of the dream story: arriving from a just-captured dream, its card glows once.
  // Taken on focus because this tab often stays mounted while the dream is told. Lists get
  // it as extraData only while it glows, so ordinary scrolling never re-renders rows.
  // The glow ends when the card has shown it (a filtered or scrolled list may mount it
  // later) or when the journal loses focus, so a recycled row never replays it.
  const [storyGlowKey, setStoryGlowKey] = useState<string | null>(null);
  const clearStoryGlow = useCallback(() => setStoryGlowKey(null), []);
  useFocusEffect(useCallback(() => {
    const key = takeDreamStoryEpilogue();
    if (key) setStoryGlowKey(key);
    return () => setStoryGlowKey(null);
  }, []));

  // No `entering` on a row: FlashList recycles them, so an entrance replays on every
  // scroll. The list itself is the thing that appeared, and it appeared with the screen.
  const renderDreamItem = useCallback(({ item, index }: ListRenderItemInfo<DreamAnalysis>) => {
    if (!item) return null;
    const dateStr = formatDreamListDate(item.id);
    const isFirstItem = index === 0;

    return (
      <View className="mb-6">
        <DreamCard
          dream={item}
          onPress={handleDreamPress}
          onShare={handleDreamShare}
          onToggleFavorite={handleDreamFavorite}
          testID={TID.List.DreamItem(item.id)}
          dateLabel={dateStr}
          variant={isFirstItem ? 'featured' : 'standard'}
          glow={storyGlowKey === getDreamIdentityKey(item)}
          onGlowDone={clearStoryGlow}
        />
      </View>
    );
  }, [clearStoryGlow, formatDreamListDate, handleDreamFavorite, handleDreamPress, handleDreamShare, storyGlowKey]);

  const renderDreamItemTablet = useCallback(({ item }: ListRenderItemInfo<DreamAnalysis>) => {
    if (!item) return null;
    const dateStr = formatDreamListDate(item.id);

    return (
      <View className="mb-4 flex-1 px-1">
        <DreamCard
          dream={item}
          onPress={handleDreamPress}
          onShare={handleDreamShare}
          onToggleFavorite={handleDreamFavorite}
          testID={TID.List.DreamItem(item.id)}
          dateLabel={dateStr}
          variant="standard"
          glow={storyGlowKey === getDreamIdentityKey(item)}
          onGlowDone={clearStoryGlow}
        />
      </View>
    );
  }, [clearStoryGlow, formatDreamListDate, handleDreamFavorite, handleDreamPress, handleDreamShare, storyGlowKey]);

  const renderDreamItemDesktop = useCallback(({ item, index }: ListRenderItemInfo<DreamAnalysis>) => {
    // Recycling can briefly retain an index after a filter shrinks the data array.
    if (!item) return null;
    return (
      <View className="mb-6 min-w-0 flex-1 px-1">
        <DreamCard
          dream={item}
          onPress={handleDreamPress}
          onShare={handleDreamShare}
          onToggleFavorite={handleDreamFavorite}
          testID={TID.List.DreamItem(item.id)}
          dateLabel={formatDreamListDate(item.id)}
          variant={index === 0 ? 'featured' : 'standard'}
          glow={storyGlowKey === getDreamIdentityKey(item)}
          onGlowDone={clearStoryGlow}
        />
      </View>
    );
  }, [clearStoryGlow, formatDreamListDate, handleDreamFavorite, handleDreamPress, handleDreamShare, storyGlowKey]);

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
    symbolThread ||
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
  // The list a result is opened from: a search typed here, a filter chosen here.
  const filteredByHand = filtersSetByHand && !!(
    selectedTheme ||
    selectedDreamType ||
    dateRange.start ||
    dateRange.end ||
    quickFilter !== 'all' ||
    showRememberedOnly ||
    showRecurringOnly ||
    analysisStatus
  );
  const searchedNow = deferredSearchQuery.trim().length > 0;
  useEffect(() => {
    badgeNarrowingRef.current = { searched: searchedNow, filtered: filteredByHand };
  }, [filteredByHand, searchedNow]);
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
    // The symbol a sheet opened the journal on comes first: it is why the list is short, and
    // after the quick filters it would start past the edge of a phone.
    ...(symbolThread ? [{
      id: 'symbol' as const,
      label: symbolThread.name,
      active: true,
      onPress: () => setSelectedSymbol(null),
      accessibilityLabel: `${symbolThread.name}, ${t('journal.filter.accessibility.symbol')}`,
      testID: TID.Button.FilterSymbol,
    }] : []),
    {
      id: 'all' as const,
      label: t('journal.filter.all'),
      active: quickFilter === 'all' && !hasActiveAdvancedFilter && !symbolThread && !searchQuery.trim(),
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
      label: getDreamThemeLabel(selectedTheme, t) ?? t('journal.filter.theme'),
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
    symbolThread,
    t,
    toggleDreamTypeFilter,
    toggleThemeFilter,
  ]);
  const renderEmptyState = useCallback(() => (
    refreshState?.status === 'refreshing' || refreshState?.status === 'error' ||
    persistenceState.status === 'loading' ||
    (persistenceState.status === 'error' && persistenceState.operation === 'read') ? null : <EmptyState
      hasActiveFilter={hasActiveFilter}
      compact={isKeyboardVisible}
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
    isKeyboardVisible,
    persistenceState,
    refreshState,
  ]);

  const keyExtractor = useCallback((item: DreamAnalysis) => getDreamIdentityKey(item), []);
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
      onChangeText={handleSearchQueryChange}
      placeholder={t('journal.search_placeholder')}
    />
  );

  const listHeader = (
    <View style={isDesktopLayout ? undefined : { marginHorizontal: -ThemeLayout.spacing.md }}>
      {!isDesktopLayout ? (
        <View testID="journal-search-scroll-slot" style={{ height: mobileSearchHeaderHeight }} />
      ) : null}
      {isDesktopLayout ? <DreamerArtworkWindow scene="journal" /> : null}
      {isDesktopLayout ? <PageHeaderContent
        titleKey="journal.title"
        animationSeed={showHeaderAnimations ? 1 : 0}
        style={
          isDesktopLayout
            ? DESKTOP_MAX_WIDTH_STYLE
            : { paddingTop: ThemeLayout.spacing.sm }
        }
      /> : null}

      <View
        className="gap-4 p-4"
        style={isDesktopLayout ? DESKTOP_MAX_WIDTH_STYLE : undefined}
      >
        {favoriteError ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite"
          testID="journal.favorite.error" className="font-sans text-danger-on">{favoriteError}</Text> : null}
        <JournalPersistenceNotice
          state={persistenceState}
          refreshState={completeness?.status === 'incomplete' ? undefined : refreshState}
          onRefresh={() => { void reloadDreams(); }}
          onRetry={() => void retryPersistence().catch(() => undefined)}
        />
        {(!(previewEligible && previewFiltersSupported) || completeness?.status === 'incomplete') &&
          <JournalCompletenessNotice status={completeness?.status} onRetry={() => { void reloadDreams(); }} />}
        {isDesktopLayout ? searchBar : null}
        <View className="flex-row items-center gap-2" testID="journal-filter-bar">
          <View className="min-w-0 flex-1">
            <FilterBar
              items={journalFilterItems}
              onClear={handleClearFilters}
              dateRange={dateRange}
              selectedTheme={selectedTheme}
              selectedDreamType={selectedDreamType}
              clearTestID={TID.Button.ClearFilters}
            />
          </View>
          <View className="shrink-0 flex-row items-center gap-2">
            {isDesktopLayout ? <PressableScale
              onPress={openQuickSettings}
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
            </PressableScale> : null}
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


    </View>
  );

  // An empty local cache is not proof of an empty journal while a remote
  // preview, incomplete sync, loading state or read failure is active.
  const showFirstPage = canStartRememberedDreamFromEmpty
    && persistenceState.status === 'ready'
    && refreshState?.status !== 'refreshing'
    && refreshState?.status !== 'error'
    && completeness?.status !== 'incomplete'
    && completeness?.status !== 'loading'
    && !previewEligible;

  if (showFirstPage) {
    return (
      <View className="flex-1 bg-ink" testID={TID.Screen.Journal}>
        <JournalFirstPage
          bottomInset={overlayNavClearance}
          onStartDream={handleStartRememberedDreamFromEmpty}
          onSettings={openQuickSettings}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-ink" testID={TID.Screen.Journal}>

      {isDesktopLayout ? listHeader : (
        <Animated.View
          testID="journal-search-chrome"
          className="pb-2"
          onLayout={(event) => {
            const nextHeight = event.nativeEvent.layout.height;
            // Hidden behind another route (on the web), the chrome measures zero: keep its
            // real height so the list is not laid out again, twice, around the visit.
            if (nextHeight <= 0) return;
            setMeasuredHeaderHeight(nextHeight);
          }}
          // Overlay chrome is taller than the uncovered list box on short
          // landscape. box-none lets FlashList receive drags that miss the
          // SearchBar. Vertical drags that start on the controls are forwarded
          // to the list so the bar can collapse, while taps still reach the
          // input and clear button.
          pointerEvents="box-none"
          style={[{
            position: 'absolute' as const,
            top: 0,
            start: 0,
            end: 0,
            zIndex: 2,
          }, searchCollapseStyle]}
        >
          <View
            pointerEvents="box-none"
            testID="journal-search-controls"
            onTouchStart={handleOverlaySearchTouchStart}
            onStartShouldSetResponderCapture={() => false}
            onMoveShouldSetResponderCapture={shouldForwardOverlaySearchDrag}
            onMoveShouldSetResponder={shouldForwardOverlaySearchDrag}
            onResponderGrant={handleOverlaySearchDragGrant}
            onResponderMove={handleOverlaySearchDragMove}
            onResponderRelease={handleOverlaySearchDragEnd}
            onResponderTerminate={handleOverlaySearchDragEnd}
          >
            <NoctaliaScreenHeader
              scene="journal"
              // On phones the header floats over the list: its painting grows down on a pull.
              pinned
              titleKey="nav.journal"
              variant="tab"
              // The title rests lower in the painting, like Today and Explore.
              immersive
              actions={[{
                icon: 'gear',
                onPress: openQuickSettings,
                accessibilityLabel: t('nav.settings'),
                testID: TID.Button.HeaderJournalSettings,
              }]}
              inlineSlot={searchBar}
            />
          </View>
        </Animated.View>
      )}

    {/* List */}
    {previewEligible && previewFiltersSupported && mediaUserId ? (
      <RemoteJournalList key={mediaUserId} userId={mediaUserId} searchQuery={deferredSearchQuery}
        onOpenDream={openRemoteDream} header={isDesktopLayout ? undefined : listHeader} bottomInset={overlayNavClearance}
        onScroll={handleStaticListScroll} />
    ) : isDesktopLayout ? (
      <AnimatedDreamList
        onLoad={onListLoaded}
        testID={TID.List.Dreams}
        ref={flatListRef}
        // Web grid measurements can arrive after filtering removed their row.
        // Recreate the grid when its item membership changes to discard stale layouts.
        key={`desktop-${desktopColumns}-${Platform.OS === 'web' ? visibleItems.map(keyExtractor).join(',') : ''}`}
        data={visibleItems}
        onEndReached={hasMore ? loadMore : undefined}
        onEndReachedThreshold={0.5}
        ListFooterComponent={listFooter}
        keyExtractor={keyExtractor}
        renderItem={renderDreamItemDesktop}
        extraData={storyGlowKey ?? undefined}
        // Perf: helps FlashList recycle views by layout type to reduce scroll-time layout work.
        getItemType={getDreamItemType}
        numColumns={desktopColumns}
        contentContainerStyle={listContentDesktopStyle}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
        onScrollBeginDrag={handleScrollBegin}
        onScrollEndDrag={scheduleIdle}
        onMomentumScrollBegin={handleScrollBegin}
        onMomentumScrollEnd={scheduleIdle}
      />
    ) : (
      <View style={{ flex: 1 }}>
      <AnimatedDreamList
        onLoad={onListLoaded}
        testID={TID.List.Dreams}
        ref={flatListRef}
        // Like the desktop grid, discard stale web measurements after filtering.
        key={isWeb ? `${mobileListKey}-${visibleItems.map(keyExtractor).join(',')}` : mobileListKey}
        data={visibleItems}
        onEndReached={hasMore ? loadMore : undefined}
        onEndReachedThreshold={0.5}
        ListFooterComponent={listFooter}
        keyExtractor={keyExtractor}
        renderItem={listColumns > 1 ? renderDreamItemTablet : renderDreamItem}
        extraData={storyGlowKey ?? undefined}
        numColumns={listColumns}
        // Perf: helps FlashList recycle views by layout type to reduce scroll-time layout work.
        getItemType={getDreamItemType}
        contentContainerStyle={listContentStyle}
        // Keep layout styles on the wrapper: Reanimated supplies style arrays,
        // while FlashList's web container spreads its style as an object.
        ListHeaderComponent={listHeader}
        onScroll={isWeb ? handleStaticListScroll : handleListScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={isWeb ? 'none' : 'on-drag'}
        {...webUserScrollInput}
        contentInsetAdjustmentBehavior="never"
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
        onScrollBeginDrag={handleScrollBegin}
        onScrollEndDrag={scheduleIdle}
        onMomentumScrollBegin={handleScrollBegin}
        onMomentumScrollEnd={scheduleIdle}
      />
      </View>
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
    {sharedDream ? (
      <DreamShareComposer dream={sharedDream} visible={shareTarget?.open ?? false} onClose={closeDreamShare} />
    ) : null}
    </KeyboardAvoidingView>
  );
}

export default withHeaderScroll(JournalListScreen);
