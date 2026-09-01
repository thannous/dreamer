import { describe, expect, it } from '@jest/globals';

import { getTranslator, loadTranslations } from '../i18n';

const languages: ('en' | 'fr' | 'es' | 'de' | 'it' | 'pt')[] = ['en', 'fr', 'es', 'de', 'it', 'pt'];

const badgeKeys = [
  'journal.badge.favorite',
  'journal.badge.analyzed',
  'journal.badge.explored',
] as const;

const emptyStateKeys = [
  'journal.empty.filtered',
  'journal.empty.default',
  'journal.empty.remembered_hint',
  'journal.empty.remembered_cta',
] as const;

const filterAccessibilityKeys = [
  'journal.filter.all',
  'journal.filter.favorites',
  'journal.filter.to_deepen',
  'journal.filter.remembered',
  'journal.filter.recurring',
  'journal.filter.analyzed',
  'journal.filter.explored',
  'journal.filter.more',
  'journal.filter.more_count',
  'journal.filter.accessibility.all',
  'journal.filter.accessibility.favorites',
  'journal.filter.accessibility.to_deepen',
  'journal.filter.accessibility.analyzed',
  'journal.filter.accessibility.explored',
  'journal.filter.accessibility.more',
] as const;

const advancedFilterSheetKeys = [
  'journal.filter_sheet.eyebrow',
  'journal.filter_sheet.title',
  'journal.filter_sheet.theme_section',
  'journal.filter_sheet.type_section',
  'journal.filter_sheet.memory_section',
  'journal.filter_sheet.status_section',
  'journal.filter_sheet.status.all',
  'journal.filter_sheet.status.unanalyzed',
  'journal.filter_sheet.status.analyzed',
  'journal.filter_sheet.status.explored',
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
  'journal.detail.zone.dream',
  'journal.detail.zone.reading',
  'journal.detail.zone.reflection',
  'journal.detail.zone.actions',
  'journal.detail.explore_button.new',
  'journal.detail.explore_button.continue',
  'journal.detail.reflection_header',
  'journal.detail.stale.label',
  'journal.detail.stale.banner',
  'journal.detail.stale.cta',
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

  it('has translations for journal empty states in all supported languages', async () => {
    await Promise.all(languages.map((lang) => loadTranslations(lang)));

    for (const lang of languages) {
      const t = getTranslator(lang);

      for (const key of emptyStateKeys) {
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

  it('promises lifetime access in the French journal backup prompt', async () => {
    await loadTranslations('fr');

    expect(getTranslator('fr')('journal.detail.backup_prompt.message')).toBe(
      'Créez un compte gratuit après votre première analyse pour sauvegarder votre journal et y accéder à vie.',
    );
  });

  it('labels the three dream-detail zones and the reflection journey in every language', async () => {
    await Promise.all(languages.map((lang) => loadTranslations(lang)));

    const expected = {
      en: {
        dream: 'My dream',
        reading: 'Noctalia analysis',
        reflection: 'My reflection',
        start: 'Start my reflection',
        continue: 'Continue my reflection',
      },
      fr: {
        dream: 'Mon rêve',
        reading: 'Analyse Noctalia',
        reflection: 'Ma réflexion',
        start: 'Commencer ma réflexion',
        continue: 'Continuer ma réflexion',
      },
      es: {
        dream: 'Mi sueño',
        reading: 'Análisis Noctalia',
        reflection: 'Mi reflexión',
        start: 'Empezar mi reflexión',
        continue: 'Continuar mi reflexión',
      },
      de: {
        dream: 'Mein Traum',
        reading: 'Noctalia-Analyse',
        reflection: 'Meine Reflexion',
        start: 'Meine Reflexion beginnen',
        continue: 'Meine Reflexion fortsetzen',
      },
      it: {
        dream: 'Il mio sogno',
        reading: 'Analisi Noctalia',
        reflection: 'La mia riflessione',
        start: 'Inizia la mia riflessione',
        continue: 'Continua la mia riflessione',
      },
      pt: {
        dream: 'Meu sonho',
        reading: 'Análise Noctalia',
        reflection: 'Minha reflexão',
        start: 'Começar a minha reflexão',
        continue: 'Continuar a minha reflexão',
      },
    } as const;

    for (const lang of languages) {
      const t = getTranslator(lang);
      const copy = expected[lang];
      expect(t('journal.detail.zone.dream')).toBe(copy.dream);
      expect(t('journal.detail.zone.reading')).toBe(copy.reading);
      expect(t('journal.detail.zone.reflection')).toBe(copy.reflection);
      expect(t('journal.detail.explore_button.new')).toBe(copy.start);
      expect(t('journal.detail.explore_button.continue')).toBe(copy.continue);
      expect(t('journal.detail.action.explore.title').toLowerCase()).not.toMatch(/explor/);
      expect(t('journal.detail.action.continue.title').toLowerCase()).not.toMatch(/explor/);
      expect(t('journal.detail.explore_button.new').toLowerCase()).not.toMatch(/explor|analiz|analys/);
      expect(t('journal.detail.explore_button.continue').toLowerCase()).not.toMatch(/explor|analiz|analys/);
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
    expect(result).toBe('Today');
  });

  it('given region-specific language when translating then normalizes to base language', async () => {
    // Given
    await Promise.all([loadTranslations('fr'), loadTranslations('es'), loadTranslations('pt')]);
    const tFr = getTranslator('fr-FR');
    const tEs = getTranslator('es_MX');
    const tPt = getTranslator('pt-BR');

    // When
    const resultFr = tFr('nav.home');
    const resultEs = tEs('nav.home');
    const resultPt = [
      tPt('nav.home'),
      tPt('nav.journal'),
      tPt('nav.capture_dream'),
      tPt('nav.stats'),
      tPt('nav.settings'),
    ];

    // Then
    expect(resultFr).toBe('Aujourd’hui');
    expect(resultEs).toBe('Hoy');
    expect(resultPt).toEqual(['Hoje', 'Diário', 'Registrar', 'Tendências', 'Ajustes']);
  });
});
