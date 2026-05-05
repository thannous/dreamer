import { describe, expect, it } from '@jest/globals';

import { getTranslator, loadTranslations } from '../i18n';

const languages: ('en' | 'fr' | 'es' | 'de' | 'it')[] = ['en', 'fr', 'es', 'de', 'it'];

const badgeKeys = [
  'journal.badge.favorite',
  'journal.badge.analyzed',
  'journal.badge.explored',
] as const;

const filterAccessibilityKeys = [
  'journal.filter.analyzed',
  'journal.filter.explored',
  'journal.filter.more',
  'journal.filter.more_count',
  'journal.filter.accessibility.analyzed',
  'journal.filter.accessibility.explored',
  'journal.filter.accessibility.more',
] as const;

const advancedFilterSheetKeys = [
  'journal.filter_sheet.eyebrow',
  'journal.filter_sheet.title',
  'journal.filter_sheet.theme_section',
  'journal.filter_sheet.type_section',
  'journal.filter_sheet.empty_themes',
  'journal.filter_sheet.empty_types',
] as const;

const detailActionKeys = [
  'journal.detail.action.analyze.step',
  'journal.detail.action.analyze.title',
  'journal.detail.action.analyze.message',
  'journal.detail.action.retry.title',
  'journal.detail.action.retry.message',
  'journal.detail.action.pending.title',
  'journal.detail.action.pending.message',
  'journal.detail.action.pending.step',
  'journal.detail.action.pending.cta',
  'journal.detail.action.explore.step',
  'journal.detail.action.explore.title',
  'journal.detail.action.explore.message',
  'journal.detail.action.continue.step',
  'journal.detail.action.continue.title',
  'journal.detail.action.continue.message',
  'journal.detail.backup_prompt.title',
  'journal.detail.backup_prompt.message',
  'journal.detail.backup_prompt.cta',
  'journal.detail.zone.memory',
  'journal.detail.zone.reading',
  'journal.detail.zone.actions',
] as const;

describe('Journal i18n - badges & filter accessibility', () => {
  it('has translations for badge labels in all supported languages', async () => {
    await Promise.all(languages.map((lang) => loadTranslations(lang)));

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

  it('has translations for journal filter labels and accessibility copy', async () => {
    await Promise.all(languages.map((lang) => loadTranslations(lang)));

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

  it('has translations for advanced filter sheet copy', async () => {
    await Promise.all(languages.map((lang) => loadTranslations(lang)));

    for (const lang of languages) {
      const t = getTranslator(lang);

      for (const key of advancedFilterSheetKeys) {
        const value = t(key);
        expect(value).not.toBe(key);
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it('has translations for dream detail action-card copy', async () => {
    await Promise.all(languages.map((lang) => loadTranslations(lang)));

    for (const lang of languages) {
      const t = getTranslator(lang);

      for (const key of detailActionKeys) {
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

  it('given no language when translating then defaults to english', () => {
    // Given
    const t = getTranslator();

    // When
    const result = t('nav.home');

    // Then
    expect(result).toBe('Home');
  });

  it('given region-specific language when translating then normalizes to base language', async () => {
    // Given
    await Promise.all([loadTranslations('fr'), loadTranslations('es')]);
    const tFr = getTranslator('fr-FR');
    const tEs = getTranslator('es_MX');

    // When
    const resultFr = tFr('nav.home');
    const resultEs = tEs('nav.home');

    // Then
    expect(resultFr).toBe('Accueil');
    expect(resultEs).toBe('Inicio');
  });
});
