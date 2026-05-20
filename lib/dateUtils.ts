/**
 * Utility functions for date formatting
 */

const DEFAULT_LOCALE = 'en-US';
// Perf: cache Intl.DateTimeFormat instances per locale to avoid per-call allocations.
const formatters = {
  dreamDate: new Map<string, Intl.DateTimeFormat>(),
  dreamTime: new Map<string, Intl.DateTimeFormat>(),
  shortDate: new Map<string, Intl.DateTimeFormat>(),
  moonCycle: new Map<string, Intl.DateTimeFormat>(),
  genericDate: new Map<string, Intl.DateTimeFormat>(),
  genericNumber: new Map<string, Intl.NumberFormat>(),
};

const DREAM_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
};

const DREAM_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
};

const SHORT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

const MOON_CYCLE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

const DEFAULT_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
};

const DEFAULT_PERCENT_OPTIONS: Intl.NumberFormatOptions = {
  style: 'percent',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
};

const getOptionsKey = (locale: string, options?: Intl.DateTimeFormatOptions | Intl.NumberFormatOptions): string => {
  if (!options) return locale;
  const sortedEntries = Object.keys(options)
    .sort()
    .map((key) => [key, options[key as keyof typeof options]]);
  return `${locale}:${JSON.stringify(sortedEntries)}`;
};

const getFormatter = (
  cache: Map<string, Intl.DateTimeFormat>,
  locale: string,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat => {
  const cached = cache.get(locale);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat(locale, options);
  cache.set(locale, formatter);
  return formatter;
};

const getGenericDateFormatter = (
  locale: string,
  options?: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat => {
  const key = getOptionsKey(locale, options);
  const cached = formatters.genericDate.get(key);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat(locale, options);
  formatters.genericDate.set(key, formatter);
  return formatter;
};

const getGenericNumberFormatter = (
  locale: string,
  options?: Intl.NumberFormatOptions
): Intl.NumberFormat => {
  const key = getOptionsKey(locale, options);
  const cached = formatters.genericNumber.get(key);
  if (cached) return cached;
  const formatter = new Intl.NumberFormat(locale, options);
  formatters.genericNumber.set(key, formatter);
  return formatter;
};

const toDate = (value: number | Date): Date => {
  return typeof value === 'number' ? new Date(value) : value;
};

export function formatLocaleDate(
  value: number | Date,
  locale: string = DEFAULT_LOCALE,
  options?: Intl.DateTimeFormatOptions
): string {
  return getGenericDateFormatter(locale, options).format(toDate(value));
}

export function formatLocaleTime(
  value: number | Date,
  locale: string = DEFAULT_LOCALE,
  options?: Intl.DateTimeFormatOptions
): string {
  // Perf: reuse the common time formatter across screens instead of allocating per label.
  const mergedOptions = options ? { ...DEFAULT_TIME_OPTIONS, ...options } : DEFAULT_TIME_OPTIONS;
  return getGenericDateFormatter(locale, mergedOptions).format(toDate(value));
}

export function formatLocaleNumber(
  value: number,
  locale: string = DEFAULT_LOCALE,
  options?: Intl.NumberFormatOptions
): string {
  return getGenericNumberFormatter(locale, options).format(value);
}

export function formatLocalePercent(
  fraction: number,
  locale: string = DEFAULT_LOCALE,
  options?: Intl.NumberFormatOptions
): string {
  // Perf: statistics renders many numeric labels; cached formatters avoid repeated Intl setup.
  const mergedOptions = options ? { ...DEFAULT_PERCENT_OPTIONS, ...options } : DEFAULT_PERCENT_OPTIONS;
  return getGenericNumberFormatter(locale, mergedOptions).format(fraction);
}

export function formatDreamDate(timestamp: number, locale: string = DEFAULT_LOCALE): string {
  return getFormatter(formatters.dreamDate, locale, DREAM_DATE_OPTIONS).format(toDate(timestamp));
}

export function formatDreamTime(timestamp: number, locale: string = DEFAULT_LOCALE): string {
  return getFormatter(formatters.dreamTime, locale, DREAM_TIME_OPTIONS).format(toDate(timestamp));
}

export function formatShortDate(timestamp: number, locale: string = DEFAULT_LOCALE): string {
  return getFormatter(formatters.shortDate, locale, SHORT_DATE_OPTIONS).format(toDate(timestamp));
}

export function getCurrentMoonCycleTimestamp(locale: string = DEFAULT_LOCALE): string {
  const now = new Date();
  const formatted = getFormatter(formatters.moonCycle, locale, MOON_CYCLE_OPTIONS).format(now);
  return `Cycle of the Moon: ${formatted}`;
}
