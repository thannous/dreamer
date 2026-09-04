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
export const LARGE_TEXT_FONT_SCALE = 1.3;

export const isNarrowBottomNavigation = (viewportWidth: number) =>
  viewportWidth <= NARROW_TAB_BAR_BREAKPOINT;

function normalizeFontScale(fontScale = 1) {
  return Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;
}

export function getBottomNavigationLayout(
  width: number,
  height: number,
  fontScale = 1
) {
  const compact = width > height && height < 600;
  const narrow = !compact && isNarrowBottomNavigation(width);
  const safeFontScale = normalizeFontScale(fontScale);
  const stackedLabels = narrow || safeFontScale >= LARGE_TEXT_FONT_SCALE;
  const horizontalLayout = getTabBarHorizontalLayout(width);
  const itemWidth = (width - horizontalLayout.start * 2 - (narrow ? 8 : 16) - 2) / 5;
  const labelFontSize = compact || narrow ? 11 : 12;
  const labelLineHeight = 16;
  // Keep visible words on narrow screens and for people using large text.
  // The longest translated label has eleven characters. Reserve conservative
  // wrapping space rather than shrinking the user's requested text size.
  const labelLines = stackedLabels
    ? Math.max(2, Math.ceil((11 * labelFontSize * safeFontScale * 0.65) / Math.max(1, itemWidth - 8)))
    : 1;
  const labelHeight = Math.ceil(labelLines * labelLineHeight * safeFontScale + 4);
  const centerActionWidth = Math.min(compact ? 60 : narrow ? 64 : 72, itemWidth - 4);
  const centerActionHeight = stackedLabels
    ? 32 + 8 + labelHeight + 16
    : compact ? 56 : narrow ? 68 : 76;

  return {
    compact,
    narrow,
    stackedLabels,
    fontScale: safeFontScale,
    labelFontSize,
    labelLineHeight,
    labelLines,
    labelHeight,
    barHeight: Math.max(compact ? COMPACT_TAB_BAR_HEIGHT : TAB_BAR_HEIGHT, centerActionHeight + 10),
    centerActionWidth,
    centerActionHeight,
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
