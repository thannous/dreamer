/**
 * BDD-style tests for quotaReset utility functions
 * Tests monthly quota period calculation and reset logic
 */
import { describe, expect, it } from 'vitest';
import { getMonthlyQuotaPeriod, shouldResetQuota } from '../quotaReset';

describe('quotaReset', () => {
  describe('getMonthlyQuotaPeriod', () => {
    it('given default date when getting monthly period then returns current month period', () => {
      // Given
      const now = new Date('2023-12-15T10:30:00Z');

      // When
      const result = getMonthlyQuotaPeriod(now);

      // Then
      expect(result.periodStart).toEqual(new Date(Date.UTC(2023, 11, 1, 0, 0, 0, 0))); // Dec 1, 2023 UTC
      expect(result.periodEnd).toEqual(new Date(Date.UTC(2023, 12, 1, 0, 0, 0, 0))); // Jan 1, 2024 UTC
    });

    it('given January date when getting monthly period then returns January period', () => {
      // Given
      const now = new Date('2023-01-15T10:30:00Z');

      // When
      const result = getMonthlyQuotaPeriod(now);

      // Then
      expect(result.periodStart).toEqual(new Date(Date.UTC(2023, 0, 1, 0, 0, 0, 0))); // Jan 1, 2023 UTC
      expect(result.periodEnd).toEqual(new Date(Date.UTC(2023, 1, 1, 0, 0, 0, 0))); // Feb 1, 2023 UTC
    });

    it('given December date when getting monthly period then returns December period', () => {
      // Given
      const now = new Date('2023-12-31T23:59:59Z');

      // When
      const result = getMonthlyQuotaPeriod(now);

      // Then
      expect(result.periodStart).toEqual(new Date(Date.UTC(2023, 11, 1, 0, 0, 0, 0))); // Dec 1, 2023 UTC
      expect(result.periodEnd).toEqual(new Date(Date.UTC(2023, 12, 1, 0, 0, 0, 0))); // Jan 1, 2024 UTC
    });

    it('given leap year February when getting monthly period then returns February period', () => {
      // Given
      const now = new Date('2024-02-15T10:30:00Z'); // Leap year

      // When
      const result = getMonthlyQuotaPeriod(now);

      // Then
      expect(result.periodStart).toEqual(new Date(Date.UTC(2024, 1, 1, 0, 0, 0, 0))); // Feb 1, 2024 UTC
      expect(result.periodEnd).toEqual(new Date(Date.UTC(2024, 2, 1, 0, 0, 0, 0))); // Mar 1, 2024 UTC
    });

    it('given no date parameter when getting monthly period then uses current date', () => {
      // Given
      // No date provided, should use new Date()

      // When
      const result = getMonthlyQuotaPeriod();

      // Then
      expect(result.periodStart).toBeInstanceOf(Date);
      expect(result.periodEnd).toBeInstanceOf(Date);
      expect(result.periodStart.getUTCDate()).toBe(1);
      expect(result.periodStart.getUTCHours()).toBe(0);
      expect(result.periodStart.getUTCMinutes()).toBe(0);
      expect(result.periodStart.getUTCSeconds()).toBe(0);
      expect(result.periodStart.getUTCMilliseconds()).toBe(0);
    });

    it('given date with timezone offset when getting monthly period then uses UTC dates', () => {
      // Given
      const now = new Date('2023-06-15T10:30:00+05:00'); // 5:30 UTC

      // When
      const result = getMonthlyQuotaPeriod(now);

      // Then
      expect(result.periodStart).toEqual(new Date(Date.UTC(2023, 5, 1, 0, 0, 0, 0))); // Jun 1, 2023 UTC
      expect(result.periodEnd).toEqual(new Date(Date.UTC(2023, 6, 1, 0, 0, 0, 0))); // Jul 1, 2023 UTC
    });
  });

  describe('shouldResetQuota', () => {
    it('given null last reset when checking should reset then returns true', () => {
      // Given
      const lastResetAt = null;
      const now = new Date('2023-12-15T10:30:00Z');

      // When
      const result = shouldResetQuota(lastResetAt, now);

      // Then
      expect(result).toBe(true);
    });

    it('given undefined last reset when checking should reset then returns true', () => {
      // Given
      const lastResetAt = undefined;
      const now = new Date('2023-12-15T10:30:00Z');

      // When
      const result = shouldResetQuota(lastResetAt, now);

      // Then
      expect(result).toBe(true);
    });

    it('given empty string last reset when checking should reset then returns true', () => {
      // Given
      const lastResetAt = '';
      const now = new Date('2023-12-15T10:30:00Z');

      // When
      const result = shouldResetQuota(lastResetAt, now);

      // Then
      expect(result).toBe(true);
    });

    it('given last reset in previous month when checking should reset then returns true', () => {
      // Given
      const lastResetAt = '2023-11-15T10:30:00Z';
      const now = new Date('2023-12-15T10:30:00Z');

      // When
      const result = shouldResetQuota(lastResetAt, now);

      // Then
      expect(result).toBe(true);
    });

    it('given last reset in current month when checking should reset then returns false', () => {
      // Given
      const lastResetAt = '2023-12-10T10:30:00Z';
      const now = new Date('2023-12-15T10:30:00Z');

      // When
      const result = shouldResetQuota(lastResetAt, now);

      // Then
      expect(result).toBe(false);
    });

    it('given last reset on first day of current month when checking should reset then returns false', () => {
      // Given
      const lastResetAt = '2023-12-01T00:00:00Z';
      const now = new Date('2023-12-15T10:30:00Z');

      // When
      const result = shouldResetQuota(lastResetAt, now);

      // Then
      expect(result).toBe(false);
    });

    it('given last reset on last day of previous month when checking should reset then returns true', () => {
      // Given
      const lastResetAt = '2023-11-30T23:59:59Z';
      const now = new Date('2023-12-01T00:00:00Z');

      // When
      const result = shouldResetQuota(lastResetAt, now);

      // Then
      expect(result).toBe(true);
    });

    it('given last reset in previous year when checking should reset then returns true', () => {
      // Given
      const lastResetAt = '2022-12-15T10:30:00Z';
      const now = new Date('2023-01-15T10:30:00Z');

      // When
      const result = shouldResetQuota(lastResetAt, now);

      // Then
      expect(result).toBe(true);
    });

    it('given last reset in next month when checking should reset then returns false', () => {
      // Given
      const lastResetAt = '2023-12-15T10:30:00Z';
      const now = new Date('2023-11-15T10:30:00Z'); // This shouldn't happen in practice but test edge case

      // When
      const result = shouldResetQuota(lastResetAt, now);

      // Then
      expect(result).toBe(false);
    });

    it('given no date parameter when checking should reset then uses current date', () => {
      // Given
      const lastResetAt = '2023-11-15T10:30:00Z';
      // No date provided, should use new Date()

      // When
      const result = shouldResetQuota(lastResetAt);

      // Then
      expect(typeof result).toBe('boolean');
    });

    it('given edge case with timezones when checking should reset then handles UTC correctly', () => {
      // Given
      const lastResetAt = '2023-12-01T05:00:00+05:00'; // Actually 00:00 UTC on Dec 1
      const now = new Date('2023-12-15T10:30:00Z');

      // When
      const result = shouldResetQuota(lastResetAt, now);

      // Then
      expect(result).toBe(false); // Should not reset since it's on the first day of current month
    });
  });
});
