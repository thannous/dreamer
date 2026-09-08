import { createJournalImportEngine, journalCopyIdentity, mergeJournalImportSnapshots, type JournalImportSnapshot, type JournalImportPage } from '../journalImport';
const date = '2026-09-08T00:00:00.000Z';
const revision = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const item = (id: number, rev = revision(1)) => ({ id: String(id), revision: rev, transcript: `Dream ${id}`, createdAt: date, clientRequestId: null });
function setup(count = 1) {
  let saved: JournalImportSnapshot | null = null;
  let scope = 'guest';
  let account = 'A';
  const readPage = jest.fn(async ({ cursor }: { cursor: string }): Promise<JournalImportPage> => {
    const offset = Number(cursor);
    const end = Math.min(offset + 1000, count);
    return { grantId: 'g', items: Array.from({ length: end - offset }, (_, i) => item(offset + i)), nextCursor: end < count ? String(end) : null, done: end >= count };
  });
  const storage = { load: jest.fn(async () => saved), save: jest.fn(async (_scope: string, next: JournalImportSnapshot, check: () => void) => {
    check(); saved = JSON.parse(JSON.stringify(next));
  }) };
  const engine = createJournalImportEngine({ storage, readPage, getCurrentDestinationScope: () => scope,
    getCurrentSourceAccount: () => account, now: () => new Date(date) });
  const confirmation = { confirmed: true as const, grantId: 'g', cursor: '0', expiresAt: '2026-09-09T00:00:00Z', sourceAccount: 'A', destinationScope: 'guest' };
  return { engine, storage, readPage, confirmation, saved: () => saved, switchScope: () => { scope = 'user:B'; }, switchAccount: () => { account = 'B'; } };
}
it.each([0, 1, 2501])('imports %i copies with durable exhaustive pagination', async count => {
  const x = setup(count);
  const state = await x.engine.start(x.confirmation);
  expect(Object.keys(state.copies)).toHaveLength(count);
  expect(state.checkpoint?.done).toBe(true);
  expect(x.readPage).toHaveBeenCalledTimes(Math.max(1, Math.ceil(count / 1000)));
  await x.engine.start(x.confirmation);
  expect(x.storage.save).toHaveBeenCalledTimes(Math.max(1, Math.ceil(count / 1000)));
});
it.each(['cancel', 'scope', 'source'])('rejects a mid-read %s without writing', async mode => {
  const x = setup();
  x.readPage.mockImplementationOnce(async () => {
    if (mode === 'cancel') x.engine.cancel(); else if (mode === 'scope') x.switchScope(); else x.switchAccount();
    return { grantId: 'g', items: [item(1)], nextCursor: null, done: true };
  });
  await expect(x.engine.start(x.confirmation)).rejects.toThrow('cancelled');
  expect(x.storage.save).not.toHaveBeenCalled();
});
it.each(['read', 'write'])('retries a failed %s from the last durable cursor', async mode => {
  const x = setup(2501);
  if (mode === 'read') x.readPage.mockImplementationOnce(async () => { throw new Error('offline'); });
  else x.storage.save.mockRejectedValueOnce(new Error('full'));
  await expect(x.engine.start(x.confirmation)).rejects.toThrow();
  expect(x.saved()).toBeNull();
  expect(Object.keys((await x.engine.start(x.confirmation)).copies)).toHaveLength(2501);
});
it('preserves local edits, resolves incoming explicitly and retains deletion tombstones', async () => {
  const x = setup();
  await x.engine.start(x.confirmation);
  const id = journalCopyIdentity('A', '0');
  await x.engine.updateCopy('guest', id, { type: 'edit', text: 'My words' });
  x.readPage.mockResolvedValue({ grantId: 'g2', items: [item(0, revision(2))], nextCursor: null, done: true });
  const second = await x.engine.start({ ...x.confirmation, grantId: 'g2' });
  expect(second.copies[id].text).toBe('My words');
  expect(second.copies[id].incoming?.revision).toBe(revision(2));
  const resolved = await x.engine.updateCopy('guest', id, { type: 'keepLocal' });
  expect(resolved.copies[id].text).toBe('My words');
  expect(resolved.copies[id].sourceRevision).toBe(revision(2));
  await x.engine.updateCopy('guest', id, { type: 'delete' });
  x.readPage.mockResolvedValue({ grantId: 'g3', items: [item(0, revision(3))], nextCursor: null, done: true });
  const third = await x.engine.start({ ...x.confirmation, grantId: 'g3' });
  expect(third.copies[id].deleted).toBe(true);
  expect(third.copies[id].text).toBe('');
});
it('fails closed on storage reads and never projects media or analysis', async () => {
  const x = setup();
  x.storage.load.mockRejectedValueOnce(new Error('corrupt'));
  await expect(x.engine.start(x.confirmation)).rejects.toThrow('corrupt');
  expect(x.readPage).not.toHaveBeenCalled();
  x.readPage.mockResolvedValue({ grantId: 'g', items: [{ ...item(1), analysis: 'private', audioUrl: 'private' } as ReturnType<typeof item>], nextCursor: null, done: true });
  const state = await x.engine.start(x.confirmation);
  expect(JSON.stringify(state)).not.toContain('private');
});
it('keeps the committed first page when the second read fails', async () => {
  const x = setup(2501);
  const reader = x.readPage.getMockImplementation()!;
  x.readPage.mockImplementationOnce(reader).mockRejectedValueOnce(new Error('offline'));
  await expect(x.engine.start(x.confirmation)).rejects.toThrow('offline');
  expect(x.saved()?.checkpoint?.cursor).toBe('1000');
  expect(Object.keys(x.saved()!.copies)).toHaveLength(1000);
  await x.engine.start(x.confirmation);
  expect(x.readPage.mock.calls[2][0].cursor).toBe('1000');
});
it('updates unedited copies and explicitly accepts an incoming conflict', async () => {
  const x = setup();
  await x.engine.start(x.confirmation);
  const id = journalCopyIdentity('A', '0');
  x.readPage.mockResolvedValue({ grantId: 'g2', items: [{ ...item(0, revision(2)), transcript: 'New' }], nextCursor: null, done: true });
  expect((await x.engine.start({ ...x.confirmation, grantId: 'g2' })).copies[id].text).toBe('New');
  await x.engine.updateCopy('guest', id, { type: 'edit', text: 'Own' });
  x.readPage.mockResolvedValue({ grantId: 'g3', items: [{ ...item(0, revision(3)), transcript: 'Incoming' }], nextCursor: null, done: true });
  await x.engine.start({ ...x.confirmation, grantId: 'g3' });
  const state = await x.engine.updateCopy('guest', id, { type: 'useIncoming' });
  expect(state.copies[id]).toMatchObject({ text: 'Incoming', edited: false, sourceRevision: revision(3) });
});
it('merges guest-only copies into the destination without overwriting account identities', () => {
  const guestId = journalCopyIdentity('G', '1');
  const accountId = journalCopyIdentity('A', '0');
  const sharedId = journalCopyIdentity('A', '1');
  const guest: JournalImportSnapshot = { version: 1, checkpoint: { grantId: 'g', sourceAccount: 'G', cursor: null, done: true }, copies: {
    [guestId]: { identity: guestId, sourceProduct: 'journal', sourceAccount: 'G', sourceId: '1', sourceRevision: revision(1), createdAt: date, importedAt: date, text: 'Guest', edited: true, deleted: false },
    [sharedId]: { identity: sharedId, sourceProduct: 'journal', sourceAccount: 'A', sourceId: '1', sourceRevision: revision(1), createdAt: date, importedAt: date, text: 'Guest shared', edited: true, deleted: false },
  } };
  const account: JournalImportSnapshot = { version: 1, checkpoint: { grantId: 'a', sourceAccount: 'A', cursor: 'c', done: false }, copies: {
    [accountId]: { identity: accountId, sourceProduct: 'journal', sourceAccount: 'A', sourceId: '0', sourceRevision: revision(1), createdAt: date, importedAt: date, text: 'Account', edited: false, deleted: false },
    [sharedId]: { identity: sharedId, sourceProduct: 'journal', sourceAccount: 'A', sourceId: '1', sourceRevision: revision(2), createdAt: date, importedAt: date, text: 'Account shared', edited: false, deleted: false },
  } };
  const merged = mergeJournalImportSnapshots(account, guest)!;
  expect(merged.copies[guestId].text).toBe('Guest');
  expect(merged.copies[accountId].text).toBe('Account');
  expect(merged.copies[sharedId].text).toBe('Account shared');
  expect(merged.checkpoint).toEqual(account.checkpoint);
  expect(mergeJournalImportSnapshots(null, guest)).toEqual(guest);
  expect(mergeJournalImportSnapshots(account, null)).toEqual(account);
  expect(mergeJournalImportSnapshots(null, null)).toBeNull();
});
it('rejects expired grants and malformed pages without empty overwrite', async () => {
  const x = setup();
  await expect(x.engine.start({ ...x.confirmation, expiresAt: '2020-01-01' })).rejects.toThrow('expired');
  x.readPage.mockResolvedValue({ grantId: 'wrong', items: [], nextCursor: null, done: true });
  await expect(x.engine.start(x.confirmation)).rejects.toThrow('Invalid import page');
  expect(x.storage.save).not.toHaveBeenCalled();
});

it.each(['delete', 'keepLocal', 'useIncoming'] as const)('confirms %s after a committed write loses its acknowledgement', async type => {
  const x = setup();
  await x.engine.start(x.confirmation);
  const id = journalCopyIdentity('A', '0');
  if (type !== 'delete') {
    await x.engine.updateCopy('guest', id, { type: 'edit', text: 'Own' });
    x.readPage.mockResolvedValue({ grantId: 'g2', items: [{ ...item(0, revision(2)), transcript: 'Incoming' }], nextCursor: null, done: true });
    await x.engine.start({ ...x.confirmation, grantId: 'g2' });
  }
  const save = x.storage.save.getMockImplementation()!;
  x.storage.save.mockImplementationOnce(async (...args) => { await save(...args); throw new Error('acknowledgement lost'); });
  const result = await x.engine.updateCopy('guest', id, { type });
  expect(result).toEqual(x.saved());
  expect(result.copies[id].incoming).toBeUndefined();
  expect(result.copies[id].text).toBe(type === 'delete' ? '' : type === 'keepLocal' ? 'Own' : 'Incoming');
  expect(result.copies[id].deleted).toBe(type === 'delete');
});
it('does not confirm an unapplied copy update and allows retry', async () => {
  const x = setup();
  await x.engine.start(x.confirmation);
  const id = journalCopyIdentity('A', '0');
  x.storage.save.mockRejectedValueOnce(new Error('storage full'));
  await expect(x.engine.updateCopy('guest', id, { type: 'delete' })).rejects.toThrow('storage full');
  expect(x.saved()!.copies[id].deleted).toBe(false);
  expect((await x.engine.updateCopy('guest', id, { type: 'delete' })).copies[id].deleted).toBe(true);
});
it('rejects an account change while reconciling an uncertain update', async () => {
  const x = setup();
  await x.engine.start(x.confirmation);
  const id = journalCopyIdentity('A', '0');
  const save = x.storage.save.getMockImplementation()!;
  x.storage.save.mockImplementationOnce(async (...args) => { await save(...args); x.switchScope(); throw new Error('acknowledgement lost'); });
  await expect(x.engine.updateCopy('guest', id, { type: 'delete' })).rejects.toThrow('cancelled');
});

it('accepts Journal UUID revision tokens and rejects empty, malformed, or UUID source ids', async () => {
  const token = '3f73ab45-9a14-4db9-94a3-d24724457d9e';
  const x = setup();
  x.readPage.mockResolvedValue({ grantId: 'g', items: [{ ...item(0, token) }], nextCursor: null, done: true });
  expect((await x.engine.start(x.confirmation)).copies[journalCopyIdentity('A', '0')].sourceRevision).toBe(token);
  for (const bad of [{ ...item(1, '') }, { ...item(1, 'not-a-revision') }, { ...item(1, token), id: token }]) {
    const y = setup();
    y.readPage.mockResolvedValue({ grantId: 'g', items: [bad], nextCursor: null, done: true });
    await expect(y.engine.start(y.confirmation)).rejects.toThrow('Invalid import item');
  }
});
it.each(['delete', 'keepLocal', 'useIncoming'] as const)(
  'reconciles a committed %s after an uncertain save acknowledgement',
  async type => {
    const x = setup();
    await x.engine.start(x.confirmation);
    const id = journalCopyIdentity('A', '0');
    if (type !== 'delete') {
      await x.engine.updateCopy('guest', id, { type: 'edit', text: 'Own' });
      x.readPage.mockResolvedValue({
        grantId: 'g2', items: [{ ...item(0, revision(2)), transcript: 'Incoming' }], nextCursor: null, done: true,
      });
      await x.engine.start({ ...x.confirmation, grantId: 'g2' });
    }
    const persist = x.storage.save.getMockImplementation()!;
    x.storage.save.mockImplementationOnce(async (scope, next, check) => {
      await persist(scope, next, check);
      throw new Error('uncertain acknowledgement');
    });
    const state = await x.engine.updateCopy('guest', id, { type });
    if (type === 'delete') expect(state.copies[id]).toMatchObject({ deleted: true, text: '' });
    else if (type === 'keepLocal') expect(state.copies[id]).toMatchObject({ text: 'Own', sourceRevision: revision(2) });
    else expect(state.copies[id]).toMatchObject({ text: 'Incoming', edited: false, sourceRevision: revision(2) });
    expect(state.copies[id].incoming).toBeUndefined();
    const retried = await x.engine.updateCopy('guest', id, { type });
    expect(retried.copies[id]).toEqual(state.copies[id]);
  },
);
it('still rejects an uncommitted copy update', async () => {
  const x = setup();
  await x.engine.start(x.confirmation);
  const id = journalCopyIdentity('A', '0');
  x.storage.save.mockRejectedValueOnce(new Error('full'));
  await expect(x.engine.updateCopy('guest', id, { type: 'delete' })).rejects.toThrow('full');
  expect(x.saved()?.copies[id].deleted).not.toBe(true);
});
it('keeps a committed page when save reports an uncertain acknowledgement', async () => {
  const x = setup();
  const persist = x.storage.save.getMockImplementation()!;
  x.storage.save.mockImplementationOnce(async (scope, next, check) => {
    await persist(scope, next, check);
    throw new Error('uncertain acknowledgement');
  });
  const state = await x.engine.start(x.confirmation);
  expect(Object.keys(state.copies)).toHaveLength(1);
  expect(state.checkpoint?.done).toBe(true);
});

it('rejects cancellation queued between reconciliation and its caller', async () => {
  const x = setup();
  await x.engine.start(x.confirmation);
  const id = journalCopyIdentity('A', '0');
  const save = x.storage.save.getMockImplementation()!;
  x.storage.save.mockImplementationOnce(async (...args) => {
    await save(...args);
    x.storage.load.mockImplementationOnce(async () => {
      queueMicrotask(() => queueMicrotask(() => x.engine.cancel()));
      return x.saved();
    });
    throw new Error('acknowledgement lost');
  });
  await expect(x.engine.updateCopy('guest', id, { type: 'delete' })).rejects.toThrow('cancelled');
});
