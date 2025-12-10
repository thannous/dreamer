/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock useLanguage
const mockLocale = {
  languageTag: 'en-US',
  languageCode: 'en',
  isRTL: false,
  textDirection: 'ltr',
};

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({
    locale: mockLocale,
    language: 'en',
    setLanguage: vi.fn(),
  }),
}));

// Mock dateUtils
vi.mock('../../lib/dateUtils', () => ({
  formatDreamDate: vi.fn((timestamp: number, locale: string) => `formatted-date-${timestamp}-${locale}`),
  formatDreamTime: vi.fn((timestamp: number, locale: string) => `formatted-time-${timestamp}-${locale}`),
  formatShortDate: vi.fn((timestamp: number, locale: string) => `short-date-${timestamp}-${locale}`),
  getCurrentMoonCycleTimestamp: vi.fn((locale: string) => `moon-cycle-${locale}`),
}));

import { useLocaleFormatting } from '../useLocaleFormatting';

describe('useLocaleFormatting', () => {
  const testTimestamp = new Date('2024-03-15T10:30:00').getTime();
  const testDate = new Date('2024-03-15T10:30:00');

  describe('formatDate', () => {
    it('given timestamp when formatting then returns localized date string', () => {
      const { result } = renderHook(() => useLocaleFormatting());

      const formatted = result.current.formatDate(testTimestamp);

      expect(formatted).toContain('2024');
      expect(formatted).toContain('15');
    });

    it('given Date object when formatting then returns localized date string', () => {
      const { result } = renderHook(() => useLocaleFormatting());

      const formatted = result.current.formatDate(testDate);

      expect(formatted).toContain('2024');
    });

    it('given custom options when formatting then applies options', () => {
      const { result } = renderHook(() => useLocaleFormatting());

      const formatted = result.current.formatDate(testTimestamp, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      expect(formatted).toContain('Friday');
      expect(formatted).toContain('March');
    });
  });

  describe('formatTime', () => {
    it('given timestamp when formatting then returns time with hour and minute', () => {
      const { result } = renderHook(() => useLocaleFormatting());

      const formatted = result.current.formatTime(testTimestamp);

      expect(formatted).toMatch(/10:30/);
    });

    it('given Date object when formatting then returns time string', () => {
      const { result } = renderHook(() => useLocaleFormatting());

      const formatted = result.current.formatTime(testDate);

      expect(formatted).toMatch(/10:30/);
    });

    it('given custom options when formatting then applies options', () => {
      const { result } = renderHook(() => useLocaleFormatting());

      const formatted = result.current.formatTime(testTimestamp, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      expect(formatted).toContain('00'); // seconds
    });
  });

  describe('formatNumber', () => {
    it('given integer when formatting then returns localized number', () => {
      const { result } = renderHook(() => useLocaleFormatting());

      const formatted = result.current.formatNumber(1234567);

      expect(formatted).toBe('1,234,567');
    });

    it('given decimal when formatting then returns localized number', () => {
      const { result } = renderHook(() => useLocaleFormatting());

      const formatted = result.current.formatNumber(1234.56);

      expect(formatted).toBe('1,234.56');
    });

    it('given custom options when formatting then applies options', () => {
      const { result } = renderHook(() => useLocaleFormatting());

      const formatted = result.current.formatNumber(1234.567, {
        maximumFractionDigits: 1,
      });

      expect(formatted).toBe('1,234.6');
    });

    it('given currency options when formatting then formats as currency', () => {
      const { result } = renderHook(() => useLocaleFormatting());

      const formatted = result.current.formatNumber(99.99, {
        style: 'currency',
        currency: 'USD',
      });

      expect(formatted).toContain('$');
      expect(formatted).toContain('99.99');
    });
  });

  describe('formatPercent', () => {
    it('given fraction when formatting then returns percentage', () => {
      const { result } = renderHook(() => useLocaleFormatting());

      const formatted = result.current.formatPercent(0.75);

      expect(formatted).toBe('75%');
    });

    it('given small fraction when formatting then rounds to whole number', () => {
      const { result } = renderHook(() => useLocaleFormatting());

      const formatted = result.current.formatPercent(0.123);

      expect(formatted).toBe('12%');
    });

    it('given 1 when formatting then returns 100%', () => {
      const { result } = renderHook(() => useLocaleFormatting());

      const formatted = result.current.formatPercent(1);

      expect(formatted).toBe('100%');
    });

    it('given 0 when formatting then returns 0%', () => {
      const { result } = renderHook(() => useLocaleFormatting());

      const formatted = result.current.formatPercent(0);

      expect(formatted).toBe('0%');
    });

    it('given custom options when formatting then applies options', () => {
      const { result } = renderHook(() => useLocaleFormatting());

      const formatted = result.current.formatPercent(0.1234, {
        maximumFractionDigits: 1,
      });

      expect(formatted).toBe('12.3%');
    });
  });

  describe('formatDreamDate', () => {
    it('given timestamp when formatting then delegates to dateUtils', () => {
      const { result } = renderHook(() => useLocaleFormatting());

      const formatted = result.current.formatDreamDate(testTimestamp);

      expect(formatted).toBe(`formatted-date-${testTimestamp}-en-US`);
    });
  });

  describe('formatDreamTime', () => {
    it('given timestamp when formatting then delegates to dateUtils', () => {
      const { result } = renderHook(() => useLocaleFormatting());

      const formatted = result.current.formatDreamTime(testTimestamp);

      expect(formatted).toBe(`formatted-time-${testTimestamp}-en-US`);
    });
  });

  describe('formatShortDate', () => {
    it('given timestamp when formatting then delegates to dateUtils', () => {
      const { result } = renderHook(() => useLocaleFormatting());

      const formatted = result.current.formatShortDate(testTimestamp);

      expect(formatted).toBe(`short-date-${testTimestamp}-en-US`);
    });
  });

  describe('getMoonCycleLabel', () => {
    it('when getting moon cycle then delegates to dateUtils', () => {
      const { result } = renderHook(() => useLocaleFormatting());

      const label = result.current.getMoonCycleLabel();

      expect(label).toBe('moon-cycle-en-US');
    });
  });

  describe('locale', () => {
    it('returns the current locale tag', () => {
      const { result } = renderHook(() => useLocaleFormatting());

      expect(result.current.locale).toBe('en-US');
    });
  });
});
