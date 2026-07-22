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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import {
  getDurationMsBucket,
  trackProductEvent,
  type AnalysisSource,
} from '@/lib/analytics';
import { isResumableAnalysisRequest } from '@/lib/analysisRequest';
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
  buildDreamMutationEntityKey,
  clearDreamConflict,
  createDreamMutation,
  generateMutationId,
  generateUUID,
  getDreamSyncState,
  isConflictError,
  normalizeDreamImages,
  removeDream,
  setDreamSyncState,
  upsertDream,
} from '@/lib/dreamUtils';
import { coerceQuotaError, QuotaError, QuotaErrorCode } from '@/lib/errors';
import { isGuestDreamLimitReached } from '@/lib/guestLimits';
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
  syncWithServerCount,
} from '@/services/quota/GuestAnalysisCounter';
import {
  getGuestRecordedDreamCount,
  incrementLocalDreamRecordingCount,
  withGuestDreamRecordingLock,
} from '@/services/quota/GuestDreamCounter';
import { markMockAnalysis } from '@/services/quota/MockQuotaEventStore';
import { quotaService } from '@/services/quotaService';
import {
  getPendingImageJobs,
  savePendingImageJobs,
} from '@/services/storageService';
import {
  deleteDreamFromSupabase,
  fetchDreamFromSupabase,
  fetchDreamsFromSupabase,
  updateDreamInSupabase,
} from '@/services/supabaseDreamService';

import { useDreamPersistence } from './useDreamPersistence';
import { useOfflineSyncQueue } from './useOfflineSyncQueue';

const isActiveImageJobStatus = (
  status: DreamAnalysis['imageJobStatus'] | 'succeeded' | 'failed' | undefined
): status is 'queued' | 'running' => status === 'queued' || status === 'running';

const waitForPollDelay = (delayMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, delayMs));

const findMatchingRemoteDream = (
  remoteDreams: DreamAnalysis[],
  localDream: DreamAnalysis
): DreamAnalysis | undefined =>
  remoteDreams.find(
    (entry) =>
      (localDream.remoteId != null && entry.remoteId === localDream.remoteId) ||
      (localDream.clientRequestId != null && entry.clientRequestId === localDream.clientRequestId)
  );

const mergeRemoteDreamWithClientState = (
  remoteDream: DreamAnalysis,
  localDream: DreamAnalysis
): DreamAnalysis =>
  setDreamSyncState(
    {
      ...remoteDream,
      id: localDream.id,
      memory: remoteDream.memory ?? localDream.memory,
      imageUpdatedAt: localDream.imageUpdatedAt ?? remoteDream.imageUpdatedAt,
      imageSource: localDream.imageSource ?? remoteDream.imageSource,
      imageJobId: localDream.imageJobId,
      imageJobStatus: localDream.imageJobStatus,
      imageJobRequestId: localDream.imageJobRequestId,
      imageJobErrorCode: localDream.imageJobErrorCode,
      imageJobErrorMessage: localDream.imageJobErrorMessage,
    },
    'clean',
    {
      lastSyncedAt: Date.now(),
      lastSyncError: undefined,
      conflictRemoteDream: undefined,
    }
  );

export const useDreamJournal = () => {
  const { user } = useAuth();
  const { status: subscriptionStatus } = useSubscription();
  const isAuthenticated = Boolean(user);
  const isMockMode = isMockModeEnabled();
  const canUseRemoteSync = isAuthenticated && !isMockMode;
  const userScope = user?.id ? `user:${user.id}` : null;
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
    pendingMutations,
    reloadDreams,
  } = useDreamPersistence({ canUseRemoteSync });

  /**
   * Resolve remoteId from local dreamId
   */
  const resolveRemoteId = useCallback((dreamId: number): number | undefined => {
    const target = dreamsRef.current.find((d) => d.id === dreamId);
    return target?.remoteId;
  }, [dreamsRef]);

  // Use extracted offline sync queue hook
  const {
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
    initialMutations: pendingMutations,
  });

  const pendingImageJobsRef = useRef<PendingImageJob[]>([]);
  const imageJobPollAttemptRef = useRef(0);
  const [pendingImageJobsVersion, setPendingImageJobsVersion] = useState(0);
  const analysisStatusOverridesRef = useRef<Map<number, DreamAnalysis['analysisStatus']>>(new Map());
  const analysisRequestIdsRef = useRef<Map<number, string>>(new Map());

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
      dreamsRef.current.find(
        (entry) =>
          entry.id === dream.id ||
          (dream.remoteId != null && entry.remoteId === dream.remoteId) ||
          (dream.clientRequestId != null && entry.clientRequestId === dream.clientRequestId)
      ) ?? dream,
    [dreamsRef]
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

  const hydratePendingImageJobs = useCallback(async () => {
    const jobs = await getPendingImageJobs();
    pendingImageJobsRef.current = jobs;
    setPendingImageJobsVersion((version) => version + 1);

    if (!jobs.length || !dreamsRef.current.length) {
      return;
    }

    const jobsByDreamId = new Map<number, PendingImageJob>();
    jobs.forEach((job) => {
      jobsByDreamId.set(job.dreamId, job);
    });

    const applyJobs = (list: DreamAnalysis[]) =>
      list.map((dream) => {
        const pendingJob = jobsByDreamId.get(dream.id);
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
    async (dreamId: number) => {
      const remainingJobs = pendingImageJobsRef.current.filter((job) => job.dreamId !== dreamId);
      if (remainingJobs.length !== pendingImageJobsRef.current.length) {
        await persistPendingImageJobState(remainingJobs);
      }
    },
    [persistPendingImageJobState]
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
          (entry) => entry.jobId !== job.jobId && entry.dreamId !== dream.id
        ),
      ];

      await persistPendingImageJobState(nextJobs);
      const latestDream = resolveCurrentDream(dream);
      const nextDream: DreamAnalysis = {
        ...latestDream,
        analysisStatus:
          analysisStatusOverridesRef.current.get(dream.id) ?? latestDream.analysisStatus,
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
    [persistDreamClientState, persistPendingImageJobState, resolveCurrentDream]
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
            const alreadyExists = currentDreams.some((existing) => existing.id === normalizedDream.id);
            const used = await getGuestRecordedDreamCount(currentDreams.length);
            if (!alreadyExists && isGuestDreamLimitReached(used)) {
              throw new QuotaError(QuotaErrorCode.GUEST_LIMIT_REACHED, 'guest');
            }
            await persistLocalDreams([normalizedDream, ...currentDreams]);
            if (!alreadyExists) {
              try {
                await incrementLocalDreamRecordingCount();
              } catch (err) {
                logger.warn('[useDreamJournal] Failed to increment guest recording count', err);
              }
            }
            return normalizedDream;
          });
        }

        const currentDreams = dreamsRef.current;
        await persistLocalDreams([normalizedDream, ...currentDreams]);
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
      if (hasNetwork) {
        void syncPendingMutations().catch((error) => {
          logger.warn('Background dream creation sync failed', error);
        });
      }
      return queuedDream;
    },
    [
      buildQueuedMutation,
      canUseRemoteSync,
      dreamsRef,
      hasNetwork,
      persistLocalDreams,
      queueOfflineOperation,
      syncPendingMutations,
      user,
    ]
  );

  /**
   * Update an existing dream
   */
  const updateDream = useCallback(
    async (updatedDream: DreamAnalysis) => {
      const normalizedDream = normalizeDreamImages({
        ...(getDreamSyncState(updatedDream) === 'conflict' ? clearDreamConflict(updatedDream) : updatedDream),
        clientUpdatedAt: updatedDream.clientUpdatedAt ?? Date.now(),
      });
      const currentDreams = dreamsRef.current;
      const existingDream = currentDreams.find((d) => d.id === normalizedDream.id);

      if (existingDream && areDreamsEqualForLocalState(existingDream, normalizedDream)) {
        return;
      }

      if (!canUseRemoteSync) {
        const newDreams = currentDreams.map((d) => (d.id === normalizedDream.id ? normalizedDream : d));
        await persistLocalDreams(newDreams);
        return;
      }

      const remoteId = normalizedDream.remoteId ?? resolveRemoteId(normalizedDream.id);

      const queueAndPersist = async (pendingVersion: DreamAnalysis) => {
        await queueOfflineOperation(
          buildQueuedMutation('update', pendingVersion),
          (prev) => upsertDream(prev, normalizeDreamImages(pendingVersion))
        );
      };

      if (existingDream && areDreamsEqualForRemoteSync(existingDream, normalizedDream)) {
        await persistRemoteDreams((prev) => upsertDream(prev, normalizedDream));
        return;
      }

      if (!remoteId) {
        const pendingVersion = setDreamSyncState(normalizedDream, 'pending', {
          lastSyncError: undefined,
          conflictRemoteDream: undefined,
        });
        await queueAndPersist(pendingVersion);
        return;
      }

      if (!hasNetwork) {
        const pendingVersion = setDreamSyncState({ ...normalizedDream, remoteId }, 'pending', {
          lastSyncError: undefined,
          conflictRemoteDream: undefined,
        });
        await queueAndPersist(pendingVersion);
        return;
      }

      try {
        const saved = await updateDreamInSupabase({ ...normalizedDream, remoteId });
        const merged = mergeRemoteDreamWithClientState(saved, normalizedDream);
        await persistRemoteDreams((prev) => upsertDream(prev, merged));
      } catch (error) {
        if (isConflictError(error)) {
          await markDreamConflict(normalizedDream, error.remoteDream, error.message);
          return;
        }
        const quotaError = coerceQuotaError(error, tier);
        if (quotaError) {
          throw quotaError;
        }
        logger.warn('Falling back to offline dream update', error);
        const pendingVersion = setDreamSyncState({ ...normalizedDream, remoteId }, 'pending', {
          lastSyncError: undefined,
          conflictRemoteDream: undefined,
        });
        await queueAndPersist(pendingVersion);
      }
    },
    [
      buildQueuedMutation,
      canUseRemoteSync,
      dreamsRef,
      hasNetwork,
      markDreamConflict,
      persistLocalDreams,
      persistRemoteDreams,
      queueOfflineOperation,
      resolveRemoteId,
      tier,
    ]
  );

  /**
   * Apply optional quick categorization against the latest dream revision.
   * A late enrichment must never overwrite an analysis that has started or
   * completed since the dream was first saved.
   */
  const applyDreamCategorization = useCallback(
    async (dreamId: number, categorization: DreamCategorization): Promise<DreamAnalysis | null> => {
      const currentDream = dreamsRef.current.find((dream) => dream.id === dreamId);
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
        title: categorization.title,
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
    async (dreamId: number) => {
      const currentDreams = dreamsRef.current;
      const existing = currentDreams.find((dream) => dream.id === dreamId);

      if (!canUseRemoteSync) {
        const newDreams = currentDreams.filter((d) => d.id !== dreamId);
        await persistLocalDreams(newDreams);
        await clearPendingImageJobsForDream(dreamId);
        return;
      }

      const remoteId = resolveRemoteId(dreamId);
      if (!remoteId) {
        const removed = await clearQueuedMutationsForDream(dreamId);
        if (!removed) {
          throw new Error('Missing remote id for Supabase dream delete');
        }
        await persistRemoteDreams((prev) => removeDream(prev, dreamId));
        await clearPendingImageJobsForDream(dreamId);
        return;
      }

      const queueAndPersist = async () => {
        await clearQueuedMutationsForDream(dreamId);
        await queueOfflineOperation(
          buildQueuedMutation('delete', existing!, {
            dreamId,
            remoteId,
            tombstone: existing!,
          }),
          (prev) => removeDream(prev, dreamId, remoteId)
        );
      };

      if (!hasNetwork) {
        await queueAndPersist();
        return;
      }

      try {
        await clearQueuedMutationsForDream(dreamId);
        await deleteDreamFromSupabase(remoteId, existing?.revisionId);
        await persistRemoteDreams((prev) => removeDream(prev, dreamId, remoteId));
        await clearPendingImageJobsForDream(dreamId);
      } catch (error) {
        if (isConflictError(error) && existing) {
          await markDreamConflict(existing, error.remoteDream, error.message);
          return;
        }
        logger.warn('Falling back to offline dream delete', error);
        await queueAndPersist();
      }
    },
    [buildQueuedMutation, canUseRemoteSync, clearPendingImageJobsForDream, clearQueuedMutationsForDream, dreamsRef, hasNetwork, markDreamConflict, persistLocalDreams, persistRemoteDreams, queueOfflineOperation, resolveRemoteId]
  );

  /**
   * Toggle dream favorite status
   */
  const toggleFavorite = useCallback(
    async (dreamId: number) => {
      const currentDreams = dreamsRef.current;
      const existing = currentDreams.find((d) => d.id === dreamId);
      if (!existing) return;

      const updated = {
        ...existing,
        isFavorite: !existing.isFavorite,
        clientUpdatedAt: Date.now(),
      };
      const optimisticDreams = currentDreams.map((d) =>
        d.id === dreamId ? updated : d
      );

      if (!canUseRemoteSync) {
        await persistLocalDreams(optimisticDreams);
        return;
      }

      await persistRemoteDreams(optimisticDreams);

      const remoteId = updated.remoteId ?? resolveRemoteId(dreamId);
      const rollbackFavorite = async () => {
        await persistRemoteDreams((prev) =>
          prev.map((dream) => {
            if (dream.id !== dreamId) return dream;
            if (dream.isFavorite !== updated.isFavorite) return dream;
            return { ...dream, isFavorite: existing.isFavorite };
          })
        );
      };

      const queueAndPersist = async (pendingVersion: DreamAnalysis) => {
        await queueOfflineOperation(
          buildQueuedMutation('update', pendingVersion),
          (prev) => upsertDream(prev, pendingVersion)
        );
      };

      if (!hasNetwork) {
        const pendingVersion = setDreamSyncState(updated, 'pending', {
          lastSyncError: undefined,
          conflictRemoteDream: undefined,
        });
        await queueAndPersist(pendingVersion);
        return;
      }

      if (!remoteId) {
        await rollbackFavorite();
        throw new Error('Missing remote id for Supabase dream update');
      }

      try {
        const saved = await updateDreamInSupabase({ ...updated, remoteId });
        const merged = mergeRemoteDreamWithClientState(saved, updated);
        await persistRemoteDreams((prev) => upsertDream(prev, merged));
      } catch (error) {
        if (isConflictError(error)) {
          await markDreamConflict(updated, error.remoteDream, error.message);
          return;
        }
        await rollbackFavorite();
        throw error;
      }
    },
    [buildQueuedMutation, canUseRemoteSync, dreamsRef, hasNetwork, markDreamConflict, persistLocalDreams, persistRemoteDreams, queueOfflineOperation, resolveRemoteId]
  );

  const reconcileImageJob = useCallback(
    async (job: PendingImageJob) => {
      const currentDream = dreamsRef.current.find((dream) => dream.id === job.dreamId);
      if (!currentDream) {
        await removePendingImageJob(job.jobId);
        return;
      }

      const status = await getImageGenerationJobStatus(job.jobId);

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

      if (status.status === 'succeeded' && status.resultPayload?.imageUrl) {
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
            const remoteDream = await fetchDreamFromSupabase(currentDream.remoteId);
            const refreshedDream = mergeRemoteDreamWithClientState(remoteDream, nextDream);
            await persistRemoteDreams((prev) => upsertDream(prev, refreshedDream));
            await removePendingImageJob(job.jobId);
            return;
          } catch (error) {
            logger.warn('[useDreamJournal] Failed to refresh the completed image job from the server', error);
            await persistDreamClientState(nextDream);
            return;
          }

        }

        try {
          await updateDream(nextDream);
        } catch (error) {
          logger.warn('[useDreamJournal] Failed to persist completed image job', error);
          await persistDreamClientState(nextDream);
        }

        await removePendingImageJob(job.jobId);
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

      await removePendingImageJob(job.jobId);
    },
    [
      canUseRemoteSync,
      dreamsRef,
      persistDreamClientState,
      persistPendingImageJobState,
      persistRemoteDreams,
      removePendingImageJob,
      updateDream,
    ]
  );

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

  /**
   * Queue async image generation for an existing dream
   */
  const generateDreamImage = useCallback(
    async (
      dreamId: number,
      options?: {
        prompt?: string;
        transcript?: string;
        previousImageUrl?: string;
        clientRequestId?: string;
      }
    ): Promise<DreamAnalysis> => {
      const dream = dreamsRef.current.find((entry) => entry.id === dreamId);
      if (!dream) {
        throw new Error(`Dream with id ${dreamId} not found`);
      }

      const prompt = options?.prompt?.trim();
      const transcript = options?.transcript?.trim() ?? dream.transcript?.trim() ?? dream.interpretation?.trim();
      if (!prompt && !transcript) {
        throw new Error('Missing prompt or transcript');
      }

      const result = await submitImageJobForDream(dream, {
        clientRequestId: options?.clientRequestId,
        prompt,
        transcript,
        previousImageUrl: options?.previousImageUrl ?? dream.imageUrl,
      });

      return result.dream;
    },
    [dreamsRef, submitImageJobForDream]
  );

  const retryDreamSync = useCallback(
    async (dreamId: number) => {
      const dream = dreamsRef.current.find((entry) => entry.id === dreamId);
      if (!dream) return;

      let retried = await retryDreamMutations(dreamId);
      const resetDream = setDreamSyncState(dream, 'pending', {
        lastSyncError: undefined,
        conflictRemoteDream: undefined,
      });

      if (retried) {
        await persistRemoteDreams((prev) => upsertDream(prev, resetDream));
      } else if (getDreamSyncState(dream) !== 'clean') {
        const resolvedDream = {
          ...resetDream,
          remoteId: resetDream.remoteId ?? resolveRemoteId(dreamId),
        };
        await queueOfflineOperation(
          buildQueuedMutation(resolvedDream.remoteId != null ? 'update' : 'create', resolvedDream),
          (prev) => upsertDream(prev, resolvedDream)
        );
        retried = true;
      }

      if (retried) {
        await syncPendingMutations();
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
    ]
  );

  const resolveDreamConflict = useCallback(
    async (dreamId: number, resolution: 'keep_local' | 'use_server') => {
      const dream = dreamsRef.current.find((entry) => entry.id === dreamId);
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
        const remoteDreams = await fetchDreamsFromSupabase();
        remoteConflictDream = findMatchingRemoteDream(remoteDreams, dream);
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

      if (resolution === 'use_server') {
        const resolved = mergeRemoteDreamWithClientState(remoteConflictDream, dream);
        await clearQueuedMutationsForDream(dreamId);
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

      await clearQueuedMutationsForDream(dreamId);
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
      queueOfflineOperation,
      syncPendingMutations,
    ]
  );

  /**
   * Analyze a dream (separate from recording)
   * Checks quota, calls AI analysis API, and updates dream with results
   */
  const analyzeDream = useCallback(
    async (
      dreamId: number,
      transcript: string,
      options?: {
        replaceExistingImage?: boolean;
        lang?: string;
        onProgress?: (step: AnalysisStep) => void;
        analyticsSource?: AnalysisSource;
      }
    ): Promise<DreamAnalysis> => {
      const shouldReplaceImage = options?.replaceExistingImage ?? true;

      // Find the dream to update
      const dream = dreamsRef.current.find((d) => d.id === dreamId);
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

      const inMemoryRequestId = analysisRequestIdsRef.current.get(dreamId);
      const persistedRequestId = isResumableAnalysisRequest(dream)
        ? dream.analysisRequestId
        : undefined;
      const isResumingAnalysis = Boolean(inMemoryRequestId || persistedRequestId);
      const requestId = inMemoryRequestId ?? persistedRequestId ?? generateUUID();
      const shouldUseServerAnalysis =
        isAnalysisJobsEnabled() && canUseRemoteSync && Boolean(user) && !isMockMode;
      // Reserve synchronously before the first await so rapid duplicate calls
      // share one server idempotency key.
      analysisRequestIdsRef.current.set(dreamId, requestId);

      if (!isResumingAnalysis && !shouldUseServerAnalysis) {
        // This gate is only for a brand-new attempt. A persisted retry has
        // already claimed (or attempted to claim) quota; the server verifies
        // the idempotency key without charging it again.
        const status = await quotaService.getQuotaStatus(user, tier);
        if (!status.canAnalyze) {
          analysisRequestIdsRef.current.delete(dreamId);
          if (!user && status.isUpgraded) {
            throw new QuotaError(QuotaErrorCode.LOGIN_REQUIRED, 'guest');
          }
          throw new QuotaError(QuotaErrorCode.ANALYSIS_LIMIT_REACHED, tier);
        }
      }

      const analysisStartedAt = Date.now();
      void trackProductEvent('analysis_started', {
        source: options?.analyticsSource ?? 'unknown',
        tier,
        guest_status: user ? 'signed_in' : 'guest',
      });

      // Initial pending state
      const currentDreamState: DreamAnalysis = {
        ...dream,
        analysisStatus: 'pending',
        analysisRequestId: requestId,
        clientUpdatedAt: analysisStartedAt,
      };
      analysisStatusOverridesRef.current.set(dreamId, 'pending');
      await updateDream(currentDreamState);
      // Best-effort: flush any pending sync so Supabase reflects "pending" before the user navigates away.
      await syncPendingMutations();
      const syncedDream = resolveCurrentDream(currentDreamState);
      const useServerAnalysisJob =
        shouldUseServerAnalysis && syncedDream.remoteId != null;

      // Get fingerprint for guest users to enable server-side quota tracking
      const fingerprint = !user ? await getDeviceFingerprint() : undefined;

      // Analysis owns the initial image prompt. Submit the image only after the
      // structured analysis succeeds so the worker does not pay for a second
      // prompt-generation model call from the raw transcript.
      const progressOrder: AnalysisStep[] = [
        AnalysisStep.ANALYZING,
        AnalysisStep.GENERATING_IMAGE,
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

      let serverJobAccepted = false;
      let serverJobTerminalFailure = false;

      try {
        if (useServerAnalysisJob) {
          const command = await submitDreamAnalysisJob({
            dreamId: syncedDream.remoteId!,
            analysisRequestId: requestId,
            lang: options?.lang,
            replaceExistingImage: shouldReplaceImage,
          });
          serverJobAccepted = true;

          const status = await waitForAnalysisJob(command.jobId);
          if (!status) {
            throw new Error('Analysis is still running. Reopen the dream to refresh it.');
          }
          if (status.status === 'failed') {
            serverJobTerminalFailure = true;
            throw new Error(status.errorMessage || 'Dream analysis failed');
          }

          analysisStatusOverridesRef.current.set(dreamId, 'done');
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
          const remoteDream = await fetchDreamFromSupabase(syncedDream.remoteId!);
          const refreshedDream = mergeRemoteDreamWithClientState(remoteDream, latestDream);
          await persistRemoteDreams((prev) => upsertDream(prev, refreshedDream));

          void trackProductEvent('analysis_completed', {
            duration_ms_bucket: getDurationMsBucket(Date.now() - analysisStartedAt),
            generated_image: Boolean(refreshedDream.imageUrl),
            tier,
          });
          analysisStatusOverridesRef.current.delete(dreamId);
          analysisRequestIdsRef.current.delete(dreamId);
          quotaService.invalidate(user);
          emitProgress(AnalysisStep.COMPLETE);
          return refreshedDream;
        }

        const analysis = await analyzeDreamText(transcript, options?.lang, fingerprint, {
          remoteDreamId: syncedDream.remoteId,
          analysisRequestId: requestId,
        });

        let imageResult: {
          dream: DreamAnalysis;
          failed: boolean;
          error?: unknown;
        } = { dream: syncedDream, failed: false };

        if (shouldReplaceImage) {
          emitProgress(AnalysisStep.GENERATING_IMAGE);
          try {
            const submittedImage = await submitImageJobForDream(resolveCurrentDream(syncedDream), {
              clientRequestId: requestId,
              prompt: analysis.imagePrompt,
              previousImageUrl: syncedDream.imageUrl || undefined,
            });
            imageResult = { dream: submittedImage.dream, failed: false };
          } catch (error) {
            logger.warn('Image job submission failed', error);
            imageResult = { dream: resolveCurrentDream(syncedDream), failed: true, error };
          }
        }
        emitProgress(AnalysisStep.FINALIZING);

        const { imagePrompt: _submittedImagePrompt, quotaUsed, ...analysisFields } = analysis;

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

        const baseDream = imageResult.dream ?? currentDreamState;
        const imageFailedWithoutImage =
          shouldReplaceImage && !!imageResult.failed && !baseDream.imageUrl && !dream.imageUrl;

        const next: DreamAnalysis = {
          ...baseDream,
          ...analysisFields,
          imageGenerationFailed: imageFailedWithoutImage,
          analysisStatus: 'done',
          analyzedAt: Date.now(),
          isAnalyzed: true,
          imageJobId: imageResult.failed ? undefined : baseDream.imageJobId,
          imageJobStatus: imageResult.failed ? undefined : baseDream.imageJobStatus,
          imageJobRequestId: imageResult.failed ? undefined : baseDream.imageJobRequestId,
          imageJobErrorCode: imageResult.failed ? 'IMAGE_JOB_SUBMISSION_FAILED' : undefined,
          imageJobErrorMessage: imageResult.failed
            ? imageResult.error instanceof Error
              ? imageResult.error.message
              : undefined
            : undefined,
        };
        analysisStatusOverridesRef.current.set(dreamId, 'done');
        void trackProductEvent('analysis_completed', {
          duration_ms_bucket: getDurationMsBucket(Date.now() - analysisStartedAt),
          generated_image: Boolean(next.imageUrl),
          tier,
        });

        // Persist locally and best-effort sync to Supabase. updateDream intentionally falls back
        // to the offline queue for most errors, so we force a sync attempt right after.
        await updateDream(next);
        await syncPendingMutations();
        analysisStatusOverridesRef.current.delete(dreamId);
        analysisRequestIdsRef.current.delete(dreamId);

        if (isMockMode) {
          await markMockAnalysis({ id: dreamId });
        }

        quotaService.invalidate(user);
        emitProgress(AnalysisStep.COMPLETE);
        return next;
      } catch (error) {
        if (serverJobAccepted) {
          if (serverJobTerminalFailure) {
            analysisStatusOverridesRef.current.set(dreamId, 'failed');
            const latestDream = resolveCurrentDream(currentDreamState);
            await persistDreamClientState({
              ...latestDream,
              analysisStatus: 'failed',
            });
          }
          // A timeout or network error is not a server failure. Keep the
          // durable request pending so a later retry observes the same job.
          throw error;
        }

        analysisStatusOverridesRef.current.set(dreamId, 'failed');
        const latestDream = resolveCurrentDream(currentDreamState);
        const failedDream: DreamAnalysis = {
          ...latestDream,
          analysisStatus: 'failed',
        };
        try {
          await updateDream(failedDream);
        } catch {
          logger.error('[useDreamJournal] Failed to persist failed analysis state');
          // Persist locally even if Supabase sync fails
          if (canUseRemoteSync) {
            await persistRemoteDreams((prev) => upsertDream(prev, failedDream));
          } else {
            const currentDreams = dreamsRef.current;
            const newDreams = currentDreams.map((d) => (d.id === dreamId ? failedDream : d));
            await persistLocalDreams(newDreams);
          }
        }
        throw error;
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
      tier,
      waitForAnalysisJob,
    ]
  );

  return {
    dreams,
    loaded,
    addDream,
    updateDream,
    applyServerDreamState,
    applyDreamCategorization,
    deleteDream,
    toggleFavorite,
    retryDreamSync,
    resolveDreamConflict,
    generateDreamImage,
    analyzeDream,
    reloadDreams,
  };
};
