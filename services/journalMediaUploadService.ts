import type { SupabaseClient } from '@supabase/supabase-js';
import type { DreamAnalysis } from '@/lib/types';
import { DREAM_IMAGE_BUCKET, isStoredDreamImageValue, buildStorageRef, extractStoragePathFromUrl } from '@/lib/journalImageReference';
export type WebpOptions = {
  compress?: number;
  /**
   * Resize longest side down to this value. Skipped for small payloads to avoid upscaling.
   */
  maxDimension?: number;
  /**
   * Force square resize (used for thumbnails).
   */
  squareSize?: number;
};


type JournalMediaUploadDependencies = {
  getClient: () => SupabaseClient;
  isConfigured: () => boolean;
  invalidateDreamMedia: (reference: string) => void;
  readImageFileBase64: (uri: string) => Promise<string>;
  convertToWebpBase64: (
    params: { base64?: string; uri?: string; contentType?: string },
    options?: WebpOptions
  ) => Promise<{ base64: string; contentType: string }>;
};

const isDataUriImage = (value?: string | null): value is string =>
  Boolean(value && value.startsWith('data:image'));

const isFileUri = (value?: string | null): value is string =>
  Boolean(value && value.startsWith('file://'));

const extractBase64Payload = (value: string): { base64: string; contentType: string } | null => {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(value);
  if (!match) return null;
  return { contentType: match[1], base64: match[2] };
};

const guessContentTypeFromPath = (path: string): string => {
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
};

const decodeBase64ToUint8Array = (base64: string): Uint8Array => {
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const sanitized = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const padding = sanitized.endsWith('==') ? 2 : sanitized.endsWith('=') ? 1 : 0;
  const length = Math.floor((sanitized.length * 3) / 4) - padding;
  const bytes = new Uint8Array(length);

  let byteIndex = 0;
  for (let i = 0; i < sanitized.length; i += 4) {
    const enc1 = Math.max(0, chars.indexOf(sanitized[i]));
    const enc2 = Math.max(0, chars.indexOf(sanitized[i + 1]));
    const enc3 = sanitized[i + 2] === '=' ? 0 : Math.max(0, chars.indexOf(sanitized[i + 2]));
    const enc4 = sanitized[i + 3] === '=' ? 0 : Math.max(0, chars.indexOf(sanitized[i + 3]));

    const chunk = (enc1 << 18) | (enc2 << 12) | ((enc3 & 63) << 6) | (enc4 & 63);

    if (byteIndex < length) bytes[byteIndex++] = (chunk >> 16) & 0xff;
    if (byteIndex < length) bytes[byteIndex++] = (chunk >> 8) & 0xff;
    if (byteIndex < length) bytes[byteIndex++] = chunk & 0xff;
  }

  return bytes;
};

export function createJournalMediaUploadService({
  getClient, isConfigured, invalidateDreamMedia, readImageFileBase64, convertToWebpBase64,
}: JournalMediaUploadDependencies) {
  const MAX_UPLOAD_DIMENSION = 1600;
  const THUMBNAIL_SQUARE_SIZE = 320;
  const THUMBNAIL_COMPRESS = 0.7;

  const buildStoragePath = (userId: string, extension: string) =>
    `${userId}/dream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const applyVariantToPath = (path: string, variant: 'image' | 'thumbnail') => {
    if (variant !== 'thumbnail') return path;
    const lastDot = path.lastIndexOf('.');
    const base = lastDot === -1 ? path : path.slice(0, lastDot);
    const ext = lastDot === -1 ? '' : path.slice(lastDot);
    if (base.endsWith('-thumb')) return `${base}${ext}`;
    return `${base}-thumb${ext}`;
  };

  const deleteFromBucketIfPossible = async (url?: string | null, ownerId?: string) => {
    if (!url || !isStoredDreamImageValue(url)) return;
    const path = extractStoragePathFromUrl(url);
    if (!path) return;
    if (ownerId && !path.startsWith(`${ownerId}/`)) return;
    try {
      await getClient().storage.from(DREAM_IMAGE_BUCKET).remove([path]);
      invalidateDreamMedia(url);
    } catch {
      console.warn('[supabaseDreamService] failed to delete old image');
    }
  };

  const deriveStoragePath = (params: {
    userId: string;
    contentType: string;
    existingUrl?: string | null;
    remoteId?: number;
    variant?: 'image' | 'thumbnail';
  }) => {
    const { userId, contentType, existingUrl, remoteId, variant = 'image' } = params;
    const extension = (contentType.split('/')[1] ?? 'jpg').split('+')[0];

    if (remoteId) {
      return { path: applyVariantToPath(`${userId}/dream-${remoteId}.${extension}`, variant), extension };
    }
    const existingPath = existingUrl ? extractStoragePathFromUrl(existingUrl) : null;
    if (existingPath && existingPath.startsWith(`${userId}/`)) {
      return { path: applyVariantToPath(existingPath, variant), extension };
    }
    return { path: applyVariantToPath(buildStoragePath(userId, extension), variant), extension };
  };

  const uploadImageToBucket = async (
    base64: string,
    contentType: string,
    userId: string,
    preferredPath?: string,
    remoteId?: number,
    variant: 'image' | 'thumbnail' = 'image'
  ): Promise<string> => {
    const { path } = deriveStoragePath({
      userId,
      contentType,
      existingUrl: preferredPath,
      remoteId,
      variant,
    });
    const data = decodeBase64ToUint8Array(base64);

    const { data: uploadData, error } = await getClient()
      .storage
      .from(DREAM_IMAGE_BUCKET)
      .upload(path, data, {
        contentType,
        upsert: true,
      });

    if (error || !uploadData) {
      throw new Error(error?.message ?? 'Failed to upload image');
    }

    const reference = buildStorageRef(uploadData.path);
    invalidateDreamMedia(reference);
    return reference;
  };

  async function ensureRemoteImage(dream: DreamAnalysis, userId?: string): Promise<DreamAnalysis> {
    if (!isConfigured()) return dream;

    const ownerId = userId ?? (await getClient().auth.getUser()).data.user?.id;
    if (!ownerId) return dream;

    let imageUrl = dream.imageUrl;
    let thumbnailUrl = dream.thumbnailUrl;
    const previousRemoteImageUrl = isStoredDreamImageValue(dream.imageUrl) ? dream.imageUrl : null;
    const previousRemoteThumbnailUrl = isStoredDreamImageValue(dream.thumbnailUrl) ? dream.thumbnailUrl : null;

    const handleFailure = (): DreamAnalysis => ({
      ...dream,
      imageUrl: '',
      thumbnailUrl: undefined,
      imageGenerationFailed: dream.imageGenerationFailed ?? true,
    });

    try {
      if (imageUrl && (isDataUriImage(imageUrl) || isFileUri(imageUrl))) {
        let contentType = 'image/jpeg';
        let base64: string | null = null;

        if (isDataUriImage(imageUrl)) {
          const extracted = extractBase64Payload(imageUrl);
          base64 = extracted?.base64 ?? null;
          contentType = extracted?.contentType ?? contentType;
        } else if (isFileUri(imageUrl)) {
          base64 = await readImageFileBase64(imageUrl);
          contentType = guessContentTypeFromPath(imageUrl);
        }

        if (base64) {
          const webp = await convertToWebpBase64(
            { base64, uri: isFileUri(imageUrl) ? imageUrl : undefined, contentType },
            { maxDimension: MAX_UPLOAD_DIMENSION }
          );
          const remoteUrl = await uploadImageToBucket(
            webp.base64,
            webp.contentType,
            ownerId,
            previousRemoteImageUrl ?? undefined,
            dream.remoteId
          );
          imageUrl = remoteUrl;
          const thumb = await convertToWebpBase64(
            { base64, uri: isFileUri(imageUrl) ? imageUrl : undefined, contentType },
            { squareSize: THUMBNAIL_SQUARE_SIZE, compress: THUMBNAIL_COMPRESS }
          );
          const remoteThumbUrl = await uploadImageToBucket(
            thumb.base64,
            thumb.contentType,
            ownerId,
            previousRemoteThumbnailUrl ?? undefined,
            dream.remoteId,
            'thumbnail'
          );
          thumbnailUrl = remoteThumbUrl || thumbnailUrl || remoteUrl;
          if (!thumbnailUrl || !isStoredDreamImageValue(thumbnailUrl)) {
            thumbnailUrl = remoteUrl;
          }
        }
      } else if (thumbnailUrl && (isDataUriImage(thumbnailUrl) || isFileUri(thumbnailUrl))) {
        let contentType = guessContentTypeFromPath(thumbnailUrl);
        let base64: string | null = null;

        if (isDataUriImage(thumbnailUrl)) {
          const extracted = extractBase64Payload(thumbnailUrl);
          base64 = extracted?.base64 ?? null;
          contentType = extracted?.contentType ?? contentType;
        } else if (isFileUri(thumbnailUrl)) {
          base64 = await readImageFileBase64(thumbnailUrl);
        }

        if (base64) {
          if (__DEV__) {
            console.log('[supabaseDreamService] uploading thumbnail as webp', {
              contentType,
              base64Length: base64.length,
            });
          }
          const webp = await convertToWebpBase64(
            { base64, uri: isFileUri(thumbnailUrl) ? thumbnailUrl : undefined, contentType },
            { squareSize: THUMBNAIL_SQUARE_SIZE, compress: THUMBNAIL_COMPRESS }
          );
          const remoteUrl = await uploadImageToBucket(
            webp.base64,
            webp.contentType,
            ownerId,
            previousRemoteThumbnailUrl ?? undefined,
            dream.remoteId,
            'thumbnail'
          );
          thumbnailUrl = remoteUrl;
          if (!imageUrl || !isStoredDreamImageValue(imageUrl)) {
            imageUrl = remoteUrl;
          }
        }
      }

      if (previousRemoteImageUrl && imageUrl && previousRemoteImageUrl !== imageUrl) {
        await deleteFromBucketIfPossible(previousRemoteImageUrl, ownerId);
      }
      if (previousRemoteThumbnailUrl && thumbnailUrl && previousRemoteThumbnailUrl !== thumbnailUrl) {
        await deleteFromBucketIfPossible(previousRemoteThumbnailUrl, ownerId);
      }

      return {
        ...dream,
        imageUrl,
        thumbnailUrl,
      };
    } catch (error) {
      if (__DEV__) {
        console.warn('Failed to upload inline image to storage, stripping image to avoid broken sync', error);
      }
      return handleFailure();
    }
  }

  return { ensureRemoteImage };
}
