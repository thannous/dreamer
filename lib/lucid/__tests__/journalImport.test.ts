import { createJournalImportEngine, journalCopyIdentity, type JournalImportSnapshot, type JournalImportPage } from '../journalImport';
const date = '2026-09-08T00:00:00.000Z';
const item = (id: number, revision = '1') => ({ id: String(id), revision, transcript: `Dream ${id}`, createdAt: date, clientRequestId: null });
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
  x.readPage.mockResolvedValue({ grantId: 'g2', items: [item(0, '2')], nextCursor: null, done: true });
  const second = await x.engine.start({ ...x.confirmation, grantId: 'g2' });
  expect(second.copies[id].text).toBe('My words');
  expect(second.copies[id].incoming?.revision).toBe('2');
  const resolved = await x.engine.updateCopy('guest', id, { type: 'keepLocal' });
  expect(resolved.copies[id].text).toBe('My words');
  expect(resolved.copies[id].sourceRevision).toBe('2');
  await x.engine.updateCopy('guest', id, { type: 'delete' });
  x.readPage.mockResolvedValue({ grantId: 'g3', items: [item(0, '3')], nextCursor: null, done: true });
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
  x.readPage.mockResolvedValue({ grantId: 'g2', items: [{ ...item(0, '2'), transcript: 'New' }], nextCursor: null, done: true });
  expect((await x.engine.start({ ...x.confirmation, grantId: 'g2' })).copies[id].text).toBe('New');
  await x.engine.updateCopy('guest', id, { type: 'edit', text: 'Own' });
  x.readPage.mockResolvedValue({ grantId: 'g3', items: [{ ...item(0, '3'), transcript: 'Incoming' }], nextCursor: null, done: true });
  await x.engine.start({ ...x.confirmation, grantId: 'g3' });
  const state = await x.engine.updateCopy('guest', id, { type: 'useIncoming' });
  expect(state.copies[id]).toMatchObject({ text: 'Incoming', edited: false, sourceRevision: '3' });
});
it('rejects expired grants and malformed pages without empty overwrite', async () => {
  const x = setup();
  await expect(x.engine.start({ ...x.confirmation, expiresAt: '2020-01-01' })).rejects.toThrow('expired');
  x.readPage.mockResolvedValue({ grantId: 'wrong', items: [], nextCursor: null, done: true });
  await expect(x.engine.start(x.confirmation)).rejects.toThrow('Invalid import page');
  expect(x.storage.save).not.toHaveBeenCalled();
});
