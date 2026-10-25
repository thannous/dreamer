import type { ViewStyle } from 'react-native';
import { BOTTOM_NAVIGATION_MAX_FONT_SIZE_MULTIPLIER, LARGE_TEXT_FONT_SCALE } from '@/constants/layout';

type TabBarLayout = { compact: boolean; narrow: boolean; largeText: boolean };

/** The bar's own padding and corner radius; both bottom bars draw from these. */
export function getTabBarFrame(layout: TabBarLayout) {
  return {
    paddingHorizontal: layout.narrow ? 4 : 8,
    paddingVertical: layout.compact ? 4 : 7,
    borderRadius: layout.compact ? 28 : 36,
  };
}

/**
 * The active tab's background fills the bar's height and reaches a little into
 * its neighbours, so the label keeps room on every side. Its corners follow the
 * bar's, inset by the bar padding. `cellInset` is any padding between the item
 * cell and the view that draws the background.
 */
export function getActivePillFrame(layout: TabBarLayout, index: number, count: number, cellInset = 0) {
  const bar = getTabBarFrame(layout);
  const inner = layout.narrow ? 3 : 6;
  const outer = Math.max(0, bar.paddingHorizontal - bar.paddingVertical);
  return {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -((index === 0 ? outer : inner) + cellInset),
    right: -((index === count - 1 ? outer : inner) + cellInset),
    borderRadius: bar.borderRadius - bar.paddingVertical,
  } satisfies ViewStyle;
}

/** Every icon sits in a slot this tall so the five labels share one baseline. */
export function getIconSlotSize(layout: TabBarLayout) {
  if (layout.compact) return 28;
  if (layout.largeText) return 32;
  return layout.narrow ? 34 : 36;
}

/**
 * The Capture action rises out of the bar on regular portrait layouts. Compact
 * landscape and large text keep it flat inside the bar so nothing overflows.
 */
export function getCaptureAction(layout: TabBarLayout) {
  const slot = getIconSlotSize(layout);
  const raised = !layout.compact && !layout.largeText;
  const size = raised ? (layout.narrow ? 52 : 58) : slot;
  return {
    raised,
    size,
    iconSize: raised ? 24 : layout.compact || layout.largeText ? 16 : 20,
    // Negative margins keep the label baseline shared with the other tabs; the
    // lift is a real transform because Uniwind cannot resolve Tailwind's translate.
    style: {
      width: size,
      height: size,
      borderRadius: size / 2,
      marginVertical: (slot - size) / 2,
      ...(raised ? { borderWidth: 4, transform: [{ translateY: -18 }] } : null),
    } satisfies ViewStyle,
  };
}

/** How far the raised action rises above the bar's top edge, with a little breathing room. */
export function getCaptureOverhang(layout: TabBarLayout) {
  return getCaptureAction(layout).raised ? 16 : 0;
}

/** A soft champagne glow under the raised action; RN spreads it over shadow* and elevation. */
export const CAPTURE_GLOW = {
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.35,
  shadowRadius: 12,
  elevation: 10,
} satisfies ViewStyle;

/** Kept free at the top of the side column for the status bar and the camera (estimated). */
const SIDE_COLUMN_STATUS_HEIGHT = 120;
const SIDE_BAR_MARGIN = 6;
const SIDE_BAR_MAX_WIDTH = 76;
const SIDE_BAR_PADDING = 4;
const SIDE_CELL_MIN_HEIGHT = 52;
const SIDE_CELL_MAX_HEIGHT = 64;
const SIDE_LABEL_LINE_HEIGHT = 14;

/**
 * The navigation standing in the iPhone Duo's side column: one cell per destination, top
 * to bottom in reading order, the bar resting on the column's bottom like the floating
 * bar on the screen's. In a short window (the Duo folded on its side) the cells shrink, down
 * to 52 pt, to leave the top of the column to the status bar; Capture is a disc inside its
 * cell, never raised over the page beside it.
 */
export function getSideColumnBarLayout({ columnWidth, height, bottomInset, fontScale }: {
  columnWidth: number;
  /** The window's height: the column runs its whole height. */
  height: number;
  bottomInset: number;
  fontScale: number;
}) {
  const requestedFontScale = Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;
  const labelScale = Math.min(requestedFontScale, BOTTOM_NAVIGATION_MAX_FONT_SIZE_MULTIPLIER);
  const barWidth = Math.min(columnWidth - SIDE_BAR_MARGIN * 2, SIDE_BAR_MAX_WIDTH);
  const bottom = Math.max(bottomInset, 14);
  const room = height - bottom - SIDE_COLUMN_STATUS_HEIGHT - SIDE_BAR_PADDING * 2;
  const cellHeight = Math.min(SIDE_CELL_MAX_HEIGHT, Math.max(SIDE_CELL_MIN_HEIGHT, Math.floor(room / 5)));
  const labelHeight = Math.ceil(SIDE_LABEL_LINE_HEIGHT * labelScale);
  return {
    barWidth,
    barHeight: cellHeight * 5 + SIDE_BAR_PADDING * 2,
    /** From the column's edge. */
    inset: (columnWidth - barWidth) / 2,
    bottom,
    padding: SIDE_BAR_PADDING,
    borderRadius: 28,
    pillRadius: 22,
    cellHeight,
    labelFontSize: 11,
    labelLineHeight: SIDE_LABEL_LINE_HEIGHT,
    labelHeight,
    // Large text keeps the short names, as the bottom bar does.
    compactLabels: requestedFontScale >= LARGE_TEXT_FONT_SCALE,
    captureSize: Math.min(44, Math.max(28, cellHeight - 10 - labelHeight)),
  };
}
