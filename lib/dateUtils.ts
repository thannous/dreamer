/**
 * Utility functions for date formatting
 */

const DEFAULT_LOCALE = 'en-US';

const toDate = (value: number | Date): Date => {
  return typeof value === 'number' ? new Date(value) : value;
};

export function formatDreamDate(timestamp: number, locale: string = DEFAULT_LOCALE): string {
  return toDate(timestamp).toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDreamTime(timestamp: number, locale: string = DEFAULT_LOCALE): string {
  return toDate(timestamp).toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatShortDate(timestamp: number, locale: string = DEFAULT_LOCALE): string {
  return toDate(timestamp).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function getCurrentMoonCycleTimestamp(locale: string = DEFAULT_LOCALE): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  };
  return `Cycle of the Moon: ${now.toLocaleDateString(locale, options)}`;
}
