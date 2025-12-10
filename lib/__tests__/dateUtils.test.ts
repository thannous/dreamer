import { describe, expect, it } from 'vitest';

import { formatDreamDate, formatDreamTime, formatShortDate, getCurrentMoonCycleTimestamp } from '../dateUtils';

describe('dateUtils', () => {
  const testTimestamp = new Date('2024-03-15T10:30:00').getTime();

  describe('formatDreamDate', () => {
    it('given timestamp when formatting then returns full date with weekday', () => {
      const result = formatDreamDate(testTimestamp, 'en-US');
      expect(result).toBe('Friday, March 15, 2024');
    });

    it('given timestamp with French locale when formatting then returns localized date', () => {
      const result = formatDreamDate(testTimestamp, 'fr-FR');
      expect(result).toBe('vendredi 15 mars 2024');
    });

    it('given timestamp without locale when formatting then uses default locale', () => {
      const result = formatDreamDate(testTimestamp);
      expect(result).toContain('2024');
      expect(result).toContain('15');
    });
  });

  describe('formatDreamTime', () => {
    it('given timestamp when formatting then returns time with hour and minute', () => {
      const result = formatDreamTime(testTimestamp, 'en-US');
      expect(result).toMatch(/10:30\s*AM/i);
    });

    it('given timestamp with French locale when formatting then returns 24h format', () => {
      const result = formatDreamTime(testTimestamp, 'fr-FR');
      expect(result).toMatch(/10:30|10 h 30/);
    });

    it('given afternoon timestamp when formatting then shows PM', () => {
      const pmTimestamp = new Date('2024-03-15T14:45:00').getTime();
      const result = formatDreamTime(pmTimestamp, 'en-US');
      expect(result).toMatch(/2:45\s*PM/i);
    });
  });

  describe('formatShortDate', () => {
    it('given timestamp when formatting then returns short date', () => {
      const result = formatShortDate(testTimestamp, 'en-US');
      expect(result).toBe('Mar 15, 2024');
    });

    it('given timestamp with French locale when formatting then returns localized short date', () => {
      const result = formatShortDate(testTimestamp, 'fr-FR');
      expect(result).toMatch(/15 mars 2024/i);
    });
  });

  describe('getCurrentMoonCycleTimestamp', () => {
    it('given default locale when getting moon cycle then returns formatted string', () => {
      const result = getCurrentMoonCycleTimestamp();
      expect(result).toContain('Cycle of the Moon:');
    });

    it('given English locale when getting moon cycle then includes date parts', () => {
      const result = getCurrentMoonCycleTimestamp('en-US');
      expect(result).toContain('Cycle of the Moon:');
      // Should contain month, day, year, and time
      expect(result).toMatch(/\d{4}/); // year
    });
  });
});
