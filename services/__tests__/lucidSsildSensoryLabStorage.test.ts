import { createLucidGuidedRitualPlan } from '@/lib/lucid/guidedRitual';
import type { LucidSafetyMode, LucidSafetyPolicy } from '@/lib/lucid/safety';
import {
  createLucidSsildSensoryLabSession,
  exitLucidSsildSensoryLabSession,
  interruptLucidSsildSensoryLabSession,
  pauseLucidSsildSensoryLabSession,
  resumeLucidSsildSensoryLabSession,
  startLucidSsildSensoryLabSession,
  tickLucidSsildSensoryLabSession,
  type LucidSsildSensoryLabSession,
} from '@/lib/lucid/ssildSensoryLab';
import {
  LUCID_SSILD_SENSORY_LAB_STORE_VERSION,
  LucidSsildSensoryLabStorageError,
  clearLucidSsildSensoryLabCurrentSession,
  countLucidSsildSensoryLabScopeLocksForTests,
  exportLucidSsildSensoryLabState,
  getLucidSsildSensoryLabStorageKey,
  importLucidSsildSensoryLabState,
  loadLucidSsildSensoryLabCurrentSession,
  saveLucidSsildSensoryLabCurrentSession,
  updateLucidSsildSensoryLabCurrentSession,
} from '@/services/lucidSsildSensoryLabStorage';

const NOW = 1_700_000_000_000;

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

function policy(
  mode: LucidSafetyMode,
  overrides: Partial<LucidSafetyPolicy> = {}
): LucidSafetyPolicy {
  return {
    mode,
    allowWbtb: mode === 'normal',
    allowNightSignals: mode === 'normal',
    nightSignalIntensity: mode === 'normal' ? 'normal' : 'blocked',
    emergencyStopAllowed: true,
    reasons: [],
    ...overrides,
  };
}

function readyPlan() {
  const plan = createLucidGuidedRitualPlan('ssild', policy('normal'));
  expect(plan.status).toBe('ready');
  if (plan.status !== 'ready') throw new Error('Expected a ready SSILD plan');
  return plan;
}

function idle(sessionId = 'ssild_lab_session01', now = NOW): LucidSsildSensoryLabSession {
  return createLucidSsildSensoryLabSession({
    plan: readyPlan(),
    sessionId,
    now,
  });
}

function started(sessionId = 'ssild_lab_session01', now = NOW + 1): LucidSsildSensoryLabSession {
  return startLucidSsildSensoryLabSession(idle(sessionId, NOW), now);
}

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

describe('Lucid SSILD sensory lab session storage', () => {
  it('round-trips cloned sessions and isolates keys by scope', async () => {
    const { memory, storage } = memoryKv();
    const input = started();
    const saved = await saveLucidSsildSensoryLabCurrentSession('guest', input, storage);
    expect(saved).toEqual(input);
    expect(saved).not.toBe(input);
    (saved as { status: string }).status = 'completed';
    expect(input.status).toBe('running');

    await expect(loadLucidSsildSensoryLabCurrentSession('guest', storage)).resolves.toEqual(input);
    expect(getLucidSsildSensoryLabStorageKey('guest')).toBe(
      'noctalia_lucid_ssild_sensory_lab:guest:state_v1'
    );
    expect(getLucidSsildSensoryLabStorageKey('user:abc')).toBe(
      'noctalia_lucid_ssild_sensory_lab:user%3Aabc:state_v1'
    );
    expect(getLucidSsildSensoryLabStorageKey('guest')).not.toContain('noctalia_lucid_trainer');
    expect(getLucidSsildSensoryLabStorageKey('guest')).not.toContain('stabilization_lab');

    await saveLucidSsildSensoryLabCurrentSession('user:abc', started('ssild_user'), storage);
    await expect(loadLucidSsildSensoryLabCurrentSession('guest', storage)).resolves.toEqual(input);
    await expect(loadLucidSsildSensoryLabCurrentSession('user:abc', storage)).resolves.toEqual(
      started('ssild_user')
    );
    expect(memory.size).toBe(2);
  });

  it('round-trips pause, resume, audio interruption and immediate exit exactly', async () => {
    const { storage } = memoryKv();
    const running = started();
    const paused = pauseLucidSsildSensoryLabSession(running, running.startedAt! + 11_000);
    await saveLucidSsildSensoryLabCurrentSession('guest', paused, storage);
    await expect(loadLucidSsildSensoryLabCurrentSession('guest', storage)).resolves.toEqual(paused);

    const resumed = resumeLucidSsildSensoryLabSession(paused, paused.pausedAt! + 80_000);
    await saveLucidSsildSensoryLabCurrentSession('guest', resumed, storage);
    await expect(loadLucidSsildSensoryLabCurrentSession('guest', storage)).resolves.toEqual(resumed);

    const interrupted = interruptLucidSsildSensoryLabSession(
      resumed,
      resumed.lastResumedAt! + 2_000,
      'audio_route'
    );
    await saveLucidSsildSensoryLabCurrentSession('guest', interrupted, storage);
    await expect(loadLucidSsildSensoryLabCurrentSession('guest', storage)).resolves.toEqual(
      interrupted
    );

    const afterInterrupt = resumeLucidSsildSensoryLabSession(
      interrupted,
      interrupted.pausedAt! + 1_000
    );
    const exited = exitLucidSsildSensoryLabSession(
      afterInterrupt,
      afterInterrupt.lastResumedAt! + 500
    );
    expect(exited.status).toBe('interrupted');
    expect(exited.interruptionReason).toBe('user_exit');
    await saveLucidSsildSensoryLabCurrentSession('guest', exited, storage);
    await expect(loadLucidSsildSensoryLabCurrentSession('guest', storage)).resolves.toEqual(exited);
    expect(exited.status).not.toBe('completed');
  });

  it('serializes same-scope updates and keeps other scopes independent', async () => {
    const { storage } = memoryKv();
    const firstSession = started('ssild_one');
    const userSession = started('ssild_user');
    await saveLucidSsildSensoryLabCurrentSession('guest', firstSession, storage);
    await saveLucidSsildSensoryLabCurrentSession('user:abc', userSession, storage);

    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const paused = pauseLucidSsildSensoryLabSession(
      firstSession,
      firstSession.startedAt! + 5_000
    );
    const first = updateLucidSsildSensoryLabCurrentSession(
      'guest',
      async () => {
        await firstGate;
        return paused;
      },
      storage
    );
    const resumed = resumeLucidSsildSensoryLabSession(paused, paused.pausedAt! + 2_000);
    const second = updateLucidSsildSensoryLabCurrentSession(
      'guest',
      () => resumed,
      storage
    );
    const other = updateLucidSsildSensoryLabCurrentSession(
      'user:abc',
      (current) =>
        tickLucidSsildSensoryLabSession(current ?? userSession, userSession.startedAt! + 4_000)
          .session,
      storage
    );
    await expect(other).resolves.toMatchObject({
      sessionId: 'ssild_user',
      accumulatedElapsedMs: 4_000,
    });
    releaseFirst();
    await first;
    await second;
    await expect(loadLucidSsildSensoryLabCurrentSession('guest', storage)).resolves.toEqual(resumed);
    await expect(loadLucidSsildSensoryLabCurrentSession('user:abc', storage)).resolves.toMatchObject({
      sessionId: 'ssild_user',
      accumulatedElapsedMs: 4_000,
    });
  });

  it('releases the lock after a failed update and recovers the previous session', async () => {
    const { storage } = memoryKv();
    const healthy = await saveLucidSsildSensoryLabCurrentSession('guest', started(), storage);
    await expect(
      updateLucidSsildSensoryLabCurrentSession(
        'guest',
        () => {
          throw new Error('boom');
        },
        storage
      )
    ).rejects.toThrow('boom');
    expect(countLucidSsildSensoryLabScopeLocksForTests()).toBe(0);
    await expect(loadLucidSsildSensoryLabCurrentSession('guest', storage)).resolves.toEqual(healthy);
    const paused = pauseLucidSsildSensoryLabSession(healthy, healthy.startedAt! + 3_000);
    await expect(
      updateLucidSsildSensoryLabCurrentSession('guest', () => paused, storage)
    ).resolves.toEqual(paused);
  });

  it('quarantines corrupt envelopes, wrong versions and other scopes without mixing guest data', async () => {
    const { memory, storage } = memoryKv();
    const guestKey = getLucidSsildSensoryLabStorageKey('guest');
    const userKey = getLucidSsildSensoryLabStorageKey('user:abc');
    await saveLucidSsildSensoryLabCurrentSession('user:abc', started('ssild_user'), storage);

    memory.set(guestKey, '{not-json');
    await expect(loadLucidSsildSensoryLabCurrentSession('guest', storage)).resolves.toBeNull();
    expect(memory.has(guestKey)).toBe(false);

    memory.set(
      guestKey,
      JSON.stringify({ version: LUCID_SSILD_SENSORY_LAB_STORE_VERSION, userScope: 'guest' })
    );
    await expect(loadLucidSsildSensoryLabCurrentSession('guest', storage)).resolves.toBeNull();
    expect(memory.has(guestKey)).toBe(false);

    memory.set(
      guestKey,
      JSON.stringify({
        version: 99,
        userScope: 'guest',
        currentSession: started(),
      })
    );
    await expect(loadLucidSsildSensoryLabCurrentSession('guest', storage)).resolves.toBeNull();
    expect(memory.has(guestKey)).toBe(false);

    memory.set(
      guestKey,
      JSON.stringify({
        version: LUCID_SSILD_SENSORY_LAB_STORE_VERSION,
        userScope: 'user:other',
        currentSession: started(),
      })
    );
    await expect(loadLucidSsildSensoryLabCurrentSession('guest', storage)).resolves.toBeNull();
    expect(memory.has(guestKey)).toBe(false);
    await expect(loadLucidSsildSensoryLabCurrentSession('user:abc', storage)).resolves.toEqual(
      started('ssild_user')
    );
    expect(memory.has(userKey)).toBe(true);
  });

  it('classifies write, read, remove and scope failures', async () => {
    const { storage } = memoryKv();
    storage.setItem.mockRejectedValueOnce(new Error('ENOSPC disk full'));
    await expect(saveLucidSsildSensoryLabCurrentSession('guest', started(), storage)).rejects.toMatchObject({
      reason: 'storage_full',
    });

    storage.getItem.mockRejectedValueOnce(new Error('sqlite busy'));
    await expect(loadLucidSsildSensoryLabCurrentSession('guest', storage)).rejects.toMatchObject({
      reason: 'persistence_failed',
    });

    storage.removeItem.mockRejectedValueOnce(new Error('cannot unlink'));
    await expect(clearLucidSsildSensoryLabCurrentSession('guest', storage)).rejects.toMatchObject({
      reason: 'persistence_failed',
    });
    expect(() => getLucidSsildSensoryLabStorageKey('  guest')).toThrow(
      LucidSsildSensoryLabStorageError
    );
    expect(() => getLucidSsildSensoryLabStorageKey('anon')).toThrow(
      LucidSsildSensoryLabStorageError
    );
    expect(() => getLucidSsildSensoryLabStorageKey('user:')).toThrow(
      LucidSsildSensoryLabStorageError
    );
    await expect(loadLucidSsildSensoryLabCurrentSession('user:', storage)).rejects.toMatchObject({
      reason: 'invalid_scope',
    });
  });

  it('exports, clears and imports only the current scope, rejecting hostile payloads without destroying healthy state', async () => {
    const { memory, storage } = memoryKv();
    const healthy = await saveLucidSsildSensoryLabCurrentSession('guest', started(), storage);
    const exported = await exportLucidSsildSensoryLabState('guest', storage);
    expect(exported).toEqual({
      version: LUCID_SSILD_SENSORY_LAB_STORE_VERSION,
      userScope: 'guest',
      currentSession: healthy,
    });
    expect(Object.keys(exported)).toEqual(['version', 'userScope', 'currentSession']);
    expect(JSON.stringify(exported)).not.toMatch(/dream|premium|result/i);

    await clearLucidSsildSensoryLabCurrentSession('guest', storage);
    expect(memory.size).toBe(0);
    await clearLucidSsildSensoryLabCurrentSession('guest', storage);
    await expect(loadLucidSsildSensoryLabCurrentSession('guest', storage)).resolves.toBeNull();

    const keep = started('ssild_keep', NOW + 8);
    await saveLucidSsildSensoryLabCurrentSession('guest', keep, storage);
    const current = await loadLucidSsildSensoryLabCurrentSession('guest', storage);
    await expect(importLucidSsildSensoryLabState('guest', { extra: true }, storage)).rejects.toMatchObject({
      reason: 'invalid_metadata',
    });
    await expect(
      importLucidSsildSensoryLabState(
        'guest',
        { version: 99, userScope: 'guest', currentSession: healthy },
        storage
      )
    ).rejects.toMatchObject({ reason: 'invalid_metadata' });
    await expect(
      importLucidSsildSensoryLabState(
        'guest',
        { version: 1, userScope: 'user:abc', currentSession: healthy },
        storage
      )
    ).rejects.toMatchObject({ reason: 'invalid_metadata' });
    await expect(
      importLucidSsildSensoryLabState(
        'guest',
        { version: 1, userScope: 'guest', currentSession: { ...healthy, sessionId: '__proto__' } },
        storage
      )
    ).rejects.toMatchObject({ reason: 'invalid_metadata' });
    const polluted = JSON.parse(
      '{"version":1,"userScope":"guest","currentSession":null,"__proto__":{"admin":true}}'
    );
    await expect(importLucidSsildSensoryLabState('guest', polluted, storage)).rejects.toMatchObject({
      reason: 'invalid_metadata',
    });
    class ExoticEnvelope {
      version = 1;
      userScope = 'guest';
      currentSession: LucidSsildSensoryLabSession | null = null;
    }
    await expect(
      importLucidSsildSensoryLabState('guest', new ExoticEnvelope(), storage)
    ).rejects.toMatchObject({ reason: 'invalid_metadata' });
    expect(Object.prototype).not.toHaveProperty('admin');
    await expect(loadLucidSsildSensoryLabCurrentSession('guest', storage)).resolves.toEqual(current);

    const imported = await importLucidSsildSensoryLabState('guest', exported, storage);
    expect(imported).toEqual(healthy);
  });
});

describe('Lucid SSILD sensory lab native storage encryption contract', () => {
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
    const { Platform } = require('react-native') as typeof import('react-native');
    Platform.OS = 'ios';
    jest.doMock('expo-sqlite/kv-store', () => ({ __esModule: true, default: sqlite }));
    jest.doMock('@react-native-async-storage/async-storage', () => ({
      __esModule: true,
      default: {
        getItem: jest.fn(async () => {
          throw new Error('web AsyncStorage must not back native encryption tests');
        }),
        setItem: jest.fn(async () => undefined),
        removeItem: jest.fn(async () => undefined),
      },
    }));
    jest.doMock('@/services/lucidTrainerSecureStorage', () => ({
      isLucidTrainerEncryptedValueError: (value: unknown) =>
        (value as { code?: string } | null)?.code === 'invalid_encrypted_value',
      isLucidTrainerStorageCapacityError: () => false,
      protectLucidTrainerStoredValue,
      revealLucidTrainerStoredValue,
    }));

    const {
      getLucidSsildSensoryLabStorageKey,
      loadLucidSsildSensoryLabCurrentSession,
      saveLucidSsildSensoryLabCurrentSession,
    } = require('@/services/lucidSsildSensoryLabStorage') as typeof import('@/services/lucidSsildSensoryLabStorage');
    const { createLucidGuidedRitualPlan } =
      require('@/lib/lucid/guidedRitual') as typeof import('@/lib/lucid/guidedRitual');
    const {
      createLucidSsildSensoryLabSession,
      startLucidSsildSensoryLabSession,
    } = require('@/lib/lucid/ssildSensoryLab') as typeof import('@/lib/lucid/ssildSensoryLab');

    const nativePlan = createLucidGuidedRitualPlan('ssild', {
      mode: 'normal',
      allowWbtb: true,
      allowNightSignals: true,
      nightSignalIntensity: 'normal',
      emergencyStopAllowed: true,
      reasons: [],
    });
    if (nativePlan.status !== 'ready') throw new Error('Expected a ready SSILD plan');
    const nativeSession = startLucidSsildSensoryLabSession(
      createLucidSsildSensoryLabSession({
        plan: nativePlan,
        sessionId: 'ssild_native',
        now: NOW,
      }),
      NOW + 1
    );
    await saveLucidSsildSensoryLabCurrentSession('guest', nativeSession);
    const stored = nativeValues.get(getLucidSsildSensoryLabStorageKey('guest')) ?? '';
    expect(protectLucidTrainerStoredValue).toHaveBeenCalled();
    expect(stored.startsWith(prefix)).toBe(true);
    expect(stored).not.toContain('ssild_native');
    await expect(loadLucidSsildSensoryLabCurrentSession('guest')).resolves.toEqual(nativeSession);
    expect(revealLucidTrainerStoredValue).toHaveBeenCalled();

    nativeValues.set(getLucidSsildSensoryLabStorageKey('guest'), 'not-encrypted');
    revealLucidTrainerStoredValue.mockRejectedValueOnce(encryptedError);
    await expect(loadLucidSsildSensoryLabCurrentSession('guest')).resolves.toBeNull();
    expect(nativeValues.has(getLucidSsildSensoryLabStorageKey('guest'))).toBe(false);

    const { memory, storage } = memoryKv();
    await saveLucidSsildSensoryLabCurrentSession('guest', nativeSession, storage);
    const plaintext = memory.get(getLucidSsildSensoryLabStorageKey('guest')) ?? '';
    expect(plaintext.startsWith(prefix)).toBe(false);
    expect(plaintext).toContain('ssild_native');
  });
});
