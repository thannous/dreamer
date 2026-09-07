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

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { getAccessToken } from '../lib/auth';
import { DreamPersistenceError } from '../lib/dreamStorageRead';
import { logger } from '../lib/logger';
import { reportSyncQueueMetrics } from '../lib/syncObservability';
import type { DreamAnalysis, DreamListReadResult, DreamMutation } from '../lib/types';
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
  getGuestDreamMigrationOwner,
  getCachedRemoteDreams,
  getPendingDreamMutations,
  getSavedDreams,
  saveCachedRemoteDreams,
  setDreamsMigrationSynced,
  saveDreams,
  setGuestDreamMigrationOwner,
} from '../services/storageService';
import {
  createDreamInSupabase,
  fetchDreamsFromSupabase,
} from '../services/supabaseDreamService';

export type UseDreamPersistenceOptions = {
  /** Whether remote sync is enabled (authenticated + not mock mode) */
  canUseRemoteSync: boolean;
};

export type DreamRefreshState = { status: 'idle' | 'refreshing' | 'error' };

type LoadOperation = { isCurrent: () => boolean };

export type DreamPersistenceState =
  | { status: 'loading' | 'ready' | 'saving'; target: 'device' | 'remote-cache' }
  | {
      status: 'error';
      operation: 'read' | 'write';
      target: 'device' | 'remote-cache';
    };

export type UseDreamPersistenceResult = {
  /** Current list of dreams */
  dreams: DreamAnalysis[];
  /** Whether initial load has completed */
  loaded: boolean;
  /** Pending mutations loaded from storage */
  pendingMutations: DreamMutation[];
  /** Whether the durable mutation queue was read successfully for this scope. */
  pendingMutationsLoaded: boolean;
  /** Storage scope that produced the pending mutation snapshot. */
  pendingMutationsScope: string | null;
  /** Device persistence state, separate from per-dream cloud synchronization. */
  persistenceState: DreamPersistenceState;
  refreshState: DreamRefreshState;
  remoteSnapshot: { userScope: string | null; dreams: DreamAnalysis[] } | null;
  /** Ref to current dreams for use in callbacks */
  dreamsRef: React.RefObject<DreamAnalysis[]>;
  /** Persist dreams to local storage (guest mode) */
  persistLocalDreams: (dreams: DreamAnalysis[]) => Promise<void>;
  /** Persist dreams to remote cache (authenticated mode) */
  persistRemoteDreams: (updater: DreamListUpdater) => Promise<void>;
  /** Reload dreams from storage/server */
  reloadDreams: () => Promise<void>;
  /** Retry the last failed read or write for the active scope. */
  retryPersistence: () => Promise<void>;
};

type WriteScopeState = {
  durable: DreamAnalysis[] | null;
  hydrated: boolean;
  sequence: number;
  pendingCount: number;
  tail: Promise<void>;
  failed: { sequence: number; dreams: DreamAnalysis[] } | null;
  loadToken: number;
};

type GuestMigrationClaimOutcome<T> = {
  value: T;
  release: boolean;
};

const guestMigrationClaim: {
  ownerUserId: string | null;
  tail: Promise<void>;
} = {
  ownerUserId: null,
  tail: Promise.resolve(),
};

const runWithGuestMigrationClaim = async <T,>(
  ownerUserId: string,
  skippedValue: T,
  task: () => Promise<GuestMigrationClaimOutcome<T>>
): Promise<T> => {
  if (guestMigrationClaim.ownerUserId && guestMigrationClaim.ownerUserId !== ownerUserId) {
    const capturedTail = guestMigrationClaim.tail;
    await capturedTail;
    return skippedValue;
  }

  if (!guestMigrationClaim.ownerUserId) {
    guestMigrationClaim.ownerUserId = ownerUserId;
  }

  const run = guestMigrationClaim.tail.catch(() => undefined).then(async () => {
    if (guestMigrationClaim.ownerUserId !== ownerUserId) return skippedValue;
    const outcome = await task();
    if (outcome.release && guestMigrationClaim.ownerUserId === ownerUserId) {
      guestMigrationClaim.ownerUserId = null;
    }
    return outcome.value;
  });
  guestMigrationClaim.tail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
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

const getMigrationDreamKey = (dream: DreamAnalysis): string =>
  dream.clientRequestId ?? `id-${dream.id}`;

const hasClaimedMigrationRemainder = (
  retained: DreamAnalysis[],
  claimedIds: ReadonlySet<DreamAnalysis['id']>
): boolean => retained.some((dream) => claimedIds.has(dream.id));

const EMPTY_DREAMS_REF: React.RefObject<DreamAnalysis[]> = { current: [] };

/**
 * Hook for managing dream persistence (storage/loading)
 *
 * @param options - Configuration options
 * @returns Dream persistence state and actions
 */
export function useDreamPersistence({
  canUseRemoteSync,
}: UseDreamPersistenceOptions): UseDreamPersistenceResult {
  const { user, sessionReady } = useAuth();
  // ✅ FIX: Extract only userId to prevent unnecessary re-renders when user object changes
  const userId = user?.id;
  const userScope = userId ? `user:${userId}` : null;
  const authSessionReady = Boolean(userId) && sessionReady;
  const activeScopeKey = canUseRemoteSync ? `remote:${userScope ?? 'anonymous'}` : 'local';
  const [dreams, setDreams] = useState<DreamAnalysis[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pendingMutations, setPendingMutations] = useState<DreamMutation[]>([]);
  const [pendingMutationsLoaded, setPendingMutationsLoaded] = useState(!canUseRemoteSync);
  const [pendingMutationsScope, setPendingMutationsScope] = useState<string | null>(
    canUseRemoteSync ? userScope : null
  );
  const [persistenceState, setPersistenceState] = useState<DreamPersistenceState>({
    status: 'loading',
    target: canUseRemoteSync ? 'remote-cache' : 'device',
  });
  const dreamsRef = useRef<DreamAnalysis[]>([]);
  const [publishedScopeKey, setPublishedScopeKey] = useState(activeScopeKey);
  const [refreshState, setRefreshState] = useState<DreamRefreshState>({ status: 'idle' });
  const [remoteSnapshot, setRemoteSnapshot] = useState<{ userScope: string | null; dreams: DreamAnalysis[] } | null>(null);
  const mountedRef = useRef(true);
  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const activeScopeKeyRef = useRef(activeScopeKey);
  const previousScopeKeyRef = useRef(activeScopeKey);
  const writeScopesRef = useRef<Map<string, WriteScopeState>>(new Map());
  const pendingHydrationRef = useRef({ loaded: pendingMutationsLoaded, scope: pendingMutationsScope });
  useLayoutEffect(() => {
    pendingHydrationRef.current = { loaded: pendingMutationsLoaded, scope: pendingMutationsScope };
  }, [pendingMutationsLoaded, pendingMutationsScope]);

  useLayoutEffect(() => {
    activeScopeKeyRef.current = activeScopeKey;
  }, [activeScopeKey]);

  const getWriteScope = useCallback((scopeKey: string): WriteScopeState => {
    const existing = writeScopesRef.current.get(scopeKey);
    if (existing) return existing;
    const created: WriteScopeState = {
      durable: null,
      hydrated: false,
      sequence: 0,
      pendingCount: 0,
      tail: Promise.resolve(),
      failed: null,
      loadToken: 0,
    };
    writeScopesRef.current.set(scopeKey, created);
    return created;
  }, []);

  const setStateForScope = useCallback(
    (scopeKey: string, next: DreamPersistenceState) => {
      if (mountedRef.current && activeScopeKeyRef.current === scopeKey) {
        setPublishedScopeKey(scopeKey);
        setPersistenceState(next);
      }
    },
    []
  );

  const setDreamsForScope = useCallback(
    (scopeKey: string, nextDreams: DreamAnalysis[]) => {
      if (!mountedRef.current || activeScopeKeyRef.current !== scopeKey) return;
      setPublishedScopeKey(scopeKey);
      if (!areDreamListsEqual(dreamsRef.current, nextDreams)) {
        dreamsRef.current = nextDreams;
        setDreams(nextDreams);
      }
    },
    []
  );

  const hydrateWriteScope = useCallback(
    (
      scopeKey: string,
      result: DreamListReadResult,
      options?: { preserveWriteAuthority?: boolean }
    ): DreamAnalysis[] | null => {
      if (result.status === 'error') return null;
      const value = result.status === 'loaded' ? result.value : [];
      const normalized = sortDreams(normalizeDreamList(value));
      const scope = getWriteScope(scopeKey);
      if (!options?.preserveWriteAuthority) scope.durable = normalized;
      scope.hydrated = true;
      return normalized;
    },
    [getWriteScope]
  );

  const enqueueWrite = useCallback(
    async (
      scopeKey: string,
      target: 'device' | 'remote-cache',
      nextDreams: DreamAnalysis[],
      writer: (dreams: DreamAnalysis[]) => Promise<void>,
      publishOptimistically: boolean
    ): Promise<void> => {
      const scope = getWriteScope(scopeKey);
      if (!scope.hydrated) {
        setStateForScope(scopeKey, { status: 'error', operation: 'read', target });
        throw new DreamPersistenceError('read', target);
      }

      const normalized = sortDreams(normalizeDreamList(nextDreams));
      if (publishOptimistically) setDreamsForScope(scopeKey, normalized);
      if (
        scope.pendingCount === 0 &&
        scope.durable &&
        areDreamListsEqual(scope.durable, normalized) &&
        !scope.failed
      ) return;

      const sequence = ++scope.sequence;
      scope.pendingCount += 1;
      setStateForScope(scopeKey, { status: 'saving', target });
      const run = scope.tail.catch(() => undefined).then(async () => {
        try {
          await writer(normalized);
          scope.durable = normalized;
          if (scope.failed && scope.failed.sequence <= sequence) scope.failed = null;
          if (scope.sequence === sequence) {
            setStateForScope(scopeKey, { status: 'ready', target });
          }
        } catch {
          scope.failed = { sequence, dreams: normalized };
          if (scope.sequence === sequence) {
            setStateForScope(scopeKey, { status: 'error', operation: 'write', target });
          }
          throw new DreamPersistenceError('write', target);
        } finally {
          scope.pendingCount = Math.max(0, scope.pendingCount - 1);
        }
      });
      scope.tail = run.then(
        () => undefined,
        () => undefined
      );
      await run;
    },
    [getWriteScope, setDreamsForScope, setStateForScope]
  );

  const ensureAccessToken = useCallback(
    async (options?: { retries?: number; delayMs?: number; logLabel?: string; isCurrent?: () => boolean }): Promise<boolean> => {
      const retries = options?.retries ?? 0;
      const delayMs = options?.delayMs ?? 200;

      for (let attempt = 0; attempt <= retries; attempt += 1) {
        if (options?.isCurrent && !options.isCurrent()) return false;
        const token = await getAccessToken();
        if (options?.isCurrent && !options.isCurrent()) return false;
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
    []
  );

  const ensureRetainedLocalWriteIsDurable = useCallback(
    async (ownerScopeKey: string, operation: LoadOperation): Promise<void> => {
      const localScope = getWriteScope('local');
      await localScope.tail;
      if (!operation.isCurrent()) return;
      const failed = localScope.failed;
      if (!failed) return;

      try {
        await enqueueWrite('local', 'device', failed.dreams, saveDreams, false);
      } catch (error) {
        setStateForScope(ownerScopeKey, {
          status: 'error',
          operation: 'write',
          target: 'device',
        });
        throw error;
      }
    },
    [enqueueWrite, getWriteScope, setStateForScope]
  );

  const persistLocalMigrationResult = useCallback(
    async (
      ownerScopeKey: string,
      migrationSnapshot: DreamAnalysis[],
      remainingSnapshotDreams: DreamAnalysis[]
    ): Promise<DreamAnalysis[]> => {
      try {
        const localScope = getWriteScope('local');
        let latestLocalDreams: DreamAnalysis[];

        // A guest can capture another dream while a signed-in migration is uploading.
        // Read after earlier local writes settle and repeat if a newer write was queued
        // while this read was in flight, so only the migrated snapshot is removed.
        for (;;) {
          await localScope.tail;
          if (localScope.failed) {
            await enqueueWrite('local', 'device', localScope.failed.dreams, saveDreams, false);
          }
          const sequenceBeforeRead = localScope.sequence;
          const latestResult = await getSavedDreams();
          if (latestResult.status === 'error') {
            throw new DreamPersistenceError('read', 'device');
          }
          if (localScope.sequence !== sequenceBeforeRead || localScope.pendingCount > 0) {
            continue;
          }
          latestLocalDreams = sortDreams(
            normalizeDreamList(latestResult.status === 'loaded' ? latestResult.value : [])
          );
          break;
        }

        const snapshotByKey = new Map(
          migrationSnapshot.map((dream) => [getMigrationDreamKey(dream), dream])
        );
        const remainingByKey = new Map(
          remainingSnapshotDreams.map((dream) => [getMigrationDreamKey(dream), dream])
        );
        const nextDreams = latestLocalDreams.flatMap((dream) => {
          const key = getMigrationDreamKey(dream);
          const snapshotDream = snapshotByKey.get(key);
          if (!snapshotDream) return [dream];

          // A same-identity dream changed after the snapshot. Preserve its newer
          // local version instead of erasing it after uploading the older version.
          if (!areDreamsEqualForLocalState(dream, snapshotDream)) return [dream];

          const remainingDream = remainingByKey.get(key);
          if (!remainingDream) return [];
          return [remainingDream];
        });

        const sortedNextDreams = sortDreams(nextDreams);
        await enqueueWrite('local', 'device', sortedNextDreams, saveDreams, false);
        setDreamsForScope('local', sortedNextDreams);
        return sortedNextDreams;
      } catch (error) {
        setStateForScope(ownerScopeKey, {
          status: 'error',
          operation: error instanceof DreamPersistenceError ? error.operation : 'write',
          target: 'device',
        });
        throw error instanceof DreamPersistenceError
          ? error
          : new DreamPersistenceError('write', 'device');
      }
    },
    [enqueueWrite, getWriteScope, setDreamsForScope, setStateForScope]
  );

  useEffect(() => {
    if (previousScopeKeyRef.current !== activeScopeKey) {
      dreamsRef.current = [];
      setDreams([]);
      setPendingMutations([]);
      setPendingMutationsLoaded(!canUseRemoteSync);
      setPendingMutationsScope(canUseRemoteSync ? userScope : null);
      setLoaded(false);
      setRefreshState({ status: 'idle' });
      setPublishedScopeKey(activeScopeKey);
      setPersistenceState({
        status: 'loading',
        target: canUseRemoteSync ? 'remote-cache' : 'device',
      });
    }
    previousScopeKeyRef.current = activeScopeKey;
  }, [activeScopeKey, canUseRemoteSync, userScope]);

  /**
   * Persist dreams to local storage (for guest users)
   */
  const persistLocalDreams = useCallback(async (newDreams: DreamAnalysis[]) => {
    if (activeScopeKeyRef.current !== 'local') {
      throw new Error('Journal account changed before this save could start.');
    }
    await enqueueWrite('local', 'device', newDreams, saveDreams, true);
  }, [enqueueWrite]);

  /**
   * Persist dreams to remote cache (for authenticated users)
   */
  const persistRemoteDreams = useCallback(
    async (updater: DreamListUpdater) => {
      if (!canUseRemoteSync) return;
      const scopeKey = `remote:${userScope ?? 'anonymous'}`;
      if (activeScopeKeyRef.current !== scopeKey) {
        throw new Error('Journal account changed before this save could start.');
      }
      const currentDreams = publishedScopeKey === scopeKey ? dreamsRef.current : [];
      const resolved = resolveDreamListUpdater(updater, currentDreams);
      const normalized = normalizeDreamList(resolved);
      const sorted = sortDreams(normalized);
      await enqueueWrite(
        scopeKey,
        'remote-cache',
        sorted,
        (value) => saveCachedRemoteDreams(value, userScope),
        true
      );
    },
    [canUseRemoteSync, enqueueWrite, publishedScopeKey, userScope]
  );

  /**
   * Migrate guest dreams to Supabase when user logs in
   */
  const migrateGuestDreamsToSupabase = useCallback(async (operation: LoadOperation) => {
    if (!canUseRemoteSync || !userId || !operation.isCurrent()) return;
    const ownerScopeKey = `remote:${userScope}`;
    await runWithGuestMigrationClaim(userId, undefined, async () => {
      if (!operation.isCurrent()) return { value: undefined, release: false };
      await ensureRetainedLocalWriteIsDurable(ownerScopeKey, operation);
      if (!operation.isCurrent()) return { value: undefined, release: false };
      const localResult = await getSavedDreams();
      if (!operation.isCurrent()) return { value: undefined, release: false };
      const localDreams = hydrateWriteScope('local', localResult);
      if (!localDreams) throw new DreamPersistenceError('read', 'device');

      const durableOwner = await getGuestDreamMigrationOwner();
      if (!operation.isCurrent()) return { value: undefined, release: false };
      if (localResult.status === 'absent' || localDreams.length === 0) {
        if (durableOwner) await setGuestDreamMigrationOwner(null);
        return { value: undefined, release: true };
      }
      if (durableOwner && durableOwner.userId !== userId) {
        guestMigrationClaim.ownerUserId = durableOwner.userId;
        return { value: undefined, release: false };
      }
      const claimedIds = new Set(durableOwner?.dreamIds ?? localDreams.map((dream) => dream.id));
      const claimedDreams = localDreams.filter((dream) => claimedIds.has(dream.id));
      if (!claimedDreams.length) {
        await setGuestDreamMigrationOwner(null);
        return { value: undefined, release: true };
      }
      if (!durableOwner) {
        await setGuestDreamMigrationOwner({ userId, dreamIds: [...claimedIds] });
        if (!operation.isCurrent()) return { value: undefined, release: false };
      }

      const hasSession = await ensureAccessToken({
        isCurrent: operation.isCurrent,
        retries: 1,
        delayMs: 150,
        logLabel: '[useDreamPersistence] Skipping guest dream migration: auth session not ready',
      });
      if (!hasSession || !operation.isCurrent()) return { value: undefined, release: false };

      const unsynced = claimedDreams.filter((dream) => !dream.remoteId);
      const settleClaimedMigration = async (
        remainingSnapshotDreams: DreamAnalysis[]
      ): Promise<GuestMigrationClaimOutcome<void>> => {
        const retained = await persistLocalMigrationResult(
          ownerScopeKey,
          claimedDreams,
          remainingSnapshotDreams
        );
        const hasClaimedRemainder = hasClaimedMigrationRemainder(retained, claimedIds);
        if (!hasClaimedRemainder) await setGuestDreamMigrationOwner(null);
        return { value: undefined, release: !hasClaimedRemainder };
      };
      if (!unsynced.length) {
        return settleClaimedMigration([]);
      }

      const remaining: typeof unsynced = [];
      for (const [index, dream] of unsynced.entries()) {
        if (!operation.isCurrent()) {
          remaining.push(...unsynced.slice(index));
          break;
        }
        const clientRequestId =
          dream.clientRequestId ?? (typeof dream.id === 'number' ? `dream-${dream.id}` : undefined);
        const dreamToSync = clientRequestId ? { ...dream, clientRequestId } : dream;
        try {
          await createDreamInSupabase(dreamToSync, userId);
        } catch (error) {
          logger.warn('Guest dream migration failed for dream', dream.id, error);
          // Keep snapshot identity; the deterministic request ID is rebuilt on retry.
          remaining.push(dream);
        }
      }

      if (remaining.length === 0) {
        return settleClaimedMigration([]);
      }

      return settleClaimedMigration(remaining);
    });
  }, [
    canUseRemoteSync,
    ensureAccessToken,
    ensureRetainedLocalWriteIsDurable,
    hydrateWriteScope,
    persistLocalMigrationResult,
    userId,
    userScope,
  ]); // ✅ FIX: Depend on userId instead of full user object

  /**
   * Migrate unsynced dreams to Supabase (one-shot migration)
   * Pulls unsynced creations from local storage/pending queue instead of remote cache
   */
  const migrateUnsyncedDreams = useCallback(async (operation: LoadOperation) => {
    // Guard: only if authenticated + remote sync enabled + network available
    if (!canUseRemoteSync || !userId || !operation.isCurrent()) return;

    const ownerScopeKey = `remote:${userScope}`;
    const migrationScope = getWriteScope(ownerScopeKey);
    let expectedWriteSequence = migrationScope.sequence;
    const isMigrationCurrent = () => operation.isCurrent() &&
      migrationScope.sequence === expectedWriteSequence;

    await runWithGuestMigrationClaim(userId, undefined, async () => {
      if (!isMigrationCurrent()) return { value: undefined, release: false };
      await ensureRetainedLocalWriteIsDurable(ownerScopeKey, { isCurrent: isMigrationCurrent });
      if (!isMigrationCurrent()) return { value: undefined, release: false };
      const localResult = await getSavedDreams();
      if (!isMigrationCurrent()) return { value: undefined, release: false };
      const localDreams = hydrateWriteScope('local', localResult);
      if (!localDreams) throw new DreamPersistenceError('read', 'device');
      const durableOwner = await getGuestDreamMigrationOwner();
      if (!isMigrationCurrent()) return { value: undefined, release: false };
      if (localResult.status === 'absent' || localDreams.length === 0) {
        if (durableOwner) await setGuestDreamMigrationOwner(null);
      } else if (durableOwner && durableOwner.userId !== userId) {
        guestMigrationClaim.ownerUserId = durableOwner.userId;
        return { value: undefined, release: false };
      }

      const claimedIds = new Set(durableOwner?.dreamIds ?? []);
      const claimedDreams = localDreams.filter((dream) => claimedIds.has(dream.id));
      if (durableOwner && !claimedDreams.length) await setGuestDreamMigrationOwner(null);

      if (!isMigrationCurrent()) return { value: undefined, release: false };
      const alreadyMigrated = await getDreamsMigrationSynced(userId);
      if (!isMigrationCurrent()) return { value: undefined, release: false };
      if (alreadyMigrated) {
        return {
          value: undefined,
          release: claimedDreams.length === 0,
        };
      }

      const hasSession = await ensureAccessToken({
        isCurrent: isMigrationCurrent,
        retries: 3,
        delayMs: 200,
        logLabel: '[useDreamPersistence] Skipping unsynced dream migration: auth session not ready',
      });
      if (!hasSession || !isMigrationCurrent()) return { value: undefined, release: false };

      // Prefer local sources: pending mutation queue + cached/local storage
      const [pendingMutationsFromStorage, cachedResult] = await Promise.all([
        getPendingDreamMutations(userScope),
        getCachedRemoteDreams(userScope),
      ]);
      if (!isMigrationCurrent()) return { value: undefined, release: false };
      const cachedRemoteDreams = hydrateWriteScope(`remote:${userScope}`, cachedResult, { preserveWriteAuthority: true });
      if (!cachedRemoteDreams) {
        throw new Error('Dream migration storage could not be read');
      }
      reportSyncQueueMetrics({
        mutations: pendingMutationsFromStorage,
        reason: 'bootstrap_pending_queue',
        userScope,
      });

      const candidates: DreamAnalysis[] = [
        ...pendingMutationsFromStorage
          .filter((mutation) => mutation.operation === 'create' && mutation.payload.dream)
          .map((mutation) => mutation.payload.dream!)
          .filter((dream) => !dream.remoteId),
        ...cachedRemoteDreams.filter((dream) => !dream.remoteId),
        ...claimedDreams.filter((dream) => !dream.remoteId),
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
        if (claimedDreams.length > 0) {
          const retained = await persistLocalMigrationResult(ownerScopeKey, claimedDreams, []);
          const hasClaimedRemainder = hasClaimedMigrationRemainder(retained, claimedIds);
          if (!hasClaimedRemainder) await setGuestDreamMigrationOwner(null);
          if (!isMigrationCurrent()) return { value: undefined, release: false };
          await setDreamsMigrationSynced(userId, true);
          return { value: undefined, release: !hasClaimedRemainder };
        }
        if (!isMigrationCurrent()) return { value: undefined, release: false };
        await setDreamsMigrationSynced(userId, true);
        return { value: undefined, release: true };
      }

      logger.debug(`Migrating ${unsynced.length} unsynced dreams`);

      // Sync each dream one by one
      let hadFailures = false;
      for (const dream of unsynced) {
        if (!isMigrationCurrent()) return { value: undefined, release: false };
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
          if (!isMigrationCurrent()) return { value: undefined, release: false };
          const sequenceBeforeMigrationWrite = migrationScope.sequence;
          const migrationWrite = persistRemoteDreams((prev) => upsertDream(prev, synced));
          expectedWriteSequence += migrationScope.sequence - sequenceBeforeMigrationWrite;
          await migrationWrite;

          logger.debug(`Migrated dream ${dream.id} → remoteId ${synced.remoteId}`);
        } catch (error) {
          logger.warn('Migration failed for dream', dream.id, error);
          hadFailures = true;
          // Continue with others (don't block entire migration)
        }
      }

      if (!isMigrationCurrent()) return { value: undefined, release: false };
      if (!hadFailures) {
        if (claimedDreams.length > 0) {
          const retained = await persistLocalMigrationResult(ownerScopeKey, claimedDreams, []);
          const hasClaimedRemainder = hasClaimedMigrationRemainder(retained, claimedIds);
          if (!hasClaimedRemainder) await setGuestDreamMigrationOwner(null);
          if (!isMigrationCurrent()) return { value: undefined, release: false };
          await setDreamsMigrationSynced(userId, true);
          return { value: undefined, release: !hasClaimedRemainder };
        }
        if (!isMigrationCurrent()) return { value: undefined, release: false };
        await setDreamsMigrationSynced(userId, true);
        return { value: undefined, release: true };
      }
      return { value: undefined, release: claimedDreams.length === 0 };
    });
  }, [
    canUseRemoteSync,
    ensureAccessToken,
    ensureRetainedLocalWriteIsDurable,
    hydrateWriteScope,
    getWriteScope,
    persistLocalMigrationResult,
    userId,
    userScope,
    persistRemoteDreams,
  ]);

  /**
   * Load dreams from storage/server
   */
  const loadDreams = useCallback(async (mounted: { current: boolean }) => {
    const scopeKey = canUseRemoteSync ? `remote:${userScope ?? 'anonymous'}` : 'local';
    const target = canUseRemoteSync ? 'remote-cache' : 'device';
    const scope = getWriteScope(scopeKey);
    const loadToken = ++scope.loadToken;
    const writeSequenceAtStart = scope.sequence;
    let refreshWriteCount = 0;
    const isCurrent = () =>
      mounted.current && mountedRef.current &&
      activeScopeKeyRef.current === scopeKey &&
      getWriteScope(scopeKey).loadToken === loadToken;
    const mustPreserveWriteAuthority = () => {
      const currentScope = getWriteScope(scopeKey);
      return (
        currentScope.sequence !== writeSequenceAtStart + refreshWriteCount ||
        currentScope.pendingCount > 0 ||
        currentScope.failed !== null
      );
    };
    if (isCurrent()) {
      setPublishedScopeKey(scopeKey);
      if (!scope.hydrated) setLoaded(false);
      if (!scope.hydrated) setStateForScope(scopeKey, { status: 'loading', target });
      if (scope.failed) setDreamsForScope(scopeKey, scope.failed.dreams);
    }
    let pendingMutations: DreamMutation[] = [];

    try {
      if (!canUseRemoteSync) {
        const localResult = await getSavedDreams();
        if (!isCurrent()) return { pendingMutations: [] };
        const preserveWriteAuthority = mustPreserveWriteAuthority();
        const localDreams = hydrateWriteScope(scopeKey, localResult, {
          preserveWriteAuthority,
        });
        if (localDreams && isCurrent()) {
          const currentScope = getWriteScope(scopeKey);
          if (!preserveWriteAuthority) setDreamsForScope(scopeKey, localDreams);
          setPendingMutations([]);
          setPendingMutationsLoaded(true);
          setPendingMutationsScope(null);
          setStateForScope(
            scopeKey,
            currentScope.failed
              ? { status: 'error', operation: 'write', target }
              : currentScope.pendingCount > 0
                ? { status: 'saving', target }
              : { status: 'ready', target }
          );
        } else if (isCurrent()) {
          setStateForScope(scopeKey, { status: 'error', operation: 'read', target });
        }
        return { pendingMutations: [] };
      }

      // Parallelize initial reads - fetch pending mutations and cached dreams simultaneously
      const [pendingResult, cachedResult] = await Promise.allSettled([
        getPendingDreamMutations(userScope),
        getCachedRemoteDreams(userScope),
      ]);

      if (!isCurrent()) return { pendingMutations: [] };

      const pendingReadSucceeded = pendingResult.status === 'fulfilled';
      pendingMutations = pendingReadSucceeded ? pendingResult.value : [];
      const preserveWriteAuthorityAfterRead = mustPreserveWriteAuthority();
      const cacheWasLoaded =
        cachedResult.status === 'fulfilled' && cachedResult.value.status === 'loaded';
      const cacheRead = cachedResult.status === 'fulfilled'
        ? hydrateWriteScope(scopeKey, cachedResult.value, {
            preserveWriteAuthority: preserveWriteAuthorityAfterRead,
          })
        : null;
      const storageReadSucceeded = pendingReadSucceeded && cacheRead !== null;
      reportSyncQueueMetrics({
        mutations: pendingMutations,
        reason: 'reload_pending_queue',
        userScope,
      });
      // A replay or user action can consume this queue while the cache read waits.
      // Keep the already hydrated queue instead of reintroducing its old snapshot.
      const queueSnapshotIsObsolete = scope.sequence !== writeSequenceAtStart ||
        (preserveWriteAuthorityAfterRead && pendingHydrationRef.current.loaded &&
          pendingHydrationRef.current.scope === userScope);
      if (isCurrent() && !queueSnapshotIsObsolete) {
        setPendingMutations(pendingMutations);
        setPendingMutationsLoaded(pendingReadSucceeded);
        setPendingMutationsScope(userScope);
      }

      // Publish the durable local snapshot before authentication or network work.
      if (storageReadSucceeded) {
        if (!preserveWriteAuthorityAfterRead) {
          setDreamsForScope(scopeKey, normalizeDreamList(applyPendingMutations(cacheRead!, pendingMutations)));
        }
        setLoaded(true);
        setStateForScope(scopeKey, scope.failed
          ? { status: 'error', operation: 'write', target }
          : scope.pendingCount > 0 ? { status: 'saving', target } : { status: 'ready', target });
      } else {
        setStateForScope(scopeKey, { status: 'error', operation: 'read', target });
      }
      setRefreshState({ status: 'refreshing' });
      try {
        const hasSession = authSessionReady || await ensureAccessToken({
          isCurrent,
          retries: 5,
          delayMs: 250,
          logLabel: '[useDreamPersistence] Skipping remote dream load: auth session not ready',
        });

        if (!isCurrent()) return { pendingMutations };
        if (!hasSession) {
          setRefreshState({ status: 'error' });
          const preserveWriteAuthority = mustPreserveWriteAuthority();
          if (cacheWasLoaded && cacheRead && isCurrent() && !preserveWriteAuthority) {
            setDreamsForScope(
              scopeKey,
              normalizeDreamList(applyPendingMutations(cacheRead, pendingMutations))
            );
          }
          if (isCurrent()) {
            const currentScope = getWriteScope(scopeKey);
            setStateForScope(
              scopeKey,
              currentScope.failed
                ? { status: 'error', operation: 'write', target }
                : currentScope.pendingCount > 0
                  ? { status: 'saving', target }
                : pendingReadSucceeded && cacheWasLoaded
                ? { status: 'ready', target }
                : { status: 'error', operation: 'read', target }
            );
          }
          return { pendingMutations };
        }

        try {
          await migrateGuestDreamsToSupabase({ isCurrent });
        } catch (migrationError) {
          logger.warn('Failed to migrate guest dreams', migrationError);
          if (
            migrationError instanceof DreamPersistenceError &&
            migrationError.target === 'device'
          ) {
            if (isCurrent()) {
              setStateForScope(scopeKey, {
                status: 'error',
                operation: migrationError.operation,
                target: 'device',
              });
            }
            return { pendingMutations };
          }
        }

        if (!isCurrent()) return { pendingMutations };
        const remoteDreams = await fetchDreamsFromSupabase(userId);
        if (!isCurrent()) return { pendingMutations };
        setRefreshState({ status: 'idle' });
        setRemoteSnapshot({ userScope, dreams: remoteDreams });
        const normalizedRemote = normalizeDreamList(remoteDreams);
        const sortedRemote = sortDreams(normalizedRemote);
        const nextDreams = pendingMutations.length
          ? normalizeDreamList(applyPendingMutations(sortedRemote, pendingMutations))
          : sortedRemote;
        if (!isCurrent()) return { pendingMutations };
        const preserveWriteAuthority = mustPreserveWriteAuthority();
        if (storageReadSucceeded && !preserveWriteAuthority) {
          if (isCurrent()) setDreamsForScope(scopeKey, nextDreams);
          try {
            const sequenceBeforeRefreshWrite = scope.sequence;
            const refreshWrite = enqueueWrite(
              scopeKey,
              target,
              nextDreams,
              (value) => saveCachedRemoteDreams(value, userScope),
              false
            );
            // enqueueWrite reserves its sequence synchronously. Discount only
            // this refresh's own write; subsequent user writes still invalidate it.
            refreshWriteCount += scope.sequence - sequenceBeforeRefreshWrite;
            await refreshWrite;
          } catch {
            // enqueueWrite exposes the recoverable cache write state.
          }
        } else if (isCurrent()) {
          const currentScope = getWriteScope(scopeKey);
          setStateForScope(
            scopeKey,
            currentScope.failed
              ? { status: 'error', operation: 'write', target }
              : currentScope.pendingCount > 0
                ? { status: 'saving', target }
                : storageReadSucceeded
                  ? { status: 'ready', target }
                  : { status: 'error', operation: 'read', target }
          );
        }
      } catch (error) {
        if (!isCurrent()) return { pendingMutations };
        setRefreshState({ status: 'error' });
        logger.error('Failed to load dreams from remote', error);
        const preserveWriteAuthority = mustPreserveWriteAuthority();
        if (cacheWasLoaded && cacheRead && isCurrent() && !preserveWriteAuthority) {
          setDreamsForScope(
            scopeKey,
            normalizeDreamList(applyPendingMutations(cacheRead, pendingMutations))
          );
        }
        if (isCurrent()) {
          const currentScope = getWriteScope(scopeKey);
          setStateForScope(
            scopeKey,
            currentScope.failed
              ? { status: 'error', operation: 'write', target }
              : currentScope.pendingCount > 0
                ? { status: 'saving', target }
              : pendingReadSucceeded && cacheWasLoaded
              ? { status: 'ready', target }
              : { status: 'error', operation: 'read', target }
          );
        }
      }

      // Run unsynced dreams migration in background (one-shot, non-blocking)
      if (isCurrent() && !mustPreserveWriteAuthority()) migrateUnsyncedDreams({ isCurrent }).catch((err) => {
        logger.warn('Background migration of unsynced dreams failed', err);
      });

      return { pendingMutations };
    } catch (error) {
      logger.error('Failed to load dreams', error);
      if (isCurrent()) {
        setStateForScope(scopeKey, { status: 'error', operation: 'read', target });
      }
      return { pendingMutations };
    } finally {
      if (isCurrent()) {
        setLoaded(true);
      }
    }
  }, [
    authSessionReady,
    canUseRemoteSync,
    enqueueWrite,
    ensureAccessToken,
    getWriteScope,
    hydrateWriteScope,
    migrateGuestDreamsToSupabase,
    migrateUnsyncedDreams,
    setDreamsForScope,
    setStateForScope,
    userScope,
    userId,
  ]);

  /**
   * Public reload function
   */
  const reloadDreams = useCallback(async () => {
    const mounted = { current: true };
    await loadDreams(mounted);
  }, [loadDreams]);

  const retryPersistence = useCallback(async () => {
    try {
      if (activeScopeKeyRef.current !== activeScopeKey) return;
      if (persistenceState.status !== 'error' || persistenceState.operation === 'read') {
        await reloadDreams();
        return;
      }

      const scopeKey = activeScopeKey;
      if (
        scopeKey.startsWith('remote:') &&
        persistenceState.target === 'device'
      ) {
        const localFailure = getWriteScope('local').failed;
        if (localFailure) {
          await enqueueWrite('local', 'device', localFailure.dreams, saveDreams, false);
        }
        await reloadDreams();
        return;
      }
      const failed = getWriteScope(scopeKey).failed;
      if (!failed) {
        await reloadDreams();
        return;
      }

      if (scopeKey === 'local') {
        await enqueueWrite(scopeKey, 'device', failed.dreams, saveDreams, false);
        return;
      }

      await enqueueWrite(
        scopeKey,
        'remote-cache',
        failed.dreams,
        (value) => saveCachedRemoteDreams(value, userScope),
        false
      );
      setDreamsForScope(scopeKey, failed.dreams);
    } catch {
      // The observable error state remains active for another user-triggered retry.
    }
  }, [
    activeScopeKey,
    enqueueWrite,
    getWriteScope,
    persistenceState,
    reloadDreams,
    setDreamsForScope,
    userScope,
  ]);

  // Initial load effect
  useEffect(() => {
    const mounted = { current: true };
    loadDreams(mounted);
    return () => {
      mounted.current = false;
    };
  }, [loadDreams]);

  const snapshotMatchesActiveScope = publishedScopeKey === activeScopeKey;
  const mutationSnapshotMatchesActiveScope =
    snapshotMatchesActiveScope &&
    (!canUseRemoteSync || pendingMutationsScope === userScope);

  return {
    dreams: snapshotMatchesActiveScope ? dreams : [],
    loaded: snapshotMatchesActiveScope ? loaded : false,
    pendingMutations: mutationSnapshotMatchesActiveScope ? pendingMutations : [],
    pendingMutationsLoaded: mutationSnapshotMatchesActiveScope
      ? pendingMutationsLoaded
      : !canUseRemoteSync,
    pendingMutationsScope: mutationSnapshotMatchesActiveScope ? pendingMutationsScope : null,
    persistenceState: snapshotMatchesActiveScope
      ? persistenceState
      : {
          status: 'loading',
          target: canUseRemoteSync ? 'remote-cache' : 'device',
        },
    remoteSnapshot: remoteSnapshot?.userScope === userScope ? remoteSnapshot : null,
    refreshState: snapshotMatchesActiveScope ? refreshState : { status: 'idle' },
    dreamsRef: snapshotMatchesActiveScope ? dreamsRef : EMPTY_DREAMS_REF,
    persistLocalDreams,
    persistRemoteDreams,
    reloadDreams,
    retryPersistence,
  };
}
