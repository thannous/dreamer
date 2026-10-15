import { useCallback } from 'react';

import { useLanguage } from '@/context/LanguageContext';
import { getFormattingLocale } from '@/lib/locale';
import {
  formatDreamDate as baseFormatDreamDate,
  formatDreamTime as baseFormatDreamTime,
  formatLocaleDate,
  formatLocaleNumber,
  formatLocalePercent,
  formatLocaleTime,
  formatShortDate as baseFormatShortDate,
  getCurrentMoonCycleTimestamp as baseGetCurrentMoonCycleTimestamp,
} from '@/lib/dateUtils';

export function useLocaleFormatting() {
  const { language } = useLanguage();
  const localeTag = getFormattingLocale(language);

  const formatDate = useCallback(
    (value: Date | number, options?: Intl.DateTimeFormatOptions) => {
      return formatLocaleDate(value, localeTag, options);
    },
    [localeTag]
  );

  const formatTime = useCallback(
    (value: Date | number, options?: Intl.DateTimeFormatOptions) => {
      return formatLocaleTime(value, localeTag, options);
    },
    [localeTag]
  );

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) => {
      return formatLocaleNumber(value, localeTag, options);
    },
    [localeTag]
  );

  const formatPercent = useCallback(
    (fraction: number, options?: Intl.NumberFormatOptions) => {
      return formatLocalePercent(fraction, localeTag, options);
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

  /** A dream's day and time as its seal's rim carries them: the day without its weekday. */
  const formatDreamStamp = useCallback(
    (timestamp: number) => `${formatLocaleDate(timestamp, localeTag, { day: 'numeric', month: 'long', year: 'numeric' })}`
      + ` · ${baseFormatDreamTime(timestamp, localeTag)}`,
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
    formatDreamStamp,
    getMoonCycleLabel,
  };
}
