import { randomUUID } from 'node:crypto';
import { test, expect, client, admin } from '../backend-fixtures';

const reflection = (text: string) => {
  const now = Date.now();
  return { id: randomUUID(), text, createdAt: now, updatedAt: now };
};
const mutation = (operation: 'create' | 'update', payload: Record<string, unknown>) => ({
  mutation_id: randomUUID(), client_request_id: randomUUID(), operation,
  entity_key: `dream:${payload.remote_id ?? 'new'}`, payload,
});

// This is a real authenticated PostgREST/RPC journey against the guarded local
// backend. The UI cannot produce corrupt note JSON or observe private receipts.
test('invalid notes fail individually, preserve saved dreams and retry without stale receipts', async ({ accounts }) => {
  const owner = client();
  expect((await owner.auth.signInWithPassword(accounts.free)).error).toBeNull();
  try {
    const originalNote = reflection('A reflection already saved before this batch.');
    const seeded = await owner.from('dreams').insert([
      { user_id: accounts.free.id, client_request_id: randomUUID(), transcript: 'Original dream', title: 'Original title',
        interpretation: '', shareable_quote: '', dream_type: 'Symbolic Dream', personal_notes: [originalNote] },
      { user_id: accounts.free.id, client_request_id: randomUUID(), transcript: 'Another dream', title: 'Another title',
        interpretation: '', shareable_quote: '', dream_type: 'Symbolic Dream', personal_notes: [] },
    ]).select('id,transcript,title,personal_notes,revision_id');
    expect(seeded.error).toBeNull();
    const original = seeded.data!.find(dream => dream.transcript === 'Original dream')!;
    const sibling = seeded.data!.find(dream => dream.transcript === 'Another dream')!;
    const validNote = reflection('A valid sibling in the same batch.');
    const badCreate = mutation('create', { transcript: 'Create rejected then corrected', personal_notes: [reflection('x'.repeat(4001))] });
    const badUpdate = mutation('update', {
      remote_id: original.id, transcript: 'This must not overwrite the original', title: 'This must not be saved',
      personal_notes: Array.from({ length: 51 }, () => reflection('Too many notes')),
    });
    const before = mutation('create', { transcript: 'A valid create before invalid notes', personal_notes: [validNote] });
    const after = mutation('update', { remote_id: sibling.id, title: 'Valid sibling update after invalid notes' });
    const legacy = mutation('create', { transcript: 'Legacy create with notes omitted' });
    const batch = [before, badCreate, badUpdate, after, legacy];
    const synced = await owner.rpc('sync_dream_mutations', { mutations: batch });
    expect(synced.error).toBeNull();
    expect(synced.data.map((entry: { status: string }) => entry.status)).toEqual(['ack', 'failed', 'failed', 'ack', 'ack']);
    for (const index of [1, 2]) {
      expect(synced.data[index]).toEqual({
        mutation_id: batch[index].mutation_id, client_request_id: batch[index].client_request_id,
        operation: batch[index].operation, status: 'failed', error: 'DREAM_PERSONAL_NOTES_INVALID',
      });
    }
    const readOriginal = async () => {
      const result = await owner.from('dreams').select('id,transcript,title,personal_notes,revision_id').eq('id', original.id).single();
      expect(result.error).toBeNull();
      return result.data!;
    };
    expect(await readOriginal()).toEqual(original);
    expect(synced.data[0].dream.personal_notes).toEqual([validNote]);
    expect(synced.data[3].dream.title).toBe('Valid sibling update after invalid notes');
    expect(synced.data[4].dream.personal_notes).toEqual([]);
    const readReceipts = async () => {
      const result = await admin.from('dream_sync_receipts').select('client_request_id,mutation_status').eq('user_id', accounts.free.id);
      expect(result.error).toBeNull();
      return result.data!;
    };
    expect((await readReceipts()).map(receipt => receipt.client_request_id).sort()).toEqual(
      [before, after, legacy].map(entry => entry.client_request_id).sort(),
    );
    const failedCreate = await owner.from('dreams').select('id').eq('client_request_id', badCreate.client_request_id);
    expect(failedCreate.error).toBeNull();
    expect(failedCreate.data).toEqual([]);

    // The rejected identities remain usable: neither refusal became a receipt.
    const correctedNote = reflection('Corrected without changing the request identity.');
    const corrected = [
      { ...badCreate, payload: { ...badCreate.payload, personal_notes: [correctedNote] } },
      { ...badUpdate, payload: { remote_id: original.id, personal_notes: [originalNote, correctedNote] } },
    ];
    const retry = await owner.rpc('sync_dream_mutations', { mutations: corrected });
    expect(retry.error).toBeNull();
    expect(retry.data.map((entry: { status: string }) => entry.status)).toEqual(['ack', 'ack']);
    const updatedOriginal = await readOriginal();
    expect(updatedOriginal).toMatchObject({ transcript: original.transcript, title: original.title, personal_notes: [originalNote, correctedNote] });
    const replay = await owner.rpc('sync_dream_mutations', { mutations: corrected });
    expect(replay.error).toBeNull();
    expect(replay.data).toEqual(retry.data);
    expect(await readOriginal()).toEqual(updatedOriginal);
    expect(await readReceipts()).toHaveLength(5);
    const allDreams = await owner.from('dreams').select('id');
    expect(allDreams.error).toBeNull();
    expect(allDreams.data).toHaveLength(5);
    // Successful receipt replay still wins even if a caller changes its payload.
    const originalReplay = await owner.rpc('sync_dream_mutations', { mutations: [badCreate, badUpdate] });
    expect(originalReplay.error).toBeNull();
    expect(originalReplay.data).toEqual(retry.data);
  } finally {
    await owner.auth.signOut();
  }
});

test('malformed note collections stay isolated and disclose no foreign dream or receipt', async ({ accounts }) => {
  const owner = client();
  const other = client();
  expect((await owner.auth.signInWithPassword(accounts.free)).error).toBeNull();
  expect((await other.auth.signInWithPassword(accounts.other)).error).toBeNull();
  try {
    const note = reflection('Private owner reflection.');
    const seeded = await owner.from('dreams').insert({
      user_id: accounts.free.id, client_request_id: randomUUID(), transcript: 'Private owner dream', title: 'Private title',
      interpretation: '', shareable_quote: '', dream_type: 'Symbolic Dream', personal_notes: [note],
    }).select('id,transcript,personal_notes,revision_id').single();
    expect(seeded.error).toBeNull();
    const original = seeded.data!;
    const invalidCollections = [null, {}, [note, note], [{ ...note, updatedAt: note.createdAt - 1 }], [{ ...note, text: ' ' }]];
    const rejected = invalidCollections.flatMap(personal_notes => [
      mutation('create', { transcript: 'Invalid shape', personal_notes }),
      mutation('update', { remote_id: original.id, personal_notes }),
    ]);
    const valid = mutation('create', { transcript: 'Valid continuation after malformed entries' });
    const result = await other.rpc('sync_dream_mutations', { mutations: [...rejected, valid] });
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(rejected.length + 1);
    rejected.forEach((entry, index) => {
      expect(result.data[index]).toEqual({
        mutation_id: entry.mutation_id, client_request_id: entry.client_request_id,
        operation: entry.operation, status: 'failed', error: 'DREAM_PERSONAL_NOTES_INVALID',
      });
    });
    expect(result.data.at(-1).status).toBe('ack');
    const receipts = await admin.from('dream_sync_receipts').select('client_request_id').eq('user_id', accounts.other.id);
    expect(receipts.error).toBeNull();
    expect(receipts.data).toEqual([{ client_request_id: valid.client_request_id }]);
    // A well-formed retry cannot bypass ownership after the validation refusal.
    const unauthorized = await other.rpc('sync_dream_mutations', { mutations: [{
      ...rejected[1], payload: { remote_id: original.id, personal_notes: [] },
    }] });
    expect(unauthorized.error).toBeNull();
    expect(unauthorized.data[0]).toMatchObject({ status: 'failed', error: 'Dream not found' });
    expect(unauthorized.data[0].dream).toBeUndefined();
    const saved = await owner.from('dreams').select('id,transcript,personal_notes,revision_id').eq('id', original.id).single();
    expect(saved.error).toBeNull();
    expect(saved.data).toEqual(original);
    const privateRead = await other.from('dreams').select('id,personal_notes').eq('id', original.id);
    expect(privateRead.error).toBeNull();
    expect(privateRead.data).toEqual([]);
    // Direct writes still meet the unchanged table constraint.
    const direct = await owner.from('dreams').update({ personal_notes: [reflection('x'.repeat(4001))] }).eq('id', original.id);
    expect(direct.error?.code).toBe('23514');
  } finally {
    await owner.auth.signOut();
    await other.auth.signOut();
  }
});
