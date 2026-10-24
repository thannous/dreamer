import type { IconSymbol } from '@/components/ui/icon-symbol';
import type { BadgeFamilyId } from '@/lib/badges/catalog';

type IconSymbolName = Parameters<typeof IconSymbol>[0]['name'];

/**
 * One original illustration per badge family, painted by Codex without words, as a
 * transparent medallion: `assets/images/badges/<family-id>-v1.png` (see its README and
 * catalogue.json). Its gilding is part of the painting, not a tier: the tiers are
 * told by the card around it.
 *
 * The app bundles WebP exports of those sources, alpha kept, made by
 * `node scripts/export-badge-artwork.mjs`: `full` for the card held in the hand, `small`
 * for the album grid and the tier row.
 */
/**
 * Metro asset ids. Two families wear the painting of a family the collection retired:
 * the echoes of a shared dream, and the thread of questions.
 */
const BADGE_ARTWORK: Record<BadgeFamilyId, { full: number; small: number }> = {
  'night-journal': {
    full: require('@/assets/images/badges/app/night-journal.webp'),
    small: require('@/assets/images/badges/app/night-journal-small.webp'),
  },
  'moon-cycles': {
    full: require('@/assets/images/badges/app/moon-cycles.webp'),
    small: require('@/assets/images/badges/app/moon-cycles-small.webp'),
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
  'dream-weaver': {
    full: require('@/assets/images/badges/app/dream-weaver.webp'),
    small: require('@/assets/images/badges/app/dream-weaver-small.webp'),
  },
  'symbol-explorer': {
    full: require('@/assets/images/badges/app/symbol-explorer.webp'),
    small: require('@/assets/images/badges/app/symbol-explorer-small.webp'),
  },
  'night-scholar': {
    full: require('@/assets/images/badges/app/night-scholar.webp'),
    small: require('@/assets/images/badges/app/night-scholar-small.webp'),
  },
  'night-echoes': {
    full: require('@/assets/images/badges/app/favorite-echoes.webp'),
    small: require('@/assets/images/badges/app/favorite-echoes-small.webp'),
  },
  'night-voice': {
    full: require('@/assets/images/badges/app/night-voice.webp'),
    small: require('@/assets/images/badges/app/night-voice-small.webp'),
  },
  'dream-questions': {
    full: require('@/assets/images/badges/app/night-thread.webp'),
    small: require('@/assets/images/badges/app/night-thread-small.webp'),
  },
  'treasure-keeper': {
    full: require('@/assets/images/badges/app/treasure-keeper.webp'),
    small: require('@/assets/images/badges/app/treasure-keeper-small.webp'),
  },
  'dream-painter': {
    full: require('@/assets/images/badges/app/dream-painter.webp'),
    small: require('@/assets/images/badges/app/dream-painter-small.webp'),
  },
  'dream-seeker': {
    full: require('@/assets/images/badges/app/dream-seeker.webp'),
    small: require('@/assets/images/badges/app/dream-seeker-small.webp'),
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
  'moon-cycles': 'moon.stars.fill',
  'memory-keeper': 'clock',
  'dream-reader': 'book.fill',
  'time-traveler': 'hourglass',
  'dream-weaver': 'quote.opening',
  'symbol-explorer': 'eye.fill',
  'night-scholar': 'lightbulb.fill',
  'night-echoes': 'square.and.arrow.up',
  'night-voice': 'mic.fill',
  'dream-questions': 'bubble.left.and.bubble.right.fill',
  'treasure-keeper': 'heart.fill',
  'dream-painter': 'photo',
  'dream-seeker': 'magnifyingglass',
  'observatory': 'chart.line.uptrend.xyaxis',
};
