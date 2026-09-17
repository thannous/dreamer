/** React lifecycle adapter for the durable Journal synchronization engine. */
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { DreamTarget } from '../lib/dreamIdentity';
import { createJournalSyncEngine, matchesInitialJournalScope, type JournalSyncOptions } from '../services/journalSyncEngine';
import { getNetworkStateAsync } from 'expo-network';
import { AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { logger } from '../lib/logger';
import { recordSyncReplayMetrics, reportSyncQueueMetrics } from '../lib/syncObservability';
import type { DreamMutation } from '../lib/types';
import type { DreamListUpdater } from '../lib/dreamUtils';
import { savePendingDreamMutations } from '../services/storageService';
import {
  createDreamInSupabase,
  deleteDreamFromSupabase,
  syncDreamMutationsInSupabase,
  updateDreamInSupabase,
} from '../services/supabaseDreamService';

export type UseOfflineSyncQueueOptions = JournalSyncOptions;

const EMPTY_MUTATIONS: DreamMutation[] = [];
export type SyncReplayOptions = { refreshNetworkState?: boolean };

async function readCurrentConnectivity(): Promise<boolean> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const state = await Promise.race([
      getNetworkStateAsync(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Network state check timed out')), 5000);
      }),
    ]);
    return state.isInternetReachable ?? state.isConnected ?? true;
  } finally {
    clearTimeout(timeout);
  }
}

export type UseOfflineSyncQueueResult = {
  pendingMutationsRef: React.RefObject<DreamMutation[]>;
  queueOfflineOperation: (mutation: DreamMutation, updater: DreamListUpdater) => Promise<void>;
  clearQueuedMutationsForDream: (dreamId: DreamTarget) => Promise<boolean>;
  retryDreamMutations: (dreamId: DreamTarget) => Promise<boolean>;
  syncPendingMutations: (options?: SyncReplayOptions) => Promise<void>;
  generateMutationId: () => string;
  setPendingMutations: (mutations: DreamMutation[]) => void;
};

export function useOfflineSyncQueue(options: UseOfflineSyncQueueOptions): UseOfflineSyncQueueResult {
  const { user } = useAuth();
  const { canUseRemoteSync, hasNetwork, userScope, persistRemoteDreams,
    initialMutations = EMPTY_MUTATIONS, remoteSnapshot } = options;
  const initialSnapshotMatchesScope = matchesInitialJournalScope(options);
  const [engine] = useState(() => createJournalSyncEngine({
    savePendingDreamMutations, createDreamInSupabase, updateDreamInSupabase,
    deleteDreamFromSupabase, syncDreamMutationsInSupabase,
    reportSyncQueueMetrics, recordSyncReplayMetrics, logger,
  }, options));
  const persistence = useMemo(() => engine.bindPersistence({ canUseRemoteSync, userScope }),
    [engine, canUseRemoteSync, userScope]);
  const queueOfflineOperation = useCallback((mutation: DreamMutation, updater: DreamListUpdater) =>
    persistence.queueOfflineOperation(mutation, updater, persistRemoteDreams), [persistence, persistRemoteDreams]);
  const commands = useMemo(() => engine.bind({
    canUseRemoteSync, hasNetwork, userScope,
    persistRemoteDreams
  }, user, persistence), [engine, canUseRemoteSync, hasNetwork, userScope, persistRemoteDreams, user, persistence]);

  const syncPendingMutations = useCallback(async ({ refreshNetworkState = false }: SyncReplayOptions = {}) => {
    if (!refreshNetworkState || !canUseRemoteSync || !user) {
      return commands.syncPendingMutations();
    }
    // A native connectivity event may have been missed while the app was asleep.
    // Bind this attempt to the fresh snapshot, not the render's cached boolean.
    const connected = await readCurrentConnectivity();
    if (!connected) throw new Error('Journal sync requires an internet connection');
    return engine.bind({ canUseRemoteSync, hasNetwork: connected, userScope, persistRemoteDreams },
      user, persistence).syncPendingMutations();
  }, [commands, canUseRemoteSync, user, engine, userScope, persistRemoteDreams, persistence]);

  useLayoutEffect(() => {
    engine.activate(userScope, initialSnapshotMatchesScope);
  }, [engine, initialSnapshotMatchesScope, userScope]);
  useEffect(() => {
    engine.setMounted(true);
    return () => engine.setMounted(false);
  }, [engine]);
  useEffect(() => {
    persistence.hydrate(initialMutations, initialSnapshotMatchesScope);
  }, [persistence, initialMutations, initialSnapshotMatchesScope]);
  useEffect(() => commands.subscribeSnapshot(remoteSnapshot, initialSnapshotMatchesScope),
    [commands, remoteSnapshot, initialSnapshotMatchesScope]);
  useEffect(() => {
    if (!initialSnapshotMatchesScope) return;
    void commands.syncPendingMutations().catch(() => {
      logger.warn('Offline dream sync could not complete');
    });
    // Hydration can complete without changing commands (stable account/network).
  }, [commands, initialMutations, initialSnapshotMatchesScope]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !initialSnapshotMatchesScope || !persistence.pendingMutationsRef.current.length) return;
      void syncPendingMutations({ refreshNetworkState: true }).catch(() => {
        logger.warn('Foreground dream sync could not complete');
      });
    });
    return () => subscription.remove();
  }, [initialSnapshotMatchesScope, persistence, syncPendingMutations]);

  return {
    pendingMutationsRef: persistence.pendingMutationsRef, queueOfflineOperation,
    clearQueuedMutationsForDream: persistence.clearQueuedMutationsForDream,
    retryDreamMutations: persistence.retryDreamMutations,
    syncPendingMutations,
    generateMutationId: persistence.generateMutationId,
    setPendingMutations: persistence.setPendingMutations
  };

}
