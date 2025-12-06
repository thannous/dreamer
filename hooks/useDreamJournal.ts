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
import { useCallback, useMemo } from 'react';

import { useAuth } from '@/context/AuthContext';
import { getDeviceFingerprint } from '@/lib/deviceFingerprint';
import {
  generateMutationId,
  generateUUID,
  normalizeDreamImages,
  removeDream,
  upsertDream,
} from '@/lib/dreamUtils';
import { QuotaError, QuotaErrorCode } from '@/lib/errors';
import { getThumbnailUrl } from '@/lib/imageUtils';
import { logger } from '@/lib/logger';
import type { DreamAnalysis } from '@/lib/types';
import {
  analyzeDream as analyzeDreamText,
  generateImageFromTranscript,
} from '@/services/geminiService';
import {
  incrementLocalAnalysisCount,
  syncWithServerCount,
} from '@/services/quota/GuestAnalysisCounter';
import { markMockAnalysis } from '@/services/quota/MockQuotaEventStore';
import { quotaService } from '@/services/quotaService';
import {
  createDreamInSupabase,
  deleteDreamFromSupabase,
  updateDreamInSupabase,
} from '@/services/supabaseDreamService';

import { useDreamPersistence } from './useDreamPersistence';
import { useOfflineSyncQueue } from './useOfflineSyncQueue';

export const useDreamJournal = () => {
  const { user } = useAuth();
  const isAuthenticated = Boolean(user);
  const isMockMode =
    ((process?.env as Record<string, string> | undefined)?.EXPO_PUBLIC_MOCK_MODE ?? '') === 'true';
  const canUseRemoteSync = isAuthenticated && !isMockMode;

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

  // Use extracted persistence hook
  const {
    dreams,
    loaded,
    dreamsRef,
    persistLocalDreams,
    persistRemoteDreams,
    pendingMutations,
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
  } = useOfflineSyncQueue({
    canUseRemoteSync,
    hasNetwork,
    persistRemoteDreams,
    resolveRemoteId,
    initialMutations: pendingMutations,
  });

  /**
   * Add a new dream
   */
  const addDream = useCallback(
    async (dream: DreamAnalysis): Promise<DreamAnalysis> => {
      const clientRequestId = dream.clientRequestId ?? generateUUID();
      const normalizedDream = normalizeDreamImages({ ...dream, clientRequestId });
      const currentDreams = dreamsRef.current;

      if (!canUseRemoteSync) {
        await persistLocalDreams([normalizedDream, ...currentDreams]);
        return normalizedDream;
      }

      const queueAndPersist = async () => {
        const queuedDream = { ...normalizedDream, pendingSync: true };
        await queueOfflineOperation(
          {
            id: generateMutationId(),
            type: 'create',
            createdAt: Date.now(),
            dream: queuedDream,
          },
          (prev) => upsertDream(prev, queuedDream)
        );
        return queuedDream;
      };

      if (!hasNetwork) {
        return queueAndPersist();
      }

      try {
        const saved = await createDreamInSupabase(normalizedDream, user!.id);
        const merged = normalizedDream.imageUpdatedAt
          ? { ...saved, imageUpdatedAt: normalizedDream.imageUpdatedAt }
          : saved;
        await persistRemoteDreams((prev) => upsertDream(prev, merged));
        return merged;
      } catch (error) {
        logger.warn('Falling back to offline dream creation', error);
        return queueAndPersist();
      }
    },
    [canUseRemoteSync, dreamsRef, hasNetwork, persistLocalDreams, persistRemoteDreams, queueOfflineOperation, user]
  );

  /**
   * Update an existing dream
   */
  const updateDream = useCallback(
    async (updatedDream: DreamAnalysis) => {
      const normalizedDream = normalizeDreamImages(updatedDream);
      const currentDreams = dreamsRef.current;

      if (!canUseRemoteSync) {
        const newDreams = currentDreams.map((d) => (d.id === normalizedDream.id ? normalizedDream : d));
        await persistLocalDreams(newDreams);
        return;
      }

      const remoteId = normalizedDream.remoteId ?? resolveRemoteId(normalizedDream.id);

      const queueAndPersist = async (pendingVersion: DreamAnalysis) => {
        await queueOfflineOperation(
          {
            id: generateMutationId(),
            type: 'update',
            createdAt: Date.now(),
            dream: pendingVersion,
          },
          (prev) => upsertDream(prev, normalizeDreamImages(pendingVersion))
        );
      };

      if (!remoteId) {
        const pendingVersion = { ...normalizedDream, pendingSync: true };
        await queueAndPersist(pendingVersion);
        return;
      }

      if (!hasNetwork) {
        const pendingVersion = { ...normalizedDream, pendingSync: true, remoteId };
        await queueAndPersist(pendingVersion);
        return;
      }

      try {
        const saved = await updateDreamInSupabase({ ...normalizedDream, remoteId });
        const merged = normalizedDream.imageUpdatedAt
          ? { ...saved, imageUpdatedAt: normalizedDream.imageUpdatedAt }
          : saved;
        await persistRemoteDreams((prev) => upsertDream(prev, merged));
      } catch (error) {
        logger.warn('Falling back to offline dream update', error);
        const pendingVersion = { ...normalizedDream, pendingSync: true, remoteId };
        await queueAndPersist(pendingVersion);
      }
    },
    [canUseRemoteSync, dreamsRef, hasNetwork, persistLocalDreams, persistRemoteDreams, queueOfflineOperation, resolveRemoteId]
  );

  /**
   * Delete a dream
   */
  const deleteDream = useCallback(
    async (dreamId: number) => {
      const currentDreams = dreamsRef.current;

      if (!canUseRemoteSync) {
        const newDreams = currentDreams.filter((d) => d.id !== dreamId);
        await persistLocalDreams(newDreams);
        return;
      }

      const remoteId = resolveRemoteId(dreamId);
      if (!remoteId) {
        const removed = await clearQueuedMutationsForDream(dreamId);
        if (!removed) {
          throw new Error('Missing remote id for Supabase dream delete');
        }
        await persistRemoteDreams((prev) => removeDream(prev, dreamId));
        return;
      }

      const queueAndPersist = async () => {
        await clearQueuedMutationsForDream(dreamId);
        await queueOfflineOperation(
          {
            id: generateMutationId(),
            type: 'delete',
            createdAt: Date.now(),
            dreamId,
            remoteId,
          },
          (prev) => removeDream(prev, dreamId, remoteId)
        );
      };

      if (!hasNetwork) {
        await queueAndPersist();
        return;
      }

      try {
        await clearQueuedMutationsForDream(dreamId);
        await deleteDreamFromSupabase(remoteId);
        await persistRemoteDreams((prev) => removeDream(prev, dreamId, remoteId));
      } catch (error) {
        logger.warn('Falling back to offline dream delete', error);
        await queueAndPersist();
      }
    },
    [canUseRemoteSync, clearQueuedMutationsForDream, dreamsRef, hasNetwork, persistLocalDreams, persistRemoteDreams, queueOfflineOperation, resolveRemoteId]
  );

  /**
   * Toggle dream favorite status
   */
  const toggleFavorite = useCallback(
    async (dreamId: number) => {
      const currentDreams = dreamsRef.current;
      const existing = currentDreams.find((d) => d.id === dreamId);
      if (!existing) return;

      const updated = { ...existing, isFavorite: !existing.isFavorite };
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
          {
            id: generateMutationId(),
            type: 'update',
            createdAt: Date.now(),
            dream: pendingVersion,
          },
          (prev) => upsertDream(prev, pendingVersion)
        );
      };

      if (!hasNetwork) {
        const pendingVersion = { ...updated, pendingSync: true };
        await queueAndPersist(pendingVersion);
        return;
      }

      if (!remoteId) {
        await rollbackFavorite();
        throw new Error('Missing remote id for Supabase dream update');
      }

      try {
        const saved = await updateDreamInSupabase({ ...updated, remoteId });
        const merged = updated.imageUpdatedAt ? { ...saved, imageUpdatedAt: updated.imageUpdatedAt } : saved;
        await persistRemoteDreams((prev) => upsertDream(prev, merged));
      } catch (error) {
        await rollbackFavorite();
        throw error;
      }
    },
    [canUseRemoteSync, dreamsRef, hasNetwork, persistLocalDreams, persistRemoteDreams, queueOfflineOperation, resolveRemoteId]
  );

  /**
   * Analyze a dream (separate from recording)
   * Checks quota, calls AI analysis API, and updates dream with results
   */
  const analyzeDream = useCallback(
    async (
      dreamId: number,
      transcript: string,
      options?: { replaceExistingImage?: boolean; lang?: string }
    ): Promise<DreamAnalysis> => {
      // Check quota before analyzing
      const canAnalyze = await quotaService.canAnalyzeDream(user);
      if (!canAnalyze) {
        const tier = user ? 'free' : 'guest';
        throw new QuotaError(QuotaErrorCode.ANALYSIS_LIMIT_REACHED, tier);
      }

      const shouldReplaceImage = options?.replaceExistingImage ?? true;

      // Find the dream to update
      const dream = dreamsRef.current.find((d) => d.id === dreamId);
      if (!dream) {
        throw new Error(`Dream with id ${dreamId} not found`);
      }

      // Generate request ID for idempotence
      const requestId = generateUUID();

      // Initial pending state
      const currentDreamState: DreamAnalysis = {
        ...dream,
        analysisStatus: 'pending',
        analysisRequestId: requestId,
      };
      await updateDream(currentDreamState);

      // Get fingerprint for guest users to enable server-side quota tracking
      const fingerprint = !user ? await getDeviceFingerprint() : undefined;

      // Kick off analysis and image generation in parallel
      const analysisPromise = analyzeDreamText(transcript, options?.lang, fingerprint);
      const imagePromise = shouldReplaceImage
        ? generateImageFromTranscript(transcript, dream.imageUrl)
            .then((url) => ({ url, failed: false as const }))
            .catch((err) => {
              logger.warn('Image generation failed', err);
              return { url: dream.imageUrl, failed: true as const };
            })
        : Promise.resolve({ url: dream.imageUrl, failed: false as const });

      try {
        const [analysis, imageResult] = await Promise.all([analysisPromise, imagePromise]);
        const { imagePrompt: _unusedImagePrompt, quotaUsed, ...analysisFields } = analysis;

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

        const imageUrl = imageResult.url;
        const imageSource: DreamAnalysis['imageSource'] =
          imageUrl && imageUrl !== dream.imageUrl ? 'ai' : dream.imageSource;
        const imageUpdatedAt =
          imageUrl && imageUrl !== dream.imageUrl ? Date.now() : dream.imageUpdatedAt;
        const thumbnailUrl =
          imageUrl && (shouldReplaceImage || !dream.thumbnailUrl)
            ? getThumbnailUrl(imageUrl)
            : dream.thumbnailUrl;

        const imageFailedWithoutImage =
          shouldReplaceImage && !!imageResult.failed && !imageUrl && !dream.imageUrl;

        const next: DreamAnalysis = {
          ...currentDreamState,
          ...analysisFields,
          imageUrl,
          thumbnailUrl,
          imageSource,
          imageUpdatedAt,
          imageGenerationFailed: imageFailedWithoutImage,
          analysisStatus: 'done',
          analyzedAt: Date.now(),
          isAnalyzed: true,
        };
        await updateDream(next);

        if (isMockMode) {
          await markMockAnalysis({ id: dreamId });
        }

        quotaService.invalidate(user);
        return next;
      } catch (error) {
        const failedDream: DreamAnalysis = {
          ...currentDreamState,
          analysisStatus: 'failed',
        };
        await updateDream(failedDream);
        throw error;
      }
    },
    [dreamsRef, updateDream, user]
  );

  return {
    dreams,
    loaded,
    addDream,
    updateDream,
    deleteDream,
    toggleFavorite,
    analyzeDream,
  };
};
