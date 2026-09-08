import { createJournalRepository } from './journalRepository';
import { createJournalMutationTransport } from './journalMutationTransport';
import type { CodedError } from '@/lib/journalErrors';
import { createJournalMediaUploadService } from './journalMediaUploadService';
import { readImageFileBase64, convertToWebpBase64 } from './journalNativeImageAdapter';
import { invalidateDreamMedia } from './dreamMediaService';

import {
  buildDreamMutationEntityKey,
  createDreamMutation,
  generateUUID,
} from '@/lib/dreamUtils';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type {
  DreamAnalysis,
} from '@/lib/types';

export type { SyncMutationResult, SyncMutationResultStatus } from '@/lib/journalSyncContracts';

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

const { syncDreamMutationsInSupabase } = createJournalMutationTransport({
  getClient: () => supabase,
  ensureRemoteImage,
});
export { syncDreamMutationsInSupabase };

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
