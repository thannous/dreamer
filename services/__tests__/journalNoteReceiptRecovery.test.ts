import type { SupabaseClient } from '@supabase/supabase-js';
import type { DreamAnalysis, DreamMutation } from '@/lib/types';
import { createJournalMutationTransport } from '../journalMutationTransport';
import { createJournalSyncEngine, type JournalSyncOptions } from '../journalSyncEngine';

const note = { id: '11111111-1111-4111-8111-111111111111', text: 'Keep this private thought', createdAt: 100, updatedAt: 100 };
const local: DreamAnalysis = { id: 1, clientRequestId: 'dream-a', transcript: 'Original dream', title: 'Dream',
  interpretation: '', shareableQuote: '', imageUrl: '', chatHistory: [], dreamType: 'Symbolic Dream', personalNotes: [note] };

type WireMutation = { mutation_id: string; client_request_id: string; operation: string; base_revision?: string; payload: Record<string, unknown> };

// The real E2E covers a durable old receipt. This control injects crashes after a
// committed recovery and a remote race, which a UI journey cannot time reliably.
function setup(operation: 'create' | 'update') {
  let upgraded = false;
  let loseResponse = false;
  let writes = 0;
  let creates = 0;
  let pausedResponse: { arrive: () => void; resumed: Promise<void> } | undefined;
  let row: Record<string, unknown> = { id: 42, revision_id: 'r0', created_at: new Date(1).toISOString(),
    client_request_id: local.clientRequestId, transcript: local.transcript, title: local.title };
  const receipts = new Map<string, Record<string, unknown>>();
  const rpc = jest.fn(async (_name: string, { mutations }: { mutations: WireMutation[] }) => {
    const data = mutations.map(mutation => {
      const receipt = receipts.get(mutation.client_request_id);
      if (receipt) return receipt;
      const conflict = mutation.operation === 'update' && mutation.base_revision !== row.revision_id;
      if (!conflict) {
        writes += 1;
        if (mutation.operation === 'create') creates += 1;
        row = { ...row, ...mutation.payload, revision_id: `r${writes}` };
        if (!upgraded) delete row.personal_notes;
      }
      const result = { mutation_id: mutation.mutation_id, client_request_id: mutation.client_request_id,
        operation: mutation.operation, status: conflict ? 'conflict' : 'ack', remote_id: 42,
        ...(mutation.operation === 'delete' ? {} : { dream: { ...row } }), ...(conflict ? { error: 'Dream changed on another device' } : {}) };
      receipts.set(mutation.client_request_id, result);
      return result;
    });
    if (pausedResponse) {
      const pause = pausedResponse; pausedResponse = undefined; pause.arrive(); await pause.resumed;
    }
    if (loseResponse) { loseResponse = false; throw new Error('Response lost after commit'); }
    return { data, error: null };
  });
  const transport = createJournalMutationTransport({
    getClient: () => ({ rpc }) as unknown as SupabaseClient, ensureRemoteImage: async dream => dream,
  });
  let queue: DreamMutation[] = [{ version: 1, id: 'local-mutation', userScope: 'user:a', entityType: 'dream',
    entityKey: 'client:dream-a', clientRequestId: 'old-receipt', operation, createdAt: 1, clientUpdatedAt: 1,
    status: 'pending', retryCount: 0, ...(operation === 'update' ? { baseRevision: 'r0' } : {}),
    payload: { dream: { ...local, ...(operation === 'update' ? { remoteId: 42, revisionId: 'r0' } : {}) } } }];
  let dreams = [local];
  const restart = () => {
    const options: JournalSyncOptions = { canUseRemoteSync: true, hasNetwork: true, userScope: 'user:a',
      resolveRemoteId: () => undefined, initialMutations: JSON.parse(JSON.stringify(queue)),
      persistRemoteDreams: async updater => { dreams = typeof updater === 'function' ? updater(dreams) : updater; } };
    return createJournalSyncEngine({
      savePendingDreamMutations: async pending => { queue = JSON.parse(JSON.stringify(pending)); },
      ...transport, createDreamInSupabase: jest.fn(), updateDreamInSupabase: jest.fn(), deleteDreamFromSupabase: jest.fn(),
      reportSyncQueueMetrics: jest.fn(), recordSyncReplayMetrics: jest.fn(), logger: { warn: jest.fn() },
    }, options).bind(options, { id: 'a' });
  };
  return { restart, rpc, receipts, queue: () => queue, dreams: () => dreams, row: () => row, writes: () => writes, creates: () => creates,
    pauseNextResponse: () => {
      let arrive!: () => void; let resume!: () => void;
      const arrived = new Promise<void>(resolve => { arrive = resolve; });
      const resumed = new Promise<void>(resolve => { resume = resolve; });
      pausedResponse = { arrive, resumed };
      return { arrived, resume };
    },
    upgrade: () => { upgraded = true; row.personal_notes = []; }, loseNextResponse: () => { loseResponse = true; },
    remoteEdit: () => { row = { ...row, revision_id: 'newer-remote', personal_notes: [{ ...note, text: 'Other device' }] }; } };
}

describe('personal-note recovery from a legacy durable receipt', () => {
  it.each(['create', 'update'] as const)('recovers a %s after restart and reuses the new receipt after a lost response', async operation => {
    const state = setup(operation);
    await state.restart().syncPendingMutations();
    expect(state.row().personal_notes).toBeUndefined();
    // The recovered identity must be visible immediately, before the next replay;
    // using an older queued payload here loses the durable server receipt.
    expect(state.dreams()[0]).toMatchObject({ remoteId: 42, revisionId: 'r1', personalNotes: [note] });
    const recovery = state.queue()[0];
    expect(recovery).toMatchObject({ id: 'local-mutation', operation: 'update', status: 'failed', baseRevision: 'r1',
      payload: { dream: { clientRequestId: local.clientRequestId, remoteId: 42, personalNotes: [note] } } });
    expect(recovery.clientRequestId).not.toBe('old-receipt');
    expect(state.receipts.get('old-receipt')?.dream).not.toHaveProperty('personal_notes');
    state.upgrade();
    state.loseNextResponse();
    await state.restart().syncPendingMutations();
    expect(state.row().personal_notes).toEqual([note]);
    expect(state.queue()[0].clientRequestId).toBe(recovery.clientRequestId);
    expect(state.queue()[0].status).toBe('failed');
    await state.restart().syncPendingMutations();
    expect(state.queue()).toEqual([]);
    expect(state.dreams()).toHaveLength(1);
    expect(state.dreams()[0]).toMatchObject({ id: local.id, remoteId: 42, personalNotes: [note], syncState: 'clean' });
    expect(state.writes()).toBe(2);
    expect(state.creates()).toBe(operation === 'create' ? 1 : 0);
    expect(state.receipts.size).toBe(2);
  });

  it.each(['update', 'delete'] as const)('resolves a %s queued while the incomplete create is in flight', async operation => {
    const state = setup('create');
    const commands = state.restart();
    const pause = state.pauseNextResponse();
    const replay = commands.syncPendingMutations();
    await pause.arrived;
    const newerDream = { ...local, personalNotes: [{ ...note, text: 'A later draft' }] };
    await commands.queueOfflineOperation({
      ...state.queue()[0], id: 'later-mutation', clientRequestId: 'later-receipt', operation, status: 'pending',
      payload: operation === 'delete' ? { tombstone: local } : { dream: newerDream },
    }, () => operation === 'delete' ? [] : [newerDream]);
    state.upgrade();
    pause.resume();
    await replay;
    expect(state.queue()).toEqual([]);
    const lastRequest = state.rpc.mock.calls.at(-1)![1].mutations[0];
    expect(lastRequest.operation).toBe(operation);
    expect(lastRequest.payload.remote_id).toBe(42);
    expect(state.dreams()).toHaveLength(operation === 'delete' ? 0 : 1);
    if (operation === 'update') {
      expect(state.row().personal_notes).toEqual(newerDream.personalNotes);
      expect(state.dreams()[0].personalNotes).toEqual(newerDream.personalNotes);
    }
    expect(state.creates()).toBe(1);
  });

  it('replaces an incomplete recovery only after a later notes snapshot was acknowledged', async () => {
    const state = setup('create');
    const commands = state.restart();
    const pause = state.pauseNextResponse();
    const replay = commands.syncPendingMutations();
    await pause.arrived;
    const newerDream = { ...local, personalNotes: [{ ...note, text: 'Latest writing' }] };
    await commands.queueOfflineOperation({
      ...state.queue()[0], id: 'later-mutation', clientRequestId: 'later-receipt', operation: 'update',
      status: 'pending', payload: { dream: newerDream },
    }, () => [newerDream]);
    pause.resume();
    // The backend still predates notes through BOTH subsequent writes.
    await replay;
    expect(state.row().personal_notes).toBeUndefined();
    expect(state.queue()).toHaveLength(1);
    expect(state.queue()[0].payload.dream?.personalNotes).toEqual(newerDream.personalNotes);
    state.upgrade();
    await state.restart().syncPendingMutations();
    expect(state.queue()).toEqual([]);
    expect(state.row().personal_notes).toEqual(newerDream.personalNotes);
    expect(state.dreams()[0]).toMatchObject({ personalNotes: newerDream.personalNotes, syncState: 'clean' });
    expect(state.creates()).toBe(1);
  });

  it('keeps both versions and blocks instead of overwriting a newer remote revision', async () => {
    const state = setup('create');
    await state.restart().syncPendingMutations();
    state.upgrade();
    state.remoteEdit();
    await state.restart().syncPendingMutations();
    expect(state.queue()[0].status).toBe('blocked');
    expect(state.row().personal_notes).toEqual([{ ...note, text: 'Other device' }]);
    expect(state.dreams()[0].personalNotes).toEqual([note]);
    expect(state.dreams()[0].conflictRemoteDream?.personalNotes).toEqual([{ ...note, text: 'Other device' }]);
    expect(state.writes()).toBe(1);
  });
});
