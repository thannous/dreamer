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
      stackedLabels: false,
      fontScale: 1,
      barHeight: TAB_BAR_HEIGHT,
      centerActionWidth: 72,
      centerActionHeight: 76,
      minimumBottomInset: 14,
    });
  });

  it('uses a compact navigation size on short landscape screens', () => {
    expect(getBottomNavigationLayout(915, 412)).toEqual({
      compact: true,
      narrow: false,
      stackedLabels: false,
      fontScale: 1,
      barHeight: COMPACT_TAB_BAR_HEIGHT,
      centerActionWidth: 60,
      centerActionHeight: 56,
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
      stackedLabels: false,
      fontScale: 1,
      barHeight: TAB_BAR_HEIGHT,
      centerActionWidth: 64,
      centerActionHeight: 68,
      minimumBottomInset: 14,
    });
  });

  it('grows the narrow bar at fontScale 2 instead of capping labels', () => {
    expect(getBottomNavigationLayout(320, 640, 2)).toEqual({
      compact: false,
      narrow: true,
      stackedLabels: true,
      fontScale: 2,
      barHeight: TAB_BAR_HEIGHT + 28,
      centerActionWidth: 64,
      centerActionHeight: 96,
      minimumBottomInset: 14,
    });
  });

  it('stacks regular portrait labels at fontScale 2', () => {
    expect(getBottomNavigationLayout(412, 915, 2)).toEqual({
      compact: false,
      narrow: false,
      stackedLabels: true,
      fontScale: 2,
      barHeight: TAB_BAR_HEIGHT + 24,
      centerActionWidth: 72,
      centerActionHeight: 100,
      minimumBottomInset: 14,
    });
  });

  it('keeps compact landscape labels readable at fontScale 2 without capping them', () => {
    expect(getBottomNavigationLayout(915, 412, 2)).toEqual({
      compact: true,
      narrow: false,
      stackedLabels: true,
      fontScale: 2,
      barHeight: COMPACT_TAB_BAR_HEIGHT + 18,
      centerActionWidth: 60,
      centerActionHeight: 74,
      minimumBottomInset: COMPACT_TAB_BAR_BOTTOM_INSET,
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
