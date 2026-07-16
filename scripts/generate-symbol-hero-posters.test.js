const {
  hasEditorialIllustration,
  resolvePosterIcon,
} = require('./generate-symbol-hero-posters');

describe('symbol hero poster fallbacks', () => {
  it('does not generate a fallback when either extended dataset has an illustration', () => {
    const primary = {
      symbols: { water: { en: { illustration: { src: '/img/water.webp' } } } },
    };
    const tier3 = {
      symbols: { abandonment: { fr: { illustration: { src: '/img/abandon.webp' } } } },
    };

    expect(hasEditorialIllustration('water', primary, tier3)).toBe(true);
    expect(hasEditorialIllustration('abandonment', primary, tier3)).toBe(true);
    expect(hasEditorialIllustration('airport', primary, tier3)).toBe(false);
  });

  it('prefers a symbol-specific icon and otherwise uses the category icon', () => {
    expect(resolvePosterIcon({ id: 'abandonment', category: 'people' })).toBe('heart-crack');
    expect(resolvePosterIcon({ id: 'unknown-place', category: 'places' })).toBe('map-pin');
  });
});
