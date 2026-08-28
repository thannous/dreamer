import { normalizeLucidHkSleepSamples } from '@/lib/lucid/healthKitSleep';
import {
  deleteLucidHealthKitSnapshot,
  disableLucidHealthKitSnapshot,
  getLucidHealthKitStorageKey,
  importLucidHealthKitSnapshot,
  loadLucidHealthKitSnapshot,
  recordLucidHealthKitEmptySnapshot,
  saveLucidHealthKitSnapshot,
} from '@/services/lucidHealthKitStorage';

const memory = new Map<string, string>();
const storage = {
  getItem: jest.fn(async (key: string) => memory.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    memory.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    memory.delete(key);
  }),
};

const start = Date.UTC(2026, 7, 27, 22, 0, 0);

describe('Lucid HealthKit local snapshot storage', () => {
  beforeEach(() => {
    memory.clear();
    jest.clearAllMocks();
  });

  it('imports, reads, disables and deletes a local-only snapshot under a distinct key', async () => {
    const userScope = 'user-a';
    expect(getLucidHealthKitStorageKey(userScope)).toBe(
      'noctalia_lucid_healthkit:user-a:sleep_snapshot_v1'
    );
    expect(getLucidHealthKitStorageKey(userScope)).not.toContain('noctalia_lucid_trainer');

    const normalization = normalizeLucidHkSleepSamples([
      {
        uuid: 'watch',
        startDate: start,
        endDate: start + 60 * 60 * 1000,
        value: 3,
        sourceRevision: { source: { name: 'Apple Watch', bundleIdentifier: 'com.apple.NanoSleep' } },
      },
    ]);
    const imported = await importLucidHealthKitSnapshot(
      userScope,
      {
        importedAt: start,
        rangeStartMs: start,
        rangeEndMs: start + 8 * 60 * 60 * 1000,
        normalization,
      },
      storage
    );
    expect(imported.status).toBe('imported');
    await expect(loadLucidHealthKitSnapshot(userScope, storage)).resolves.toEqual(imported);

    const disabled = await disableLucidHealthKitSnapshot(userScope, storage);
    expect(disabled.status).toBe('disabled');
    expect(disabled.normalization?.samples).toHaveLength(1);

    await deleteLucidHealthKitSnapshot(userScope, storage);
    await expect(loadLucidHealthKitSnapshot(userScope, storage)).resolves.toMatchObject({
      status: 'empty',
      normalization: null,
    });
    expect(memory.size).toBe(0);
  });

  it('persists an ambiguous-empty snapshot without claiming denial', async () => {
    const snapshot = await recordLucidHealthKitEmptySnapshot(
      'user-empty',
      {
        importedAt: start,
        rangeStartMs: start,
        rangeEndMs: start + 7 * 24 * 60 * 60 * 1000,
        emptyReason: 'ambiguous_empty',
      },
      storage
    );
    expect(snapshot.status).toBe('empty');
    expect(snapshot.emptyReason).toBe('ambiguous_empty');
    await expect(loadLucidHealthKitSnapshot('user-empty', storage)).resolves.toEqual(snapshot);
  });

  it('removes corrupt or rejected snapshot shapes instead of exposing them', async () => {
    const key = getLucidHealthKitStorageKey('user-b');
    await storage.setItem(key, '{not-json');
    await expect(loadLucidHealthKitSnapshot('user-b', storage)).resolves.toMatchObject({
      status: 'empty',
      normalization: null,
    });
    expect(memory.has(key)).toBe(false);

    await storage.setItem(
      key,
      JSON.stringify({
        version: 1,
        status: 'imported-from-the-future',
        importedAt: start,
        rangeStartMs: start,
        rangeEndMs: start + 1,
        normalization: { samples: [] },
        emptyReason: null,
      })
    );
    await expect(loadLucidHealthKitSnapshot('user-b', storage)).resolves.toMatchObject({
      status: 'empty',
    });
    expect(memory.has(key)).toBe(false);

    await storage.setItem(
      key,
      JSON.stringify({
        version: 1,
        status: 'imported',
        importedAt: start,
        rangeStartMs: start + 8,
        rangeEndMs: start,
        normalization: null,
        emptyReason: null,
      })
    );
    await expect(loadLucidHealthKitSnapshot('user-b', storage)).resolves.toMatchObject({
      status: 'empty',
    });
    expect(memory.has(key)).toBe(false);
  });

  it('rejects corrupt samples, sources and status invariants', async () => {
    const key = getLucidHealthKitStorageKey('user-c');
    const valid = await importLucidHealthKitSnapshot(
      'user-c',
      {
        importedAt: start,
        rangeStartMs: start,
        rangeEndMs: start + 8 * 60 * 60 * 1000,
        normalization: normalizeLucidHkSleepSamples([
          {
            uuid: 'watch',
            startDate: start,
            endDate: start + 60 * 60 * 1000,
            value: 3,
            sourceRevision: { source: { name: 'Apple Watch', bundleIdentifier: 'com.apple.NanoSleep' } },
          },
        ]),
      },
      storage
    );
    await storage.setItem(
      key,
      JSON.stringify({
        ...valid,
        normalization: {
          ...valid.normalization,
          samples: [{ id: 'bad', startMs: start, endMs: start, categoryValue: 99, category: 'dream', sourceName: 1 }],
        },
      })
    );
    await expect(loadLucidHealthKitSnapshot('user-c', storage)).resolves.toMatchObject({ status: 'empty' });
    expect(memory.has(key)).toBe(false);

    await storage.setItem(
      key,
      JSON.stringify({
        ...valid,
        normalization: {
          ...valid.normalization,
          samples: [
            {
              id: 'mismatch',
              startMs: start,
              endMs: start + 1,
              categoryValue: 5,
              category: 'awake',
              sourceName: null,
              sourceBundleId: null,
            },
          ],
          issues: [{ kind: 'overlap' }],
        },
      })
    );
    await expect(loadLucidHealthKitSnapshot('user-c', storage)).resolves.toMatchObject({ status: 'empty' });
    expect(memory.has(key)).toBe(false);

    const invalidKey = getLucidHealthKitStorageKey('user-d');
    await expect(
      saveLucidHealthKitSnapshot(
        'user-d',
        {
          version: 1,
          status: 'imported',
          importedAt: start,
          rangeStartMs: start,
          rangeEndMs: start + 1,
          normalization: null,
          emptyReason: null,
        },
        storage
      )
    ).rejects.toThrow('Invalid Lucid HealthKit snapshot');
    expect(memory.has(invalidKey)).toBe(false);

    await expect(
      saveLucidHealthKitSnapshot(
        'user-d',
        {
          version: 1,
          status: 'empty',
          importedAt: start,
          rangeStartMs: null,
          rangeEndMs: null,
          normalization: null,
          emptyReason: null,
        },
        storage
      )
    ).rejects.toThrow('Invalid Lucid HealthKit snapshot');
    await expect(disableLucidHealthKitSnapshot('user-d', storage)).rejects.toThrow(
      'Invalid Lucid HealthKit snapshot'
    );
    expect(memory.has(invalidKey)).toBe(false);
  });
});

describe('Lucid HealthKit native storage encryption contract', () => {
  it('protects writes and reveals reads when using the default sqlite identity', async () => {
    jest.resetModules();
    const nativeValues = new Map<string, string>();
    const sqlite = {
      getItem: jest.fn(async (key: string) => nativeValues.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        nativeValues.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        nativeValues.delete(key);
      }),
    };
    const prefix = 'test-aesgcm-v1:';
    const encode = (value: string) => Buffer.from(value, 'utf8').toString('base64');
    const decode = (value: string) => Buffer.from(value, 'base64').toString('utf8');
    const protectLucidTrainerStoredValue = jest.fn(async (key: string, plaintext: string) => {
      return `${prefix}${encode(JSON.stringify({ key, plaintext }))}`;
    });
    const revealLucidTrainerStoredValue = jest.fn(async (key: string, storedValue: string) => {
      const payload = JSON.parse(decode(storedValue.slice(prefix.length)));
      if (payload.key !== key) throw new Error('aad mismatch');
      return payload.plaintext as string;
    });
    jest.doMock('expo-sqlite/kv-store', () => ({ __esModule: true, default: sqlite }));
    jest.doMock('@/services/lucidTrainerSecureStorage', () => ({
      isLucidTrainerEncryptedValueError: (value: unknown) =>
        (value as { code?: string } | null)?.code === 'invalid_encrypted_value',
      protectLucidTrainerStoredValue,
      revealLucidTrainerStoredValue,
    }));

    const { importLucidHealthKitSnapshot, loadLucidHealthKitSnapshot, getLucidHealthKitStorageKey } =
      require('@/services/lucidHealthKitStorage');
    const { normalizeLucidHkSleepSamples } = require('@/lib/lucid/healthKitSleep');
    const normalization = normalizeLucidHkSleepSamples([
      { uuid: 'watch', startDate: start, endDate: start + 60 * 60 * 1000, value: 3 },
    ]);
    await importLucidHealthKitSnapshot('native-user', {
      importedAt: start,
      rangeStartMs: start,
      rangeEndMs: start + 8 * 60 * 60 * 1000,
      normalization,
    });
    const stored = nativeValues.get(getLucidHealthKitStorageKey('native-user')) ?? '';
    expect(protectLucidTrainerStoredValue).toHaveBeenCalled();
    expect(stored.startsWith(prefix)).toBe(true);
    await expect(loadLucidHealthKitSnapshot('native-user')).resolves.toMatchObject({
      status: 'imported',
    });
    expect(revealLucidTrainerStoredValue).toHaveBeenCalled();
  });
});
