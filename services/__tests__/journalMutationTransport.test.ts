import type { SupabaseClient } from '@supabase/supabase-js';
import { createJournalMutationTransport } from '../journalMutationTransport';
import { createDreamMutation } from '@/lib/dreamUtils';
import type { DreamAnalysis } from '@/lib/types';

const dream: DreamAnalysis = {
  id: 1, clientRequestId: 'dream-a', transcript: 't', title: 'a',
  interpretation: '', shareableQuote: '', imageUrl: '', dreamType: 'Symbolic Dream',
  chatHistory: [], isFavorite: false,
};
const row = { id: 42, created_at: '2020-01-01T00:00:00.000Z', transcript: 't', title: 'a',
  interpretation: '', shareable_quote: '', image_url: null, chat_history: [],
  dream_type: 'Symbolic Dream', is_favorite: false, client_request_id: 'dream-a' };
const mutation = () => createDreamMutation({
  id: 'mutation-a', userScope: 'user:a', entityType: 'dream', entityKey: 'client:dream-a',
  operation: 'create', clientRequestId: 'receipt-a', clientUpdatedAt: 1,
  payload: { dream }, status: 'pending', retryCount: 0, createdAt: 1,
});
const ensureRemoteImage = jest.fn(async (value: DreamAnalysis) => value);

function directClient(missingMemory = false) {
  const single = jest.fn()
    .mockResolvedValueOnce(missingMemory
      ? { data: null, error: { code: 'PGRST204', message: 'memory missing from schema cache' } }
      : { data: row, error: null })
    .mockResolvedValue({ data: row, error: null });
  const upsert = jest.fn((_payload: Record<string, unknown>) => ({ select: () => ({ single }) }));
  return { from: jest.fn(() => ({ upsert })), upsert };
}

describe('journal mutation transport factory', () => {
  it('retains optional-column compatibility across calls, isolated per factory', async () => {
    const client = directClient(true);
    const transport = createJournalMutationTransport({
      getClient: () => client as unknown as SupabaseClient, ensureRemoteImage,
    });
    await transport.syncDreamMutationsInSupabase([mutation()], 'a');
    await transport.syncDreamMutationsInSupabase([mutation()], 'a');
    expect(client.upsert).toHaveBeenCalledTimes(3);
    expect(client.upsert.mock.calls[0][0]).toHaveProperty('memory');
    expect(client.upsert.mock.calls[1][0]).not.toHaveProperty('memory');
    expect(client.upsert.mock.calls[2][0]).not.toHaveProperty('memory');
    const fresh = directClient();
    await createJournalMutationTransport({ getClient: () => fresh as unknown as SupabaseClient,
      ensureRemoteImage }).syncDreamMutationsInSupabase([mutation()], 'a');
    expect(fresh.upsert.mock.calls[0][0]).toHaveProperty('memory');
  });

  it('resolves the injected client after asynchronous media preparation', async () => {
    const oldRpc = jest.fn();
    const newRpc = jest.fn().mockResolvedValue({ data: [], error: null });
    let client = { rpc: oldRpc };
    const prepare = jest.fn(async (value: DreamAnalysis) => {
      client = { rpc: newRpc };
      return value;
    });
    await createJournalMutationTransport({ getClient: () => client as unknown as SupabaseClient,
      ensureRemoteImage: prepare }).syncDreamMutationsInSupabase([mutation()], 'a');
    expect(oldRpc).not.toHaveBeenCalled();
    expect(newRpc).toHaveBeenCalledWith('sync_dream_mutations', expect.objectContaining({ mutations: expect.any(Array) }));
    expect(prepare).toHaveBeenCalledWith(dream, 'a');
  });

  it('does not silently fall back on an authorization error', async () => {
    const client = { rpc: jest.fn().mockResolvedValue({ data: null,
      error: { code: '42501', message: 'permission denied' } }), from: jest.fn() };
    await expect(createJournalMutationTransport({ getClient: () => client as unknown as SupabaseClient,
      ensureRemoteImage }).syncDreamMutationsInSupabase([mutation()], 'a')).rejects.toThrow('permission denied');
    expect(client.from).not.toHaveBeenCalled();
  });
});
