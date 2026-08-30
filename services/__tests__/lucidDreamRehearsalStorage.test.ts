import {
  completeLucidDreamRehearsalSession,
  confirmLucidDreamRehearsalIntention,
  createLucidDreamRehearsalSession,
  projectLucidDreamRehearsalCompletion,
  recognizeLucidDreamRehearsalSign,
  selectLucidDreamRehearsalScene,
  type LucidDreamRehearsalCompletion,
  type LucidDreamRehearsalSession,
} from '@/lib/lucid/dreamRehearsal';
import {
  LUCID_DREAM_REHEARSAL_MAX_STORED_COMPLETIONS,
  LUCID_DREAM_REHEARSAL_STORE_VERSION,
  LucidDreamRehearsalStorageError,
  clearLucidDreamRehearsalCurrentSession,
  clearLucidDreamRehearsalState,
  countLucidDreamRehearsalScopeLocksForTests,
  exportLucidDreamRehearsalState,
  getLucidDreamRehearsalStorageKey,
  importLucidDreamRehearsalState,
  loadLucidDreamRehearsalCompletions,
  loadLucidDreamRehearsalCurrentSession,
  loadLucidDreamRehearsalState,
  saveLucidDreamRehearsalCurrentSession,
  updateLucidDreamRehearsalState,
  upsertLucidDreamRehearsalCompletion,
} from '@/services/lucidDreamRehearsalStorage';

const NOW = 1_700_000_000_000;
const DREAM_ID = '1700000000000';
const SIGN_ID = 'sign:mirror';

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

function scene() {
  const result = selectLucidDreamRehearsalScene(
    [{ id: Number(DREAM_ID), title: 'Hallway', transcript: 'I saw a hallway mirror.' }],
    [
      {
        id: SIGN_ID,
        label: 'Hallway mirror',
        category: 'object',
        distinctDreamCount: 2,
        sourceDreamIds: [DREAM_ID],
      },
    ],
    DREAM_ID,
    SIGN_ID
  );
  if (result.status !== 'ready') throw new Error('Expected a ready scene');
  return result.scene;
}

function session(
  sessionId: string,
  now = NOW,
  presentation: 'motion' | 'static' = 'motion'
): LucidDreamRehearsalSession {
  return createLucidDreamRehearsalSession({
    scene: scene(),
    sessionId,
    sourceProgram: { kind: 'technique', technique: 'mild' },
    presentation,
    now,
  });
}

function completedSession(
  sessionId: string,
  now = NOW
): LucidDreamRehearsalSession {
  const recognized = recognizeLucidDreamRehearsalSign(session(sessionId, now), SIGN_ID, now + 1);
  const intended = confirmLucidDreamRehearsalIntention(recognized, now + 2);
  return completeLucidDreamRehearsalSession(intended, now + 3);
}

function completion(
  sessionId: string,
  completedAt = NOW + 3
): LucidDreamRehearsalCompletion {
  const record = projectLucidDreamRehearsalCompletion(completedSession(sessionId, completedAt - 3));
  if (!record) throw new Error('Expected a completion');
  return { ...record, completedAt };
}

describe('Lucid dream rehearsal local storage', () => {
  it('round-trips the current session and isolates guest from user scopes', async () => {
    const { memory, storage } = memoryKv();
    const input = session('rehearse_one');
    const saved = await saveLucidDreamRehearsalCurrentSession('guest', input, storage);
    expect(saved.currentSession).toEqual(input);
    expect(saved.currentSession).not.toBe(input);
    expect(saved.completions).toEqual([]);
    const mutated = { ...saved.currentSession!, signLabel: 'mutated' };
    expect(mutated.signLabel).toBe('mutated');
    await expect(loadLucidDreamRehearsalCurrentSession('guest', storage)).resolves.toEqual(input);
    expect(getLucidDreamRehearsalStorageKey('guest')).toBe(
      'noctalia_lucid_dream_rehearsal:guest:state_v1'
    );
    expect(getLucidDreamRehearsalStorageKey('user:abc')).toBe(
      'noctalia_lucid_dream_rehearsal:user%3Aabc:state_v1'
    );
    expect(getLucidDreamRehearsalStorageKey('guest')).not.toContain('noctalia_lucid_trainer');
    expect(getLucidDreamRehearsalStorageKey('guest')).not.toContain('dream_atlas');

    await saveLucidDreamRehearsalCurrentSession('user:abc', session('rehearse_user'), storage);
    await expect(loadLucidDreamRehearsalCurrentSession('guest', storage)).resolves.toEqual(input);
    await expect(loadLucidDreamRehearsalCurrentSession('user:abc', storage)).resolves.toEqual(
      session('rehearse_user')
    );
    expect(memory.size).toBe(2);
  });

  it('persists a completed session as a minimal completion without transcript or intention', async () => {
    const { memory, storage } = memoryKv();
    const finished = completedSession('rehearse_done');
    const saved = await saveLucidDreamRehearsalCurrentSession('guest', finished, storage);
    expect(saved.currentSession).toEqual(finished);
    expect(saved.completions).toEqual([
      {
        version: 1,
        sessionId: 'rehearse_done',
        dreamId: DREAM_ID,
        signId: SIGN_ID,
        sourceProgram: { kind: 'technique', technique: 'mild' },
        completedAt: finished.completedAt,
      },
    ]);
    expect(Object.keys(saved.completions[0])).toEqual([
      'version',
      'sessionId',
      'dreamId',
      'signId',
      'sourceProgram',
      'completedAt',
    ]);
    const stored = JSON.parse(memory.get(getLucidDreamRehearsalStorageKey('guest')) ?? '{}');
    expect(JSON.stringify(stored.completions)).not.toMatch(
      /transcript|excerpt|signLabel|intention|premium/i
    );
    expect(Object.keys(stored.completions[0])).toEqual([
      'version',
      'sessionId',
      'dreamId',
      'signId',
      'sourceProgram',
      'completedAt',
    ]);
    await expect(loadLucidDreamRehearsalCompletions('guest', storage)).resolves.toEqual(
      saved.completions
    );
  });

  it('keeps unique completion ids, newest-first order and a 500-completion cap', async () => {
    const { storage } = memoryKv();
    const older = completion('rehearse_same', NOW + 1);
    const newer = { ...older, completedAt: NOW + 5 };
    await upsertLucidDreamRehearsalCompletion('guest', older, storage);
    await upsertLucidDreamRehearsalCompletion('guest', newer, storage);
    await upsertLucidDreamRehearsalCompletion('guest', completion('rehearse_two', NOW + 3), storage);

    const loaded = await loadLucidDreamRehearsalCompletions('guest', storage);
    expect(loaded.map((item) => item.sessionId)).toEqual(['rehearse_same', 'rehearse_two']);
    expect(loaded[0].completedAt).toBe(NOW + 5);

    const stale = { ...newer, completedAt: NOW + 2 };
    await upsertLucidDreamRehearsalCompletion('guest', stale, storage);
    await expect(loadLucidDreamRehearsalCompletions('guest', storage)).resolves.toEqual(loaded);

    const overflow = Array.from(
      { length: LUCID_DREAM_REHEARSAL_MAX_STORED_COMPLETIONS + 1 },
      (_, index) => completion(`rehearse_${String(index).padStart(3, '0')}`, NOW + index)
    );
    await expect(
      updateLucidDreamRehearsalState(
        'guest',
        (current) => ({ ...current, completions: overflow }),
        storage
      )
    ).rejects.toMatchObject({ reason: 'invalid_metadata' });
    await expect(loadLucidDreamRehearsalCompletions('guest', storage)).resolves.toEqual(loaded);
  });

  it('evicts only the oldest completion when upserting into a full store', async () => {
    const { storage } = memoryKv();
    const filled = Array.from(
      { length: LUCID_DREAM_REHEARSAL_MAX_STORED_COMPLETIONS },
      (_, index) => completion(`rehearse_${String(index).padStart(3, '0')}`, NOW + index)
    );
    await updateLucidDreamRehearsalState(
      'guest',
      (current) => ({ ...current, completions: filled }),
      storage
    );
    const before = await loadLucidDreamRehearsalCompletions('guest', storage);
    expect(before).toHaveLength(LUCID_DREAM_REHEARSAL_MAX_STORED_COMPLETIONS);
    const oldest = before[before.length - 1];
    const newestExisting = before[0];

    const incoming = completion(
      'rehearse_new',
      NOW + LUCID_DREAM_REHEARSAL_MAX_STORED_COMPLETIONS + 10
    );
    const afterInsert = await upsertLucidDreamRehearsalCompletion('guest', incoming, storage);
    expect(afterInsert).toHaveLength(LUCID_DREAM_REHEARSAL_MAX_STORED_COMPLETIONS);
    expect(afterInsert[0]).toEqual(incoming);
    expect(afterInsert.map((item) => item.sessionId)).toContain(newestExisting.sessionId);
    expect(afterInsert.map((item) => item.sessionId)).not.toContain(oldest.sessionId);
    expect(afterInsert.filter((item) => item.sessionId === incoming.sessionId)).toHaveLength(1);

    const stale = completion('rehearse_too_old', oldest.completedAt - 1);
    const afterStale = await upsertLucidDreamRehearsalCompletion('guest', stale, storage);
    expect(afterStale).toEqual(afterInsert);
    expect(afterStale.map((item) => item.sessionId)).not.toContain('rehearse_too_old');
  });

  it('serializes same-scope updates and keeps other scopes independent', async () => {
    const { storage } = memoryKv();
    await saveLucidDreamRehearsalCurrentSession('guest', session('rehearse_one'), storage);
    await saveLucidDreamRehearsalCurrentSession('user:abc', session('rehearse_user'), storage);

    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = updateLucidDreamRehearsalState(
      'guest',
      async (current) => {
        await firstGate;
        return {
          ...current,
          completions: [completion('rehearse_two', NOW + 4)],
        };
      },
      storage
    );
    const second = updateLucidDreamRehearsalState(
      'guest',
      (current) => ({
        ...current,
        completions: [...current.completions, completion('rehearse_three', NOW + 5)],
      }),
      storage
    );
    const other = updateLucidDreamRehearsalState(
      'user:abc',
      (current) => ({
        ...current,
        completions: [completion('rehearse_other', NOW + 6)],
      }),
      storage
    );
    await expect(other).resolves.toEqual(
      expect.objectContaining({
        completions: [expect.objectContaining({ sessionId: 'rehearse_other' })],
      })
    );
    releaseFirst();
    await first;
    await second;
    await expect(loadLucidDreamRehearsalCompletions('guest', storage)).resolves.toEqual([
      completion('rehearse_three', NOW + 5),
      completion('rehearse_two', NOW + 4),
    ]);
    await expect(loadLucidDreamRehearsalCompletions('user:abc', storage)).resolves.toEqual([
      completion('rehearse_other', NOW + 6),
    ]);
    await expect(loadLucidDreamRehearsalCurrentSession('guest', storage)).resolves.toEqual(
      session('rehearse_one')
    );
  });

  it('releases the lock after a failed update and recovers the previous state', async () => {
    const { storage } = memoryKv();
    const healthy = await saveLucidDreamRehearsalCurrentSession(
      'guest',
      session('rehearse_one'),
      storage
    );
    await expect(
      updateLucidDreamRehearsalState(
        'guest',
        () => {
          throw new Error('boom');
        },
        storage
      )
    ).rejects.toThrow('boom');
    expect(countLucidDreamRehearsalScopeLocksForTests()).toBe(0);
    await expect(loadLucidDreamRehearsalState('guest', storage)).resolves.toEqual(healthy);
    await expect(
      updateLucidDreamRehearsalState(
        'guest',
        (current) => ({
          ...current,
          completions: [completion('rehearse_two', NOW + 4)],
        }),
        storage
      )
    ).resolves.toEqual({
      ...healthy,
      completions: [completion('rehearse_two', NOW + 4)],
    });
  });

  it('quarantines corrupt envelopes, extra keys and other scopes without mixing guest data', async () => {
    const { memory, storage } = memoryKv();
    const guestKey = getLucidDreamRehearsalStorageKey('guest');
    const userKey = getLucidDreamRehearsalStorageKey('user:abc');
    await saveLucidDreamRehearsalCurrentSession('user:abc', session('rehearse_user'), storage);

    memory.set(guestKey, '{not-json');
    await expect(loadLucidDreamRehearsalCurrentSession('guest', storage)).resolves.toEqual(null);
    expect(memory.has(guestKey)).toBe(false);

    memory.set(
      guestKey,
      JSON.stringify({ version: LUCID_DREAM_REHEARSAL_STORE_VERSION, userScope: 'guest' })
    );
    await expect(loadLucidDreamRehearsalState('guest', storage)).resolves.toEqual({
      version: 1,
      userScope: 'guest',
      currentSession: null,
      completions: [],
    });
    expect(memory.has(guestKey)).toBe(false);

    memory.set(
      guestKey,
      JSON.stringify({
        version: 99,
        userScope: 'guest',
        currentSession: session('rehearse_one'),
        completions: [],
      })
    );
    await expect(loadLucidDreamRehearsalCurrentSession('guest', storage)).resolves.toEqual(null);
    expect(memory.has(guestKey)).toBe(false);

    memory.set(
      guestKey,
      JSON.stringify({
        version: LUCID_DREAM_REHEARSAL_STORE_VERSION,
        userScope: 'user:other',
        currentSession: session('rehearse_one'),
        completions: [],
      })
    );
    await expect(loadLucidDreamRehearsalCurrentSession('guest', storage)).resolves.toEqual(null);
    expect(memory.has(guestKey)).toBe(false);
    await expect(loadLucidDreamRehearsalCurrentSession('user:abc', storage)).resolves.toEqual(
      session('rehearse_user')
    );
    expect(memory.has(userKey)).toBe(true);
  });

  it('classifies write, read, remove and scope failures', async () => {
    const { storage } = memoryKv();
    storage.setItem.mockRejectedValueOnce(new Error('ENOSPC disk full'));
    await expect(
      saveLucidDreamRehearsalCurrentSession('guest', session('rehearse_one'), storage)
    ).rejects.toMatchObject({ reason: 'storage_full' });

    storage.getItem.mockRejectedValueOnce(new Error('sqlite busy'));
    await expect(loadLucidDreamRehearsalState('guest', storage)).rejects.toMatchObject({
      reason: 'persistence_failed',
    });

    storage.removeItem.mockRejectedValueOnce(new Error('cannot unlink'));
    await expect(clearLucidDreamRehearsalState('guest', storage)).rejects.toMatchObject({
      reason: 'persistence_failed',
    });
    expect(() => getLucidDreamRehearsalStorageKey('  guest')).toThrow(
      LucidDreamRehearsalStorageError
    );
    expect(() => getLucidDreamRehearsalStorageKey('anon')).toThrow(LucidDreamRehearsalStorageError);
    expect(() => getLucidDreamRehearsalStorageKey('user:')).toThrow(LucidDreamRehearsalStorageError);
    await expect(loadLucidDreamRehearsalState('user:', storage)).rejects.toMatchObject({
      reason: 'invalid_scope',
    });
  });

  it('exports, clears and imports only the current scope, rejecting hostile payloads without destroying healthy state', async () => {
    const { memory, storage } = memoryKv();
    const healthy = await saveLucidDreamRehearsalCurrentSession(
      'guest',
      completedSession('rehearse_one'),
      storage
    );
    const exported = await exportLucidDreamRehearsalState('guest', storage);
    expect(exported).toEqual(healthy);
    expect(Object.keys(exported)).toEqual([
      'version',
      'userScope',
      'currentSession',
      'completions',
    ]);
    expect(JSON.stringify(exported.completions)).not.toMatch(
      /transcript|excerpt|signLabel|intention|premium/i
    );

    await clearLucidDreamRehearsalState('guest', storage);
    expect(memory.size).toBe(0);
    await clearLucidDreamRehearsalState('guest', storage);
    await expect(loadLucidDreamRehearsalState('guest', storage)).resolves.toEqual({
      version: 1,
      userScope: 'guest',
      currentSession: null,
      completions: [],
    });

    const kept = await saveLucidDreamRehearsalCurrentSession(
      'guest',
      session('rehearse_keep', NOW + 8),
      storage
    );
    await expect(importLucidDreamRehearsalState('guest', { extra: true }, storage)).rejects.toMatchObject({
      reason: 'invalid_metadata',
    });
    await expect(
      importLucidDreamRehearsalState(
        'guest',
        { version: 99, userScope: 'guest', currentSession: null, completions: [] },
        storage
      )
    ).rejects.toMatchObject({ reason: 'invalid_metadata' });
    await expect(
      importLucidDreamRehearsalState(
        'guest',
        { version: 1, userScope: 'user:abc', currentSession: null, completions: [] },
        storage
      )
    ).rejects.toMatchObject({ reason: 'invalid_metadata' });
    await expect(
      importLucidDreamRehearsalState(
        'guest',
        {
          version: 1,
          userScope: 'guest',
          currentSession: null,
          completions: [{ ...healthy.completions[0], sessionId: '__proto__' }],
        },
        storage
      )
    ).rejects.toMatchObject({ reason: 'invalid_metadata' });
    const polluted = JSON.parse(
      '{"version":1,"userScope":"guest","currentSession":null,"completions":[],"__proto__":{"admin":true}}'
    );
    await expect(importLucidDreamRehearsalState('guest', polluted, storage)).rejects.toMatchObject({
      reason: 'invalid_metadata',
    });
    class ExoticEnvelope {
      version = 1;
      userScope = 'guest';
      currentSession = null;
      completions: LucidDreamRehearsalCompletion[] = [];
    }
    await expect(
      importLucidDreamRehearsalState('guest', new ExoticEnvelope(), storage)
    ).rejects.toMatchObject({ reason: 'invalid_metadata' });
    expect(Object.prototype).not.toHaveProperty('admin');
    await expect(loadLucidDreamRehearsalState('guest', storage)).resolves.toEqual(kept);

    const imported = await importLucidDreamRehearsalState('guest', exported, storage);
    expect(imported).toEqual(healthy);

    const clearedSession = await clearLucidDreamRehearsalCurrentSession('guest', storage);
    expect(clearedSession.currentSession).toBeNull();
    expect(clearedSession.completions).toEqual(healthy.completions);
  });
});

describe('Lucid dream rehearsal native storage encryption contract', () => {
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
      getLucidDreamRehearsalStorageKey,
      loadLucidDreamRehearsalCurrentSession,
      saveLucidDreamRehearsalCurrentSession,
    } = require('@/services/lucidDreamRehearsalStorage') as typeof import('@/services/lucidDreamRehearsalStorage');
    const { createLucidDreamRehearsalSession, selectLucidDreamRehearsalScene } =
      require('@/lib/lucid/dreamRehearsal') as typeof import('@/lib/lucid/dreamRehearsal');

    const nativeScene = selectLucidDreamRehearsalScene(
      [{ id: Number(DREAM_ID), title: 'Hallway', transcript: 'I saw a hallway mirror.' }],
      [
        {
          id: SIGN_ID,
          label: 'Hallway mirror',
          category: 'object',
          distinctDreamCount: 2,
          sourceDreamIds: [DREAM_ID],
        },
      ],
      DREAM_ID,
      SIGN_ID
    );
    if (nativeScene.status !== 'ready') throw new Error('Expected a ready scene');
    const nativeSession = createLucidDreamRehearsalSession({
      scene: nativeScene.scene,
      sessionId: 'rehearse_native',
      sourceProgram: { kind: 'atlas' },
      presentation: 'static',
      now: NOW,
    });
    await saveLucidDreamRehearsalCurrentSession('guest', nativeSession);
    const stored = nativeValues.get(getLucidDreamRehearsalStorageKey('guest')) ?? '';
    expect(protectLucidTrainerStoredValue).toHaveBeenCalled();
    expect(stored.startsWith(prefix)).toBe(true);
    expect(stored).not.toContain('rehearse_native');
    await expect(loadLucidDreamRehearsalCurrentSession('guest')).resolves.toEqual(nativeSession);
    expect(revealLucidTrainerStoredValue).toHaveBeenCalled();

    nativeValues.set(getLucidDreamRehearsalStorageKey('guest'), 'not-encrypted');
    revealLucidTrainerStoredValue.mockRejectedValueOnce(encryptedError);
    await expect(loadLucidDreamRehearsalCurrentSession('guest')).resolves.toEqual(null);
    expect(nativeValues.has(getLucidDreamRehearsalStorageKey('guest'))).toBe(false);

    const { memory, storage } = memoryKv();
    await saveLucidDreamRehearsalCurrentSession('guest', nativeSession, storage);
    const plaintext = memory.get(getLucidDreamRehearsalStorageKey('guest')) ?? '';
    expect(plaintext.startsWith(prefix)).toBe(false);
    expect(plaintext).toContain('rehearse_native');
  });
});
