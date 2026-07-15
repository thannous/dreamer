import {
  getDreamGuideById,
  getDreamGuideContent,
  getDreamGuideSymbols,
  getImportantDreamGuides,
} from '@/services/dreamGuideService';

describe('dreamGuideService', () => {
  it('exposes the four guides prioritized by the website in the configured order', () => {
    expect(getImportantDreamGuides().map((guide) => guide.id)).toEqual([
      'most-common-dream-symbols',
      'scary-dream-symbols',
      'animal-dream-symbols',
      'water-dream-symbols',
    ]);
  });

  it('uses the localized website content', () => {
    const guide = getDreamGuideById('water-dream-symbols');

    expect(guide).toBeDefined();
    expect(getDreamGuideContent(guide!, 'fr').title).toBe('Eau en rêve : signification');
  });

  it('resolves every referenced symbol to the existing app dictionary', () => {
    for (const guide of getImportantDreamGuides()) {
      expect(getDreamGuideSymbols(guide)).toHaveLength(guide.symbols.length);
    }
  });

  it('does not expose non-priority website guides', () => {
    expect(getDreamGuideById('positive-dream-symbols')).toBeUndefined();
  });
});
