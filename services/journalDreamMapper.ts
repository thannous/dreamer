import type { ChatMessage, DreamAnalysis, DreamMemoryMetadata, DreamMutation, DreamTheme, DreamType } from '@/lib/types';
import type { DreamListItem } from '@/lib/journalReadContracts';
import type { SyncMutationResult, SyncMutationResultStatus } from '@/lib/journalSyncContracts';
import { normalizeDreamMemoryMetadata } from '@/lib/dreamUtils';
import { ANALYSIS_TRANSCRIPT_HASH_KEY, isAnalysisTranscriptHash } from '@/lib/dreamAnalysisFreshness';
import { toStoredImageReference } from '@/lib/journalImageReference';

export type SupabaseDreamRow = {
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
  memory?: DreamMemoryMetadata | Record<string, unknown> | null;
  analysis_details?: Record<string, unknown> | null;
};

type AnalysisDetailFields = Pick<DreamAnalysis, 'symbols' | 'emotions' | 'reflectionQuestions' | 'promptVersion'>;

type KnownAnalysisDetailFields = AnalysisDetailFields & Pick<DreamAnalysis, 'analysisTranscriptHash'>;

const ANALYSIS_DETAILS_ALLOWLIST = [
  'symbols',
  'emotions',
  'reflectionQuestions',
  'promptVersion',
  ANALYSIS_TRANSCRIPT_HASH_KEY,
] as const satisfies readonly (keyof KnownAnalysisDetailFields)[];

const asAnalysisDetailsRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};

const pickAllowlistedAnalysisDetails = (source: Record<string, unknown>): Record<string, unknown> => {
  const next: Record<string, unknown> = {};
  for (const key of ANALYSIS_DETAILS_ALLOWLIST) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    next[key] = source[key];
  }
  return next;
};

const sanitizeKnownAnalysisDetails = (source: Record<string, unknown>): KnownAnalysisDetailFields => {
  const symbols = Array.isArray(source.symbols)
    ? source.symbols.filter(
        (entry: any) => entry && typeof entry.name === 'string' && typeof entry.meaning === 'string'
      )
    : [];
  const emotions = Array.isArray(source.emotions)
    ? source.emotions.filter(
        (entry: any) => entry && typeof entry.name === 'string' && typeof entry.insight === 'string'
      )
    : [];
  const reflectionQuestions = Array.isArray(source.reflectionQuestions)
    ? source.reflectionQuestions.filter((question: unknown): question is string => typeof question === 'string')
    : [];
  const promptVersion =
    typeof source.promptVersion === 'string' && source.promptVersion.length > 0 && source.promptVersion.length <= 64
      ? source.promptVersion
      : undefined;
  const analysisTranscriptHash = isAnalysisTranscriptHash(source[ANALYSIS_TRANSCRIPT_HASH_KEY])
    ? source[ANALYSIS_TRANSCRIPT_HASH_KEY]
    : undefined;

  return {
    ...(symbols.length > 0 ? { symbols } : {}),
    ...(emotions.length > 0 ? { emotions } : {}),
    ...(reflectionQuestions.length > 0 ? { reflectionQuestions } : {}),
    ...(promptVersion ? { promptVersion } : {}),
    ...(analysisTranscriptHash ? { analysisTranscriptHash } : {}),
  };
};

const toAnalysisDetailsColumn = (dream: DreamAnalysis): Record<string, unknown> | null => {
  const merged = {
    ...pickAllowlistedAnalysisDetails(asAnalysisDetailsRecord(dream.analysisDetails)),
    ...(dream.symbols !== undefined ? { symbols: dream.symbols } : {}),
    ...(dream.emotions !== undefined ? { emotions: dream.emotions } : {}),
    ...(dream.reflectionQuestions !== undefined ? { reflectionQuestions: dream.reflectionQuestions } : {}),
    ...(dream.promptVersion !== undefined ? { promptVersion: dream.promptVersion } : {}),
    ...(dream.analysisTranscriptHash !== undefined
      ? { [ANALYSIS_TRANSCRIPT_HASH_KEY]: dream.analysisTranscriptHash }
      : {}),
  };
  const known = sanitizeKnownAnalysisDetails(merged);
  return Object.keys(known).length > 0 ? { ...known } : null;
};

export const mapRowToDream = (row: SupabaseDreamRow, now: () => number = Date.now): DreamAnalysis => {
  const createdAt = row.created_at ? Date.parse(row.created_at) : now();
  const imageUrl = row.image_url ?? '';
  const hasImage = Boolean(imageUrl);
  const imageGenerationFailed = hasImage ? false : row.image_generation_failed ?? false;
  const analysisDetails = asAnalysisDetailsRecord(row.analysis_details);
  const knownAnalysisDetails = sanitizeKnownAnalysisDetails(analysisDetails);
  const allowlistedAnalysisDetails = {
    ...pickAllowlistedAnalysisDetails(analysisDetails),
    ...knownAnalysisDetails,
  };
  const persistedAnalysisDetails = sanitizeKnownAnalysisDetails(allowlistedAnalysisDetails);
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
    memory: normalizeDreamMemoryMetadata(row.memory),
    ...(Object.keys(persistedAnalysisDetails).length > 0 ? { analysisDetails: persistedAnalysisDetails } : {}),
    ...knownAnalysisDetails,
  };
};

export const mapDreamToRow = (
  dream: DreamAnalysis,
  userId?: string,
  includeImageColumns = true,
  includeClientUpdatedAtColumn = true,
  includeMemoryColumn = true,
  now: () => number = Date.now
) => {
  const memory = normalizeDreamMemoryMetadata(dream.memory);
  const base = {
    user_id: userId,
    transcript: dream.transcript,
    title: dream.title,
    interpretation: dream.interpretation,
    shareable_quote: dream.shareableQuote,
    image_url: toStoredImageReference(dream.imageUrl) || null,
    chat_history: dream.chatHistory ?? [],
    theme: dream.theme ?? null,
    dream_type: dream.dreamType,
    is_favorite: dream.isFavorite ?? false,
    is_analyzed: dream.isAnalyzed ?? false,
    analysis_status: dream.analysisStatus ?? 'none',
    ...(includeClientUpdatedAtColumn
      ? { client_updated_at: new Date(dream.clientUpdatedAt ?? now()).toISOString() }
      : {}),
    ...(includeMemoryColumn ? { memory: memory ?? {} } : {}),
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
    // Omit when locally absent so updates preserve any server-side details.
    ...(toAnalysisDetailsColumn(dream) ? { analysis_details: toAnalysisDetailsColumn(dream) } : {}),
  };

  if (!includeImageColumns) return { ...base, ...quotaFields };

  return {
    ...base,
    ...quotaFields,
    image_generation_failed: dream.imageGenerationFailed ?? false,
  };
};

export const mapDreamToSyncPayload = (dream: DreamAnalysis, userId?: string, includeImageColumns = true, includeMemoryColumn = true, now: () => number = Date.now) => ({
  ...mapDreamToRow(dream, userId, includeImageColumns, true, includeMemoryColumn, now),
  remote_id: dream.remoteId ?? null,
  revision_id: dream.revisionId ?? null,
});

export const parseSyncResult = (data: unknown, now: () => number = Date.now): SyncMutationResult[] => {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((entry) => {
    const row = entry as Record<string, unknown>;
    const dreamPayload = row.dream as SupabaseDreamRow | undefined;
    const dream = dreamPayload ? mapRowToDream(dreamPayload, now) : undefined;
    return {
      mutationId: String(row.mutation_id ?? ''),
      clientRequestId: String(row.client_request_id ?? ''),
      operation: (row.operation as DreamMutation['operation']) ?? 'update',
      status: (row.status as SyncMutationResultStatus) ?? 'failed',
      dream,
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

export const mapRowToDreamListItem = (row: SupabaseDreamRow, now: () => number = Date.now): DreamListItem => {
  const imageUrl = row.image_url ?? '';
  return {
    id: row.created_at ? Date.parse(row.created_at) : now(),
    remoteId: row.id,
    clientRequestId: row.client_request_id ?? undefined,
    revisionId: row.revision_id ?? undefined,
    updatedAt: row.updated_at ? Date.parse(row.updated_at) : undefined,
    transcript: row.transcript ?? '',
    title: row.title ?? '',
    shareableQuote: row.shareable_quote ?? '',
    explorationStartedAt: row.exploration_started_at ? Date.parse(row.exploration_started_at) : undefined,
    imageUrl,
    thumbnailUrl: imageUrl ? imageUrl : undefined,
    dreamType: (row.dream_type ?? 'Symbolic Dream') as DreamType,
    theme: row.theme ?? undefined,
    isFavorite: row.is_favorite ?? false,
    memory: normalizeDreamMemoryMetadata(row.memory),
    isAnalyzed: row.is_analyzed ?? undefined,
    analyzedAt: row.analyzed_at ? Date.parse(row.analyzed_at) : undefined,
    analysisStatus: row.analysis_status ?? undefined,
    analysisRequestId: row.analysis_request_id ?? undefined,
    imageGenerationFailed: imageUrl ? false : row.image_generation_failed ?? false,
  };
};
