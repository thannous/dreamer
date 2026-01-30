import { MaterialCommunityIcons } from "@expo/vector-icons";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { CategoryHeader } from "@/components/symbols/CategoryHeader";
import { LetterHeader } from "@/components/symbols/LetterHeader";
import { SymbolCard } from "@/components/symbols/SymbolCard";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SearchBar } from "@/components/ui/SearchBar";
import { ThemeLayout } from "@/constants/journalTheme";
import { Fonts } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useTranslation } from "@/hooks/useTranslation";
import { MotiView } from "@/lib/moti";
import type {
  DreamSymbol,
  SymbolCategory,
  SymbolLanguage,
} from "@/lib/symbolTypes";
import {
  getAllSymbols,
  getCategoryList,
  getCategoryName,
  getSymbolsByCategory,
  searchSymbols,
} from "@/services/symbolDictionaryService";

type BrowseMode = "theme" | "alphabetical";

type Section =
  | {
      type: "category";
      category: SymbolCategory;
      data: DreamSymbol[];
    }
  | {
      type: "letter";
      letter: string;
      data: DreamSymbol[];
    };

type Row =
  | {
      type: "category-header";
      id: string;
      category: SymbolCategory;
      count: number;
    }
  | {
      type: "letter-header";
      id: string;
      letter: string;
      count: number;
    }
  | {
      type: "item";
      id: string;
      symbol: DreamSymbol;
    };

const normalizeValue = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const getSymbolName = (symbol: DreamSymbol, language: SymbolLanguage) =>
  (symbol[language] ?? symbol.en).name;

const getSymbolLetter = (name: string) => {
  const normalized = normalizeValue(name);
  if (!normalized) return "#";
  const firstChar = normalized[0]?.toUpperCase() ?? "#";
  return /[A-Z]/.test(firstChar) ? firstChar : "#";
};

const FULL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function SymbolDictionaryScreen() {
  const { colors, shadows, mode } = useTheme();
  const { t, currentLang } = useTranslation();
  const lang = (currentLang ?? "en") as SymbolLanguage;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<SymbolCategory | null>(null);
  const [browseMode, setBrowseMode] = useState<BrowseMode>("alphabetical");
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);

  const categories = useMemo(() => getCategoryList(), []);
  const normalizedQuery = searchQuery.trim();

  const gradientColors =
    mode === "dark"
      ? (["#131022", "#4A3B5F"] as const)
      : ([colors.backgroundSecondary, colors.backgroundDark] as const);

  const glassBackground =
    mode === "dark" ? "rgba(35, 26, 63, 0.4)" : `${colors.backgroundCard}A6`;

  const availableLetters = useMemo(() => {
    if (browseMode !== "alphabetical") return [];
    const sourceSymbols = normalizedQuery
      ? searchSymbols(normalizedQuery, lang)
      : getAllSymbols();
    const letters = new Set<string>();
    sourceSymbols.forEach((symbol) => {
      letters.add(getSymbolLetter(getSymbolName(symbol, lang)));
    });
    return Array.from(letters).sort((a, b) => a.localeCompare(b, lang));
  }, [browseMode, normalizedQuery, lang]);

  useEffect(() => {
    if (browseMode !== "alphabetical") return;
    if (selectedLetter && !availableLetters.includes(selectedLetter)) {
      setSelectedLetter(null);
    }
  }, [browseMode, selectedLetter, availableLetters]);

  const sections: Section[] = useMemo(() => {
    if (browseMode === "alphabetical") {
      const sourceSymbols = normalizedQuery
        ? searchSymbols(normalizedQuery, lang)
        : getAllSymbols();
      if (sourceSymbols.length === 0) return [];

      const sorted = [...sourceSymbols].sort((a, b) =>
        normalizeValue(getSymbolName(a, lang)).localeCompare(
          normalizeValue(getSymbolName(b, lang)),
          lang,
          { sensitivity: "base" },
        ),
      );

      const grouped = new Map<string, DreamSymbol[]>();
      for (const symbol of sorted) {
        const letter = getSymbolLetter(getSymbolName(symbol, lang));
        if (selectedLetter && letter !== selectedLetter) {
          continue;
        }
        const list = grouped.get(letter) ?? [];
        list.push(symbol);
        grouped.set(letter, list);
      }

      return Array.from(grouped.entries()).map(([letter, data]) => ({
        type: "letter",
        letter,
        data,
      }));
    }

    if (normalizedQuery) {
      const results = searchSymbols(normalizedQuery, lang);
      if (results.length === 0) return [];

      if (selectedCategory) {
        const filtered = results.filter((s) => s.category === selectedCategory);
        if (filtered.length === 0) return [];
        return [{ type: "category", category: selectedCategory, data: filtered }];
      }

      const grouped = new Map<SymbolCategory, DreamSymbol[]>();
      for (const s of results) {
        const list = grouped.get(s.category) ?? [];
        list.push(s);
        grouped.set(s.category, list);
      }
      return categories
        .filter((c) => grouped.has(c))
        .map((c) => ({ type: "category", category: c, data: grouped.get(c)! }));
    }

    if (selectedCategory) {
      return [
        {
          type: "category",
          category: selectedCategory,
          data: getSymbolsByCategory(selectedCategory),
        },
      ];
    }

    return categories.map((c) => ({
      type: "category",
      category: c,
      data: getSymbolsByCategory(c),
    }));
  }, [browseMode, normalizedQuery, selectedCategory, lang, categories, selectedLetter]);

  const listData: Row[] = useMemo(() => {
    const rows: Row[] = [];
    sections.forEach((section) => {
      if (section.type === "category") {
        rows.push({
          type: "category-header",
          id: `header-${section.category}`,
          category: section.category,
          count: section.data.length,
        });
      } else {
        rows.push({
          type: "letter-header",
          id: `header-${section.letter}`,
          letter: section.letter,
          count: section.data.length,
        });
      }
      section.data.forEach((symbol) => {
        rows.push({
          type: "item",
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
      if (item.type === "category-header") {
        return (
          <CategoryHeader
            category={item.category}
            count={item.count}
            language={lang}
          />
        );
      }
      if (item.type === "letter-header") {
        return <LetterHeader letter={item.letter} count={item.count} />;
      }
      return (
        <SymbolCard
          symbol={item.symbol}
          language={lang}
          onPress={handleSymbolPress}
        />
      );
    },
    [lang, handleSymbolPress],
  );

  const keyExtractor = useCallback((item: Row) => item.id, []);
  const getItemType = useCallback((item: Row | undefined) => item?.type ?? "item", []);

  const renderEmptyComponent = useCallback(
    () => (
      <View style={styles.emptyState}>
        <IconSymbol
          name="magnifyingglass"
          size={32}
          color={colors.textTertiary}
        />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {t("symbols.no_results")}
        </Text>
      </View>
    ),
    [colors.textSecondary, colors.textTertiary, t],
  );

  const chipStyle = (isSelected: boolean) => [
    styles.chip,
    {
      backgroundColor: isSelected ? colors.accent : glassBackground,
      borderWidth: isSelected ? 0 : 1,
      borderColor: isSelected ? "transparent" : colors.divider,
    },
  ];

  const letterStyle = (isSelected: boolean) => [
    styles.letterChip,
    {
      backgroundColor: isSelected ? colors.accent : glassBackground,
      borderWidth: isSelected ? 0 : 1,
      borderColor: isSelected ? "transparent" : colors.divider,
    },
  ];

  const handleBrowseModeChange = useCallback((nextMode: BrowseMode) => {
    setBrowseMode(nextMode);
    if (nextMode === "alphabetical") {
      setSelectedCategory(null);
    } else {
      setSelectedLetter(null);
    }
  }, []);

  return (
    <LinearGradient colors={gradientColors} style={styles.container}>
      {/* Floating Back Button */}
      <Pressable
        onPress={() => router.back()}
        style={[
          styles.floatingBackButton,
          shadows.lg,
          {
            backgroundColor:
              mode === "dark"
                ? "rgba(35, 26, 63, 0.85)"
                : colors.backgroundCard,
            borderWidth: 1,
            borderColor:
              mode === "dark" ? "rgba(160, 151, 184, 0.25)" : colors.divider,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t("journal.back_button")}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MaterialCommunityIcons
          name="arrow-left"
          size={22}
          color={colors.textPrimary}
        />
      </Pressable>

      {/* Page header with icon */}
      <MotiView
        from={{ opacity: 0, translateY: -8 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 500 }}
        style={styles.headerSection}
      >
        <View
          style={[
            styles.headerIconContainer,
            { backgroundColor: colors.backgroundSecondary },
          ]}
        >
          <MaterialCommunityIcons
            name="book-open-page-variant-outline"
            size={28}
            color={colors.accent}
          />
        </View>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t("symbols.dictionary_title")}
        </Text>
      </MotiView>

      {/* Search bar + chips */}
      <MotiView
        from={{ opacity: 0, translateY: -12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 500, delay: 100 }}
        style={styles.searchContainer}
      >
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t("symbols.search_placeholder")}
        />

        <View
          style={[
            styles.modeSwitch,
            {
              backgroundColor: glassBackground,
              borderColor: colors.divider,
            },
          ]}
        >
          <Pressable
            onPress={() => handleBrowseModeChange("alphabetical")}
            style={({ pressed }) => [
              styles.modeOption,
              browseMode === "alphabetical" && {
                backgroundColor: colors.accent,
              },
              pressed && styles.chipPressed,
            ]}
          >
            <Text
              style={[
                styles.modeOptionText,
                {
                  color:
                    browseMode === "alphabetical"
                      ? colors.textOnAccentSurface
                      : colors.textSecondary,
                },
              ]}
            >
              {t("symbols.browse_alphabetical")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleBrowseModeChange("theme")}
            style={({ pressed }) => [
              styles.modeOption,
              browseMode === "theme" && {
                backgroundColor: colors.accent,
              },
              pressed && styles.chipPressed,
            ]}
          >
            <Text
              style={[
                styles.modeOptionText,
                {
                  color:
                    browseMode === "theme"
                      ? colors.textOnAccentSurface
                      : colors.textSecondary,
                },
              ]}
            >
              {t("symbols.browse_theme")}
            </Text>
          </Pressable>
        </View>

        {browseMode === "theme" ? (
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => setSelectedCategory(null)}
              style={({ pressed }) => [
                ...chipStyle(selectedCategory === null),
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
                {t("symbols.all_categories")}
              </Text>
            </Pressable>
            {categories.map((cat) => (
              <Pressable
                key={cat}
                onPress={() =>
                  setSelectedCategory(selectedCategory === cat ? null : cat)
                }
                style={({ pressed }) => [
                  ...chipStyle(selectedCategory === cat),
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
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.letterRow}
          >
            {FULL_ALPHABET.map((letter) => {
              const hasSymbols = availableLetters.includes(letter);
              const isSelected = selectedLetter === letter;
              return (
                <Pressable
                  key={letter}
                  onPress={
                    hasSymbols
                      ? () => setSelectedLetter(isSelected ? null : letter)
                      : undefined
                  }
                  disabled={!hasSymbols}
                  style={({ pressed }) => [
                    ...letterStyle(isSelected),
                    !hasSymbols && { opacity: 0.3 },
                    pressed && hasSymbols && styles.chipPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.letterText,
                      {
                        color: isSelected
                          ? colors.textOnAccentSurface
                          : colors.textSecondary,
                      },
                    ]}
                  >
                    {letter}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </MotiView>

      {/* Symbol list */}
      <FlashList
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        removeClippedSubviews={false}
        drawDistance={240}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyComponent}
        showsVerticalScrollIndicator={false}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  floatingBackButton: {
    position: "absolute",
    top: 50,
    left: 16,
    zIndex: 50,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  headerSection: {
    alignItems: "center",
    paddingTop: 48,
    paddingBottom: 8,
    gap: 12,
  },
  headerIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: Fonts.fraunces.bold,
    fontSize: 28,
    letterSpacing: 0.3,
    textAlign: "center",
  },
  searchContainer: {
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingTop: ThemeLayout.spacing.lg20,
    paddingBottom: ThemeLayout.spacing.sm,
    gap: 12,
  },
  modeSwitch: {
    flexDirection: "row",
    padding: 4,
    borderRadius: ThemeLayout.borderRadius.full,
    borderWidth: 1,
    gap: ThemeLayout.spacing.xs,
  },
  modeOption: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: ThemeLayout.borderRadius.full,
    alignItems: "center",
  },
  modeOptionText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
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
  letterRow: {
    gap: ThemeLayout.spacing.xs,
    paddingVertical: ThemeLayout.spacing.xs,
  },
  letterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: ThemeLayout.borderRadius.full,
  },
  letterText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: ThemeLayout.spacing.xl,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: ThemeLayout.spacing.sm,
  },
  emptyText: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 15,
    textAlign: "center",
  },
});
