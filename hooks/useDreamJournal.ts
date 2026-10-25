import { markPerformance, performanceTraceId } from '../lib/performanceTrace';
import { mergeServerDreamWithLocalState } from '@/lib/journalQueueTransitions';
import { type DreamTarget, matchesDreamTarget, resolveDreamTarget, getDreamIdentityKey } from '../lib/dreamIdentity';
/**
 * useDreamJournal - Main hook for dream journal operations
 *
 * This hook composes:
 * - useDreamPersistence: Storage and loading of dreams
 * - useOfflineSyncQueue: Offline mutation queue and sync
 *
 * And provides high-level CRUD operations for dreams.
 */

import { useNetworkState } from 'expo-network';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { GUEST_DREAM_RECORDING_LIMIT } from '@/constants/limits';
import { useSubscription } from '@/hooks/useSubscription';
import {
  getDurationMsBucket,
  trackProductEvent,
  type AnalysisSource,
} from '@/lib/analytics';
import { isResumableAnalysisRequest } from '@/lib/analysisRequest';
import { keepsDreamName } from '@/lib/dreamNaming';
import { DreamPersistenceError, requireReadableDreams } from '@/lib/dreamStorageRead';
import { IncompleteJournalAckError } from '@/lib/journalErrors';
import {
  getAnalysisJobPollDelay,
  MAX_ANALYSIS_JOB_POLL_ATTEMPTS,
} from '@/lib/analysisJobPolling';
import { getDeviceFingerprint } from '@/lib/deviceFingerprint';
import { isAnalysisJobsEnabled, isMockModeEnabled } from '@/lib/env';
import { deriveUserTier } from '@/lib/quotaTier';
import {
  areDreamsEqualForLocalState,
  areDreamsEqualForRemoteSync,
  applyDreamUpdateIntent,
  buildDreamMutationEntityKey,
  clearDreamConflict,
  createDreamUpdateIntent,
  createDreamMutation,
  generateMutationId,
  generateUUID,
  getDreamSyncState,
  getMutationDreamTarget,
  hasDreamUpdateIntentConflict,
  isConflictError,
  mergeAuthoritativeDreamIdentity,
  normalizeDreamImages,
  removeDream,
  setDreamSyncState,
  upsertDream,
} from '@/lib/dreamUtils';
import { stampDreamAnalysisTranscript } from '@/lib/dreamAnalysisFreshness';
import { collectKnownSymbols } from '@/lib/symbolLinks';
import { AiConsentWithdrawnError, coerceQuotaError, GuestDreamLimitError, QuotaError, QuotaErrorCode } from '@/lib/errors';
import { getThumbnailUrl } from '@/lib/imageUtils';
import { getImageJobPollDelay } from '@/lib/imageJobPolling';
import { logger } from '@/lib/logger';
import type {
  DreamAnalysis,
  DreamCategorization,
  DreamMutation,
  PendingImageJob,
} from '@/lib/types';
import { AnalysisStep } from '@/hooks/useAnalysisProgress';
import {
  analyzeDream as analyzeDreamText,
  getDreamAnalysisJobStatus,
  getImageGenerationJobStatus,
  submitDreamAnalysisJob,
  submitImageGenerationJob,
} from '@/services/geminiService';
import {
  incrementLocalAnalysisCount,
  incrementLocalImageCount,
  syncWithServerCount,
} from '@/services/quota/GuestAnalysisCounter';
import {
  commitGuestDreamRecording,
  preserveGuestDreamRecordingCountBeforeDeletion,
  reconcilePendingGuestDreamRecording,
  reserveGuestDreamRecording,
  withGuestDreamRecordingLock,
} from '@/services/quota/GuestDreamCounter';
import { markMockAnalysis, markMockImage } from '@/services/quota/MockQuotaEventStore';
import { quotaService } from '@/services/quotaService';
import {
  getPendingImageJobs,
  getSavedDreams,
  savePendingImageJobs,
} from '@/services/storageService';
import {
  deleteDreamFromSupabase,
  fetchDreamFromSupabase,
  fetchDreamByClientRequestId,
  updateDreamInSupabase,
} from '@/services/supabaseDreamService';

import { useDreamPersistence } from './useDreamPersistence';
import { useOfflineSyncQueue } from './useOfflineSyncQueue';

const isActiveImageJobStatus = (
  status: DreamAnalysis['imageJobStatus'] | 'succeeded' | 'failed' | undefined
): status is 'queued' | 'running' => status === 'queued' || status === 'running';

const waitForPollDelay = (delayMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, delayMs));

export const useDreamJournal = () => {
  const { user } = useAuth();
  const { status: subscriptionStatus } = useSubscription();
  const isAuthenticated = Boolean(user);
  const isMockMode = isMockModeEnabled();
  const canUseRemoteSync = isAuthenticated && !isMockMode;
  const userScope = user?.id ? `user:${user.id}` : null;
  const analysisScopeRef = useRef(userScope);
  const analysisEpochRef = useRef(0);
  useLayoutEffect(() => {
    analysisScopeRef.current = userScope;
    analysisEpochRef.current += 1;
  }, [userScope]);
  const supabaseTier = useMemo(() => deriveUserTier(user), [user]);
  const tier = useMemo(
    () => {
      if (!user) return 'guest';

      // If Supabase already marks the user as paid, treat them as paid immediately.
      // RevenueCat still overrides once it resolves.
      const optimisticPaidTier = supabaseTier === 'plus' ? supabaseTier : null;

      return subscriptionStatus?.tier ?? optimisticPaidTier ?? 'free';
    },
    [subscriptionStatus?.tier, supabaseTier, user]
  );

  const networkState = useNetworkState();
  const hasNetwork = useMemo(() => {
    if (networkState.isInternetReachable != null) {
      return networkState.isInternetReachable;
    }
    if (networkState.isConnected != null) {
      return networkState.isConnected;
    }
    return true;
  }, [networkState.isConnected, networkState.isInternetReachable]);
  const [isAppActive, setIsAppActive] = useState(
    AppState.currentState !== 'background' && AppState.currentState !== 'inactive'
  );
  const isAppActiveRef = useRef(isAppActive);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const active = state === 'active';
      isAppActiveRef.current = active;
      setIsAppActive(active);
    });
    return () => subscription.remove();
  }, []);

  // Use extracted persistence hook
  const {
    dreams,
    loaded,
    dreamsRef,
    persistLocalDreams,
    persistRemoteDreams,
    persistMigrationResolution,
    pendingMutations,
    pendingMutationsLoaded,
    pendingMutationsScope,
    persistenceState,
    refreshState,
    completeness,
    remotePreviewAllowed,
    remoteSnapshot,
    reloadDreams,
    retryPersistence,
  } = useDreamPersistence({ canUseRemoteSync });

  /**
   * Resolve remoteId from local dreamId
   */
  const resolveRemoteId = useCallback((dreamId: DreamTarget): number | undefined => {
    const target = resolveDreamTarget(dreamsRef.current, dreamId);
    return target?.remoteId;
  }, [dreamsRef]);

  // Use extracted offline sync queue hook
  const {
    pendingMutationsRef: livePendingMutationsRef,
    queueOfflineOperation,
    clearQueuedMutationsForDream,
    retryDreamMutations,
    syncPendingMutations,
  } = useOfflineSyncQueue({
    canUseRemoteSync,
    hasNetwork,
    userScope,
    persistRemoteDreams,
    resolveRemoteId,
    remoteSnapshot,
    initialMutations: pendingMutations,
    initialMutationsLoaded: pendingMutationsLoaded,
    initialMutationsScope: pendingMutationsScope,
  });

  const pendingImageJobsRef = useRef<PendingImageJob[]>([]);
  const imageJobPollAttemptRef = useRef(0);
  const [pendingImageJobsVersion, setPendingImageJobsVersion] = useState(0);
  const analysisStatusOverridesRef = useRef<Map<string, DreamAnalysis['analysisStatus']>>(new Map());
  const analysisRequestIdsRef = useRef<Map<string, string>>(new Map());
  const dreamWriteChainsRef = useRef<Map<string, Promise<void>>>(new Map());
  // In-memory only: lets screens outside recording surface an in-flight
  // analysis (and its outcome) without reading persisted dream state.
  const [activeAnalysis, setActiveAnalysis] = useState<{ dreamId: number } | null>(null);
  const [lastAnalysisOutcome, setLastAnalysisOutcome] = useState<{
    dreamId: number;
    status: 'done' | 'failed';
    completedAt: number;
  } | null>(null);

  useEffect(() => {
    analysisRequestIdsRef.current.clear();
  }, [userScope]);

  const persistPendingImageJobState = useCallback(async (jobs: PendingImageJob[]) => {
    pendingImageJobsRef.current = jobs;
    if (jobs.length === 0) {
      imageJobPollAttemptRef.current = 0;
    }
    await savePendingImageJobs(jobs);
    setPendingImageJobsVersion((version) => version + 1);
  }, []);

  const persistDreamClientState = useCallback(
    async (dream: DreamAnalysis) => {
      const normalizedDream = normalizeDreamImages(dream);
      if (canUseRemoteSync) {
        await persistRemoteDreams((prev) => upsertDream(prev, normalizedDream));
        return;
      }
      await persistLocalDreams(upsertDream(dreamsRef.current, normalizedDream));
    },
    [canUseRemoteSync, dreamsRef, persistLocalDreams, persistRemoteDreams]
  );

  const resolveCurrentDream = useCallback(
    (dream: DreamAnalysis): DreamAnalysis =>
      resolveDreamTarget(dreamsRef.current, dream) ?? dream,
    [dreamsRef]
  );

  const runSerializedDreamWrite = useCallback(
    async <T,>(entityKey: string, task: () => Promise<T>): Promise<T> => {
      const previous = dreamWriteChainsRef.current.get(entityKey) ?? Promise.resolve();
      const result = previous.catch(() => undefined).then(task);
      const tail = result.then(
        () => undefined,
        () => undefined
      );

      dreamWriteChainsRef.current.set(entityKey, tail);
      try {
        return await result;
      } finally {
        if (dreamWriteChainsRef.current.get(entityKey) === tail) {
          dreamWriteChainsRef.current.delete(entityKey);
        }
      }
    },
    []
  );

  const applyServerDreamState = useCallback(
    async (dream: DreamAnalysis): Promise<void> => {
      await persistDreamClientState({
        ...resolveCurrentDream(dream),
        ...dream,
      });
    },
    [persistDreamClientState, resolveCurrentDream]
  );

  const previewScopeRef = useRef({ userId: user?.id, allowed: remotePreviewAllowed });
  useLayoutEffect(() => {
    previewScopeRef.current = { userId: user?.id, allowed: remotePreviewAllowed };
    return () => { previewScopeRef.current = { userId: undefined, allowed: false }; };
  }, [remotePreviewAllowed, user?.id]);

  const loadRemoteDreamForPreview = useCallback(async (remoteId: number): Promise<DreamAnalysis> => {
    const owner = user?.id;
    const scopeIsCurrent = () => owner && previewScopeRef.current.userId === owner &&
      livePendingMutationsRef.current.length === 0;
    if (!scopeIsCurrent() || !previewScopeRef.current.allowed) {
      throw new Error('Journal preview is no longer available');
    }
    const detail = await fetchDreamFromSupabase(remoteId, owner);
    if (!scopeIsCurrent()) throw new Error('Journal preview scope changed');
    // A complete refresh may finish while the detail is in flight. Prefer its
    // accepted row, never overwrite a newer snapshot with this earlier read.
    const existing = dreamsRef.current.find((dream) => dream.remoteId === remoteId);
    if (existing) return existing;
    if (!previewScopeRef.current.allowed) throw new Error('Journal preview was invalidated');
    await persistDreamClientState(detail);
    if (previewScopeRef.current.userId !== owner) throw new Error('Journal preview scope changed');
    return detail;
  }, [dreamsRef, livePendingMutationsRef, persistDreamClientState, user?.id]);

  const hydratePendingImageJobs = useCallback(async () => {
    const jobs = await getPendingImageJobs();
    pendingImageJobsRef.current = jobs;
    setPendingImageJobsVersion((version) => version + 1);

    if (!jobs.length || !dreamsRef.current.length) {
      return;
    }

    const applyJobs = (list: DreamAnalysis[]) => {
      const jobsByDream = new Map<DreamAnalysis, PendingImageJob>();
      jobs.forEach((job) => {
        const selected = resolveDreamTarget(list, job.remoteDreamId != null
          ? { id: job.dreamId, remoteId: job.remoteDreamId } : job.dreamId);
        if (selected) jobsByDream.set(selected, job);
      });
      return list.map((dream) => {
        const pendingJob = jobsByDream.get(dream);
        if (!pendingJob) {
          return dream;
        }
        return {
          ...dream,
          imageJobId: pendingJob.jobId,
          imageJobStatus: pendingJob.status,
          imageJobRequestId: pendingJob.clientRequestId,
        };
      });
    };

    if (canUseRemoteSync) {
      await persistRemoteDreams(applyJobs);
    } else {
      await persistLocalDreams(applyJobs(dreamsRef.current));
    }
  }, [canUseRemoteSync, dreamsRef, persistLocalDreams, persistRemoteDreams]);

  const removePendingImageJob = useCallback(
    async (jobId: string) => {
      const remainingJobs = pendingImageJobsRef.current.filter((job) => job.jobId !== jobId);
      await persistPendingImageJobState(remainingJobs);
    },
    [persistPendingImageJobState]
  );

  const clearPendingImageJobsForDream = useCallback(
    async (target: DreamTarget) => {
      const remainingJobs = pendingImageJobsRef.current.filter((job) => {
        if (job.remoteDreamId != null) return !matchesDreamTarget({ id: job.dreamId, remoteId: job.remoteDreamId }, target);
        const selected = resolveDreamTarget(dreamsRef.current, job.dreamId);
        return !selected || !matchesDreamTarget(selected, target);
      });
      if (remainingJobs.length !== pendingImageJobsRef.current.length) {
        await persistPendingImageJobState(remainingJobs);
      }
    },
    [dreamsRef, persistPendingImageJobState]
  );

  const registerPendingImageJob = useCallback(
    async (
      dream: DreamAnalysis,
      job: { jobId: string; clientRequestId: string; status: 'queued' | 'running' }
    ) => {
      imageJobPollAttemptRef.current = 0;
      const nextJobs = [
        {
          dreamId: dream.id,
          remoteDreamId: dream.remoteId,
          jobId: job.jobId,
          clientRequestId: job.clientRequestId,
          status: job.status,
          requestedAt: Date.now(),
        },
        ...pendingImageJobsRef.current.filter(
          (entry) => entry.jobId !== job.jobId && !(entry.remoteDreamId != null
            ? matchesDreamTarget({ id: entry.dreamId, remoteId: entry.remoteDreamId }, dream)
            : resolveDreamTarget(dreamsRef.current, entry.dreamId) === dream)
        ),
      ];

      await persistPendingImageJobState(nextJobs);
      const latestDream = resolveCurrentDream(dream);
      const nextDream: DreamAnalysis = {
        ...latestDream,
        analysisStatus:
          analysisStatusOverridesRef.current.get(getDreamIdentityKey(dream)) ?? latestDream.analysisStatus,
        imageGenerationFailed: false,
        imageJobId: job.jobId,
        imageJobStatus: job.status,
        imageJobRequestId: job.clientRequestId,
        imageJobErrorCode: undefined,
        imageJobErrorMessage: undefined,
      };
      await persistDreamClientState(nextDream);
      return nextDream;
    },
    [dreamsRef, persistDreamClientState, persistPendingImageJobState, resolveCurrentDream]
  );

  const submitImageJobForDream = useCallback(
    async (
      dream: DreamAnalysis,
      request: {
        clientRequestId?: string;
        prompt?: string;
        transcript?: string;
        previousImageUrl?: string;
      }
    ) => {
      const latestDream = resolveCurrentDream(dream);
      const clientRequestId = request.clientRequestId ?? generateUUID();
      const job = await submitImageGenerationJob({
        clientRequestId,
        dreamId: latestDream.remoteId,
        prompt: request.prompt,
        transcript: request.transcript,
        previousImageUrl: request.previousImageUrl,
      });

      const currentDream = resolveCurrentDream(latestDream);
      const nextDream = await registerPendingImageJob(currentDream, {
        jobId: job.jobId,
        clientRequestId: job.clientRequestId,
        status: job.status === 'running' ? 'running' : 'queued',
      });

      return {
        dream: nextDream,
        job,
      };
    },
    [registerPendingImageJob, resolveCurrentDream]
  );

  const waitForAnalysisJob = useCallback(async (jobId: string) => {
    for (let attempt = 0; attempt < MAX_ANALYSIS_JOB_POLL_ATTEMPTS; attempt += 1) {
      if (attempt > 0) {
        await waitForPollDelay(getAnalysisJobPollDelay(attempt - 1));
      }

      // Avoid spending radio/battery while backgrounded. The server-owned job
      // keeps running and the same idempotency key can resume observation.
      // Stop this foreground wait immediately instead of consuming poll slots
      // on timers that cannot issue a useful status request.
      if (!isAppActiveRef.current) {
        return null;
      }

      const status = await getDreamAnalysisJobStatus(jobId);
      if (status.status === 'succeeded' || status.status === 'failed') {
        return status;
      }
    }

    return null;
  }, []);

  const markDreamConflict = useCallback(
    async (dream: DreamAnalysis, remoteDream?: DreamAnalysis, message?: string) => {
      const conflicted = setDreamSyncState(
        {
          ...dream,
          conflictRemoteDream: remoteDream,
        },
        'conflict',
        {
          lastSyncError: message ?? 'A newer server revision exists for this dream.',
          conflictRemoteDream: remoteDream,
        }
      );

      await persistRemoteDreams((prev) => upsertDream(prev, conflicted));
    },
    [persistRemoteDreams]
  );

  const buildQueuedMutation = useCallback(
    (
      operation: DreamMutation['operation'],
      dream: DreamAnalysis,
      extras?: { tombstone?: DreamAnalysis; remoteId?: number; dreamId?: number }
    ): DreamMutation =>
      createDreamMutation({
        id: generateMutationId(),
        userScope: userScope ?? 'user:unknown',
        entityType: 'dream',
        entityKey: buildDreamMutationEntityKey(dream),
        operation,
        clientRequestId:
          operation === 'create'
            ? dream.clientRequestId ?? generateUUID()
            : generateUUID(),
        baseRevision: dream.revisionId,
        clientUpdatedAt: dream.clientUpdatedAt ?? Date.now(),
        payload: {
          ...(operation === 'delete'
            ? {
                dreamId: extras?.dreamId ?? dream.id,
                remoteId: extras?.remoteId ?? dream.remoteId,
                tombstone: extras?.tombstone ?? dream,
              }
            : {
                dream,
              }),
        },
        status: 'pending',
        retryCount: 0,
        createdAt: Date.now(),
      }),
    [userScope]
  );

  /**
   * Add a new dream
   */
  const addDream = useCallback(
    async (dream: DreamAnalysis): Promise<DreamAnalysis> => {
      const clientRequestId = dream.clientRequestId ?? generateUUID();
      const normalizedDream = normalizeDreamImages({
        ...dream,
        clientRequestId,
        clientUpdatedAt: dream.clientUpdatedAt ?? Date.now(),
      });

      if (!canUseRemoteSync) {
        if (!user) {
          return withGuestDreamRecordingLock(async () => {
            const currentDreams = dreamsRef.current;
            const alreadyExists = currentDreams.some((existing) => matchesDreamTarget(existing, normalizedDream));
            if (alreadyExists) {
              await persistLocalDreams(upsertDream(currentDreams, normalizedDream));
              return normalizedDream;
            }

            const reloadConfirmedDream = async () => {
              await reloadDreams();
              if (!dreamsRef.current.some((existing) => matchesDreamTarget(existing, normalizedDream))) {
                throw new DreamPersistenceError('read', 'device');
              }
              return normalizedDream;
            };

            // A prior write may have succeeded even if its acknowledgement or
            // the subsequent reload failed. Retry that identity without a new slot.
            let durableDreams: DreamAnalysis[];
            try {
              durableDreams = requireReadableDreams(await getSavedDreams());
            } catch {
              throw new DreamPersistenceError('read', 'device');
            }
            if (durableDreams.some((existing) => matchesDreamTarget(existing, normalizedDream))) {
              return reloadConfirmedDream();
            }

            try {
              await reserveGuestDreamRecording(
                normalizedDream,
                Math.max(dreamsRef.current.length, durableDreams.length),
                GUEST_DREAM_RECORDING_LIMIT
              );
            } catch (error) {
              if (error instanceof GuestDreamLimitError) throw error;
              throw new DreamPersistenceError('write', 'device');
            }

            let confirmedAfterWriteFailure = false;
            try {
              // Other journal writes can finish while the reservation is saved.
              await persistLocalDreams(upsertDream(dreamsRef.current, normalizedDream), {
                publishAfterWrite: true,
                discardFailedWrite: true,
                pendingDream: normalizedDream,
                onPendingWriteFailure: async () => {
                  let outcome: 'saved' | 'absent' | 'none' = 'none';
                  try {
                    outcome = await reconcilePendingGuestDreamRecording();
                  } catch (reconcileError) {
                    logger.warn('Could not reconcile guest recording reservation', reconcileError);
                    return 'unknown';
                  }
                  if (outcome !== 'saved') return outcome === 'absent' ? 'absent' : 'unknown';
                  await reloadConfirmedDream();
                  confirmedAfterWriteFailure = true;
                  return 'saved';
                },
              });
            } catch (error) {
              if (confirmedAfterWriteFailure) return normalizedDream;
              throw error;
            }

            try {
              await commitGuestDreamRecording(normalizedDream);
            } catch (error) {
              // The durable journal still proves this slot was spent. A later
              // quota read or deletion will finish the pending reservation.
              logger.warn('Could not finalize guest recording reservation', error);
            }
            return normalizedDream;
          });
        }

        const currentDreams = dreamsRef.current;
        await persistLocalDreams(upsertDream(currentDreams, normalizedDream));
        return normalizedDream;
      }

      const queueAndPersist = async () => {
        const queuedDream = setDreamSyncState(normalizedDream, 'pending', {
          lastSyncError: undefined,
          conflictRemoteDream: undefined,
        });
        await queueOfflineOperation(
          buildQueuedMutation('create', queuedDream),
          (prev) => upsertDream(prev, queuedDream)
        );
        return queuedDream;
      };

      const queuedDream = await queueAndPersist();
      void syncPendingMutations({ refreshNetworkState: !hasNetwork }).catch((error) => {
        logger.warn('Background dream creation sync failed', error);
      });
      return queuedDream;
    },
    [
      buildQueuedMutation,
      canUseRemoteSync,
      dreamsRef,
      hasNetwork,
      persistLocalDreams,
      queueOfflineOperation,
      reloadDreams,
      syncPendingMutations,
      user,
    ]
  );

  /**
   * Update an existing dream
   */
  const updateDreamFromBase = useCallback(
    async (baseDream: DreamAnalysis, updatedDream: DreamAnalysis, priorTarget?: DreamTarget) => {
      const applyCandidate = (list: DreamAnalysis[], next: DreamAnalysis): DreamAnalysis[] => {
        if (priorTarget === undefined) return upsertDream(list, next);
        const prior = resolveDreamTarget(list, priorTarget);
        if (prior) return list.map((entry) => entry === prior ? next : entry);
        const promoted = resolveDreamTarget(list, next);
        if (!promoted) throw new Error('Dream identity is ambiguous or missing');
        return upsertDream(list, next);
      };
      const normalizedRequestedDream = normalizeDreamImages({
        ...(getDreamSyncState(updatedDream) === 'conflict' ? clearDreamConflict(updatedDream) : updatedDream),
        clientUpdatedAt: updatedDream.clientUpdatedAt ?? Date.now(),
      });

      if (areDreamsEqualForLocalState(baseDream, normalizedRequestedDream)) {
        return;
      }

      const intent = createDreamUpdateIntent(baseDream, normalizedRequestedDream);
      const hasRemoteChanges = !areDreamsEqualForRemoteSync(
        baseDream,
        normalizedRequestedDream
      );
      const entityKey = buildDreamMutationEntityKey(baseDream);

      await runSerializedDreamWrite(entityKey, async () => {
        if (priorTarget !== undefined && !resolveDreamTarget(dreamsRef.current, priorTarget)) {
          throw new Error('Dream identity is ambiguous or missing');
        }
        const buildCandidate = (latestDream: DreamAnalysis) => {
          const rebasedDream = applyDreamUpdateIntent(
            getDreamSyncState(latestDream) === 'conflict'
              ? clearDreamConflict(latestDream)
              : latestDream,
            intent
          );
          const withIdentity = mergeAuthoritativeDreamIdentity(
            rebasedDream,
            normalizedRequestedDream
          );
          const adoptedServerIdentity =
            rebasedDream.remoteId == null && withIdentity.remoteId != null;
          const candidate = adoptedServerIdentity
            ? setDreamSyncState(withIdentity, 'clean', {
                lastSyncedAt: normalizedRequestedDream.lastSyncedAt ?? Date.now(),
                lastSyncError: undefined,
                conflictRemoteDream: undefined,
              })
            : withIdentity;

          return normalizeDreamImages({
            ...candidate,
            clientUpdatedAt: Math.max(
              latestDream.clientUpdatedAt ?? 0,
              normalizedRequestedDream.clientUpdatedAt ?? 0
            ),
          });
        };

        let candidate = buildCandidate(resolveCurrentDream(baseDream));

        if (!canUseRemoteSync) {
          await persistLocalDreams(
            applyCandidate(dreamsRef.current, candidate)
          );
          return;
        }

        if (candidate.migrationRecovery) {
          const latest = resolveCurrentDream(baseDream);
          candidate = { ...candidate, migrationRecovery: { ...candidate.migrationRecovery,
            localChanges: candidate.migrationRecovery.localChanges || hasRemoteChanges,
          } };
          const retained = getDreamSyncState(latest) === 'conflict'
            ? setDreamSyncState(candidate, 'conflict', { lastSyncError: latest.lastSyncError, conflictRemoteDream: latest.conflictRemoteDream })
            : setDreamSyncState(candidate, 'pending');
          await persistMigrationResolution(latest, retained);
          if (hasNetwork && getDreamSyncState(retained) !== 'conflict') await reloadDreams();
          return;
        }

        const queueAndPersist = async (pendingVersion: DreamAnalysis) => {
          await queueOfflineOperation(
            buildQueuedMutation('update', pendingVersion),
            (prev) => applyCandidate(prev, normalizeDreamImages(pendingVersion))
          );
        };

        if (!hasRemoteChanges) {
          await persistRemoteDreams((prev) => applyCandidate(prev, candidate));
          return;
        }

        const remoteId = candidate.remoteId ?? resolveRemoteId(candidate);
        if (!remoteId || !hasNetwork) {
          const pendingVersion = setDreamSyncState({ ...candidate, remoteId }, 'pending', {
            lastSyncError: undefined,
            conflictRemoteDream: undefined,
          });
          await queueAndPersist(pendingVersion);
          if (!hasNetwork) {
            void syncPendingMutations({ refreshNetworkState: true }).catch((error) => {
              logger.warn('Background dream update sync failed', error);
            });
          }
          return;
        }

        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const saved = await updateDreamInSupabase({ ...candidate, remoteId });
            const merged = mergeServerDreamWithLocalState(saved, candidate);
            await persistRemoteDreams((prev) => applyCandidate(prev, merged));
            return;
          } catch (error) {
            const canSafelyRebase =
              attempt === 0 &&
              isConflictError(error) &&
              error.remoteDream != null &&
              !hasDreamUpdateIntentConflict(baseDream, error.remoteDream, intent);

            if (canSafelyRebase && isConflictError(error) && error.remoteDream) {
              const latestRemote = mergeServerDreamWithLocalState(
                error.remoteDream,
                resolveCurrentDream(candidate)
              );
              candidate = buildCandidate(latestRemote);
              if (areDreamsEqualForRemoteSync(error.remoteDream, candidate)) {
                await persistRemoteDreams((prev) => applyCandidate(prev, candidate));
                return;
              }
              continue;
            }

            if (isConflictError(error)) {
              await markDreamConflict(candidate, error.remoteDream, error.message);
              return;
            }

            const quotaError = coerceQuotaError(error, tier);
            if (quotaError) {
              throw quotaError;
            }
            logger.warn('Falling back to offline dream update', error);
            // The direct online write can already have advanced the server revision
            // while its old schema omitted notes. Queue the same local writing against
            // that acknowledged revision, with buildQueuedMutation's fresh receipt.
            const incompleteAck = error instanceof IncompleteJournalAckError && error.identity.remoteId === remoteId
              ? error.identity : undefined;
            const pendingVersion = setDreamSyncState({ ...candidate, remoteId,
              ...(incompleteAck ? { revisionId: incompleteAck.revisionId } : {}),
            }, 'pending', {
              lastSyncError: undefined,
              conflictRemoteDream: undefined,
            });
            await queueAndPersist(pendingVersion);
            return;
          }
        }
      });
    },
    [
      buildQueuedMutation,
      canUseRemoteSync,
      dreamsRef,
      hasNetwork,
      markDreamConflict,
      persistLocalDreams,
      persistRemoteDreams,
      persistMigrationResolution,
      reloadDreams,
      queueOfflineOperation,
      resolveRemoteId,
      resolveCurrentDream,
      runSerializedDreamWrite,
      syncPendingMutations,
      tier,
    ]
  );

  const updateDream = useCallback(
    async (updatedDream: DreamAnalysis, priorTarget?: DreamTarget) => {
      if (priorTarget !== undefined) {
        const prior = resolveDreamTarget(dreamsRef.current, priorTarget);
        if (!prior || (prior.remoteId != null && prior.remoteId !== updatedDream.remoteId) ||
          (prior.clientRequestId && prior.clientRequestId !== updatedDream.clientRequestId)) {
          throw new Error('Dream identity is ambiguous or missing');
        }
        await updateDreamFromBase(prior, updatedDream, prior);
        return;
      }
      const current = resolveDreamTarget(dreamsRef.current, updatedDream);
      if (!current) throw new Error('Dream identity is ambiguous or missing');
      await updateDreamFromBase(current, updatedDream);
    },
    [dreamsRef, updateDreamFromBase]
  );

  /**
   * Apply optional quick categorization against the latest dream revision.
   * A late enrichment must never overwrite an analysis that has started or
   * completed since the dream was first saved.
   */
  const applyDreamCategorization = useCallback(
    async (target: DreamTarget, categorization: DreamCategorization): Promise<DreamAnalysis | null> => {
      const currentDream = resolveDreamTarget(dreamsRef.current, target);
      if (!currentDream) {
        return null;
      }

      if (
        currentDream.isAnalyzed
        || currentDream.analysisStatus === 'pending'
        || currentDream.analysisStatus === 'done'
      ) {
        return currentDream;
      }

      const enrichedDream: DreamAnalysis = {
        ...currentDream,
        // A dream keeps the name its pre-analysis gave it on arrival; first words only stand in.
        title: keepsDreamName(currentDream) ? currentDream.title : categorization.title,
        theme: categorization.theme,
        dreamType: currentDream.memory?.origin === 'remembered'
          ? currentDream.dreamType
          : categorization.dreamType,
        hasPerson: categorization.hasPerson,
        hasAnimal: categorization.hasAnimal,
        clientUpdatedAt: Date.now(),
      };

      await updateDream(enrichedDream);
      return enrichedDream;
    },
    [dreamsRef, updateDream]
  );

  /**
   * Delete a dream
   */
  const deleteDream = useCallback(
    async (target: DreamTarget) => {
      if (!canUseRemoteSync) {
        await withGuestDreamRecordingLock(async () => {
          const currentDreams = dreamsRef.current;
          const existing = resolveDreamTarget(currentDreams, target);
          if (!existing) throw new Error('Dream identity is ambiguous or missing');
          // A failed startup migration may have left a legacy counter behind
          // the durable journal. Preserve that evidence before removing it.
          await preserveGuestDreamRecordingCountBeforeDeletion(currentDreams.length);
          // If finalizing the save previously failed, commit its slot before
          // removing the only durable evidence that it was spent.
          await commitGuestDreamRecording(existing);
          await persistLocalDreams(removeDream(currentDreams, existing));
          await clearPendingImageJobsForDream(target);
        });
        return;
      }

      const dreamId = typeof target === 'number' ? target : target.id;
      const currentDreams = dreamsRef.current;
      const existing = resolveDreamTarget(currentDreams, target);

      if (!existing) throw new Error('Dream identity is ambiguous or missing');

      if (existing.migrationRecovery) {
        const deleting = setDreamSyncState({ ...existing, migrationRecovery: {
          ...existing.migrationRecovery, operation: 'delete' as const,
          mutationId: generateMutationId(), receiptId: generateMutationId(),
        } }, 'pending');
        await persistMigrationResolution(existing, deleting);
        await reloadDreams();
        await clearPendingImageJobsForDream(target);
        return;
      }

      const remoteId = resolveRemoteId(target);
      if (!remoteId) {
        if (!existing) throw new Error('Dream identity is ambiguous or missing');
        // An upload may already be in flight. Keep a durable identity-based
        // deletion instead of forgetting the create and resurrecting on refresh.
        await queueOfflineOperation(
          buildQueuedMutation('delete', existing, { dreamId, tombstone: existing }),
          (prev) => removeDream(prev, target)
        );
        await clearPendingImageJobsForDream(target);
        return;
      }

      const queueAndPersist = async () => {
        await clearQueuedMutationsForDream(target);
        await queueOfflineOperation(
          buildQueuedMutation('delete', existing!, {
            dreamId,
            remoteId,
            tombstone: existing!,
          }),
          (prev) => removeDream(prev, target, remoteId)
        );
      };

      if (!hasNetwork) {
        await queueAndPersist();
        return;
      }

      try {
        await clearQueuedMutationsForDream(target);
        await deleteDreamFromSupabase(remoteId, existing?.revisionId);
        await persistRemoteDreams((prev) => removeDream(prev, target, remoteId));
        await clearPendingImageJobsForDream(target);
      } catch (error) {
        if (isConflictError(error) && existing) {
          await markDreamConflict(existing, error.remoteDream, error.message);
          return;
        }
        logger.warn('Falling back to offline dream delete', error);
        await queueAndPersist();
      }
    },
    [buildQueuedMutation, canUseRemoteSync, clearPendingImageJobsForDream, clearQueuedMutationsForDream, dreamsRef, hasNetwork, markDreamConflict, persistLocalDreams, persistRemoteDreams, persistMigrationResolution, reloadDreams, queueOfflineOperation, resolveRemoteId]
  );

  /**
   * Toggle dream favorite status
   */
  const toggleFavorite = useCallback(
    async (target: DreamTarget) => {
      const currentDreams = dreamsRef.current;
      const existing = resolveDreamTarget(currentDreams, target);
      if (!existing) throw new Error('Dream identity is ambiguous or missing');

      const updated = {
        ...existing,
        isFavorite: !existing.isFavorite,
        clientUpdatedAt: Date.now(),
      };
      const optimisticDreams = currentDreams.map((d) =>
        matchesDreamTarget(d, existing) ? updated : d
      );

      if (!canUseRemoteSync) {
        await persistLocalDreams(optimisticDreams);
        return;
      }

      await persistRemoteDreams(optimisticDreams);
      await updateDreamFromBase(existing, updated);
    },
    [canUseRemoteSync, dreamsRef, persistLocalDreams, persistRemoteDreams, updateDreamFromBase]
  );

  const reconcileImageJob = useCallback(
    async (job: PendingImageJob) => {
      const observedDream = resolveDreamTarget(dreamsRef.current, job.remoteDreamId != null
        ? { id: job.dreamId, remoteId: job.remoteDreamId } : job.dreamId);
      if (!observedDream) {
        await removePendingImageJob(job.jobId);
        return;
      }

      const status = await getImageGenerationJobStatus(job.jobId);
      // Analysis and image polling run independently. Never apply the image
      // response to the snapshot captured before the network request: a fast
      // image job can otherwise restore `analysisStatus: pending` after the
      // interpretation has already been persisted.
      const currentDream = resolveDreamTarget(dreamsRef.current, job.remoteDreamId != null
        ? { id: job.dreamId, remoteId: job.remoteDreamId } : job.dreamId);
      if (!currentDream) {
        await removePendingImageJob(job.jobId);
        return;
      }

      if (isActiveImageJobStatus(status.status)) {
        const nextStatus = status.status === 'running' ? 'running' : 'queued';
        if (job.status !== nextStatus || currentDream.imageJobStatus !== nextStatus) {
          await persistDreamClientState({
            ...currentDream,
            imageJobId: job.jobId,
            imageJobStatus: nextStatus,
            imageJobRequestId: job.clientRequestId,
          });
          await persistPendingImageJobState(
            pendingImageJobsRef.current.map((entry) =>
              entry.jobId === job.jobId ? { ...entry, status: nextStatus } : entry
            )
          );
        }
        return;
      }

      const finalizeTerminalImageJob = async (recordSuccessfulImage: boolean) => {
        if (recordSuccessfulImage && !user) {
          try {
            await incrementLocalImageCount({ jobId: job.jobId });
          } catch (error) {
            logger.warn('[useDreamJournal] Failed to increment guest image quota', error);
            quotaService.invalidate(user);
            return;
          }
        }
        try {
          await removePendingImageJob(job.jobId);
        } catch (error) {
          logger.warn('[useDreamJournal] Failed to clear pending image job', error);
        }
        if (recordSuccessfulImage && isMockMode) {
          try {
            await markMockImage({ id: job.dreamId });
          } catch (error) {
            logger.warn('[useDreamJournal] Failed to record mock image quota', error);
          }
        }
        quotaService.invalidate(user);
      };

      if (status.status === 'succeeded' && status.resultPayload?.imageUrl) {
        markPerformance('image.result_observed', {
          trace: performanceTraceId(`image:${currentDream.clientRequestId ?? currentDream.id}`),
        });
        const nextDream: DreamAnalysis = {
          ...currentDream,
          imageUrl: status.resultPayload.imageUrl,
          thumbnailUrl: getThumbnailUrl(status.resultPayload.imageUrl),
          imageSource: 'ai',
          imageUpdatedAt: Date.now(),
          imageGenerationFailed: false,
          imageJobId: undefined,
          imageJobStatus: undefined,
          imageJobRequestId: undefined,
          imageJobErrorCode: undefined,
          imageJobErrorMessage: undefined,
        };

        if (canUseRemoteSync && currentDream.remoteId != null) {
          try {
            // The worker persists image_url on the dream before marking the job as
            // succeeded. Refresh that server-owned revision instead of sending a
            // redundant stale update that would create a revision conflict.
            const remoteDream = await fetchDreamFromSupabase(currentDream.remoteId, user?.id);
            const refreshedDream = mergeServerDreamWithLocalState(remoteDream, nextDream);
            await persistRemoteDreams((prev) => upsertDream(prev, refreshedDream));
            await finalizeTerminalImageJob(true);
            return;
          } catch (error) {
            logger.warn('[useDreamJournal] Failed to refresh the completed image job from the server', error);
            await persistDreamClientState(nextDream);
            await finalizeTerminalImageJob(true);
            return;
          }

        }

        try {
          await updateDream(nextDream);
        } catch (error) {
          logger.warn('[useDreamJournal] Failed to persist completed image job', error);
          await persistDreamClientState(nextDream);
        }

        await finalizeTerminalImageJob(true);
        return;
      }

      const failedDream: DreamAnalysis = {
        ...currentDream,
        imageGenerationFailed: currentDream.imageUrl ? currentDream.imageGenerationFailed : true,
        imageJobId: undefined,
        imageJobStatus: undefined,
        imageJobRequestId: undefined,
        imageJobErrorCode: status.errorCode ?? undefined,
        imageJobErrorMessage: status.errorMessage ?? undefined,
      };

      if (!currentDream.imageUrl) {
        try {
          await updateDream(failedDream);
        } catch (error) {
          logger.warn('[useDreamJournal] Failed to persist failed image job', error);
          await persistDreamClientState(failedDream);
        }
      } else {
        await persistDreamClientState(failedDream);
      }

      await finalizeTerminalImageJob(false);
    },
    [
      canUseRemoteSync,
      dreamsRef,
      isMockMode,
      persistDreamClientState,
      persistPendingImageJobState,
      persistRemoteDreams,
      removePendingImageJob,
      updateDream,
      user,
    ]
  );

  // Hydrate persisted jobs once the journal is ready; publish recovered image
  // state through the same guarded storage operations as other journal updates.
  useEffect(() => {
    if (!loaded) {
      return;
    }

    void hydratePendingImageJobs();
  }, [hydratePendingImageJobs, loaded]);

  useEffect(() => {
    if (!loaded || !hasNetwork || !isAppActive || pendingImageJobsRef.current.length === 0) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      const jobs = [...pendingImageJobsRef.current];
      for (const job of jobs) {
        if (cancelled) {
          return;
        }

        try {
          await reconcileImageJob(job);
        } catch (error) {
          logger.warn('[useDreamJournal] Failed to poll image job', error);
        }
      }

      if (!cancelled && pendingImageJobsRef.current.length > 0) {
        const delayMs = getImageJobPollDelay(imageJobPollAttemptRef.current);
        imageJobPollAttemptRef.current += 1;
        timeoutId = setTimeout(() => {
          void poll();
        }, delayMs);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [hasNetwork, isAppActive, loaded, pendingImageJobsVersion, reconcileImageJob]);

  // A durable analysis can finish while the process is gone. Reattach to its
  // persisted result without admitting another job or writing server state.
  useEffect(() => {
    if (!loaded || !canUseRemoteSync || !isAnalysisJobsEnabled() || !user ||
      !hasNetwork || !isAppActive || !pendingMutationsLoaded || pendingMutationsScope !== userScope) {
      return;
    }

    const epoch = analysisEpochRef.current;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    const isCurrent = () => !cancelled && isAppActiveRef.current && analysisScopeRef.current === userScope &&
      analysisEpochRef.current === epoch;
    const isObservable = (dream: DreamAnalysis) => dream.remoteId != null &&
      dream.analysisStatus === 'pending' &&
      isResumableAnalysisRequest(dream) &&
      activeAnalysis?.dreamId !== dream.id && getDreamSyncState(dream) === 'clean' &&
      !livePendingMutationsRef.current.some(mutation =>
        matchesDreamTarget(getMutationDreamTarget(mutation), dream));

    const poll = async () => {
      const pending = dreamsRef.current.filter(isObservable);
      for (const pendingDream of pending) {
        if (!isCurrent()) return;
        try {
          const remoteDream = await fetchDreamFromSupabase(pendingDream.remoteId!, user.id);
          if (!isCurrent()) return;
          if (remoteDream.remoteId !== pendingDream.remoteId ||
            remoteDream.analysisRequestId !== pendingDream.analysisRequestId ||
            remoteDream.transcript !== pendingDream.transcript ||
            (remoteDream.analysisStatus !== 'done' && remoteDream.analysisStatus !== 'failed') ||
            (remoteDream.analysisStatus === 'done' && !remoteDream.isAnalyzed)) {
            continue;
          }
          const latest = resolveDreamTarget(dreamsRef.current, pendingDream);
          if (!latest || !isObservable(latest) || !areDreamsEqualForLocalState(latest, pendingDream)) continue;
          const recoveryBase = latest;
          let recoveredSnapshot: DreamAnalysis | undefined;
          await persistRemoteDreams((previous) => {
            const current = resolveDreamTarget(previous, pendingDream);
            // A response must not overwrite a newer local edit, retry, deletion,
            // or another account, even if that edit finished syncing meanwhile.
            if (!isCurrent() || !current || !isObservable(current) ||
              !areDreamsEqualForLocalState(current, recoveryBase)) return previous;
            const merged = mergeServerDreamWithLocalState(remoteDream, current);
            const recovered = remoteDream.analysisStatus === 'done'
              ? stampDreamAnalysisTranscript(merged, merged.transcript)
              : { ...merged, analysisRequestId: undefined };
            recoveredSnapshot = recovered;
            return upsertDream(previous, recovered);
          });
          // Publishing the recovered dream may clean up this effect. Account
          // and dream identity still guard the outcome after the cache write.
          const published = resolveDreamTarget(dreamsRef.current, pendingDream);
          const reservedRequestId = analysisRequestIdsRef.current.get(getDreamIdentityKey(pendingDream));
          if (recoveredSnapshot && published && areDreamsEqualForLocalState(published, recoveredSnapshot) &&
            (!reservedRequestId || reservedRequestId === pendingDream.analysisRequestId) &&
            analysisScopeRef.current === userScope && analysisEpochRef.current === epoch) {
            analysisStatusOverridesRef.current.delete(getDreamIdentityKey(pendingDream));
            analysisRequestIdsRef.current.delete(getDreamIdentityKey(pendingDream));
            quotaService.invalidate(user);
            setLastAnalysisOutcome({
              dreamId: pendingDream.id,
              status: remoteDream.analysisStatus,
              completedAt: Date.now(),
            });
          }
        } catch (error) {
          if (isCurrent()) logger.warn('[useDreamJournal] Failed to refresh pending analysis', error);
        }
      }
      attempt += 1;
      if (isCurrent() && attempt < MAX_ANALYSIS_JOB_POLL_ATTEMPTS &&
        dreamsRef.current.some(isObservable)) {
        timeoutId = setTimeout(() => { void poll(); }, getAnalysisJobPollDelay(attempt - 1));
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [activeAnalysis, canUseRemoteSync, dreams, dreamsRef, hasNetwork, isAppActive, loaded,
    livePendingMutationsRef, pendingMutationsLoaded, pendingMutationsScope, persistRemoteDreams, user, userScope]);

  /**
   * Queue async image generation for an existing dream
   */
  const generateDreamImage = useCallback(
    async (
      target: DreamTarget,
      options?: {
        prompt?: string;
        transcript?: string;
        previousImageUrl?: string;
        clientRequestId?: string;
      }
    ): Promise<DreamAnalysis> => {
      const dreamId = typeof target === 'number' ? target : target.id;
      const dream = resolveDreamTarget(dreamsRef.current, target);
      if (!dream) {
        throw new Error(`Dream with id ${dreamId} not found`);
      }

      const prompt = options?.prompt?.trim();
      const transcript = options?.transcript?.trim() ?? dream.transcript?.trim() ?? dream.interpretation?.trim();
      if (!prompt && !transcript) {
        throw new Error('Missing prompt or transcript');
      }

      const result = await submitImageJobForDream(dream, {
        clientRequestId:
          options?.clientRequestId ??
          (tier !== 'plus' && !dream.imageUrl && dream.isAnalyzed ? dream.analysisRequestId : undefined),
        prompt,
        transcript,
        previousImageUrl: options?.previousImageUrl ?? dream.imageUrl,
      });

      return result.dream;
    },
    [dreamsRef, submitImageJobForDream, tier]
  );

  const retryDreamSync = useCallback(
    async (target: DreamTarget) => {
      const dream = resolveDreamTarget(dreamsRef.current, target);
      if (!dream) throw new Error('Dream identity is ambiguous or missing');
      if (dream.migrationRecovery) {
        if (getDreamSyncState(dream) === 'conflict') return;
        // Resume the owner-attributed guest receipt instead of creating a second
        // queue writer for the same unfinished migration.
        await reloadDreams();
        return;
      }

      let retried = await retryDreamMutations(target);
      const resetDream = setDreamSyncState(dream, 'pending', {
        lastSyncError: undefined,
        conflictRemoteDream: undefined,
      });

      if (retried) {
        await persistRemoteDreams((prev) => {
          // An in-flight acknowledgement can land while retry markers are saved.
          // Never overwrite its remote identity/revision with the pre-await dream.
          const latest = resolveDreamTarget(prev, target);
          if (!latest || getDreamSyncState(latest) === 'clean') return prev;
          return upsertDream(prev, setDreamSyncState(latest, 'pending', {
            lastSyncError: undefined,
            conflictRemoteDream: undefined,
          }));
        });
      } else if (getDreamSyncState(dream) !== 'clean') {
        const resolvedDream = {
          ...resetDream,
          remoteId: resetDream.remoteId ?? resolveRemoteId(target),
        };
        await queueOfflineOperation(
          buildQueuedMutation(resolvedDream.remoteId != null ? 'update' : 'create', resolvedDream),
          (prev) => upsertDream(prev, resolvedDream)
        );
        retried = true;
      }

      if (retried) {
        await syncPendingMutations({ refreshNetworkState: true });
      }
    },
    [
      buildQueuedMutation,
      dreamsRef,
      persistRemoteDreams,
      queueOfflineOperation,
      resolveRemoteId,
      retryDreamMutations,
      syncPendingMutations,
      reloadDreams,
    ]
  );

  const resolveDreamConflict = useCallback(
    async (target: DreamTarget, resolution: 'keep_local' | 'use_server') => {
      const dream = resolveDreamTarget(dreamsRef.current, target);
      if (!dream || getDreamSyncState(dream) !== 'conflict') {
        return;
      }

      if (!canUseRemoteSync || !hasNetwork) {
        await markDreamConflict(
          dream,
          dream.conflictRemoteDream,
          'An internet connection is required to resolve this sync conflict.'
        );
        return;
      }

      let remoteConflictDream: DreamAnalysis | undefined;
      try {
        if (!user?.id) return;
        const remoteId = dream.remoteId ?? dream.migrationRecovery?.remoteId;
        remoteConflictDream = (remoteId != null
          ? await fetchDreamFromSupabase(remoteId, user.id)
          : dream.clientRequestId
            ? await fetchDreamByClientRequestId(dream.clientRequestId, user.id)
            : null) ?? undefined;
      } catch (error) {
        logger.warn('[useDreamJournal] Failed to refresh the server dream before conflict resolution', error);
      }

      if (!remoteConflictDream) {
        await markDreamConflict(
          dream,
          dream.conflictRemoteDream,
          'The latest server version could not be loaded. Check your connection and try again.'
        );
        return;
      }

      if (dream.migrationRecovery) {
        const recovery = dream.migrationRecovery;
        if (remoteConflictDream.remoteId !== recovery.remoteId || !remoteConflictDream.revisionId) {
          throw new Error('The server dream identity could not be confirmed');
        }
        const resolved = resolution === 'use_server'
          ? mergeServerDreamWithLocalState(remoteConflictDream, dream)
          : setDreamSyncState({
              ...dream,
              migrationRecovery: {
                ...recovery,
                mutationId: generateMutationId(),
                receiptId: generateMutationId(),
                revisionId: remoteConflictDream.revisionId,
              },
            }, 'pending', { lastSyncError: undefined, conflictRemoteDream: undefined });
        await persistMigrationResolution(dream, resolved);
        await reloadDreams();
        return;
      }

      if (resolution === 'use_server') {
        const resolved = mergeServerDreamWithLocalState(remoteConflictDream, dream);
        await clearQueuedMutationsForDream(target);
        await persistRemoteDreams((prev) => upsertDream(prev, resolved));
        return;
      }

      const retriedDream = setDreamSyncState(
        {
          ...dream,
          revisionId: remoteConflictDream.revisionId,
          updatedAt: remoteConflictDream.updatedAt,
          lastSyncError: undefined,
          conflictRemoteDream: undefined,
        },
        'pending',
        {
          lastSyncError: undefined,
          conflictRemoteDream: undefined,
        }
      );

      await clearQueuedMutationsForDream(target);
      await queueOfflineOperation(
        buildQueuedMutation('update', retriedDream),
        (prev) => upsertDream(prev, retriedDream)
      );
      await syncPendingMutations();
    },
    [
      buildQueuedMutation,
      canUseRemoteSync,
      clearQueuedMutationsForDream,
      dreamsRef,
      hasNetwork,
      markDreamConflict,
      persistRemoteDreams,
      persistMigrationResolution,
      reloadDreams,
      queueOfflineOperation,
      syncPendingMutations,
      user,
    ]
  );

  /**
   * Analyze a dream (separate from recording)
   * Checks quota, calls AI analysis API, and updates dream with results
   */
  const analyzeDream = useCallback(
    async (
      target: DreamTarget,
      transcript: string,
      options?: {
        replaceExistingImage?: boolean;
        lang?: string;
        onProgress?: (step: AnalysisStep) => void;
        analyticsSource?: AnalysisSource;
      }
    ): Promise<DreamAnalysis> => {
      const epoch = analysisEpochRef.current;
      const dreamId = typeof target === 'number' ? target : target.id;
      const shouldReplaceImage = options?.replaceExistingImage === true;

      // Find the dream to update
      const dream = resolveDreamTarget(dreamsRef.current, target);
      if (!dream) {
        // Preserve the public quota error contract even while authenticated
        // dreams are still loading from the server.
        const status = await quotaService.getQuotaStatus(user, tier);
        if (!status.canAnalyze) {
          if (!user && status.isUpgraded) {
            throw new QuotaError(QuotaErrorCode.LOGIN_REQUIRED, 'guest');
          }
          throw new QuotaError(QuotaErrorCode.ANALYSIS_LIMIT_REACHED, tier);
        }
        throw new Error(`Dream with id ${dreamId} not found`);
      }

      const shouldUseServerAnalysis =
        isAnalysisJobsEnabled() && canUseRemoteSync && Boolean(user) && !isMockMode;
      const inMemoryRequestId = analysisRequestIdsRef.current.get(getDreamIdentityKey(dream));
      // An accepted job stays pending through transport failures. A server-backed
      // failed dream is terminal: its refunded receipt needs a new admission.
      const persistedRequestId = isResumableAnalysisRequest(dream)
        && !(shouldUseServerAnalysis && dream.analysisStatus === 'failed')
        ? dream.analysisRequestId
        : undefined;
      const isResumingAnalysis = Boolean(inMemoryRequestId || persistedRequestId);
      const requestId = inMemoryRequestId ?? persistedRequestId ?? generateUUID();
      // Reserve synchronously before the first await so rapid duplicate calls
      // share one server idempotency key.
      analysisRequestIdsRef.current.set(getDreamIdentityKey(dream), requestId);

      if (!isResumingAnalysis && !shouldUseServerAnalysis) {
        // This gate is only for a brand-new attempt. A persisted retry has
        // already claimed (or attempted to claim) quota; the server verifies
        // the idempotency key without charging it again.
        const status = await quotaService.getQuotaStatus(user, tier);
        if (!status.canAnalyze) {
          analysisRequestIdsRef.current.delete(getDreamIdentityKey(dream));
          if (!user && status.isUpgraded) {
            throw new QuotaError(QuotaErrorCode.LOGIN_REQUIRED, 'guest');
          }
          throw new QuotaError(QuotaErrorCode.ANALYSIS_LIMIT_REACHED, tier);
        }
      }

      const analysisTrace = performanceTraceId(requestId);
      const analysisStartedAt = Date.now();
      void trackProductEvent('analysis_started', {
        source: options?.analyticsSource ?? 'unknown',
        tier,
        guest_status: user ? 'signed_in' : 'guest',
      });

      const assertAnalysisScope = () => {
        if (analysisScopeRef.current !== userScope || analysisEpochRef.current !== epoch) throw new Error('Analysis account changed');
      };
      let currentDreamState = dream;
      let analysisBase = dream;
      try {
        assertAnalysisScope();
        markPerformance('analysis.requested', { trace: analysisTrace });
        // Resolve the target's existing create/update receipt before a direct write.
        if (canUseRemoteSync) {
          await syncPendingMutations({ target: dream });
          assertAnalysisScope();
          const current = resolveCurrentDream(dream);
          if (current.migrationRecovery || getDreamSyncState(current) === 'conflict' ||
            livePendingMutationsRef.current.some(mutation => matchesDreamTarget(getMutationDreamTarget(mutation), current))) {
            throw new Error('Dream changes must be synchronized before analysis');
          }
        }
        analysisBase = resolveCurrentDream(dream);
        // Initial pending state
        currentDreamState = {
          ...analysisBase,
          analysisStatus: 'pending',
          analysisRequestId: requestId,
          clientUpdatedAt: analysisStartedAt,
        };
        analysisStatusOverridesRef.current.set(getDreamIdentityKey(dream), 'pending');
        await updateDream(currentDreamState);
        assertAnalysisScope();
        await syncPendingMutations({ target: currentDreamState });
        assertAnalysisScope();
        if (canUseRemoteSync && (resolveCurrentDream(currentDreamState).migrationRecovery || livePendingMutationsRef.current.some(mutation =>
          matchesDreamTarget(getMutationDreamTarget(mutation), currentDreamState)))) {
          throw new Error('Dream changes must be synchronized before analysis');
        }
        markPerformance('analysis.target_synced', { trace: analysisTrace });
      } catch (error) {
        if (analysisScopeRef.current === userScope) {
          analysisRequestIdsRef.current.delete(getDreamIdentityKey(dream));
          analysisStatusOverridesRef.current.delete(getDreamIdentityKey(dream));
        }
        throw error;
      }
      const syncedDream = resolveCurrentDream(currentDreamState);
      const useServerAnalysisJob =
        shouldUseServerAnalysis && syncedDream.remoteId != null;

      // Get fingerprint for guest users to enable server-side quota tracking
      const fingerprint = !user ? await getDeviceFingerprint() : undefined;

      // Text analysis completes independently. Image jobs are opt-in: only an
      // explicit replaceExistingImage:true submits or registers illustration.
      const progressOrder: AnalysisStep[] = shouldReplaceImage
        ? [
            AnalysisStep.ANALYZING,
            AnalysisStep.GENERATING_IMAGE,
            AnalysisStep.FINALIZING,
            AnalysisStep.COMPLETE,
          ]
        : [
            AnalysisStep.ANALYZING,
            AnalysisStep.FINALIZING,
            AnalysisStep.COMPLETE,
          ];
      let progressIndex = progressOrder.indexOf(AnalysisStep.ANALYZING);
      const emitProgress = (step: AnalysisStep) => {
        if (!options?.onProgress) return;
        const nextIndex = progressOrder.indexOf(step);
        if (nextIndex === -1) return;
        if (nextIndex >= progressIndex) {
          progressIndex = nextIndex;
          options.onProgress(step);
        }
      };

      let serverJobSubmissionStarted = false;
      let serverJobAccepted = false;
      let serverJobTerminalFailure = false;

      setActiveAnalysis({ dreamId });
      try {
        if (useServerAnalysisJob) {
          assertAnalysisScope();
          markPerformance('analysis.http_started', { trace: analysisTrace });
          serverJobSubmissionStarted = true;
          const command = await submitDreamAnalysisJob({
            dreamId: syncedDream.remoteId!,
            analysisRequestId: requestId,
            lang: options?.lang,
            replaceExistingImage: shouldReplaceImage,
          });
          serverJobAccepted = true;
          markPerformance('analysis.job_accepted', { trace: analysisTrace });

          const status = await waitForAnalysisJob(command.jobId);
          assertAnalysisScope();
          markPerformance('analysis.result_observed', { trace: analysisTrace, terminal: Boolean(status) });
          if (!status) {
            throw new Error('Analysis is still running. Reopen the dream to refresh it.');
          }
          if (status.status === 'failed') {
            serverJobTerminalFailure = true;
            throw Object.assign(new Error(status.errorMessage || 'Dream analysis failed'), { code: status.errorCode });
          }

          let latestDream = resolveCurrentDream(syncedDream);
          const imageJob = status.resultPayload?.imageJob;
          if (
            shouldReplaceImage
            && imageJob
            && (imageJob.status === 'queued' || imageJob.status === 'running')
          ) {
            emitProgress(AnalysisStep.GENERATING_IMAGE);
            latestDream = await registerPendingImageJob(latestDream, {
              jobId: imageJob.id,
              clientRequestId: imageJob.client_request_id,
              status: imageJob.status,
            });
          } else if (shouldReplaceImage && status.resultPayload?.imageJobErrorCode) {
            latestDream = {
              ...latestDream,
              imageGenerationFailed: !latestDream.imageUrl,
              imageJobErrorCode: status.resultPayload.imageJobErrorCode,
            };
            await persistDreamClientState(latestDream);
          }

          emitProgress(AnalysisStep.FINALIZING);
          const remoteDream = await fetchDreamFromSupabase(syncedDream.remoteId!, user?.id);
          assertAnalysisScope();
          // Only the read result may mark it done: a failed read keeps it pending
          // for an image registered before a retry or recovery.
          analysisStatusOverridesRef.current.set(getDreamIdentityKey(dream), 'done');
          const mergedDream = mergeServerDreamWithLocalState(remoteDream, latestDream);
          const stampedDream = stampDreamAnalysisTranscript(mergedDream, mergedDream.transcript);
          await updateDream(stampedDream);
          await syncPendingMutations({ target: stampedDream });
          const refreshedDream = resolveCurrentDream(stampedDream);

          void trackProductEvent('analysis_completed', {
            duration_ms_bucket: getDurationMsBucket(Date.now() - analysisStartedAt),
            generated_image: Boolean(refreshedDream.imageUrl),
            tier,
          });
          analysisStatusOverridesRef.current.delete(getDreamIdentityKey(dream));
          analysisRequestIdsRef.current.delete(getDreamIdentityKey(dream));
          quotaService.invalidate(user);
          emitProgress(AnalysisStep.COMPLETE);
          setLastAnalysisOutcome({ dreamId, status: 'done', completedAt: Date.now() });
          return refreshedDream;
        }

        assertAnalysisScope();
        markPerformance('analysis.http_started', { trace: analysisTrace });
        // The dreamer's own symbols, so a returning place or person keeps its key.
        const knownSymbols = collectKnownSymbols(dreamsRef.current);
        const analysis = await analyzeDreamText(transcript, options?.lang, fingerprint, {
          remoteDreamId: syncedDream.remoteId,
          analysisRequestId: requestId,
          ...(knownSymbols.length ? { knownSymbols } : {}),
        });

        assertAnalysisScope();
        markPerformance('analysis.result_observed', { trace: analysisTrace, terminal: true });
        const { imagePrompt, quotaUsed, ...analysisFields } = analysis;
        analysisStatusOverridesRef.current.set(getDreamIdentityKey(dream), 'done');

        // The interpretation is the primary result. Persist it before starting
        // an independent image job so a fast poll, app backgrounding, or an
        // image admission failure cannot leave a successful analysis pending.
        // Text-only analysis must not touch in-flight or failed image state.
        // Never let an analysis payload overwrite the original transcript.
        const latestBeforeAnalysis = resolveCurrentDream(syncedDream);
        const { transcript: _ignoredTranscript, ...safeAnalysisFields } = analysisFields as typeof analysisFields & {
          transcript?: string;
        };
        let next: DreamAnalysis = {
          ...latestBeforeAnalysis,
          ...safeAnalysisFields,
          // A guest's dream, or one its pre-analysis classed, keeps the name its seal gave it.
          title: latestBeforeAnalysis.title?.trim() && (!user || latestBeforeAnalysis.theme)
            ? latestBeforeAnalysis.title
            : safeAnalysisFields.title,
          // Its pre-analysis classed it, as its seal shows: the reading does not class it again.
          ...(latestBeforeAnalysis.theme
            ? { theme: latestBeforeAnalysis.theme, dreamType: latestBeforeAnalysis.dreamType }
            : null),
          transcript: latestBeforeAnalysis.transcript,
          analysisStatus: 'done',
          analyzedAt: Date.now(),
          isAnalyzed: true,
        };
        next = stampDreamAnalysisTranscript(next, next.transcript);
        if (shouldReplaceImage) {
          next = {
            ...next,
            imageGenerationFailed: false,
            imageJobId: undefined,
            imageJobStatus: undefined,
            imageJobRequestId: undefined,
            imageJobErrorCode: undefined,
            imageJobErrorMessage: undefined,
          };
        }
        await updateDream(next);
        await syncPendingMutations({ target: dream });
        next = resolveCurrentDream(next);

        if (shouldReplaceImage) {
          emitProgress(AnalysisStep.GENERATING_IMAGE);
          try {
            const submittedImage = await submitImageJobForDream(next, {
              clientRequestId: requestId,
              prompt: imagePrompt,
              previousImageUrl: next.imageUrl || undefined,
            });
            next = resolveCurrentDream(submittedImage.dream);
          } catch (error) {
            logger.warn('Image job submission failed', error);
            const latestDream = resolveCurrentDream(next);
            next = {
              ...latestDream,
              imageGenerationFailed: !latestDream.imageUrl && !dream.imageUrl,
              imageJobId: undefined,
              imageJobStatus: undefined,
              imageJobRequestId: undefined,
              imageJobErrorCode: 'IMAGE_JOB_SUBMISSION_FAILED',
              imageJobErrorMessage: error instanceof Error ? error.message : undefined,
            };
            await updateDream(next);
          }
        }
        emitProgress(AnalysisStep.FINALIZING);

        if (!user) {
          // Persist local quota usage for offline enforcement
          try {
            const localCount = await incrementLocalAnalysisCount();
            if (quotaUsed?.analysis !== undefined) {
              await syncWithServerCount(
                Math.max(quotaUsed.analysis, localCount),
                'analysis'
              ).catch((err) => {
                logger.warn('[useDreamJournal] Failed to sync quota:', err);
              });
            }
          } catch (err) {
            logger.warn('[useDreamJournal] Failed to increment quota:', err);
          }
        }

        void trackProductEvent('analysis_completed', {
          duration_ms_bucket: getDurationMsBucket(Date.now() - analysisStartedAt),
          generated_image: Boolean(next.imageUrl),
          tier,
        });

        analysisStatusOverridesRef.current.delete(getDreamIdentityKey(dream));
        analysisRequestIdsRef.current.delete(getDreamIdentityKey(dream));

        if (isMockMode) {
          await markMockAnalysis({ id: dreamId });
        }

        quotaService.invalidate(user);
        emitProgress(AnalysisStep.COMPLETE);
        setLastAnalysisOutcome({ dreamId, status: 'done', completedAt: Date.now() });
        return next;
      } catch (error) {
        assertAnalysisScope();
        if (error instanceof AiConsentWithdrawnError) {
          analysisRequestIdsRef.current.delete(getDreamIdentityKey(dream));
          analysisStatusOverridesRef.current.delete(getDreamIdentityKey(dream));
          setLastAnalysisOutcome(null);
          await updateDream(analysisBase);
          throw error;
        }
        const quotaError = coerceQuotaError(error, tier);
        const responseBody = error && typeof error === 'object' && 'body' in error
          ? error.body : null;
        const nonReusableRequest = error && typeof error === 'object'
          && 'status' in error && error.status === 409
          && responseBody && typeof responseBody === 'object'
          && 'code' in responseBody
          && (responseBody.code === 'ANALYSIS_ALREADY_CLAIMED'
            || responseBody.code === 'ANALYSIS_TRANSCRIPT_MISMATCH'
            || responseBody.code === 'ANALYSIS_IDEMPOTENCY_KEY_REUSED');
        const responseStatus = error && typeof error === 'object' && 'status' in error
          && typeof error.status === 'number' ? error.status : undefined;
        const admissionCode = responseBody && typeof responseBody === 'object' && 'code' in responseBody
          && typeof responseBody.code === 'string' ? responseBody.code : undefined;
        // Only admission answers emitted after the idempotent lookup prove that
        // no job owns this key. Auth/gateway failures may follow a committed POST.
        const confirmedSubmissionRejection = serverJobSubmissionStarted && !serverJobAccepted
          && ((responseStatus !== undefined && responseStatus >= 400 && responseStatus < 500
            && responseStatus !== 401 && responseStatus !== 408 && admissionCode !== undefined
            && (['QUOTA_EXCEEDED', 'DAILY_ANALYSIS_LIMIT', 'ANALYSIS_IDEMPOTENCY_KEY_REUSED',
              'DREAM_NOT_FOUND', 'INVALID_INPUT'].includes(admissionCode) || admissionCode.startsWith('AI_')))
            || (responseStatus === 503 && admissionCode === 'AI_GLOBAL_BACKLOG_LIMIT'));
        if (serverJobSubmissionStarted && !serverJobTerminalFailure && !confirmedSubmissionRejection) {
          // The POST may have committed before its reply was lost. Persist the same
          // key across restarts, just as for an acknowledged job awaiting its result.
          analysisStatusOverridesRef.current.set(getDreamIdentityKey(dream), 'pending');
          await persistDreamClientState({
            ...resolveCurrentDream(currentDreamState),
            analysisStatus: 'pending', analysisRequestId: requestId,
          });
          throw quotaError ?? error;
        }
        setLastAnalysisOutcome({ dreamId, status: 'failed', completedAt: Date.now() });
        if (serverJobAccepted) {
          if (serverJobTerminalFailure) {
            analysisRequestIdsRef.current.delete(getDreamIdentityKey(dream));
            quotaService.invalidate(user);
            analysisStatusOverridesRef.current.set(getDreamIdentityKey(dream), 'failed');
            const latestDream = resolveCurrentDream(currentDreamState);
            await persistDreamClientState({
              ...latestDream,
              analysisStatus: 'failed',
              analysisRequestId: undefined,
            });
          }
          // A timeout or network error is not a server failure. Keep the
          // durable request pending so a later retry observes the same job.
          throw quotaError ?? error;
        }

        analysisStatusOverridesRef.current.set(getDreamIdentityKey(dream), 'failed');
        const latestDream = resolveCurrentDream(currentDreamState);
        const failedDream: DreamAnalysis = {
          ...latestDream,
          analysisStatus: 'failed',
          // A spent or transcript-mismatched receipt cannot fund another
          // provider call. A later explicit retry needs a fresh quota claim.
          ...(nonReusableRequest || confirmedSubmissionRejection ? { analysisRequestId: undefined } : {}),
        };
        if (nonReusableRequest || confirmedSubmissionRejection) {
          analysisRequestIdsRef.current.delete(getDreamIdentityKey(dream));
          quotaService.invalidate(user);
        }
        try {
          await updateDream(failedDream);
        } catch {
          logger.error('[useDreamJournal] Failed to persist failed analysis state');
          // Persist locally even if Supabase sync fails
          if (canUseRemoteSync) {
            await persistRemoteDreams((prev) => upsertDream(prev, failedDream));
          } else {
            const currentDreams = dreamsRef.current;
            const newDreams = currentDreams.map((d) => (matchesDreamTarget(d, dream) ? failedDream : d));
            await persistLocalDreams(newDreams);
          }
        }
        throw quotaError ?? error;
      } finally {
        setActiveAnalysis(null);
      }
    },
    [
      canUseRemoteSync,
      dreamsRef,
      isMockMode,
      persistLocalDreams,
      persistDreamClientState,
      persistRemoteDreams,
      registerPendingImageJob,
      resolveCurrentDream,
      submitImageJobForDream,
      syncPendingMutations,
      updateDream,
      user,
      userScope,
      tier,
      livePendingMutationsRef,
      waitForAnalysisJob,
    ]
  );

  return {
    dreams,
    loaded,
    persistenceState,
    refreshState,
    completeness,
    remotePreviewAllowed,
    activeAnalysis,
    lastAnalysisOutcome,
    addDream,
    updateDream,
    applyServerDreamState,
    loadRemoteDreamForPreview,
    applyDreamCategorization,
    deleteDream,
    toggleFavorite,
    retryDreamSync,
    resolveDreamConflict,
    generateDreamImage,
    analyzeDream,
    reloadDreams,
    retryPersistence,
  };
};
