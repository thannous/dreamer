/**
 * Fixed sizes of the chrome that floats over tab screens.
 *
 * They live here rather than in each screen because scroll views have to pad
 * by them: the bar is absolutely positioned so the atmosphere runs underneath
 * it, which means nothing reserves that space in layout any more.
 */
export const TabBar = {
  /** The pill itself, excluding the safe area below it. */
  height: 60,
  /** Gap between the pill and the screen edges. */
  margin: 10,
} as const;

/** A denser pill for narrow or short screens; tab items remain at least 48 pt. */
export const CompactTabBar = {
  height: 52,
  margin: 6,
} as const;

/** Artwork (40) + vertical padding (2 × 8) + the hairline above it. */
export const MiniPlayerHeight = 57;
