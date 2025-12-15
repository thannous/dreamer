/**
 * useOfflineSyncQueue - Handles offline mutation queue and synchronization
 *
 * Responsibilities:
 * - Queue mutations (create/update/delete) when offline
 * - Persist mutation queue to storage
 * - Sync pending mutations when network becomes available
 * - Handle race conditions with sync tokens
 *
 * This hook is extracted from useDreamJournal for better separation of concerns.
 */

import { useCallback, useEffect, useRef } from 'react';

import { useAuth } from '../context/AuthContext';
import { logger } from '../lib/logger';
import type { DreamAnalysis, DreamMutation } from '../lib/types';
import {
  type DreamListUpdater,
  generateMutationId,
  generateUUID,
  hasPendingMutationsForDream,
  isNotFoundError,
  removeDream,
} from '../lib/dreamUtils';
import { savePendingDreamMutations } from '../services/storageService';
import {
  createDreamInSupabase,
  deleteDreamFromSupabase,
  updateDreamInSupabase,
} from '../services/supabaseDreamService';

export type UseOfflineSyncQueueOptions = {
  /** Whether remote sync is enabled */
  canUseRemoteSync: boolean;
  /** Whether network is available */
  hasNetwork: boolean;
  /** Function to persist dreams to remote cache */
  persistRemoteDreams: (updater: DreamListUpdater) => Promise<void>;
  /** Function to resolve remoteId from local dreamId */
  resolveRemoteId: (dreamId: number) => number | undefined;
  /** Initial pending mutations (from loadDreams) */
  initialMutations?: DreamMutation[];
};

export type UseOfflineSyncQueueResult = {
  /** Ref to pending mutations */
  pendingMutationsRef: React.RefObject<DreamMutation[]>;
  /** Queue an offline operation */
  queueOfflineOperation: (mutation: DreamMutation, updater: DreamListUpdater) => Promise<void>;
  /** Clear queued mutations for a specific dream */
  clearQueuedMutationsForDream: (dreamId: number) => Promise<boolean>;
  /** Sync all pending mutations */
  syncPendingMutations: () => Promise<void>;
  /** Generate a unique mutation ID */
  generateMutationId: () => string;
  /** Set pending mutations (for initial load) */
  setPendingMutations: (mutations: DreamMutation[]) => void;
};

/**
 * Hook for managing offline mutation queue and synchronization
 */
export function useOfflineSyncQueue({
  canUseRemoteSync,
  hasNetwork,
  persistRemoteDreams,
  resolveRemoteId,
  initialMutations = [],
}: UseOfflineSyncQueueOptions): UseOfflineSyncQueueResult {
  const { user } = useAuth();
  const pendingMutationsRef = useRef<DreamMutation[]>(initialMutations);
  const syncingRef = useRef(false);

  // Monotonic sync token to prevent older completions from overwriting newer state
  const syncTokenRef = useRef(0);
  // Single in-flight promise to queue subsequent sync calls
  const inFlightSyncRef = useRef<Promise<void> | null>(null);
  // Track component mount state to bail out of async operations
  const mountedRef = useRef(true);

  const ensureClientRequestId = useCallback((mutation: DreamMutation): DreamMutation => {
    if (mutation.type === 'create' || mutation.type === 'update') {
      if (mutation.dream.clientRequestId) return mutation;
      const clientRequestId =
        // Deterministic fallback based on local id to avoid regenerating new ids on each retry
        typeof mutation.dream.id === 'number'
          ? `dream-${mutation.dream.id}`
          : generateUUID();
      return {
        ...mutation,
        dream: { ...mutation.dream, clientRequestId },
      };
    }
    return mutation;
  }, []);

  // Track mount state for async safety
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Set pending mutations (used after loadDreams)
   */
  const setPendingMutations = useCallback((mutations: DreamMutation[]) => {
    pendingMutationsRef.current = mutations.map(ensureClientRequestId);
  }, [ensureClientRequestId]);

  /**
   * Persist pending mutations to storage
   */
  const persistPendingMutations = useCallback(
    async (mutations: DreamMutation[]) => {
      const normalized = mutations.map(ensureClientRequestId);
      pendingMutationsRef.current = normalized;
      if (!canUseRemoteSync) return;
      await savePendingDreamMutations(normalized);
    },
    [canUseRemoteSync, ensureClientRequestId]
  );

  /**
   * Hydrate queue with initial mutations loaded from storage.
   * Merge with any mutations already enqueued in this session to avoid dropping new work.
   */
  useEffect(() => {
    const current = pendingMutationsRef.current.map(ensureClientRequestId);
    const mergedById = new Map<string, DreamMutation>();
    [...initialMutations.map(ensureClientRequestId), ...current].forEach((mutation) => {
      mergedById.set(mutation.id, ensureClientRequestId(mutation));
    });

    const merged = Array.from(mergedById.values()).sort(
      (a, b) => a.createdAt - b.createdAt
    );

    const changed =
      merged.length !== current.length ||
      merged.some((mutation, index) => mutation.id !== current[index]?.id);

    if (changed) {
      setPendingMutations(merged);
      void persistPendingMutations(merged);
    }
  }, [ensureClientRequestId, initialMutations, persistPendingMutations, setPendingMutations]);

  /**
   * Append a mutation to the queue
   */
  const appendPendingMutation = useCallback(
    async (mutation: DreamMutation) => {
      await persistPendingMutations([...pendingMutationsRef.current, mutation]);
    },
    [persistPendingMutations]
  );

  /**
   * Queue an offline operation with optimistic update
   */
  const queueOfflineOperation = useCallback(
    async (mutation: DreamMutation, updater: DreamListUpdater) => {
      await persistRemoteDreams(updater);
      await appendPendingMutation(mutation);
    },
    [appendPendingMutation, persistRemoteDreams]
  );

  /**
   * Clear all queued mutations for a specific dream
   */
  const clearQueuedMutationsForDream = useCallback(
    async (dreamId: number): Promise<boolean> => {
      const filtered = pendingMutationsRef.current.filter((mutation) => {
        if (mutation.type === 'delete') {
          return mutation.dreamId !== dreamId;
        }
        if (mutation.type === 'create' || mutation.type === 'update') {
          return mutation.dream.id !== dreamId;
        }
        return true;
      });
      const changed = filtered.length !== pendingMutationsRef.current.length;
      if (changed) {
        await persistPendingMutations(filtered);
      }
      return changed;
    },
    [persistPendingMutations]
  );

  /**
   * Sync all pending mutations to the server
   */
  const syncPendingMutations = useCallback(async () => {
    if (!canUseRemoteSync || !user || !hasNetwork) return;
    if (!pendingMutationsRef.current.length) return;

    // Wait for any in-flight sync to complete before starting
    if (inFlightSyncRef.current) {
      await inFlightSyncRef.current;
    }

    // Double-check conditions after waiting
    if (!mountedRef.current || syncingRef.current) return;
    if (!pendingMutationsRef.current.length) return;

    // Acquire the sync token - newer syncs will have higher tokens
    const currentToken = ++syncTokenRef.current;
    syncingRef.current = true;

    const syncPromise = (async () => {
      try {
        let queue = [...pendingMutationsRef.current];
        while (queue.length) {
          // Bail out if unmounted or a newer sync was started
          if (!mountedRef.current || syncTokenRef.current !== currentToken) {
            return;
          }

          const mutation = queue[0];
          try {
            if (mutation.type === 'create') {
              const created = await createDreamInSupabase(mutation.dream, user.id);

              // Check again after async operation
              if (!mountedRef.current || syncTokenRef.current !== currentToken) return;

              const createdWithLocal = mutation.dream.imageUpdatedAt
                ? { ...created, imageUpdatedAt: mutation.dream.imageUpdatedAt }
                : created;
              queue.shift();
              queue = queue.map((entry) => {
                if (entry.type === 'update' && entry.dream.id === mutation.dream.id) {
                  return {
                    ...entry,
                    dream: { ...entry.dream, remoteId: created.remoteId, id: created.id },
                  };
                }
                if (entry.type === 'delete' && entry.dreamId === mutation.dream.id) {
                  return { ...entry, remoteId: created.remoteId, dreamId: created.id };
                }
                return entry;
              });
              const stillPending = hasPendingMutationsForDream(queue, created.id);
              await persistRemoteDreams((prev: DreamAnalysis[]) =>
                prev.map((d) => {
                  if (d.id !== mutation.dream.id) return d;
                  return stillPending
                    ? { ...d, id: created.id, remoteId: created.remoteId }
                    : { ...createdWithLocal, id: created.id, pendingSync: undefined };
                })
              );
            } else if (mutation.type === 'update') {
              const remoteId = mutation.dream.remoteId ?? resolveRemoteId(mutation.dream.id);
              if (!remoteId) {
                // Recovery: if an update is queued without remoteId (e.g. stale cache / older app version),
                // convert it to a create/upsert so we can obtain a remoteId and unblock the queue.
                // createDreamInSupabase is idempotent on (user_id, client_request_id).
                queue[0] = {
                  ...mutation,
                  type: 'create',
                  dream: { ...mutation.dream, remoteId: undefined, pendingSync: true },
                };
                continue;
              }
              try {
                const saved = await updateDreamInSupabase({ ...mutation.dream, remoteId });

                // Check again after async operation
                if (!mountedRef.current || syncTokenRef.current !== currentToken) return;

                const savedWithLocal = mutation.dream.imageUpdatedAt
                  ? { ...saved, imageUpdatedAt: mutation.dream.imageUpdatedAt }
                  : saved;
                queue.shift();
                const stillPending = hasPendingMutationsForDream(queue, mutation.dream.id);
                await persistRemoteDreams((prev: DreamAnalysis[]) =>
                  prev.map((d) => {
                    if (d.id !== mutation.dream.id) return d;
                    if (stillPending) {
                      return d;
                    }
                    return { ...savedWithLocal, id: d.id, pendingSync: undefined };
                  })
                );
              } catch (error) {
                if (isNotFoundError(error)) {
                  queue[0] = {
                    ...mutation,
                    type: 'create',
                    dream: { ...mutation.dream, remoteId: undefined, pendingSync: true },
                  };
                  continue;
                }
                throw error;
              }
            } else if (mutation.type === 'delete') {
              const remoteId = mutation.remoteId ?? resolveRemoteId(mutation.dreamId);
              if (!remoteId) {
                throw new Error('Missing remote id for Supabase dream delete');
              }
              await deleteDreamFromSupabase(remoteId);

              // Check again after async operation
              if (!mountedRef.current || syncTokenRef.current !== currentToken) return;

              queue.shift();
              await persistRemoteDreams((prev: DreamAnalysis[]) =>
                removeDream(prev, mutation.dreamId, remoteId)
              );
            }
          } catch (error) {
            logger.warn('Failed to sync offline mutation', error);
            break;
          }
        }

        // Final check before persisting
        if (mountedRef.current && syncTokenRef.current === currentToken) {
          await persistPendingMutations(queue);
        }
      } finally {
        // Only release lock if we still hold the current token
        if (syncTokenRef.current === currentToken) {
          syncingRef.current = false;
        }
        inFlightSyncRef.current = null;
      }
    })();

    inFlightSyncRef.current = syncPromise;
    return syncPromise;
  }, [canUseRemoteSync, hasNetwork, persistPendingMutations, persistRemoteDreams, resolveRemoteId, user]);

  // Auto-sync when network becomes available or dependencies change
  useEffect(() => {
    syncPendingMutations();
  }, [syncPendingMutations]);

  return {
    pendingMutationsRef,
    queueOfflineOperation,
    clearQueuedMutationsForDream,
    syncPendingMutations,
    generateMutationId,
    setPendingMutations,
  };
}
