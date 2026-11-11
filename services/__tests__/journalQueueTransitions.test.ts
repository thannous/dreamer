import {
  JOURNAL_AUTOMATIC_RETRIES,
  JOURNAL_RETRY_BASE_MS,
  JOURNAL_RETRY_MAX_MS,
  applyAckedMutation,
  applyFailedMutation,
  nextJournalRetryDelayMs,
  normalizeMutation,
} from '../../lib/journalQueueTransitions';
import type { DreamAnalysis, DreamMutation } from '@/lib/types';

const CREATED_AT = 1_735_689_600_000;

const dream = (overrides: Partial<DreamAnalysis> = {}): DreamAnalysis => ({
  id: CREATED_AT,
  transcript: 'A dream transcript',
  title: 'A dream',
  interpretation: 'A reading',
  shareableQuote: 'A quote',
  imageUrl: '',
  chatHistory: [],
  dreamType: 'Symbolic Dream',
  ...overrides,
});

const mutation = (
  overrides: Partial<DreamMutation> & Pick<DreamMutation, 'operation' | 'payload'>
): DreamMutation => ({
  version: 1,
  id: 'mutation-1',
  userScope: 'user:user-a',
  entityType: 'dream',
  entityKey: 'remote:17',
  clientRequestId: 'receipt-1',
  clientUpdatedAt: CREATED_AT,
  status: 'pending',
  retryCount: 0,
  createdAt: CREATED_AT,
  ...overrides,
});

describe('journal queue transitions', () => {
  it('normalizes legacy dreams with a deterministic entity key distinct from the mutation receipt', () => {
    const legacyDream = dream({ remoteId: undefined, clientRequestId: undefined });
    const normalized = normalizeMutation(
      {
        id: 'legacy-receipt-1',
        type: 'create',
        dream: legacyDream,
        createdAt: CREATED_AT,
        clientRequestId: 'queue-receipt-1',
      } as unknown as DreamMutation,
      'user:user-a'
    );

    expect(normalized.clientRequestId).toBe('queue-receipt-1');
    expect(normalized.payload.dream?.clientRequestId).toBe(`dream-${CREATED_AT}`);
    expect(normalized.payload.dream?.clientRequestId).not.toBe(normalized.clientRequestId);
    expect(normalized.entityKey).toBe(`local:${CREATED_AT}`);
    expect(normalizeMutation(
      {
        id: 'legacy-receipt-2',
        type: 'create',
        dream: legacyDream,
        createdAt: CREATED_AT,
        clientRequestId: 'queue-receipt-2',
      } as unknown as DreamMutation,
      'user:user-a'
    ).payload.dream?.clientRequestId).toBe(`dream-${CREATED_AT}`);
  });

  it('applies acknowledgements to the stable remote identity when dates collide', () => {
    const first = dream({ remoteId: 17, clientRequestId: 'client-17', title: 'First' });
    const second = dream({ remoteId: 18, clientRequestId: 'client-18', title: 'Second' });
    const list = [first, second];

    const updated = applyAckedMutation(
      list,
      mutation({
        id: 'mutation-a',
        entityKey: 'remote:17',
        operation: 'update',
        payload: { dream: first },
      }),
      {
        mutationId: 'mutation-a',
        clientRequestId: 'client-17',
        operation: 'update',
        status: 'ack',
        remoteId: 17,
        dream: dream({ remoteId: 17, clientRequestId: 'client-17', title: 'First updated' }),
      }
    );

    expect(updated.find((entry) => entry.remoteId === 17)?.title).toBe('First updated');
    expect(updated.find((entry) => entry.remoteId === 18)).toBe(second);
  });

  it('deletes only the selected stable identity when dates collide', () => {
    const first = dream({ remoteId: 17, clientRequestId: 'client-17' });
    const second = dream({ remoteId: 18, clientRequestId: 'client-18' });

    const remaining = applyAckedMutation(
      [first, second],
      mutation({
        id: 'mutation-b',
        entityKey: 'remote:18',
        operation: 'delete',
        payload: { tombstone: second },
      }),
      {
        mutationId: 'mutation-b',
        clientRequestId: 'client-18',
        operation: 'delete',
        status: 'ack',
        remoteId: 18,
      }
    );

    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toBe(first);
  });

  it('marks only the selected identity as conflicted when dates collide', () => {
    const first = dream({ remoteId: 17, clientRequestId: 'client-17', title: 'First local' });
    const second = dream({ remoteId: 18, clientRequestId: 'client-18', title: 'Second' });
    const conflicted = applyFailedMutation(
      [first, second],
      mutation({
        id: 'mutation-a',
        entityKey: 'remote:17',
        operation: 'update',
        payload: { dream: first },
      }),
      'conflict',
      'stale revision',
      dream({ remoteId: 17, clientRequestId: 'client-17', title: 'First remote' })
    );

    expect(conflicted.find((entry) => entry.remoteId === 17)).toMatchObject({
      title: 'First local',
      syncState: 'conflict',
      lastSyncError: 'stale revision',
      conflictRemoteDream: expect.objectContaining({ title: 'First remote' }),
    });
    expect(conflicted.find((entry) => entry.remoteId === 18)).toBe(second);
  });

  it('preserves local media and memory metadata when an acknowledgement supplies server data', () => {
    const local = dream({
      remoteId: 17,
      clientRequestId: 'client-17',
      title: 'Local title',
      memory: { version: 1, origin: 'remembered', recurring: true },
      imageUrl: 'file:///local/dream.webp',
      imageUpdatedAt: 42,
      imageSource: 'user',
      imageJobId: 'job-17',
      imageJobStatus: 'running',
      imageJobRequestId: 'image-request-17',
      imageJobErrorCode: 'IMAGE_TIMEOUT',
      imageJobErrorMessage: 'retry later',
      captureOriginalTranscript: 'Original question and answer',
    });
    const server = dream({
      remoteId: 17,
      clientRequestId: 'client-17',
      title: 'Server title',
      transcript: 'Server transcript',
      memory: undefined,
      imageUrl: 'supabase-storage://dream-images/user-a/dream-17.webp',
    });

    const merged = applyAckedMutation(
      [local],
      mutation({ operation: 'update', payload: { dream: local } }),
      {
        mutationId: 'mutation-1',
        clientRequestId: 'client-17',
        operation: 'update',
        status: 'ack',
        remoteId: 17,
        dream: server,
      }
    )[0];

    expect(merged).toMatchObject({
      title: 'Server title',
      transcript: 'Server transcript',
      memory: local.memory,
      imageUrl: server.imageUrl,
      imageUpdatedAt: 42,
      imageSource: 'user',
      imageJobId: 'job-17',
      imageJobStatus: 'running',
      imageJobRequestId: 'image-request-17',
      imageJobErrorCode: undefined,
      imageJobErrorMessage: 'retry later',
      captureOriginalTranscript: 'Original question and answer',
      syncState: 'clean',
    });
  });

  it('leaves the list unchanged when an update acknowledgement has no dream result', () => {
    const list = [dream({ remoteId: 17, clientRequestId: 'client-17' })];
    const result = applyAckedMutation(
      list,
      mutation({ operation: 'update', payload: { dream: list[0] } }),
      {
        mutationId: 'mutation-1',
        clientRequestId: 'client-17',
        operation: 'update',
        status: 'ack',
        remoteId: 17,
      }
    );

    expect(result).toBe(list);
  });
});

describe('automatic retry of failed journal changes', () => {
  const NOW = CREATED_AT + 60 * 60_000;
  const failed = (retryCount: number, lastAttemptAt: number | undefined, id = `failed-${retryCount}`): DreamMutation =>
    mutation({ id, operation: 'update', payload: { dream: dream({ remoteId: 17 }) }, status: 'failed', retryCount, lastAttemptAt });

  it('asks for no timer when nothing failed', () => {
    expect(nextJournalRetryDelayMs([], NOW)).toBeNull();
    expect(nextJournalRetryDelayMs([mutation({ operation: 'update', payload: { dream: dream({ remoteId: 17 }) } })], NOW)).toBeNull();
    expect(nextJournalRetryDelayMs([mutation({ operation: 'update', payload: {}, status: 'blocked', retryCount: 2 })], NOW)).toBeNull();
  });

  it('waits fifteen seconds after a first failure, twice as long after each next one, a quarter of an hour at most', () => {
    expect(nextJournalRetryDelayMs([failed(1, NOW)], NOW)).toBe(JOURNAL_RETRY_BASE_MS);
    expect(nextJournalRetryDelayMs([failed(2, NOW)], NOW)).toBe(2 * JOURNAL_RETRY_BASE_MS);
    expect(nextJournalRetryDelayMs([failed(4, NOW)], NOW)).toBe(8 * JOURNAL_RETRY_BASE_MS);
    expect(nextJournalRetryDelayMs([failed(JOURNAL_AUTOMATIC_RETRIES, NOW)], NOW)).toBe(JOURNAL_RETRY_MAX_MS);
  });

  it('counts the wait from the last attempt and follows the change that is due first', () => {
    expect(nextJournalRetryDelayMs([failed(1, NOW - 10_000)], NOW)).toBe(JOURNAL_RETRY_BASE_MS - 10_000);
    expect(nextJournalRetryDelayMs([failed(1, NOW - 60_000)], NOW)).toBe(0);
    expect(nextJournalRetryDelayMs([failed(5, NOW), failed(1, NOW - 5_000)], NOW)).toBe(JOURNAL_RETRY_BASE_MS - 5_000);
  });

  it('stops asking for a timer for a change the server keeps refusing', () => {
    expect(nextJournalRetryDelayMs([failed(JOURNAL_AUTOMATIC_RETRIES + 1, NOW)], NOW)).toBeNull();
  });

  it('is not postponed by a device clock that was moved back', () => {
    expect(nextJournalRetryDelayMs([failed(1, NOW + 24 * 60 * 60_000)], NOW)).toBe(JOURNAL_RETRY_BASE_MS);
    expect(nextJournalRetryDelayMs([failed(1, undefined)], NOW)).toBe(JOURNAL_RETRY_BASE_MS);
  });
});
