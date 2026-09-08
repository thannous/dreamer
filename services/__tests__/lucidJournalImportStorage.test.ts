import { createLucidJournalImportStorage } from '../lucidJournalImportStorage';
import { journalCopyIdentity, type JournalImportSnapshot } from '@/lib/lucid/journalImport';
import { getLucidKeyValueStorage } from '../lucidKeyValueStorage';

jest.mock('../lucidKeyValueStorage', () => ({ getLucidKeyValueStorage: jest.fn(), isLucidNativeKeyValueStorage: () => true }));
jest.mock('../lucidTrainerSecureStorage', () => ({
  isLucidTrainerEncryptedValue: (value: string) => value.startsWith('encrypted:'),
  protectLucidTrainerStoredValue: async (key: string, value: string) => {
    if (new TextEncoder().encode(value).length > 1_500_000) throw new Error('Crypto capacity');
    // Reject broken surrogate pairs at chunk boundaries, matching UTF-8 round-trip requirements.
    if (new TextDecoder().decode(new TextEncoder().encode(value)) !== value) throw new Error('Broken Unicode');
    return `encrypted:${key.length}:${key}${value}`;
  },
  revealLucidTrainerStoredValue: async (key: string, value: string) => {
    const prefix = `encrypted:${key.length}:${key}`;
    if (!value.startsWith(prefix)) throw new Error('Wrong authenticated key');
    return value.slice(prefix.length);
  },
}));
const date = '2026-09-08T00:00:00.000Z';
function snapshot(count: number): JournalImportSnapshot {
  return { version: 1, checkpoint: { grantId: 'grant', sourceAccount: 'A', cursor: null, done: true },
    copies: Object.fromEntries(Array.from({ length: count }, (_, i) => {
      const identity = journalCopyIdentity('A', String(i));
      return [identity, { identity, sourceProduct: 'journal' as const, sourceAccount: 'A', sourceId: String(i),
        sourceRevision: '00000000-0000-4000-8000-000000000001', createdAt: date, importedAt: date, text: 'Rêve 🌙 漢字'.repeat(120), edited: false, deleted: false }];
    })) };
}
function fixture() {
  const values = new Map<string, string>();
  const kv = { getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { values.delete(key); }) };
  jest.mocked(getLucidKeyValueStorage).mockReturnValue(kv);
  return { values, kv, adapter: createLucidJournalImportStorage() };
}
it('round trips 2501 realistic Unicode transcripts beyond the single-value crypto limit', async () => {
  const x = fixture();
  const state = snapshot(2501);
  expect(new TextEncoder().encode(JSON.stringify(state)).length).toBeGreaterThan(1_500_000);
  await x.adapter.save('guest', state, () => undefined);
  expect(await x.adapter.load('guest')).toEqual(state);
  expect([...x.values.values()].every(value => value.startsWith('encrypted:'))).toBe(true);
  expect([...x.values.keys()].some(key => key.endsWith(':pending'))).toBe(false);
});
it.each(['middle chunk', 'manifest'])('retains the previous snapshot on failed %s and cleans only owned chunks', async phase => {
  const x = fixture();
  const old = snapshot(1);
  await x.adapter.save('guest', old, () => undefined);
  await x.adapter.save('user:B', snapshot(2), () => undefined);
  const foreign = [...x.values].filter(([key]) => key.includes('user%3AB'));
  const original = x.kv.setItem.getMockImplementation()!;
  let chunk = 0;
  x.kv.setItem.mockImplementation(async (key, value) => {
    if (phase === 'middle chunk' && key.includes(':chunk:') && ++chunk === 2) throw new Error('full');
    if (phase === 'manifest' && key.endsWith(':v2')) throw new Error('full');
    await original(key, value);
  });
  await expect(x.adapter.save('guest', snapshot(2501), () => undefined)).rejects.toThrow('full');
  expect(await x.adapter.load('guest')).toEqual(old);
  expect([...x.values].filter(([key]) => key.includes('user%3AB'))).toEqual(foreign);
  expect([...x.values.keys()].filter(key => key.startsWith('noctalia_lucid_journal_copies:guest:'))).toHaveLength(2);
});
it('cancels before publishing and recovers cleanup interrupted by a storage error on next read', async () => {
  const x = fixture();
  const old = snapshot(1);
  await x.adapter.save('guest', old, () => undefined);
  let cancelled = false;
  const original = x.kv.setItem.getMockImplementation()!;
  x.kv.setItem.mockImplementation(async (key, value) => {
    await original(key, value);
    if (key.includes(':chunk:')) cancelled = true;
  });
  x.kv.removeItem.mockRejectedValueOnce(new Error('interrupted cleanup'));
  await expect(x.adapter.save('guest', snapshot(2501), () => { if (cancelled) throw new Error('cancelled'); })).rejects.toThrow('cancelled');
  expect([...x.values.keys()].some(key => key.endsWith(':pending'))).toBe(true);
  expect(await x.adapter.load('guest')).toEqual(old);
  expect([...x.values.keys()].some(key => key.endsWith(':pending'))).toBe(false);
  expect(x.values.size).toBe(2);
});
it('keeps the published generation when the manifest write committed before reporting failure', async () => {
  const x = fixture();
  await x.adapter.save('guest', snapshot(1), () => undefined);
  const original = x.kv.setItem.getMockImplementation()!;
  x.kv.setItem.mockImplementation(async (key, value) => {
    await original(key, value);
    if (key.endsWith(':v2')) throw new Error('uncertain acknowledgement');
  });
  const next = snapshot(2);
  await expect(x.adapter.save('guest', next, () => undefined)).rejects.toThrow('uncertain');
  expect(await x.adapter.load('guest')).toEqual(next);
  expect(x.values.size).toBe(2);
});
it('accepts Journal UUID revision tokens and rejects malformed or UUID source ids', async () => {
  const x = fixture();
  const revision = '3f73ab45-9a14-4db9-94a3-d24724457d9e';
  const incoming = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const identity = journalCopyIdentity('A', '0');
  const state: JournalImportSnapshot = { version: 1, checkpoint: null, copies: {
    [identity]: { identity, sourceProduct: 'journal', sourceAccount: 'A', sourceId: '0',
      sourceRevision: revision, createdAt: date, importedAt: date, text: 'Dream', edited: true, deleted: false,
      incoming: { text: 'New', revision: incoming, createdAt: date } },
  } };
  await x.adapter.save('guest', state, () => undefined);
  expect(await x.adapter.load('guest')).toEqual(state);
  const malformed = structuredClone(state);
  malformed.copies[identity].sourceRevision = 'not-a-revision';
  expect(() => x.adapter.save('guest', malformed, () => undefined)).toThrow('Invalid stored copy');
  const empty = structuredClone(state);
  empty.copies[identity].incoming = { text: 'New', revision: '', createdAt: date };
  expect(() => x.adapter.save('guest', empty, () => undefined)).toThrow('Invalid stored copy');
  const uuidId = '3f73ab45-9a14-4db9-94a3-d24724457d9e';
  const uuidIdentity = journalCopyIdentity('A', uuidId);
  expect(() => x.adapter.save('guest', { version: 1, checkpoint: null, copies: {
    [uuidIdentity]: { identity: uuidIdentity, sourceProduct: 'journal', sourceAccount: 'A', sourceId: uuidId,
      sourceRevision: revision, createdAt: date, importedAt: date, text: 'Dream', edited: false, deleted: false },
  } }, () => undefined)).toThrow('Invalid stored copy');
});
it('serializes two adapters and fails closed on unprotected or missing chunks', async () => {
  const x = fixture();
  const second = createLucidJournalImportStorage();
  await Promise.all([x.adapter.save('guest', snapshot(1), () => undefined), second.save('guest', snapshot(2), () => undefined)]);
  expect(await x.adapter.load('guest')).toEqual(snapshot(2));
  const chunk = [...x.values.keys()].find(key => key.includes(':chunk:'))!;
  const encrypted = x.values.get(chunk)!;
  x.values.set(chunk, '{}');
  await expect(x.adapter.load('guest')).rejects.toThrow('Unprotected');
  x.values.set(chunk, encrypted);
  x.values.delete(chunk);
  await expect(x.adapter.load('guest')).rejects.toThrow('Missing import chunk');
});

it('round trips null source dates on copies and pending conflicts while retaining importedAt', async () => {
  const x = fixture();
  const state = snapshot(1);
  const copy = Object.values(state.copies)[0];
  copy.createdAt = null;
  copy.edited = true;
  copy.incoming = { text: 'Incoming', revision: '00000000-0000-4000-8000-000000000002', createdAt: null };
  await x.adapter.save('guest', state, () => undefined);
  expect(await x.adapter.load('guest')).toEqual(state);
  expect(copy.importedAt).toBe(date);
});
it('rejects non-string importedAt timestamps from persisted copies', async () => {
  const x = fixture();
  const state = snapshot(1);
  const identity = Object.keys(state.copies)[0];
  for (const importedAt of [42, [0]]) {
    const invalid = structuredClone(state);
    (invalid.copies[identity] as { importedAt: unknown }).importedAt = importedAt;
    expect(() => x.adapter.save('guest', invalid, () => undefined)).toThrow('Invalid stored copy');
  }
  await x.adapter.save('guest', state, () => undefined);
  const chunk = [...x.values.keys()].find(key => key.includes(':chunk:'))!;
  const prefix = `encrypted:${chunk.length}:${chunk}`;
  const stored = JSON.parse(x.values.get(chunk)!.slice(prefix.length)) as JournalImportSnapshot;
  const copy = stored.copies[identity] as { importedAt: unknown };
  for (const importedAt of [42, [0]]) {
    copy.importedAt = importedAt;
    x.values.set(chunk, `${prefix}${JSON.stringify(stored)}`);
    await expect(x.adapter.load('guest')).rejects.toThrow('Invalid stored copy');
  }
});
