import Storage from 'expo-sqlite/kv-store';

import {
  LUCID_DREAM_ATLAS_VERSION,
  createEmptyLucidDreamAtlasPreferences,
  isStrictLucidDreamAtlasPreferences,
  normalizeLucidDreamAtlasPreferences,
  serializeLucidDreamAtlasPreferences,
  type LucidDreamAtlasExport,
  type LucidDreamAtlasPreferences,
} from '@/lib/lucid/dreamAtlas';
import {
  isLucidTrainerEncryptedValueError,
  isLucidTrainerStorageCapacityError,
  protectLucidTrainerStoredValue,
  revealLucidTrainerStoredValue,
} from '@/services/lucidTrainerSecureStorage';

const STORAGE_NAMESPACE = 'noctalia_lucid_dream_atlas';
const PREFERENCES_KEY_VERSION = 'prefs_v1';
export const LUCID_DREAM_ATLAS_STORE_VERSION = 1 as const;
const ENVELOPE_KEYS = ['version', 'userScope', 'preferences'] as const;
const MAX_SCOPE_LENGTH = 256;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

type AsyncKeyValueStorage = Pick<typeof Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type LucidDreamAtlasStoredEnvelope = {
  version: typeof LUCID_DREAM_ATLAS_STORE_VERSION;
  userScope: string;
  preferences: LucidDreamAtlasPreferences;
};

export const LUCID_DREAM_ATLAS_STORAGE_ERROR_REASONS = [
  'invalid_scope',
  'invalid_metadata',
  'persistence_failed',
  'storage_full',
] as const;
export type LucidDreamAtlasStorageErrorReason =
  (typeof LUCID_DREAM_ATLAS_STORAGE_ERROR_REASONS)[number];

export class LucidDreamAtlasStorageError extends Error {
  readonly reason: LucidDreamAtlasStorageErrorReason;

  constructor(reason: LucidDreamAtlasStorageErrorReason, message?: string) {
    super(message ?? reason);
    this.name = 'LucidDreamAtlasStorageError';
    this.reason = reason;
  }
}

const scopeLocks = new Map<string, Promise<void>>();

function usesNativeStorage(storage: AsyncKeyValueStorage): boolean {
  return storage === Storage;
}

function isUserScope(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim() === value &&
    value.length > 0 &&
    value.length <= MAX_SCOPE_LENGTH &&
    !CONTROL_CHARS.test(value) &&
    (value === 'guest' || /^user:.+$/.test(value))
  );
}

function assertScope(userScope: string): string {
  if (!isUserScope(userScope)) {
    throw new LucidDreamAtlasStorageError('invalid_scope', 'Dream atlas user scope is invalid');
  }
  return userScope;
}

function persistenceError(error: unknown): LucidDreamAtlasStorageError {
  if (error instanceof LucidDreamAtlasStorageError) return error;
  if (isLucidTrainerStorageCapacityError(error)) {
    return new LucidDreamAtlasStorageError('storage_full', 'Local storage is full');
  }
  const message = error instanceof Error ? error.message : String(error ?? '');
  const text = message.toLowerCase();
  if (text.includes('enospc') || text.includes('no space') || text.includes('quota')) {
    return new LucidDreamAtlasStorageError('storage_full', 'Local storage is full');
  }
  return new LucidDreamAtlasStorageError('persistence_failed', 'Local dream-atlas persistence failed');
}

export function getLucidDreamAtlasStorageKey(userScope: string): string {
  return `${STORAGE_NAMESPACE}:${encodeURIComponent(assertScope(userScope))}:${PREFERENCES_KEY_VERSION}`;
}

function hasExactKeys(value: object, allowed: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === allowed.length && keys.every((key) => allowed.includes(key));
}

function clonePreferences(preferences: LucidDreamAtlasPreferences): LucidDreamAtlasPreferences {
  return {
    version: LUCID_DREAM_ATLAS_VERSION,
    renamed: { ...preferences.renamed },
    hidden: [...preferences.hidden],
    merges: { ...preferences.merges },
    deleted: [...preferences.deleted],
  };
}

function emptyPreferences(): LucidDreamAtlasPreferences {
  return clonePreferences(createEmptyLucidDreamAtlasPreferences());
}

function parseEnvelope(value: unknown, userScope: string): LucidDreamAtlasStoredEnvelope | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (!hasExactKeys(value, ENVELOPE_KEYS)) return null;
  const envelope = value as LucidDreamAtlasStoredEnvelope;
  if (envelope.version !== LUCID_DREAM_ATLAS_STORE_VERSION) return null;
  if (envelope.userScope !== userScope) return null;
  if (!isStrictLucidDreamAtlasPreferences(envelope.preferences)) return null;
  return {
    version: LUCID_DREAM_ATLAS_STORE_VERSION,
    userScope,
    preferences: clonePreferences(normalizeLucidDreamAtlasPreferences(envelope.preferences)),
  };
}

async function readPlaintext(key: string, storage: AsyncKeyValueStorage): Promise<string | null> {
  try {
    const value = await storage.getItem(key);
    if (!value) return null;
    if (!usesNativeStorage(storage)) return value;
    try {
      return await revealLucidTrainerStoredValue(key, value);
    } catch (error) {
      if (isLucidTrainerEncryptedValueError(error)) {
        await storage.removeItem(key).catch(() => undefined);
        return null;
      }
      throw persistenceError(error);
    }
  } catch (error) {
    if (error instanceof LucidDreamAtlasStorageError) throw error;
    throw persistenceError(error);
  }
}

async function writePlaintext(
  key: string,
  value: string,
  storage: AsyncKeyValueStorage
): Promise<void> {
  try {
    const protectedValue = usesNativeStorage(storage)
      ? await protectLucidTrainerStoredValue(key, value)
      : value;
    await storage.setItem(key, protectedValue);
  } catch (error) {
    throw persistenceError(error);
  }
}

async function withScopeLock<T>(userScope: string, work: () => Promise<T>): Promise<T> {
  const previous = scopeLocks.get(userScope) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  scopeLocks.set(userScope, tail);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (scopeLocks.get(userScope) === tail) scopeLocks.delete(userScope);
  }
}

export function countLucidDreamAtlasScopeLocksForTests(): number {
  return scopeLocks.size;
}

async function loadEnvelope(
  userScope: string,
  storage: AsyncKeyValueStorage
): Promise<LucidDreamAtlasStoredEnvelope> {
  const key = getLucidDreamAtlasStorageKey(userScope);
  const plaintext = await readPlaintext(key, storage);
  if (!plaintext) {
    return { version: LUCID_DREAM_ATLAS_STORE_VERSION, userScope, preferences: emptyPreferences() };
  }
  try {
    const parsed = parseEnvelope(JSON.parse(plaintext) as unknown, userScope);
    if (parsed) return parsed;
  } catch (error) {
    if (error instanceof LucidDreamAtlasStorageError) throw error;
  }
  try {
    await storage.removeItem(key);
  } catch (error) {
    throw persistenceError(error);
  }
  return { version: LUCID_DREAM_ATLAS_STORE_VERSION, userScope, preferences: emptyPreferences() };
}

async function saveEnvelope(
  envelope: LucidDreamAtlasStoredEnvelope,
  storage: AsyncKeyValueStorage
): Promise<void> {
  const unique = parseEnvelope(envelope, envelope.userScope);
  if (!unique) {
    throw new LucidDreamAtlasStorageError('invalid_metadata', 'Invalid local dream-atlas envelope');
  }
  await writePlaintext(
    getLucidDreamAtlasStorageKey(envelope.userScope),
    JSON.stringify(unique),
    storage
  );
}

export async function loadLucidDreamAtlasPreferences(
  userScope: string,
  storage: AsyncKeyValueStorage = Storage
): Promise<LucidDreamAtlasPreferences> {
  return withScopeLock(assertScope(userScope), async () => {
    const envelope = await loadEnvelope(userScope, storage);
    return clonePreferences(envelope.preferences);
  });
}

export async function saveLucidDreamAtlasPreferences(
  userScope: string,
  preferences: LucidDreamAtlasPreferences,
  storage: AsyncKeyValueStorage = Storage
): Promise<LucidDreamAtlasPreferences> {
  return withScopeLock(assertScope(userScope), async () => {
    const next = clonePreferences(normalizeLucidDreamAtlasPreferences(preferences));
    await saveEnvelope(
      { version: LUCID_DREAM_ATLAS_STORE_VERSION, userScope, preferences: next },
      storage
    );
    return clonePreferences(next);
  });
}

export async function updateLucidDreamAtlasPreferences(
  userScope: string,
  updater: (current: LucidDreamAtlasPreferences) => LucidDreamAtlasPreferences | Promise<LucidDreamAtlasPreferences>,
  storage: AsyncKeyValueStorage = Storage
): Promise<LucidDreamAtlasPreferences> {
  return withScopeLock(assertScope(userScope), async () => {
    const current = clonePreferences((await loadEnvelope(userScope, storage)).preferences);
    const next = clonePreferences(normalizeLucidDreamAtlasPreferences(await updater(current)));
    await saveEnvelope(
      { version: LUCID_DREAM_ATLAS_STORE_VERSION, userScope, preferences: next },
      storage
    );
    return clonePreferences(next);
  });
}

export async function clearLucidDreamAtlasPreferences(
  userScope: string,
  storage: AsyncKeyValueStorage = Storage
): Promise<void> {
  return withScopeLock(assertScope(userScope), async () => {
    try {
      await storage.removeItem(getLucidDreamAtlasStorageKey(userScope));
    } catch (error) {
      throw persistenceError(error);
    }
  });
}

export async function exportLucidDreamAtlasPreferences(
  userScope: string,
  storage: AsyncKeyValueStorage = Storage
): Promise<LucidDreamAtlasExport> {
  const preferences = await loadLucidDreamAtlasPreferences(userScope, storage);
  return serializeLucidDreamAtlasPreferences(preferences);
}

export async function importLucidDreamAtlasPreferences(
  userScope: string,
  payload: unknown,
  storage: AsyncKeyValueStorage = Storage
): Promise<LucidDreamAtlasPreferences> {
  return withScopeLock(assertScope(userScope), async () => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new LucidDreamAtlasStorageError('invalid_metadata', 'Dream atlas import payload is invalid');
    }
    const value = payload as Record<string, unknown>;
    if (!hasExactKeys(value, ['version', 'preferences'])) {
      throw new LucidDreamAtlasStorageError('invalid_metadata', 'Dream atlas import payload is invalid');
    }
    if (value.version !== LUCID_DREAM_ATLAS_VERSION) {
      throw new LucidDreamAtlasStorageError('invalid_metadata', 'Dream atlas import version is unknown');
    }
    if (!isStrictLucidDreamAtlasPreferences(value.preferences)) {
      throw new LucidDreamAtlasStorageError('invalid_metadata', 'Dream atlas import payload is invalid');
    }
    const next = clonePreferences(normalizeLucidDreamAtlasPreferences(value.preferences));
    await saveEnvelope(
      { version: LUCID_DREAM_ATLAS_STORE_VERSION, userScope, preferences: next },
      storage
    );
    return clonePreferences(next);
  });
}
