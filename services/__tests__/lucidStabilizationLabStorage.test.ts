import {
  createLucidStabilizationLabSession,
  startLucidStabilizationLabSession,
  type LucidStabilizationLabSession,
} from '@/lib/lucid/stabilizationLab';
import {
  LUCID_STABILIZATION_LAB_MAX_STORED_SESSIONS,
  LUCID_STABILIZATION_LAB_STORE_VERSION,
  LucidStabilizationLabStorageError,
  clearLucidStabilizationLabSessions,
  countLucidStabilizationLabScopeLocksForTests,
  exportLucidStabilizationLabSessions,
  getLucidStabilizationLabStorageKey,
  importLucidStabilizationLabSessions,
  loadLucidStabilizationLabSessions,
  updateLucidStabilizationLabSessions,
  upsertLucidStabilizationLabSession,
} from '@/services/lucidStabilizationLabStorage';

const NOW = 1_700_000_000_000;

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

function session(
  sessionId: string,
  overrides: Partial<LucidStabilizationLabSession> = {}
): LucidStabilizationLabSession {
  const created = createLucidStabilizationLabSession({ now: NOW, sessionId });
  return { ...created, ...overrides, sessionId };
}

function started(sessionId: string, now = NOW + 1): LucidStabilizationLabSession {
  return startLucidStabilizationLabSession(session(sessionId), now);
}

describe('Lucid stabilization lab session storage', () => {
  it('round-trips cloned sessions and isolates keys by scope', async () => {
    const { memory, storage } = memoryKv();
    const input = started('stab_one');
    const saved = await upsertLucidStabilizationLabSession('guest', input, storage);
    expect(saved).toEqual([input]);
    expect(saved[0]).not.toBe(input);
    const mutated = saved.map((item) => ({ ...item, sessionId: 'mutated' }));
    expect(mutated[0].sessionId).toBe('mutated');

    await expect(loadLucidStabilizationLabSessions('guest', storage)).resolves.toEqual([input]);
    expect(getLucidStabilizationLabStorageKey('guest')).toBe(
      'noctalia_lucid_stabilization_lab:guest:sessions_v1'
    );
    expect(getLucidStabilizationLabStorageKey('user:abc')).toBe(
      'noctalia_lucid_stabilization_lab:user%3Aabc:sessions_v1'
    );
    expect(getLucidStabilizationLabStorageKey('guest')).not.toContain('noctalia_lucid_trainer');
    expect(getLucidStabilizationLabStorageKey('guest')).not.toContain('dream_atlas');

    await upsertLucidStabilizationLabSession('user:abc', started('stab_user'), storage);
    await expect(loadLucidStabilizationLabSessions('guest', storage)).resolves.toEqual([input]);
    await expect(loadLucidStabilizationLabSessions('user:abc', storage)).resolves.toEqual([
      started('stab_user'),
    ]);
    expect(memory.size).toBe(2);
  });

  it('keeps unique session ids, newest-first order and a 500-session cap', async () => {
    const { storage } = memoryKv();
    const older = started('stab_same', NOW + 1);
    const newer = { ...older, updatedAt: NOW + 5, stepStartedAt: NOW + 5 };
    await upsertLucidStabilizationLabSession('guest', older, storage);
    await upsertLucidStabilizationLabSession('guest', newer, storage);
    await upsertLucidStabilizationLabSession('guest', started('stab_two', NOW + 3), storage);

    const loaded = await loadLucidStabilizationLabSessions('guest', storage);
    expect(loaded.map((item) => item.sessionId)).toEqual(['stab_same', 'stab_two']);
    expect(loaded[0].updatedAt).toBe(NOW + 5);

    const stale = { ...newer, updatedAt: NOW + 2, stepStartedAt: NOW + 2 };
    await upsertLucidStabilizationLabSession('guest', stale, storage);
    await expect(loadLucidStabilizationLabSessions('guest', storage)).resolves.toEqual(loaded);

    const overflow = Array.from({ length: LUCID_STABILIZATION_LAB_MAX_STORED_SESSIONS + 1 }, (_, index) =>
      session(`stab_${String(index).padStart(3, '0')}`, { updatedAt: NOW + index })
    );
    await expect(
      updateLucidStabilizationLabSessions('guest', () => overflow, storage)
    ).rejects.toMatchObject({ reason: 'invalid_metadata' });
    await expect(loadLucidStabilizationLabSessions('guest', storage)).resolves.toEqual(loaded);
  });

  it('evicts only the oldest session when upserting into a full store', async () => {
    const { storage } = memoryKv();
    const filled = Array.from({ length: LUCID_STABILIZATION_LAB_MAX_STORED_SESSIONS }, (_, index) =>
      session(`stab_${String(index).padStart(3, '0')}`, { updatedAt: NOW + index })
    );
    await updateLucidStabilizationLabSessions('guest', () => filled, storage);
    const before = await loadLucidStabilizationLabSessions('guest', storage);
    expect(before).toHaveLength(LUCID_STABILIZATION_LAB_MAX_STORED_SESSIONS);
    const oldest = before[before.length - 1];
    const newestExisting = before[0];

    const incoming = session('stab_new', { updatedAt: NOW + LUCID_STABILIZATION_LAB_MAX_STORED_SESSIONS + 10 });
    const afterInsert = await upsertLucidStabilizationLabSession('guest', incoming, storage);
    expect(afterInsert).toHaveLength(LUCID_STABILIZATION_LAB_MAX_STORED_SESSIONS);
    expect(afterInsert[0]).toEqual(incoming);
    expect(afterInsert.map((item) => item.sessionId)).toContain(newestExisting.sessionId);
    expect(afterInsert.map((item) => item.sessionId)).not.toContain(oldest.sessionId);
    expect(afterInsert.filter((item) => item.sessionId === incoming.sessionId)).toHaveLength(1);

    const stale = session('stab_too_old', { updatedAt: oldest.updatedAt - 1 });
    const afterStale = await upsertLucidStabilizationLabSession('guest', stale, storage);
    expect(afterStale).toEqual(afterInsert);
    expect(afterStale.map((item) => item.sessionId)).not.toContain('stab_too_old');
  });

  it('serializes same-scope updates and keeps other scopes independent', async () => {
    const { storage } = memoryKv();
    await upsertLucidStabilizationLabSession('guest', started('stab_one'), storage);
    await upsertLucidStabilizationLabSession('user:abc', started('stab_user'), storage);

    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = updateLucidStabilizationLabSessions(
      'guest',
      async (current) => {
        await firstGate;
        return [...current, started('stab_two', NOW + 4)];
      },
      storage
    );
    const second = updateLucidStabilizationLabSessions(
      'guest',
      (current) => [...current, started('stab_three', NOW + 5)],
      storage
    );
    const other = updateLucidStabilizationLabSessions(
      'user:abc',
      (current) => [...current, started('stab_other', NOW + 6)],
      storage
    );
    await expect(other).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ sessionId: 'stab_other' })])
    );
    releaseFirst();
    await first;
    await second;
    await expect(loadLucidStabilizationLabSessions('guest', storage)).resolves.toEqual([
      started('stab_three', NOW + 5),
      started('stab_two', NOW + 4),
      started('stab_one'),
    ]);
    await expect(loadLucidStabilizationLabSessions('user:abc', storage)).resolves.toEqual([
      started('stab_other', NOW + 6),
      started('stab_user'),
    ]);
  });

  it('releases the lock after a failed update and recovers the previous sessions', async () => {
    const { storage } = memoryKv();
    const healthy = await upsertLucidStabilizationLabSession('guest', started('stab_one'), storage);
    await expect(
      updateLucidStabilizationLabSessions(
        'guest',
        () => {
          throw new Error('boom');
        },
        storage
      )
    ).rejects.toThrow('boom');
    expect(countLucidStabilizationLabScopeLocksForTests()).toBe(0);
    await expect(loadLucidStabilizationLabSessions('guest', storage)).resolves.toEqual(healthy);
    await expect(
      updateLucidStabilizationLabSessions(
        'guest',
        (current) => [...current, started('stab_two', NOW + 4)],
        storage
      )
    ).resolves.toEqual([started('stab_two', NOW + 4), started('stab_one')]);
  });

  it('quarantines corrupt envelopes, wrong versions and other scopes without mixing guest data', async () => {
    const { memory, storage } = memoryKv();
    const guestKey = getLucidStabilizationLabStorageKey('guest');
    const userKey = getLucidStabilizationLabStorageKey('user:abc');
    await upsertLucidStabilizationLabSession('user:abc', started('stab_user'), storage);

    memory.set(guestKey, '{not-json');
    await expect(loadLucidStabilizationLabSessions('guest', storage)).resolves.toEqual([]);
    expect(memory.has(guestKey)).toBe(false);

    memory.set(
      guestKey,
      JSON.stringify({ version: LUCID_STABILIZATION_LAB_STORE_VERSION, userScope: 'guest' })
    );
    await expect(loadLucidStabilizationLabSessions('guest', storage)).resolves.toEqual([]);
    expect(memory.has(guestKey)).toBe(false);

    memory.set(
      guestKey,
      JSON.stringify({
        version: 99,
        userScope: 'guest',
        sessions: [started('stab_one')],
      })
    );
    await expect(loadLucidStabilizationLabSessions('guest', storage)).resolves.toEqual([]);
    expect(memory.has(guestKey)).toBe(false);

    memory.set(
      guestKey,
      JSON.stringify({
        version: LUCID_STABILIZATION_LAB_STORE_VERSION,
        userScope: 'user:other',
        sessions: [started('stab_one')],
      })
    );
    await expect(loadLucidStabilizationLabSessions('guest', storage)).resolves.toEqual([]);
    expect(memory.has(guestKey)).toBe(false);
    await expect(loadLucidStabilizationLabSessions('user:abc', storage)).resolves.toEqual([
      started('stab_user'),
    ]);
    expect(memory.has(userKey)).toBe(true);
  });

  it('classifies write, read, remove and scope failures', async () => {
    const { storage } = memoryKv();
    storage.setItem.mockRejectedValueOnce(new Error('ENOSPC disk full'));
    await expect(upsertLucidStabilizationLabSession('guest', started('stab_one'), storage)).rejects.toMatchObject({
      reason: 'storage_full',
    });

    storage.getItem.mockRejectedValueOnce(new Error('sqlite busy'));
    await expect(loadLucidStabilizationLabSessions('guest', storage)).rejects.toMatchObject({
      reason: 'persistence_failed',
    });

    storage.removeItem.mockRejectedValueOnce(new Error('cannot unlink'));
    await expect(clearLucidStabilizationLabSessions('guest', storage)).rejects.toMatchObject({
      reason: 'persistence_failed',
    });
    expect(() => getLucidStabilizationLabStorageKey('  guest')).toThrow(LucidStabilizationLabStorageError);
    expect(() => getLucidStabilizationLabStorageKey('anon')).toThrow(LucidStabilizationLabStorageError);
    expect(() => getLucidStabilizationLabStorageKey('user:')).toThrow(LucidStabilizationLabStorageError);
    await expect(loadLucidStabilizationLabSessions('user:', storage)).rejects.toMatchObject({
      reason: 'invalid_scope',
    });
  });

  it('exports, clears and imports only the current scope, rejecting hostile payloads without destroying healthy state', async () => {
    const { memory, storage } = memoryKv();
    const healthy = await upsertLucidStabilizationLabSession('guest', started('stab_one'), storage);
    const exported = await exportLucidStabilizationLabSessions('guest', storage);
    expect(exported).toEqual({
      version: LUCID_STABILIZATION_LAB_STORE_VERSION,
      userScope: 'guest',
      sessions: healthy,
    });
    expect(Object.keys(exported)).toEqual(['version', 'userScope', 'sessions']);
    expect(JSON.stringify(exported)).not.toMatch(/dream|premium|result/i);

    await clearLucidStabilizationLabSessions('guest', storage);
    expect(memory.size).toBe(0);
    await clearLucidStabilizationLabSessions('guest', storage);
    await expect(loadLucidStabilizationLabSessions('guest', storage)).resolves.toEqual([]);

    await upsertLucidStabilizationLabSession('guest', started('stab_keep', NOW + 8), storage);
    const current = await loadLucidStabilizationLabSessions('guest', storage);
    await expect(importLucidStabilizationLabSessions('guest', { extra: true }, storage)).rejects.toMatchObject({
      reason: 'invalid_metadata',
    });
    await expect(
      importLucidStabilizationLabSessions(
        'guest',
        { version: 99, userScope: 'guest', sessions: healthy },
        storage
      )
    ).rejects.toMatchObject({ reason: 'invalid_metadata' });
    await expect(
      importLucidStabilizationLabSessions(
        'guest',
        { version: 1, userScope: 'user:abc', sessions: healthy },
        storage
      )
    ).rejects.toMatchObject({ reason: 'invalid_metadata' });
    await expect(
      importLucidStabilizationLabSessions(
        'guest',
        { version: 1, userScope: 'guest', sessions: [{ ...healthy[0], sessionId: '__proto__' }] },
        storage
      )
    ).rejects.toMatchObject({ reason: 'invalid_metadata' });
    const polluted = JSON.parse('{"version":1,"userScope":"guest","sessions":[],"__proto__":{"admin":true}}');
    await expect(importLucidStabilizationLabSessions('guest', polluted, storage)).rejects.toMatchObject({
      reason: 'invalid_metadata',
    });
    class ExoticEnvelope {
      version = 1;
      userScope = 'guest';
      sessions: LucidStabilizationLabSession[] = [];
    }
    await expect(
      importLucidStabilizationLabSessions('guest', new ExoticEnvelope(), storage)
    ).rejects.toMatchObject({ reason: 'invalid_metadata' });
    expect(Object.prototype).not.toHaveProperty('admin');
    await expect(loadLucidStabilizationLabSessions('guest', storage)).resolves.toEqual(current);

    const imported = await importLucidStabilizationLabSessions('guest', exported, storage);
    expect(imported).toEqual(healthy);
  });
});

describe('Lucid stabilization lab native storage encryption contract', () => {
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
      getLucidStabilizationLabStorageKey,
      loadLucidStabilizationLabSessions,
      upsertLucidStabilizationLabSession,
    } = require('@/services/lucidStabilizationLabStorage') as typeof import('@/services/lucidStabilizationLabStorage');
    const { startLucidStabilizationLabSession, createLucidStabilizationLabSession } =
      require('@/lib/lucid/stabilizationLab') as typeof import('@/lib/lucid/stabilizationLab');

    const nativeSession = startLucidStabilizationLabSession(
      createLucidStabilizationLabSession({ now: NOW, sessionId: 'stab_native' }),
      NOW + 1
    );
    await upsertLucidStabilizationLabSession('guest', nativeSession);
    const stored = nativeValues.get(getLucidStabilizationLabStorageKey('guest')) ?? '';
    expect(protectLucidTrainerStoredValue).toHaveBeenCalled();
    expect(stored.startsWith(prefix)).toBe(true);
    expect(stored).not.toContain('stab_native');
    await expect(loadLucidStabilizationLabSessions('guest')).resolves.toEqual([nativeSession]);
    expect(revealLucidTrainerStoredValue).toHaveBeenCalled();

    nativeValues.set(getLucidStabilizationLabStorageKey('guest'), 'not-encrypted');
    revealLucidTrainerStoredValue.mockRejectedValueOnce(encryptedError);
    await expect(loadLucidStabilizationLabSessions('guest')).resolves.toEqual([]);
    expect(nativeValues.has(getLucidStabilizationLabStorageKey('guest'))).toBe(false);

    const { memory, storage } = memoryKv();
    await upsertLucidStabilizationLabSession('guest', nativeSession, storage);
    const plaintext = memory.get(getLucidStabilizationLabStorageKey('guest')) ?? '';
    expect(plaintext.startsWith(prefix)).toBe(false);
    expect(plaintext).toContain('stab_native');
  });
});
