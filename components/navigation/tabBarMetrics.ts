import type { ViewStyle } from 'react-native';

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
