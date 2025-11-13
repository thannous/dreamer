import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNetworkState } from 'expo-network';

import type { DreamAnalysis, DreamMutation } from '@/lib/types';
import {
  getCachedRemoteDreams,
  getPendingDreamMutations,
  getSavedDreams,
  saveCachedRemoteDreams,
  saveDreams,
  savePendingDreamMutations,
} from '@/services/storageService';
import {
  createDreamInSupabase,
  deleteDreamFromSupabase,
  fetchDreamsFromSupabase,
  updateDreamInSupabase,
} from '@/services/supabaseDreamService';
import { useAuth } from '@/context/AuthContext';
import { quotaService } from '@/services/quotaService';
import { QuotaError, QuotaErrorCode } from '@/lib/errors';
import { analyzeDreamWithImageResilient } from '@/services/geminiService';

// Guest limit centralized in constants/limits

type DreamListUpdater = DreamAnalysis[] | ((list: DreamAnalysis[]) => DreamAnalysis[]);

const sortDreams = (list: DreamAnalysis[]): DreamAnalysis[] => [...list].sort((a, b) => b.id - a.id);

const generateMutationId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Generate a simple UUID v4-like string for analysis request idempotence
 */
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const upsertDream = (list: DreamAnalysis[], dream: DreamAnalysis): DreamAnalysis[] => {
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

const removeDream = (list: DreamAnalysis[], dreamId: number, remoteId?: number): DreamAnalysis[] =>
  list.filter((d) => {
    const idMatches = d.id === dreamId;
    const remoteMatches = remoteId != null && d.remoteId === remoteId;
    return !idMatches && !remoteMatches;
  });

const hasPendingMutationsForDream = (mutations: DreamMutation[], dreamId: number): boolean =>
  mutations.some((mutation) =>
    mutation.type === 'delete' ? mutation.dreamId === dreamId : mutation.dream.id === dreamId
  );

const applyPendingMutations = (source: DreamAnalysis[], mutations: DreamMutation[]): DreamAnalysis[] => {
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
  const [dreams, setDreams] = useState<DreamAnalysis[]>([]);
  const [loaded, setLoaded] = useState(false);
  const dreamsRef = useRef<DreamAnalysis[]>([]);
  const pendingMutationsRef = useRef<DreamMutation[]>([]);
  const syncingRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    dreamsRef.current = dreams;
  }, [dreams]);

  const persistLocalDreams = useCallback(async (newDreams: DreamAnalysis[]) => {
    const sorted = sortDreams(newDreams);
    setDreams(sorted);
    await saveDreams(sorted);
  }, []);

  const persistRemoteDreams = useCallback(
    async (updater: DreamListUpdater) => {
      if (!canUseRemoteSync) return;
      const resolved = typeof updater === 'function' ? updater(dreamsRef.current) : updater;
      const sorted = sortDreams(resolved);
      setDreams(sorted);
      await saveCachedRemoteDreams(sorted);
    },
    [canUseRemoteSync, saveCachedRemoteDreams]
  );

  const persistPendingMutations = useCallback(
    async (mutations: DreamMutation[]) => {
      pendingMutationsRef.current = mutations;
      if (!canUseRemoteSync) return;
      await savePendingDreamMutations(mutations);
    },
    [canUseRemoteSync, savePendingDreamMutations]
  );

  const appendPendingMutation = useCallback(
    async (mutation: DreamMutation) => {
      await persistPendingMutations([...pendingMutationsRef.current, mutation]);
    },
    [persistPendingMutations]
  );

  const queueOfflineOperation = useCallback(
    async (mutation: DreamMutation, updater: DreamListUpdater) => {
      await persistRemoteDreams(updater);
      await appendPendingMutation(mutation);
    },
    [appendPendingMutation, persistRemoteDreams]
  );

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

  const migrateGuestDreamsToSupabase = useCallback(async () => {
    if (!canUseRemoteSync || !user) return;
    const localDreams = await getSavedDreams();
    const unsynced = localDreams.filter((dream) => !dream.remoteId);
    if (!unsynced.length) return;

    for (const dream of unsynced) {
      await createDreamInSupabase(dream, user.id);
    }

    await saveDreams([]);
  }, [canUseRemoteSync, user]);

  useEffect(() => {
    let mounted = true;

    const loadDreams = async () => {
      setLoaded(false);
      try {
        if (!canUseRemoteSync) {
          pendingMutationsRef.current = [];
          const localDreams = await getSavedDreams();
          if (mounted) {
            setDreams(sortDreams(localDreams));
          }
          return;
        }

        const pending = await getPendingDreamMutations();
        pendingMutationsRef.current = pending;
        try {
          await migrateGuestDreamsToSupabase();
        } catch (migrationError) {
          if (__DEV__) {
            console.warn('Failed to migrate guest dreams', migrationError);
          }
        }

        try {
          const remoteDreams = await fetchDreamsFromSupabase();
          await saveCachedRemoteDreams(sortDreams(remoteDreams));
          const hydrated = applyPendingMutations(remoteDreams, pending);
          if (mounted) {
            setDreams(hydrated);
          }
        } catch (error) {
          if (__DEV__) {
            console.error('Failed to load dreams', error);
          }
          const cached = await getCachedRemoteDreams();
          const fallback = applyPendingMutations(cached, pending);
          if (mounted) {
            setDreams(fallback);
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error('Failed to load dreams', error);
        }
        if (mounted) {
          setDreams([]);
        }
      } finally {
        if (mounted) {
          setLoaded(true);
        }
      }
    };

    loadDreams();

    return () => {
      mounted = false;
    };
  }, [canUseRemoteSync, migrateGuestDreamsToSupabase]);

  const addDream = useCallback(
    async (dream: DreamAnalysis): Promise<DreamAnalysis> => {
      const currentDreams = dreamsRef.current;

      // Note: Guest dream limit has been removed.
      // Quota is now enforced on analysis (not recording).
      // See quotaService for analysis quota enforcement.

      if (!canUseRemoteSync) {
        await persistLocalDreams([dream, ...currentDreams]);
        return dream;
      }

      const queueAndPersist = async () => {
        const queuedDream = { ...dream, pendingSync: true };
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
        const saved = await createDreamInSupabase(dream, user!.id);
        await persistRemoteDreams((prev) => upsertDream(prev, saved));
        return saved;
      } catch (error) {
        if (__DEV__) {
          console.warn('Falling back to offline dream creation', error);
        }
        return queueAndPersist();
      }
    },
    [appendPendingMutation, canUseRemoteSync, hasNetwork, persistLocalDreams, persistRemoteDreams, queueOfflineOperation, user]
  );

  const resolveRemoteId = useCallback((dreamId: number): number | undefined => {
    const target = dreamsRef.current.find((d) => d.id === dreamId);
    return target?.remoteId;
  }, []);

  const updateDream = useCallback(
    async (updatedDream: DreamAnalysis) => {
      const currentDreams = dreamsRef.current;

      if (!canUseRemoteSync) {
        const newDreams = currentDreams.map((d) => (d.id === updatedDream.id ? updatedDream : d));
        await persistLocalDreams(newDreams);
        return;
      }

      const remoteId = updatedDream.remoteId ?? resolveRemoteId(updatedDream.id);

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

      if (!remoteId) {
        const pendingVersion = { ...updatedDream, pendingSync: true };
        await queueAndPersist(pendingVersion);
        return;
      }

      if (!hasNetwork) {
        const pendingVersion = { ...updatedDream, pendingSync: true, remoteId };
        await queueAndPersist(pendingVersion);
        return;
      }

      try {
        const saved = await updateDreamInSupabase({ ...updatedDream, remoteId });
        await persistRemoteDreams((prev) => upsertDream(prev, saved));
      } catch (error) {
        if (__DEV__) {
          console.warn('Falling back to offline dream update', error);
        }
        const pendingVersion = { ...updatedDream, pendingSync: true, remoteId };
        await queueAndPersist(pendingVersion);
      }
    },
    [canUseRemoteSync, clearQueuedMutationsForDream, hasNetwork, persistLocalDreams, queueOfflineOperation, resolveRemoteId, persistRemoteDreams]
  );

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
        if (__DEV__) {
          console.warn('Falling back to offline dream delete', error);
        }
        await queueAndPersist();
      }
    },
    [canUseRemoteSync, hasNetwork, persistLocalDreams, queueOfflineOperation, resolveRemoteId, persistRemoteDreams]
  );

  const toggleFavorite = useCallback(
    async (dreamId: number) => {
      const currentDreams = dreamsRef.current;
      const newDreams = currentDreams.map((d) =>
        d.id === dreamId ? { ...d, isFavorite: !d.isFavorite } : d
      );

      if (!canUseRemoteSync) {
        await persistLocalDreams(newDreams);
        return;
      }

      const updated = newDreams.find((d) => d.id === dreamId);
      if (!updated) return;

      const remoteId = updated.remoteId ?? resolveRemoteId(dreamId);
      if (!remoteId) {
        throw new Error('Missing remote id for Supabase dream update');
      }

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

      try {
        const saved = await updateDreamInSupabase({ ...updated, remoteId });
        await persistRemoteDreams((prev) => upsertDream(prev, saved));
      } catch (error) {
        if (__DEV__) {
          console.warn('Falling back to offline favorite toggle', error);
        }
        const pendingVersion = { ...updated, pendingSync: true };
        await queueAndPersist(pendingVersion);
      }
    },
    [canUseRemoteSync, hasNetwork, persistLocalDreams, queueOfflineOperation, resolveRemoteId, persistRemoteDreams]
  );

  const syncPendingMutations = useCallback(async () => {
    if (!canUseRemoteSync || !user || !hasNetwork) return;
    if (!pendingMutationsRef.current.length || syncingRef.current) return;
    syncingRef.current = true;
    try {
      let queue = [...pendingMutationsRef.current];
      while (queue.length) {
        const mutation = queue[0];
        try {
          if (mutation.type === 'create') {
            const created = await createDreamInSupabase(mutation.dream, user.id);
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
            await persistRemoteDreams((prev) =>
              prev.map((d) => {
                if (d.id !== mutation.dream.id) return d;
                return stillPending
                  ? { ...d, id: created.id, remoteId: created.remoteId }
                  : { ...created, id: created.id, pendingSync: undefined };
              })
            );
          } else if (mutation.type === 'update') {
            const remoteId = mutation.dream.remoteId ?? resolveRemoteId(mutation.dream.id);
            if (!remoteId) {
              throw new Error('Missing remote id for Supabase dream update');
            }
            const saved = await updateDreamInSupabase({ ...mutation.dream, remoteId });
            queue.shift();
            const stillPending = hasPendingMutationsForDream(queue, mutation.dream.id);
            await persistRemoteDreams((prev) =>
              prev.map((d) => {
                if (d.id !== mutation.dream.id) return d;
                if (stillPending) {
                  return d;
                }
                return { ...saved, id: d.id, pendingSync: undefined };
              })
            );
          } else if (mutation.type === 'delete') {
            const remoteId = mutation.remoteId ?? resolveRemoteId(mutation.dreamId);
            if (!remoteId) {
              throw new Error('Missing remote id for Supabase dream delete');
            }
            await deleteDreamFromSupabase(remoteId);
            queue.shift();
            await persistRemoteDreams((prev) => removeDream(prev, mutation.dreamId, remoteId));
          }
        } catch (error) {
          if (__DEV__) {
            console.warn('Failed to sync offline mutation', error);
          }
          break;
        }
      }
      await persistPendingMutations(queue);
    } finally {
      syncingRef.current = false;
    }
  }, [canUseRemoteSync, hasNetwork, persistPendingMutations, persistRemoteDreams, resolveRemoteId, user]);

  useEffect(() => {
    syncPendingMutations();
  }, [syncPendingMutations]);

  /**
   * Analyze a dream (separate from recording)
   * Checks quota, calls AI analysis API, and updates dream with results
   */
  const analyzeDream = useCallback(
    async (dreamId: number, transcript: string): Promise<DreamAnalysis> => {
      // Check quota before analyzing
      const canAnalyze = await quotaService.canAnalyzeDream(user);
      if (!canAnalyze) {
        const tier = user ? 'free' : 'guest';
        throw new QuotaError(QuotaErrorCode.ANALYSIS_LIMIT_REACHED, tier);
      }

      // Find the dream to update
      const dream = dreamsRef.current.find((d) => d.id === dreamId);
      if (!dream) {
        throw new Error(`Dream with id ${dreamId} not found`);
      }

      // Generate request ID for idempotence
      const requestId = generateUUID();

      // Update dream status to pending
      const pendingDream: DreamAnalysis = {
        ...dream,
        analysisStatus: 'pending',
        analysisRequestId: requestId,
      };
      await updateDream(pendingDream);

      try {
        // Call AI analysis API
        const analysis = await analyzeDreamWithImageResilient(transcript);

        // Update dream with analysis results
        const analyzedDream: DreamAnalysis = {
          ...dream,
          title: analysis.title,
          interpretation: analysis.interpretation,
          shareableQuote: analysis.shareableQuote,
          imageUrl: analysis.imageUrl,
          thumbnailUrl: analysis.imageUrl,
          theme: analysis.theme,
          dreamType: analysis.dreamType,
          imageGenerationFailed: analysis.imageGenerationFailed,
          isAnalyzed: true,
          analyzedAt: Date.now(),
          analysisStatus: 'done',
          analysisRequestId: requestId,
        };

        await updateDream(analyzedDream);

        // Invalidate quota cache
        quotaService.invalidate(user);

        return analyzedDream;
      } catch (error) {
        // Mark analysis as failed
        const failedDream: DreamAnalysis = {
          ...dream,
          analysisStatus: 'failed',
          analysisRequestId: requestId,
        };
        await updateDream(failedDream);

        throw error;
      }
    },
    [user, updateDream]
  );

  const guestLimitReached = false;

  return {
    dreams,
    loaded,
    guestLimitReached,
    addDream,
    updateDream,
    deleteDream,
    toggleFavorite,
    analyzeDream,
  };
};
