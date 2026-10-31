import { isDreamAnalyzed, isDreamExplored } from './dreamUsage';
import { normalizeDreamMemoryMetadata } from './dreamUtils';
import type { DreamAnalysis, DreamTheme, DreamType } from './types';

export type JournalQuickFilter = 'all' | 'favorites' | 'to_deepen';
export type JournalAnalysisStatusFilter = 'unanalyzed' | 'analyzed' | 'explored';

export interface FilterBySearchOptions {
  dreamTypeLabelResolver?: (dreamType: DreamType | null | undefined) => string | undefined;
  dreamMemoryLabelResolver?: (
    field: 'kind' | 'period' | 'fragment' | 'origin',
    value: string,
  ) => string | undefined;
}

/**
 * Folds case, accents and typographic apostrophes, so "ocean" finds « Océan » and "l'eau"
 * finds « l’eau ».
 */
export function foldSearchText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[‘’`]/g, "'");
}

// Perf: folding a long transcript costs more than searching it, so a dream's own text is folded
// once and kept for as long as the dream object lives (an edit replaces the object).
const foldedDreamTexts = new WeakMap<DreamAnalysis, string>();

/** The dream's own words: title, transcript, reading, type and the names of its symbols. */
function getFoldedDreamText(dream: DreamAnalysis): string {
  let folded = foldedDreamTexts.get(dream);
  if (folded === undefined) {
    folded = foldSearchText([
      dream.title,
      dream.transcript,
      dream.interpretation,
      getShownDreamType(dream),
      ...(dream.symbols ?? []).map((symbol) => symbol.name),
    ]
      .filter((value): value is string => Boolean(value))
      .join(' '));
    foldedDreamTexts.set(dream, folded);
  }
  return folded;
}

/**
 * Filter dreams by search query
 * Searches in title, transcript, interpretation and symbol names, ignoring case and accents
 */
export function filterBySearch(
  dreams: DreamAnalysis[],
  query: string,
  options: FilterBySearchOptions = {},
): DreamAnalysis[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return dreams;

  const normalizedQuery = foldSearchText(trimmedQuery);
  const queryHasWhitespace = /\s/.test(normalizedQuery);

  return dreams.filter((dream) => matchesSearch(dream, normalizedQuery, queryHasWhitespace, options));
}

/**
 * Predicate to check if a dream matches the search query, already folded.
 * Useful for single-pass filtering loops.
 */
function matchesSearch(
  dream: DreamAnalysis,
  normalizedQuery: string,
  queryHasWhitespace: boolean,
  options: FilterBySearchOptions = {}
): boolean {
  // The dream's own words are joined with single spaces, so one check also covers a
  // multi-word query that spans two of them (title then transcript).
  const ownText = getFoldedDreamText(dream);
  if (ownText.includes(normalizedQuery)) return true;

  // Perf: resolve localized labels only when needed (most searches match the dream's own words).
  const dreamTypeLabel = options.dreamTypeLabelResolver?.(getShownDreamType(dream));
  const labels = getDreamMemorySearchFields(dream, options);
  if (dreamTypeLabel) labels.unshift(dreamTypeLabel);
  if (labels.length === 0) return false;

  const foldedLabels = labels.map(foldSearchText);
  if (foldedLabels.some((value) => value.includes(normalizedQuery))) return true;

  // Perf: cross-field matching only matters when the query contains whitespace, since every
  // field is joined with a single space.
  if (!queryHasWhitespace) return false;

  return `${ownText} ${foldedLabels.join(' ')}`.includes(normalizedQuery);
}

export function isRememberedDream(dream: Pick<DreamAnalysis, 'memory'>): boolean {
  const memory = normalizeDreamMemoryMetadata(dream.memory);
  return Boolean(memory);
}

/**
 * The type a dream shows, or none when it was never classified: captures saved before
 * any analysis used to default to Symbolic Dream, which classifies nothing. The journal
 * card, the type filter and type search all read this, so they always agree.
 */
export function getShownDreamType(dream: DreamAnalysis): DreamType | undefined {
  if (!dream.dreamType || (dream.dreamType === 'Symbolic Dream' && !isDreamAnalyzed(dream))) return undefined;
  return dream.dreamType;
}

export function isRecurringDream(dream: Pick<DreamAnalysis, 'dreamType' | 'memory'>): boolean {
  if (dream.dreamType === 'Recurring Dream') return true;
  const memory = normalizeDreamMemoryMetadata(dream.memory);
  return memory?.recurring === true || memory?.rememberedKind === 'recurring';
}

export function isDreamToDeepen(dream: DreamAnalysis): boolean {
  return isDreamAnalyzed(dream) && !isDreamExplored(dream);
}

export function matchesAnalysisStatusFilter(
  dream: DreamAnalysis,
  status: JournalAnalysisStatusFilter | null | undefined,
): boolean {
  if (!status) return true;
  if (status === 'unanalyzed') return !isDreamAnalyzed(dream);
  if (status === 'analyzed') return isDreamAnalyzed(dream);
  return isDreamExplored(dream);
}

function getDreamMemorySearchFields(
  dream: DreamAnalysis,
  options: FilterBySearchOptions,
): string[] {
  const memory = normalizeDreamMemoryMetadata(dream.memory);
  if (!memory) return [];

  const fields: string[] = ['memory', 'remembered', 'souvenir', 'souvenirs'];
  const pushValue = (
    field: 'kind' | 'period' | 'fragment' | 'origin',
    value: string | undefined,
  ) => {
    if (!value) return;
    fields.push(value, value.replace(/_/g, ' '));
    const label = options.dreamMemoryLabelResolver?.(field, value);
    if (label) {
      fields.push(label);
    }
  };

  if (memory.origin === 'remembered' || memory.dejaVu === true) {
    pushValue('origin', 'remembered');
  }
  pushValue('kind', memory.rememberedKind);
  pushValue('period', memory.approximatePeriod);
  pushValue('fragment', memory.strongestFragment);
  if (memory.lingeringEmotion) {
    fields.push(memory.lingeringEmotion);
  }
  if (memory.recurrenceNote) {
    fields.push(memory.recurrenceNote);
  }

  return fields;
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

  return dreams.filter((dream) => getShownDreamType(dream) === dreamType);
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
  rememberedOnly?: boolean;
  needsExplorationOnly?: boolean;
  analysisStatus?: JournalAnalysisStatusFilter | null;
  recurringOnly?: boolean;
  /** Only these dreams (the thread of a symbol); `null` or missing keeps every dream. */
  dreamIds?: ReadonlySet<number> | null;
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
    rememberedOnly,
    needsExplorationOnly,
    analysisStatus,
    recurringOnly,
    theme,
    dreamType,
    startDate,
    endDate,
    searchQuery,
    dreamIds,
  } = filters;

  const trimmedQuery = searchQuery?.trim() ?? '';
  const hasSearchQuery = Boolean(trimmedQuery);
  if (
    !favoritesOnly &&
    !analyzedOnly &&
    !exploredOnly &&
    !rememberedOnly &&
    !needsExplorationOnly &&
    !analysisStatus &&
    !recurringOnly &&
    !theme &&
    !dreamType &&
    !startDate &&
    !endDate &&
    !dreamIds &&
    !hasSearchQuery
  ) {
    // Perf: the unfiltered journal is the common path; preserve the existing sorted array
    // instead of scanning every dream and allocating a copy on each render.
    return dreams;
  }

  const normalizedQuery = hasSearchQuery ? foldSearchText(trimmedQuery) : '';
  const queryHasWhitespace = hasSearchQuery && /\s/.test(normalizedQuery);
  const startTime = startDate ? startDate.getTime() : null;
  const endOfDayTime = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;

  return dreams.filter((dream) => {
    // 1. Cheapest checks: Boolean flags
    if (favoritesOnly && !dream.isFavorite) {
      return false;
    }

    if (dreamIds && !dreamIds.has(dream.id)) {
      return false;
    }

    if (exploredOnly && !isDreamExplored(dream)) {
      return false;
    }

    if (analyzedOnly && !isDreamAnalyzed(dream)) {
      return false;
    }

    if (rememberedOnly && !isRememberedDream(dream)) {
      return false;
    }

    if (recurringOnly && !isRecurringDream(dream)) {
      return false;
    }

    if (needsExplorationOnly && !isDreamToDeepen(dream)) {
      return false;
    }

    if (!matchesAnalysisStatusFilter(dream, analysisStatus)) {
      return false;
    }

    // 2. Direct property comparisons
    if (theme && dream.theme !== theme) {
      return false;
    }

    if (dreamType && getShownDreamType(dream) !== dreamType) {
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
      return matchesSearch(dream, normalizedQuery, queryHasWhitespace, options.searchOptions);
    }

    return true;
  });
}

export interface NarrowingFilterOptions extends ApplyFiltersOptions {
  /**
   * What the search label resolvers depend on (the translation function, say). Callers
   * usually rebuild the resolvers on each call, so their identity cannot tell a language
   * change; a new source filters everything again.
   */
  labelsSource?: unknown;
}

/**
 * `applyFilters` for a search typed one key at a time. When only the query grew (the new
 * query contains the previous one, over the same dreams and other filters), any dream
 * matching the new query also matched the previous one, so only the previous matches are
 * searched instead of the whole journal. Any other change searches everything again.
 */
export function createNarrowingFilter() {
  let last: {
    dreams: DreamAnalysis[];
    scope: string;
    dreamIds: ReadonlySet<number> | null;
    labelsSource: unknown;
    query: string;
    result: DreamAnalysis[];
  } | null = null;

  return (dreams: DreamAnalysis[], filters: DreamFilters, options: NarrowingFilterOptions = {}): DreamAnalysis[] => {
    const query = foldSearchText(filters.searchQuery?.trim() ?? '');
    const dreamIds = filters.dreamIds ?? null;
    const scope = JSON.stringify([
      filters.theme ?? null,
      filters.dreamType ?? null,
      filters.startDate?.getTime() ?? null,
      filters.endDate?.getTime() ?? null,
      Boolean(filters.favoritesOnly),
      Boolean(filters.analyzedOnly),
      Boolean(filters.exploredOnly),
      Boolean(filters.rememberedOnly),
      Boolean(filters.needsExplorationOnly),
      filters.analysisStatus ?? null,
      Boolean(filters.recurringOnly),
    ]);
    const narrows = last !== null
      && last.dreams === dreams
      && last.scope === scope
      && last.dreamIds === dreamIds
      && last.labelsSource === options.labelsSource
      && query.includes(last.query);
    const result = applyFilters(narrows && last ? last.result : dreams, filters, options);
    last = { dreams, scope, dreamIds, labelsSource: options.labelsSource, query, result };
    return result;
  };
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
    const dreamType = getShownDreamType(dream);
    if (dreamType) types.add(dreamType);
  });
  return Array.from(types).sort();
}
