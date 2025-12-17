import { UpsellCard } from '@/components/guest/UpsellCard';
import { DreamIcon } from '@/components/icons/DreamIcons';
import { DateRangePicker } from '@/components/journal/DateRangePicker';
import { DreamCard } from '@/components/journal/DreamCard';
import { FilterBar } from '@/components/journal/FilterBar';
import { SearchBar } from '@/components/journal/SearchBar';
import { TimelineIndicator } from '@/components/journal/TimelineIndicator';
import { JOURNAL_LIST } from '@/constants/appConfig';
import { ThemeLayout } from '@/constants/journalTheme';
import { ADD_BUTTON_RESERVED_SPACE, DESKTOP_BREAKPOINT, LAYOUT_MAX_WIDTH, TAB_BAR_HEIGHT } from '@/constants/layout';
import { useDreams } from '@/context/DreamsContext';
import { useTheme } from '@/context/ThemeContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useModalSlide } from '@/hooks/useJournalAnimations';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useTranslation } from '@/hooks/useTranslation';
import { blurActiveElement } from '@/lib/accessibility';
import { applyFilters, getUniqueDreamTypes, getUniqueThemes, sortDreamsByDate } from '@/lib/dreamFilters';
import { getDreamThemeLabel, getDreamTypeLabel } from '@/lib/dreamLabels';
import { isDreamAnalyzed, isDreamExplored } from '@/lib/dreamUsage';
import { getDreamThumbnailUri, preloadImage } from '@/lib/imageUtils';
import { TID } from '@/lib/testIDs';
import type { DreamAnalysis, DreamTheme, DreamType } from '@/lib/types';
import { FlashList, type FlashListRef, type ListRenderItemInfo } from '@shopify/flash-list';
import { router } from 'expo-router';
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  type ViewToken,
  useWindowDimensions,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function JournalListScreen() {
  const { dreams } = useDreams();
  const { colors, shadows } = useTheme();
  const { t } = useTranslation();
  useClearWebFocus();
  const { formatShortDate: formatDreamListDate } = useLocaleFormatting();
  const flatListRef = useRef<FlashListRef<DreamAnalysis>>(null);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isDesktopLayout = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
  const desktopColumns = width >= 1440 ? 4 : 3;
  const webBackdropBlur: ViewStyle | undefined = Platform.OS === 'web'
    ? { backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' } as ViewStyle
    : undefined;

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

  // Modal states
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  useEffect(() => {
    if (showThemeModal || showDateModal) {
      blurActiveElement();
    }
  }, [showDateModal, showThemeModal]);

  const prefetchedImageUrisRef = useRef(new Set<string>());
  const viewabilityConfigRef = useRef({
    itemVisiblePercentThreshold: JOURNAL_LIST.VIEWABILITY_THRESHOLD,
    minimumViewTime: JOURNAL_LIST.MINIMUM_VIEW_TIME,
  });

  // Animations
  const themeModalAnim = useModalSlide(showThemeModal);
  const dateModalAnim = useModalSlide(showDateModal);
  const floatingOffset = TAB_BAR_HEIGHT;
  // Always show add button - quota is now enforced on analysis, not recording
  const showAddButton = true;
  const listBottomPadding = floatingOffset + (showAddButton ? ADD_BUTTON_RESERVED_SPACE + ThemeLayout.spacing.xs : ThemeLayout.spacing.sm);

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

  // Preload first items to warm expo-image cache (no setState during scroll)
  useEffect(() => {
    prefetchedImageUrisRef.current.clear();
    const initial = filteredDreams.slice(0, JOURNAL_LIST.INITIAL_VISIBLE_COUNT + JOURNAL_LIST.PRELOAD_BUFFER);
    initial.forEach((dream) => {
      const thumbnailUri = getDreamThumbnailUri(dream);
      if (!thumbnailUri || prefetchedImageUrisRef.current.has(thumbnailUri)) {
        return;
      }
      prefetchedImageUrisRef.current.add(thumbnailUri);
      void preloadImage(thumbnailUri);
    });
  }, [filteredDreams]);

  // Scroll to top when filters change
  useEffect(() => {
    if (filteredDreams.length > 0) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredSearchQuery, selectedTheme, selectedDreamType, dateRange, showFavoritesOnly, showAnalyzedOnly, showExploredOnly]);

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

  // Track viewable items for lazy loading with preloading
  const filteredDreamsRef = useRef(filteredDreams);
  useEffect(() => {
    filteredDreamsRef.current = filteredDreams;
  }, [filteredDreams]);

  interface ViewabilityInfo {
    viewableItems: ViewToken[];
    changed: ViewToken[];
  }

  const onViewableItemsChanged = useRef(({ viewableItems }: ViewabilityInfo) => {
    const currentFilteredDreams = filteredDreamsRef.current;
    const candidateIndexes = new Set<number>();

    viewableItems.forEach((item) => {
      if (typeof item.index !== 'number') {
        return;
      }
      for (let i = -JOURNAL_LIST.PRELOAD_BUFFER; i <= JOURNAL_LIST.PRELOAD_BUFFER; i++) {
        const idx = item.index + i;
        if (idx >= 0 && idx < currentFilteredDreams.length) {
          candidateIndexes.add(idx);
        }
      }
    });

    candidateIndexes.forEach((idx) => {
      const dream = currentFilteredDreams[idx];
      if (!dream?.imageUrl) {
        return;
      }

      const thumbnailUri = getDreamThumbnailUri(dream);
      if (!thumbnailUri || prefetchedImageUrisRef.current.has(thumbnailUri)) {
        return;
      }

      prefetchedImageUrisRef.current.add(thumbnailUri);
      void preloadImage(thumbnailUri);
    });
  }).current;

  const renderDreamItem = useCallback(({ item, index }: ListRenderItemInfo<DreamAnalysis>) => {
    const isFavorite = !!item.isFavorite;
    const isAnalyzed = isDreamAnalyzed(item);
    const isExplored = isDreamExplored(item);
    const dreamTypeLabel = item.dreamType ? getDreamTypeLabel(item.dreamType, t) ?? item.dreamType : null;

    const mobileBadges: { label?: string; icon?: string; variant?: 'accent' | 'secondary' }[] = [];

    if (isExplored) {
      mobileBadges.push({
        label: t('journal.badge.explored'),
        icon: 'chatbubble-ellipses-outline',
        variant: 'accent',
      });
    }
    if (!isExplored && isAnalyzed) {
      mobileBadges.push({
        label: t('journal.badge.analyzed'),
        icon: 'sparkles',
        variant: 'secondary',
      });
    }
    if (isFavorite) {
      mobileBadges.push({
        label: t('journal.badge.favorite'),
        icon: 'heart',
        variant: 'secondary',
      });
    }

    return (
      <View style={styles.timelineItem}>
        {/* Timeline indicator column */}
        <View style={styles.timelineColumn}>
          <TimelineIndicator dreamType={item.dreamType} />
          {/* Timeline line - don't show for last item */}
          {index < filteredDreams.length - 1 && <View style={[styles.timelineLine, { backgroundColor: colors.timeline }]} />}
        </View>

        {/* Content column */}
        <View style={styles.contentColumn}>
          <Text style={[styles.date, { color: colors.textSecondary }]}>
            {formatDreamListDate(item.id)}
            {dreamTypeLabel ? ` • ${dreamTypeLabel}` : ''}
          </Text>
          <DreamCard
            dream={item}
            onPress={() => router.push(`/journal/${item.id}`)}
            badges={mobileBadges}
            testID={TID.List.DreamItem(item.id)}
          />
        </View>
      </View>
    );
  }, [filteredDreams.length, colors, formatDreamListDate, t]);

  const renderDreamItemDesktop = useCallback(({ item, index }: ListRenderItemInfo<DreamAnalysis>) => {
    const hasImage = !!item.imageUrl && !item.imageGenerationFailed;
    const isRecent = index < 3;
    const isFavorite = !!item.isFavorite;
    const isAnalyzed = isDreamAnalyzed(item);
    const isExplored = isDreamExplored(item);
    const dreamTypeLabel = item.dreamType ? getDreamTypeLabel(item.dreamType, t) ?? item.dreamType : null;

    const isHero = isRecent && hasImage;
    const badges: { label?: string; icon?: string; variant?: 'accent' | 'secondary' }[] = [];

    if (isExplored) {
      badges.push({
        label: t('journal.badge.explored'),
        icon: 'chatbubble-ellipses-outline',
        variant: 'accent',
      });
    }
    if (!isExplored && isAnalyzed) {
      badges.push({
        label: t('journal.badge.analyzed'),
        icon: 'sparkles',
        variant: 'secondary',
      });
    }
    if (isFavorite) {
      badges.push({
        label: t('journal.badge.favorite'),
        icon: 'heart',
        variant: 'secondary',
      });
    }

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
          <Text style={[styles.desktopDate, { color: colors.textSecondary }] }>
            {formatDreamListDate(item.id)}
            {dreamTypeLabel ? ` • ${dreamTypeLabel}` : ''}
          </Text>
        </View>
        <DreamCard
          dream={item}
          onPress={() => router.push(`/journal/${item.id}`)}
          badges={badges}
          testID={TID.List.DreamItem(item.id)}
        />
      </View>
    );
  }, [colors, formatDreamListDate, t]);

  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyState}>
      <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
        {searchQuery || selectedTheme || dateRange.start || dateRange.end || showFavoritesOnly
          ? t('journal.empty.filtered')
          : t('journal.empty.default')}
      </Text>
    </View>
  ), [searchQuery, selectedTheme, dateRange.start, dateRange.end, showFavoritesOnly, colors, t]);

  const keyExtractor = useCallback((item: DreamAnalysis) => String(item.id), []);

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDark }]} testID={TID.Screen.Journal}>
      {/* Header */}
      <View
        style={[
          styles.header,
          isDesktopLayout && styles.headerDesktop,
          { paddingTop: insets.top + ThemeLayout.spacing.sm },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('journal.title')}</Text>
      </View>

      {/* Search and Filters */}
      <View
        style={[
          styles.filtersContainer,
          { backgroundColor: colors.backgroundDark },
          isDesktopLayout && styles.filtersContainerDesktop,
        ]}
      >
        <SearchBar
          testID={TID.Component.SearchBar}
          inputTestID={TID.Input.SearchDreams}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('journal.search_placeholder')}
        />
        <FilterBar
          onThemePress={() => setShowThemeModal(true)}
          onDatePress={() => setShowDateModal(true)}
          onFavoritesPress={handleFavoritesToggle}
          onAnalyzedPress={handleAnalyzedToggle}
          onExploredPress={handleExploredToggle}
          onClearPress={handleClearFilters}
          activeFilters={{
            theme: selectedTheme !== null || selectedDreamType !== null,
            date: dateRange.start !== null || dateRange.end !== null,
            favorites: showFavoritesOnly,
            analyzed: showAnalyzedOnly,
            explored: showExploredOnly,
          }}
          dateRange={dateRange}
          selectedTheme={selectedTheme}
          selectedDreamType={selectedDreamType}
          themeButtonTestID={TID.Button.FilterTheme}
          dateButtonTestID={TID.Button.FilterDate}
          favoritesButtonTestID={TID.Button.FilterFavorites}
          analyzedButtonTestID={TID.Button.FilterAnalyzed}
          exploredButtonTestID={TID.Button.FilterExplored}
          clearButtonTestID={TID.Button.ClearFilters}
        />
      </View>

      {/* Guest Upsell */}
      <View
        style={[
          { paddingHorizontal: ThemeLayout.spacing.md, marginBottom: ThemeLayout.spacing.sm },
          isDesktopLayout && styles.upsellDesktop,
        ]}
      >
        <UpsellCard />
      </View>

      {/* Timeline / Bento List */}
      {isDesktopLayout ? (
        <FlashList
          testID={TID.List.Dreams}
          ref={flatListRef}
          key={`desktop-${desktopColumns}`}
          data={filteredDreams}
          keyExtractor={keyExtractor}
          renderItem={renderDreamItemDesktop}
          numColumns={desktopColumns}
          contentContainerStyle={[styles.listContent, styles.listContentDesktop, { paddingBottom: listBottomPadding }]}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          viewabilityConfig={viewabilityConfigRef.current}
          onViewableItemsChanged={onViewableItemsChanged}
        />
      ) : (
        <FlashList
          testID={TID.List.Dreams}
          ref={flatListRef}
          data={filteredDreams}
          keyExtractor={keyExtractor}
          renderItem={renderDreamItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPadding }]}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          viewabilityConfig={viewabilityConfigRef.current}
          onViewableItemsChanged={onViewableItemsChanged}
        />
      )}

      {/* Add Dream Button */}
      {showAddButton && (
        <View
          style={[
            styles.floatingButtonContainer,
            isDesktopLayout && styles.floatingButtonDesktop,
            { bottom: floatingOffset },
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
        </View>
      )}

      {/* Theme Selection Modal */}
      <Modal
        visible={showThemeModal}
        animationType="none"
        transparent
        onRequestClose={() => setShowThemeModal(false)}
      >
        <Animated.View
          style={[
            styles.modalOverlay,
            webBackdropBlur,
            { backgroundColor: colors.overlay },
            themeModalAnim.backdropStyle,
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowThemeModal(false)} />
          <Animated.View
            style={[styles.modalContent, { backgroundColor: colors.backgroundCard }, themeModalAnim.contentStyle]}
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
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Date Range Modal */}
      <Modal
        visible={showDateModal}
        animationType="none"
        transparent
        onRequestClose={() => setShowDateModal(false)}
      >
        <Animated.View
          style={[
            styles.modalOverlay,
            webBackdropBlur,
            { backgroundColor: colors.overlay },
            dateModalAnim.backdropStyle,
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowDateModal(false)} />
          <Animated.View style={dateModalAnim.contentStyle} testID={TID.Modal.DateRange}>
            <DateRangePicker
              startDate={dateRange.start}
              endDate={dateRange.end}
              onRangeChange={handleDateRangeChange}
              onClose={() => setShowDateModal(false)}
            />
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: ThemeLayout.spacing.sm,
    alignItems: 'center',
  },
  headerDesktop: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: LAYOUT_MAX_WIDTH,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: -0.3,
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
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
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
    fontFamily: 'SpaceGrotesk_500Medium',
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
  timelineItem: {
    flexDirection: 'row',
    marginBottom: ThemeLayout.spacing.lg,
  },
  timelineColumn: {
    width: 36,
    alignItems: 'center',
    marginRight: ThemeLayout.spacing.md,
  },
  timelineLine: {
    flex: 1,
    width: ThemeLayout.timelineLineWidth,
    marginTop: 4,
  },
  contentColumn: {
    flex: 1,
  },
  date: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    marginBottom: 8,
    marginLeft: 4,
  },
  emptyState: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_400Regular',
    textAlign: 'center',
    lineHeight: 24,
  },
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
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: ThemeLayout.spacing.lg,
  },
  modalContent: {
    borderRadius: ThemeLayout.borderRadius.lg,
    padding: ThemeLayout.spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginBottom: ThemeLayout.spacing.md,
    textAlign: 'center',
  },
  modalSubtext: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
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
    fontFamily: 'SpaceGrotesk_500Medium',
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  modalCancelButton: {
    marginTop: ThemeLayout.spacing.md,
    paddingVertical: 12,
  },
  modalCancelText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_500Medium',
    textAlign: 'center',
  },
});
