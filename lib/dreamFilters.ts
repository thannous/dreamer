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
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return dreams;

  const normalizedQuery = trimmedQuery.toLowerCase();

  return dreams.filter((dream) => matchesSearch(dream, normalizedQuery, options));
}

/**
 * Predicate to check if a dream matches the search query.
 * Useful for single-pass filtering loops.
 */
function matchesSearch(
  dream: DreamAnalysis,
  normalizedQuery: string,
  options: FilterBySearchOptions = {}
): boolean {
  const dreamTypeLabel = options.dreamTypeLabelResolver?.(dream.dreamType);

  // Check title (most likely match)
  if (dream.title && dream.title.toLowerCase().includes(normalizedQuery)) return true;

  // Check transcript
  if (dream.transcript && dream.transcript.toLowerCase().includes(normalizedQuery)) return true;

  // Check interpretation
  if (dream.interpretation && dream.interpretation.toLowerCase().includes(normalizedQuery)) return true;

  // Check dream type
  if (dream.dreamType && dream.dreamType.toLowerCase().includes(normalizedQuery)) return true;

  // Check localized dream type label
  if (dreamTypeLabel && dreamTypeLabel.toLowerCase().includes(normalizedQuery)) return true;

  // Preserve cross-field matching by checking the joined text
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

  // Perf: compare timestamps to avoid per-item Date allocations on the JS thread.
  const startTime = startDate ? startDate.getTime() : null;
  const endOfDayTime = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;

  return dreams.filter((dream) => {
    // dream.id is a timestamp (number) as defined in DreamAnalysis
    const dreamTime = dream.id;

    if (startTime !== null && dreamTime < startTime) return false;
    if (endOfDayTime !== null && dreamTime > endOfDayTime) return false;

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

/**
 * Optimized combined filter function.
 * Performs all filter checks in a single pass over the array.
 * Checks are ordered from cheapest (boolean flags, direct comparisons) to most expensive (date range, string search).
 */
export function applyFilters(
  dreams: DreamAnalysis[],
  filters: DreamFilters,
  options: ApplyFiltersOptions = {},
): DreamAnalysis[] {
  const {
    favoritesOnly,
    analyzedOnly,
    exploredOnly,
    theme,
    dreamType,
    startDate,
    endDate,
    searchQuery,
  } = filters;

  const trimmedQuery = searchQuery?.trim() ?? '';
  const hasSearchQuery = Boolean(trimmedQuery);
  const normalizedQuery = hasSearchQuery ? trimmedQuery.toLowerCase() : '';
  const startTime = startDate ? startDate.getTime() : null;
  const endOfDayTime = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;

  return dreams.filter((dream) => {
    // 1. Cheapest checks: Boolean flags
    if (favoritesOnly && !dream.isFavorite) {
      return false;
    }

    if (exploredOnly && !isDreamExplored(dream)) {
      return false;
    }

    if (analyzedOnly && !isDreamAnalyzed(dream) && !isDreamExplored(dream)) {
      return false;
    }

    // 2. Direct property comparisons
    if (theme && dream.theme !== theme) {
      return false;
    }

    if (dreamType && dream.dreamType !== dreamType) {
      return false;
    }

    // 3. Numeric range checks (Date)
    // dream.id is timestamp
    if (startTime !== null && dream.id < startTime) {
      return false;
    }
    if (endOfDayTime !== null && dream.id > endOfDayTime) {
      return false;
    }

    // 4. Most expensive check: String search
    if (hasSearchQuery) {
      return matchesSearch(dream, normalizedQuery, options.searchOptions);
    }

    return true;
  });
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
