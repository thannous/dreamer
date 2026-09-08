import { createJournalImportEngine, journalCopyIdentity, type JournalImportSnapshot } from '@/lib/lucid/journalImport';
import { createLucidJournalImportReader, type JournalImportSessionAuthority } from '../lucidJournalImportReader';
const uid = '00000000-0000-4000-8000-000000000001';
const gid = '00000000-0000-4000-8000-000000000002';
const cursor = '00000000-0000-4000-8000-000000000003';
const next = '00000000-0000-4000-8000-000000000004';
const date = '2026-09-09T00:00:00Z';
const item = { id: '9007199254740993', clientRequestId: null, revision: '3aaee3bb-5491-4bc2-8800-52f11337c603', createdAt: date, transcript: 'My dream' };
function setup() {
  let authority: JournalImportSessionAuthority | null = { userId: uid, clientId: 'registered-lucid', product: 'lucid', sessionGeneration: '1', destinationScope: 'guest' };
  let now = new Date(date);
  const rpc = jest.fn(async (): Promise<{ data: unknown; error: { message: string; code?: string } | null }> =>
    ({ data: { grantId: gid, items: [item], nextCursor: null, done: true }, error: null }));
  const deps = { client: { rpc }, confirmation: { confirmed: true as const, grantId: gid, cursor, sourceAccount: uid,
    destinationScope: 'guest', destinationClientId: 'registered-lucid', expiresAt: '2026-09-10T00:00:00Z', scope: 'all' as const },
  getSessionAuthority: () => authority, now: () => now };
  return { deps, rpc, input: { grantId: gid, cursor, sourceAccount: uid },
    setAuthority: (patch: Partial<JournalImportSessionAuthority> | null) => { authority = patch === null ? null : { ...authority!, ...patch }; },
    expire: () => { now = new Date('2026-09-11'); } };
}
it('calls only the exact snake_case RPC arguments and preserves decimal IDs and opaque UUID revisions in the camelCase response', async () => {
  const x = setup();
  const read = createLucidJournalImportReader(x.deps);
  expect((await read(x.input)).items).toEqual([item]);
  expect(x.rpc).toHaveBeenCalledWith('read_journal_import_page', { p_cursor: cursor, p_limit: 100 });
});
it('uses returned opaque cursors for subsequent pages and strips extra private fields', async () => {
  const x = setup();
  x.rpc.mockResolvedValueOnce({ data: { grantId: gid, items: [{ ...item, audioUrl: 'secret', analysis: 'secret' }], nextCursor: next, done: false }, error: null });
  const read = createLucidJournalImportReader({ ...x.deps, limit: 200 });
  const page = await read(x.input);
  expect(page.items[0]).toEqual(item);
  await read({ ...x.input, cursor: page.nextCursor! });
  expect(x.rpc).toHaveBeenLastCalledWith('read_journal_import_page', { p_cursor: next, p_limit: 200 });
});
it('propagates denial as an error, never an empty page', async () => {
  const x = setup();
  x.rpc.mockResolvedValue({ data: null, error: { message: 'Import grant unavailable', code: '42501' } });
  await expect(createLucidJournalImportReader(x.deps)(x.input)).rejects.toThrow('denied');
  expect(x.rpc).toHaveBeenCalledTimes(1);
});
it.each([
  { grantId: gid, items: [{ ...item, revision: '123' }], nextCursor: null, done: true },
  null, { grant_id: gid, items: [], next_cursor: null, done: true },
  { grantId: 'wrong', items: [], nextCursor: null, done: true },
  { grantId: gid, items: [{ ...item, id: 9007199254740993 }], nextCursor: null, done: true },
  { grantId: gid, items: [{ ...item, createdAt: undefined, created_at: date }], nextCursor: null, done: true },
  { grantId: gid, items: [], nextCursor: cursor, done: false },
  { grantId: gid, items: [item, item], nextCursor: null, done: true },
])('rejects malformed payload %#', async payload => {
  const x = setup();
  x.rpc.mockResolvedValue({ data: payload, error: null });
  await expect(createLucidJournalImportReader(x.deps)(x.input)).rejects.toThrow();
});
it.each([{ userId: 'another' }, { clientId: 'journal' }, { destinationScope: 'user:B' }, { sessionGeneration: '2' }, null])('rejects authority change during a request %#', async change => {
  const x = setup();
  const read = createLucidJournalImportReader(x.deps);
  x.rpc.mockImplementation(async () => {
    x.setAuthority(change);
    return { data: { grantId: gid, items: [item], nextCursor: null, done: true }, error: null };
  });
  await expect(read(x.input)).rejects.toThrow('session');
});
it('rejects mismatched requests and expiry before network access', async () => {
  const x = setup();
  const read = createLucidJournalImportReader(x.deps);
  await expect(read({ ...x.input, grantId: next })).rejects.toThrow('confirmation');
  await expect(read({ ...x.input, sourceAccount: next })).rejects.toThrow('confirmation');
  x.expire();
  await expect(read(x.input)).rejects.toThrow('expired');
  expect(x.rpc).not.toHaveBeenCalled();
});
it('requires a valid initial scoped session and valid limit', () => {
  const x = setup();
  expect(() => createLucidJournalImportReader({ ...x.deps, limit: 201 })).toThrow();
  x.setAuthority(null);
  expect(() => createLucidJournalImportReader(x.deps)).toThrow('session');
});

it('imports the real SQL response shape end to end with a UUID revision', async () => {
  const x = setup();
  let persisted: JournalImportSnapshot | null = null;
  const engine = createJournalImportEngine({
    storage: { load: async () => persisted, save: async (_scope, state, check) => { check(); persisted = state; } },
    readPage: createLucidJournalImportReader(x.deps),
    getCurrentDestinationScope: () => 'guest', getCurrentSourceAccount: () => uid, now: x.deps.now,
  });
  const state = await engine.start(x.deps.confirmation);
  expect(state.copies[journalCopyIdentity(uid, item.id)]).toMatchObject({
    sourceId: '9007199254740993', sourceRevision: '3aaee3bb-5491-4bc2-8800-52f11337c603', text: 'My dream',
  });
  expect(persisted).toEqual(state);
});

it('accepts a replay retaining the server original page IDs despite a smaller requested limit', async () => {
  const x = setup();
  const items = Array.from({ length: 200 }, (_, index) => ({ ...item, id: String(index + 1) }));
  x.rpc.mockResolvedValue({ data: { grantId: gid, items, nextCursor: next, done: false }, error: null });
  expect((await createLucidJournalImportReader({ ...x.deps, limit: 1 })(x.input)).items).toHaveLength(200);
  x.rpc.mockResolvedValue({ data: { grantId: gid, items: [...items, { ...item, id: '201' }], nextCursor: null, done: true }, error: null });
  await expect(createLucidJournalImportReader(x.deps)(x.input)).rejects.toThrow('Malformed');
});
