/**
 * Mock image assets for development mode
 * Uses picsum.photos for placeholder images
 */

import type { DreamTheme } from '@/lib/types';

export const MOCK_IMAGES = {
  surreal: [
    'https://picsum.photos/seed/dream1/800/600',
    'https://picsum.photos/seed/dream2/800/600',
    'https://picsum.photos/seed/dream3/800/600',
  ],
  mystical: [
    'https://picsum.photos/seed/mystic1/800/600',
    'https://picsum.photos/seed/mystic2/800/600',
    'https://picsum.photos/seed/mystic3/800/600',
  ],
  calm: [
    'https://picsum.photos/seed/calm1/800/600',
    'https://picsum.photos/seed/calm2/800/600',
    'https://picsum.photos/seed/calm3/800/600',
  ],
  noir: [
    'https://picsum.photos/seed/noir1/800/600',
    'https://picsum.photos/seed/noir2/800/600',
    'https://picsum.photos/seed/noir3/800/600',
  ],
};

/**
 * Get a random image URL for a given theme
 */
export function getRandomImageForTheme(theme: DreamTheme): string {
  const images = MOCK_IMAGES[theme] || MOCK_IMAGES.surreal;
  return images[Math.floor(Math.random() * images.length)];
}

/**
 * Generate thumbnail URL from image URL
 */
export function getThumbnailUrl(imageUrl: string): string {
  // For picsum, we can just change the size
  return imageUrl.replace('/800/600', '/400/300');
}
