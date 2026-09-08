import { createJournalRepository } from './journalRepository';
import { mapRowToDream, mapDreamToRow, mapDreamToSyncPayload, parseSyncResult } from './journalDreamMapper';
import { formatError, type CodedError } from '@/lib/journalErrors';
import type { SyncMutationResult } from '@/lib/journalSyncContracts';
import { createJournalMediaUploadService } from './journalMediaUploadService';
import { readImageFileBase64, convertToWebpBase64 } from './journalNativeImageAdapter';
import { invalidateDreamMedia } from './dreamMediaService';
import type { PostgrestError } from '@supabase/supabase-js';

import {
  buildDreamMutationEntityKey,
  createDreamMutation,
  generateUUID,
  getMutationDreamId,
  getMutationRemoteId,
  normalizeDreamMemoryMetadata,
} from '@/lib/dreamUtils';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type {
  DreamAnalysis,
  DreamMutation,
} from '@/lib/types';

export type { SyncMutationResult, SyncMutationResultStatus } from '@/lib/journalSyncContracts';

const DREAMS_TABLE = 'dreams';
const { ensureRemoteImage } = createJournalMediaUploadService({
  getClient: () => supabase,
  isConfigured: () => isSupabaseConfigured,
  invalidateDreamMedia,
  readImageFileBase64,
  convertToWebpBase64,
});

type ConflictError = CodedError & { remoteDream?: DreamAnalysis };

const createNotFoundError = (message: string): CodedError => {
  const error = new Error(message) as CodedError;
  error.code = 'NOT_FOUND';
  return error;
};

const createConflictError = (message: string, remoteDream?: DreamAnalysis): ConflictError => {
  const error = new Error(message) as ConflictError;
  error.code = 'CONFLICT';
  error.remoteDream = remoteDream;
  return error;
};

let imageGenerationFailedColumnAvailable = true;
let clientUpdatedAtColumnAvailable = true;
let memoryColumnAvailable = true;

const isMissingImageGenerationColumnError = (error: PostgrestError | null): boolean => {
  if (!error) return false;
  if (error.code !== 'PGRST204') return false;
  return /image_generation_failed|image_source/.test(error.message ?? '');
};

const isMissingClientUpdatedAtColumnError = (error: PostgrestError | null): boolean => {
  if (!error) return false;

  const combinedText = [error.message, error.details, error.hint]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLowerCase();

  if (!combinedText.includes('client_updated_at')) {
    return false;
  }

  return (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    combinedText.includes('schema cache') ||
    combinedText.includes('does not exist')
  );
};

const isMissingMemoryColumnError = (error: PostgrestError | null): boolean => {
  if (!error) return false;

  const combinedText = [error.message, error.details, error.hint]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLowerCase();

  if (!combinedText.includes('memory')) {
    return false;
  }

  return (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    combinedText.includes('schema cache') ||
    combinedText.includes('does not exist')
  );
};

const shouldRetryDreamWriteWithoutOptionalColumn = (
  error: PostgrestError | null,
  options: { includeImageColumn: boolean; includeClientUpdatedAtColumn: boolean; includeMemoryColumn: boolean }
): Partial<typeof options> | null => {
  if (
    options.includeImageColumn &&
    imageGenerationFailedColumnAvailable &&
    isMissingImageGenerationColumnError(error)
  ) {
    imageGenerationFailedColumnAvailable = false;
    return { includeImageColumn: false };
  }

  if (
    options.includeClientUpdatedAtColumn &&
    clientUpdatedAtColumnAvailable &&
    isMissingClientUpdatedAtColumnError(error)
  ) {
    clientUpdatedAtColumnAvailable = false;
    return { includeClientUpdatedAtColumn: false };
  }

  if (
    options.includeMemoryColumn &&
    memoryColumnAvailable &&
    isMissingMemoryColumnError(error)
  ) {
    memoryColumnAvailable = false;
    return { includeMemoryColumn: false };
  }

  return null;
};

const isSingleObjectResultError = (error: PostgrestError | null): boolean => {
  if (!error) return false;
  const message = (error.message ?? '').toLowerCase();
  return (
    error.code === 'PGRST116' ||
    error.code === 'PGRST301' ||
    message.includes('single json object') ||
    message.includes('0 rows') ||
    message.includes('no rows')
  );
};

const isMissingSyncMutationsRpcError = (error: PostgrestError | null): boolean => {
  if (!error) return false;

  const combinedText = [error.message, error.details, error.hint]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLowerCase();

  if (!combinedText.includes('sync_dream_mutations')) {
    return false;
  }

  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    combinedText.includes('could not find the function') ||
    combinedText.includes('does not exist')
  );
};

const getDreamClientRequestId = (mutation: DreamMutation): string | undefined =>
  mutation.payload.dream?.clientRequestId ?? mutation.payload.tombstone?.clientRequestId;

const applyResolvedRemoteId = (
  mutation: DreamMutation,
  remoteId: number
): DreamMutation => {
  if (mutation.operation === 'create' || getMutationRemoteId(mutation) === remoteId) {
    return mutation;
  }

  const dream = mutation.payload.dream
    ? {
        ...mutation.payload.dream,
        remoteId,
      }
    : undefined;
  const tombstone = mutation.payload.tombstone
    ? {
        ...mutation.payload.tombstone,
        remoteId,
      }
    : undefined;

  return {
    ...mutation,
    entityKey: dream ? buildDreamMutationEntityKey(dream) : `remote:${remoteId}`,
    payload: {
      ...mutation.payload,
      remoteId,
      ...(dream ? { dream } : {}),
      ...(tombstone ? { tombstone } : {}),
    },
  };
};

const rememberRemoteId = (
  mutation: DreamMutation,
  remoteId: number,
  idsByDreamId: Map<number, number>,
  idsByClientRequestId: Map<string, number>
) => {
  const dreamId = getMutationDreamId(mutation);
  const dreamClientRequestId = getDreamClientRequestId(mutation);

  if (dreamId != null && !dreamClientRequestId && getMutationRemoteId(mutation) == null) {
    idsByDreamId.set(dreamId, remoteId);
  }

  if (dreamClientRequestId) {
    idsByClientRequestId.set(dreamClientRequestId, remoteId);
  }
};

const forgetRemoteId = (
  mutation: DreamMutation,
  idsByDreamId: Map<number, number>,
  idsByClientRequestId: Map<string, number>
) => {
  const dreamId = getMutationDreamId(mutation);
  const dreamClientRequestId = getDreamClientRequestId(mutation);

  if (dreamId != null && !dreamClientRequestId && getMutationRemoteId(mutation) == null) {
    idsByDreamId.delete(dreamId);
  }

  if (dreamClientRequestId) {
    idsByClientRequestId.delete(dreamClientRequestId);
  }
};

const hydrateKnownRemoteId = (
  mutation: DreamMutation,
  idsByDreamId: Map<number, number>,
  idsByClientRequestId: Map<string, number>
): DreamMutation => {
  const existingRemoteId = getMutationRemoteId(mutation);
  if (existingRemoteId != null) {
    return mutation;
  }

  const dreamId = getMutationDreamId(mutation);
  const dreamClientRequestId = getDreamClientRequestId(mutation);
  const resolvedRemoteId =
    (dreamClientRequestId ? idsByClientRequestId.get(dreamClientRequestId) : undefined) ??
    (!dreamClientRequestId && dreamId != null ? idsByDreamId.get(dreamId) : undefined);

  return resolvedRemoteId != null ? applyResolvedRemoteId(mutation, resolvedRemoteId) : mutation;
};

type AcknowledgedDreamState = {
  remoteId?: number;
  revisionId?: string;
};

const getMutationEntityAliases = (mutation: DreamMutation): string[] => {
  const aliases: string[] = [];
  const dreamId = getMutationDreamId(mutation);
  const remoteId = getMutationRemoteId(mutation);
  const dreamClientRequestId = getDreamClientRequestId(mutation);

  if (remoteId == null && !dreamClientRequestId) {
    aliases.push(`entity:${mutation.entityKey}`);
    if (dreamId != null) aliases.push(`local:${dreamId}`);
  }
  if (remoteId != null) aliases.push(`remote:${remoteId}`);
  if (dreamClientRequestId) aliases.push(`client:${dreamClientRequestId}`);
  return aliases;
};

const hydrateAcknowledgedDreamState = (
  mutation: DreamMutation,
  statesByAlias: Map<string, AcknowledgedDreamState>
): DreamMutation => {
  const state = getMutationEntityAliases(mutation)
    .map((alias) => statesByAlias.get(alias))
    .find((candidate): candidate is AcknowledgedDreamState => candidate != null);

  if (!state || mutation.operation === 'create' ||
    (getMutationRemoteId(mutation) != null && state.remoteId != null &&
      getMutationRemoteId(mutation) !== state.remoteId)) {
    return mutation;
  }

  const withRemoteId =
    state.remoteId != null ? applyResolvedRemoteId(mutation, state.remoteId) : mutation;
  const dream = withRemoteId.payload.dream
    ? {
        ...withRemoteId.payload.dream,
        ...(state.remoteId != null ? { remoteId: state.remoteId } : {}),
        ...(state.revisionId ? { revisionId: state.revisionId } : {}),
      }
    : undefined;
  const tombstone = withRemoteId.payload.tombstone
    ? {
        ...withRemoteId.payload.tombstone,
        ...(state.remoteId != null ? { remoteId: state.remoteId } : {}),
        ...(state.revisionId ? { revisionId: state.revisionId } : {}),
      }
    : undefined;

  return {
    ...withRemoteId,
    ...(state.revisionId ? { baseRevision: state.revisionId } : {}),
    payload: {
      ...withRemoteId.payload,
      ...(dream ? { dream } : {}),
      ...(tombstone ? { tombstone } : {}),
    },
  };
};

const createMissingRemoteIdResult = (mutation: DreamMutation): SyncMutationResult => ({
  mutationId: mutation.id,
  clientRequestId: mutation.clientRequestId,
  operation: mutation.operation,
  status: 'failed',
  error:
    mutation.operation === 'update'
      ? 'Missing remote id for update'
      : 'Missing remote id for delete',
});

const preserveAckDreamMemory = (
  result: SyncMutationResult,
  sourceMutation: DreamMutation | undefined
): SyncMutationResult => {
  if (result.status !== 'ack' || !result.dream || !sourceMutation?.payload.dream) {
    return result;
  }

  if (normalizeDreamMemoryMetadata(result.dream.memory)) {
    return result;
  }

  const localMemory = normalizeDreamMemoryMetadata(sourceMutation.payload.dream.memory);
  if (!localMemory) {
    return result;
  }

  return {
    ...result,
    dream: {
      ...result.dream,
      memory: localMemory,
    },
  };
};

const mapMutationToSyncPayload = async (
  mutation: DreamMutation,
  userId?: string
): Promise<Record<string, unknown>> => {
  const shouldPrepareDream =
    mutation.operation === 'create' || mutation.operation === 'update';
  const preparedDream =
    shouldPrepareDream && mutation.payload.dream
      ? await ensureRemoteImage(mutation.payload.dream, userId)
      : mutation.payload.dream;

  return {
    mutation_id: mutation.id,
    operation: mutation.operation,
    client_request_id: mutation.clientRequestId,
    entity_key: mutation.entityKey,
    base_revision: mutation.baseRevision ?? null,
    client_updated_at: new Date(mutation.clientUpdatedAt || Date.now()).toISOString(),
    payload:
      mutation.operation === 'delete'
        ? {
            remote_id: mutation.payload.remoteId ?? mutation.payload.tombstone?.remoteId ?? null,
            dream_id: mutation.payload.dreamId ?? mutation.payload.tombstone?.id ?? null,
          }
        : mapDreamToSyncPayload(preparedDream ?? mutation.payload.dream!, userId, true, memoryColumnAvailable),
  };
};

const syncDreamMutationsDirectly = async (
  mutations: DreamMutation[],
  userId?: string
): Promise<SyncMutationResult[]> => {
  const results: SyncMutationResult[] = [];

  for (const mutation of mutations) {
    if (mutation.operation === 'create' && mutation.payload.dream) {
      const preparedDream = await ensureRemoteImage(mutation.payload.dream, userId);
      const upsert = (options: { includeImageColumn: boolean; includeClientUpdatedAtColumn: boolean; includeMemoryColumn: boolean }) =>
        supabase
          .from(DREAMS_TABLE)
          .upsert(
            mapDreamToRow(
              preparedDream,
              userId,
              options.includeImageColumn,
              options.includeClientUpdatedAtColumn,
              options.includeMemoryColumn
            ),
            {
              onConflict: 'user_id,client_request_id',
            }
          )
          .select('*')
          .single();

      let writeOptions = {
        includeImageColumn: imageGenerationFailedColumnAvailable,
        includeClientUpdatedAtColumn: clientUpdatedAtColumnAvailable,
        includeMemoryColumn: memoryColumnAvailable,
      };
      let { data, error } = await upsert(writeOptions);

      let retryOptions = shouldRetryDreamWriteWithoutOptionalColumn(error, writeOptions);
      while ((error || !data) && retryOptions) {
        writeOptions = { ...writeOptions, ...retryOptions };
        ({ data, error } = await upsert(writeOptions));
        retryOptions = shouldRetryDreamWriteWithoutOptionalColumn(error, writeOptions);
      }

      if (error || !data) {
        throw formatError(error, 'Failed to create dream in Supabase');
      }

      const dream = mapRowToDream(data);
      results.push({
        mutationId: mutation.id,
        clientRequestId: mutation.clientRequestId,
        operation: mutation.operation,
        status: 'ack',
        dream,
        remoteId: dream.remoteId,
      });
      continue;
    }

    if (mutation.operation === 'update' && mutation.payload.dream) {
      const dreamToUpdate = mutation.payload.dream;
      if (!dreamToUpdate.remoteId) {
        throw new Error('Missing remote id for Supabase dream update');
      }

      const preparedDream = await ensureRemoteImage(dreamToUpdate, userId);
      const update = (options: { includeImageColumn: boolean; includeClientUpdatedAtColumn: boolean; includeMemoryColumn: boolean }) =>
        supabase
          .from(DREAMS_TABLE)
          .update(
            mapDreamToRow(
              preparedDream,
              undefined,
              options.includeImageColumn,
              options.includeClientUpdatedAtColumn,
              options.includeMemoryColumn
            )
          )
          .eq('id', dreamToUpdate.remoteId)
          .select('*')
          .single();

      let writeOptions = {
        includeImageColumn: imageGenerationFailedColumnAvailable,
        includeClientUpdatedAtColumn: clientUpdatedAtColumnAvailable,
        includeMemoryColumn: memoryColumnAvailable,
      };
      let { data, error } = await update(writeOptions);

      let retryOptions = shouldRetryDreamWriteWithoutOptionalColumn(error, writeOptions);
      while ((error || !data) && retryOptions) {
        writeOptions = { ...writeOptions, ...retryOptions };
        ({ data, error } = await update(writeOptions));
        retryOptions = shouldRetryDreamWriteWithoutOptionalColumn(error, writeOptions);
      }

      if (isSingleObjectResultError(error) || (!error && !data)) {
        throw createNotFoundError('Dream not found in Supabase');
      }

      if (error || !data) {
        throw formatError(error, 'Failed to update dream in Supabase');
      }

      const dream = mapRowToDream(data);
      results.push({
        mutationId: mutation.id,
        clientRequestId: mutation.clientRequestId,
        operation: mutation.operation,
        status: 'ack',
        dream,
        remoteId: dream.remoteId,
      });
      continue;
    }

    if (mutation.operation === 'delete') {
      const remoteId = mutation.payload.remoteId ?? mutation.payload.tombstone?.remoteId;
      if (remoteId == null) {
        throw new Error('Missing remote id for Supabase dream delete');
      }

      const { error } = await supabase.from(DREAMS_TABLE).delete().eq('id', remoteId);
      if (error) {
        throw formatError(error, 'Failed to delete dream from Supabase');
      }

      results.push({
        mutationId: mutation.id,
        clientRequestId: mutation.clientRequestId,
        operation: mutation.operation,
        status: 'ack',
        remoteId,
      });
      continue;
    }

    results.push({
      mutationId: mutation.id,
      clientRequestId: mutation.clientRequestId,
      operation: mutation.operation,
      status: 'failed',
      error: 'Malformed mutation payload',
    });
  }

  return results;
};

const syncDreamMutationsWithResolvedRemoteIds = async (
  mutations: DreamMutation[],
  executeBatch: (batch: DreamMutation[]) => Promise<SyncMutationResult[]>
): Promise<SyncMutationResult[]> => {
  if (!mutations.length) {
    return [];
  }

  const results: SyncMutationResult[] = [];
  const idsByDreamId = new Map<number, number>();
  const idsByClientRequestId = new Map<string, number>();
  const acknowledgedStatesByAlias = new Map<string, AcknowledgedDreamState>();
  const aliasesInBatch = new Set<string>();
  let batch: DreamMutation[] = [];

  const flushBatch = async () => {
    if (!batch.length) {
      return;
    }

    const currentBatch = batch;
    batch = [];
    aliasesInBatch.clear();

    const mutationsById = new Map(currentBatch.map((mutation) => [mutation.id, mutation]));
    const batchResults = (await executeBatch(currentBatch)).map((result) =>
      preserveAckDreamMemory(result, mutationsById.get(result.mutationId))
    );
    results.push(...batchResults);

    batchResults.forEach((result) => {
      const sourceMutation = mutationsById.get(result.mutationId);
      if (!sourceMutation || result.status !== 'ack') {
        return;
      }

      if (sourceMutation.operation === 'delete') {
        forgetRemoteId(sourceMutation, idsByDreamId, idsByClientRequestId);
        return;
      }

      const remoteId = result.remoteId ?? result.dream?.remoteId;
      if (remoteId != null) {
        rememberRemoteId(sourceMutation, remoteId, idsByDreamId, idsByClientRequestId);
      }

      const acknowledgedState: AcknowledgedDreamState = {
        remoteId,
        revisionId: result.dream?.revisionId,
      };
      const aliases = new Set([
        ...getMutationEntityAliases(sourceMutation),
        ...(result.dream
          ? getMutationEntityAliases({
              ...sourceMutation,
              entityKey: buildDreamMutationEntityKey(result.dream),
              payload: { ...sourceMutation.payload, dream: result.dream },
            })
          : []),
      ]);
      aliases.forEach((alias) => acknowledgedStatesByAlias.set(alias, acknowledgedState));
    });
  };

  for (const mutation of mutations) {
    let hydratedMutation = hydrateAcknowledgedDreamState(
      hydrateKnownRemoteId(mutation, idsByDreamId, idsByClientRequestId),
      acknowledgedStatesByAlias
    );
    let mutationAliases = getMutationEntityAliases(hydratedMutation);
    const repeatsEntityInBatch = mutationAliases.some((alias) => aliasesInBatch.has(alias));
    const missingRemoteId =
      hydratedMutation.operation !== 'create' && getMutationRemoteId(hydratedMutation) == null;

    if ((missingRemoteId || repeatsEntityInBatch) && batch.length) {
      await flushBatch();
      hydratedMutation = hydrateAcknowledgedDreamState(
        hydrateKnownRemoteId(mutation, idsByDreamId, idsByClientRequestId),
        acknowledgedStatesByAlias
      );
      mutationAliases = getMutationEntityAliases(hydratedMutation);
    }

    if (hydratedMutation.operation !== 'create' && getMutationRemoteId(hydratedMutation) == null) {
      results.push(createMissingRemoteIdResult(hydratedMutation));
      continue;
    }

    batch.push(hydratedMutation);
    mutationAliases.forEach((alias) => aliasesInBatch.add(alias));
  }

  await flushBatch();

  return results;
};

export async function syncDreamMutationsInSupabase(
  mutations: DreamMutation[],
  userId?: string
): Promise<SyncMutationResult[]> {
  return syncDreamMutationsWithResolvedRemoteIds(mutations, async (batch) => {
    if (typeof supabase.rpc !== 'function') {
      return syncDreamMutationsDirectly(batch, userId);
    }

    const preparedMutations = await Promise.all(
      batch.map((mutation) => mapMutationToSyncPayload(mutation, userId))
    );

    const { data, error } = await supabase.rpc('sync_dream_mutations', {
      mutations: preparedMutations,
    });

    if (isMissingSyncMutationsRpcError(error)) {
      return syncDreamMutationsDirectly(batch, userId);
    }

    if (isMissingClientUpdatedAtColumnError(error)) {
      clientUpdatedAtColumnAvailable = false;
      return syncDreamMutationsDirectly(batch, userId);
    }

    if (isMissingMemoryColumnError(error)) {
      memoryColumnAvailable = false;
      return syncDreamMutationsDirectly(batch, userId);
    }

    if (error) {
      throw formatError(error, 'Failed to sync dream mutations');
    }

    return parseSyncResult(data);
  });
}

const journalRepository = createJournalRepository({ getClient: () => supabase });
export const { fetchDreamListPage, fetchDreamFullPage, iterateDreamPages, fetchDreamsFromSupabase, fetchDreamFromSupabase, fetchDreamByClientRequestId } = journalRepository;

export async function createDreamInSupabase(dream: DreamAnalysis, userId: string): Promise<DreamAnalysis> {
  const withRequestId = dream.clientRequestId
    ? dream
    : { ...dream, clientRequestId: generateUUID() };
  const [result] = await syncDreamMutationsInSupabase([
    createDreamMutation({
      id: generateUUID(),
      userScope: `user:${userId}`,
      entityType: 'dream',
      entityKey: buildDreamMutationEntityKey(withRequestId),
      operation: 'create',
      clientRequestId: withRequestId.clientRequestId!,
      clientUpdatedAt: withRequestId.clientUpdatedAt ?? Date.now(),
      payload: { dream: withRequestId },
      status: 'pending',
      retryCount: 0,
      createdAt: Date.now(),
    }),
  ], userId);

  if (!result) {
    throw new Error('Failed to create dream in Supabase');
  }
  if (result.status === 'conflict') {
    throw createConflictError(result.error ?? 'Dream create conflict', result.dream);
  }
  if (result.status === 'failed' || !result.dream) {
    throw new Error(result.error ?? 'Failed to create dream in Supabase');
  }
  return result.dream;
}

export async function updateDreamInSupabase(dream: DreamAnalysis): Promise<DreamAnalysis> {
  if (!dream.remoteId) {
    throw new Error('Missing remote id for Supabase dream update');
  }
  const [result] = await syncDreamMutationsInSupabase([
    createDreamMutation({
      id: generateUUID(),
      userScope: 'user:active',
      entityType: 'dream',
      entityKey: buildDreamMutationEntityKey(dream),
      operation: 'update',
      clientRequestId: generateUUID(),
      baseRevision: dream.revisionId,
      clientUpdatedAt: dream.clientUpdatedAt ?? Date.now(),
      payload: { dream },
      status: 'pending',
      retryCount: 0,
      createdAt: Date.now(),
    }),
  ]);

  if (!result) {
    throw new Error('Failed to update dream in Supabase');
  }
  if (result.status === 'conflict') {
    throw createConflictError(result.error ?? 'Dream update conflict', result.dream);
  }
  if (result.status === 'failed') {
    if (result.error?.toLowerCase().includes('not found')) {
      throw createNotFoundError(result.error);
    }
    throw new Error(result.error ?? 'Failed to update dream in Supabase');
  }
  if (!result.dream) {
    throw new Error('Failed to update dream in Supabase');
  }
  return result.dream;
}

export async function deleteDreamFromSupabase(remoteId: number, baseRevision?: string): Promise<void> {
  const [result] = await syncDreamMutationsInSupabase([
    createDreamMutation({
      id: generateUUID(),
      userScope: 'user:active',
      entityType: 'dream',
      entityKey: `remote:${remoteId}`,
      operation: 'delete',
      clientRequestId: generateUUID(),
      baseRevision,
      clientUpdatedAt: Date.now(),
      payload: { remoteId },
      status: 'pending',
      retryCount: 0,
      createdAt: Date.now(),
    }),
  ]);

  if (!result) {
    throw new Error('Failed to delete dream from Supabase');
  }
  if (result.status === 'conflict') {
    throw createConflictError(result.error ?? 'Dream delete conflict', result.dream);
  }
  if (result.status === 'failed') {
    throw new Error(result.error ?? 'Failed to delete dream from Supabase');
  }
}
