import type { PostgrestError } from '@supabase/supabase-js';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system';
import type { ChatMessage, DreamAnalysis, DreamType, DreamTheme } from '@/lib/types';

const DREAMS_TABLE = 'dreams';
let imageGenerationFailedColumnAvailable = true;
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

const buildStoragePath = (userId: string, extension: string) =>
  `${userId}/dream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

const uploadImageToBucket = async (
  base64: string,
  contentType: string,
  userId: string
): Promise<string> => {
  const extension = (contentType.split('/')[1] ?? 'jpg').split('+')[0];
  const path = buildStoragePath(userId, extension);
  const data = decodeBase64ToUint8Array(base64);

  const { data: uploadData, error } = await supabase
    .storage
    .from(DREAM_IMAGE_BUCKET)
    .upload(path, data.buffer, {
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
        base64 = await FileSystem.readAsStringAsync(imageUrl, { encoding: FileSystem.EncodingType.Base64 });
        contentType = guessContentTypeFromPath(imageUrl);
      }

      if (base64) {
        const remoteUrl = await uploadImageToBucket(base64, contentType, ownerId);
        imageUrl = remoteUrl;
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
        base64 = await FileSystem.readAsStringAsync(thumbnailUrl, { encoding: FileSystem.EncodingType.Base64 });
      }

      if (base64) {
        const remoteUrl = await uploadImageToBucket(base64, contentType, ownerId);
        thumbnailUrl = remoteUrl;
        if (!imageUrl || !isRemoteImageUrl(imageUrl)) {
          imageUrl = remoteUrl;
        }
      }
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
  image_source?: 'user' | 'ai' | null;
  is_analyzed?: boolean | null;
  analyzed_at?: string | null;
  analysis_status?: 'none' | 'pending' | 'done' | 'failed' | null;
  analysis_request_id?: string | null;
  exploration_started_at?: string | null;
};

const mapRowToDream = (row: SupabaseDreamRow): DreamAnalysis => {
  const createdAt = row.created_at ? Date.parse(row.created_at) : Date.now();
  const imageUrl = row.image_url ?? '';
  const hasImage = Boolean(imageUrl);
  const imageGenerationFailed = hasImage ? false : row.image_generation_failed ?? false;
  const imageSource = row.image_source ?? null;
  return {
    id: createdAt,
    remoteId: row.id,
    transcript: row.transcript ?? '',
    title: row.title ?? '',
    interpretation: row.interpretation ?? '',
    shareableQuote: row.shareable_quote ?? '',
    imageUrl,
    thumbnailUrl: hasImage ? imageUrl : undefined,
    imageSource: imageSource ?? undefined,
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
    analyzed_at: dream.analyzedAt ? new Date(dream.analyzedAt).toISOString() : null,
    analysis_status: dream.analysisStatus ?? 'none',
    analysis_request_id: dream.analysisRequestId ?? null,
    exploration_started_at: dream.explorationStartedAt ? new Date(dream.explorationStartedAt).toISOString() : null,
  };

  if (!includeImageColumns) return base;

  return {
    ...base,
    image_generation_failed: dream.imageGenerationFailed ?? false,
    image_source: dream.imageSource ?? null,
  };
};

const formatError = (error: PostgrestError | null, defaultMessage: string): Error => {
  if (!error) return new Error(defaultMessage);
  return new Error(error.message || defaultMessage);
};

const isMissingImageGenerationColumnError = (error: PostgrestError | null): boolean => {
  if (!error) return false;
  if (error.code !== 'PGRST204') return false;
  return /image_generation_failed|image_source/.test(error.message ?? '');
};

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
  const preparedDream = await ensureRemoteImage(dream, userId);

  const insert = (includeImageColumn: boolean) =>
    supabase
      .from(DREAMS_TABLE)
      .insert(mapDreamToRow(preparedDream, userId, includeImageColumn))
      .select('*')
      .single();

  const tryImageColumn = imageGenerationFailedColumnAvailable;
  let { data, error } = await insert(tryImageColumn);

  if ((error || !data) && tryImageColumn && isMissingImageGenerationColumnError(error)) {
    imageGenerationFailedColumnAvailable = false;
    ({ data, error } = await insert(false));
  }

  if (error || !data) {
    throw formatError(error, 'Failed to create dream in Supabase');
  }

  return mapRowToDream(data);
}

export async function updateDreamInSupabase(dream: DreamAnalysis): Promise<DreamAnalysis> {
  if (!dream.remoteId) {
    throw new Error('Missing remote id for Supabase dream update');
  }

  const preparedDream = await ensureRemoteImage(dream);

  const update = (includeImageColumn: boolean) =>
    supabase
      .from(DREAMS_TABLE)
      .update(mapDreamToRow(preparedDream, undefined, includeImageColumn))
      .eq('id', dream.remoteId)
      .select('*')
      .single();

  const tryImageColumn = imageGenerationFailedColumnAvailable;
  let { data, error } = await update(tryImageColumn);

  if ((error || !data) && tryImageColumn && isMissingImageGenerationColumnError(error)) {
    imageGenerationFailedColumnAvailable = false;
    ({ data, error } = await update(false));
  }

  if (error || !data) {
    throw formatError(error, 'Failed to update dream in Supabase');
  }

  return mapRowToDream(data);
}

export async function deleteDreamFromSupabase(remoteId: number): Promise<void> {
  const { error } = await supabase.from(DREAMS_TABLE).delete().eq('id', remoteId);
  if (error) {
    throw formatError(error, 'Failed to delete dream from Supabase');
  }
}
