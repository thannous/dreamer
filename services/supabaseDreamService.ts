import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { ChatMessage, DreamAnalysis, DreamType, DreamTheme } from '@/lib/types';

const DREAMS_TABLE = 'dreams';
let imageGenerationFailedColumnAvailable = true;

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
  const insert = (includeImageColumn: boolean) =>
    supabase
      .from(DREAMS_TABLE)
      .insert(mapDreamToRow(dream, userId, includeImageColumn))
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

  const update = (includeImageColumn: boolean) =>
    supabase
      .from(DREAMS_TABLE)
      .update(mapDreamToRow(dream, undefined, includeImageColumn))
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
