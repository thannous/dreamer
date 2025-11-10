import { useCallback } from 'react';

import { useLanguage } from '@/context/LanguageContext';
import {
  formatDreamDate as baseFormatDreamDate,
  formatDreamTime as baseFormatDreamTime,
  formatShortDate as baseFormatShortDate,
  getCurrentMoonCycleTimestamp as baseGetCurrentMoonCycleTimestamp,
} from '@/lib/dateUtils';

const ensureDate = (value: Date | number): Date => (typeof value === 'number' ? new Date(value) : value);

export function useLocaleFormatting() {
  const { locale } = useLanguage();
  const localeTag = locale.languageTag;

  const formatDate = useCallback(
    (value: Date | number, options?: Intl.DateTimeFormatOptions) => {
      return new Intl.DateTimeFormat(localeTag, options).format(ensureDate(value));
    },
    [localeTag]
  );

  const formatTime = useCallback(
    (value: Date | number, options?: Intl.DateTimeFormatOptions) => {
      const defaultOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
      return new Intl.DateTimeFormat(localeTag, { ...defaultOptions, ...options }).format(ensureDate(value));
    },
    [localeTag]
  );

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) => {
      return new Intl.NumberFormat(localeTag, options).format(value);
    },
    [localeTag]
  );

  const formatPercent = useCallback(
    (fraction: number, options?: Intl.NumberFormatOptions) => {
      return new Intl.NumberFormat(localeTag, {
        style: 'percent',
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
        ...options,
      }).format(fraction);
    },
    [localeTag]
  );

  const formatDreamDate = useCallback(
    (timestamp: number) => baseFormatDreamDate(timestamp, localeTag),
    [localeTag]
  );

  const formatDreamTime = useCallback(
    (timestamp: number) => baseFormatDreamTime(timestamp, localeTag),
    [localeTag]
  );

  const formatShortDate = useCallback(
    (timestamp: number) => baseFormatShortDate(timestamp, localeTag),
    [localeTag]
  );

  const getMoonCycleLabel = useCallback(
    () => baseGetCurrentMoonCycleTimestamp(localeTag),
    [localeTag]
  );

  return {
    locale: localeTag,
    formatDate,
    formatTime,
    formatNumber,
    formatPercent,
    formatDreamDate,
    formatDreamTime,
    formatShortDate,
    getMoonCycleLabel,
  };
}
