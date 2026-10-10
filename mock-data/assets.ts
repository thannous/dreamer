/**
 * Mock image assets for development mode.
 * The ten dream illustrations of the site, cropped to 9:16: the portrait format the
 * server stores for generated dream images (576×1024), so mock journals look like real ones.
 */
import { Asset } from 'expo-asset';

import type { DreamTheme } from '@/lib/types';

const DREAM_ART = {
  cat: require('@/mock-data/assets/dreams/cat.webp'),
  doors: require('@/mock-data/assets/dreams/doors.webp'),
  floating: require('@/mock-data/assets/dreams/floating.webp'),
  'frozen-lake': require('@/mock-data/assets/dreams/frozen-lake.webp'),
  'glass-teeth': require('@/mock-data/assets/dreams/glass-teeth.webp'),
  harbour: require('@/mock-data/assets/dreams/harbour.webp'),
  'no-driver': require('@/mock-data/assets/dreams/no-driver.webp'),
  staircase: require('@/mock-data/assets/dreams/staircase.webp'),
  station: require('@/mock-data/assets/dreams/station.webp'),
  tide: require('@/mock-data/assets/dreams/tide.webp'),
} as const;

export type MockDreamArt = keyof typeof DREAM_ART;

/** The bundled art as an image source, for `Image` or a dream's `imageUrl`. */
export function getMockDreamArt(name: MockDreamArt): number {
  return DREAM_ART[name];
}

/** A URI for a dream's `imageUrl` and `thumbnailUrl`. */
export function getMockDreamImage(name: MockDreamArt): string {
  // Expo 58 registers numeric asset modules on web too. Resolve those through
  // its registry; react-native-web has no Image.resolveAssetSource.
  const uri = Asset.fromModule(DREAM_ART[name]).uri;
  // The media resolver accepts absolute URLs. Expo's web assets may be relative
  // to the app, so retain their own origin rather than treating them as storage IDs.
  return uri && typeof window !== 'undefined' && window.location?.href
    ? new URL(uri, window.location.href).href : uri;
}

/** Which illustrations suit each theme's mood. */
const THEME_ART: Record<DreamTheme, MockDreamArt[]> = {
  surreal: ['floating', 'glass-teeth', 'no-driver'],
  mystical: ['doors', 'staircase', 'cat'],
  calm: ['tide', 'harbour', 'frozen-lake'],
  noir: ['station', 'no-driver', 'glass-teeth'],
};

/**
 * Get a random image URL for a given theme
 */
export function getRandomImageForTheme(theme: DreamTheme): string {
  const art = THEME_ART[theme] ?? THEME_ART.surreal;
  return getMockDreamImage(art[Math.floor(Math.random() * art.length)]);
}

/**
 * Thumbnail for a mock image: the bundled art is already small enough to serve both.
 */
export function getThumbnailUrl(imageUrl: string): string {
  return imageUrl;
}
