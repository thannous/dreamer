/**
 * useDreamPersistence - Handles dream storage and loading
 *
 * Responsibilities:
 * - Load dreams from local storage (guest) or Supabase (authenticated)
 * - Persist dreams to appropriate storage
 * - Migrate guest dreams to Supabase on login
 * - Normalize dream images (derive thumbnails)
 *
 * This hook is extracted from useDreamJournal for better separation of concerns.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { logger } from '../lib/logger';
import type { DreamAnalysis, DreamMutation } from '../lib/types';
import {
  applyPendingMutations,
  type DreamListUpdater,
  normalizeDreamList,
  resolveDreamListUpdater,
  sortDreams,
} from '../lib/dreamUtils';
import {
  getCachedRemoteDreams,
  getPendingDreamMutations,
  getSavedDreams,
  saveCachedRemoteDreams,
  saveDreams,
} from '../services/storageService';
import {
  createDreamInSupabase,
  fetchDreamsFromSupabase,
} from '../services/supabaseDreamService';

export type UseDreamPersistenceOptions = {
  /** Whether remote sync is enabled (authenticated + not mock mode) */
  canUseRemoteSync: boolean;
};

export type UseDreamPersistenceResult = {
  /** Current list of dreams */
  dreams: DreamAnalysis[];
  /** Whether initial load has completed */
  loaded: boolean;
  /** Pending mutations loaded from storage */
  pendingMutations: DreamMutation[];
  /** Ref to current dreams for use in callbacks */
  dreamsRef: React.RefObject<DreamAnalysis[]>;
  /** Persist dreams to local storage (guest mode) */
  persistLocalDreams: (dreams: DreamAnalysis[]) => Promise<void>;
  /** Persist dreams to remote cache (authenticated mode) */
  persistRemoteDreams: (updater: DreamListUpdater) => Promise<void>;
  /** Reload dreams from storage/server */
  reloadDreams: () => Promise<void>;
};

/**
 * Hook for managing dream persistence (storage/loading)
 *
 * @param options - Configuration options
 * @returns Dream persistence state and actions
 */
export function useDreamPersistence({
  canUseRemoteSync,
}: UseDreamPersistenceOptions): UseDreamPersistenceResult {
  const { user } = useAuth();
  const [dreams, setDreams] = useState<DreamAnalysis[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pendingMutations, setPendingMutations] = useState<DreamMutation[]>([]);
  const dreamsRef = useRef<DreamAnalysis[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    dreamsRef.current = dreams;
  }, [dreams]);

  /**
   * Persist dreams to local storage (for guest users)
   */
  const persistLocalDreams = useCallback(async (newDreams: DreamAnalysis[]) => {
    const normalized = normalizeDreamList(newDreams);
    const sorted = sortDreams(normalized);
    setDreams(sorted);
    await saveDreams(sorted);
  }, []);

  /**
   * Persist dreams to remote cache (for authenticated users)
   */
  const persistRemoteDreams = useCallback(
    async (updater: DreamListUpdater) => {
      if (!canUseRemoteSync) return;
      const resolved = resolveDreamListUpdater(updater, dreamsRef.current);
      const normalized = normalizeDreamList(resolved);
      const sorted = sortDreams(normalized);
      setDreams(sorted);
      await saveCachedRemoteDreams(sorted);
    },
    [canUseRemoteSync]
  );

  /**
   * Migrate guest dreams to Supabase when user logs in
   */
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

  /**
   * Load dreams from storage/server
   */
  const loadDreams = useCallback(async (mounted: { current: boolean }) => {
    setLoaded(false);
    let pendingMutations: DreamMutation[] = [];

    try {
      if (!canUseRemoteSync) {
        const localDreams = await getSavedDreams();
        if (mounted.current) {
          setDreams(sortDreams(normalizeDreamList(localDreams)));
          setPendingMutations([]);
        }
        return { pendingMutations: [] };
      }

      // Parallelize initial reads - fetch pending mutations and cached dreams simultaneously
      // This saves 500-1500ms on app startup
      const [pendingResult, cachedResult] = await Promise.allSettled([
        getPendingDreamMutations(),
        getCachedRemoteDreams(),
      ]);

      pendingMutations = pendingResult.status === 'fulfilled' ? pendingResult.value : [];
      const cached = cachedResult.status === 'fulfilled' ? cachedResult.value : [];

      try {
        await migrateGuestDreamsToSupabase();
      } catch (migrationError) {
        logger.warn('Failed to migrate guest dreams', migrationError);
      }

      try {
        const remoteDreams = await fetchDreamsFromSupabase();
        const normalizedRemote = normalizeDreamList(remoteDreams);
        await saveCachedRemoteDreams(sortDreams(normalizedRemote));
        const hydrated = normalizeDreamList(applyPendingMutations(normalizedRemote, pendingMutations));
        if (mounted.current) {
          setDreams(sortDreams(hydrated));
        }
      } catch (error) {
        logger.error('Failed to load dreams from remote', error);
        // Use pre-fetched cached dreams instead of sequential read
        const fallback = normalizeDreamList(applyPendingMutations(cached, pendingMutations));
        if (mounted.current) {
          setDreams(sortDreams(fallback));
        }
      }

      if (mounted.current) {
        setPendingMutations(pendingMutations);
      }

      return { pendingMutations };
    } catch (error) {
      logger.error('Failed to load dreams', error);
      if (mounted.current) {
        setDreams([]);
        setPendingMutations([]);
      }
      return { pendingMutations: [] };
    } finally {
      if (mounted.current) {
        setLoaded(true);
      }
    }
  }, [canUseRemoteSync, migrateGuestDreamsToSupabase]);

  /**
   * Public reload function
   */
  const reloadDreams = useCallback(async () => {
    const mounted = { current: true };
    await loadDreams(mounted);
  }, [loadDreams]);

  // Initial load effect
  useEffect(() => {
    const mounted = { current: true };
    loadDreams(mounted);
    return () => {
      mounted.current = false;
    };
  }, [loadDreams]);

  return {
    dreams,
    loaded,
    pendingMutations,
    dreamsRef,
    persistLocalDreams,
    persistRemoteDreams,
    reloadDreams,
  };
}
