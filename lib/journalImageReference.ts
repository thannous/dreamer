export const DREAM_IMAGE_BUCKET = 'dream-images';
export const DREAM_IMAGE_STORAGE_REF_PREFIX = `supabase-storage://${DREAM_IMAGE_BUCKET}/`;

export const isRemoteImageUrl = (url?: string | null): boolean =>
  Boolean(url && /^https?:\/\//.test(url));

export const isDreamImageStorageRef = (value?: string | null): value is string =>
  Boolean(value && value.startsWith(DREAM_IMAGE_STORAGE_REF_PREFIX));

export const isStoredDreamImageValue = (value?: string | null): value is string =>
  Boolean(value && (isRemoteImageUrl(value) || isDreamImageStorageRef(value)));

export const buildStorageRef = (path: string): string =>
  `${DREAM_IMAGE_STORAGE_REF_PREFIX}${path.split('/').map(encodeURIComponent).join('/')}`;

export const extractStoragePathFromUrl = (url: string): string | null => {
  if (isDreamImageStorageRef(url)) {
    return decodeURIComponent(url.slice(DREAM_IMAGE_STORAGE_REF_PREFIX.length));
  }

  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean); // storage v1 object public/sign dream-images ...
    const publicIdx = parts.findIndex((p) => p === 'public' || p === 'sign');
    if (publicIdx === -1) return null;
    const bucket = parts[publicIdx + 1];
    if (bucket !== DREAM_IMAGE_BUCKET) return null;
    const objectPath = parts.slice(publicIdx + 2).join('/');
    return decodeURIComponent(objectPath);
  } catch {
    return null;
  }
};

// Uploaded dream images get a square 320 px thumbnail stored beside them under this suffix.
export const SQUARE_THUMBNAIL_SUFFIX = '-thumb';

/** A thumbnail squeezed to a square: wrong for a frame that shows the whole painting. */
export const isSquareDreamThumbnail = (value?: string | null): boolean => {
  const path = value ? extractStoragePathFromUrl(value) : null;
  return Boolean(path && /-thumb\.[a-z0-9]+$/i.test(path));
};

export const toStoredImageReference = (value?: string | null): string => {
  if (!value) return '';
  const path = extractStoragePathFromUrl(value);
  if (path) return buildStorageRef(path);
  return value;
};
