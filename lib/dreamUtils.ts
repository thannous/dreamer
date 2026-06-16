/**
 * Pure utility functions for dream data manipulation
 * Extracted from useDreamJournal for reusability and testability
 */

import { getThumbnailUrl } from '@/lib/imageUtils';
import type {
  ChatMessage,
  DreamApproximatePeriod,
  DreamAnalysis,
  DreamMemoryMetadata,
  DreamMutation,
  DreamStrongestFragment,
  DreamSyncState,
  DreamType,
  RememberedDreamKind,
  SyncMutationStatus,
} from '@/lib/types';

/**
 * Sort dreams by ID (timestamp) in descending order (newest first)
 */
export const sortDreams = (list: DreamAnalysis[]): DreamAnalysis[] =>
  [...list].sort((a, b) => b.id - a.id);

/**
 * Generate a unique mutation ID for offline queue
 */
export const generateMutationId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Generate a simple UUID v4-like string for analysis request idempotence
 */
export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Check if an error is a Supabase "not found" error
 */
export const isNotFoundError = (error: unknown): error is { code: string } =>
  Boolean(
    error &&
      typeof error === 'object' &&
      'code' in (error as Record<string, unknown>) &&
      (error as Record<string, unknown>).code === 'NOT_FOUND'
  );

export const isConflictError = (
  error: unknown
): error is { code: string; message?: string; remoteDream?: DreamAnalysis } =>
  Boolean(
    error &&
      typeof error === 'object' &&
      'code' in (error as Record<string, unknown>) &&
      (error as Record<string, unknown>).code === 'CONFLICT'
  );

/**
 * Normalize dream images - derive thumbnail from imageUrl
 */
export const normalizeDreamImages = (dream: DreamAnalysis): DreamAnalysis => {
  const hasImage = Boolean(dream.imageUrl?.trim());
  // Perf: Skip redundant URL parsing if thumbnail already exists
  const derivedThumbnail = hasImage
    ? (dream.thumbnailUrl || getThumbnailUrl(dream.imageUrl))
    : undefined;

  const newImageGenerationFailed = hasImage ? false : dream.imageGenerationFailed;

  // Perf: Return same object if nothing changes
  // This preserves referential equality for React.memo and FlashList
  if (
    dream.thumbnailUrl === derivedThumbnail &&
    dream.imageGenerationFailed === newImageGenerationFailed
  ) {
    return dream;
  }

  return {
    ...dream,
    thumbnailUrl: derivedThumbnail,
    imageGenerationFailed: newImageGenerationFailed,
  };
};

const REMEMBERED_DREAM_KINDS = new Set<RememberedDreamKind>([
  'old',
  'recurring',
  'nightmare',
  'lucid',
  'meaningful',
  'person',
]);

const DREAM_APPROXIMATE_PERIODS = new Set<DreamApproximatePeriod>([
  'childhood',
  'teen_years',
  'years_ago',
  'months_ago',
  'recent',
  'unknown',
]);

const DREAM_STRONGEST_FRAGMENTS = new Set<DreamStrongestFragment>([
  'place',
  'person',
  'sensation',
  'image',
  'fear',
  'color',
  'other',
]);

const normalizeShortText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 160) : undefined;
};

/**
 * Sanitizes dream memory metadata loaded from storage or Supabase JSON.
 * Captured dreams with no useful memory data are normalized to undefined.
 */
export function normalizeDreamMemoryMetadata(
  value: DreamMemoryMetadata | Record<string, unknown> | null | undefined
): DreamMemoryMetadata | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const origin = value.origin === 'remembered' ? 'remembered' : undefined;
  const rememberedKind = REMEMBERED_DREAM_KINDS.has(value.rememberedKind as RememberedDreamKind)
    ? (value.rememberedKind as RememberedDreamKind)
    : undefined;
  const approximatePeriod = DREAM_APPROXIMATE_PERIODS.has(value.approximatePeriod as DreamApproximatePeriod)
    ? (value.approximatePeriod as DreamApproximatePeriod)
    : undefined;
  const strongestFragment = DREAM_STRONGEST_FRAGMENTS.has(value.strongestFragment as DreamStrongestFragment)
    ? (value.strongestFragment as DreamStrongestFragment)
    : undefined;

  const normalized: DreamMemoryMetadata = {
    version: 1,
    ...(origin ? { origin } : {}),
    ...(value.anchorDream === true ? { anchorDream: true } : {}),
    ...(value.dejaVu === true ? { dejaVu: true } : {}),
    ...(value.recurring === true || rememberedKind === 'recurring' ? { recurring: true } : {}),
    ...(rememberedKind ? { rememberedKind } : {}),
    ...(approximatePeriod ? { approximatePeriod } : {}),
    ...(strongestFragment ? { strongestFragment } : {}),
    ...(normalizeShortText(value.lingeringEmotion) ? { lingeringEmotion: normalizeShortText(value.lingeringEmotion) } : {}),
    ...(normalizeShortText(value.recurrenceNote) ? { recurrenceNote: normalizeShortText(value.recurrenceNote) } : {}),
    ...(value.createdFrom === 'onboarding' || value.createdFrom === 'journal' ? { createdFrom: value.createdFrom } : {}),
    ...(value.createdFromOnboarding === true ? { createdFromOnboarding: true } : {}),
  };

  const hasRememberedSignals =
    normalized.origin === 'remembered' ||
    normalized.anchorDream === true ||
    normalized.dejaVu === true ||
    normalized.recurring === true ||
    Boolean(normalized.rememberedKind || normalized.approximatePeriod || normalized.strongestFragment);

  return hasRememberedSignals ? normalized : undefined;
}

export function areDreamMemoryMetadataEqual(
  left: DreamMemoryMetadata | null | undefined,
  right: DreamMemoryMetadata | null | undefined
): boolean {
  const a = normalizeDreamMemoryMetadata(left);
  const b = normalizeDreamMemoryMetadata(right);
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    (a.version ?? 1) === (b.version ?? 1) &&
    (a.origin ?? null) === (b.origin ?? null) &&
    (a.anchorDream ?? false) === (b.anchorDream ?? false) &&
    (a.dejaVu ?? false) === (b.dejaVu ?? false) &&
    (a.recurring ?? false) === (b.recurring ?? false) &&
    (a.rememberedKind ?? null) === (b.rememberedKind ?? null) &&
    (a.approximatePeriod ?? null) === (b.approximatePeriod ?? null) &&
    (a.strongestFragment ?? null) === (b.strongestFragment ?? null) &&
    (a.lingeringEmotion ?? null) === (b.lingeringEmotion ?? null) &&
    (a.recurrenceNote ?? null) === (b.recurrenceNote ?? null) &&
    (a.createdFrom ?? null) === (b.createdFrom ?? null) &&
    (a.createdFromOnboarding ?? false) === (b.createdFromOnboarding ?? false)
  );
}

export const normalizeDreamMemory = (dream: DreamAnalysis): DreamAnalysis => {
  const memory = normalizeDreamMemoryMetadata(dream.memory);
  if (areDreamMemoryMetadataEqual(dream.memory, memory)) {
    return dream;
  }
  return {
    ...dream,
    memory,
  };
};

export const getDreamSyncState = (dream: DreamAnalysis): DreamSyncState => {
  if (dream.syncState) {
    return dream.syncState;
  }
  return dream.pendingSync ? 'pending' : 'clean';
};

export const setDreamSyncState = (
  dream: DreamAnalysis,
  syncState: DreamSyncState,
  extras: Partial<Pick<DreamAnalysis, 'lastSyncedAt' | 'lastSyncError' | 'conflictRemoteDream'>> = {}
): DreamAnalysis => ({
  ...dream,
  syncState,
  pendingSync: syncState === 'pending' ? true : undefined,
  lastSyncedAt: extras.lastSyncedAt ?? dream.lastSyncedAt,
  lastSyncError: extras.lastSyncError,
  conflictRemoteDream: extras.conflictRemoteDream,
});

const getMutationPayload = (
  mutation: DreamMutation | (Record<string, unknown> & {
    dream?: DreamAnalysis;
    dreamId?: number;
    remoteId?: number;
  })
) => {
  if ('payload' in mutation && mutation.payload && typeof mutation.payload === 'object') {
    return mutation.payload as DreamMutation['payload'];
  }

  return {
    dream: 'dream' in mutation ? (mutation.dream as DreamAnalysis | undefined) : undefined,
    dreamId: 'dreamId' in mutation && typeof mutation.dreamId === 'number' ? mutation.dreamId : undefined,
    remoteId: 'remoteId' in mutation && typeof mutation.remoteId === 'number' ? mutation.remoteId : undefined,
  };
};

const getMutationOperation = (mutation: DreamMutation | Record<string, unknown>): string =>
  ('operation' in mutation && typeof mutation.operation === 'string'
    ? mutation.operation
    : 'type' in mutation && typeof mutation.type === 'string'
      ? mutation.type
      : '');

export const getMutationDream = (mutation: DreamMutation): DreamAnalysis | undefined => {
  const payload = getMutationPayload(mutation);
  return payload.dream ?? payload.tombstone;
};

export const getMutationDreamId = (mutation: DreamMutation): number | undefined => {
  const payload = getMutationPayload(mutation);
  return payload.dream?.id ?? payload.tombstone?.id ?? payload.dreamId;
};

export const getMutationRemoteId = (mutation: DreamMutation): number | undefined => {
  const payload = getMutationPayload(mutation);
  return payload.dream?.remoteId ?? payload.tombstone?.remoteId ?? payload.remoteId;
};

const getMutationSortTime = (mutation: DreamMutation): number =>
  mutation.clientUpdatedAt || mutation.createdAt;

const isMutationActive = (mutation: DreamMutation): boolean =>
  !('status' in mutation) || mutation.status !== 'acked';

const dreamSyncStateFromMutationStatus = (
  status: SyncMutationStatus
): Extract<DreamSyncState, 'pending' | 'failed' | 'conflict'> => {
  switch (status) {
    case 'blocked':
      return 'conflict';
    case 'failed':
      return 'failed';
    default:
      return 'pending';
  }
};

type NormalizedChatMessage = {
  id: string;
  role: ChatMessage['role'];
  text: string;
  createdAt: number | null;
  category: string | null;
};

const normalizeChatMessage = (message: ChatMessage): NormalizedChatMessage => ({
  id: message.id,
  role: message.role,
  text: message.text,
  createdAt: message.createdAt ?? null,
  category: message.meta?.category ?? null,
});

const areChatHistoriesEqual = (a: ChatMessage[], b: ChatMessage[]): boolean => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    const left = normalizeChatMessage(a[index]);
    const right = normalizeChatMessage(b[index]);
    if (
      left.id !== right.id ||
      left.role !== right.role ||
      left.text !== right.text ||
      left.createdAt !== right.createdAt ||
      left.category !== right.category
    ) {
      return false;
    }
  }
  return true;
};

type DreamRemoteComparable = {
  transcript: string;
  title: string;
  interpretation: string;
  shareableQuote: string;
  imageUrl: string | null;
  chatHistory: ChatMessage[];
  theme: string | null;
  dreamType: string;
  isFavorite: boolean;
  imageGenerationFailed: boolean;
  hasPerson: boolean | null | undefined;
  hasAnimal: boolean | null | undefined;
  isAnalyzed: boolean;
  analyzedAt: number | null;
  analysisStatus: string;
  analysisRequestId: string | null;
  explorationStartedAt: number | null;
  clientRequestId: string | null;
  memory: DreamMemoryMetadata | undefined;
};

const toRemoteComparable = (dream: DreamAnalysis): DreamRemoteComparable => {
  const hasImage = Boolean(dream.imageUrl?.trim());
  return {
    transcript: dream.transcript ?? '',
    title: dream.title ?? '',
    interpretation: dream.interpretation ?? '',
    shareableQuote: dream.shareableQuote ?? '',
    imageUrl: dream.imageUrl?.trim() ? dream.imageUrl : null,
    chatHistory: Array.isArray(dream.chatHistory) ? dream.chatHistory : [],
    theme: dream.theme ?? null,
    dreamType: dream.dreamType ?? 'Symbolic Dream',
    isFavorite: dream.isFavorite ?? false,
    imageGenerationFailed: hasImage ? false : dream.imageGenerationFailed ?? false,
    hasPerson: dream.hasPerson,
    hasAnimal: dream.hasAnimal,
    isAnalyzed: dream.isAnalyzed ?? false,
    analyzedAt: dream.analyzedAt ?? null,
    analysisStatus: dream.analysisStatus ?? 'none',
    analysisRequestId: dream.analysisRequestId ?? null,
    explorationStartedAt: dream.explorationStartedAt ?? null,
    clientRequestId: dream.clientRequestId ?? null,
    memory: normalizeDreamMemoryMetadata(dream.memory),
  };
};

/**
 * Compares whether two dreams would produce the same Supabase row payload.
 * Useful to avoid sending unnecessary PATCH updates.
 */
export const areDreamsEqualForRemoteSync = (a: DreamAnalysis, b: DreamAnalysis): boolean => {
  if (a === b) return true;
  const left = toRemoteComparable(a);
  const right = toRemoteComparable(b);

  if (
    left.transcript !== right.transcript ||
    left.title !== right.title ||
    left.interpretation !== right.interpretation ||
    left.shareableQuote !== right.shareableQuote ||
    left.imageUrl !== right.imageUrl ||
    left.theme !== right.theme ||
    left.dreamType !== right.dreamType ||
    left.isFavorite !== right.isFavorite ||
    left.imageGenerationFailed !== right.imageGenerationFailed ||
    left.hasPerson !== right.hasPerson ||
    left.hasAnimal !== right.hasAnimal ||
    left.isAnalyzed !== right.isAnalyzed ||
    left.analyzedAt !== right.analyzedAt ||
    left.analysisStatus !== right.analysisStatus ||
    left.analysisRequestId !== right.analysisRequestId ||
    left.explorationStartedAt !== right.explorationStartedAt ||
    left.clientRequestId !== right.clientRequestId ||
    !areDreamMemoryMetadataEqual(left.memory, right.memory)
  ) {
    return false;
  }

  return areChatHistoriesEqual(left.chatHistory, right.chatHistory);
};

/**
 * Compares whether two dreams represent the same local app state after normalization.
 * If true, callers can safely skip both local persistence and remote sync.
 */
export const areDreamsEqualForLocalState = (a: DreamAnalysis, b: DreamAnalysis): boolean => {
  if (a === b) return true;
  const left = normalizeDreamImages(a);
  const right = normalizeDreamImages(b);

  if (left.id !== right.id) return false;
  if ((left.remoteId ?? null) !== (right.remoteId ?? null)) return false;
  if ((left.clientRequestId ?? null) !== (right.clientRequestId ?? null)) return false;
  if (left.transcript !== right.transcript) return false;
  if (left.title !== right.title) return false;
  if (left.interpretation !== right.interpretation) return false;
  if (left.shareableQuote !== right.shareableQuote) return false;
  if (left.imageUrl !== right.imageUrl) return false;
  if ((left.thumbnailUrl ?? null) !== (right.thumbnailUrl ?? null)) return false;
  if ((left.imageUpdatedAt ?? null) !== (right.imageUpdatedAt ?? null)) return false;
  if ((left.imageSource ?? null) !== (right.imageSource ?? null)) return false;
  if ((left.theme ?? null) !== (right.theme ?? null)) return false;
  if (left.dreamType !== right.dreamType) return false;
  if ((left.isFavorite ?? false) !== (right.isFavorite ?? false)) return false;
  if ((left.imageGenerationFailed ?? false) !== (right.imageGenerationFailed ?? false)) return false;
  if (left.hasPerson !== right.hasPerson) return false;
  if (left.hasAnimal !== right.hasAnimal) return false;
  if (getDreamSyncState(left) !== getDreamSyncState(right)) return false;
  if ((left.lastSyncedAt ?? null) !== (right.lastSyncedAt ?? null)) return false;
  if ((left.lastSyncError ?? null) !== (right.lastSyncError ?? null)) return false;
  if ((left.revisionId ?? null) !== (right.revisionId ?? null)) return false;
  if ((left.updatedAt ?? null) !== (right.updatedAt ?? null)) return false;
  if ((left.clientUpdatedAt ?? null) !== (right.clientUpdatedAt ?? null)) return false;
  if ((left.pendingSync ?? false) !== (right.pendingSync ?? false)) return false;
  if ((left.isAnalyzed ?? false) !== (right.isAnalyzed ?? false)) return false;
  if ((left.analyzedAt ?? null) !== (right.analyzedAt ?? null)) return false;
  if ((left.analysisStatus ?? 'none') !== (right.analysisStatus ?? 'none')) return false;
  if ((left.analysisRequestId ?? null) !== (right.analysisRequestId ?? null)) return false;
  if ((left.explorationStartedAt ?? null) !== (right.explorationStartedAt ?? null)) return false;
  if ((left.imageJobId ?? null) !== (right.imageJobId ?? null)) return false;
  if ((left.imageJobStatus ?? null) !== (right.imageJobStatus ?? null)) return false;
  if ((left.imageJobRequestId ?? null) !== (right.imageJobRequestId ?? null)) return false;
  if ((left.imageJobErrorCode ?? null) !== (right.imageJobErrorCode ?? null)) return false;
  if ((left.imageJobErrorMessage ?? null) !== (right.imageJobErrorMessage ?? null)) return false;
  if (!areDreamMemoryMetadataEqual(left.memory, right.memory)) return false;

  const leftChat = Array.isArray(left.chatHistory) ? left.chatHistory : [];
  const rightChat = Array.isArray(right.chatHistory) ? right.chatHistory : [];
  return areChatHistoriesEqual(leftChat, rightChat);
};

/**
 * Normalize a list of dreams
 */
export const normalizeDreamList = (list: DreamAnalysis[]): DreamAnalysis[] => {
  let hasChanges = false;
  const normalized = list.map((dream) => {
    const next = normalizeDreamMemory(normalizeDreamImages(dream));
    if (next !== dream) {
      hasChanges = true;
    }
    return next;
  });

  return hasChanges ? normalized : list;
};

/**
 * Upsert a dream into a list (insert or update by id/remoteId)
 */
export const upsertDream = (list: DreamAnalysis[], dream: DreamAnalysis): DreamAnalysis[] => {
  const index = list.findIndex(
    (d) => d.id === dream.id || (dream.remoteId && d.remoteId === dream.remoteId)
  );
  if (index === -1) {
    return [dream, ...list];
  }
  const next = [...list];
  next[index] = dream;
  return next;
};

/**
 * Remove a dream from a list by id and/or remoteId
 */
export const removeDream = (
  list: DreamAnalysis[],
  dreamId: number,
  remoteId?: number
): DreamAnalysis[] =>
  list.filter((d) => {
    const idMatches = d.id === dreamId;
    const remoteMatches = remoteId != null && d.remoteId === remoteId;
    return !idMatches && !remoteMatches;
  });

/**
 * Check if there are pending mutations for a specific dream
 */
export const hasPendingMutationsForDream = (
  mutations: DreamMutation[],
  dreamId: number
): boolean =>
  mutations.some((mutation) => isMutationActive(mutation) && getMutationDreamId(mutation) === dreamId);

/**
 * Apply pending mutations to a source list of dreams
 * Returns the result sorted by id descending
 */
export const applyPendingMutations = (
  source: DreamAnalysis[],
  mutations: DreamMutation[]
): DreamAnalysis[] => {
  if (!mutations.length) return sortDreams(source);
  let next = [...source];
  [...mutations]
    .filter(isMutationActive)
    .sort((a, b) => getMutationSortTime(a) - getMutationSortTime(b))
    .forEach((mutation) => {
      const dream = getMutationDream(mutation);
      switch (getMutationOperation(mutation)) {
        case 'create':
        case 'update':
          if (dream) {
            next = upsertDream(
              next,
              setDreamSyncState(dream, dreamSyncStateFromMutationStatus(mutation.status), {
                lastSyncError: mutation.lastError,
              })
            );
          }
          break;
        case 'delete':
          if (mutation.status === 'failed' || mutation.status === 'blocked') {
            if (dream) {
              next = upsertDream(
                next,
                setDreamSyncState(dream, dreamSyncStateFromMutationStatus(mutation.status), {
                  lastSyncError: mutation.lastError,
                })
              );
            }
            break;
          }
          const payload = getMutationPayload(mutation);
          next = removeDream(
            next,
            payload.dreamId ?? dream?.id ?? -1,
            payload.remoteId ?? dream?.remoteId
          );
          break;
        default:
          break;
      }
    });
  return sortDreams(next);
};

export const getDreamSyncError = (dream: DreamAnalysis): string | undefined =>
  dream.lastSyncError?.trim() || undefined;

export const clearDreamConflict = (dream: DreamAnalysis): DreamAnalysis =>
  setDreamSyncState(dream, 'clean', {
    lastSyncedAt: dream.lastSyncedAt,
    lastSyncError: undefined,
    conflictRemoteDream: undefined,
  });

export const buildDreamMutationEntityKey = (dream: DreamAnalysis): string => {
  if (dream.remoteId != null) {
    return `remote:${dream.remoteId}`;
  }
  if (dream.clientRequestId) {
    return `client:${dream.clientRequestId}`;
  }
  return `local:${dream.id}`;
};

export const createDreamMutation = (
  mutation: Omit<DreamMutation, 'version'>
): DreamMutation => ({
  version: 1,
  ...mutation,
});

export const migrateLegacyDreamMutation = (
  legacy: Record<string, unknown>,
  userScope: string
): DreamMutation | null => {
  if (
    typeof legacy !== 'object' ||
    legacy === null ||
    !('type' in legacy) ||
    !('id' in legacy) ||
    !('createdAt' in legacy)
  ) {
    return null;
  }

  const operation = legacy.type;
  if (operation !== 'create' && operation !== 'update' && operation !== 'delete') {
    return null;
  }

  const dream = 'dream' in legacy ? (legacy.dream as DreamAnalysis | undefined) : undefined;
  const dreamId = typeof legacy.dreamId === 'number' ? legacy.dreamId : dream?.id;
  const remoteId = typeof legacy.remoteId === 'number' ? legacy.remoteId : dream?.remoteId;
  const createdAt = typeof legacy.createdAt === 'number' ? legacy.createdAt : Date.now();
  const clientRequestId =
    typeof legacy.clientRequestId === 'string'
      ? legacy.clientRequestId
      : dream?.clientRequestId ?? generateUUID();

  return createDreamMutation({
    id: String(legacy.id),
    userScope,
    entityType: 'dream',
    entityKey: dream
      ? buildDreamMutationEntityKey(dream)
      : remoteId != null
        ? `remote:${remoteId}`
        : `local:${dreamId ?? String(legacy.id)}`,
    operation,
    clientRequestId,
    baseRevision: dream?.revisionId,
    clientUpdatedAt: dream?.clientUpdatedAt ?? createdAt,
    payload:
      operation === 'delete'
        ? {
            dreamId,
            remoteId,
          }
        : {
            dream,
          },
    status: 'pending',
    retryCount: 0,
    createdAt,
  });
};

/**
 * Type for dream list updater - either a new list or a function
 */
export type DreamListUpdater = DreamAnalysis[] | ((list: DreamAnalysis[]) => DreamAnalysis[]);

/**
 * Resolve an updater to a concrete list
 */
export const resolveDreamListUpdater = (
  updater: DreamListUpdater,
  current: DreamAnalysis[]
): DreamAnalysis[] => (typeof updater === 'function' ? updater(current) : updater);

/**
 * Derive a draft title from a transcript.
 * Uses the first non-empty line, truncated to `maxTitleLength`.
 */
export function deriveDraftTitle(
  transcript: string,
  defaultTitle: string,
  maxTitleLength = 64
): string {
  const trimmed = transcript.trim();
  if (!trimmed) {
    return defaultTitle;
  }

  const firstLine = trimmed.split('\n')[0]?.trim() ?? '';
  if (!firstLine) {
    return defaultTitle;
  }

  return firstLine.length > maxTitleLength
    ? `${firstLine.slice(0, maxTitleLength)}…`
    : firstLine;
}

type BuildDraftDreamOptions = {
  defaultTitle: string;
  maxTitleLength?: number;
  now?: () => number;
};

const dreamTypeForRememberedKind = (kind: RememberedDreamKind): DreamType => {
  switch (kind) {
    case 'recurring':
      return 'Recurring Dream';
    case 'nightmare':
      return 'Nightmare';
    case 'lucid':
      return 'Lucid Dream';
    default:
      return 'Symbolic Dream';
  }
};

/**
 * Build a local draft dream object from a transcript.
 * Pure and reusable across screens/hooks.
 */
export function buildDraftDream(
  transcript: string,
  options: BuildDraftDreamOptions
): DreamAnalysis {
  const trimmed = transcript.trim();
  const now = options.now ?? Date.now;
  const title = deriveDraftTitle(trimmed, options.defaultTitle, options.maxTitleLength ?? 64);

  return {
    id: now(),
    clientUpdatedAt: now(),
    transcript: trimmed,
    title,
    interpretation: '',
    shareableQuote: '',
    theme: undefined,
    dreamType: 'Symbolic Dream',
    imageUrl: '',
    thumbnailUrl: undefined,
    chatHistory: [],
    isFavorite: false,
    // Stable idempotency key so offline retries don't duplicate on reconnect
    clientRequestId: generateUUID(),
    imageGenerationFailed: false,
    syncState: 'clean',
    lastSyncError: undefined,
    isAnalyzed: false,
    analysisStatus: 'none',
  };
}

export type BuildRememberedDreamOptions = BuildDraftDreamOptions & {
  rememberedKind: RememberedDreamKind;
  approximatePeriod?: DreamApproximatePeriod;
  strongestFragment?: DreamStrongestFragment;
  lingeringEmotion?: string;
  recurrenceNote?: string;
  createdFromOnboarding?: boolean;
};

/**
 * Builds a first-class dream from a remembered, old, recurring, or anchor dream.
 * It remains a normal DreamAnalysis so journal, analysis, quota and sync flows
 * keep working while the app can distinguish its origin.
 */
export function buildRememberedDream(
  transcript: string,
  options: BuildRememberedDreamOptions
): DreamAnalysis {
  const draft = buildDraftDream(transcript, options);
  const memory = normalizeDreamMemoryMetadata({
    origin: 'remembered',
    anchorDream: true,
    dejaVu: true,
    recurring: options.rememberedKind === 'recurring',
    rememberedKind: options.rememberedKind,
    approximatePeriod: options.approximatePeriod,
    strongestFragment: options.strongestFragment,
    lingeringEmotion: options.lingeringEmotion,
    recurrenceNote: options.recurrenceNote,
    createdFrom: options.createdFromOnboarding ? 'onboarding' : 'journal',
    createdFromOnboarding: options.createdFromOnboarding,
  });

  return {
    ...draft,
    dreamType: dreamTypeForRememberedKind(options.rememberedKind),
    memory,
  };
}
