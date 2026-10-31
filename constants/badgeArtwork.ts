import type { IconSymbol } from '@/components/ui/icon-symbol';
import type { BadgeFamilyId } from '@/lib/badges/catalog';
import type { RemoteArtKey } from '@/lib/remoteArt';

type IconSymbolName = Parameters<typeof IconSymbol>[0]['name'];

/**
 * One original illustration per badge family, painted by Codex without words, as a
 * transparent medallion: `assets/images/badges/<family-id>-v1.png` (see its README and
 * catalogue.json). Its gilding is part of the painting, not a tier: the tiers are
 * told by the card around it.
 *
 * WebP exports of those sources, alpha kept, are made by `node scripts/export-badge-artwork.mjs`:
 * `full` for the card held in the hand, served from the CDN (see lib/remoteArt.ts), and
 * `small`, bundled, for the album grid and the tier row, and as the stand-in while the full
 * painting loads or when it cannot be reached.
 */
/**
 * App media keys and Metro asset ids. Two families wear the painting of a family the
 * collection retired: the echoes of a shared dream, and the thread of questions.
 */
export type BadgeArtwork = { full: RemoteArtKey; small: number };

const BADGE_ARTWORK: Record<BadgeFamilyId, BadgeArtwork> = {
  'night-journal': {
    full: 'badges/night-journal',
    small: require('@/assets/images/badges/app/night-journal-small.webp'),
  },
  'moon-cycles': {
    full: 'badges/moon-cycles',
    small: require('@/assets/images/badges/app/moon-cycles-small.webp'),
  },
  'memory-keeper': {
    full: 'badges/memory-keeper',
    small: require('@/assets/images/badges/app/memory-keeper-small.webp'),
  },
  'dream-reader': {
    full: 'badges/dream-reader',
    small: require('@/assets/images/badges/app/dream-reader-small.webp'),
  },
  'time-traveler': {
    full: 'badges/time-traveler',
    small: require('@/assets/images/badges/app/time-traveler-small.webp'),
  },
  'dream-weaver': {
    full: 'badges/dream-weaver',
    small: require('@/assets/images/badges/app/dream-weaver-small.webp'),
  },
  'symbol-explorer': {
    full: 'badges/symbol-explorer',
    small: require('@/assets/images/badges/app/symbol-explorer-small.webp'),
  },
  'night-scholar': {
    full: 'badges/night-scholar',
    small: require('@/assets/images/badges/app/night-scholar-small.webp'),
  },
  'night-echoes': {
    full: 'badges/favorite-echoes',
    small: require('@/assets/images/badges/app/favorite-echoes-small.webp'),
  },
  'night-voice': {
    full: 'badges/night-voice',
    small: require('@/assets/images/badges/app/night-voice-small.webp'),
  },
  'dream-questions': {
    full: 'badges/night-thread',
    small: require('@/assets/images/badges/app/night-thread-small.webp'),
  },
  'treasure-keeper': {
    full: 'badges/treasure-keeper',
    small: require('@/assets/images/badges/app/treasure-keeper-small.webp'),
  },
  'dream-painter': {
    full: 'badges/dream-painter',
    small: require('@/assets/images/badges/app/dream-painter-small.webp'),
  },
  'dream-seeker': {
    full: 'badges/dream-seeker',
    small: require('@/assets/images/badges/app/dream-seeker-small.webp'),
  },
  'observatory': {
    full: 'badges/observatory',
    small: require('@/assets/images/badges/app/observatory-small.webp'),
  },
};

export function getBadgeArtwork(id: BadgeFamilyId): BadgeArtwork | null {
  return BADGE_ARTWORK[id] ?? null;
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
