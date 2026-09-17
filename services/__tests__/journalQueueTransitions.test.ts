import {
  applyAckedMutation,
  applyFailedMutation,
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
      imageJobErrorCode: 'IMAGE_TIMEOUT',
      imageJobErrorMessage: 'retry later',
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

describe('journal queue transition import boundary', () => {
  it('has no React Native or Supabase runtime imports', () => {
    const source = require('node:fs').readFileSync(require.resolve('../../lib/journalQueueTransitions'), 'utf8');
    expect(source).not.toMatch(/from ['"](?:react-native|expo-|@supabase\/supabase-js)/);
    expect(source).not.toMatch(/require\(['"](?:react-native|expo-|@supabase\/supabase-js)/);
  });
});
