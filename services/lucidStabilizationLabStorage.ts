import {
  getLucidKeyValueStorage,
  isLucidNativeKeyValueStorage,
  type LucidKeyValueStorage,
} from '@/services/lucidKeyValueStorage';

import {
  LUCID_STABILIZATION_LAB_VERSION,
  isLucidStabilizationLabSession,
  parseLucidStabilizationLabSession,
  type LucidStabilizationLabSession,
} from '@/lib/lucid/stabilizationLab';
import {
  isLucidTrainerEncryptedValueError,
  isLucidTrainerStorageCapacityError,
  protectLucidTrainerStoredValue,
  revealLucidTrainerStoredValue,
} from '@/services/lucidTrainerSecureStorage';

const STORAGE_NAMESPACE = 'noctalia_lucid_stabilization_lab';
const SESSIONS_KEY_VERSION = 'sessions_v1';
export const LUCID_STABILIZATION_LAB_STORE_VERSION = 1 as const;
export const LUCID_STABILIZATION_LAB_MAX_STORED_SESSIONS = 500 as const;
const ENVELOPE_KEYS = ['version', 'userScope', 'sessions'] as const;
const EXPORT_KEYS = ['version', 'userScope', 'sessions'] as const;
const MAX_SCOPE_LENGTH = 256;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

type AsyncKeyValueStorage = LucidKeyValueStorage;

export type LucidStabilizationLabStoredEnvelope = {
  version: typeof LUCID_STABILIZATION_LAB_STORE_VERSION;
  userScope: string;
  sessions: LucidStabilizationLabSession[];
};

export type LucidStabilizationLabExport = {
  version: typeof LUCID_STABILIZATION_LAB_STORE_VERSION;
  userScope: string;
  sessions: LucidStabilizationLabSession[];
};

export const LUCID_STABILIZATION_LAB_STORAGE_ERROR_REASONS = [
  'invalid_scope',
  'invalid_metadata',
  'persistence_failed',
  'storage_full',
] as const;
export type LucidStabilizationLabStorageErrorReason =
  (typeof LUCID_STABILIZATION_LAB_STORAGE_ERROR_REASONS)[number];

export class LucidStabilizationLabStorageError extends Error {
  readonly reason: LucidStabilizationLabStorageErrorReason;

  constructor(reason: LucidStabilizationLabStorageErrorReason, message?: string) {
    super(message ?? reason);
    this.name = 'LucidStabilizationLabStorageError';
    this.reason = reason;
  }
}

const scopeLocks = new Map<string, Promise<void>>();

function usesNativeStorage(storage: AsyncKeyValueStorage): boolean {
  return isLucidNativeKeyValueStorage(storage);
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
    throw new LucidStabilizationLabStorageError(
      'invalid_scope',
      'Stabilization lab user scope is invalid'
    );
  }
  return userScope;
}

function persistenceError(error: unknown): LucidStabilizationLabStorageError {
  if (error instanceof LucidStabilizationLabStorageError) return error;
  if (isLucidTrainerStorageCapacityError(error)) {
    return new LucidStabilizationLabStorageError('storage_full', 'Local storage is full');
  }
  const message = error instanceof Error ? error.message : String(error ?? '');
  const text = message.toLowerCase();
  if (text.includes('enospc') || text.includes('no space') || text.includes('quota')) {
    return new LucidStabilizationLabStorageError('storage_full', 'Local storage is full');
  }
  return new LucidStabilizationLabStorageError(
    'persistence_failed',
    'Local stabilization-lab persistence failed'
  );
}

export function getLucidStabilizationLabStorageKey(userScope: string): string {
  return `${STORAGE_NAMESPACE}:${encodeURIComponent(assertScope(userScope))}:${SESSIONS_KEY_VERSION}`;
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

function cloneSession(session: LucidStabilizationLabSession): LucidStabilizationLabSession {
  const parsed = parseLucidStabilizationLabSession(session);
  if (!parsed) {
    throw new LucidStabilizationLabStorageError(
      'invalid_metadata',
      'Invalid stabilization lab session'
    );
  }
  return parsed;
}

function compareSessionIds(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function compareStoredSessions(
  left: LucidStabilizationLabSession,
  right: LucidStabilizationLabSession
): number {
  if (left.updatedAt !== right.updatedAt) return right.updatedAt - left.updatedAt;
  return compareSessionIds(left.sessionId, right.sessionId);
}

function chooseNewestSession(
  left: LucidStabilizationLabSession,
  right: LucidStabilizationLabSession
): LucidStabilizationLabSession {
  if (left.updatedAt !== right.updatedAt) {
    return left.updatedAt > right.updatedAt ? left : right;
  }
  const leftJson = JSON.stringify(left);
  const rightJson = JSON.stringify(right);
  return leftJson >= rightJson ? left : right;
}

function collectUniqueSessions(
  sessions: readonly unknown[]
): LucidStabilizationLabSession[] | null {
  if (!Array.isArray(sessions)) return null;
  const byId = new Map<string, LucidStabilizationLabSession>();
  for (const value of sessions) {
    const parsed = parseLucidStabilizationLabSession(value);
    if (!parsed) return null;
    const existing = byId.get(parsed.sessionId);
    byId.set(parsed.sessionId, existing ? chooseNewestSession(existing, parsed) : parsed);
  }
  return [...byId.values()].sort(compareStoredSessions).map(cloneSession);
}

function rankStoredSessions(
  sessions: readonly LucidStabilizationLabSession[]
): LucidStabilizationLabSession[] {
  return [...sessions].sort(compareStoredSessions).slice(0, LUCID_STABILIZATION_LAB_MAX_STORED_SESSIONS).map(cloneSession);
}

function normalizeSessions(sessions: readonly unknown[]): LucidStabilizationLabSession[] | null {
  if (!Array.isArray(sessions) || sessions.length > LUCID_STABILIZATION_LAB_MAX_STORED_SESSIONS) {
    return null;
  }
  const unique = collectUniqueSessions(sessions);
  if (!unique) return null;
  return unique.slice(0, LUCID_STABILIZATION_LAB_MAX_STORED_SESSIONS);
}

function parseEnvelope(value: unknown, userScope: string): LucidStabilizationLabStoredEnvelope | null {
  if (!isPlainObject(value)) return null;
  if (!hasExactKeys(value, ENVELOPE_KEYS)) return null;
  const envelope = value as LucidStabilizationLabStoredEnvelope;
  if (envelope.version !== LUCID_STABILIZATION_LAB_STORE_VERSION) return null;
  if (envelope.userScope !== userScope) return null;
  const sessions = normalizeSessions(envelope.sessions);
  if (!sessions) return null;
  return {
    version: LUCID_STABILIZATION_LAB_STORE_VERSION,
    userScope,
    sessions,
  };
}

function emptyEnvelope(userScope: string): LucidStabilizationLabStoredEnvelope {
  return {
    version: LUCID_STABILIZATION_LAB_STORE_VERSION,
    userScope,
    sessions: [],
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
    if (error instanceof LucidStabilizationLabStorageError) throw error;
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

export function countLucidStabilizationLabScopeLocksForTests(): number {
  return scopeLocks.size;
}

async function loadEnvelope(
  userScope: string,
  storage: AsyncKeyValueStorage
): Promise<LucidStabilizationLabStoredEnvelope> {
  const key = getLucidStabilizationLabStorageKey(userScope);
  const plaintext = await readPlaintext(key, storage);
  if (!plaintext) return emptyEnvelope(userScope);
  try {
    const parsed = parseEnvelope(JSON.parse(plaintext) as unknown, userScope);
    if (parsed) return parsed;
  } catch (error) {
    if (error instanceof LucidStabilizationLabStorageError) throw error;
  }
  try {
    await storage.removeItem(key);
  } catch (error) {
    throw persistenceError(error);
  }
  return emptyEnvelope(userScope);
}

async function saveEnvelope(
  envelope: LucidStabilizationLabStoredEnvelope,
  storage: AsyncKeyValueStorage
): Promise<void> {
  const unique = parseEnvelope(envelope, envelope.userScope);
  if (!unique) {
    throw new LucidStabilizationLabStorageError(
      'invalid_metadata',
      'Invalid local stabilization-lab envelope'
    );
  }
  await writePlaintext(
    getLucidStabilizationLabStorageKey(envelope.userScope),
    JSON.stringify(unique),
    storage
  );
}

function upsertIntoSessions(
  sessions: readonly LucidStabilizationLabSession[],
  incoming: LucidStabilizationLabSession
): LucidStabilizationLabSession[] {
  const next = cloneSession(incoming);
  const existing = sessions.find((session) => session.sessionId === next.sessionId);
  if (existing && existing.updatedAt > next.updatedAt) {
    return rankStoredSessions(sessions);
  }
  const merged = existing ? chooseNewestSession(existing, next) : next;
  const without = sessions.filter((session) => session.sessionId !== merged.sessionId);
  return rankStoredSessions([merged, ...without]);
}

export async function loadLucidStabilizationLabSessions(
  userScope: string,
  storage: AsyncKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidStabilizationLabSession[]> {
  return withScopeLock(assertScope(userScope), async () => {
    const envelope = await loadEnvelope(userScope, storage);
    return envelope.sessions.map(cloneSession);
  });
}

export async function upsertLucidStabilizationLabSession(
  userScope: string,
  session: LucidStabilizationLabSession,
  storage: AsyncKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidStabilizationLabSession[]> {
  return withScopeLock(assertScope(userScope), async () => {
    if (!isLucidStabilizationLabSession(session)) {
      throw new LucidStabilizationLabStorageError(
        'invalid_metadata',
        'Invalid stabilization lab session'
      );
    }
    const current = await loadEnvelope(userScope, storage);
    const sessions = upsertIntoSessions(current.sessions, session);
    await saveEnvelope(
      { version: LUCID_STABILIZATION_LAB_STORE_VERSION, userScope, sessions },
      storage
    );
    return sessions.map(cloneSession);
  });
}

export async function updateLucidStabilizationLabSessions(
  userScope: string,
  updater: (
    current: LucidStabilizationLabSession[]
  ) =>
    | readonly LucidStabilizationLabSession[]
    | Promise<readonly LucidStabilizationLabSession[]>,
  storage: AsyncKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidStabilizationLabSession[]> {
  return withScopeLock(assertScope(userScope), async () => {
    const current = (await loadEnvelope(userScope, storage)).sessions.map(cloneSession);
    const updated = await updater(current.map(cloneSession));
    const sessions = normalizeSessions(updated);
    if (!sessions) {
      throw new LucidStabilizationLabStorageError(
        'invalid_metadata',
        'Invalid stabilization lab sessions'
      );
    }
    await saveEnvelope(
      { version: LUCID_STABILIZATION_LAB_STORE_VERSION, userScope, sessions },
      storage
    );
    return sessions.map(cloneSession);
  });
}

export async function clearLucidStabilizationLabSessions(
  userScope: string,
  storage: AsyncKeyValueStorage = getLucidKeyValueStorage()
): Promise<void> {
  return withScopeLock(assertScope(userScope), async () => {
    try {
      await storage.removeItem(getLucidStabilizationLabStorageKey(userScope));
    } catch (error) {
      throw persistenceError(error);
    }
  });
}

export async function exportLucidStabilizationLabSessions(
  userScope: string,
  storage: AsyncKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidStabilizationLabExport> {
  const sessions = await loadLucidStabilizationLabSessions(userScope, storage);
  return {
    version: LUCID_STABILIZATION_LAB_STORE_VERSION,
    userScope,
    sessions: sessions.map(cloneSession),
  };
}

export async function importLucidStabilizationLabSessions(
  userScope: string,
  payload: unknown,
  storage: AsyncKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidStabilizationLabSession[]> {
  return withScopeLock(assertScope(userScope), async () => {
    if (!isPlainObject(payload)) {
      throw new LucidStabilizationLabStorageError(
        'invalid_metadata',
        'Stabilization lab import payload is invalid'
      );
    }
    if (!hasExactKeys(payload, EXPORT_KEYS)) {
      throw new LucidStabilizationLabStorageError(
        'invalid_metadata',
        'Stabilization lab import payload is invalid'
      );
    }
    const value = payload as LucidStabilizationLabExport;
    if (value.version !== LUCID_STABILIZATION_LAB_STORE_VERSION) {
      throw new LucidStabilizationLabStorageError(
        'invalid_metadata',
        'Stabilization lab import version is unknown'
      );
    }
    if (value.userScope !== userScope) {
      throw new LucidStabilizationLabStorageError(
        'invalid_metadata',
        'Stabilization lab import scope does not match'
      );
    }
    const sessions = normalizeSessions(value.sessions);
    if (!sessions) {
      throw new LucidStabilizationLabStorageError(
        'invalid_metadata',
        'Stabilization lab import payload is invalid'
      );
    }
    await saveEnvelope(
      { version: LUCID_STABILIZATION_LAB_STORE_VERSION, userScope, sessions },
      storage
    );
    return sessions.map(cloneSession);
  });
}

export function assertLucidStabilizationLabStoreContract(): void {
  if (LUCID_STABILIZATION_LAB_STORE_VERSION !== LUCID_STABILIZATION_LAB_VERSION) {
    throw new Error('Stabilization lab store version must stay aligned with the domain');
  }
}
