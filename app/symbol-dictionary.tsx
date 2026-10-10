import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DreamerArtworkWindow } from "@/components/ui/DreamerBackground";
import { CategoryHeader } from "@/components/symbols/CategoryHeader";
import { LetterHeader } from "@/components/symbols/LetterHeader";
import { SymbolCard } from "@/components/symbols/SymbolCard";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SearchBar } from "@/components/ui/SearchBar";
import { DarkTheme, ThemeLayout } from "@/constants/journalTheme";
import { getNoctaliaDesignTokens } from "@/constants/noctaliaDesign";
import { getSymbolIllustration } from "@/constants/symbolIllustrations";
import { Fonts } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useTranslation } from "@/hooks/useTranslation";
import { trackProductEvent } from "@/lib/analytics";
import { getDreamGuideCopy } from "@/lib/dreamGuideCopy";
import { useHeaderScroll } from '@/components/ui/headerStretch';
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

// Text that sits on artwork stays ivory in both app themes.
const ART_TEXT = getNoctaliaDesignTokens(DarkTheme, "dark").text.primary;

const FULL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
let trackedOnboardingDictionaryDestination = false;

export default function SymbolDictionaryScreen() {
  // This screen's own scroll, published to its header painting and title.
  const onHeaderScroll = useHeaderScroll();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { t, currentLang } = useTranslation();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  // Direct assignment on purpose: it is a compile error if AppLanguage ever
  // gains a language the bundled dictionary has no content for.
  const lang: SymbolLanguage = currentLang;
  const guideCopy = getDreamGuideCopy(lang);

  useEffect(() => {
    if (source !== "onboarding" || trackedOnboardingDictionaryDestination) return;
    trackedOnboardingDictionaryDestination = true;
    void trackProductEvent("onboarding_destination_viewed", {
      destination: "symbol_dictionary",
      path: "dictionary",
    });
  }, [source]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<SymbolCategory | null>(null);
  const [browseMode, setBrowseMode] = useState<BrowseMode>("alphabetical");
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);

  const categories = useMemo(() => getCategoryList(), []);
  const popularSymbols = useMemo(() => getPopularSymbols(), []);
  const allSymbols = useMemo(() => getAllSymbols(), []);
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());

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
    const detailSource = source === "onboarding"
      ? "onboarding"
      : deferredSearchQuery
        ? "search"
        : "dictionary";
    router.push({
      pathname: "/symbol-detail/[id]",
      params: { id, source: detailSource },
    });
  }, [deferredSearchQuery, source]);

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
        return <LetterHeader letter={item.letter} count={item.count} countLabel={guideCopy.symbolCount(item.count)} />;
      }
      return (
        <SymbolCard
          symbol={item.symbol}
          language={lang}
          onPress={handleSymbolPress}
          variant="row"
        />
      );
    },
    [lang, guideCopy, handleSymbolPress],
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

  const handleBrowseModeChange = useCallback((nextMode: BrowseMode) => {
    setBrowseMode(nextMode);
    if (nextMode === "alphabetical") {
      setSelectedCategory(null);
    } else {
      setSelectedLetter(null);
    }
  }, []);

  const handleBack = useCallback(() => {
    if (source === "onboarding" || !router.canGoBack()) {
      router.replace("/(tabs)");
      return;
    }
    router.back();
  }, [source]);

  const listHeader = (
    <View style={[styles.listHeader, { paddingTop: insets.top + 12 }]}>
          <DreamerArtworkWindow scene="symbols" style={{ marginHorizontal: -20 }} bleedTop={insets.top + 12} />
      <View style={styles.headerRow}>
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel={t("navigation.back")}
          testID="symbol-dictionary-back"
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <IconSymbol name="chevron.left" size={23} color={noctalia.text.primary} />
        </Pressable>
        <Text
          accessibilityRole="header"
          accessibilityLabel={t("symbols.dictionary_title")}
          style={[styles.headerTitle, { color: noctalia.text.primary }]}
        >
          {t("explore.symbols.title")}
        </Text>
        <Pressable
          onPress={() => router.push("/dream-guides")}
          accessibilityRole="button"
          accessibilityLabel={guideCopy.screenTitle}
          testID="btn.symbolDictionary.guides"
          style={({ pressed }) => [styles.guidesLink, {
            backgroundColor: noctalia.surface.raised,
            borderColor: noctalia.surface.border,
          }, pressed && styles.pressed]}
        >
          <Text style={[styles.guidesText, { color: noctalia.accent.text }]}>
            {t("explore.guides.title")}
          </Text>
        </Pressable>
      </View>

      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={t("symbols.search_placeholder")}
        testID="symbol-search"
      />

      <View style={styles.popularBlock} testID="symbol-popular">
        <View style={styles.eyebrowRow}>
          <View style={[styles.eyebrowRule, { backgroundColor: noctalia.accent.text }]} />
          <Text accessibilityRole="header" style={[styles.eyebrow, { color: noctalia.accent.text }]}>
            {t("symbols.popular_short")}
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.popularLinks}
          style={styles.popularScroller}
        >
          {popularSymbols.map((symbol) => {
            const content = symbol[lang] ?? symbol.en;
            const illustration = getSymbolIllustration(symbol.id, 'poster');
            return (
              <Pressable
                key={symbol.id}
                onPress={() => handleSymbolPress(symbol.id)}
                accessibilityRole="button"
                accessibilityLabel={content.name}
                testID={`symbol.popular.${symbol.id}`}
                style={({ pressed }) => [styles.poster, { backgroundColor: noctalia.surface.soft, borderColor: noctalia.surface.border }, pressed && styles.posterPressed]}
              >
                {illustration ? (
                  <Image source={illustration} contentFit="cover" style={StyleSheet.absoluteFill} />
                ) : null}
                <LinearGradient
                  pointerEvents="none"
                  colors={["rgba(9,4,19,0)", "rgba(9,4,19,0.86)"]}
                  locations={[0.35, 1]}
                  style={StyleSheet.absoluteFill}
                />
                <Text numberOfLines={2} style={styles.posterName}>{content.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={[styles.modeSwitch, { borderColor: noctalia.surface.border }]} testID="symbol-browse-modes">
        {(["alphabetical", "theme"] as const).map((value) => {
          const selected = browseMode === value;
          return (
            <Pressable
              key={value}
              onPress={() => handleBrowseModeChange(value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              aria-pressed={selected}
              testID={`symbol-mode-${value}`}
              style={({ pressed }) => [styles.modeOption, pressed && styles.pressed]}
            >
              <Text style={[styles.modeText, { color: selected ? noctalia.accent.text : noctalia.text.secondary }]}>
                {t(value === "alphabetical" ? "symbols.browse_alphabetical" : "symbols.browse_theme")}
              </Text>
              {selected ? <View style={[styles.modeUnderline, { backgroundColor: noctalia.accent.text }]} /> : null}
            </Pressable>
          );
        })}
      </View>

      {browseMode === "theme" ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {[null, ...categories].map((category) => {
            const selected = selectedCategory === category;
            const label = category ? getCategoryName(category, lang) : t("symbols.all_categories");
            return (
              <Pressable
                key={category ?? "all"}
                onPress={() => setSelectedCategory(selected ? null : category)}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected }}
              aria-pressed={selected}
                testID={`symbol-category-${category ?? "all"}`}
                style={({ pressed }) => [styles.categoryOption, { borderColor: selected ? noctalia.accent.text : "transparent" }, pressed && styles.pressed]}
              >
                <Text style={[styles.filterText, { color: selected ? noctalia.accent.text : noctalia.text.secondary }]}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FULL_ALPHABET.map((letter) => {
            const available = availableLetterSet.has(letter);
            const selected = selectedLetter === letter;
            return (
              <Pressable
                key={letter}
                onPress={() => setSelectedLetter(selected ? null : letter)}
                disabled={!available}
                accessibilityRole="button"
                accessibilityLabel={letter}
                accessibilityState={{ selected, disabled: !available }}
                aria-pressed={selected}
                testID={`symbol-letter-${letter}`}
                style={({ pressed }) => [styles.letterOption, { backgroundColor: selected ? noctalia.action.primary : "transparent" }, !available && styles.unavailable, pressed && available && styles.pressed]}
              >
                <Text style={[styles.filterText, { color: selected ? noctalia.action.primaryText : noctalia.text.secondary }]}>{letter}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: noctalia.screen.background }]} testID="screen.symbolDictionary">
      <Stack.Screen options={{ headerShown: false, title: t("symbols.dictionary_title") }} />

      <FlatList<Row>
        testID="symbol-list"
        style={styles.list}
        contentContainerStyle={{ paddingBottom: insets.bottom + ThemeLayout.spacing.xl }}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        onScroll={onHeaderScroll}
        scrollEventThrottle={16}
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderListRow(item)}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={renderEmptyComponent()}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden", position: "relative" },
  list: { flex: 1 },
  listHeader: { paddingHorizontal: 20, gap: 8, paddingBottom: 4 },
  headerRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8, rowGap: 4, marginBottom: 8 },
  backButton: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center", marginLeft: -12 },
  headerTitle: { flex: 1, flexBasis: 140, minWidth: 0, fontFamily: Fonts.fraunces.semiBold, fontSize: 34, lineHeight: 40, letterSpacing: -0.3 },
  guidesLink: { minHeight: 44, justifyContent: "center", maxWidth: "100%", paddingHorizontal: 12, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth },
  guidesText: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 15, lineHeight: 22, flexShrink: 1 },
  popularBlock: { marginTop: 10, marginBottom: 6 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  eyebrowRule: { width: 22, height: 1 },
  eyebrow: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 12, lineHeight: 16, letterSpacing: 2, textTransform: "uppercase" },
  popularScroller: { marginHorizontal: -20 },
  popularLinks: { gap: 12, paddingHorizontal: 20 },
  poster: { width: 128, height: 168, borderRadius: 16, borderCurve: "continuous", borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", justifyContent: "flex-end", padding: 12 },
  posterPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  posterName: { fontFamily: Fonts.fraunces.medium, fontSize: 17, lineHeight: 21, color: ART_TEXT },
  modeSwitch: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  modeOption: { flex: 1, minWidth: 0, minHeight: 44, paddingVertical: 10, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  modeText: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 15, lineHeight: 22, textAlign: "center" },
  modeUnderline: { position: "absolute", bottom: 0, height: 3, width: 44, borderRadius: 2 },
  filterRow: { gap: 4, paddingVertical: 4 },
  letterOption: { minWidth: 44, minHeight: 44, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  categoryOption: { minHeight: 44, paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 2, alignItems: "center", justifyContent: "center" },
  filterText: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 15, lineHeight: 22 },
  unavailable: { opacity: 0.35 },
  pressed: { opacity: 0.78 },
  emptyState: { alignItems: "center", paddingHorizontal: 20, paddingVertical: 48, gap: 12 },
  emptyText: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 15, lineHeight: 22, textAlign: "center" },
});
