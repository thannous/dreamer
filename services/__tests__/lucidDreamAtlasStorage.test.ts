import {
  LUCID_DREAM_ATLAS_VERSION,
  createEmptyLucidDreamAtlasPreferences,
  type LucidDreamAtlasPreferences,
} from '@/lib/lucid/dreamAtlas';
import {
  LUCID_DREAM_ATLAS_STORE_VERSION,
  LucidDreamAtlasStorageError,
  clearLucidDreamAtlasPreferences,
  companionHasLucidDreamAtlasData,
  countLucidDreamAtlasScopeLocksForTests,
  exportLucidDreamAtlasPreferences,
  getLucidDreamAtlasStorageKey,
  importLucidDreamAtlasPreferences,
  inspectLucidDreamAtlasCompanion,
  loadLucidDreamAtlasPreferences,
  overlayFromLucidDreamAtlasCompanion,
  saveLucidDreamAtlasPreferences,
  updateLucidDreamAtlasPreferences,
} from '@/services/lucidDreamAtlasStorage';

function memoryKv() {
  const memory = new Map<string, string>();
  return {
    memory,
    storage: {
      getItem: jest.fn(async (key: string) => memory.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        memory.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        memory.delete(key);
      }),
    },
  };
}

function prefs(overrides: Partial<LucidDreamAtlasPreferences> = {}): LucidDreamAtlasPreferences {
  return {
    ...createEmptyLucidDreamAtlasPreferences(),
    ...overrides,
  };
}

describe('Lucid dream atlas local preference storage', () => {
  it('round-trips a normalized copy and isolates keys by scope', async () => {
    const { memory, storage } = memoryKv();
    const input = prefs({
      renamed: { 'sign:marie': 'Marie au miroir' },
      hidden: ['sign:miroir'],
    });
    const saved = await saveLucidDreamAtlasPreferences('guest', input, storage);
    expect(saved).toEqual(input);
    expect(saved).not.toBe(input);
    saved.hidden.push('mutated');
    input.renamed['sign:ghost'] = 'nope';
    await expect(loadLucidDreamAtlasPreferences('guest', storage)).resolves.toEqual(prefs({
      renamed: { 'sign:marie': 'Marie au miroir' },
      hidden: ['sign:miroir'],
    }));
    expect(getLucidDreamAtlasStorageKey('guest')).toBe('noctalia_lucid_dream_atlas:guest:prefs_v1');
    expect(getLucidDreamAtlasStorageKey('user:abc')).toBe('noctalia_lucid_dream_atlas:user%3Aabc:prefs_v1');
    expect(getLucidDreamAtlasStorageKey('guest')).not.toContain('noctalia_lucid_trainer');
    await saveLucidDreamAtlasPreferences('user:abc', prefs({ deleted: ['sign:marie'] }), storage);
    await expect(loadLucidDreamAtlasPreferences('guest', storage)).resolves.toMatchObject({
      renamed: { 'sign:marie': 'Marie au miroir' },
    });
    await expect(loadLucidDreamAtlasPreferences('user:abc', storage)).resolves.toEqual(
      prefs({ deleted: ['sign:marie'] })
    );
    expect(memory.size).toBe(2);
  });

  it('distinguishes an absent companion from a valid empty or populated envelope', async () => {
    const { memory, storage } = memoryKv();
    await expect(inspectLucidDreamAtlasCompanion('guest', storage)).resolves.toEqual({ status: 'absent' });
    expect(companionHasLucidDreamAtlasData(prefs())).toBe(false);

    await saveLucidDreamAtlasPreferences('guest', prefs(), storage);
    await expect(inspectLucidDreamAtlasCompanion('guest', storage)).resolves.toEqual({
      status: 'present',
      preferences: prefs(),
    });
    expect(companionHasLucidDreamAtlasData(prefs())).toBe(false);

    const populated = prefs({ hidden: ['sign:marie'] });
    await saveLucidDreamAtlasPreferences('guest', populated, storage);
    const snapshot = await inspectLucidDreamAtlasCompanion('guest', storage);
    expect(snapshot).toEqual({ status: 'present', preferences: populated });
    expect(companionHasLucidDreamAtlasData(populated)).toBe(true);
    expect(overlayFromLucidDreamAtlasCompanion(populated, 1_700_000_000_000)).toEqual({
      ...populated,
      updatedAt: 1_700_000_000_000,
    });
    expect(memory.has(getLucidDreamAtlasStorageKey('guest'))).toBe(true);
  });

  it('quarantines corrupt JSON, wrong envelope keys, versions and scopes', async () => {
    const { memory, storage } = memoryKv();
    const key = getLucidDreamAtlasStorageKey('guest');

    memory.set(key, '{not-json');
    await expect(loadLucidDreamAtlasPreferences('guest', storage)).resolves.toEqual(
      createEmptyLucidDreamAtlasPreferences()
    );
    expect(memory.has(key)).toBe(false);

    memory.set(key, JSON.stringify({ version: LUCID_DREAM_ATLAS_STORE_VERSION, userScope: 'guest' }));
    await expect(loadLucidDreamAtlasPreferences('guest', storage)).resolves.toEqual(
      createEmptyLucidDreamAtlasPreferences()
    );
    expect(memory.has(key)).toBe(false);

    memory.set(
      key,
      JSON.stringify({
        version: 99,
        userScope: 'guest',
        preferences: prefs({ hidden: ['sign:marie'] }),
      })
    );
    await expect(loadLucidDreamAtlasPreferences('guest', storage)).resolves.toEqual(
      createEmptyLucidDreamAtlasPreferences()
    );
    expect(memory.has(key)).toBe(false);

    memory.set(
      key,
      JSON.stringify({
        version: LUCID_DREAM_ATLAS_STORE_VERSION,
        userScope: 'user:other',
        preferences: prefs({ hidden: ['sign:marie'] }),
      })
    );
    await expect(loadLucidDreamAtlasPreferences('guest', storage)).resolves.toEqual(
      createEmptyLucidDreamAtlasPreferences()
    );
    expect(memory.has(key)).toBe(false);
  });

  it('normalizes corrupt persisted preferences before exposing them', async () => {
    const { memory, storage } = memoryKv();
    const key = getLucidDreamAtlasStorageKey('guest');
    memory.set(
      key,
      JSON.stringify({
        version: LUCID_DREAM_ATLAS_STORE_VERSION,
        userScope: 'guest',
        preferences: {
          version: LUCID_DREAM_ATLAS_VERSION,
          renamed: { 'sign:marie': '   ', extra: 1 },
          hidden: ['sign:marie', null],
          merges: { 'sign:marie': 'sign:marie' },
          deleted: [12],
        },
      })
    );
    await expect(loadLucidDreamAtlasPreferences('guest', storage)).resolves.toEqual(
      createEmptyLucidDreamAtlasPreferences()
    );
  });

  it('classifies write, read and remove failures', async () => {
    const { storage } = memoryKv();
    storage.setItem.mockRejectedValueOnce(new Error('ENOSPC disk full'));
    await expect(saveLucidDreamAtlasPreferences('guest', prefs(), storage)).rejects.toMatchObject({
      reason: 'storage_full',
    });

    storage.getItem.mockRejectedValueOnce(new Error('sqlite busy'));
    await expect(loadLucidDreamAtlasPreferences('guest', storage)).rejects.toMatchObject({
      reason: 'persistence_failed',
    });

    storage.removeItem.mockRejectedValueOnce(new Error('cannot unlink'));
    await expect(clearLucidDreamAtlasPreferences('guest', storage)).rejects.toMatchObject({
      reason: 'persistence_failed',
    });
    expect(() => getLucidDreamAtlasStorageKey('  guest')).toThrow(LucidDreamAtlasStorageError);
    expect(() => getLucidDreamAtlasStorageKey('anon')).toThrow(LucidDreamAtlasStorageError);
    expect(() => getLucidDreamAtlasStorageKey('user:')).toThrow(LucidDreamAtlasStorageError);
    await expect(loadLucidDreamAtlasPreferences('user:', storage)).rejects.toMatchObject({
      reason: 'invalid_scope',
    });
  });

  it('serializes same-scope updates without lost writes and keeps other scopes independent', async () => {
    const { storage } = memoryKv();
    await saveLucidDreamAtlasPreferences('guest', prefs(), storage);
    await saveLucidDreamAtlasPreferences('user:abc', prefs(), storage);

    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = updateLucidDreamAtlasPreferences(
      'guest',
      async (current) => {
        await firstGate;
        return { ...current, hidden: [...current.hidden, 'sign:marie'] };
      },
      storage
    );
    const second = updateLucidDreamAtlasPreferences(
      'guest',
      (current) => ({ ...current, deleted: [...current.deleted, 'sign:miroir'] }),
      storage
    );
    const other = updateLucidDreamAtlasPreferences(
      'user:abc',
      (current) => ({ ...current, renamed: { 'sign:marie': 'Other' } }),
      storage
    );
    await expect(other).resolves.toMatchObject({ renamed: { 'sign:marie': 'Other' } });
    releaseFirst();
    await first;
    await second;
    await expect(loadLucidDreamAtlasPreferences('guest', storage)).resolves.toEqual(
      prefs({ hidden: ['sign:marie'], deleted: ['sign:miroir'] })
    );
    await expect(loadLucidDreamAtlasPreferences('user:abc', storage)).resolves.toMatchObject({
      renamed: { 'sign:marie': 'Other' },
    });
  });

  it('releases the scope lock when an updater fails', async () => {
    const { storage } = memoryKv();
    await saveLucidDreamAtlasPreferences('guest', prefs({ hidden: ['sign:marie'] }), storage);
    await expect(
      updateLucidDreamAtlasPreferences(
        'guest',
        () => {
          throw new Error('boom');
        },
        storage
      )
    ).rejects.toThrow('boom');
    expect(countLucidDreamAtlasScopeLocksForTests()).toBe(0);
    await expect(
      updateLucidDreamAtlasPreferences(
        'guest',
        (current) => ({ ...current, deleted: ['sign:miroir'] }),
        storage
      )
    ).resolves.toEqual(prefs({ hidden: ['sign:marie'], deleted: ['sign:miroir'] }));
  });

  it('clears idempotently and exports or imports preferences only', async () => {
    const { memory, storage } = memoryKv();
    await saveLucidDreamAtlasPreferences('guest', prefs({ hidden: ['sign:marie'] }), storage);
    const exported = await exportLucidDreamAtlasPreferences('guest', storage);
    expect(exported).toEqual({
      version: LUCID_DREAM_ATLAS_VERSION,
      preferences: prefs({ hidden: ['sign:marie'] }),
    });
    expect(JSON.stringify(exported)).not.toMatch(/nodes|transcript|title|dreams/i);
    expect(Object.keys(exported)).toEqual(['version', 'preferences']);

    await clearLucidDreamAtlasPreferences('guest', storage);
    expect(memory.size).toBe(0);
    await clearLucidDreamAtlasPreferences('guest', storage);
    await expect(loadLucidDreamAtlasPreferences('guest', storage)).resolves.toEqual(
      createEmptyLucidDreamAtlasPreferences()
    );

    const imported = await importLucidDreamAtlasPreferences('guest', exported, storage);
    expect(imported).toEqual(prefs({ hidden: ['sign:marie'] }));
  });

  it('rejects malformed import payloads without overwriting healthy state', async () => {
    const { storage } = memoryKv();
    const healthy = await saveLucidDreamAtlasPreferences(
      'guest',
      prefs({ hidden: ['sign:marie'] }),
      storage
    );
    await expect(importLucidDreamAtlasPreferences('guest', { extra: true }, storage)).rejects.toMatchObject({
      reason: 'invalid_metadata',
    });
    await expect(
      importLucidDreamAtlasPreferences('guest', { version: 99, preferences: healthy }, storage)
    ).rejects.toMatchObject({ reason: 'invalid_metadata' });
    await expect(loadLucidDreamAtlasPreferences('guest', storage)).resolves.toEqual(healthy);
    await expect(
      importLucidDreamAtlasPreferences('guest', { version: 1, preferences: 'bad' }, storage)
    ).rejects.toMatchObject({ reason: 'invalid_metadata' });
    await expect(
      importLucidDreamAtlasPreferences(
        'guest',
        {
          version: 1,
          preferences: {
            version: 1,
            renamed: { 'sign:marie': 12 },
            hidden: ['sign:marie'],
            merges: {},
            deleted: [],
          },
        },
        storage
      )
    ).rejects.toMatchObject({ reason: 'invalid_metadata' });
    await expect(loadLucidDreamAtlasPreferences('guest', storage)).resolves.toEqual(healthy);
  });

  it('rejects semantically invalid imported node ids without overwriting healthy state', async () => {
    const { storage } = memoryKv();
    const healthy = await saveLucidDreamAtlasPreferences(
      'guest',
      prefs({ hidden: ['sign:marie'] }),
      storage
    );
    await expect(
      importLucidDreamAtlasPreferences(
        'guest',
        {
          version: 1,
          preferences: {
            version: 1,
            renamed: {},
            hidden: ['__proto__'],
            merges: {},
            deleted: [],
          },
        },
        storage
      )
    ).rejects.toMatchObject({ reason: 'invalid_metadata' });
    await expect(
      importLucidDreamAtlasPreferences(
        'guest',
        {
          version: 1,
          preferences: {
            version: 1,
            renamed: { constructor: 'x' },
            hidden: [],
            merges: {},
            deleted: [],
          },
        },
        storage
      )
    ).rejects.toMatchObject({ reason: 'invalid_metadata' });
    await expect(loadLucidDreamAtlasPreferences('guest', storage)).resolves.toEqual(healthy);
  });

  it('quarantines persisted invalid node ids', async () => {
    const { memory, storage } = memoryKv();
    const key = getLucidDreamAtlasStorageKey('guest');
    memory.set(
      key,
      JSON.stringify({
        version: LUCID_DREAM_ATLAS_STORE_VERSION,
        userScope: 'guest',
        preferences: {
          version: 1,
          renamed: {},
          hidden: ['__proto__'],
          merges: {},
          deleted: [],
        },
      })
    );
    await expect(loadLucidDreamAtlasPreferences('guest', storage)).resolves.toEqual(
      createEmptyLucidDreamAtlasPreferences()
    );
    expect(memory.has(key)).toBe(false);
  });

  it('quarantines persisted nested preference version 99', async () => {
    const { memory, storage } = memoryKv();
    const key = getLucidDreamAtlasStorageKey('guest');
    memory.set(
      key,
      JSON.stringify({
        version: LUCID_DREAM_ATLAS_STORE_VERSION,
        userScope: 'guest',
        preferences: {
          version: 99,
          renamed: { 'sign:marie': 'Marie' },
          hidden: [],
          merges: {},
          deleted: [],
        },
      })
    );
    await expect(loadLucidDreamAtlasPreferences('guest', storage)).resolves.toEqual(
      createEmptyLucidDreamAtlasPreferences()
    );
    expect(memory.has(key)).toBe(false);
    expect(storage.removeItem).toHaveBeenCalledWith(key);
  });

  it('gives the updater a copy so a mutation plus throw does not persist', async () => {
    const { storage } = memoryKv();
    const healthy = await saveLucidDreamAtlasPreferences(
      'guest',
      prefs({ hidden: ['sign:marie'] }),
      storage
    );
    await expect(
      updateLucidDreamAtlasPreferences(
        'guest',
        (current) => {
          current.hidden.push('sign:ghost');
          throw new Error('mutated-copy');
        },
        storage
      )
    ).rejects.toThrow('mutated-copy');
    await expect(loadLucidDreamAtlasPreferences('guest', storage)).resolves.toEqual(healthy);
  });
});

describe('Lucid dream atlas native storage encryption contract', () => {
  it('protects writes and reveals reads on the default sqlite identity, while injected memory stays plaintext', async () => {
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
    const encryptedError = Object.assign(new Error('Invalid encrypted Lucid Trainer value'), {
      code: 'invalid_encrypted_value',
    });
    jest.doMock('expo-sqlite/kv-store', () => ({ __esModule: true, default: sqlite }));
    jest.doMock('@/services/lucidTrainerSecureStorage', () => ({
      isLucidTrainerEncryptedValueError: (value: unknown) =>
        (value as { code?: string } | null)?.code === 'invalid_encrypted_value',
      isLucidTrainerStorageCapacityError: () => false,
      protectLucidTrainerStoredValue,
      revealLucidTrainerStoredValue,
    }));

    const {
      getLucidDreamAtlasStorageKey,
      loadLucidDreamAtlasPreferences,
      saveLucidDreamAtlasPreferences,
    } = require('@/services/lucidDreamAtlasStorage') as typeof import('@/services/lucidDreamAtlasStorage');

    await saveLucidDreamAtlasPreferences('guest', {
      version: 1,
      renamed: { 'sign:marie': 'Marie' },
      hidden: [],
      merges: {},
      deleted: [],
    });
    const stored = nativeValues.get(getLucidDreamAtlasStorageKey('guest')) ?? '';
    expect(protectLucidTrainerStoredValue).toHaveBeenCalled();
    expect(stored.startsWith(prefix)).toBe(true);
    expect(stored).not.toContain('Marie');
    await expect(loadLucidDreamAtlasPreferences('guest')).resolves.toMatchObject({
      renamed: { 'sign:marie': 'Marie' },
    });
    expect(revealLucidTrainerStoredValue).toHaveBeenCalled();

    nativeValues.set(getLucidDreamAtlasStorageKey('guest'), 'not-encrypted');
    revealLucidTrainerStoredValue.mockRejectedValueOnce(encryptedError);
    await expect(loadLucidDreamAtlasPreferences('guest')).resolves.toEqual({
      version: 1,
      renamed: {},
      hidden: [],
      merges: {},
      deleted: [],
    });
    expect(nativeValues.has(getLucidDreamAtlasStorageKey('guest'))).toBe(false);

    const { memory, storage } = memoryKv();
    await saveLucidDreamAtlasPreferences(
      'guest',
      {
        version: 1,
        renamed: { 'sign:marie': 'Plain' },
        hidden: [],
        merges: {},
        deleted: [],
      },
      storage
    );
    const plaintext = memory.get(getLucidDreamAtlasStorageKey('guest')) ?? '';
    expect(plaintext.startsWith(prefix)).toBe(false);
    expect(plaintext).toContain('Plain');
  });
});
