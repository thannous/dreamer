import { describe, expect, it } from '@jest/globals';

import {
  COMPACT_TAB_BAR_BOTTOM_INSET,
  COMPACT_TAB_BAR_HEIGHT,
  TAB_BAR_HEIGHT,
  getBottomNavigationLayout,
  getRecordingComposerLayout,
  getTabBarHorizontalLayout,
  isNarrowBottomNavigation,
} from '@/constants/layout';

describe('getBottomNavigationLayout', () => {
  it('uses the regular navigation size in portrait', () => {
    expect(getBottomNavigationLayout(412, 915)).toEqual({
      compact: false,
      narrow: false,
      barHeight: TAB_BAR_HEIGHT,
      minimumBottomInset: 14,
    });
  });

  it('uses a compact navigation size on short landscape screens', () => {
    expect(getBottomNavigationLayout(915, 412)).toEqual({
      compact: true,
      narrow: false,
      barHeight: COMPACT_TAB_BAR_HEIGHT,
      minimumBottomInset: COMPACT_TAB_BAR_BOTTOM_INSET,
    });
  });

  it('keeps the regular size on taller landscape windows', () => {
    expect(getBottomNavigationLayout(1200, 700).compact).toBe(false);
  });

  it('keeps portrait height while marking narrow phones separately', () => {
    expect(getBottomNavigationLayout(320, 640)).toEqual({
      compact: false,
      narrow: true,
      barHeight: TAB_BAR_HEIGHT,
      minimumBottomInset: 14,
    });
  });
});

describe('narrow bottom navigation', () => {
  it.each([
    [320, true],
    [360, true],
    [361, false],
    [390, false],
  ])('classifies %i dp as narrow=%s', (width: number, expected: boolean) => {
    expect(isNarrowBottomNavigation(width)).toBe(expected);
  });

  it('widens the bar only on narrow phones', () => {
    expect(getTabBarHorizontalLayout(320)).toEqual({ start: 8, end: 8 });
    expect(getTabBarHorizontalLayout(390)).toEqual({ start: 22, end: 22 });
    expect(getTabBarHorizontalLayout(1280)).toEqual({ start: 160, end: 160 });
  });
});

describe('getRecordingComposerLayout', () => {
  it.each([
    [1, 144],
    [1.3, 144],
    [2, 164],
  ])('adapts a 320 dp composer at font scale %s', (fontScale: number, inputMinHeight: number) => {
    expect(getRecordingComposerLayout(320, 640, fontScale)).toEqual({
      narrow: true,
      inputMinHeight,
      inputMaxHeight: 286,
    });
  });

  it('uses available height without changing the maximum editing height', () => {
    expect(getRecordingComposerLayout(320, 844, 1)).toEqual({
      narrow: true,
      inputMinHeight: 176,
      inputMaxHeight: 286,
    });
  });

  it('preserves the existing composer geometry on wider screens', () => {
    expect(getRecordingComposerLayout(390, 844, 2)).toEqual({
      narrow: false,
      inputMinHeight: 196,
      inputMaxHeight: 286,
    });
  });
});
