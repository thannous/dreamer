import {
  getDreamGuideSymbols,
  getImportantDreamGuides,
} from '@/services/dreamGuideService';

describe('dreamGuideService', () => {

  it('resolves every referenced symbol to the existing app dictionary', () => {
    for (const guide of getImportantDreamGuides()) {
      expect(getDreamGuideSymbols(guide)).toHaveLength(guide.symbols.length);
    }
  });
});
