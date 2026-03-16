/**
 * useOfflineSyncQueue - Handles durable offline mutation logging and replay
 */

import { useCallback, useEffect, useRef } from 'react';

import { useAuth } from '../context/AuthContext';
import { logger } from '../lib/logger';
import { recordSyncReplayMetrics, reportSyncQueueMetrics } from '../lib/syncObservability';
import type { DreamAnalysis, DreamMutation } from '../lib/types';
import {
  type DreamListUpdater,
  buildDreamMutationEntityKey,
  generateMutationId,
  generateUUID,
  getMutationDreamId,
  getMutationRemoteId,
  removeDream,
  setDreamSyncState,
  upsertDream,
} from '../lib/dreamUtils';
import { savePendingDreamMutations } from '../services/storageService';
import {
  createDreamInSupabase,
  deleteDreamFromSupabase,
  type SyncMutationResult,
  syncDreamMutationsInSupabase,
  updateDreamInSupabase,
} from '../services/supabaseDreamService';

export type UseOfflineSyncQueueOptions = {
  canUseRemoteSync: boolean;
  hasNetwork: boolean;
  userScope?: string | null;
  persistRemoteDreams: (updater: DreamListUpdater) => Promise<void>;
  resolveRemoteId: (dreamId: number) => number | undefined;
  initialMutations?: DreamMutation[];
};

export type UseOfflineSyncQueueResult = {
  pendingMutationsRef: React.RefObject<DreamMutation[]>;
  queueOfflineOperation: (mutation: DreamMutation, updater: DreamListUpdater) => Promise<void>;
  clearQueuedMutationsForDream: (dreamId: number) => Promise<boolean>;
  retryDreamMutations: (dreamId: number) => Promise<boolean>;
  syncPendingMutations: () => Promise<void>;
  generateMutationId: () => string;
  setPendingMutations: (mutations: DreamMutation[]) => void;
};

const mergeServerDreamWithLocalState = (
  serverDream: DreamAnalysis,
  localDream?: DreamAnalysis
): DreamAnalysis =>
  setDreamSyncState(
    {
      ...serverDream,
      id: localDream?.id ?? serverDream.id,
      imageUpdatedAt: localDream?.imageUpdatedAt ?? serverDream.imageUpdatedAt,
      imageSource: localDream?.imageSource ?? serverDream.imageSource,
      imageJobId: localDream?.imageJobId,
      imageJobStatus: localDream?.imageJobStatus,
      imageJobRequestId: localDream?.imageJobRequestId,
      imageJobErrorCode: localDream?.imageJobErrorCode,
      imageJobErrorMessage: localDream?.imageJobErrorMessage,
    },
    'clean',
    {
      lastSyncedAt: Date.now(),
      lastSyncError: undefined,
      conflictRemoteDream: undefined,
    }
  );

const normalizeMutation = (mutation: DreamMutation, userScope?: string | null): DreamMutation => {
  const legacyMutation = mutation as DreamMutation & {
    dream?: DreamAnalysis;
    dreamId?: number;
    remoteId?: number;
    type?: DreamMutation['operation'];
  };
  const payload =
    mutation.payload && typeof mutation.payload === 'object'
      ? mutation.payload
      : {
          ...(legacyMutation.dream ? { dream: legacyMutation.dream } : {}),
          ...(legacyMutation.dreamId != null ? { dreamId: legacyMutation.dreamId } : {}),
          ...(legacyMutation.remoteId != null ? { remoteId: legacyMutation.remoteId } : {}),
        };
  const dream = payload.dream;
  const tombstone = payload.tombstone;
  const operation = mutation.operation ?? legacyMutation.type ?? 'update';
  const entityKey =
    mutation.entityKey ||
    (dream ? buildDreamMutationEntityKey(dream) : payload.remoteId != null
      ? `remote:${payload.remoteId}`
      : `local:${payload.dreamId ?? mutation.id}`);

  const clientRequestId =
    mutation.clientRequestId ||
    dream?.clientRequestId ||
    tombstone?.clientRequestId ||
    generateUUID();
  const normalizedPayload = {
    ...payload,
    ...(dream ? { dream: { ...dream, clientRequestId: dream.clientRequestId ?? clientRequestId } } : {}),
    ...(tombstone
      ? { tombstone: { ...tombstone, clientRequestId: tombstone.clientRequestId ?? clientRequestId } }
      : {}),
  };

  return {
    ...mutation,
    version: 1,
    userScope: mutation.userScope || userScope || 'user:unknown',
    entityType: 'dream',
    entityKey,
    operation,
    clientRequestId,
    payload: normalizedPayload,
    clientUpdatedAt:
      mutation.clientUpdatedAt ||
      dream?.clientUpdatedAt ||
      tombstone?.clientUpdatedAt ||
      mutation.createdAt,
    status: mutation.status ?? 'pending',
    retryCount: mutation.retryCount ?? 0,
    type: operation,
    dream: normalizedPayload.dream,
    dreamId: normalizedPayload.dreamId,
    remoteId: normalizedPayload.remoteId,
  } as DreamMutation;
};

const isRetryableMutation = (mutation: DreamMutation): boolean =>
  mutation.status === 'pending' || mutation.status === 'failed';

const applyAckedMutation = (
  list: DreamAnalysis[],
  mutation: DreamMutation,
  result: SyncMutationResult
): DreamAnalysis[] => {
  if (mutation.operation === 'delete') {
    return removeDream(
      list,
      mutation.payload.dreamId ?? mutation.payload.tombstone?.id ?? -1,
      result.remoteId ?? getMutationRemoteId(mutation)
    );
  }

  if (!result.dream) {
    return list;
  }

  return upsertDream(list, mergeServerDreamWithLocalState(result.dream, mutation.payload.dream));
};

const applyFailedMutation = (
  list: DreamAnalysis[],
  mutation: DreamMutation,
  syncState: 'failed' | 'conflict',
  error?: string,
  remoteDream?: DreamAnalysis
): DreamAnalysis[] => {
  const localDream = mutation.payload.dream ?? mutation.payload.tombstone ?? remoteDream;
  if (!localDream) {
    return list;
  }

  const existingDream = list.find(
    (entry) =>
      entry.id === localDream.id ||
      (localDream.remoteId != null && entry.remoteId === localDream.remoteId) ||
      (remoteDream?.remoteId != null && entry.remoteId === remoteDream.remoteId)
  );

  const nextDream = setDreamSyncState(
    {
      ...existingDream,
      ...localDream,
      remoteId: localDream.remoteId ?? existingDream?.remoteId ?? remoteDream?.remoteId,
      revisionId: localDream.revisionId ?? existingDream?.revisionId ?? remoteDream?.revisionId,
      updatedAt: localDream.updatedAt ?? existingDream?.updatedAt ?? remoteDream?.updatedAt,
    },
    syncState,
    {
      lastSyncError: error,
      conflictRemoteDream: syncState === 'conflict' ? remoteDream : undefined,
    }
  );

  return upsertDream(list, nextDream);
};

export function useOfflineSyncQueue({
  canUseRemoteSync,
  hasNetwork,
  userScope,
  persistRemoteDreams,
  resolveRemoteId,
  initialMutations = [],
}: UseOfflineSyncQueueOptions): UseOfflineSyncQueueResult {
  const { user } = useAuth();
  const pendingMutationsRef = useRef<DreamMutation[]>(
    initialMutations.map((mutation) => normalizeMutation(mutation, userScope))
  );
  const syncingRef = useRef(false);
  const syncTokenRef = useRef(0);
  const inFlightSyncRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const persistPendingMutations = useCallback(
    async (mutations: DreamMutation[]) => {
      const normalized = mutations.map((mutation) => normalizeMutation(mutation, userScope));
      pendingMutationsRef.current = normalized;
      reportSyncQueueMetrics({
        mutations: normalized,
        reason: 'persist_pending_mutations',
        userScope,
      });
      if (!canUseRemoteSync) return;
      await savePendingDreamMutations(normalized, userScope);
    },
    [canUseRemoteSync, userScope]
  );

  const setPendingMutations = useCallback((mutations: DreamMutation[]) => {
    const normalized = mutations.map((mutation) => normalizeMutation(mutation, userScope));
    pendingMutationsRef.current = normalized;
    reportSyncQueueMetrics({
      mutations: normalized,
      reason: 'hydrate_pending_mutations',
      userScope,
    });
  }, [userScope]);

  useEffect(() => {
    const current = pendingMutationsRef.current.map((mutation) => normalizeMutation(mutation, userScope));
    const mergedById = new Map<string, DreamMutation>();
    [...initialMutations.map((mutation) => normalizeMutation(mutation, userScope)), ...current].forEach((mutation) => {
      mergedById.set(mutation.id, mutation);
    });

    const merged = Array.from(mergedById.values()).sort(
      (a, b) => a.clientUpdatedAt - b.clientUpdatedAt
    );

    const changed =
      merged.length !== current.length ||
      merged.some((mutation, index) => mutation.id !== current[index]?.id);

    if (changed) {
      setPendingMutations(merged);
      void persistPendingMutations(merged);
    }
  }, [initialMutations, persistPendingMutations, setPendingMutations, userScope]);

  const appendPendingMutation = useCallback(
    async (mutation: DreamMutation) => {
      await persistPendingMutations([...pendingMutationsRef.current, mutation]);
    },
    [persistPendingMutations]
  );

  const queueOfflineOperation = useCallback(
    async (mutation: DreamMutation, updater: DreamListUpdater) => {
      await persistRemoteDreams(updater);
      await appendPendingMutation(normalizeMutation(mutation, userScope));
    },
    [appendPendingMutation, persistRemoteDreams, userScope]
  );

  const clearQueuedMutationsForDream = useCallback(
    async (dreamId: number): Promise<boolean> => {
      const filtered = pendingMutationsRef.current.filter((mutation) => getMutationDreamId(mutation) !== dreamId);
      const changed = filtered.length !== pendingMutationsRef.current.length;
      if (changed) {
        await persistPendingMutations(filtered);
      }
      return changed;
    },
    [persistPendingMutations]
  );

  const retryDreamMutations = useCallback(
    async (dreamId: number): Promise<boolean> => {
      let changed = false;
      const nextQueue: DreamMutation[] = pendingMutationsRef.current.map((mutation) => {
        if (getMutationDreamId(mutation) !== dreamId || mutation.status !== 'failed') {
          return mutation;
        }

        changed = true;
        return {
          ...mutation,
          status: 'pending',
          lastError: undefined,
        };
      });

      if (!changed) {
        return false;
      }

      await persistPendingMutations(nextQueue);
      return true;
    },
    [persistPendingMutations]
  );

  const syncPendingMutations = useCallback(async () => {
    if (!canUseRemoteSync || !user || !hasNetwork) return;
    if (!pendingMutationsRef.current.length) return;

    if (inFlightSyncRef.current) {
      await inFlightSyncRef.current;
    }

    if (!mountedRef.current || syncingRef.current) return;

    const eligibleMutations = pendingMutationsRef.current.filter(isRetryableMutation);
    if (!eligibleMutations.length) return;

    const currentToken = ++syncTokenRef.current;
    syncingRef.current = true;

    const markMutationState = (
      mutation: DreamMutation,
      status: DreamMutation['status'],
      extras: Partial<Pick<DreamMutation, 'lastError' | 'lastAttemptAt' | 'retryCount'>> = {}
    ): DreamMutation => ({
      ...mutation,
      status,
      lastError: extras.lastError,
      lastAttemptAt: extras.lastAttemptAt ?? Date.now(),
      retryCount: extras.retryCount ?? mutation.retryCount,
    });

    const syncPromise = (async () => {
      const startedAt = Date.now();
      const sendingIds = new Set(eligibleMutations.map((mutation) => mutation.id));
      const sendingQueue = pendingMutationsRef.current.map((mutation) =>
        sendingIds.has(mutation.id) ? markMutationState(mutation, 'sending') : mutation
      );
      await persistPendingMutations(sendingQueue);

      try {
        const canUseBatchSync = userScope && typeof syncDreamMutationsInSupabase === 'function';
        const results = canUseBatchSync
          ? await syncDreamMutationsInSupabase(eligibleMutations, user.id)
          : await (async (): Promise<SyncMutationResult[]> => {
              const legacyResults: SyncMutationResult[] = [];
              const workingMutations = eligibleMutations.map((mutation) => normalizeMutation(mutation, userScope));

              for (let index = 0; index < workingMutations.length; index += 1) {
                const mutation = workingMutations[index];

                if (mutation.operation === 'create' && mutation.payload.dream) {
                  const dream = await createDreamInSupabase(mutation.payload.dream, user.id);
                  legacyResults.push({
                    mutationId: mutation.id,
                    clientRequestId: mutation.clientRequestId,
                    operation: mutation.operation,
                    status: 'ack',
                    dream,
                    remoteId: dream.remoteId,
                  });

                  workingMutations.slice(index + 1).forEach((entry) => {
                    const sameDream = getMutationDreamId(entry) === mutation.payload.dream?.id;
                    if (!sameDream || dream.remoteId == null) {
                      return;
                    }

                    if (entry.payload.dream) {
                      entry.payload = {
                        ...entry.payload,
                        dream: {
                          ...entry.payload.dream,
                          remoteId: dream.remoteId,
                        },
                      };
                    } else {
                      entry.payload = {
                        ...entry.payload,
                        remoteId: dream.remoteId,
                      };
                    }
                  });
                  continue;
                }

                if (mutation.operation === 'update' && mutation.payload.dream) {
                  const remoteId = mutation.payload.dream.remoteId ?? mutation.payload.remoteId;
                  if (remoteId == null) {
                    legacyResults.push({
                      mutationId: mutation.id,
                      clientRequestId: mutation.clientRequestId,
                      operation: mutation.operation,
                      status: 'failed',
                      error: 'Missing remote id for update',
                    });
                    continue;
                  }

                  const dream = await updateDreamInSupabase({
                    ...mutation.payload.dream,
                    remoteId,
                  });
                  legacyResults.push({
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
                    legacyResults.push({
                      mutationId: mutation.id,
                      clientRequestId: mutation.clientRequestId,
                      operation: mutation.operation,
                      status: 'failed',
                      error: 'Missing remote id for delete',
                    });
                    continue;
                  }
                  await deleteDreamFromSupabase(remoteId);
                  legacyResults.push({
                    mutationId: mutation.id,
                    clientRequestId: mutation.clientRequestId,
                    operation: mutation.operation,
                    status: 'ack',
                    remoteId,
                  });
                  continue;
                }

                legacyResults.push({
                  mutationId: mutation.id,
                  clientRequestId: mutation.clientRequestId,
                  operation: mutation.operation,
                  status: 'failed',
                  error: 'Malformed mutation payload',
                });
              }

              return legacyResults;
            })();

        if (!mountedRef.current || syncTokenRef.current !== currentToken) {
          return;
        }

        const resultsById = new Map(results.map((result) => [result.mutationId, result]));
        const nextQueue = pendingMutationsRef.current
          .map((mutation) => {
            const result = resultsById.get(mutation.id);
            if (!result) {
              return mutation;
            }

            if (result.status === 'ack') {
              return markMutationState(mutation, 'acked', { lastError: undefined });
            }

            if (result.status === 'conflict') {
              return markMutationState(mutation, 'blocked', {
                lastError: result.error ?? 'Conflict detected during sync',
              });
            }

            return markMutationState(mutation, 'failed', {
              lastError: result.error ?? 'Failed to sync mutation',
              retryCount: mutation.retryCount + 1,
            });
          })
          .filter((mutation) => mutation.status !== 'acked');

        await persistRemoteDreams((prev) => {
          let nextDreams = prev;
          results.forEach((result) => {
            const mutation = eligibleMutations.find((entry) => entry.id === result.mutationId);
            if (!mutation) {
              return;
            }

            if (result.status === 'ack') {
              nextDreams = applyAckedMutation(nextDreams, mutation, result);
              return;
            }

            if (result.status === 'conflict') {
              nextDreams = applyFailedMutation(
                nextDreams,
                mutation,
                'conflict',
                result.error ?? 'Conflict detected during sync',
                result.dream
              );
              return;
            }

            nextDreams = applyFailedMutation(
              nextDreams,
              mutation,
              'failed',
              result.error ?? 'Failed to sync mutation'
            );
          });
          return nextDreams;
        });

        await persistPendingMutations(nextQueue);
        recordSyncReplayMetrics({
          attemptedCount: eligibleMutations.length,
          ackCount: results.filter((result) => result.status === 'ack').length,
          failedCount: results.filter((result) => result.status === 'failed').length,
          conflictCount: results.filter((result) => result.status === 'conflict').length,
          durationMs: Date.now() - startedAt,
          pendingMutationsAfter: nextQueue,
          reason: 'sync_batch_completed',
          userScope,
        });
      } catch (error) {
        logger.warn('Failed to sync offline mutations', error);
        const message = error instanceof Error ? error.message : 'Failed to sync mutation batch';
        const nextQueue = pendingMutationsRef.current.map((mutation) => {
          if (!sendingIds.has(mutation.id)) {
            return mutation;
          }
          return markMutationState(mutation, 'failed', {
            lastError: message,
            retryCount: mutation.retryCount + 1,
          });
        });

        await persistRemoteDreams((prev) => {
          let nextDreams = prev;
          eligibleMutations.forEach((mutation) => {
            nextDreams = applyFailedMutation(nextDreams, mutation, 'failed', message);
          });
          return nextDreams;
        });

        await persistPendingMutations(nextQueue);
        recordSyncReplayMetrics({
          attemptedCount: eligibleMutations.length,
          ackCount: 0,
          failedCount: eligibleMutations.length,
          conflictCount: 0,
          durationMs: Date.now() - startedAt,
          pendingMutationsAfter: nextQueue,
          reason: 'sync_batch_failed',
          userScope,
        });
      } finally {
        if (syncTokenRef.current === currentToken) {
          syncingRef.current = false;
        }
        inFlightSyncRef.current = null;
      }
    })();

    inFlightSyncRef.current = syncPromise;
    return syncPromise;
  }, [canUseRemoteSync, hasNetwork, persistPendingMutations, persistRemoteDreams, user, userScope]);

  useEffect(() => {
    void syncPendingMutations();
  }, [syncPendingMutations]);

  return {
    pendingMutationsRef,
    queueOfflineOperation,
    clearQueuedMutationsForDream,
    retryDreamMutations,
    syncPendingMutations,
    generateMutationId,
    setPendingMutations,
  };
}
