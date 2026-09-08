/** Journal queue transitions. No React, persistence or network side effects. */
import { resolveDreamTarget } from './dreamIdentity';
import type { DreamAnalysis, DreamMutation } from './types';
import type { SyncMutationResult } from './journalSyncContracts';
import {
  buildDreamMutationEntityKey,
  generateUUID,
  getMutationDreamTarget,
  getMutationRemoteId,
  removeDream,
  setDreamSyncState,
  upsertDream,
} from './dreamUtils';

export const mergeServerDreamWithLocalState = (
  serverDream: DreamAnalysis,
  localDream?: DreamAnalysis
): DreamAnalysis =>
  setDreamSyncState(
    {
      ...serverDream,
      id: localDream?.id ?? serverDream.id,
      memory: serverDream.memory ?? localDream?.memory,
      imageUpdatedAt: localDream?.imageUpdatedAt ?? serverDream.imageUpdatedAt,
      imageSource: localDream?.imageSource ?? serverDream.imageSource,
      imageJobId: localDream?.imageJobId,
      imageJobStatus: localDream?.imageJobStatus,
      imageJobRequestId: localDream?.imageJobRequestId,
      imageJobErrorCode: localDream?.imageJobErrorCode,
      imageJobErrorMessage: localDream?.imageJobErrorMessage,
    },
    'clean',
    {
      lastSyncedAt: Date.now(),
      lastSyncError: undefined,
      conflictRemoteDream: undefined,
    }
  );

export const normalizeMutation = (mutation: DreamMutation, userScope?: string | null): DreamMutation => {
  const legacyMutation = mutation as DreamMutation & {
    dream?: DreamAnalysis;
    dreamId?: number;
    remoteId?: number;
    type?: DreamMutation['operation'];
  };
  const payload =
    mutation.payload && typeof mutation.payload === 'object'
      ? mutation.payload
      : {
          ...(legacyMutation.dream ? { dream: legacyMutation.dream } : {}),
          ...(legacyMutation.dreamId != null ? { dreamId: legacyMutation.dreamId } : {}),
          ...(legacyMutation.remoteId != null ? { remoteId: legacyMutation.remoteId } : {}),
        };
  const dream = payload.dream;
  const tombstone = payload.tombstone;
  const operation = mutation.operation ?? legacyMutation.type ?? 'update';
  const entityKey =
    mutation.entityKey ||
    (dream ? buildDreamMutationEntityKey(dream) : payload.remoteId != null
      ? `remote:${payload.remoteId}`
      : `local:${payload.dreamId ?? mutation.id}`);

  // The mutation receipt key is distinct from the dream's idempotency key.
  // Legacy guest migration uploads ID-less dreams using this deterministic key.
  const entityClientRequestId = dream?.clientRequestId ?? tombstone?.clientRequestId ??
    ((dream || tombstone) && getMutationRemoteId(mutation) == null ? `dream-${(dream ?? tombstone)!.id}` : undefined);
  const clientRequestId = mutation.clientRequestId || entityClientRequestId || generateUUID();
  const normalizedPayload = {
    ...payload,
    ...(dream ? { dream: { ...dream, clientRequestId: entityClientRequestId } } : {}),
    ...(tombstone
      ? { tombstone: { ...tombstone, clientRequestId: entityClientRequestId } }
      : {}),
  };

  return {
    ...mutation,
    version: 1,
    userScope: mutation.userScope || userScope || 'user:unknown',
    entityType: 'dream',
    entityKey,
    operation,
    clientRequestId,
    payload: normalizedPayload,
    clientUpdatedAt:
      mutation.clientUpdatedAt ||
      dream?.clientUpdatedAt ||
      tombstone?.clientUpdatedAt ||
      mutation.createdAt,
    status: mutation.status ?? 'pending',
    retryCount: mutation.retryCount ?? 0,
    type: operation,
    dream: normalizedPayload.dream,
    dreamId: normalizedPayload.dreamId,
    remoteId: normalizedPayload.remoteId,
  } as DreamMutation;
};

export const isRetryableMutation = (mutation: DreamMutation): boolean =>
  mutation.status === 'pending' || mutation.status === 'sending' || mutation.status === 'failed';

export const applyAckedMutation = (
  list: DreamAnalysis[],
  mutation: DreamMutation,
  result: SyncMutationResult
): DreamAnalysis[] => {
  if (mutation.operation === 'delete') {
    return removeDream(
      list,
      getMutationDreamTarget(mutation),
      result.remoteId ?? getMutationRemoteId(mutation)
    );
  }

  if (!result.dream) {
    return list;
  }

  return upsertDream(list, mergeServerDreamWithLocalState(result.dream, mutation.payload.dream));
};

export const applyFailedMutation = (
  list: DreamAnalysis[],
  mutation: DreamMutation,
  syncState: 'failed' | 'conflict',
  error?: string,
  remoteDream?: DreamAnalysis
): DreamAnalysis[] => {
  const localDream = mutation.payload.dream ?? mutation.payload.tombstone ?? remoteDream;
  if (!localDream) {
    return list;
  }

  const existingDream = resolveDreamTarget(list, localDream);

  const nextDream = setDreamSyncState(
    {
      ...existingDream,
      ...localDream,
      remoteId: localDream.remoteId ?? existingDream?.remoteId ?? remoteDream?.remoteId,
      revisionId: localDream.revisionId ?? existingDream?.revisionId ?? remoteDream?.revisionId,
      updatedAt: localDream.updatedAt ?? existingDream?.updatedAt ?? remoteDream?.updatedAt,
    },
    syncState,
    {
      lastSyncError: error,
      conflictRemoteDream: syncState === 'conflict' ? remoteDream : undefined,
    }
  );

  return upsertDream(list, nextDream);
};
