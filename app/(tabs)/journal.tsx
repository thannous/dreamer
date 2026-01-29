import { UpsellCard } from '@/components/guest/UpsellCard';
import { DreamIcon } from '@/components/icons/DreamIcons';
import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { PageHeader } from '@/components/inspiration/PageHeader';
import { DateRangePicker } from '@/components/journal/DateRangePicker';
import { DreamCard } from '@/components/journal/DreamCard';
import { EmptyState } from '@/components/journal/EmptyState';
import { FilterBar } from '@/components/journal/FilterBar';
import { SearchBar } from '@/components/journal/SearchBar';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { JOURNAL_LIST } from '@/constants/appConfig';
import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { ADD_BUTTON_RESERVED_SPACE, DESKTOP_BREAKPOINT, LAYOUT_MAX_WIDTH, TAB_BAR_HEIGHT } from '@/constants/layout';
import { useDreams } from '@/context/DreamsContext';
import { useTheme } from '@/context/ThemeContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useTranslation } from '@/hooks/useTranslation';
import { blurActiveElement } from '@/lib/accessibility';
import { applyFilters, getUniqueDreamTypes, getUniqueThemes, sortDreamsByDate } from '@/lib/dreamFilters';
import { getDreamThemeLabel, getDreamTypeLabel } from '@/lib/dreamLabels';
import { isDreamAnalyzed } from '@/lib/dreamUsage';
import { getDreamThumbnailUri, preloadImage } from '@/lib/imageUtils';
import { TID } from '@/lib/testIDs';
import type { DreamAnalysis, DreamTheme, DreamType } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { FlashList, type FlashListRef, type ListRenderItemInfo } from '@shopify/flash-list';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import React, { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeInDown, SlideInDown } from 'react-native-reanimated';

const SCROLL_IDLE_MS = 140;
const PREFETCH_CACHE_LIMIT = 250;
const PREFETCH_MAX_PER_FLUSH = 8;
const MAX_ANIMATED_ITEMS = 15;

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
  const { colors, shadows } = useTheme();
  const { t } = useTranslation();
  useClearWebFocus();
  const { formatShortDate: formatDreamListDate } = useLocaleFormatting();
  const flatListRef = useRef<FlashListRef<DreamAnalysis>>(null);
  const { width } = useWindowDimensions();

  const isDesktopLayout = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
  const isNative = Platform.OS !== 'web';
  const desktopColumns = width >= 1440 ? 4 : 3;

  const [showHeaderAnimations, setShowHeaderAnimations] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setShowHeaderAnimations(true);
      return () => setShowHeaderAnimations(false);
    }, []),
  );

  // Native search bar
  const navigation = useNavigation();
  useLayoutEffect(() => {
    if (isNative) {
      navigation.setOptions({
        headerShown: true,
        headerTitle: t('journal.title'),
        headerLargeTitle: true,
        headerStyle: { backgroundColor: colors.backgroundDark },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
        headerSearchBarOptions: {
          placeholder: t('journal.search_placeholder'),
          onChangeText: (event: { nativeEvent: { text: string } }) => {
            setSearchQuery(event.nativeEvent.text);
          },
          hideWhenScrolling: true,
          tintColor: colors.accent,
          textColor: colors.textPrimary,
          headerIconColor: colors.textSecondary,
        },
      });
    }
  }, [isNative, navigation, t, colors]);

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

  // Track which items have been animated to prevent re-animation on FlashList recycle
  const animatedIdsRef = useRef(new Set<number>());

  // Modal states
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  useEffect(() => {
    if (showThemeModal || showDateModal) {
      blurActiveElement();
    }
  }, [showDateModal, showThemeModal]);

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

  // Animations
  const floatingOffset = TAB_BAR_HEIGHT;
  // Always show add button - quota is now enforced on analysis, not recording
  const showAddButton = true;
  const listBottomPadding = floatingOffset + (showAddButton ? ADD_BUTTON_RESERVED_SPACE + ThemeLayout.spacing.xs : ThemeLayout.spacing.sm);
  const desktopDateTextStyle = useMemo(() => [styles.desktopDate, { color: colors.textSecondary }], [colors.textSecondary]);
  const listContentStyle = useMemo(
    () => [styles.listContent, { paddingBottom: listBottomPadding }],
    [listBottomPadding]
  );
  const listContentDesktopStyle = useMemo(
    () => [styles.listContent, styles.listContentDesktop, { paddingBottom: listBottomPadding }],
    [listBottomPadding]
  );
  const filtersContainerStyle = useMemo(
    () => [styles.filtersContainer, isDesktopLayout && styles.filtersContainerDesktop],
    [isDesktopLayout]
  );

  // Get available themes
  const availableThemes = useMemo(() => getUniqueThemes(dreams), [dreams]);
  const availableDreamTypes = useMemo(() => getUniqueDreamTypes(dreams), [dreams]);

  // Apply filters and sort
  const filteredDreams = useMemo(() => {
    const filtered = applyFilters(dreams, {
      searchQuery: deferredSearchQuery,
      theme: selectedTheme,
      dreamType: selectedDreamType,
      startDate: dateRange.start,
      endDate: dateRange.end,
      favoritesOnly: showFavoritesOnly,
      analyzedOnly: showAnalyzedOnly,
      exploredOnly: showExploredOnly,
    }, {
      searchOptions: {
        dreamTypeLabelResolver: (dreamType) => getDreamTypeLabel(dreamType, t),
      },
    });
    return sortDreamsByDate(filtered, false); // Newest first
  }, [dreams, deferredSearchQuery, selectedTheme, selectedDreamType, dateRange, showFavoritesOnly, showAnalyzedOnly, showExploredOnly, t]);

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
  }, [deferredSearchQuery, selectedTheme, selectedDreamType, dateRange, showFavoritesOnly, showAnalyzedOnly, showExploredOnly]);

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
  }, []);

  const handleThemeSelect = useCallback((theme: DreamTheme) => {
    setSelectedTheme(theme === selectedTheme ? null : theme);
    setShowThemeModal(false);
  }, [selectedTheme]);

  const handleDreamTypeSelect = useCallback((dreamType: DreamType) => {
    setSelectedDreamType((current) => (dreamType === current ? null : dreamType));
    setShowThemeModal(false);
  }, []);

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

  const renderDreamItem = useCallback(({ item, index }: ListRenderItemInfo<DreamAnalysis>) => {
    const dreamTypeLabel = item.dreamType ? getDreamTypeLabel(item.dreamType, t) ?? item.dreamType : null;
    const dateStr = formatDreamListDate(item.id) + (dreamTypeLabel ? ` • ${dreamTypeLabel}` : '');
    const isFirstItem = index === 0;

    // Stagger enter animation only for the first batch; skip if already animated
    const shouldAnimate = index < MAX_ANIMATED_ITEMS && !animatedIdsRef.current.has(item.id);
    if (shouldAnimate) {
      animatedIdsRef.current.add(item.id);
    }

    const card = (
      <DreamCard
        dream={item}
        onPress={handleDreamPress}
        isScrolling={isScrolling}
        testID={TID.List.DreamItem(item.id)}
        dateLabel={dateStr}
        variant={isFirstItem ? 'featured' : 'standard'}
      />
    );

    if (shouldAnimate) {
      return (
        <Animated.View
          style={styles.listItem}
          entering={FadeInDown.delay(index * 30).duration(300).springify()}
        >
          {card}
        </Animated.View>
      );
    }

    return (
      <View style={styles.listItem}>
        {card}
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

    return (
      <View
        style={[
          styles.desktopCardWrapper,
          isHero && styles.desktopCardHero,
          !isHero && isFavorite && styles.desktopCardFavorite,
          !isHero && !isFavorite && isAnalyzed && styles.desktopCardAnalyzed,
          !isHero && !isFavorite && !isAnalyzed && hasImage && styles.desktopCardWithImage,
        ]}
      >
        <View style={styles.desktopMetaRow}> 
          <Text style={desktopDateTextStyle}>
            {formatDreamListDate(item.id)}
            {dreamTypeLabel ? ` • ${dreamTypeLabel}` : ''}
          </Text>
        </View>
        <DreamCard
          dream={item}
          onPress={handleDreamPress}
          isScrolling={isScrolling}
          testID={TID.List.DreamItem(item.id)}
        />
      </View>
    );
  }, [desktopDateTextStyle, formatDreamListDate, t, handleDreamPress, isScrolling]);

  const hasActiveFilter = !!(searchQuery || selectedTheme || selectedDreamType || dateRange.start || dateRange.end || showFavoritesOnly || showAnalyzedOnly || showExploredOnly);
  const renderEmptyState = useCallback(() => (
    <EmptyState hasActiveFilter={hasActiveFilter} />
  ), [hasActiveFilter]);

  const keyExtractor = useCallback((item: DreamAnalysis) => String(item.id), []);
  const getDreamItemType = useCallback(
    (item: DreamAnalysis, index: number) =>
      index === 0
        ? 'featured'
        : !item.imageGenerationFailed && (item.thumbnailUrl || item.imageUrl)
          ? 'with-image'
          : 'text-only',
    []
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDark }]} testID={TID.Screen.Journal}>
      {/* Atmospheric dreamlike background */}
      <AtmosphericBackground />

      {/* Header — only on web (native uses headerSearchBarOptions) */}
      {!isNative && (
        <PageHeader
          titleKey="journal.title"
          showAnimations={showHeaderAnimations}
          wrapInContainer={false}
          style={isDesktopLayout ? styles.headerDesktop : undefined}
        />
      )}

      {/* Search and Filters */}
      <View
        style={filtersContainerStyle}
      >
        {/* Custom SearchBar on web only — native uses header search bar */}
        {!isNative && (
          <SearchBar
            testID={TID.Component.SearchBar}
            inputTestID={TID.Input.SearchDreams}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('journal.search_placeholder')}
          />
        )}
        <FilterBar
          items={[
            {
              id: 'theme',
              label: t('journal.filter.theme'),
              active: selectedTheme !== null || selectedDreamType !== null,
              onPress: () => setShowThemeModal(true),
              testID: TID.Button.FilterTheme,
            },
            {
              id: 'date',
              label: t('journal.filter.date'),
              active: dateRange.start !== null || dateRange.end !== null,
              onPress: () => setShowDateModal(true),
              testID: TID.Button.FilterDate,
            },
            {
              id: 'favorites',
              label: t('journal.filter.favorites'),
              active: showFavoritesOnly,
              onPress: handleFavoritesToggle,
              testID: TID.Button.FilterFavorites,
            },
            {
              id: 'analyzed',
              active: showAnalyzedOnly,
              onPress: handleAnalyzedToggle,
              testID: TID.Button.FilterAnalyzed,
            },
            {
              id: 'explored',
              active: showExploredOnly,
              onPress: handleExploredToggle,
              testID: TID.Button.FilterExplored,
            },
          ]}
          onClear={handleClearFilters}
          dateRange={dateRange}
          selectedTheme={selectedTheme}
          selectedDreamType={selectedDreamType}
          clearTestID={TID.Button.ClearFilters}
        />
      </View>

      {/* Guest Upsell */}
      <View
        style={[
          styles.upsellContainer,
          isDesktopLayout && styles.upsellDesktop,
        ]}
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
          extraData={isScrolling}
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
          data={filteredDreams}
          extraData={isScrolling}
          keyExtractor={keyExtractor}
          renderItem={renderDreamItem}
          // Perf: helps FlashList recycle views by layout type to reduce scroll-time layout work.
          getItemType={getDreamItemType}
          contentContainerStyle={listContentStyle}
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

      {/* Add Dream Button */}
      {showAddButton && (
        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          style={[
            styles.floatingButtonContainer,
            isDesktopLayout && styles.floatingButtonDesktop,
            { bottom: floatingOffset - 60 },
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
        </Animated.View>
      )}

      {/* Theme Selection BottomSheet */}
      <BottomSheet
        visible={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        style={{ backgroundColor: colors.backgroundCard }}
        testID={TID.Modal.Theme}
      >
        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
          {t('journal.theme_modal.title')}
        </Text>
        <Text style={[styles.modalSubtext, { color: colors.textSecondary }]}>
          {t('journal.detail.theme_label')}
        </Text>
        {availableThemes.map((theme) => (
          <Pressable
            key={theme}
            style={[
              styles.modalOption,
              { backgroundColor: selectedTheme === theme ? colors.accent : colors.backgroundSecondary },
            ]}
            onPress={() => handleThemeSelect(theme)}
          >
            <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>
              {getDreamThemeLabel(theme, t) ?? theme}
            </Text>
            {selectedTheme === theme && (
              <View style={styles.modalOptionCheckWrapper}>
                <View style={[styles.modalOptionCheckBadge, { backgroundColor: colors.backgroundCard }]}>
                  <Ionicons name="checkmark" size={14} color={colors.accent} />
                </View>
              </View>
            )}
          </Pressable>
        ))}
        <View style={{ height: 16 }} />
        <Text style={[styles.modalSubtext, { color: colors.textSecondary }]}>
          {t('journal.detail.dream_type_label')}
        </Text>
        {availableDreamTypes.map((dreamType) => (
          <Pressable
            key={dreamType}
            style={[
              styles.modalOption,
              { backgroundColor: selectedDreamType === dreamType ? colors.accent : colors.backgroundSecondary },
            ]}
            onPress={() => handleDreamTypeSelect(dreamType)}
          >
            <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>
              {getDreamTypeLabel(dreamType, t) ?? dreamType}
            </Text>
            {selectedDreamType === dreamType && (
              <View style={styles.modalOptionCheckWrapper}>
                <View style={[styles.modalOptionCheckBadge, { backgroundColor: colors.backgroundCard }]}>
                  <Ionicons name="checkmark" size={14} color={colors.accent} />
                </View>
              </View>
            )}
          </Pressable>
        ))}
        <Pressable
          style={styles.modalCancelButton}
          onPress={() => setShowThemeModal(false)}
        >
          <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>
            {t('common.cancel')}
          </Text>
        </Pressable>
      </BottomSheet>

      {/* Date Range BottomSheet */}
      <BottomSheet
        visible={showDateModal}
        onClose={() => setShowDateModal(false)}
        style={{ backgroundColor: colors.backgroundCard }}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerDesktop: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: LAYOUT_MAX_WIDTH,
  },
  filtersContainer: {
    padding: ThemeLayout.spacing.md,
    gap: ThemeLayout.spacing.md,
  },
  filtersContainerDesktop: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: LAYOUT_MAX_WIDTH,
  },
  upsellContainer: {
    paddingHorizontal: ThemeLayout.spacing.md,
    marginBottom: ThemeLayout.spacing.sm,
  },
  listContent: {
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingBottom: ThemeLayout.spacing.xl,
  },
  listContentDesktop: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: LAYOUT_MAX_WIDTH,
  },
  upsellDesktop: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: LAYOUT_MAX_WIDTH,
  },
  desktopMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: ThemeLayout.spacing.xs,
  },
  desktopDate: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  desktopBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ThemeLayout.spacing.xs,
  },
  desktopBadge: {
    borderRadius: ThemeLayout.borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  desktopBadgeText: {
    fontSize: 11,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  desktopRow: {
    flexDirection: 'row',
    columnGap: ThemeLayout.spacing.md,
  },
  desktopColumnWrapper: {
    gap: ThemeLayout.spacing.lg,
    columnGap: ThemeLayout.spacing.lg,
    paddingHorizontal: ThemeLayout.spacing.sm,
  },
  desktopCardWrapper: {
    flex: 1,
    marginBottom: ThemeLayout.spacing.xl,
    paddingHorizontal: ThemeLayout.spacing.xs,
    minWidth: 0,
  },
  desktopCardHero: {
    flex: 2,
  },
  desktopCardFavorite: {
    flex: 1.5,
  },
  desktopCardAnalyzed: {
    flex: 1.3,
  },
  desktopCardWithImage: {
    flex: 1.2,
  },
  listItem: {
    marginBottom: ThemeLayout.spacing.lg,
  },
  // date style removed — date is now inside DreamCard as an overline
  // empty state styles moved to EmptyState component
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
    // shadow: applied via theme shadows.xl
  },
  addButtonText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: Fonts.spaceGrotesk.bold,
    marginBottom: ThemeLayout.spacing.md,
    textAlign: 'center',
  },
  modalSubtext: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
    marginBottom: ThemeLayout.spacing.md,
    textAlign: 'center',
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: ThemeLayout.spacing.md,
    borderRadius: ThemeLayout.borderRadius.sm,
    marginBottom: 8,
  },
  modalOptionText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.medium,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  modalOptionCheckWrapper: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  modalOptionCheckBadge: {
    position: 'absolute',
    right: ThemeLayout.spacing.md,
    top: '50%',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -11 }],
  },
  modalCancelButton: {
    marginTop: ThemeLayout.spacing.md,
    paddingVertical: 12,
  },
  modalCancelText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.medium,
    textAlign: 'center',
  },
});
