import type { PostgrestError } from '@supabase/supabase-js';

import { buildDreamMutationEntityKey, createDreamMutation, generateUUID } from '@/lib/dreamUtils';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import type { Action as ImageManipulatorAction } from 'expo-image-manipulator';
import { Image, Platform } from 'react-native';
import type {
  ChatMessage,
  DreamAnalysis,
  DreamMutation,
  DreamType,
  DreamTheme,
} from '@/lib/types';

const DREAMS_TABLE = 'dreams';
const DREAM_IMAGE_BUCKET = 'dream-images';

const isRemoteImageUrl = (url?: string | null): boolean =>
  Boolean(url && /^https?:\/\//.test(url));

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

const writeBase64TempFile = async (base64: string, extension: string = 'png'): Promise<string> => {
  if (!base64) throw new Error('Missing base64 payload');
  const dir = FileSystemLegacy.cacheDirectory ?? FileSystemLegacy.documentDirectory ?? '/tmp/';
  const uri = `${dir}dream-upload.${extension}`;
  // Use legacy API to avoid deprecation errors on Hermes while remaining compatible.
  await FileSystemLegacy.writeAsStringAsync(uri, base64, { encoding: 'base64' });
  return uri;
};

const getImageDimensions = async (uri: string): Promise<{ width: number; height: number } | null> => {
  if (typeof Image?.getSize !== 'function') {
    return null;
  }

  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve(null)
    );
  });
};

type WebpOptions = {
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

type ImageManipulatorModule = typeof import('expo-image-manipulator');

let imageManipulatorModule: ImageManipulatorModule | null = null;

const shouldUseJestRequire = (): boolean =>
  typeof process !== 'undefined' && typeof process.env?.JEST_WORKER_ID === 'string';

const getImageManipulator = async (): Promise<ImageManipulatorModule | null> => {
  if (imageManipulatorModule !== null) {
    return imageManipulatorModule;
  }
  try {
    const mod = shouldUseJestRequire()
      ? (require('expo-image-manipulator') as ImageManipulatorModule)
      : await import('expo-image-manipulator');
    imageManipulatorModule = mod;
    return mod;
  } catch (err) {
    if (__DEV__) {
      console.warn('expo-image-manipulator unavailable; skipping client-side image optimization', err);
    }
    imageManipulatorModule = null;
    return null;
  }
};

const convertToWebpBase64 = async (
  params: { base64?: string; uri?: string; contentType?: string },
  options: WebpOptions = {}
): Promise<{ base64: string; contentType: string }> => {
  const { base64, uri, contentType } = params;
  const { compress = 0.65, maxDimension, squareSize } = options;
  let sourceUri = uri;
  let cleanupUri: string | null = null;

  if (__DEV__) {
    console.log('[supabaseDreamService] convertToWebpBase64 start', {
      hasBase64: Boolean(base64),
      hasUri: Boolean(uri),
      contentType,
    });
  }

  if (!sourceUri && base64) {
    if (Platform.OS === 'web') {
      const ct = contentType ?? 'image/png';
      sourceUri = `data:${ct};base64,${base64}`;
    } else {
      const ext = contentType?.split('/')[1] ?? 'png';
      sourceUri = await writeBase64TempFile(base64, ext);
      cleanupUri = sourceUri;
    }
  }

  if (!sourceUri) {
    return { base64: base64 ?? '', contentType: contentType ?? 'image/webp' };
  }

  try {
    const manipulator = await getImageManipulator();
    if (!manipulator) {
      return { base64: base64 ?? '', contentType: contentType ?? 'image/webp' };
    }

    const actions: ImageManipulatorAction[] = [];
    if (squareSize) {
      actions.push({ resize: { width: squareSize, height: squareSize } });
    } else if (maxDimension) {
      // Heuristic: only resize when payload is likely large to avoid upscaling tiny images.
      const shouldResize = !base64 || base64.length > 400_000;
      if (shouldResize) {
        const dimensions = await getImageDimensions(sourceUri);
        const longestSide = dimensions ? Math.max(dimensions.width, dimensions.height) : null;
        if (dimensions && longestSide && longestSide > maxDimension) {
          if (dimensions.width >= dimensions.height) {
            actions.push({ resize: { width: maxDimension } });
          } else {
            actions.push({ resize: { height: maxDimension } });
          }
        }
      }
    }

    const result = await manipulator.manipulateAsync(
      sourceUri,
      actions,
      {
        compress,
        format: manipulator.SaveFormat.WEBP,
        base64: true,
      }
    );

    const webp = result.base64 ?? base64 ?? '';
    if (__DEV__) {
      console.log('[supabaseDreamService] convertToWebpBase64 success', {
        width: result.width,
        height: result.height,
        base64Length: webp.length,
      });
    }
    return { base64: webp, contentType: 'image/webp' };
  } catch (err) {
    console.warn('convertToWebpBase64 failed, returning original payload', err);
    return { base64: base64 ?? '', contentType: contentType ?? 'image/webp' };
  } finally {
    if (cleanupUri) {
      FileSystemLegacy.deleteAsync(cleanupUri, { idempotent: true }).catch(() => {});
    }
  }
};

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

const extractStoragePathFromUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean); // storage v1 object public dream-images ...
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

const deleteFromBucketIfPossible = async (url?: string | null, ownerId?: string) => {
  if (!url || !isRemoteImageUrl(url)) return;
  const path = extractStoragePathFromUrl(url);
  if (!path) return;
  if (ownerId && !path.startsWith(`${ownerId}/`)) return;
  try {
    await supabase.storage.from(DREAM_IMAGE_BUCKET).remove([path]);
    if (__DEV__) console.log('[supabaseDreamService] deleted old image', path);
  } catch (err) {
    console.warn('[supabaseDreamService] failed to delete old image', path, err);
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

  const { data: uploadData, error } = await supabase
    .storage
    .from(DREAM_IMAGE_BUCKET)
    .upload(path, data, {
      contentType,
      upsert: true,
    });

  if (error || !uploadData) {
    throw new Error(error?.message ?? 'Failed to upload image');
  }

  const { data: publicUrlData } = supabase.storage.from(DREAM_IMAGE_BUCKET).getPublicUrl(uploadData.path);
  if (!publicUrlData?.publicUrl) {
    throw new Error('Failed to resolve public image URL');
  }

  return publicUrlData.publicUrl;
};

async function ensureRemoteImage(dream: DreamAnalysis, userId?: string): Promise<DreamAnalysis> {
  if (!isSupabaseConfigured) return dream;

  const ownerId = userId ?? (await supabase.auth.getUser()).data.user?.id;
  if (!ownerId) return dream;

  let imageUrl = dream.imageUrl;
  let thumbnailUrl = dream.thumbnailUrl;
  const previousRemoteImageUrl = isRemoteImageUrl(dream.imageUrl) ? dream.imageUrl : null;
  const previousRemoteThumbnailUrl = isRemoteImageUrl(dream.thumbnailUrl) ? dream.thumbnailUrl : null;

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
        const file = new FileSystem.File(imageUrl);
        base64 = await file.base64();
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
        if (!thumbnailUrl || !isRemoteImageUrl(thumbnailUrl)) {
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
        const file = new FileSystem.File(thumbnailUrl);
        base64 = await file.base64();
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
        if (!imageUrl || !isRemoteImageUrl(imageUrl)) {
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

type SupabaseDreamRow = {
  id: number;
  created_at: string | null;
  updated_at?: string | null;
  client_updated_at?: string | null;
  revision_id?: string | null;
  user_id?: string;
  transcript: string;
  title: string;
  interpretation: string;
  shareable_quote: string;
  image_url: string | null;
  chat_history: ChatMessage[] | null;
  theme: DreamTheme | null;
  dream_type: string;
  is_favorite: boolean | null;
  image_generation_failed?: boolean | null;
  is_analyzed?: boolean | null;
  analyzed_at?: string | null;
  analysis_status?: 'none' | 'pending' | 'done' | 'failed' | null;
  analysis_request_id?: string | null;
  exploration_started_at?: string | null;
  client_request_id?: string | null;
  has_person?: boolean | null;
  has_animal?: boolean | null;
};

const mapRowToDream = (row: SupabaseDreamRow): DreamAnalysis => {
  const createdAt = row.created_at ? Date.parse(row.created_at) : Date.now();
  const imageUrl = row.image_url ?? '';
  const hasImage = Boolean(imageUrl);
  const imageGenerationFailed = hasImage ? false : row.image_generation_failed ?? false;
  return {
    id: createdAt,
    remoteId: row.id,
    revisionId: row.revision_id ?? undefined,
    updatedAt: row.updated_at ? Date.parse(row.updated_at) : undefined,
    clientUpdatedAt: row.client_updated_at ? Date.parse(row.client_updated_at) : createdAt,
    transcript: row.transcript ?? '',
    title: row.title ?? '',
    interpretation: row.interpretation ?? '',
    shareableQuote: row.shareable_quote ?? '',
    imageUrl,
    thumbnailUrl: hasImage ? imageUrl : undefined,
    chatHistory: Array.isArray(row.chat_history) ? row.chat_history : [],
    theme: row.theme ?? undefined,
    dreamType: (row.dream_type ?? 'Symbolic Dream') as DreamType,
    isFavorite: row.is_favorite ?? false,
    imageGenerationFailed,
    isAnalyzed: row.is_analyzed ?? undefined,
    analyzedAt: row.analyzed_at ? Date.parse(row.analyzed_at) : undefined,
    analysisStatus: row.analysis_status ?? undefined,
    analysisRequestId: row.analysis_request_id ?? undefined,
    explorationStartedAt: row.exploration_started_at ? Date.parse(row.exploration_started_at) : undefined,
    clientRequestId: row.client_request_id ?? undefined,
    // Map subject detection: null from DB -> undefined (not checked), true/false preserved
    hasPerson: row.has_person === null ? undefined : row.has_person,
    hasAnimal: row.has_animal === null ? undefined : row.has_animal,
  };
};

const mapDreamToRow = (dream: DreamAnalysis, userId?: string, includeImageColumns = true) => {
  const base = {
    user_id: userId,
    transcript: dream.transcript,
    title: dream.title,
    interpretation: dream.interpretation,
    shareable_quote: dream.shareableQuote,
    image_url: dream.imageUrl || null,
    chat_history: dream.chatHistory ?? [],
    theme: dream.theme ?? null,
    dream_type: dream.dreamType,
    is_favorite: dream.isFavorite ?? false,
    is_analyzed: dream.isAnalyzed ?? false,
    analysis_status: dream.analysisStatus ?? 'none',
    client_updated_at: new Date(dream.clientUpdatedAt ?? Date.now()).toISOString(),
  };

  // Avoid clearing existing server-side values when a field is missing locally.
  // For monotonic fields (timestamps/idempotency keys), omit when undefined.
  const quotaFields = {
    ...(dream.analyzedAt != null ? { analyzed_at: new Date(dream.analyzedAt).toISOString() } : {}),
    ...(dream.analysisRequestId != null ? { analysis_request_id: dream.analysisRequestId } : {}),
    ...(dream.explorationStartedAt != null
      ? { exploration_started_at: new Date(dream.explorationStartedAt).toISOString() }
      : {}),
    ...(dream.clientRequestId != null ? { client_request_id: dream.clientRequestId } : {}),
    // Only include subject detection when explicitly set (undefined = not checked, omit to preserve DB)
    ...(dream.hasPerson !== undefined ? { has_person: dream.hasPerson } : {}),
    ...(dream.hasAnimal !== undefined ? { has_animal: dream.hasAnimal } : {}),
  };

  if (!includeImageColumns) return { ...base, ...quotaFields };

  return {
    ...base,
    ...quotaFields,
    image_generation_failed: dream.imageGenerationFailed ?? false,
  };
};

const formatError = (error: PostgrestError | null, defaultMessage: string): CodedError => {
  const message = error?.message?.trim() ? error.message : defaultMessage;
  const err = new Error(message) as CodedError;
  if (error?.code) {
    err.code = error.code;
  }
  return err;
};

type CodedError = Error & { code?: string };
type ConflictError = CodedError & { remoteDream?: DreamAnalysis };

export type SyncMutationResultStatus = 'ack' | 'conflict' | 'failed';

export type SyncMutationResult = {
  mutationId: string;
  clientRequestId: string;
  operation: DreamMutation['operation'];
  status: SyncMutationResultStatus;
  dream?: DreamAnalysis;
  remoteId?: number;
  error?: string;
};

const createNotFoundError = (message: string): CodedError => {
  const error = new Error(message) as CodedError;
  error.code = 'NOT_FOUND';
  return error;
};

const createConflictError = (message: string, remoteDream?: DreamAnalysis): ConflictError => {
  const error = new Error(message) as ConflictError;
  error.code = 'CONFLICT';
  error.remoteDream = remoteDream;
  return error;
};

let imageGenerationFailedColumnAvailable = true;

const isMissingImageGenerationColumnError = (error: PostgrestError | null): boolean => {
  if (!error) return false;
  if (error.code !== 'PGRST204') return false;
  return /image_generation_failed|image_source/.test(error.message ?? '');
};

const isSingleObjectResultError = (error: PostgrestError | null): boolean => {
  if (!error) return false;
  const message = (error.message ?? '').toLowerCase();
  return (
    error.code === 'PGRST116' ||
    error.code === 'PGRST301' ||
    message.includes('single json object') ||
    message.includes('0 rows') ||
    message.includes('no rows')
  );
};

const mapDreamToSyncPayload = (dream: DreamAnalysis, userId?: string, includeImageColumns = true) => ({
  ...mapDreamToRow(dream, userId, includeImageColumns),
  remote_id: dream.remoteId ?? null,
  revision_id: dream.revisionId ?? null,
});

const mapMutationToSyncPayload = async (
  mutation: DreamMutation,
  userId?: string
): Promise<Record<string, unknown>> => {
  const shouldPrepareDream =
    mutation.operation === 'create' || mutation.operation === 'update';
  const preparedDream =
    shouldPrepareDream && mutation.payload.dream
      ? await ensureRemoteImage(mutation.payload.dream, userId)
      : mutation.payload.dream;

  return {
    mutation_id: mutation.id,
    operation: mutation.operation,
    client_request_id: mutation.clientRequestId,
    entity_key: mutation.entityKey,
    base_revision: mutation.baseRevision ?? null,
    client_updated_at: new Date(mutation.clientUpdatedAt || Date.now()).toISOString(),
    payload:
      mutation.operation === 'delete'
        ? {
            remote_id: mutation.payload.remoteId ?? mutation.payload.tombstone?.remoteId ?? null,
            dream_id: mutation.payload.dreamId ?? mutation.payload.tombstone?.id ?? null,
          }
        : mapDreamToSyncPayload(preparedDream ?? mutation.payload.dream!, userId, true),
  };
};

const parseSyncResult = (data: unknown): SyncMutationResult[] => {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((entry) => {
    const row = entry as Record<string, unknown>;
    const dreamPayload = row.dream as SupabaseDreamRow | undefined;
    return {
      mutationId: String(row.mutation_id ?? ''),
      clientRequestId: String(row.client_request_id ?? ''),
      operation: (row.operation as DreamMutation['operation']) ?? 'update',
      status: (row.status as SyncMutationResultStatus) ?? 'failed',
      dream: dreamPayload ? mapRowToDream(dreamPayload) : undefined,
      remoteId:
        typeof row.remote_id === 'number'
          ? row.remote_id
          : typeof row.remote_id === 'string'
            ? Number(row.remote_id)
            : undefined,
      error: typeof row.error === 'string' ? row.error : undefined,
    };
  });
};

const syncDreamMutationsDirectly = async (
  mutations: DreamMutation[],
  userId?: string
): Promise<SyncMutationResult[]> => {
  const results: SyncMutationResult[] = [];

  for (const mutation of mutations) {
    if (mutation.operation === 'create' && mutation.payload.dream) {
      const preparedDream = await ensureRemoteImage(mutation.payload.dream, userId);
      const upsert = (includeImageColumn: boolean) =>
        supabase
          .from(DREAMS_TABLE)
          .upsert(mapDreamToRow(preparedDream, userId, includeImageColumn), {
            onConflict: 'user_id,client_request_id',
          })
          .select('*')
          .single();

      const tryImageColumn = imageGenerationFailedColumnAvailable;
      let { data, error } = await upsert(tryImageColumn);

      if ((error || !data) && tryImageColumn && isMissingImageGenerationColumnError(error)) {
        imageGenerationFailedColumnAvailable = false;
        ({ data, error } = await upsert(false));
      }

      if (error || !data) {
        throw formatError(error, 'Failed to create dream in Supabase');
      }

      const dream = mapRowToDream(data);
      results.push({
        mutationId: mutation.id,
        clientRequestId: mutation.clientRequestId,
        operation: mutation.operation,
        status: 'ack',
        dream,
        remoteId: dream.remoteId,
      });
      continue;
    }

    if (mutation.operation === 'update' && mutation.payload.dream) {
      const dreamToUpdate = mutation.payload.dream;
      if (!dreamToUpdate.remoteId) {
        throw new Error('Missing remote id for Supabase dream update');
      }

      const preparedDream = await ensureRemoteImage(dreamToUpdate, userId);
      const update = (includeImageColumn: boolean) =>
        supabase
          .from(DREAMS_TABLE)
          .update(mapDreamToRow(preparedDream, undefined, includeImageColumn))
          .eq('id', dreamToUpdate.remoteId)
          .select('*')
          .single();

      const tryImageColumn = imageGenerationFailedColumnAvailable;
      let { data, error } = await update(tryImageColumn);

      if ((error || !data) && tryImageColumn && isMissingImageGenerationColumnError(error)) {
        imageGenerationFailedColumnAvailable = false;
        ({ data, error } = await update(false));
      }

      if (isSingleObjectResultError(error) || (!error && !data)) {
        throw createNotFoundError('Dream not found in Supabase');
      }

      if (error || !data) {
        throw formatError(error, 'Failed to update dream in Supabase');
      }

      const dream = mapRowToDream(data);
      results.push({
        mutationId: mutation.id,
        clientRequestId: mutation.clientRequestId,
        operation: mutation.operation,
        status: 'ack',
        dream,
        remoteId: dream.remoteId,
      });
      continue;
    }

    if (mutation.operation === 'delete') {
      const remoteId = mutation.payload.remoteId ?? mutation.payload.tombstone?.remoteId;
      if (remoteId == null) {
        throw new Error('Missing remote id for Supabase dream delete');
      }

      const { error } = await supabase.from(DREAMS_TABLE).delete().eq('id', remoteId);
      if (error) {
        throw formatError(error, 'Failed to delete dream from Supabase');
      }

      results.push({
        mutationId: mutation.id,
        clientRequestId: mutation.clientRequestId,
        operation: mutation.operation,
        status: 'ack',
        remoteId,
      });
      continue;
    }

    results.push({
      mutationId: mutation.id,
      clientRequestId: mutation.clientRequestId,
      operation: mutation.operation,
      status: 'failed',
      error: 'Malformed mutation payload',
    });
  }

  return results;
};

export async function syncDreamMutationsInSupabase(
  mutations: DreamMutation[],
  userId?: string
): Promise<SyncMutationResult[]> {
  if (typeof supabase.rpc !== 'function') {
    return syncDreamMutationsDirectly(mutations, userId);
  }

  const preparedMutations = await Promise.all(
    mutations.map((mutation) => mapMutationToSyncPayload(mutation, userId))
  );

  const { data, error } = await supabase.rpc('sync_dream_mutations', {
    mutations: preparedMutations,
  });

  if (error) {
    throw formatError(error, 'Failed to sync dream mutations');
  }

  return parseSyncResult(data);
}

export async function fetchDreamsFromSupabase(): Promise<DreamAnalysis[]> {
  const { data, error } = await supabase
    .from(DREAMS_TABLE)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw formatError(error, 'Failed to load dreams from Supabase');
  }

  return (data ?? []).map(mapRowToDream);
}

export async function createDreamInSupabase(dream: DreamAnalysis, userId: string): Promise<DreamAnalysis> {
  const withRequestId = dream.clientRequestId
    ? dream
    : { ...dream, clientRequestId: generateUUID() };
  const [result] = await syncDreamMutationsInSupabase([
    createDreamMutation({
      id: generateUUID(),
      userScope: `user:${userId}`,
      entityType: 'dream',
      entityKey: buildDreamMutationEntityKey(withRequestId),
      operation: 'create',
      clientRequestId: withRequestId.clientRequestId!,
      clientUpdatedAt: withRequestId.clientUpdatedAt ?? Date.now(),
      payload: { dream: withRequestId },
      status: 'pending',
      retryCount: 0,
      createdAt: Date.now(),
    }),
  ], userId);

  if (!result) {
    throw new Error('Failed to create dream in Supabase');
  }
  if (result.status === 'conflict') {
    throw createConflictError(result.error ?? 'Dream create conflict', result.dream);
  }
  if (result.status === 'failed' || !result.dream) {
    throw new Error(result.error ?? 'Failed to create dream in Supabase');
  }
  return result.dream;
}

export async function updateDreamInSupabase(dream: DreamAnalysis): Promise<DreamAnalysis> {
  if (!dream.remoteId) {
    throw new Error('Missing remote id for Supabase dream update');
  }
  const [result] = await syncDreamMutationsInSupabase([
    createDreamMutation({
      id: generateUUID(),
      userScope: 'user:active',
      entityType: 'dream',
      entityKey: buildDreamMutationEntityKey(dream),
      operation: 'update',
      clientRequestId: generateUUID(),
      baseRevision: dream.revisionId,
      clientUpdatedAt: dream.clientUpdatedAt ?? Date.now(),
      payload: { dream },
      status: 'pending',
      retryCount: 0,
      createdAt: Date.now(),
    }),
  ]);

  if (!result) {
    throw new Error('Failed to update dream in Supabase');
  }
  if (result.status === 'conflict') {
    throw createConflictError(result.error ?? 'Dream update conflict', result.dream);
  }
  if (result.status === 'failed') {
    if (result.error?.toLowerCase().includes('not found')) {
      throw createNotFoundError(result.error);
    }
    throw new Error(result.error ?? 'Failed to update dream in Supabase');
  }
  if (!result.dream) {
    throw new Error('Failed to update dream in Supabase');
  }
  return result.dream;
}

export async function deleteDreamFromSupabase(remoteId: number, baseRevision?: string): Promise<void> {
  const [result] = await syncDreamMutationsInSupabase([
    createDreamMutation({
      id: generateUUID(),
      userScope: 'user:active',
      entityType: 'dream',
      entityKey: `remote:${remoteId}`,
      operation: 'delete',
      clientRequestId: generateUUID(),
      baseRevision,
      clientUpdatedAt: Date.now(),
      payload: { remoteId },
      status: 'pending',
      retryCount: 0,
      createdAt: Date.now(),
    }),
  ]);

  if (!result) {
    throw new Error('Failed to delete dream from Supabase');
  }
  if (result.status === 'conflict') {
    throw createConflictError(result.error ?? 'Dream delete conflict', result.dream);
  }
  if (result.status === 'failed') {
    throw new Error(result.error ?? 'Failed to delete dream from Supabase');
  }
}
