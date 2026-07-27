import { describe, expect, it } from '@jest/globals';

import {
  COMPACT_TAB_BAR_BOTTOM_INSET,
  COMPACT_TAB_BAR_HEIGHT,
  TAB_BAR_HEIGHT,
  getBottomNavigationLayout,
} from '@/constants/layout';

describe('getBottomNavigationLayout', () => {
  it('uses the regular navigation size in portrait', () => {
    expect(getBottomNavigationLayout(412, 915)).toEqual({
      compact: false,
      barHeight: TAB_BAR_HEIGHT,
      minimumBottomInset: 14,
    });
  });

  it('uses a compact navigation size on short landscape screens', () => {
    expect(getBottomNavigationLayout(915, 412)).toEqual({
      compact: true,
      barHeight: COMPACT_TAB_BAR_HEIGHT,
      minimumBottomInset: COMPACT_TAB_BAR_BOTTOM_INSET,
    });
  });

  it('keeps the regular size on taller landscape windows', () => {
    expect(getBottomNavigationLayout(1200, 700).compact).toBe(false);
  });
});
