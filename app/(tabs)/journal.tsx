import { DateRangePicker } from '@/components/journal/DateRangePicker';
import { DreamCard } from '@/components/journal/DreamCard';
import { FilterBar } from '@/components/journal/FilterBar';
import { SearchBar } from '@/components/journal/SearchBar';
import { TimelineIndicator } from '@/components/journal/TimelineIndicator';
import { JournalTheme } from '@/constants/journalTheme';
import { useDreams } from '@/context/DreamsContext';
import { useModalSlide } from '@/hooks/useJournalAnimations';
import { formatShortDate } from '@/lib/dateUtils';
import { applyFilters, getUniqueThemes, sortDreamsByDate } from '@/lib/dreamFilters';
import type { DreamAnalysis } from '@/lib/types';
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

function AddIcon({ size = 24, color = '#1a0f2b' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill={color} />
    </Svg>
  );
}

export default function JournalListScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const { dreams } = useDreams();
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
  const floatingOffset = tabBarHeight + JournalTheme.spacing.xl;
  const listBottomPadding = floatingOffset + 132;

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
          {index < filteredDreams.length - 1 && <View style={styles.timelineLine} />}
        </View>

        {/* Content column */}
        <View style={styles.contentColumn}>
          <Text style={styles.date}>{formatShortDate(item.id)}</Text>
          <DreamCard
            dream={item}
            onPress={() => router.push(`/journal/${item.id}`)}
            index={index}
            shouldLoadImage={shouldLoadImage}
          />
        </View>
      </View>
    );
  }, [filteredDreams.length, visibleItemIds]);

  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>
        {searchQuery || selectedTheme || dateRange.start || dateRange.end
          ? 'No dreams match your filters'
          : 'No dreams yet.\nStart recording your dreams!'}
      </Text>
    </View>
  ), [searchQuery, selectedTheme, dateRange.start, dateRange.end]);

  const keyExtractor = useCallback((item: DreamAnalysis) => String(item.id), []);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: 140, // Approximate item height
    offset: 140 * index,
    index,
  }), []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dream Journey</Text>
      </View>

      {/* Search and Filters */}
      <View style={styles.filtersContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search your dream journey..."
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
        />
      </View>

      {/* Timeline List */}
      <FlatList
        ref={flatListRef}
        data={filteredDreams}
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
      <View style={[styles.floatingButtonContainer, { bottom: floatingOffset }]}>
        <Pressable
          style={styles.addButton}
          onPress={() => router.push('/recording')}
          accessibilityRole="button"
        >
          <AddIcon size={24} color={JournalTheme.backgroundCard} />
          <Text style={styles.addButtonText}>Add New Dream</Text>
        </Pressable>
      </View>

      {/* Theme Selection Modal */}
      <Modal
        visible={showThemeModal}
        animationType="none"
        onRequestClose={() => setShowThemeModal(false)}
      >
        <Animated.View
          style={[styles.modalOverlay, themeModalAnim.backdropStyle]}
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowThemeModal(false)} />
          <Animated.View style={[styles.modalContent, themeModalAnim.contentStyle]}>
            <Text style={styles.modalTitle}>Select Theme</Text>
            {availableThemes.map((theme) => (
              <Pressable
                key={theme}
                style={[
                  styles.modalOption,
                  selectedTheme === theme && styles.modalOptionSelected,
                ]}
                onPress={() => handleThemeSelect(theme)}
              >
                <Text style={styles.modalOptionText}>{theme}</Text>
              </Pressable>
            ))}
            <Pressable
              style={styles.modalCancelButton}
              onPress={() => setShowThemeModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
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
          <Animated.View style={dateModalAnim.contentStyle}>
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
    backgroundColor: JournalTheme.backgroundDark,
  },
  header: {
    paddingHorizontal: JournalTheme.spacing.md,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: JournalTheme.spacing.sm,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: JournalTheme.textPrimary,
    letterSpacing: -0.3,
  },
  filtersContainer: {
    padding: JournalTheme.spacing.md,
    gap: JournalTheme.spacing.md,
    backgroundColor: JournalTheme.backgroundDark,
  },
  listContent: {
    paddingHorizontal: JournalTheme.spacing.md,
    paddingBottom: JournalTheme.spacing.xl,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: JournalTheme.spacing.lg,
  },
  timelineColumn: {
    width: 36,
    alignItems: 'center',
    marginRight: JournalTheme.spacing.md,
  },
  timelineLine: {
    flex: 1,
    width: JournalTheme.timelineLineWidth,
    backgroundColor: JournalTheme.timeline,
    marginTop: 4,
  },
  contentColumn: {
    flex: 1,
  },
  date: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: JournalTheme.textSecondary,
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
    color: JournalTheme.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  floatingButtonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    padding: JournalTheme.spacing.md,
    backgroundColor: 'transparent',
  },
  addButton: {
    backgroundColor: JournalTheme.accent,
    borderRadius: JournalTheme.borderRadius.full,
    paddingVertical: JournalTheme.spacing.md,
    paddingHorizontal: JournalTheme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: JournalTheme.backgroundCard,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: JournalTheme.backgroundDark,
    justifyContent: 'center',
    alignItems: 'center',
    padding: JournalTheme.spacing.lg,
  },
  modalContent: {
    backgroundColor: JournalTheme.backgroundCard,
    borderRadius: JournalTheme.borderRadius.lg,
    padding: JournalTheme.spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: JournalTheme.textPrimary,
    marginBottom: JournalTheme.spacing.md,
    textAlign: 'center',
  },
  modalSubtext: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: JournalTheme.textSecondary,
    marginBottom: JournalTheme.spacing.md,
    textAlign: 'center',
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: JournalTheme.spacing.md,
    borderRadius: JournalTheme.borderRadius.sm,
    marginBottom: 8,
    backgroundColor: JournalTheme.backgroundSecondary,
  },
  modalOptionSelected: {
    backgroundColor: JournalTheme.accent,
  },
  modalOptionText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: JournalTheme.textPrimary,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  modalCancelButton: {
    marginTop: JournalTheme.spacing.md,
    paddingVertical: 12,
  },
  modalCancelText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: JournalTheme.textSecondary,
    textAlign: 'center',
  },
});
