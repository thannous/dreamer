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

const toDate = (value: number | Date): Date => {
  return typeof value === 'number' ? new Date(value) : value;
};

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
