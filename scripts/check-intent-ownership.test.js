const {
  hasQuickLookupMarker,
  normalizeIntentText,
  semanticSimilarity,
} = require('./check-intent-ownership');

describe('intent ownership helpers', () => {
  it('normalizes accents and brand suffixes for comparison', () => {
    expect(normalizeIntentText('Fiche rapide : l’eau | Noctalia')).toBe('fiche rapide l eau');
  });

  it('recognizes localized quick-reference ownership', () => {
    expect(
      hasQuickLookupMarker(
        { title: 'Water', description: 'This quick symbol reference summarizes water.', h1: 'Water' },
        'en'
      )
    ).toBe(true);
    expect(
      hasQuickLookupMarker(
        { title: 'Water dreams', description: 'A complete guide to every scenario.', h1: 'Water' },
        'en'
      )
    ).toBe(false);
    expect(
      hasQuickLookupMarker(
        { title: 'Agua', description: 'Esta ficha rápida resume el símbolo.', h1: 'Agua' },
        'es'
      )
    ).toBe(true);
    expect(hasQuickLookupMarker({ quickIntent: true }, 'de')).toBe(true);
  });

  it('detects near-duplicate intent signals without flagging distinct ones', () => {
    expect(
      semanticSimilarity(
        'Water dream meaning and interpretation guide',
        'Water dream meaning interpretation guide'
      )
    ).toBeGreaterThan(0.82);
    expect(semanticSimilarity('Complete water dream scenarios', 'Quick symbol lookup for water')).toBeLessThan(0.5);
  });
});
