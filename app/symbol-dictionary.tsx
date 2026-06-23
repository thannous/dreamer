import { LinearGradient } from "expo-linear-gradient";
import { Stack, router } from "expo-router";
import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AtmosphericBackground } from "@/components/inspiration/AtmosphericBackground";
import { CategoryHeader } from "@/components/symbols/CategoryHeader";
import { LetterHeader } from "@/components/symbols/LetterHeader";
import { SymbolCard } from "@/components/symbols/SymbolCard";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SearchBar } from "@/components/ui/SearchBar";
import { ThemeLayout } from "@/constants/journalTheme";
import { getNoctaliaDesignTokens } from "@/constants/noctaliaDesign";
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
  getPopularSymbols,
  getSymbolIcon,
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
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const lang = (currentLang ?? "en") as SymbolLanguage;
  const useNativeHeaderSearch =
    process.env.EXPO_OS === "ios" && typeof document === "undefined";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<SymbolCategory | null>(null);
  const [browseMode, setBrowseMode] = useState<BrowseMode>("alphabetical");
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);

  const categories = useMemo(() => getCategoryList(), []);
  const popularSymbols = useMemo(() => getPopularSymbols(), []);
  const allSymbols = useMemo(() => getAllSymbols(), []);
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());

  const gradientColors = noctalia.screen.gradient;

  const glassBackground = noctalia.surface.raised;

  const filteredSymbols = useMemo(
    () =>
      deferredSearchQuery
        ? searchSymbols(deferredSearchQuery, lang)
        : allSymbols,
    [allSymbols, deferredSearchQuery, lang],
  );

  const availableLetters = useMemo(() => {
    if (browseMode !== "alphabetical") return [];
    const letters = new Set<string>();
    filteredSymbols.forEach((symbol) => {
      letters.add(getSymbolLetter(getSymbolName(symbol, lang)));
    });
    return Array.from(letters).sort((a, b) => a.localeCompare(b, lang));
  }, [browseMode, filteredSymbols, lang]);
  const availableLetterSet = useMemo(
    () => new Set(availableLetters),
    [availableLetters],
  );

  useEffect(() => {
    if (browseMode !== "alphabetical") return;
    if (selectedLetter && !availableLetters.includes(selectedLetter)) {
      setSelectedLetter(null);
    }
  }, [browseMode, selectedLetter, availableLetters]);

  const sections: Section[] = useMemo(() => {
    if (browseMode === "alphabetical") {
      if (filteredSymbols.length === 0) return [];

      const sorted = [...filteredSymbols].sort((a, b) =>
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

    if (deferredSearchQuery) {
      if (filteredSymbols.length === 0) return [];

      if (selectedCategory) {
        const filtered = filteredSymbols.filter(
          (s) => s.category === selectedCategory,
        );
        if (filtered.length === 0) return [];
        return [{ type: "category", category: selectedCategory, data: filtered }];
      }

      const grouped = new Map<SymbolCategory, DreamSymbol[]>();
      for (const s of filteredSymbols) {
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
  }, [browseMode, deferredSearchQuery, selectedCategory, lang, categories, selectedLetter, filteredSymbols]);

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

  const renderListRow = useCallback(
    (item: Row) => {
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

  const renderEmptyComponent = useCallback(
    () => (
      <View style={styles.emptyState}>
        <IconSymbol
          name="magnifyingglass"
          size={32}
          color={noctalia.text.tertiary}
        />
        <Text style={[styles.emptyText, { color: noctalia.text.secondary }]}>
          {t("symbols.no_results")}
        </Text>
      </View>
    ),
    [noctalia.text.secondary, noctalia.text.tertiary, t],
  );

  const getChipStyle = useCallback(
    (isSelected: boolean) => [
      styles.chip,
      {
        backgroundColor: isSelected ? noctalia.action.primary : glassBackground,
        borderWidth: 1,
        borderColor: isSelected ? noctalia.action.primaryBorder : noctalia.surface.border,
      },
    ],
    [glassBackground, noctalia.action.primary, noctalia.action.primaryBorder, noctalia.surface.border],
  );

  const getLetterStyle = useCallback(
    (isSelected: boolean) => [
      styles.letterChip,
      {
        backgroundColor: isSelected ? noctalia.action.primary : glassBackground,
        borderWidth: 1,
        borderColor: isSelected ? noctalia.action.primaryBorder : noctalia.surface.border,
      },
    ],
    [glassBackground, noctalia.action.primary, noctalia.action.primaryBorder, noctalia.surface.border],
  );

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
      <AtmosphericBackground variant="subtle" />
      <Stack.Screen
        options={{
          headerShown: useNativeHeaderSearch,
          title: t("symbols.dictionary_title"),
          headerBackButtonDisplayMode: "minimal",
          headerSearchBarOptions: useNativeHeaderSearch
            ? {
                placeholder: t("symbols.search_placeholder"),
                autoCapitalize: "none",
                hideNavigationBar: true,
                onChangeText: (event) =>
                  setSearchQuery(event.nativeEvent.text),
                onCancelButtonPress: () => setSearchQuery(""),
              }
            : undefined,
        }}
      />

      {!useNativeHeaderSearch ? (
        <>
          {/* Compact page header */}
          <MotiView
            from={{ opacity: 0, translateY: -8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 500 }}
            style={styles.headerSection}
          >
            <View style={styles.headerTopRow}>
              <Pressable
                onPress={() => router.back()}
                style={[
                  styles.headerBackButton,
                  shadows.sm,
                  {
                    backgroundColor: noctalia.surface.raised,
                    borderColor: noctalia.surface.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t("journal.back_button")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <IconSymbol
                  name="chevron.left"
                  size={21}
                  color={noctalia.text.secondary}
                />
              </Pressable>
              <View style={styles.headerCopy}>
                <Text style={[styles.headerTitle, { color: noctalia.text.primary }]}>
                  {t("symbols.dictionary_title")}
                </Text>
              </View>
            </View>
          </MotiView>
        </>
      ) : null}

      <MotiView
        from={{ opacity: 0, translateY: -8 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 500, delay: 80 }}
        style={styles.popularSection}
      >
        <View style={styles.popularHeader}>
          <Text style={[styles.popularTitle, { color: noctalia.text.primary }]}>
            {t("symbols.popular_title")}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.popularScrollContent}
        >
          {popularSymbols.map((symbol) => {
            const content = symbol[lang] ?? symbol.en;
            const iconName = getSymbolIcon(symbol.id, symbol.category);

            return (
              <Pressable
                key={symbol.id}
                onPress={() => router.push(`/symbol-detail/${symbol.id}` as any)}
                style={({ pressed }) => [
                  styles.popularCard,
                  {
                    backgroundColor: noctalia.surface.raised,
                    borderColor: noctalia.surface.border,
                  },
                  pressed && styles.chipPressed,
                ]}
              >
                <View
                  style={[
                    styles.popularIconWrap,
                    { backgroundColor: noctalia.surface.soft },
                  ]}
                >
                  <IconSymbol name={iconName} size={20} color={noctalia.text.secondary} />
                </View>
                <Text
                  style={[styles.popularCardTitle, { color: noctalia.text.primary }]}
                  numberOfLines={1}
                >
                  {content.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </MotiView>

      {/* Search bar + chips */}
      <MotiView
        from={{ opacity: 0, translateY: -12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 500, delay: 100 }}
        style={[
          styles.searchContainer,
          useNativeHeaderSearch && styles.searchContainerWithNativeHeader,
        ]}
      >
        {!useNativeHeaderSearch ? (
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("symbols.search_placeholder")}
          />
        ) : null}

        <View
          style={[
            styles.modeSwitch,
            {
              backgroundColor: glassBackground,
              borderColor: noctalia.surface.border,
            },
          ]}
        >
          <Pressable
            onPress={() => handleBrowseModeChange("alphabetical")}
            style={({ pressed }) => [
              styles.modeOption,
              browseMode === "alphabetical" && {
                backgroundColor: noctalia.action.primary,
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
                      ? noctalia.action.primaryText
                      : noctalia.text.secondary,
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
                backgroundColor: noctalia.action.primary,
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
                      ? noctalia.action.primaryText
                      : noctalia.text.secondary,
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
                  ...getChipStyle(selectedCategory === null),
                  pressed && styles.chipPressed,
                ]}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color:
                      selectedCategory === null
                        ? noctalia.action.primaryText
                        : noctalia.text.secondary,
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
                  ...getChipStyle(selectedCategory === cat),
                  pressed && styles.chipPressed,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color:
                        selectedCategory === cat
                          ? noctalia.action.primaryText
                          : noctalia.text.secondary,
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
              const hasSymbols = availableLetterSet.has(letter);
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
                    ...getLetterStyle(isSelected),
                    !hasSymbols && { opacity: 0.3 },
                    pressed && hasSymbols && styles.chipPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.letterText,
                      {
                        color: isSelected
                          ? noctalia.action.primaryText
                          : noctalia.text.secondary,
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
      <ScrollView
        testID="symbol-list"
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {listData.length === 0
          ? renderEmptyComponent()
          : listData.map((item) => (
              <React.Fragment key={item.id}>
                {renderListRow(item)}
              </React.Fragment>
            ))}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
    position: "relative",
  },
  headerSection: {
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingTop: 38,
    paddingBottom: 18,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  headerBackButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontFamily: Fonts.fraunces.bold,
    fontSize: 24,
    lineHeight: 31,
  },
  popularSection: {
    gap: 10,
  },
  popularHeader: {
    paddingHorizontal: ThemeLayout.spacing.md,
  },
  popularTitle: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
    lineHeight: 16,
    textTransform: "uppercase",
  },
  popularScrollContent: {
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingTop: 2,
    paddingBottom: 2,
    gap: 8,
  },
  popularCard: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  popularIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  popularCardTitle: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 13,
    lineHeight: 16,
  },
  searchContainer: {
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingTop: ThemeLayout.spacing.lg20,
    paddingBottom: ThemeLayout.spacing.sm,
    gap: 12,
  },
  searchContainerWithNativeHeader: {
    paddingTop: ThemeLayout.spacing.sm,
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
