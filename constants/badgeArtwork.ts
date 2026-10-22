import type { IconSymbol } from '@/components/ui/icon-symbol';
import type { BadgeFamilyId } from '@/lib/badges/catalog';

type IconSymbolName = Parameters<typeof IconSymbol>[0]['name'];

/**
 * One original illustration per badge family, painted by Codex without words, as a
 * transparent medallion: `assets/images/badges/<family-id>-v1.png` (see its README and
 * catalogue.json). Its gilding is part of the painting, not a tier: the three tiers are
 * told by the card around it.
 *
 * The app bundles WebP exports of those sources, alpha kept, made by
 * `node scripts/export-badge-artwork.mjs`: `full` for the card held in the hand, `small`
 * for the album grid and the tier row.
 */
/** Metro asset ids. */
const BADGE_ARTWORK: Record<BadgeFamilyId, { full: number; small: number }> = {
  'night-journal': {
    full: require('@/assets/images/badges/app/night-journal.webp'),
    small: require('@/assets/images/badges/app/night-journal-small.webp'),
  },
  'gentle-rhythm': {
    full: require('@/assets/images/badges/app/gentle-rhythm.webp'),
    small: require('@/assets/images/badges/app/gentle-rhythm-small.webp'),
  },
  'night-thread': {
    full: require('@/assets/images/badges/app/night-thread.webp'),
    small: require('@/assets/images/badges/app/night-thread-small.webp'),
  },
  'moon-cycles': {
    full: require('@/assets/images/badges/app/moon-cycles.webp'),
    small: require('@/assets/images/badges/app/moon-cycles-small.webp'),
  },
  'ink-dreamer': {
    full: require('@/assets/images/badges/app/ink-dreamer.webp'),
    small: require('@/assets/images/badges/app/ink-dreamer-small.webp'),
  },
  'night-voice': {
    full: require('@/assets/images/badges/app/night-voice.webp'),
    small: require('@/assets/images/badges/app/night-voice-small.webp'),
  },
  'memory-keeper': {
    full: require('@/assets/images/badges/app/memory-keeper.webp'),
    small: require('@/assets/images/badges/app/memory-keeper-small.webp'),
  },
  'dream-reader': {
    full: require('@/assets/images/badges/app/dream-reader.webp'),
    small: require('@/assets/images/badges/app/dream-reader-small.webp'),
  },
  'time-traveler': {
    full: require('@/assets/images/badges/app/time-traveler.webp'),
    small: require('@/assets/images/badges/app/time-traveler-small.webp'),
  },
  'treasure-keeper': {
    full: require('@/assets/images/badges/app/treasure-keeper.webp'),
    small: require('@/assets/images/badges/app/treasure-keeper-small.webp'),
  },
  'favorite-echoes': {
    full: require('@/assets/images/badges/app/favorite-echoes.webp'),
    small: require('@/assets/images/badges/app/favorite-echoes-small.webp'),
  },
  'dream-weaver': {
    full: require('@/assets/images/badges/app/dream-weaver.webp'),
    small: require('@/assets/images/badges/app/dream-weaver-small.webp'),
  },
  'dream-namer': {
    full: require('@/assets/images/badges/app/dream-namer.webp'),
    small: require('@/assets/images/badges/app/dream-namer-small.webp'),
  },
  'night-cartographer': {
    full: require('@/assets/images/badges/app/night-cartographer.webp'),
    small: require('@/assets/images/badges/app/night-cartographer-small.webp'),
  },
  'dream-painter': {
    full: require('@/assets/images/badges/app/dream-painter.webp'),
    small: require('@/assets/images/badges/app/dream-painter-small.webp'),
  },
  'dream-seeker': {
    full: require('@/assets/images/badges/app/dream-seeker.webp'),
    small: require('@/assets/images/badges/app/dream-seeker-small.webp'),
  },
  'path-finder': {
    full: require('@/assets/images/badges/app/path-finder.webp'),
    small: require('@/assets/images/badges/app/path-finder-small.webp'),
  },
  'symbol-explorer': {
    full: require('@/assets/images/badges/app/symbol-explorer.webp'),
    small: require('@/assets/images/badges/app/symbol-explorer-small.webp'),
  },
  'night-scholar': {
    full: require('@/assets/images/badges/app/night-scholar.webp'),
    small: require('@/assets/images/badges/app/night-scholar-small.webp'),
  },
  'observatory': {
    full: require('@/assets/images/badges/app/observatory.webp'),
    small: require('@/assets/images/badges/app/observatory-small.webp'),
  },
};

export function getBadgeArtwork(id: BadgeFamilyId, size: 'full' | 'small' = 'full'): number | null {
  return BADGE_ARTWORK[id]?.[size] ?? null;
}

/** The glyph of the drawn medallion that stands in if a family's illustration cannot be shown. */
export const BADGE_GLYPHS: Record<BadgeFamilyId, IconSymbolName> = {
  'night-journal': 'book.closed.fill',
  'gentle-rhythm': 'calendar',
  'night-thread': 'sparkles',
  'moon-cycles': 'moon.stars.fill',
  'ink-dreamer': 'pencil',
  'night-voice': 'mic.fill',
  'memory-keeper': 'clock',
  'dream-reader': 'book.fill',
  'time-traveler': 'hourglass',
  'treasure-keeper': 'heart.fill',
  'favorite-echoes': 'heart',
  'dream-weaver': 'quote.opening',
  'dream-namer': 'star.fill',
  'night-cartographer': 'paintpalette.fill',
  'dream-painter': 'photo',
  'dream-seeker': 'magnifyingglass',
  'path-finder': 'slider.horizontal.3',
  'symbol-explorer': 'eye.fill',
  'night-scholar': 'lightbulb.fill',
  'observatory': 'chart.line.uptrend.xyaxis',
};
