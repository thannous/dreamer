import { Platform } from 'react-native';

export const LAYOUT_MAX_WIDTH = 1200;
export const TAB_BAR_MAX_WIDTH = 960;
export const TABLET_BREAKPOINT = 600;
export const DESKTOP_BREAKPOINT = 1024;
export const TAB_BAR_HEIGHT = 86;
export const COMPACT_TAB_BAR_HEIGHT = 64;
export const COMPACT_TAB_BAR_BOTTOM_INSET = 8;
export const TAB_BAR_MARGIN_ANDROID = 6;
export const TAB_BAR_MARGIN_IOS = 12;
export const TAB_BAR_MARGIN = Platform.OS === 'android' ? TAB_BAR_MARGIN_ANDROID : TAB_BAR_MARGIN_IOS;
export const TAB_BAR_CONTENT_BOTTOM_PADDING = 12;
export const NARROW_TAB_BAR_BREAKPOINT = 360;
export const NARROW_TAB_BAR_HORIZONTAL_MARGIN = 8;

export const isNarrowBottomNavigation = (viewportWidth: number) =>
  viewportWidth <= NARROW_TAB_BAR_BREAKPOINT;

export function getBottomNavigationLayout(width: number, height: number) {
  const compact = width > height && height < 600;
  const narrow = !compact && isNarrowBottomNavigation(width);
  return {
    compact,
    narrow,
    barHeight: compact ? COMPACT_TAB_BAR_HEIGHT : TAB_BAR_HEIGHT,
    minimumBottomInset: compact ? COMPACT_TAB_BAR_BOTTOM_INSET : 14,
  };
}

export const TAB_BAR_HORIZONTAL_MARGIN = 22;

export const getTabBarHorizontalLayout = (viewportWidth: number) => {
  const horizontalMargin = isNarrowBottomNavigation(viewportWidth)
    ? NARROW_TAB_BAR_HORIZONTAL_MARGIN
    : TAB_BAR_HORIZONTAL_MARGIN;
  const availableWidth = Math.max(0, viewportWidth - horizontalMargin * 2);
  const width = Math.min(availableWidth, TAB_BAR_MAX_WIDTH);
  const horizontalInset = Math.max(0, (viewportWidth - width) / 2);

  return {
    // React Navigation anchors its tab bar with logical `start`/`end` edges.
    // Override those same properties so its `start: 0` cannot win over a
    // physical `left` value and shift a bounded bar toward the leading edge.
    start: horizontalInset,
    end: horizontalInset,
  };
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export const getRecordingComposerLayout = (
  viewportWidth: number,
  viewportHeight: number,
  fontScale = 1
) => {
  const narrow = viewportWidth <= NARROW_TAB_BAR_BREAKPOINT && viewportHeight >= viewportWidth;

  if (!narrow) {
    return {
      narrow,
      inputMinHeight: 196,
      inputMaxHeight: 286,
    };
  }

  const safeFontScale = Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;
  const preferredMinHeight = Math.round(clamp(viewportHeight * 0.22, 144, 176));
  const accessibleMinHeight = Math.ceil(16 + 56 + 2 * 23 * safeFontScale);
  const inputMinHeight = Math.max(preferredMinHeight, accessibleMinHeight);
  const inputMaxHeight = Math.max(286, inputMinHeight);

  return {
    narrow,
    inputMinHeight,
    inputMaxHeight,
  };
};
