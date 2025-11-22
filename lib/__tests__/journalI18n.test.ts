import { describe, expect, it } from 'vitest';

import { getTranslator } from '@/lib/i18n';

const languages: ('en' | 'fr' | 'es')[] = ['en', 'fr', 'es'];

const badgeKeys = [
  'journal.badge.favorite',
  'journal.badge.analyzed',
  'journal.badge.explored',
] as const;

const filterAccessibilityKeys = [
  'journal.filter.accessibility.analyzed',
  'journal.filter.accessibility.explored',
] as const;

describe('Journal i18n - badges & filter accessibility', () => {
  it('has translations for badge labels in all supported languages', () => {
    for (const lang of languages) {
      const t = getTranslator(lang);

      for (const key of badgeKeys) {
        const value = t(key);
        expect(value).not.toBe(key);
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it('has translations for analyzed/explored filter accessibility labels', () => {
    for (const lang of languages) {
      const t = getTranslator(lang);

      for (const key of filterAccessibilityKeys) {
        const value = t(key);
        expect(value).not.toBe(key);
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('getTranslator replacement functionality', () => {
  it('given double brace replacements when translating then replaces correctly', () => {
    // Given
    const t = getTranslator('en');
    
    // When
    const result = t('test {{name}} template', { name: 'John' });
    
    // Then
    expect(result).toBe('test John template');
  });

  it('given single brace replacements when translating then replaces correctly', () => {
    // Given
    const t = getTranslator('en');
    
    // When
    const result = t('test {count} items', { count: 5 });
    
    // Then
    expect(result).toBe('test 5 items');
  });

  it('given mixed brace replacements when translating then replaces both types', () => {
    // Given
    const t = getTranslator('en');
    
    // When
    const result = t('{{user}} has {count} dreams', { user: 'Alice', count: 3 });
    
    // Then
    expect(result).toBe('Alice has 3 dreams');
  });

  it('given numeric replacements when translating then converts to string', () => {
    // Given
    const t = getTranslator('en');
    
    // When
    const result = t('Progress: {{percent}}%', { percent: 75.5 });
    
    // Then
    expect(result).toBe('Progress: 75.5%');
  });

  it('given no replacements when translating then returns original string', () => {
    // Given
    const t = getTranslator('en');
    
    // When
    const result = t('simple string');
    
    // Then
    expect(result).toBe('simple string');
  });

  it('given empty replacements when translating then returns original string', () => {
    // Given
    const t = getTranslator('en');
    
    // When
    const result = t('simple string', {});
    
    // Then
    expect(result).toBe('simple string');
  });

  it('given unknown key when translating then returns key as fallback', () => {
    // Given
    const t = getTranslator('en');
    
    // When
    const result = t('unknown.key');
    
    // Then
    expect(result).toBe('unknown.key');
  });

  it('given unknown language when translating then falls back to english', () => {
    // Given
    const t = getTranslator('unknown');
    
    // When
    const result = t('test {{name}} template', { name: 'John' });
    
    // Then
    expect(result).toBe('test John template');
  });
});
