/**
 * Pure utility functions for dream data manipulation
 * Extracted from useDreamJournal for reusability and testability
 */

import { getThumbnailUrl } from '@/lib/imageUtils';
import type { ChatMessage, DreamAnalysis, DreamMutation } from '@/lib/types';

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

/**
 * Normalize dream images - derive thumbnail from imageUrl
 */
export const normalizeDreamImages = (dream: DreamAnalysis): DreamAnalysis => {
  const hasImage = Boolean(dream.imageUrl?.trim());
  // Perf: Skip redundant URL parsing if thumbnail already exists
  const derivedThumbnail = hasImage
    ? (dream.thumbnailUrl || getThumbnailUrl(dream.imageUrl))
    : undefined;

  return {
    ...dream,
    thumbnailUrl: hasImage ? derivedThumbnail : undefined,
    imageGenerationFailed: hasImage ? false : dream.imageGenerationFailed,
  };
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
    left.clientRequestId !== right.clientRequestId
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
  if ((left.pendingSync ?? false) !== (right.pendingSync ?? false)) return false;
  if ((left.isAnalyzed ?? false) !== (right.isAnalyzed ?? false)) return false;
  if ((left.analyzedAt ?? null) !== (right.analyzedAt ?? null)) return false;
  if ((left.analysisStatus ?? 'none') !== (right.analysisStatus ?? 'none')) return false;
  if ((left.analysisRequestId ?? null) !== (right.analysisRequestId ?? null)) return false;
  if ((left.explorationStartedAt ?? null) !== (right.explorationStartedAt ?? null)) return false;

  const leftChat = Array.isArray(left.chatHistory) ? left.chatHistory : [];
  const rightChat = Array.isArray(right.chatHistory) ? right.chatHistory : [];
  return areChatHistoriesEqual(leftChat, rightChat);
};

/**
 * Normalize a list of dreams
 */
export const normalizeDreamList = (list: DreamAnalysis[]): DreamAnalysis[] =>
  list.map((dream) => normalizeDreamImages(dream));

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
  mutations.some((mutation) =>
    mutation.type === 'delete' ? mutation.dreamId === dreamId : mutation.dream.id === dreamId
  );

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
  mutations.forEach((mutation) => {
    switch (mutation.type) {
      case 'create':
        next = upsertDream(next, mutation.dream);
        break;
      case 'update':
        next = upsertDream(next, mutation.dream);
        break;
      case 'delete':
        next = removeDream(next, mutation.dreamId, mutation.remoteId);
        break;
      default:
        break;
    }
  });
  return sortDreams(next);
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
    isAnalyzed: false,
    analysisStatus: 'none',
  };
}
