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
import { getAccessToken } from '../lib/auth';
import { logger } from '../lib/logger';
import type { DreamAnalysis, DreamMutation } from '../lib/types';
import {
  applyPendingMutations,
  areDreamsEqualForLocalState,
  type DreamListUpdater,
  normalizeDreamList,
  resolveDreamListUpdater,
  sortDreams,
  upsertDream,
} from '../lib/dreamUtils';
import {
  getDreamsMigrationSynced,
  getCachedRemoteDreams,
  getPendingDreamMutations,
  getSavedDreams,
  saveCachedRemoteDreams,
  setDreamsMigrationSynced,
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

const areDreamListsEqual = (left: DreamAnalysis[], right: DreamAnalysis[]): boolean => {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (!areDreamsEqualForLocalState(left[index], right[index])) {
      return false;
    }
  }
  return true;
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
  // ✅ FIX: Extract only userId to prevent unnecessary re-renders when user object changes
  const userId = user?.id;
  const [dreams, setDreams] = useState<DreamAnalysis[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pendingMutations, setPendingMutations] = useState<DreamMutation[]>([]);
  const dreamsRef = useRef<DreamAnalysis[]>([]);

  const ensureAccessToken = useCallback(
    async (options?: { retries?: number; delayMs?: number; logLabel?: string }): Promise<boolean> => {
      const retries = options?.retries ?? 0;
      const delayMs = options?.delayMs ?? 200;

      for (let attempt = 0; attempt <= retries; attempt += 1) {
        const token = await getAccessToken();
        if (token) return true;
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      if (options?.logLabel) {
        logger.warn(options.logLabel);
      }
      return false;
    },
    [getAccessToken, logger]
  );

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
    if (areDreamListsEqual(dreamsRef.current, sorted)) {
      return;
    }
    dreamsRef.current = sorted;
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
      if (areDreamListsEqual(dreamsRef.current, sorted)) {
        return;
      }
      dreamsRef.current = sorted;
      setDreams(sorted);
      await saveCachedRemoteDreams(sorted);
    },
    [canUseRemoteSync]
  );

  /**
   * Migrate guest dreams to Supabase when user logs in
   */
  const migrateGuestDreamsToSupabase = useCallback(async () => {
    if (!canUseRemoteSync || !userId) return;
    const hasSession = await ensureAccessToken({
      retries: 1,
      delayMs: 150,
      logLabel: '[useDreamPersistence] Skipping guest dream migration: auth session not ready',
    });
    if (!hasSession) return;
    const localDreams = await getSavedDreams();
    const unsynced = localDreams.filter((dream) => !dream.remoteId);
    if (!unsynced.length) return;

    for (const dream of unsynced) {
      const clientRequestId =
        dream.clientRequestId ?? (typeof dream.id === 'number' ? `dream-${dream.id}` : undefined);
      await createDreamInSupabase(
        clientRequestId ? { ...dream, clientRequestId } : dream,
        userId // ✅ FIX: Use userId directly instead of user object
      );
    }

    await saveDreams([]);
  }, [canUseRemoteSync, ensureAccessToken, userId]); // ✅ FIX: Depend on userId instead of full user object

  /**
   * Migrate unsynced dreams to Supabase (one-shot migration)
   * Pulls unsynced creations from local storage/pending queue instead of remote cache
   */
  const migrateUnsyncedDreams = useCallback(async () => {
    // Guard: only if authenticated + remote sync enabled + network available
    if (!canUseRemoteSync || !userId) return;

    // One-shot: check if already migrated (flag stored locally per user)
    const alreadyMigrated = await getDreamsMigrationSynced(userId);
    if (alreadyMigrated) return;

    const hasSession = await ensureAccessToken({
      retries: 3,
      delayMs: 200,
      logLabel: '[useDreamPersistence] Skipping unsynced dream migration: auth session not ready',
    });
    if (!hasSession) return;

    try {
      // Prefer local sources: pending mutation queue + cached/local storage
      const [pendingMutationsFromStorage, cachedRemoteDreams, localDreams] = await Promise.all([
        getPendingDreamMutations(),
        getCachedRemoteDreams(),
        getSavedDreams(),
      ]);

      const candidates: DreamAnalysis[] = [
        ...pendingMutationsFromStorage
          .filter((mutation) => mutation.type === 'create')
          .map((mutation) => mutation.dream)
          .filter((dream) => !dream.remoteId),
        ...cachedRemoteDreams.filter((dream) => !dream.remoteId),
        ...localDreams.filter((dream) => !dream.remoteId),
      ];

      // Deduplicate by clientRequestId (or fallback to local id)
      const seen = new Set<string>();
      const unsynced = candidates.filter((dream) => {
        const key = dream.clientRequestId ?? `id-${dream.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (unsynced.length === 0) {
        await setDreamsMigrationSynced(userId, true);
        return;
      }

      logger.debug(`Migrating ${unsynced.length} unsynced dreams`);

      // Sync each dream one by one
      let hadFailures = false;
      for (const dream of unsynced) {
        try {
          // Ensure clientRequestId for idempotence (prevent duplicates if dream already on server)
          const dreamToSync = dream.clientRequestId
            ? dream
            : { ...dream, clientRequestId: `dream-${dream.id}` };

          // createDreamInSupabase does upsert on (user_id, client_request_id)
          // If dream exists on server, fetches just remoteId without creating duplicate
          const synced = await createDreamInSupabase(dreamToSync, userId);

          // IMPORTANT: synced.id may differ from dream.id (reconstructed from server's created_at)
          // upsertDream matches by id OR remoteId, so will correctly update the dream
          await persistRemoteDreams((prev) => upsertDream(prev, synced));

          logger.debug(`Migrated dream ${dream.id} → remoteId ${synced.remoteId}`);
        } catch (error) {
          logger.warn('Migration failed for dream', dream.id, error);
          hadFailures = true;
          // Continue with others (don't block entire migration)
        }
      }

      if (!hadFailures) {
        await setDreamsMigrationSynced(userId, true);
      }
    } catch (error) {
      logger.error('Background migration failed', error);
      // Don't mark as migrated in case of catastrophic failure
    }
  }, [canUseRemoteSync, ensureAccessToken, userId, persistRemoteDreams]);

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
          const nextDreams = sortDreams(normalizeDreamList(localDreams));
          if (!areDreamListsEqual(dreamsRef.current, nextDreams)) {
            dreamsRef.current = nextDreams;
            setDreams(nextDreams);
          }
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
        const hasSession = await ensureAccessToken({
          retries: 5,
          delayMs: 250,
          logLabel: '[useDreamPersistence] Skipping remote dream load: auth session not ready',
        });

        if (!hasSession) {
          const fallback = normalizeDreamList(applyPendingMutations(cached, pendingMutations));
          if (mounted.current) {
            const nextDreams = sortDreams(fallback);
            if (!areDreamListsEqual(dreamsRef.current, nextDreams)) {
              dreamsRef.current = nextDreams;
              setDreams(nextDreams);
            }
            setPendingMutations(pendingMutations);
          }
          return { pendingMutations };
        }

        const remoteDreams = await fetchDreamsFromSupabase();
        const normalizedRemote = normalizeDreamList(remoteDreams);
        await saveCachedRemoteDreams(sortDreams(normalizedRemote));
        const hydrated = normalizeDreamList(applyPendingMutations(normalizedRemote, pendingMutations));
        const nextDreams = sortDreams(hydrated);
        if (mounted.current) {
          if (!areDreamListsEqual(dreamsRef.current, nextDreams)) {
            dreamsRef.current = nextDreams;
            setDreams(nextDreams);
          }
        }
      } catch (error) {
        logger.error('Failed to load dreams from remote', error);
        // Use pre-fetched cached dreams instead of sequential read
        const fallback = normalizeDreamList(applyPendingMutations(cached, pendingMutations));
        if (mounted.current) {
          const nextDreams = sortDreams(fallback);
          if (!areDreamListsEqual(dreamsRef.current, nextDreams)) {
            dreamsRef.current = nextDreams;
            setDreams(nextDreams);
          }
        }
      }

      // Run unsynced dreams migration in background (one-shot, non-blocking)
      migrateUnsyncedDreams().catch((err) => {
        logger.warn('Background migration of unsynced dreams failed', err);
      });

      if (mounted.current) {
        setPendingMutations(pendingMutations);
      }

      return { pendingMutations };
    } catch (error) {
      logger.error('Failed to load dreams', error);
      if (mounted.current) {
        if (dreamsRef.current.length > 0) {
          dreamsRef.current = [];
          setDreams([]);
        }
        setPendingMutations([]);
      }
      return { pendingMutations: [] };
    } finally {
      if (mounted.current) {
        setLoaded(true);
      }
    }
  }, [canUseRemoteSync, migrateGuestDreamsToSupabase, migrateUnsyncedDreams]);

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
