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
  it.each([320, 361, 375, 390, 399, 400, 430, 768])('sizes portrait labels at %i dp without changing narrow classification', (width: number) => {
    const layout = getBottomNavigationLayout(width, 1024);
    expect(layout.labelFontSize).toBe(width < 400 ? 11 : 12);
    expect(layout.narrow).toBe(width <= 360);
    expect(layout.labelLines).toBe(width <= 360 ? 2 : 1);
    expect(layout.barHeight).toBe(width <= 360 ? 102 : TAB_BAR_HEIGHT);
  });

  it.each([1.3, 2])('keeps large text wrapping on a 390 dp phone at scale %s', (fontScale: number) => {
    const layout = getBottomNavigationLayout(390, 844, fontScale);
    expect(layout.fontScale).toBe(fontScale);
    expect(layout.stackedLabels).toBe(true);
    expect(layout.labelFontSize).toBe(11);
    expect(layout.labelLines).toBeGreaterThanOrEqual(2);
    expect(layout.labelHeight).toBeGreaterThanOrEqual(layout.labelLines * 16 * fontScale);
    expect(layout.barHeight).toBeGreaterThan(TAB_BAR_HEIGHT);
  });

  it('uses the regular navigation size in portrait', () => {
    expect(getBottomNavigationLayout(412, 915)).toEqual({
      compact: false,
      narrow: false,
      stackedLabels: false,
      fontScale: 1,
      labelFontSize: 12,
      labelLineHeight: 16,
      labelLines: 1,
      labelHeight: 20,
      barHeight: TAB_BAR_HEIGHT,
      centerActionWidth: 66,
      centerActionHeight: 76,
      minimumBottomInset: 14,
    });
  });

  it('uses a compact navigation size on short landscape screens', () => {
    // Compact base: center 56 + 10 = 66, above the 64 compact minimum.
    expect(getBottomNavigationLayout(915, 412)).toEqual({
      compact: true,
      narrow: false,
      stackedLabels: false,
      fontScale: 1,
      labelFontSize: 11,
      labelLineHeight: 16,
      labelLines: 1,
      labelHeight: 20,
      barHeight: 66,
      centerActionWidth: 60,
      centerActionHeight: 56,
      minimumBottomInset: COMPACT_TAB_BAR_BOTTOM_INSET,
    });
  });

  it('keeps the regular size on taller landscape windows', () => {
    expect(getBottomNavigationLayout(1200, 700).compact).toBe(false);
  });

  it('stacks narrow labels on two lines at 100% text so words stay visible', () => {
    // Astra contract: narrow implies stacked. 320/100% = lines 2, height 36, bar 102.
    // This is the visual fix for truncated "Aujourd'hui / Tendances" — never icon-only.
    expect(getBottomNavigationLayout(320, 640)).toEqual({
      compact: false,
      narrow: true,
      stackedLabels: true,
      fontScale: 1,
      labelFontSize: 11,
      labelLineHeight: 16,
      labelLines: 2,
      labelHeight: 36,
      barHeight: 102,
      centerActionWidth: 54.8,
      centerActionHeight: 92,
      minimumBottomInset: 14,
    });
  });

  it('grows the narrow bar at fontScale 2 instead of capping labels', () => {
    const layout = getBottomNavigationLayout(320, 640, 2);
    expect(layout).toEqual({
      compact: false,
      narrow: true,
      stackedLabels: true,
      fontScale: 2,
      labelFontSize: 11,
      labelLineHeight: 16,
      labelLines: 4,
      labelHeight: 132,
      barHeight: 198,
      centerActionWidth: 54.8,
      centerActionHeight: 188,
      minimumBottomInset: 14,
    });
    expect(layout.labelLines).toBeGreaterThanOrEqual(2);
    expect(layout.barHeight).toBe(layout.centerActionHeight + 10);
    expect(layout.barHeight).toBeGreaterThan(TAB_BAR_HEIGHT);
  });

  it('stacks regular portrait labels at fontScale 2', () => {
    const layout = getBottomNavigationLayout(412, 915, 2);
    expect(layout).toEqual({
      compact: false,
      narrow: false,
      stackedLabels: true,
      fontScale: 2,
      labelFontSize: 12,
      labelLineHeight: 16,
      labelLines: 3,
      labelHeight: 100,
      barHeight: 166,
      centerActionWidth: 66,
      centerActionHeight: 156,
      minimumBottomInset: 14,
    });
    expect(layout.labelLines).toBeGreaterThanOrEqual(2);
    expect(layout.barHeight).toBe(layout.centerActionHeight + 10);
  });

  it('keeps compact landscape labels readable at fontScale 2 without capping them', () => {
    const layout = getBottomNavigationLayout(915, 412, 2);
    expect(layout).toEqual({
      compact: true,
      narrow: false,
      stackedLabels: true,
      fontScale: 2,
      labelFontSize: 11,
      labelLineHeight: 16,
      labelLines: 2,
      labelHeight: 68,
      barHeight: 134,
      centerActionWidth: 60,
      centerActionHeight: 124,
      minimumBottomInset: COMPACT_TAB_BAR_BOTTOM_INSET,
    });
    expect(layout.labelLines).toBeGreaterThanOrEqual(2);
    expect(layout.barHeight).toBeGreaterThan(COMPACT_TAB_BAR_HEIGHT);
  });

  it('stacks labels on narrow screens even at 100% text, otherwise at the large-text threshold', () => {
    expect(getBottomNavigationLayout(320, 640, 1).stackedLabels).toBe(true);
    expect(getBottomNavigationLayout(412, 915, 1).stackedLabels).toBe(false);
    expect(getBottomNavigationLayout(412, 915, 1.29).stackedLabels).toBe(false);
    expect(getBottomNavigationLayout(412, 915, 1.3).stackedLabels).toBe(true);
    expect(getBottomNavigationLayout(412, 915, 2).stackedLabels).toBe(true);
  });

  it('never caps the requested font scale', () => {
    expect(getBottomNavigationLayout(412, 915, 2).fontScale).toBe(2);
    expect(getBottomNavigationLayout(412, 915, 3).fontScale).toBe(3);
  });

  it('normalizes unsafe font scales instead of shrinking the layout', () => {
    expect(getBottomNavigationLayout(412, 915, 0).fontScale).toBe(1);
    expect(getBottomNavigationLayout(412, 915, NaN).fontScale).toBe(1);
    expect(getBottomNavigationLayout(412, 915, 0.8).fontScale).toBe(1);
  });

  it('bounds the center action by the available item width', () => {
    const narrow = getBottomNavigationLayout(320, 640, 1);
    const regular = getBottomNavigationLayout(412, 915, 1);
    expect(narrow.centerActionWidth).toBeLessThanOrEqual(64);
    expect(narrow.centerActionWidth).toBeCloseTo(54.8, 5);
    expect(regular.centerActionWidth).toBeLessThanOrEqual(72);
    expect(regular.centerActionWidth).toBeCloseTo(66, 5);
    expect(narrow.centerActionWidth).toBeLessThan(regular.centerActionWidth);
  });

  it('derives bar height from content, never below the base', () => {
    for (const [w, h, s] of [[412, 915, 1], [320, 640, 1], [320, 640, 2], [915, 412, 1], [915, 412, 2]] as const) {
      const l = getBottomNavigationLayout(w, h, s);
      expect(l.barHeight).toBeGreaterThanOrEqual(l.compact ? COMPACT_TAB_BAR_HEIGHT : TAB_BAR_HEIGHT);
      expect(l.barHeight).toBeGreaterThanOrEqual(l.centerActionHeight + 10);
    }
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

  it('widens the bar below 400 dp while preserving the narrow label breakpoint', () => {
    expect(getTabBarHorizontalLayout(320)).toEqual({ start: 8, end: 8 });
    expect(getTabBarHorizontalLayout(361)).toEqual({ start: 8, end: 8 });
    expect(getTabBarHorizontalLayout(390)).toEqual({ start: 8, end: 8 });
    expect(getTabBarHorizontalLayout(399)).toEqual({ start: 8, end: 8 });
    expect(getTabBarHorizontalLayout(400)).toEqual({ start: 22, end: 22 });
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
