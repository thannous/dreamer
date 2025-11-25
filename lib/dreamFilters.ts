import { isDreamAnalyzed, isDreamExplored } from './dreamUsage';
import type { DreamAnalysis, DreamTheme, DreamType } from './types';

export interface FilterBySearchOptions {
  dreamTypeLabelResolver?: (dreamType: DreamType | null | undefined) => string | undefined;
}

/**
 * Filter dreams by search query
 * Searches in title, transcript, and interpretation
 */
export function filterBySearch(
  dreams: DreamAnalysis[],
  query: string,
  options: FilterBySearchOptions = {},
): DreamAnalysis[] {
  if (!query.trim()) return dreams;

  const normalizedQuery = query.toLowerCase();

  return dreams.filter((dream) => {
    const dreamTypeLabel = options.dreamTypeLabelResolver?.(dream.dreamType);
    const searchableText = [
      dream.title,
      dream.transcript,
      dream.interpretation,
      dream.dreamType,
      dreamTypeLabel,
    ]
      .filter((value): value is string => Boolean(value))
      .join(' ')
      .toLowerCase();

    return searchableText.includes(normalizedQuery);
  });
}

/**
 * Filter dreams by theme
 */
export function filterByTheme(
  dreams: DreamAnalysis[],
  theme: DreamTheme | null,
): DreamAnalysis[] {
  if (!theme) return dreams;

  return dreams.filter((dream) => dream.theme === theme);
}

/**
 * Filter dreams by dream type
 */
export function filterByDreamType(
  dreams: DreamAnalysis[],
  dreamType: DreamType | null,
): DreamAnalysis[] {
  if (!dreamType) return dreams;

  return dreams.filter((dream) => dream.dreamType === dreamType);
}

/**
 * Filter dreams by favorite flag
 */
export function filterByFavorites(dreams: DreamAnalysis[], favoritesOnly: boolean): DreamAnalysis[] {
  if (!favoritesOnly) return dreams;

  return dreams.filter((dream) => dream.isFavorite);
}

/**
 * Filter dreams by date range
 */
export function filterByDateRange(
  dreams: DreamAnalysis[],
  startDate: Date | null,
  endDate: Date | null,
): DreamAnalysis[] {
  if (!startDate && !endDate) return dreams;

  return dreams.filter((dream) => {
    const dreamDate = new Date(dream.id);

    if (startDate && dreamDate < startDate) return false;
    if (endDate) {
      // Set end date to end of day
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      if (dreamDate > endOfDay) return false;
    }

    return true;
  });
}

/**
 * Combined filter function
 */
export interface DreamFilters {
  searchQuery?: string;
  theme?: DreamTheme | null;
  dreamType?: DreamType | null;
  startDate?: Date | null;
  endDate?: Date | null;
  favoritesOnly?: boolean;
  analyzedOnly?: boolean;
  exploredOnly?: boolean;
}

export interface ApplyFiltersOptions {
  searchOptions?: FilterBySearchOptions;
}

export function applyFilters(
  dreams: DreamAnalysis[],
  filters: DreamFilters,
  options: ApplyFiltersOptions = {},
): DreamAnalysis[] {
  let filtered = [...dreams];

  if (filters.searchQuery) {
    filtered = filterBySearch(filtered, filters.searchQuery, options.searchOptions);
  }

  if (filters.theme) {
    filtered = filterByTheme(filtered, filters.theme);
  }

  if (filters.dreamType) {
    filtered = filterByDreamType(filtered, filters.dreamType);
  }

  if (filters.favoritesOnly) {
    filtered = filterByFavorites(filtered, filters.favoritesOnly);
  }

  if (filters.analyzedOnly) {
    filtered = filtered.filter((dream) => isDreamAnalyzed(dream));
  }

  if (filters.exploredOnly) {
    filtered = filtered.filter((dream) => isDreamExplored(dream));
  }

  if (filters.startDate || filters.endDate) {
    filtered = filterByDateRange(filtered, filters.startDate || null, filters.endDate || null);
  }

  return filtered;
}

/**
 * Sort dreams by date (newest first)
 */
export function sortDreamsByDate(dreams: DreamAnalysis[], ascending = false): DreamAnalysis[] {
  return [...dreams].sort((a, b) => {
    return ascending ? a.id - b.id : b.id - a.id;
  });
}

/**
 * Get unique themes from dreams
 */
export function getUniqueThemes(dreams: DreamAnalysis[]): DreamTheme[] {
  const themes = new Set<DreamTheme>();
  dreams.forEach((dream) => {
    if (dream.theme) themes.add(dream.theme);
  });
  return Array.from(themes).sort();
}

/**
 * Get unique dream types from dreams
 */
export function getUniqueDreamTypes(dreams: DreamAnalysis[]): DreamType[] {
  const types = new Set<DreamType>();
  dreams.forEach((dream) => {
    if (dream.dreamType) types.add(dream.dreamType);
  });
  return Array.from(types).sort();
}
