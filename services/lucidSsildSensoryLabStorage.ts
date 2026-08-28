import Storage from 'expo-sqlite/kv-store';

import {
  LUCID_SSILD_SENSORY_LAB_VERSION,
  isLucidSsildSensoryLabSession,
  parseLucidSsildSensoryLabSession,
  type LucidSsildSensoryLabSession,
} from '@/lib/lucid/ssildSensoryLab';
import {
  isLucidTrainerEncryptedValueError,
  isLucidTrainerStorageCapacityError,
  protectLucidTrainerStoredValue,
  revealLucidTrainerStoredValue,
} from '@/services/lucidTrainerSecureStorage';

const STORAGE_NAMESPACE = 'noctalia_lucid_ssild_sensory_lab';
const STATE_KEY_VERSION = 'state_v1';
export const LUCID_SSILD_SENSORY_LAB_STORE_VERSION = 1 as const;
const ENVELOPE_KEYS = ['version', 'userScope', 'currentSession'] as const;
const EXPORT_KEYS = ['version', 'userScope', 'currentSession'] as const;
const MAX_SCOPE_LENGTH = 256;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

type AsyncKeyValueStorage = Pick<typeof Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type LucidSsildSensoryLabStoredEnvelope = {
  version: typeof LUCID_SSILD_SENSORY_LAB_STORE_VERSION;
  userScope: string;
  currentSession: LucidSsildSensoryLabSession | null;
};

export type LucidSsildSensoryLabExport = {
  version: typeof LUCID_SSILD_SENSORY_LAB_STORE_VERSION;
  userScope: string;
  currentSession: LucidSsildSensoryLabSession | null;
};

export const LUCID_SSILD_SENSORY_LAB_STORAGE_ERROR_REASONS = [
  'invalid_scope',
  'invalid_metadata',
  'persistence_failed',
  'storage_full',
] as const;
export type LucidSsildSensoryLabStorageErrorReason =
  (typeof LUCID_SSILD_SENSORY_LAB_STORAGE_ERROR_REASONS)[number];

export class LucidSsildSensoryLabStorageError extends Error {
  readonly reason: LucidSsildSensoryLabStorageErrorReason;

  constructor(reason: LucidSsildSensoryLabStorageErrorReason, message?: string) {
    super(message ?? reason);
    this.name = 'LucidSsildSensoryLabStorageError';
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
    (value === 'guest' || /^user:[A-Za-z0-9._:-]+$/.test(value))
  );
}

function assertScope(userScope: string): string {
  if (!isUserScope(userScope)) {
    throw new LucidSsildSensoryLabStorageError(
      'invalid_scope',
      'SSILD sensory lab user scope is invalid'
    );
  }
  return userScope;
}

function persistenceError(error: unknown): LucidSsildSensoryLabStorageError {
  if (error instanceof LucidSsildSensoryLabStorageError) return error;
  if (isLucidTrainerStorageCapacityError(error)) {
    return new LucidSsildSensoryLabStorageError('storage_full', 'Local storage is full');
  }
  const message = error instanceof Error ? error.message : String(error ?? '');
  const text = message.toLowerCase();
  if (text.includes('enospc') || text.includes('no space') || text.includes('quota')) {
    return new LucidSsildSensoryLabStorageError('storage_full', 'Local storage is full');
  }
  return new LucidSsildSensoryLabStorageError(
    'persistence_failed',
    'Local SSILD sensory-lab persistence failed'
  );
}

export function getLucidSsildSensoryLabStorageKey(userScope: string): string {
  return `${STORAGE_NAMESPACE}:${encodeURIComponent(assertScope(userScope))}:${STATE_KEY_VERSION}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: object, allowed: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === allowed.length && keys.every((key) => allowed.includes(key));
}

function cloneSession(session: LucidSsildSensoryLabSession): LucidSsildSensoryLabSession {
  const parsed = parseLucidSsildSensoryLabSession(session);
  if (!parsed) {
    throw new LucidSsildSensoryLabStorageError(
      'invalid_metadata',
      'Invalid SSILD sensory lab session'
    );
  }
  return parsed;
}

function parseCurrentSession(value: unknown): LucidSsildSensoryLabSession | null | undefined {
  if (value === null) return null;
  const parsed = parseLucidSsildSensoryLabSession(value);
  return parsed ?? undefined;
}

function parseEnvelope(
  value: unknown,
  userScope: string
): LucidSsildSensoryLabStoredEnvelope | null {
  if (!isPlainObject(value) || !hasExactKeys(value, ENVELOPE_KEYS)) return null;
  if (value.version !== LUCID_SSILD_SENSORY_LAB_STORE_VERSION) return null;
  if (value.userScope !== userScope) return null;
  const currentSession = parseCurrentSession(value.currentSession);
  if (currentSession === undefined) return null;
  return {
    version: LUCID_SSILD_SENSORY_LAB_STORE_VERSION,
    userScope,
    currentSession: currentSession ? cloneSession(currentSession) : null,
  };
}

function emptyEnvelope(userScope: string): LucidSsildSensoryLabStoredEnvelope {
  return {
    version: LUCID_SSILD_SENSORY_LAB_STORE_VERSION,
    userScope,
    currentSession: null,
  };
}

function cloneEnvelope(
  envelope: LucidSsildSensoryLabStoredEnvelope
): LucidSsildSensoryLabStoredEnvelope {
  return {
    version: LUCID_SSILD_SENSORY_LAB_STORE_VERSION,
    userScope: envelope.userScope,
    currentSession: envelope.currentSession ? cloneSession(envelope.currentSession) : null,
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
    if (error instanceof LucidSsildSensoryLabStorageError) throw error;
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

export function countLucidSsildSensoryLabScopeLocksForTests(): number {
  return scopeLocks.size;
}

async function loadEnvelope(
  userScope: string,
  storage: AsyncKeyValueStorage
): Promise<LucidSsildSensoryLabStoredEnvelope> {
  const key = getLucidSsildSensoryLabStorageKey(userScope);
  const plaintext = await readPlaintext(key, storage);
  if (!plaintext) return emptyEnvelope(userScope);
  try {
    const parsed = parseEnvelope(JSON.parse(plaintext) as unknown, userScope);
    if (parsed) return parsed;
  } catch (error) {
    if (error instanceof LucidSsildSensoryLabStorageError) throw error;
  }
  try {
    await storage.removeItem(key);
  } catch (error) {
    throw persistenceError(error);
  }
  return emptyEnvelope(userScope);
}

async function saveEnvelope(
  envelope: LucidSsildSensoryLabStoredEnvelope,
  storage: AsyncKeyValueStorage
): Promise<void> {
  const unique = parseEnvelope(envelope, envelope.userScope);
  if (!unique) {
    throw new LucidSsildSensoryLabStorageError(
      'invalid_metadata',
      'Invalid local SSILD sensory-lab envelope'
    );
  }
  await writePlaintext(
    getLucidSsildSensoryLabStorageKey(envelope.userScope),
    JSON.stringify(unique),
    storage
  );
}

export async function loadLucidSsildSensoryLabState(
  userScope: string,
  storage: AsyncKeyValueStorage = Storage
): Promise<LucidSsildSensoryLabStoredEnvelope> {
  return withScopeLock(assertScope(userScope), async () => {
    return cloneEnvelope(await loadEnvelope(userScope, storage));
  });
}

export async function loadLucidSsildSensoryLabCurrentSession(
  userScope: string,
  storage: AsyncKeyValueStorage = Storage
): Promise<LucidSsildSensoryLabSession | null> {
  const state = await loadLucidSsildSensoryLabState(userScope, storage);
  return state.currentSession;
}

export async function saveLucidSsildSensoryLabCurrentSession(
  userScope: string,
  session: LucidSsildSensoryLabSession,
  storage: AsyncKeyValueStorage = Storage
): Promise<LucidSsildSensoryLabSession> {
  return withScopeLock(assertScope(userScope), async () => {
    if (!isLucidSsildSensoryLabSession(session)) {
      throw new LucidSsildSensoryLabStorageError(
        'invalid_metadata',
        'Invalid SSILD sensory lab session'
      );
    }
    const nextSession = cloneSession(session);
    await saveEnvelope(
      {
        version: LUCID_SSILD_SENSORY_LAB_STORE_VERSION,
        userScope,
        currentSession: nextSession,
      },
      storage
    );
    return cloneSession(nextSession);
  });
}

export async function updateLucidSsildSensoryLabCurrentSession(
  userScope: string,
  updater: (
    current: LucidSsildSensoryLabSession | null
  ) => LucidSsildSensoryLabSession | null | Promise<LucidSsildSensoryLabSession | null>,
  storage: AsyncKeyValueStorage = Storage
): Promise<LucidSsildSensoryLabSession | null> {
  return withScopeLock(assertScope(userScope), async () => {
    const current = (await loadEnvelope(userScope, storage)).currentSession;
    const updated = await updater(current ? cloneSession(current) : null);
    if (updated === null) {
      await saveEnvelope(emptyEnvelope(userScope), storage);
      return null;
    }
    if (!isLucidSsildSensoryLabSession(updated)) {
      throw new LucidSsildSensoryLabStorageError(
        'invalid_metadata',
        'Invalid SSILD sensory lab session'
      );
    }
    const nextSession = cloneSession(updated);
    await saveEnvelope(
      {
        version: LUCID_SSILD_SENSORY_LAB_STORE_VERSION,
        userScope,
        currentSession: nextSession,
      },
      storage
    );
    return cloneSession(nextSession);
  });
}

export async function clearLucidSsildSensoryLabCurrentSession(
  userScope: string,
  storage: AsyncKeyValueStorage = Storage
): Promise<void> {
  return withScopeLock(assertScope(userScope), async () => {
    try {
      await storage.removeItem(getLucidSsildSensoryLabStorageKey(userScope));
    } catch (error) {
      throw persistenceError(error);
    }
  });
}

export async function exportLucidSsildSensoryLabState(
  userScope: string,
  storage: AsyncKeyValueStorage = Storage
): Promise<LucidSsildSensoryLabExport> {
  const state = await loadLucidSsildSensoryLabState(userScope, storage);
  return {
    version: LUCID_SSILD_SENSORY_LAB_STORE_VERSION,
    userScope,
    currentSession: state.currentSession,
  };
}

export async function importLucidSsildSensoryLabState(
  userScope: string,
  payload: unknown,
  storage: AsyncKeyValueStorage = Storage
): Promise<LucidSsildSensoryLabSession | null> {
  return withScopeLock(assertScope(userScope), async () => {
    if (!isPlainObject(payload) || !hasExactKeys(payload, EXPORT_KEYS)) {
      throw new LucidSsildSensoryLabStorageError(
        'invalid_metadata',
        'SSILD sensory lab import payload is invalid'
      );
    }
    if (payload.version !== LUCID_SSILD_SENSORY_LAB_STORE_VERSION) {
      throw new LucidSsildSensoryLabStorageError(
        'invalid_metadata',
        'SSILD sensory lab import version is unknown'
      );
    }
    if (payload.userScope !== userScope) {
      throw new LucidSsildSensoryLabStorageError(
        'invalid_metadata',
        'SSILD sensory lab import scope does not match'
      );
    }
    const envelope = parseEnvelope(payload, userScope);
    if (!envelope) {
      throw new LucidSsildSensoryLabStorageError(
        'invalid_metadata',
        'SSILD sensory lab import payload is invalid'
      );
    }
    await saveEnvelope(envelope, storage);
    return envelope.currentSession ? cloneSession(envelope.currentSession) : null;
  });
}

export function assertLucidSsildSensoryLabStoreContract(): void {
  if (LUCID_SSILD_SENSORY_LAB_STORE_VERSION !== LUCID_SSILD_SENSORY_LAB_VERSION) {
    throw new Error('SSILD sensory lab store version must stay aligned with the domain');
  }
}
