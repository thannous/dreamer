/**
 * Image utility functions for optimizing image loading and display
 */

/**
 * Thumbnail dimensions for list views
 * Optimized for 80x80 display with 2x pixel density = 160x160 actual pixels
 */
export const THUMBNAIL_SIZE = 160;

/**
 * Generate a thumbnail URL from a full-size image URL
 * This uses URL parameters for services that support dynamic resizing,
 * or returns the original URL as fallback
 *
 * @param imageUrl - The full-size image URL
 * @param size - Desired thumbnail size in pixels (default: 160)
 * @returns Thumbnail URL or original URL
 */
export function getThumbnailUrl(imageUrl: string, size: number = THUMBNAIL_SIZE): string {
  if (!imageUrl) return imageUrl;

  try {
    const url = new URL(imageUrl);

    // Handle different image hosting services

    // Imgur - supports size suffixes
    if (url.hostname.includes('imgur.com')) {
      const path = url.pathname;
      const ext = path.substring(path.lastIndexOf('.'));
      const pathWithoutExt = path.substring(0, path.lastIndexOf('.'));
      return `https://${url.hostname}${pathWithoutExt}s${ext}`; // 's' suffix = small square (90x90)
    }

    // Cloudinary - supports transformation parameters
    if (url.hostname.includes('cloudinary.com')) {
      const path = url.pathname;
      // Insert transformation parameters before the image path
      const transformedPath = path.replace('/upload/', `/upload/w_${size},h_${size},c_fill/`);
      return `https://${url.hostname}${transformedPath}`;
    }

    // Google Cloud Storage / Firebase Storage - supports resize parameter
    if (url.hostname.includes('googleapis.com') || url.hostname.includes('firebasestorage.app')) {
      url.searchParams.set('size', `${size}x${size}`);
      return url.toString();
    }

    // For data URLs or unsupported services, return original
    // expo-image will handle caching and optimization
    return imageUrl;

  } catch (error) {
    // If URL parsing fails (e.g., data URL), return original
    return imageUrl;
  }
}

/**
 * Get optimized image configuration for expo-image based on view type
 */
export function getImageConfig(viewType: 'thumbnail' | 'full') {
  if (viewType === 'thumbnail') {
    return {
      cachePolicy: 'memory-disk' as const,
      priority: 'normal' as const,
      transition: 200,
      // Thumbnail-specific: reduce quality slightly for smaller file size
      contentFit: 'cover' as const,
    };
  }

  return {
    cachePolicy: 'memory-disk' as const,
    priority: 'high' as const,
    transition: 300,
    contentFit: 'cover' as const,
  };
}

/**
 * Preload images to warm up the cache
 * Useful for preloading thumbnails before they enter viewport
 */
export async function preloadImage(uri: string): Promise<void> {
  try {
    const { Image } = await import('expo-image');
    await Image.prefetch(uri);
  } catch (error) {
    // Silently fail - image will load when needed
    if (__DEV__) {
      console.warn('Failed to preload image:', uri, error);
    }
  }
}
