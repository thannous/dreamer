import { createInitialLucidTrainerState } from '@/lib/lucid/domain';
import type { LucidSyncMutation } from '@/lib/lucid/model';
import {
  getLucidDreamAtlasStorageKey,
  saveLucidDreamAtlasPreferences,
} from '@/services/lucidDreamAtlasStorage';
import { getLucidDreamRehearsalStorageKey } from '@/services/lucidDreamRehearsalStorage';
import { getLucidHealthKitStorageKey } from '@/services/lucidHealthKitStorage';
import { getLucidSsildSensoryLabStorageKey } from '@/services/lucidSsildSensoryLabStorage';
import { getLucidStabilizationLabStorageKey } from '@/services/lucidStabilizationLabStorage';
import {
  isLucidTrainerEncryptedValue,
  protectLucidTrainerStoredValue,
} from '@/services/lucidTrainerSecureStorage';
import {
  LUCID_DREAM_ATLAS_PRISTINE_UPDATED_AT,
  createEmptyLucidDreamAtlasOverlay,
} from '@/lib/lucid/dreamAtlas';
import {
  appendLucidTrainerSyncMutation,
  clearLucidTrainerLocalData,
  EXPORT_VERSION,
  LEGACY_EXPORT_VERSION,
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

  it('migrates a non-empty companion overlay once into trainer state then drops the KV', async () => {
    const storage = memoryStorage();
    const current = state();
    delete (current as { dreamAtlas?: unknown }).dreamAtlas;
    await saveLucidTrainerState(SCOPE, current, storage);
    await saveLucidDreamAtlasPreferences(
      SCOPE,
      {
        version: 1,
        renamed: { 'sign:marie': 'Marie au miroir' },
        hidden: ['sign:miroir'],
        merges: { 'sign:peur': 'sign:marie' },
        deleted: ['sign:horloge'],
      },
      storage
    );

    const loaded = await loadLucidTrainerState(SCOPE, { now: NOW + 5 }, storage);
    expect(loaded.source).toBe('stored');
    expect(loaded.state.dreamAtlas).toEqual({
      version: 1,
      updatedAt: NOW + 5,
      renamed: { 'sign:marie': 'Marie au miroir' },
      hidden: ['sign:miroir'],
      merges: { 'sign:peur': 'sign:marie' },
      deleted: ['sign:horloge'],
    });
    expect(storage.values.has(getLucidDreamAtlasStorageKey(SCOPE))).toBe(false);

    await saveLucidDreamAtlasPreferences(
      SCOPE,
      { version: 1, renamed: { 'sign:ghost': 'Nope' }, hidden: [], merges: {}, deleted: [] },
      storage
    );
    const second = await loadLucidTrainerState(SCOPE, { now: NOW + 50 }, storage);
    expect(second.state.dreamAtlas).toEqual(loaded.state.dreamAtlas);
    expect(storage.values.has(getLucidDreamAtlasStorageKey(SCOPE))).toBe(false);
  });

  it('stamps migrated companion prefs with defaults.now and does not treat an empty companion as a recent clear', async () => {
    const storage = memoryStorage();
    await saveLucidDreamAtlasPreferences(
      SCOPE,
      { version: 1, renamed: { 'sign:marie': 'Marie' }, hidden: [], merges: {}, deleted: [] },
      storage
    );
    const first = await loadLucidTrainerState(SCOPE, { now: NOW, timeZone: 'UTC' }, storage);
    expect(first.source).toBe('empty');
    expect(first.state.dreamAtlas?.updatedAt).toBe(NOW);
    expect(first.state.dreamAtlas?.renamed).toEqual({ 'sign:marie': 'Marie' });
    expect(storage.values.has(getLucidDreamAtlasStorageKey(SCOPE))).toBe(false);

    const emptyStorage = memoryStorage();
    await saveLucidDreamAtlasPreferences(
      SCOPE,
      { version: 1, renamed: {}, hidden: [], merges: {}, deleted: [] },
      emptyStorage
    );
    const emptyLoad = await loadLucidTrainerState(
      SCOPE,
      { now: NOW + 9, timeZone: 'UTC' },
      emptyStorage
    );
    expect(emptyLoad.state.dreamAtlas).toEqual(
      createEmptyLucidDreamAtlasOverlay(LUCID_DREAM_ATLAS_PRISTINE_UPDATED_AT)
    );
    expect(emptyStorage.values.has(getLucidDreamAtlasStorageKey(SCOPE))).toBe(false);
  });

  it('lets a non-pristine trainer overlay win even when empty, then only retries companion drop', async () => {
    const storage = memoryStorage();
    const current = {
      ...state(),
      dreamAtlas: createEmptyLucidDreamAtlasOverlay(NOW + 2),
    };
    await saveLucidTrainerState(SCOPE, current, storage);
    await saveLucidDreamAtlasPreferences(
      SCOPE,
      { version: 1, renamed: { 'sign:marie': 'Other' }, hidden: [], merges: {}, deleted: [] },
      storage
    );
    const loaded = await loadLucidTrainerState(SCOPE, { now: NOW + 80 }, storage);
    expect(loaded.state.dreamAtlas).toEqual(createEmptyLucidDreamAtlasOverlay(NOW + 2));
    expect(storage.values.has(getLucidDreamAtlasStorageKey(SCOPE))).toBe(false);
  });

  it('keeps the companion when the main trainer write fails', async () => {
    const storage = memoryStorage();
    await saveLucidDreamAtlasPreferences(
      SCOPE,
      { version: 1, renamed: { 'sign:marie': 'Marie' }, hidden: [], merges: {}, deleted: [] },
      storage
    );
    const originalSetItem = storage.setItem;
    storage.setItem = jest.fn(async (key: string, value: string) => {
      if (key === getLucidTrainerStorageKeys(SCOPE).state) {
        throw new Error('disk full');
      }
      return originalSetItem(key, value);
    });
    await expect(loadLucidTrainerState(SCOPE, { now: NOW }, storage)).rejects.toThrow('disk full');
    expect(storage.values.has(getLucidDreamAtlasStorageKey(SCOPE))).toBe(true);
  });

  it('does not recover or drop a valid stored state when companion migration persist fails', async () => {
    const storage = memoryStorage();
    const legacy = state();
    delete (legacy as { dreamAtlas?: unknown }).dreamAtlas;
    await saveLucidTrainerState(SCOPE, legacy, storage);
    const stateKey = getLucidTrainerStorageKeys(SCOPE).state;
    const companionKey = getLucidDreamAtlasStorageKey(SCOPE);
    const originalState = storage.values.get(stateKey);
    await saveLucidDreamAtlasPreferences(
      SCOPE,
      { version: 1, renamed: { 'sign:marie': 'Marie' }, hidden: [], merges: {}, deleted: [] },
      storage
    );
    const originalSetItem = storage.setItem;
    storage.setItem = jest.fn(async (key: string, value: string) => {
      if (key === stateKey) {
        throw new Error('disk full');
      }
      return originalSetItem(key, value);
    });

    await expect(loadLucidTrainerState(SCOPE, { now: NOW + 7 }, storage)).rejects.toThrow('disk full');
    expect(storage.values.get(stateKey)).toBe(originalState);
    expect(storage.values.has(companionKey)).toBe(true);
  });

  it('does not overwrite a migrated overlay if companion removal fails, then retries only the drop', async () => {
    const storage = memoryStorage();
    const current = state();
    delete (current as { dreamAtlas?: unknown }).dreamAtlas;
    await saveLucidTrainerState(SCOPE, current, storage);
    await saveLucidDreamAtlasPreferences(
      SCOPE,
      { version: 1, renamed: { 'sign:marie': 'Marie' }, hidden: [], merges: {}, deleted: [] },
      storage
    );
    const originalRemove = storage.removeItem;
    let removals = 0;
    storage.removeItem = jest.fn(async (key: string) => {
      if (key === getLucidDreamAtlasStorageKey(SCOPE)) {
        removals += 1;
        if (removals === 1) throw new Error('busy');
      }
      return originalRemove(key);
    });

    const first = await loadLucidTrainerState(SCOPE, { now: NOW + 3 }, storage);
    expect(first.state.dreamAtlas?.updatedAt).toBe(NOW + 3);
    expect(storage.values.has(getLucidDreamAtlasStorageKey(SCOPE))).toBe(true);

    const second = await loadLucidTrainerState(SCOPE, { now: NOW + 99 }, storage);
    expect(second.state.dreamAtlas).toEqual(first.state.dreamAtlas);
    expect(storage.values.has(getLucidDreamAtlasStorageKey(SCOPE))).toBe(false);
  });

  it('upgrades a legacy stored state without dreamAtlas to a pristine overlay without losing data', async () => {
    const storage = memoryStorage();
    const legacy = state();
    delete (legacy as { dreamAtlas?: unknown }).dreamAtlas;
    legacy.experiments = [
      {
        id: 'keep-me',
        occurredAt: NOW,
        technique: 'mild',
        preparationMinutes: 10,
        result: 'lucid',
        lucidityLevel: 3,
        recallLevel: 4,
        sleepQuality: 2,
        factors: [],
        updatedAt: NOW,
      },
    ];
    await saveLucidTrainerState(SCOPE, legacy, storage);
    const loaded = await loadLucidTrainerState(SCOPE, { now: NOW + 1 }, storage);
    expect(loaded.state.experiments[0]?.id).toBe('keep-me');
    expect(loaded.state.dreamAtlas).toEqual(
      createEmptyLucidDreamAtlasOverlay(LUCID_DREAM_ATLAS_PRISTINE_UPDATED_AT)
    );
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
    current.realityChecks = [{
      id: 'pause-1',
      occurredAt: NOW,
      context: 'spontaneous',
      mindfulPauseAnchor: 'unusual_event',
      method: 'memory_trace',
      outcome: 'uncertain',
      mindful: true,
      observedDetail: '=clock changed',
      arrivalPath: 'I entered the room',
      nextDreamIntention: 'If it changes, I will question the dream',
      updatedAt: NOW,
    }];

    const json = JSON.parse(exportLucidTrainerJson(current, NOW));
    expect(json).toMatchObject({
      exportVersion: EXPORT_VERSION,
      exportedAt: new Date(NOW).toISOString(),
      state: { preferences: { cloudSyncEnabled: false, noctaliaLinkEnabled: false } },
    });
    expect(json.exportVersion).toBe(2);
    expect(LEGACY_EXPORT_VERSION).toBe(1);
    expect(Object.keys(json)).toEqual(['exportVersion', 'exportedAt', 'state']);
    expect(json).not.toHaveProperty('atlas');
    expect(json.state.dreamAtlas).toEqual(createEmptyLucidDreamAtlasOverlay(LUCID_DREAM_ATLAS_PRISTINE_UPDATED_AT));
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
    expect(csv).toContain('"observedDetail"');
    expect(csv).toContain('=clock changed');
    expect(csv).toContain('"nextDreamIntention"');
    expect(csv).toContain('"mindfulPauseAnchor"');
    expect(csv).toContain('"unusual_event"');
    expect(csv).toContain('"spontaneous"');
    expect(csv).not.toContain('"context":"unusual_event"');
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

  it('exports atlas preference relations from state.dreamAtlas without duplicating atlas or source dream text', () => {
    const current = state();
    current.dreamAtlas = {
      version: 1,
      updatedAt: NOW,
      renamed: { 'sign:miroir': "'=Mirror", 'sign:marie': 'Marie au miroir' },
      hidden: ['sign:escalier', 'sign:miroir'],
      merges: { 'sign:peur': 'sign:marie', 'sign:visage': 'sign:marie' },
      deleted: ['sign:horloge', 'sign:escalier'],
    };
    const json = JSON.parse(exportLucidTrainerJson(current, NOW));
    expect(json.exportVersion).toBe(2);
    expect(Object.keys(json)).toEqual(['exportVersion', 'exportedAt', 'state']);
    expect(json).not.toHaveProperty('atlas');
    expect(json.state.dreamAtlas).toEqual(current.dreamAtlas);
    expect(JSON.stringify(json.state.dreamAtlas)).not.toMatch(/nodes|transcript|title/i);

    const csv = exportLucidTrainerCsv(current);
    const rows = csv.trimEnd().split('\r\n');
    expect(rows[0]).toContain('"record_type"');
    const atlasRows = rows.filter((row) =>
      row.startsWith('"atlas_rename"') ||
      row.startsWith('"atlas_hide"') ||
      row.startsWith('"atlas_merge"') ||
      row.startsWith('"atlas_delete"')
    );
    expect(atlasRows).toEqual([
      '"atlas_rename","sign:marie","","","","","","","","","","{""label"":""Marie au miroir""}"',
      '"atlas_rename","sign:miroir","","","","","","","","","","{""label"":""\'=Mirror""}"',
      '"atlas_hide","sign:escalier","","","","","","","","","",""',
      '"atlas_hide","sign:miroir","","","","","","","","","",""',
      '"atlas_merge","sign:peur","","","","","","","","","","{""intoId"":""sign:marie""}"',
      '"atlas_merge","sign:visage","","","","","","","","","","{""intoId"":""sign:marie""}"',
      '"atlas_delete","sign:escalier","","","","","","","","","",""',
      '"atlas_delete","sign:horloge","","","","","","","","","",""',
    ]);
    expect(csv).toContain('"\'=Mirror"');
    expect(csv).not.toMatch(/transcript|nodes/i);

    const legacy = state();
    delete (legacy as { dreamAtlas?: unknown }).dreamAtlas;
    expect(exportLucidTrainerCsv(legacy)).not.toMatch(/atlas_rename|atlas_hide|atlas_merge|atlas_delete/);
  });

  it('clears trainer and companion feature keys without touching other data', async () => {
    const keys = getLucidTrainerStorageKeys(SCOPE);
    const healthKitKey = getLucidHealthKitStorageKey(SCOPE);
    const rehearsalKey = getLucidDreamRehearsalStorageKey(SCOPE);
    const atlasKey = getLucidDreamAtlasStorageKey(SCOPE);
    const stabilizationKey = getLucidStabilizationLabStorageKey(SCOPE);
    const ssildKey = getLucidSsildSensoryLabStorageKey(SCOPE);
    const storage = memoryStorage({
      [keys.state]: JSON.stringify(state()),
      [keys.syncQueue]: JSON.stringify([mutation()]),
      [healthKitKey]: JSON.stringify({ status: 'imported' }),
      [rehearsalKey]: JSON.stringify({ currentSession: { status: 'completed' } }),
      [atlasKey]: JSON.stringify({ grouping: 'advanced' }),
      [stabilizationKey]: JSON.stringify({ sessions: [{ status: 'completed' }] }),
      [ssildKey]: JSON.stringify({ currentSession: { status: 'completed' } }),
      unrelated: 'keep',
    });
    const cancelReminders = jest.fn(async () => undefined);

    await clearLucidTrainerLocalData(SCOPE, storage, cancelReminders);

    expect(cancelReminders).toHaveBeenCalledTimes(1);
    expect(storage.values.has(keys.state)).toBe(false);
    expect(storage.values.has(keys.syncQueue)).toBe(false);
    expect(storage.values.has(healthKitKey)).toBe(false);
    expect(storage.values.has(rehearsalKey)).toBe(false);
    expect(storage.values.has(atlasKey)).toBe(false);
    expect(storage.values.has(stabilizationKey)).toBe(false);
    expect(storage.values.has(ssildKey)).toBe(false);
    expect(storage.values.get('unrelated')).toBe('keep');
  });

  it('still removes sensitive local data when OS reminder cleanup fails', async () => {
    const keys = getLucidTrainerStorageKeys(SCOPE);
    const healthKitKey = getLucidHealthKitStorageKey(SCOPE);
    const rehearsalKey = getLucidDreamRehearsalStorageKey(SCOPE);
    const atlasKey = getLucidDreamAtlasStorageKey(SCOPE);
    const stabilizationKey = getLucidStabilizationLabStorageKey(SCOPE);
    const ssildKey = getLucidSsildSensoryLabStorageKey(SCOPE);
    const storage = memoryStorage({
      [keys.state]: JSON.stringify(state()),
      [keys.syncQueue]: JSON.stringify([mutation()]),
      [healthKitKey]: JSON.stringify({ status: 'imported' }),
      [rehearsalKey]: JSON.stringify({ currentSession: { status: 'completed' } }),
      [atlasKey]: JSON.stringify({ grouping: 'advanced' }),
      [stabilizationKey]: JSON.stringify({ sessions: [{ status: 'completed' }] }),
      [ssildKey]: JSON.stringify({ currentSession: { status: 'completed' } }),
    });

    await expect(
      clearLucidTrainerLocalData(SCOPE, storage, async () => {
        throw new Error('notification API unavailable');
      })
    ).rejects.toThrow('notification API unavailable');
    expect(storage.values.has(keys.state)).toBe(false);
    expect(storage.values.has(keys.syncQueue)).toBe(false);
    expect(storage.values.has(healthKitKey)).toBe(false);
    expect(storage.values.has(rehearsalKey)).toBe(false);
    expect(storage.values.has(atlasKey)).toBe(false);
    expect(storage.values.has(stabilizationKey)).toBe(false);
    expect(storage.values.has(ssildKey)).toBe(false);
  });
});
