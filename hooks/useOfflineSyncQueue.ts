/** React lifecycle adapter for the durable Journal synchronization engine. */
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { DreamTarget } from '../lib/dreamIdentity';
import { createJournalSyncEngine, matchesInitialJournalScope, type JournalSyncOptions } from '../services/journalSyncEngine';
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

export type UseOfflineSyncQueueResult = {
  pendingMutationsRef: React.RefObject<DreamMutation[]>;
  queueOfflineOperation: (mutation: DreamMutation, updater: DreamListUpdater) => Promise<void>;
  clearQueuedMutationsForDream: (dreamId: DreamTarget) => Promise<boolean>;
  retryDreamMutations: (dreamId: DreamTarget) => Promise<boolean>;
  syncPendingMutations: () => Promise<void>;
  generateMutationId: () => string;
  setPendingMutations: (mutations: DreamMutation[]) => void;
};

export function useOfflineSyncQueue(options: UseOfflineSyncQueueOptions): UseOfflineSyncQueueResult {
  const { user } = useAuth();
  const { canUseRemoteSync, hasNetwork, userScope, persistRemoteDreams,
    initialMutations = [], remoteSnapshot } = options;
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
    void commands.syncPendingMutations().catch(() => {
      logger.warn('Offline dream sync could not complete');
    });
  }, [commands]);

  return {
    pendingMutationsRef: persistence.pendingMutationsRef, queueOfflineOperation,
    clearQueuedMutationsForDream: persistence.clearQueuedMutationsForDream,
    retryDreamMutations: persistence.retryDreamMutations,
    syncPendingMutations: commands.syncPendingMutations,
    generateMutationId: persistence.generateMutationId,
    setPendingMutations: persistence.setPendingMutations
  };

}
