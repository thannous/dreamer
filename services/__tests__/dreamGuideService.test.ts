import {
  getDreamGuideById,
  getDreamGuideContent,
  getDreamGuideSymbols,
  getGeneralDreamGuides,
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

  it('exposes four general guides before the symbol collections', () => {
    expect(getGeneralDreamGuides().map((guide) => guide.id)).toEqual([
      'understand-dreams',
      'remember-dreams',
      'dream-journal',
      'lucid-dreaming',
    ]);

    const guide = getDreamGuideById('dream-journal');
    expect(guide?.kind).toBe('practical');
    expect(guide && getDreamGuideContent(guide, 'fr').title).toBe(
      'Commencer un journal de rêves',
    );
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
