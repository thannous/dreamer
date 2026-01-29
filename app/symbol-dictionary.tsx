import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, Text, TextInput, View } from 'react-native';

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

  const handleSymbolPress = useCallback((id: string) => {
    router.push(`/symbol-detail/${id}` as any);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: DreamSymbol }) => (
      <SymbolCard symbol={item} language={lang} onPress={() => handleSymbolPress(item.id)} />
    ),
    [lang, handleSymbolPress],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => (
      <CategoryHeader category={section.category} count={section.data.length} language={lang} />
    ),
    [lang],
  );

  const keyExtractor = useCallback((item: DreamSymbol) => item.id, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.backgroundDark }}>
      {/* Search bar */}
      <View
        style={{
          paddingHorizontal: ThemeLayout.spacing.md,
          paddingTop: ThemeLayout.spacing.sm,
          paddingBottom: ThemeLayout.spacing.xs,
          gap: ThemeLayout.spacing.sm,
        }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.backgroundCard,
            borderRadius: ThemeLayout.borderRadius.md,
            borderCurve: 'continuous',
            paddingHorizontal: ThemeLayout.spacing.md,
            gap: ThemeLayout.spacing.sm,
            height: 44,
          }}>
          <IconSymbol name="magnifyingglass" size={18} color={colors.textTertiary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('symbols.search_placeholder')}
            placeholderTextColor={colors.textTertiary}
            style={{
              flex: 1,
              fontFamily: Fonts.spaceGrotesk.regular,
              fontSize: 15,
              color: colors.textPrimary,
              paddingVertical: 0,
            }}
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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ThemeLayout.spacing.xs }}>
          <Pressable
            onPress={() => setSelectedCategory(null)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: ThemeLayout.borderRadius.full,
              backgroundColor: selectedCategory === null ? colors.accent : colors.backgroundCard,
            }}>
            <Text
              style={{
                fontFamily: Fonts.spaceGrotesk.medium,
                fontSize: 12,
                color: selectedCategory === null ? colors.textOnAccentSurface : colors.textSecondary,
              }}>
              {t('symbols.all_categories')}
            </Text>
          </Pressable>
          {categories.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: ThemeLayout.borderRadius.full,
                backgroundColor: selectedCategory === cat ? colors.accent : colors.backgroundCard,
              }}>
              <Text
                style={{
                  fontFamily: Fonts.spaceGrotesk.medium,
                  fontSize: 12,
                  color:
                    selectedCategory === cat ? colors.textOnAccentSurface : colors.textSecondary,
                }}>
                {getCategoryName(cat, lang)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Symbol list */}
      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={keyExtractor}
        contentContainerStyle={{ paddingBottom: ThemeLayout.spacing.xl }}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 60,
              gap: ThemeLayout.spacing.sm,
            }}>
            <IconSymbol name="magnifyingglass" size={32} color={colors.textTertiary} />
            <Text
              style={{
                fontFamily: Fonts.spaceGrotesk.regular,
                fontSize: 15,
                color: colors.textSecondary,
                textAlign: 'center',
              }}>
              {t('symbols.no_results')}
            </Text>
          </View>
        }
      />
    </View>
  );
}
