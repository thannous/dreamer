import { DateRangePicker } from '@/components/journal/DateRangePicker';
import { DreamCard } from '@/components/journal/DreamCard';
import { FilterBar } from '@/components/journal/FilterBar';
import { SearchBar } from '@/components/journal/SearchBar';
import { TimelineIndicator } from '@/components/journal/TimelineIndicator';
import { ThemeLayout } from '@/constants/journalTheme';
import { useDreams } from '@/context/DreamsContext';
import { useTheme } from '@/context/ThemeContext';
import { useModalSlide } from '@/hooks/useJournalAnimations';
import { applyFilters, getUniqueThemes, sortDreamsByDate } from '@/lib/dreamFilters';
import { TID } from '@/lib/testIDs';
import type { DreamAnalysis } from '@/lib/types';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from '@/hooks/useTranslation';
import { UpsellCard } from '@/components/guest/UpsellCard';

function AddIcon({ size = 24, color = '#1a0f2b' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill={color} />
    </Svg>
  );
}

export default function JournalListScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const { dreams, guestLimitReached } = useDreams();
  const { colors, shadows } = useTheme();
  const { t } = useTranslation();
  const { formatShortDate: formatDreamListDate } = useLocaleFormatting();
  const flatListRef = useRef<FlatList>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });

  // Modal states
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);

  // Lazy loading state - track which items should load images
  const [visibleItemIds, setVisibleItemIds] = useState<Set<number>>(new Set());
  const viewabilityConfigRef = useRef({
    itemVisiblePercentThreshold: 10, // Consider item visible when 10% is shown
    minimumViewTime: 100,
  });

  // Animations
  const themeModalAnim = useModalSlide(showThemeModal);
  const dateModalAnim = useModalSlide(showDateModal);
  const floatingOffset = tabBarHeight + ThemeLayout.spacing.xl;
  const showAddButton = !guestLimitReached;
  const listBottomPadding = floatingOffset + (showAddButton ? 132 : 0);

  // Get available themes
  const availableThemes = useMemo(() => getUniqueThemes(dreams), [dreams]);

  // Apply filters and sort
  const filteredDreams = useMemo(() => {
    const filtered = applyFilters(dreams, {
      searchQuery,
      theme: selectedTheme,
      startDate: dateRange.start,
      endDate: dateRange.end,
    });
    return sortDreamsByDate(filtered, false); // Newest first
  }, [dreams, searchQuery, selectedTheme, dateRange]);

  // Initialize visible items with first 5 dreams for immediate loading
  useEffect(() => {
    if (filteredDreams.length > 0) {
      const initialIds = new Set(filteredDreams.slice(0, 5).map(d => d.id));
      setVisibleItemIds(initialIds);
    }
  }, [filteredDreams]);

  // Scroll to top when filters change
  useEffect(() => {
    if (filteredDreams.length > 0) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedTheme, dateRange]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedTheme(null);
    setDateRange({ start: null, end: null });
  }, []);

  const handleThemeSelect = useCallback((theme: string) => {
    setSelectedTheme(theme === selectedTheme ? null : theme);
    setShowThemeModal(false);
  }, [selectedTheme]);

  const handleDateRangeChange = useCallback((start: Date | null, end: Date | null) => {
    setDateRange({ start, end });
  }, []);

  // Track viewable items for lazy loading with preloading
  const filteredDreamsRef = useRef(filteredDreams);
  useEffect(() => {
    filteredDreamsRef.current = filteredDreams;
  }, [filteredDreams]);

  const onViewableItemsChanged = useRef(({ viewableItems, changed }: any) => {
    const newVisibleIds = new Set<number>();

    // Add currently visible items
    viewableItems.forEach((item: any) => {
      if (item.item?.id) {
        newVisibleIds.add(item.item.id);
      }
    });

    // Preload images for items near the viewport (2 items ahead and behind)
    const PRELOAD_BUFFER = 2;
    const currentFilteredDreams = filteredDreamsRef.current;
    viewableItems.forEach((item: any) => {
      if (item.index !== null && item.index !== undefined) {
        // Preload items ahead
        for (let i = 1; i <= PRELOAD_BUFFER; i++) {
          const nextIndex = item.index + i;
          if (nextIndex < currentFilteredDreams.length) {
            newVisibleIds.add(currentFilteredDreams[nextIndex].id);
          }
        }
        // Preload items behind
        for (let i = 1; i <= PRELOAD_BUFFER; i++) {
          const prevIndex = item.index - i;
          if (prevIndex >= 0) {
            newVisibleIds.add(currentFilteredDreams[prevIndex].id);
          }
        }
      }
    });

    setVisibleItemIds(newVisibleIds);
  }).current;

  const renderDreamItem = useCallback(({ item, index }: { item: DreamAnalysis; index: number }) => {
    const shouldLoadImage = visibleItemIds.has(item.id) || index < 5; // Load first 5 immediately

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
          <Text style={[styles.date, { color: colors.textSecondary }]}>{formatDreamListDate(item.id)}</Text>
          <DreamCard
            dream={item}
            onPress={() => router.push(`/journal/${item.id}`)}
            index={index}
            shouldLoadImage={shouldLoadImage}
            testID={TID.List.DreamItem(item.id)}
          />
        </View>
      </View>
    );
  }, [filteredDreams.length, visibleItemIds, colors, formatDreamListDate]);

  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyState}>
      <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
        {searchQuery || selectedTheme || dateRange.start || dateRange.end
          ? t('journal.empty.filtered')
          : t('journal.empty.default')}
      </Text>
    </View>
  ), [searchQuery, selectedTheme, dateRange.start, dateRange.end, colors, t]);

  const keyExtractor = useCallback((item: DreamAnalysis) => String(item.id), []);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: 140, // Approximate item height
    offset: 140 * index,
    index,
  }), []);

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDark }]} testID={TID.Screen.Journal}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('journal.title')}</Text>
      </View>

      {/* Search and Filters */}
      <View style={[styles.filtersContainer, { backgroundColor: colors.backgroundDark }]}>
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
          onClearPress={handleClearFilters}
          activeFilters={{
            theme: selectedTheme !== null,
            date: dateRange.start !== null || dateRange.end !== null,
          }}
          dateRange={dateRange}
          selectedTheme={selectedTheme}
          themeButtonTestID={TID.Button.FilterTheme}
          dateButtonTestID={TID.Button.FilterDate}
          clearButtonTestID={TID.Button.ClearFilters}
        />
      </View>

      {/* Guest Upsell */}
      <View style={{ paddingHorizontal: ThemeLayout.spacing.md, marginBottom: ThemeLayout.spacing.sm }}>
        <UpsellCard />
      </View>

      {/* Timeline List */}
      <FlatList
        testID={TID.List.Dreams}
        ref={flatListRef}
        data={filteredDreams}
        extraData={visibleItemIds}
        keyExtractor={keyExtractor}
        renderItem={renderDreamItem}
        getItemLayout={getItemLayout}
        contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPadding }]}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={21}
        viewabilityConfig={viewabilityConfigRef.current}
        onViewableItemsChanged={onViewableItemsChanged}
      />

      {/* Add Dream Button */}
      {showAddButton && (
        <View style={[styles.floatingButtonContainer, { bottom: floatingOffset }]}>
          <Pressable
            style={[styles.addButton, shadows.xl, { backgroundColor: colors.accent }]}
            onPress={() => router.push('/recording')}
            accessibilityRole="button"
            testID={TID.Button.AddDream}
            accessibilityLabel={t('journal.add_button.accessibility')}
          >
            <AddIcon size={24} color={colors.backgroundCard} />
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
        onRequestClose={() => setShowThemeModal(false)}
      >
        <Animated.View
          style={[styles.modalOverlay, { backgroundColor: colors.backgroundDark }, themeModalAnim.backdropStyle]}
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowThemeModal(false)} />
          <Animated.View
            style={[styles.modalContent, { backgroundColor: colors.backgroundCard }, themeModalAnim.contentStyle]}
            testID={TID.Modal.Theme}
          >
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {t('journal.theme_modal.title')}
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
                <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>{theme}</Text>
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
        onRequestClose={() => setShowDateModal(false)}
      >
        <Animated.View
          style={[styles.modalOverlay, dateModalAnim.backdropStyle]}
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
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
  headerTitle: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: -0.3,
  },
  filtersContainer: {
    padding: ThemeLayout.spacing.md,
    gap: ThemeLayout.spacing.md,
  },
  listContent: {
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingBottom: ThemeLayout.spacing.xl,
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
    left: 0,
    right: 0,
    padding: ThemeLayout.spacing.md,
    backgroundColor: 'transparent',
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
