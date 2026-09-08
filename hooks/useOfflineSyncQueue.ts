import { normalizeMutation, isRetryableMutation, applyAckedMutation, applyFailedMutation } from '../lib/journalQueueTransitions';
import { type DreamTarget, matchesDreamTarget, getDreamIdentityKey } from '../lib/dreamIdentity';
/**
 * useOfflineSyncQueue - Handles durable offline mutation logging and replay
 */

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import { useAuth } from '../context/AuthContext';
import { DreamPersistenceError } from '../lib/dreamStorageRead';
import { logger } from '../lib/logger';
import { recordSyncReplayMetrics, reportSyncQueueMetrics } from '../lib/syncObservability';
import type { DreamAnalysis, DreamMutation } from '../lib/types';
import {
  type DreamListUpdater,
  generateMutationId,
  getMutationDreamTarget,
  getMutationRemoteId,
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
  resolveRemoteId: (dreamId: DreamTarget) => number | undefined;
  remoteSnapshot?: { userScope: string | null; dreams: DreamAnalysis[] } | null;
  initialMutations?: DreamMutation[];
  initialMutationsLoaded?: boolean;
  initialMutationsScope?: string | null;
};

export type UseOfflineSyncQueueResult = {
  pendingMutationsRef: React.RefObject<DreamMutation[]>;
  queueOfflineOperation: (mutation: DreamMutation, updater: DreamListUpdater) => Promise<void>;
  clearQueuedMutationsForDream: (dreamId: DreamTarget) => Promise<boolean>;
  retryDreamMutations: (dreamId: DreamTarget) => Promise<boolean>;
  syncPendingMutations: () => Promise<void>;
  generateMutationId: () => string;
  setPendingMutations: (mutations: DreamMutation[]) => void;
};

export function useOfflineSyncQueue({
  canUseRemoteSync,
  hasNetwork,
  userScope,
  persistRemoteDreams,
  resolveRemoteId,
  remoteSnapshot,
  initialMutations = [],
  initialMutationsLoaded = true,
  initialMutationsScope = userScope,
}: UseOfflineSyncQueueOptions): UseOfflineSyncQueueResult {
  const { user } = useAuth();
  const initialSnapshotMatchesScope =
    initialMutationsLoaded &&
    initialMutationsScope === userScope &&
    initialMutations.every(
      (mutation) => !userScope || !mutation.userScope || mutation.userScope === userScope
    );
  const pendingMutationsRef = useRef<DreamMutation[]>(
    initialSnapshotMatchesScope
      ? initialMutations.map((mutation) => normalizeMutation(mutation, userScope))
      : []
  );
  const resolveSnapshotDependenciesRef = useRef<(() => void) | null>(null);
  // Only entries proven never attempted may be cancelled during durable preparation.
  const preparingCreatesRef = useRef(new Set<string>());
  const syncingRef = useRef(false);
  const syncTokenRef = useRef(0);
  const inFlightSyncRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(true);
  const mutationsLoadedRef = useRef(initialSnapshotMatchesScope);
  const mutationScopeRef = useRef(userScope);
  const activeUserScopeRef = useRef(userScope);
  const mutationWriteTailsRef = useRef<Map<string, Promise<void>>>(new Map());

  useLayoutEffect(() => {
    activeUserScopeRef.current = userScope;
    if (mutationScopeRef.current !== userScope) {
      mutationScopeRef.current = userScope;
      pendingMutationsRef.current = [];
      syncTokenRef.current += 1;
      syncingRef.current = false;
      preparingCreatesRef.current.clear();
    }
    mutationsLoadedRef.current = initialSnapshotMatchesScope;
  }, [initialSnapshotMatchesScope, userScope]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const persistPendingMutations = useCallback(
    async (mutations: DreamMutation[]) => {
      if (activeUserScopeRef.current !== userScope) {
        throw new DreamPersistenceError('read', 'remote-cache');
      }
      if (!mutationsLoadedRef.current) {
        throw new DreamPersistenceError('read', 'remote-cache');
      }
      if (
        userScope &&
        mutations.some((mutation) => mutation.userScope && mutation.userScope !== userScope)
      ) {
        throw new DreamPersistenceError('read', 'remote-cache');
      }
      const normalized = mutations.map((mutation) => normalizeMutation(mutation, userScope));
      pendingMutationsRef.current = normalized;
      reportSyncQueueMetrics({
        alertOnStalePending: canUseRemoteSync,
        mutations: normalized,
        reason: 'persist_pending_mutations',
        userScope,
      });
      if (!canUseRemoteSync) return;
      const scopeKey = userScope ?? 'anonymous';
      const previous = mutationWriteTailsRef.current.get(scopeKey) ?? Promise.resolve();
      const run = previous
        .catch(() => undefined)
        .then(() => savePendingDreamMutations(normalized, userScope));
      mutationWriteTailsRef.current.set(
        scopeKey,
        run.then(
          () => undefined,
          () => undefined
        )
      );
      try {
        await run;
        if (mountedRef.current && activeUserScopeRef.current === userScope) {
          resolveSnapshotDependenciesRef.current?.();
        }
      } catch {
        throw new DreamPersistenceError('write', 'remote-cache');
      }
    },
    [canUseRemoteSync, userScope]
  );

  const setPendingMutations = useCallback((mutations: DreamMutation[]) => {
    if (activeUserScopeRef.current !== userScope) return;
    if (
      userScope &&
      mutations.some((mutation) => mutation.userScope && mutation.userScope !== userScope)
    ) {
      throw new DreamPersistenceError('read', 'remote-cache');
    }
    const normalized = mutations.map((mutation) => normalizeMutation(mutation, userScope));
    pendingMutationsRef.current = normalized;
    reportSyncQueueMetrics({
      alertOnStalePending: canUseRemoteSync,
      mutations: normalized,
      reason: 'hydrate_pending_mutations',
      userScope,
    });
    resolveSnapshotDependenciesRef.current?.();
  }, [canUseRemoteSync, userScope]);

  useEffect(() => {
    if (!initialSnapshotMatchesScope || activeUserScopeRef.current !== userScope) return;
    const current = pendingMutationsRef.current.map((mutation) => normalizeMutation(mutation, userScope));
    const mergedById = new Map<string, DreamMutation>();
    const deletions = current.filter((entry) => entry.operation === 'delete');
    [...initialMutations.filter((entry) => entry.operation === 'delete' || !deletions.some((deleted) => matchesDreamTarget(getMutationDreamTarget(entry), getMutationDreamTarget(deleted)))).map((mutation) => normalizeMutation(mutation, userScope)), ...current].forEach((mutation) => {
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
      void persistPendingMutations(merged).catch(() => {
        logger.warn('Pending dream changes could not be persisted');
      });
    }
  }, [
    initialMutations,
    initialSnapshotMatchesScope,
    persistPendingMutations,
    setPendingMutations,
    userScope,
  ]);

  const appendPendingMutation = useCallback(
    async (mutation: DreamMutation) => {
      const current = pendingMutationsRef.current;
      if (mutation.operation === 'delete') {
        const neverSentCreate = current.find((entry) =>
          matchesDreamTarget(getMutationDreamTarget(entry), getMutationDreamTarget(mutation)) &&
          entry.operation === 'create' && (preparingCreatesRef.current.has(entry.id) ||
            (entry.status === 'pending' && entry.lastAttemptAt == null && entry.retryCount === 0))
        );
        await persistPendingMutations([
          ...current.filter((entry) => !matchesDreamTarget(getMutationDreamTarget(entry), getMutationDreamTarget(mutation))),
          ...(neverSentCreate ? [] : [mutation]),
        ]);
        return;
      }
      const existingIndex = mutation.operation === 'create'
        ? current.findIndex((entry) =>
            entry.operation === 'create' &&
            entry.userScope === mutation.userScope &&
            entry.clientRequestId === mutation.clientRequestId
          )
        : -1;
      if (existingIndex >= 0) {
        const existing = current[existingIndex];
        const retried = {
          ...mutation,
          // A server receipt refers to the original mutation ID even after retry.
          id: existing.id,
          createdAt: existing.createdAt,
          retryCount: existing.retryCount,
          lastAttemptAt: existing.lastAttemptAt ?? mutation.lastAttemptAt,
        };
        await persistPendingMutations(current.map((entry, index) =>
          index === existingIndex ? retried : entry
        ));
        return;
      }
      await persistPendingMutations([...current, mutation]);
    },
    [persistPendingMutations]
  );

  const queueOfflineOperation = useCallback(
    async (mutation: DreamMutation, updater: DreamListUpdater) => {
      await appendPendingMutation(normalizeMutation(mutation, userScope));
      await persistRemoteDreams(updater);
    },
    [appendPendingMutation, persistRemoteDreams, userScope]
  );

  const clearQueuedMutationsForDream = useCallback(
    async (dreamId: DreamTarget): Promise<boolean> => {
      if (typeof dreamId === 'number') {
        const keys = new Set(pendingMutationsRef.current.filter((entry) =>
          matchesDreamTarget(getMutationDreamTarget(entry), dreamId)
        ).map((entry) => getDreamIdentityKey(getMutationDreamTarget(entry))));
        if (keys.size > 1) throw new Error('Dream identity is ambiguous or missing');
      }
      const filtered = pendingMutationsRef.current.filter((mutation) => !matchesDreamTarget(getMutationDreamTarget(mutation), dreamId));
      const changed = filtered.length !== pendingMutationsRef.current.length;
      if (changed) {
        await persistPendingMutations(filtered);
      }
      return changed;
    },
    [persistPendingMutations]
  );

  const retryDreamMutations = useCallback(
    async (dreamId: DreamTarget): Promise<boolean> => {
      if (typeof dreamId === 'number') {
        const keys = new Set(pendingMutationsRef.current.filter((entry) =>
          matchesDreamTarget(getMutationDreamTarget(entry), dreamId)
        ).map((entry) => getDreamIdentityKey(getMutationDreamTarget(entry))));
        if (keys.size > 1) throw new Error('Dream identity is ambiguous or missing');
      }
      let matched = false;
      const nextQueue: DreamMutation[] = pendingMutationsRef.current.map((mutation) => {
        if (
          !matchesDreamTarget(getMutationDreamTarget(mutation), dreamId) ||
          !['pending', 'sending', 'failed'].includes(mutation.status)
        ) {
          return mutation;
        }

        matched = true;
        return {
          ...mutation,
          status: 'pending',
          lastError: undefined,
        };
      });

      if (!matched) {
        return false;
      }

      await persistPendingMutations(nextQueue);
      return true;
    },
    [persistPendingMutations]
  );

  const syncPendingMutations = useCallback(async function replayPendingMutations(): Promise<void> {
    if (!canUseRemoteSync || !user || !hasNetwork || activeUserScopeRef.current !== userScope) return;
    if (!pendingMutationsRef.current.length) return;

    if (inFlightSyncRef.current) {
      await inFlightSyncRef.current;
    }

    if (!mountedRef.current || syncingRef.current || activeUserScopeRef.current !== userScope) return;

    const eligibleMutations = pendingMutationsRef.current.filter((entry) => isRetryableMutation(entry) &&
      (!['delete', 'update'].includes(entry.operation) || getMutationRemoteId(entry) != null));
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

    let resolvedDependencies = false;
    const syncPromise = (async () => {
      const startedAt = Date.now();
      const sendingIds = new Set(eligibleMutations.map((mutation) => mutation.id));
      const sendingQueue = pendingMutationsRef.current.map((mutation) =>
        sendingIds.has(mutation.id) ? markMutationState(mutation, 'sending') : mutation
      );
      eligibleMutations.forEach((mutation) => {
        if (mutation.operation === 'create' && mutation.status === 'pending' &&
          mutation.lastAttemptAt == null && mutation.retryCount === 0) {
          preparingCreatesRef.current.add(mutation.id);
        }
      });
      let networkStarted = false;
      try {
        await persistPendingMutations(sendingQueue);
        if (!mountedRef.current || syncTokenRef.current !== currentToken || activeUserScopeRef.current !== userScope) return;
        // A deletion can cancel a never-sent create while its sending marker is being saved.
        const stillQueued = eligibleMutations.filter((mutation) =>
          pendingMutationsRef.current.some((entry) => entry.id === mutation.id));
        eligibleMutations.splice(0, eligibleMutations.length, ...stillQueued);
        if (!eligibleMutations.length) return;
        preparingCreatesRef.current.clear();
        networkStarted = true;
        const canUseBatchSync = userScope && typeof syncDreamMutationsInSupabase === 'function';
        const results = canUseBatchSync
          ? await syncDreamMutationsInSupabase(eligibleMutations, user.id)
          : await (async (): Promise<SyncMutationResult[]> => {
              const legacyResults: SyncMutationResult[] = [];
              const workingMutations = eligibleMutations.map((mutation) => normalizeMutation(mutation, userScope));

              for (let index = 0; index < workingMutations.length; index += 1) {
                if (!mountedRef.current || syncTokenRef.current !== currentToken || activeUserScopeRef.current !== userScope) return legacyResults;
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
                    const sameDream = matchesDreamTarget(getMutationDreamTarget(entry), getMutationDreamTarget(mutation));
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
        const buildNextQueue = () => pendingMutationsRef.current
          .map((mutation) => {
            const result = resultsById.get(mutation.id);
            if (!result) {
              const receipt = results.find((entry) => entry.status === 'ack' && entry.remoteId != null &&
                eligibleMutations.some((sent) => sent.id === entry.mutationId &&
                  sent.operation === 'create' && matchesDreamTarget(getMutationDreamTarget(sent), getMutationDreamTarget(mutation))));
              if (!receipt || getMutationRemoteId(mutation) != null) return mutation;
              resolvedDependencies = true;
              return {
                ...mutation,
                baseRevision: receipt.dream?.revisionId,
                payload: {
                  ...mutation.payload,
                  remoteId: receipt.remoteId,
                  ...(mutation.payload.dream ? { dream: { ...mutation.payload.dream, remoteId: receipt.remoteId, revisionId: receipt.dream?.revisionId } } : {}),
                },
              };
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
            if (!mutation || !pendingMutationsRef.current.some((entry) => entry.id === mutation.id)) {
              return;
            }

            if (result.status === 'ack') {
              const currentIndex = pendingMutationsRef.current.findIndex((entry) => entry.id === mutation.id);
              const laterMutation = pendingMutationsRef.current.slice(currentIndex + 1).filter((entry) =>
                matchesDreamTarget(getMutationDreamTarget(entry), getMutationDreamTarget(mutation))).at(-1);
              if (laterMutation?.operation === 'delete') return;
              if (laterMutation?.payload.dream && result.remoteId != null) {
                nextDreams = upsertDream(nextDreams, {
                  ...laterMutation.payload.dream,
                  remoteId: result.remoteId,
                  revisionId: result.dream?.revisionId,
                });
              } else {
                nextDreams = applyAckedMutation(nextDreams, mutation, result);
              }
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

        const nextQueue = buildNextQueue();
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
        if (!mountedRef.current || syncTokenRef.current !== currentToken) {
          return;
        }
        logger.warn('Failed to sync offline mutations', error);
        const message = error instanceof Error ? error.message : 'Failed to sync mutation batch';
        const buildNextQueue = () => pendingMutationsRef.current.map((mutation) => {
          if (!sendingIds.has(mutation.id)) {
            return mutation;
          }
          if (!networkStarted) {
            const original = eligibleMutations.find((entry) => entry.id === mutation.id);
            if (original) return original;
          }
          return markMutationState(mutation, 'failed', {
            lastError: message,
            retryCount: mutation.retryCount + 1,
          });
        });

        await persistRemoteDreams((prev) => {
          let nextDreams = prev;
          eligibleMutations.forEach((mutation) => {
            if (!pendingMutationsRef.current.some((entry) => entry.id === mutation.id)) return;
            nextDreams = applyFailedMutation(nextDreams, mutation, 'failed', message);
          });
          return nextDreams;
        });

        const nextQueue = buildNextQueue();
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
          preparingCreatesRef.current.clear();
          syncingRef.current = false;
          inFlightSyncRef.current = null;
        }
      }
    })();

    inFlightSyncRef.current = syncPromise;
    await syncPromise;
    if (resolvedDependencies && mountedRef.current && activeUserScopeRef.current === userScope) {
      await replayPendingMutations();
    }
  }, [canUseRemoteSync, hasNetwork, persistPendingMutations, persistRemoteDreams, user, userScope]);

  useEffect(() => {
    const resolveDependencies = () => {
      if (activeUserScopeRef.current !== userScope || !remoteSnapshot || remoteSnapshot.userScope !== userScope || !initialSnapshotMatchesScope) return;
      let changed = false;
      const resolved = pendingMutationsRef.current.map((mutation) => {
        if (!['delete', 'update'].includes(mutation.operation) || getMutationRemoteId(mutation) != null) return mutation;
        const tombstone = mutation.payload.tombstone ?? mutation.payload.dream;
        if (!tombstone) return mutation;
        const clientId = tombstone.clientRequestId ?? `dream-${tombstone.id}`;
        const remote = remoteSnapshot.dreams.find((dream) => dream.clientRequestId === clientId);
        if (remote?.remoteId == null) return mutation;
        changed = true;
        return {
          ...mutation,
          status: 'pending' as const,
          lastError: undefined,
          baseRevision: remote.revisionId,
          payload: {
            ...mutation.payload,
            remoteId: remote.remoteId,
            ...(mutation.payload.dream ? { dream: { ...mutation.payload.dream, remoteId: remote.remoteId, revisionId: remote.revisionId } } : {}),
          },
        };
      });
      if (!changed) return;
      // Make the resolved identity durable before allowing normal queue replay.
      void persistPendingMutations(resolved).then(() => {
        if (mountedRef.current && activeUserScopeRef.current === userScope) return syncPendingMutations();
      }).catch(() => logger.warn('Pending deletion identity could not be persisted'));
    };
    resolveSnapshotDependenciesRef.current = resolveDependencies;
    resolveDependencies();
    return () => { resolveSnapshotDependenciesRef.current = null; };
  }, [initialSnapshotMatchesScope, persistPendingMutations, remoteSnapshot, syncPendingMutations, userScope]);

  useEffect(() => {
    void syncPendingMutations().catch(() => {
      logger.warn('Offline dream sync could not complete');
    });
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
