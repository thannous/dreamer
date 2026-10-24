import { Platform, type ViewStyle } from 'react-native';

export const LAYOUT_MAX_WIDTH = 1200;
/** Five destinations stay a hand's reach apart on a large display or a phone on its side. */
export const TAB_BAR_MAX_WIDTH = 640;
export const TABLET_BREAKPOINT = 600;
export const DESKTOP_BREAKPOINT = 1024;

/**
 * Window classes come from the space the app has, never from the device: one iPhone Duo
 * is a compact phone folded (about 466 × 678 points) and a large display open (about
 * 669 × 951, or 951 × 669 on its side), and Split View can make either a narrow column.
 */
export const LARGE_WINDOW_MIN_WIDTH = TABLET_BREAKPOINT;
/** A large window this wide lays its grids out in more columns: the open Duo on its side. */
export const EXPANDED_WINDOW_MIN_WIDTH = 840;
/** A phone on its side is as wide but too short for the taller cards of an expanded grid. */
export const EXPANDED_WINDOW_MIN_HEIGHT = 480;

export type WindowClass = 'compact' | 'large' | 'expanded';

export function getWindowClass(width: number, height: number): WindowClass {
  if (width < LARGE_WINDOW_MIN_WIDTH) return 'compact';
  return width >= EXPANDED_WINDOW_MIN_WIDTH && height >= EXPANDED_WINDOW_MIN_HEIGHT ? 'expanded' : 'large';
}

/** Each page's margin at the binding of two facing pages: text and controls keep clear of the fold. */
export const SPREAD_GUTTER = 28;
/** The narrowest page two facing pages are laid out with. */
export const SPREAD_PAGE_MIN_WIDTH = 320;

/** Two facing pages: the binding (`spine`) and the whole width, in the screen's content frame. */
export type JournalSpread = { spine: number; width: number };

/**
 * A dream opens as a book's two facing pages where an expanded window has room for both:
 * the open iPhone Duo on its side, held as a book. Folded, open upright, in Split View or
 * on a phone on its side the window is narrower and the dream keeps its single page. The
 * binding lies on the window's middle, where the open Duo folds (an expanded window fills
 * the open display), given in the content's frame, which starts after the left side safe
 * area; each page keeps a reading width. The web keeps its single page beside its shell.
 */
export function getJournalSpread({ width, height, windowWidth, leftInset, web }: {
  /** The content's width: the window less its side safe areas. */
  width: number;
  height: number;
  windowWidth: number;
  /** The left side safe area, where the content starts in the window. */
  leftInset: number;
  web: boolean;
}): JournalSpread | null {
  if (web || getWindowClass(width, height) !== 'expanded') return null;
  const fold = windowWidth / 2 - leftInset;
  const spine = Math.round(Math.min(width - SPREAD_PAGE_MIN_WIDTH, Math.max(SPREAD_PAGE_MIN_WIDTH, fold)));
  return { spine, width };
}

/** Reading width of desktop tab pages beside the sidebar. */
export const DESKTOP_CONTENT_MAX_WIDTH = 960;
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
export const BOTTOM_NAVIGATION_MAX_FONT_SIZE_MULTIPLIER = 1.3;

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
  const requestedFontScale = normalizeFontScale(fontScale);
  const safeFontScale = Math.min(requestedFontScale, BOTTOM_NAVIGATION_MAX_FONT_SIZE_MULTIPLIER);
  const largeText = requestedFontScale >= LARGE_TEXT_FONT_SCALE;
  const stackedLabels = narrow || largeText;
  const horizontalLayout = getTabBarHorizontalLayout(width);
  const contentWidth = Math.max(0, width - horizontalLayout.start * 2 - (narrow ? 8 : 16) - 2);
  const itemWidth = contentWidth / 5;
  // Phones read 12-point labels; only narrow and short landscape bars drop to 11.
  const labelFontSize = compact || narrow ? 11 : 12;
  const labelLineHeight = 16;
  // Android cannot shrink a label to fit without making it tiny, so it uses the short
  // names wherever the full ones may not fit at 12 points: below 384 dp or with larger text.
  const compactLabels = largeText || narrow
    || (Platform.OS === 'android' && (width < 384 || requestedFontScale > 1));
  // Keep navigation compact while the dream itself follows the user's text size.
  // Translated short labels stay on one line; accessible tab names remain complete.
  const labelLines = 1;
  const labelHeight = Math.ceil(labelLines * labelLineHeight * safeFontScale + 4);
  const centerActionWidth = largeText
    ? itemWidth - 4
    : Math.min(compact ? 60 : narrow ? 64 : 72, itemWidth - 4);
  const horizontalCenter = false;
  const centerLabelLines = 1;
  const centerLabelHeight = Math.ceil(centerLabelLines * labelLineHeight * safeFontScale + 4);
  const rowHeight = 24 + 10 + labelHeight + 3 + 10;
  const centerActionHeight = stackedLabels
    ? horizontalCenter ? Math.max(48, centerLabelHeight + 16) : 32 + 8 + centerLabelHeight + 16
    : compact ? 56 : narrow ? 68 : 76;
  const centerRowHeight = centerActionHeight + 8;

  return {
    compact,
    narrow,
    stackedLabels,
    largeText,
    compactLabels,
    fontScale: safeFontScale,
    itemWidth,
    contentWidth,
    rowHeight,
    centerRowHeight,
    centerLabelLines,
    centerLabelHeight,
    horizontalCenter,
    labelFontSize,
    labelLineHeight,
    labelLines,
    labelHeight,
    // Grow the labels within one row; never turn the persistent navigation
    // into a three-row panel when the user increases their text size.
    barHeight: Math.max(
      compact ? COMPACT_TAB_BAR_HEIGHT : TAB_BAR_HEIGHT,
      centerActionHeight + 10,
      largeText ? rowHeight + 14 : 0,
    ),
    centerActionWidth,
    centerActionHeight,
    minimumBottomInset: compact ? COMPACT_TAB_BAR_BOTTOM_INSET : 14,
  };
}

/** Keep the five destinations in the same horizontal reading order at every text size. */
export function getBottomNavigationItemStyle(
  _index: number,
  _layout: ReturnType<typeof getBottomNavigationLayout>
): ViewStyle {
  return { flex: 1, height: '100%' };
}

export const TAB_BAR_HORIZONTAL_MARGIN = 22;

export const getTabBarHorizontalLayout = (viewportWidth: number) => {
  // Phones give the five labels the width; the wide margin is for tablets.
  const horizontalMargin = viewportWidth < TABLET_BREAKPOINT
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
