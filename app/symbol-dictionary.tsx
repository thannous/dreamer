import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CategoryHeader } from '@/components/symbols/CategoryHeader';
import { SymbolCard } from '@/components/symbols/SymbolCard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import type { DreamSymbol, SymbolCategory, SymbolLanguage } from '@/lib/symbolTypes';
import {
  getCategoryList,
  getCategoryName,
  getSymbolsByCategory,
  searchSymbols,
} from '@/services/symbolDictionaryService';

type Section = {
  category: SymbolCategory;
  data: DreamSymbol[];
};

type Row =
  | {
      type: 'header';
      id: string;
      category: SymbolCategory;
      count: number;
    }
  | {
      type: 'item';
      id: string;
      symbol: DreamSymbol;
    };

export default function SymbolDictionaryScreen() {
  const { colors } = useTheme();
  const { t, currentLang } = useTranslation();
  const lang = (currentLang ?? 'en') as SymbolLanguage;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SymbolCategory | null>(null);

  const categories = useMemo(() => getCategoryList(), []);

  const sections: Section[] = useMemo(() => {
    if (searchQuery.trim()) {
      const results = searchSymbols(searchQuery.trim(), lang);
      if (results.length === 0) return [];

      if (selectedCategory) {
        const filtered = results.filter((s) => s.category === selectedCategory);
        if (filtered.length === 0) return [];
        return [{ category: selectedCategory, data: filtered }];
      }

      const grouped = new Map<SymbolCategory, DreamSymbol[]>();
      for (const s of results) {
        const list = grouped.get(s.category) ?? [];
        list.push(s);
        grouped.set(s.category, list);
      }
      return categories
        .filter((c) => grouped.has(c))
        .map((c) => ({ category: c, data: grouped.get(c)! }));
    }

    if (selectedCategory) {
      return [{ category: selectedCategory, data: getSymbolsByCategory(selectedCategory) }];
    }

    return categories.map((c) => ({
      category: c,
      data: getSymbolsByCategory(c),
    }));
  }, [searchQuery, selectedCategory, lang, categories]);

  const listData: Row[] = useMemo(() => {
    const rows: Row[] = [];
    sections.forEach((section) => {
      rows.push({
        type: 'header',
        id: `header-${section.category}`,
        category: section.category,
        count: section.data.length,
      });
      section.data.forEach((symbol) => {
        rows.push({
          type: 'item',
          id: symbol.id,
          symbol,
        });
      });
    });
    return rows;
  }, [sections]);

  const handleSymbolPress = useCallback((id: string) => {
    router.push(`/symbol-detail/${id}` as any);
  }, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Row>) => {
      if (item.type === 'header') {
        return (
          <CategoryHeader category={item.category} count={item.count} language={lang} />
        );
      }
      return <SymbolCard symbol={item.symbol} language={lang} onPress={handleSymbolPress} />;
    },
    [lang, handleSymbolPress],
  );

  const keyExtractor = useCallback((item: Row) => item.id, []);
  const getItemType = useCallback((item: Row) => item.type, []);

  const renderEmptyComponent = useCallback(
    () => (
      <View style={styles.emptyState}>
        <IconSymbol name="magnifyingglass" size={32} color={colors.textTertiary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {t('symbols.no_results')}
        </Text>
      </View>
    ),
    [colors.textSecondary, colors.textTertiary, t],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDark }]}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.backgroundCard }]}>
          <IconSymbol name="magnifyingglass" size={18} color={colors.textTertiary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('symbols.search_placeholder')}
            placeholderTextColor={colors.textTertiary}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <IconSymbol name="xmark.circle.fill" size={18} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>

        {/* Category filter chips */}
        <View style={styles.chipRow}>
          <Pressable
            onPress={() => setSelectedCategory(null)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor:
                  selectedCategory === null ? colors.accent : colors.backgroundCard,
              },
              pressed && styles.chipPressed,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color:
                    selectedCategory === null
                      ? colors.textOnAccentSurface
                      : colors.textSecondary,
                },
              ]}
            >
              {t('symbols.all_categories')}
            </Text>
          </Pressable>
          {categories.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor:
                    selectedCategory === cat ? colors.accent : colors.backgroundCard,
                },
                pressed && styles.chipPressed,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color:
                      selectedCategory === cat
                        ? colors.textOnAccentSurface
                        : colors.textSecondary,
                  },
                ]}
              >
                {getCategoryName(cat, lang)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Symbol list */}
      <FlashList
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyComponent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingTop: ThemeLayout.spacing.sm,
    paddingBottom: ThemeLayout.spacing.xs,
    gap: ThemeLayout.spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: ThemeLayout.borderRadius.md,
    borderCurve: 'continuous',
    paddingHorizontal: ThemeLayout.spacing.md,
    gap: ThemeLayout.spacing.sm,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 15,
    paddingVertical: 0,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ThemeLayout.spacing.xs,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: ThemeLayout.borderRadius.full,
  },
  chipPressed: {
    opacity: 0.8,
  },
  chipText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
  },
  listContent: {
    paddingBottom: ThemeLayout.spacing.xl,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: ThemeLayout.spacing.sm,
  },
  emptyText: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 15,
    textAlign: 'center',
  },
});
