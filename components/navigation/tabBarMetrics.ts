import type { ViewStyle } from 'react-native';

type TabBarLayout = { compact: boolean; narrow: boolean; largeText: boolean };

/** Rounded enough to echo the bar, square enough to keep the label inside its corners. */
export const ACTIVE_PILL_RADIUS = { default: 20, compact: 16 } as const;

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
