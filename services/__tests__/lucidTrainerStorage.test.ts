import { createInitialLucidTrainerState } from '@/lib/lucid/domain';
import type { LucidSyncMutation } from '@/lib/lucid/model';
import {
  isLucidTrainerEncryptedValue,
  protectLucidTrainerStoredValue,
} from '@/services/lucidTrainerSecureStorage';
import {
  appendLucidTrainerSyncMutation,
  clearLucidTrainerLocalData,
  exportLucidTrainerCsv,
  exportLucidTrainerJson,
  getLucidTrainerStorageKeys,
  loadLucidTrainerState,
  loadLucidTrainerSyncQueue,
  saveLucidTrainerState,
  saveLucidTrainerSyncQueue,
  updateLucidTrainerState,
} from '@/services/lucidTrainerStorage';

const mockNativeValues = new Map<string, string>();
let mockSecureStorageUnavailable = false;
let mockEncryptionUnavailable = false;

jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockNativeValues.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockNativeValues.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockNativeValues.delete(key);
    }),
  },
}));

jest.mock('@/services/lucidTrainerSecureStorage', () => {
  const prefix = 'test-aesgcm-v1:';
  const encode = (value: string) => Buffer.from(value, 'utf8').toString('base64');
  const decode = (value: string) => Buffer.from(value, 'base64').toString('utf8');
  const corrupt = () =>
    Object.assign(new Error('Invalid encrypted Lucid Trainer value'), {
      code: 'invalid_encrypted_value',
    });

  return {
    isLucidTrainerEncryptedValue: (value: string) => value.startsWith(prefix),
    isLucidTrainerEncryptedValueError: (value: unknown) =>
      (value as { code?: string } | null)?.code === 'invalid_encrypted_value',
    protectLucidTrainerStoredValue: jest.fn(
      async (key: string, plaintext: string) => {
        if (mockEncryptionUnavailable) throw new Error('keystore_unavailable');
        return `${prefix}${encode(JSON.stringify({ key, plaintext }))}`;
      }
    ),
    revealLucidTrainerStoredValue: jest.fn(
      async (key: string, storedValue: string) => {
        if (mockSecureStorageUnavailable) throw new Error('device_locked');
        if (!storedValue.startsWith(prefix)) return storedValue;
        try {
          const payload = JSON.parse(decode(storedValue.slice(prefix.length)));
          if (
            payload === null ||
            payload.key !== key ||
            typeof payload.plaintext !== 'string'
          ) {
            throw corrupt();
          }
          return payload.plaintext;
        } catch (error) {
          if ((error as { code?: string }).code === 'invalid_encrypted_value') {
            throw error;
          }
          throw corrupt();
        }
      }
    ),
  };
});

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      values.delete(key);
    }),
  };
}

describe('lucidTrainerStorage', () => {
  const NOW = 1_700_000_000_000;
  const SCOPE = 'user:user-1';

  beforeEach(() => {
    mockNativeValues.clear();
    mockSecureStorageUnavailable = false;
    mockEncryptionUnavailable = false;
    jest.clearAllMocks();
  });

  function state() {
    return createInitialLucidTrainerState({ now: NOW, timeZone: 'Europe/Paris', locale: 'fr' });
  }

  function mutation(overrides: Partial<LucidSyncMutation> = {}): LucidSyncMutation {
    const current = state();
    return {
      version: 1,
      id: 'mutation-1',
      userScope: SCOPE,
      entityType: 'preferences',
      entityKey: 'preferences',
      operation: 'upsert',
      clientRequestId: 'request-1',
      clientUpdatedAt: NOW,
      payload: {
        entity: {
          entityType: 'preferences',
          entityKey: 'preferences',
          value: current.preferences,
        },
      },
      status: 'pending',
      retryCount: 0,
      createdAt: NOW,
      ...overrides,
    };
  }

  it('returns explicit empty and recovered states without persisting corrupt data', async () => {
    const storage = memoryStorage();
    await expect(
      loadLucidTrainerState(SCOPE, { now: NOW, timeZone: 'UTC' }, storage)
    ).resolves.toMatchObject({ source: 'empty', state: { schemaVersion: 1 } });

    const key = getLucidTrainerStorageKeys(SCOPE).state;
    storage.values.set(key, '{corrupt');
    const recovered = await loadLucidTrainerState(
      SCOPE,
      { now: NOW, timeZone: 'UTC' },
      storage
    );
    expect(recovered.source).toBe('recovered');
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.values.has(key)).toBe(false);
  });

  it('encrypts native state and queue values before they reach SQLite', async () => {
    await saveLucidTrainerState(SCOPE, state());
    await saveLucidTrainerSyncQueue(SCOPE, [mutation()]);
    const keys = getLucidTrainerStorageKeys(SCOPE);

    expect(isLucidTrainerEncryptedValue(mockNativeValues.get(keys.state)!)).toBe(true);
    expect(isLucidTrainerEncryptedValue(mockNativeValues.get(keys.syncQueue)!)).toBe(
      true
    );
    await expect(loadLucidTrainerState(SCOPE)).resolves.toMatchObject({
      source: 'stored',
      state: { schemaVersion: 1 },
    });
    await expect(loadLucidTrainerSyncQueue(SCOPE)).resolves.toHaveLength(1);
  });

  it('migrates valid native plaintext only after validation', async () => {
    const keys = getLucidTrainerStorageKeys(SCOPE);
    mockNativeValues.set(keys.state, JSON.stringify(state()));
    mockNativeValues.set(keys.syncQueue, JSON.stringify([mutation()]));

    await expect(loadLucidTrainerState(SCOPE)).resolves.toMatchObject({
      source: 'stored',
    });
    await expect(loadLucidTrainerSyncQueue(SCOPE)).resolves.toHaveLength(1);

    expect(isLucidTrainerEncryptedValue(mockNativeValues.get(keys.state)!)).toBe(true);
    expect(isLucidTrainerEncryptedValue(mockNativeValues.get(keys.syncQueue)!)).toBe(
      true
    );
    expect(protectLucidTrainerStoredValue).toHaveBeenCalledWith(
      keys.state,
      JSON.stringify(state())
    );
  });

  it('removes invalid native plaintext without attempting to encrypt it', async () => {
    const keys = getLucidTrainerStorageKeys(SCOPE);
    mockNativeValues.set(keys.state, '{corrupt');
    mockNativeValues.set(keys.syncQueue, '{corrupt');

    await expect(loadLucidTrainerState(SCOPE)).resolves.toMatchObject({
      source: 'recovered',
    });
    await expect(loadLucidTrainerSyncQueue(SCOPE)).resolves.toEqual([]);

    expect(mockNativeValues.has(keys.state)).toBe(false);
    expect(mockNativeValues.has(keys.syncQueue)).toBe(false);
    expect(protectLucidTrainerStoredValue).not.toHaveBeenCalled();
  });

  it('keeps valid plaintext readable when migration encryption is temporarily unavailable', async () => {
    const key = getLucidTrainerStorageKeys(SCOPE).state;
    const plaintext = JSON.stringify(state());
    mockNativeValues.set(key, plaintext);
    mockEncryptionUnavailable = true;

    await expect(loadLucidTrainerState(SCOPE)).resolves.toMatchObject({
      source: 'stored',
    });
    expect(mockNativeValues.get(key)).toBe(plaintext);
  });

  it('removes only irrecoverable encrypted corruption and preserves transient failures', async () => {
    const keys = getLucidTrainerStorageKeys(SCOPE);
    mockNativeValues.set(keys.state, 'test-aesgcm-v1:corrupt');
    mockNativeValues.set(keys.syncQueue, 'test-aesgcm-v1:corrupt');

    await expect(loadLucidTrainerState(SCOPE)).resolves.toMatchObject({
      source: 'recovered',
    });
    await expect(loadLucidTrainerSyncQueue(SCOPE)).resolves.toEqual([]);
    expect(mockNativeValues.has(keys.state)).toBe(false);
    expect(mockNativeValues.has(keys.syncQueue)).toBe(false);

    const validEncrypted = await protectLucidTrainerStoredValue(
      keys.state,
      JSON.stringify(state())
    );
    const validQueueEncrypted = await protectLucidTrainerStoredValue(
      keys.syncQueue,
      JSON.stringify([mutation()])
    );
    mockNativeValues.set(keys.state, validEncrypted);
    mockNativeValues.set(keys.syncQueue, validQueueEncrypted);
    mockSecureStorageUnavailable = true;

    await expect(loadLucidTrainerState(SCOPE)).rejects.toThrow('device_locked');
    await expect(loadLucidTrainerSyncQueue(SCOPE)).rejects.toThrow('device_locked');
    expect(mockNativeValues.get(keys.state)).toBe(validEncrypted);
    expect(mockNativeValues.get(keys.syncQueue)).toBe(validQueueEncrypted);
  });

  it('uses the scoped storage key as AAD so encrypted values cannot move accounts', async () => {
    const sourceKeys = getLucidTrainerStorageKeys(SCOPE);
    const otherScope = 'user:user-2';
    const otherKeys = getLucidTrainerStorageKeys(otherScope);
    await saveLucidTrainerState(SCOPE, state());
    const encrypted = mockNativeValues.get(sourceKeys.state)!;
    mockNativeValues.set(otherKeys.state, encrypted);

    await expect(loadLucidTrainerState(otherScope)).resolves.toMatchObject({
      source: 'recovered',
    });
    expect(mockNativeValues.has(otherKeys.state)).toBe(false);
    expect(mockNativeValues.get(sourceKeys.state)).toBe(encrypted);
  });

  it('validates writes and serializes concurrent updates for one account', async () => {
    const storage = memoryStorage();
    await saveLucidTrainerState(SCOPE, state(), storage);

    await Promise.all([
      updateLucidTrainerState(
        SCOPE,
        async (current) => ({
          ...current,
          updatedAt: current.updatedAt + 1,
          preferences: {
            ...current.preferences,
            realityCheckRemindersPerDay:
              current.preferences.realityCheckRemindersPerDay + 1,
            updatedAt: current.preferences.updatedAt + 1,
          },
        }),
        {},
        storage
      ),
      updateLucidTrainerState(
        SCOPE,
        (current) => ({
          ...current,
          updatedAt: current.updatedAt + 1,
          preferences: {
            ...current.preferences,
            realityCheckRemindersPerDay:
              current.preferences.realityCheckRemindersPerDay + 1,
            updatedAt: current.preferences.updatedAt + 1,
          },
        }),
        {},
        storage
      ),
    ]);

    const loaded = await loadLucidTrainerState(SCOPE, {}, storage);
    expect(loaded.state.preferences.realityCheckRemindersPerDay).toBe(5);
    await expect(
      saveLucidTrainerState(SCOPE, { ...state(), schemaVersion: 2 } as any, storage)
    ).rejects.toThrow('Invalid Lucid Trainer state');
  });

  it('keeps a durable idempotent queue scoped to the account', async () => {
    const storage = memoryStorage();
    await appendLucidTrainerSyncMutation(SCOPE, mutation(), storage);
    await appendLucidTrainerSyncMutation(
      SCOPE,
      mutation({ id: 'duplicate-id', createdAt: NOW + 1 }),
      storage
    );

    await expect(loadLucidTrainerSyncQueue(SCOPE, storage)).resolves.toHaveLength(1);
    await expect(
      saveLucidTrainerSyncQueue(
        SCOPE,
        [mutation({ userScope: 'user:another' })],
        storage
      )
    ).rejects.toThrow('Invalid Lucid Trainer sync queue');
  });

  it('exports JSON and CSV including sleep quality while neutralizing spreadsheet formulas', () => {
    const current = state();
    current.experiments = [
      {
        id: '=unsafe-id',
        occurredAt: NOW,
        technique: 'mild',
        preparationMinutes: 20,
        result: 'lucid',
        lucidityLevel: 4,
        recallLevel: 5,
        sleepQuality: 2,
        factors: ['sleep_debt'],
        notes: 'morning check-in',
        updatedAt: NOW,
      },
    ];
    current.dreamSignDecisions = [{
      id: 'sign:mirror',
      decision: 'confirmed',
      customLabel: '=My mirror',
      sourceDreamIds: ['101', '102'],
      updatedAt: NOW,
    }];

    const json = JSON.parse(exportLucidTrainerJson(current, NOW));
    expect(json).toMatchObject({
      exportVersion: 1,
      exportedAt: new Date(NOW).toISOString(),
      state: { preferences: { cloudSyncEnabled: false, noctaliaLinkEnabled: false } },
    });
    expect(json.state.dreamSignDecisions).toEqual([
      expect.objectContaining({ id: 'sign:mirror', sourceDreamIds: ['101', '102'] }),
    ]);

    const csv = exportLucidTrainerCsv(current);
    expect(csv).toContain('"sleep_quality"');
    expect(csv).toContain('"2"');
    expect(csv).toContain('"\'=unsafe-id"');
    expect(csv).toContain('"dream_sign"');
    expect(csv).toContain('"sign:mirror"');
    expect(csv).toContain('"sourceDreamIds"');
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv).not.toContain('captureMode');

    current.experiments.push({
      id: 'capture-1',
      occurredAt: NOW + 1,
      technique: null,
      preparationMinutes: null,
      result: null,
      lucidityLevel: null,
      recallLevel: null,
      sleepQuality: null,
      factors: [],
      updatedAt: NOW + 1,
      captureMode: 'write',
      recallText: '=hallway',
      cueOutcome: 'heard_in_dream',
      techniqueAutoLink: {
        technique: 'wbtb',
        source: 'program_practice',
        practiceDate: '2026-08-26',
      },
    });
    const csvWithCapture = exportLucidTrainerCsv(current);
    expect(csvWithCapture).toContain('"captureMode"');
    expect(csvWithCapture).toContain('"write"');
    expect(csvWithCapture).toContain('"heard_in_dream"');
    expect(csvWithCapture).toContain('"=hallway"');
    expect(csvWithCapture).toContain('"program_practice"');
    expect(csvWithCapture.split('\r\n')[1]).toContain('"experiment"');
  });

  it('clears state and queue keys without touching other data', async () => {
    const keys = getLucidTrainerStorageKeys(SCOPE);
    const storage = memoryStorage({
      [keys.state]: JSON.stringify(state()),
      [keys.syncQueue]: JSON.stringify([mutation()]),
      unrelated: 'keep',
    });
    const cancelReminders = jest.fn(async () => undefined);

    await clearLucidTrainerLocalData(SCOPE, storage, cancelReminders);

    expect(cancelReminders).toHaveBeenCalledTimes(1);
    expect(storage.values.has(keys.state)).toBe(false);
    expect(storage.values.has(keys.syncQueue)).toBe(false);
    expect(storage.values.get('unrelated')).toBe('keep');
  });

  it('still removes sensitive local data when OS reminder cleanup fails', async () => {
    const keys = getLucidTrainerStorageKeys(SCOPE);
    const storage = memoryStorage({
      [keys.state]: JSON.stringify(state()),
      [keys.syncQueue]: JSON.stringify([mutation()]),
    });

    await expect(
      clearLucidTrainerLocalData(SCOPE, storage, async () => {
        throw new Error('notification API unavailable');
      })
    ).rejects.toThrow('notification API unavailable');
    expect(storage.values.has(keys.state)).toBe(false);
    expect(storage.values.has(keys.syncQueue)).toBe(false);
  });
});
