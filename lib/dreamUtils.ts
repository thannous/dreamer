/**
 * Pure utility functions for dream data manipulation
 * Extracted from useDreamJournal for reusability and testability
 */

import { getThumbnailUrl } from '@/lib/imageUtils';
import type { DreamAnalysis, DreamMutation } from '@/lib/types';

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
  const derivedThumbnail = hasImage ? getThumbnailUrl(dream.imageUrl) : undefined;

  return {
    ...dream,
    thumbnailUrl: hasImage ? derivedThumbnail : undefined,
    imageGenerationFailed: hasImage ? false : dream.imageGenerationFailed,
  };
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
