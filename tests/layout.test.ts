import { describe, expect, it } from '@jest/globals';

import {
  COMPACT_TAB_BAR_BOTTOM_INSET,
  COMPACT_TAB_BAR_HEIGHT,
  TAB_BAR_HEIGHT,
  getBottomNavigationLayout,
  getBottomNavigationItemStyle,
  getRecordingComposerLayout,
  getTabBarHorizontalLayout,
  isNarrowBottomNavigation,
} from '@/constants/layout';

describe('getBottomNavigationLayout', () => {
  it.each([320, 361, 375, 390, 399, 400, 430, 768])('sizes portrait labels at %i dp without changing narrow classification', (width: number) => {
    const layout = getBottomNavigationLayout(width, 1024);
    expect(layout.labelFontSize).toBe(width < 400 ? 11 : 12);
    expect(layout.narrow).toBe(width <= 360);
    expect(layout.labelLines).toBe(1);
    expect(layout.barHeight).toBe(TAB_BAR_HEIGHT);
  });

  it.each([320, 360, 434, 1280])('keeps five equal horizontal cells at %i dp with large text', (width: number) => {
    for (const fontScale of [1, 1.5, 2]) {
      const layout = getBottomNavigationLayout(width, 900, fontScale);
      const frames = [0, 1, 2, 3, 4].map((index) => getBottomNavigationItemStyle(index, layout));
      expect(frames.every((frame) => frame.position === undefined && frame.flex === 1)).toBe(true);
      expect(layout.itemWidth * 5).toBeCloseTo(layout.contentWidth);
      expect(layout.centerActionWidth).toBeLessThan(layout.itemWidth);
      expect(layout.barHeight).toBeLessThan(160);
      expect(layout.contentWidth).toBeLessThanOrEqual(960);
    }
  });

  it('uses the regular navigation size in portrait', () => {
    expect(getBottomNavigationLayout(412, 915)).toMatchObject({
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
    expect(getBottomNavigationLayout(915, 412)).toMatchObject({
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

  it('uses compact translated labels on one line at narrow default scale', () => {
    expect(getBottomNavigationLayout(320, 640)).toMatchObject({
      compact: false,
      narrow: true,
      stackedLabels: true,
      fontScale: 1,
      labelFontSize: 11,
      labelLineHeight: 16,
      labelLines: 1,
      labelHeight: 20,
      barHeight: 86,
      centerActionWidth: 54.8,
      centerActionHeight: 76,
      minimumBottomInset: 14,
    });
  });

  it.each([[640, 320], [915, 412]])('keeps compact large text in one row at %i by %i dp', (width: number, height: number) => {
    for (const scale of [1, 1.5, 2]) {
      const layout = getBottomNavigationLayout(width, height, scale);
      const frames = [0, 1, 2, 3, 4].map((index) => getBottomNavigationItemStyle(index, layout));
      expect(frames.every((frame) => frame.position === undefined)).toBe(true);
      expect(height - layout.barHeight - 24).toBeGreaterThanOrEqual(120);
    }
  });

  it('stacks labels on narrow screens even at 100% text, otherwise at the large-text threshold', () => {
    expect(getBottomNavigationLayout(320, 640, 1).stackedLabels).toBe(true);
    expect(getBottomNavigationLayout(412, 915, 1).stackedLabels).toBe(false);
    expect(getBottomNavigationLayout(412, 915, 1.29).stackedLabels).toBe(false);
    expect(getBottomNavigationLayout(412, 915, 1.3).stackedLabels).toBe(true);
    expect(getBottomNavigationLayout(412, 915, 2).stackedLabels).toBe(true);
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
