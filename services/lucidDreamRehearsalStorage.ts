import {
  getLucidKeyValueStorage,
  isLucidNativeKeyValueStorage,
  type LucidKeyValueStorage,
} from '@/services/lucidKeyValueStorage';

import {
  LUCID_DREAM_REHEARSAL_VERSION,
  isLucidDreamRehearsalCompletion,
  isLucidDreamRehearsalSession,
  parseLucidDreamRehearsalCompletion,
  parseLucidDreamRehearsalSession,
  projectLucidDreamRehearsalCompletion,
  type LucidDreamRehearsalCompletion,
  type LucidDreamRehearsalSession,
} from '@/lib/lucid/dreamRehearsal';
import {
  isLucidTrainerEncryptedValueError,
  isLucidTrainerStorageCapacityError,
  protectLucidTrainerStoredValue,
  revealLucidTrainerStoredValue,
} from '@/services/lucidTrainerSecureStorage';

const STORAGE_NAMESPACE = 'noctalia_lucid_dream_rehearsal';
const STATE_KEY_VERSION = 'state_v1';
export const LUCID_DREAM_REHEARSAL_STORE_VERSION = 1 as const;
export const LUCID_DREAM_REHEARSAL_MAX_STORED_COMPLETIONS = 500 as const;
const ENVELOPE_KEYS = ['version', 'userScope', 'currentSession', 'completions'] as const;
const EXPORT_KEYS = ['version', 'userScope', 'currentSession', 'completions'] as const;
const MAX_SCOPE_LENGTH = 256;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

type AsyncKeyValueStorage = LucidKeyValueStorage;

export type LucidDreamRehearsalStoredEnvelope = {
  version: typeof LUCID_DREAM_REHEARSAL_STORE_VERSION;
  userScope: string;
  currentSession: LucidDreamRehearsalSession | null;
  completions: LucidDreamRehearsalCompletion[];
};

export type LucidDreamRehearsalExport = {
  version: typeof LUCID_DREAM_REHEARSAL_STORE_VERSION;
  userScope: string;
  currentSession: LucidDreamRehearsalSession | null;
  completions: LucidDreamRehearsalCompletion[];
};

export const LUCID_DREAM_REHEARSAL_STORAGE_ERROR_REASONS = [
  'invalid_scope',
  'invalid_metadata',
  'persistence_failed',
  'storage_full',
] as const;
export type LucidDreamRehearsalStorageErrorReason =
  (typeof LUCID_DREAM_REHEARSAL_STORAGE_ERROR_REASONS)[number];

export class LucidDreamRehearsalStorageError extends Error {
  readonly reason: LucidDreamRehearsalStorageErrorReason;

  constructor(reason: LucidDreamRehearsalStorageErrorReason, message?: string) {
    super(message ?? reason);
    this.name = 'LucidDreamRehearsalStorageError';
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
    throw new LucidDreamRehearsalStorageError(
      'invalid_scope',
      'Dream rehearsal user scope is invalid'
    );
  }
  return userScope;
}

function persistenceError(error: unknown): LucidDreamRehearsalStorageError {
  if (error instanceof LucidDreamRehearsalStorageError) return error;
  if (isLucidTrainerStorageCapacityError(error)) {
    return new LucidDreamRehearsalStorageError('storage_full', 'Local storage is full');
  }
  const message = error instanceof Error ? error.message : String(error ?? '');
  const text = message.toLowerCase();
  if (text.includes('enospc') || text.includes('no space') || text.includes('quota')) {
    return new LucidDreamRehearsalStorageError('storage_full', 'Local storage is full');
  }
  return new LucidDreamRehearsalStorageError(
    'persistence_failed',
    'Local dream-rehearsal persistence failed'
  );
}

export function getLucidDreamRehearsalStorageKey(userScope: string): string {
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

function cloneSession(session: LucidDreamRehearsalSession): LucidDreamRehearsalSession {
  const parsed = parseLucidDreamRehearsalSession(session);
  if (!parsed) {
    throw new LucidDreamRehearsalStorageError(
      'invalid_metadata',
      'Invalid dream rehearsal session'
    );
  }
  return parsed;
}

function cloneCompletion(
  completion: LucidDreamRehearsalCompletion
): LucidDreamRehearsalCompletion {
  const parsed = parseLucidDreamRehearsalCompletion(completion);
  if (!parsed) {
    throw new LucidDreamRehearsalStorageError(
      'invalid_metadata',
      'Invalid dream rehearsal completion'
    );
  }
  return parsed;
}

function parseCurrentSession(value: unknown): LucidDreamRehearsalSession | null | undefined {
  if (value === null) return null;
  const parsed = parseLucidDreamRehearsalSession(value);
  return parsed ?? undefined;
}

function compareSessionIds(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function compareStoredCompletions(
  left: LucidDreamRehearsalCompletion,
  right: LucidDreamRehearsalCompletion
): number {
  if (left.completedAt !== right.completedAt) return right.completedAt - left.completedAt;
  return compareSessionIds(left.sessionId, right.sessionId);
}

function chooseNewestCompletion(
  left: LucidDreamRehearsalCompletion,
  right: LucidDreamRehearsalCompletion
): LucidDreamRehearsalCompletion {
  if (left.completedAt !== right.completedAt) {
    return left.completedAt > right.completedAt ? left : right;
  }
  const leftJson = JSON.stringify(left);
  const rightJson = JSON.stringify(right);
  return leftJson >= rightJson ? left : right;
}

function collectUniqueCompletions(
  completions: readonly unknown[]
): LucidDreamRehearsalCompletion[] | null {
  if (!Array.isArray(completions)) return null;
  const byId = new Map<string, LucidDreamRehearsalCompletion>();
  for (const value of completions) {
    const parsed = parseLucidDreamRehearsalCompletion(value);
    if (!parsed) return null;
    const existing = byId.get(parsed.sessionId);
    byId.set(parsed.sessionId, existing ? chooseNewestCompletion(existing, parsed) : parsed);
  }
  return [...byId.values()].sort(compareStoredCompletions).map(cloneCompletion);
}

function rankStoredCompletions(
  completions: readonly LucidDreamRehearsalCompletion[]
): LucidDreamRehearsalCompletion[] {
  return [...completions]
    .sort(compareStoredCompletions)
    .slice(0, LUCID_DREAM_REHEARSAL_MAX_STORED_COMPLETIONS)
    .map(cloneCompletion);
}

function normalizeCompletions(
  completions: readonly unknown[]
): LucidDreamRehearsalCompletion[] | null {
  if (
    !Array.isArray(completions) ||
    completions.length > LUCID_DREAM_REHEARSAL_MAX_STORED_COMPLETIONS
  ) {
    return null;
  }
  const unique = collectUniqueCompletions(completions);
  if (!unique) return null;
  return unique.slice(0, LUCID_DREAM_REHEARSAL_MAX_STORED_COMPLETIONS);
}

function parseEnvelope(
  value: unknown,
  userScope: string
): LucidDreamRehearsalStoredEnvelope | null {
  if (!isPlainObject(value) || !hasExactKeys(value, ENVELOPE_KEYS)) return null;
  if (value.version !== LUCID_DREAM_REHEARSAL_STORE_VERSION) return null;
  if (value.userScope !== userScope) return null;
  const currentSession = parseCurrentSession(value.currentSession);
  if (currentSession === undefined) return null;
  if (!Array.isArray(value.completions)) return null;
  const completions = normalizeCompletions(value.completions);
  if (!completions) return null;
  return {
    version: LUCID_DREAM_REHEARSAL_STORE_VERSION,
    userScope,
    currentSession: currentSession ? cloneSession(currentSession) : null,
    completions,
  };
}

function emptyEnvelope(userScope: string): LucidDreamRehearsalStoredEnvelope {
  return {
    version: LUCID_DREAM_REHEARSAL_STORE_VERSION,
    userScope,
    currentSession: null,
    completions: [],
  };
}

function cloneEnvelope(
  envelope: LucidDreamRehearsalStoredEnvelope
): LucidDreamRehearsalStoredEnvelope {
  return {
    version: LUCID_DREAM_REHEARSAL_STORE_VERSION,
    userScope: envelope.userScope,
    currentSession: envelope.currentSession ? cloneSession(envelope.currentSession) : null,
    completions: envelope.completions.map(cloneCompletion),
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
    if (error instanceof LucidDreamRehearsalStorageError) throw error;
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

export function countLucidDreamRehearsalScopeLocksForTests(): number {
  return scopeLocks.size;
}

async function loadEnvelope(
  userScope: string,
  storage: AsyncKeyValueStorage
): Promise<LucidDreamRehearsalStoredEnvelope> {
  const key = getLucidDreamRehearsalStorageKey(userScope);
  const plaintext = await readPlaintext(key, storage);
  if (!plaintext) return emptyEnvelope(userScope);
  try {
    const parsed = parseEnvelope(JSON.parse(plaintext) as unknown, userScope);
    if (parsed) return parsed;
  } catch (error) {
    if (error instanceof LucidDreamRehearsalStorageError) throw error;
  }
  try {
    await storage.removeItem(key);
  } catch (error) {
    throw persistenceError(error);
  }
  return emptyEnvelope(userScope);
}

async function saveEnvelope(
  envelope: LucidDreamRehearsalStoredEnvelope,
  storage: AsyncKeyValueStorage
): Promise<void> {
  const unique = parseEnvelope(envelope, envelope.userScope);
  if (!unique) {
    throw new LucidDreamRehearsalStorageError(
      'invalid_metadata',
      'Invalid local dream-rehearsal envelope'
    );
  }
  await writePlaintext(
    getLucidDreamRehearsalStorageKey(envelope.userScope),
    JSON.stringify(unique),
    storage
  );
}

function upsertIntoCompletions(
  completions: readonly LucidDreamRehearsalCompletion[],
  incoming: LucidDreamRehearsalCompletion
): LucidDreamRehearsalCompletion[] {
  const next = cloneCompletion(incoming);
  const existing = completions.find((completion) => completion.sessionId === next.sessionId);
  if (existing && existing.completedAt > next.completedAt) {
    return rankStoredCompletions(completions);
  }
  const merged = existing ? chooseNewestCompletion(existing, next) : next;
  const without = completions.filter((completion) => completion.sessionId !== merged.sessionId);
  return rankStoredCompletions([merged, ...without]);
}

function completionFromSession(
  session: LucidDreamRehearsalSession
): LucidDreamRehearsalCompletion | null {
  return projectLucidDreamRehearsalCompletion(session);
}

export async function loadLucidDreamRehearsalState(
  userScope: string,
  storage: AsyncKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidDreamRehearsalStoredEnvelope> {
  return withScopeLock(assertScope(userScope), async () => {
    return cloneEnvelope(await loadEnvelope(userScope, storage));
  });
}

export async function loadLucidDreamRehearsalCurrentSession(
  userScope: string,
  storage: AsyncKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidDreamRehearsalSession | null> {
  const state = await loadLucidDreamRehearsalState(userScope, storage);
  return state.currentSession;
}

export async function loadLucidDreamRehearsalCompletions(
  userScope: string,
  storage: AsyncKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidDreamRehearsalCompletion[]> {
  const state = await loadLucidDreamRehearsalState(userScope, storage);
  return state.completions;
}

export async function saveLucidDreamRehearsalCurrentSession(
  userScope: string,
  session: LucidDreamRehearsalSession,
  storage: AsyncKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidDreamRehearsalStoredEnvelope> {
  return withScopeLock(assertScope(userScope), async () => {
    if (!isLucidDreamRehearsalSession(session)) {
      throw new LucidDreamRehearsalStorageError(
        'invalid_metadata',
        'Invalid dream rehearsal session'
      );
    }
    const current = await loadEnvelope(userScope, storage);
    const nextSession = cloneSession(session);
    const projected = completionFromSession(nextSession);
    const completions = projected
      ? upsertIntoCompletions(current.completions, projected)
      : current.completions.map(cloneCompletion);
    const envelope: LucidDreamRehearsalStoredEnvelope = {
      version: LUCID_DREAM_REHEARSAL_STORE_VERSION,
      userScope,
      currentSession: nextSession,
      completions,
    };
    await saveEnvelope(envelope, storage);
    return cloneEnvelope(envelope);
  });
}

export async function clearLucidDreamRehearsalCurrentSession(
  userScope: string,
  storage: AsyncKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidDreamRehearsalStoredEnvelope> {
  return withScopeLock(assertScope(userScope), async () => {
    const current = await loadEnvelope(userScope, storage);
    const envelope: LucidDreamRehearsalStoredEnvelope = {
      version: LUCID_DREAM_REHEARSAL_STORE_VERSION,
      userScope,
      currentSession: null,
      completions: current.completions.map(cloneCompletion),
    };
    await saveEnvelope(envelope, storage);
    return cloneEnvelope(envelope);
  });
}

export async function upsertLucidDreamRehearsalCompletion(
  userScope: string,
  completion: LucidDreamRehearsalCompletion,
  storage: AsyncKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidDreamRehearsalCompletion[]> {
  return withScopeLock(assertScope(userScope), async () => {
    if (!isLucidDreamRehearsalCompletion(completion)) {
      throw new LucidDreamRehearsalStorageError(
        'invalid_metadata',
        'Invalid dream rehearsal completion'
      );
    }
    const current = await loadEnvelope(userScope, storage);
    const completions = upsertIntoCompletions(current.completions, completion);
    await saveEnvelope(
      {
        version: LUCID_DREAM_REHEARSAL_STORE_VERSION,
        userScope,
        currentSession: current.currentSession,
        completions,
      },
      storage
    );
    return completions.map(cloneCompletion);
  });
}

export async function updateLucidDreamRehearsalState(
  userScope: string,
  updater: (
    current: LucidDreamRehearsalStoredEnvelope
  ) =>
    | LucidDreamRehearsalStoredEnvelope
    | Promise<LucidDreamRehearsalStoredEnvelope>,
  storage: AsyncKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidDreamRehearsalStoredEnvelope> {
  return withScopeLock(assertScope(userScope), async () => {
    const current = cloneEnvelope(await loadEnvelope(userScope, storage));
    const updated = await updater(cloneEnvelope(current));
    const parsed = parseEnvelope(updated, userScope);
    if (!parsed) {
      throw new LucidDreamRehearsalStorageError(
        'invalid_metadata',
        'Invalid dream rehearsal state'
      );
    }
    await saveEnvelope(parsed, storage);
    return cloneEnvelope(parsed);
  });
}

export async function clearLucidDreamRehearsalState(
  userScope: string,
  storage: AsyncKeyValueStorage = getLucidKeyValueStorage()
): Promise<void> {
  return withScopeLock(assertScope(userScope), async () => {
    try {
      await storage.removeItem(getLucidDreamRehearsalStorageKey(userScope));
    } catch (error) {
      throw persistenceError(error);
    }
  });
}

export async function exportLucidDreamRehearsalState(
  userScope: string,
  storage: AsyncKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidDreamRehearsalExport> {
  const state = await loadLucidDreamRehearsalState(userScope, storage);
  return cloneEnvelope(state);
}

export async function importLucidDreamRehearsalState(
  userScope: string,
  payload: unknown,
  storage: AsyncKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidDreamRehearsalStoredEnvelope> {
  return withScopeLock(assertScope(userScope), async () => {
    if (!isPlainObject(payload) || !hasExactKeys(payload, EXPORT_KEYS)) {
      throw new LucidDreamRehearsalStorageError(
        'invalid_metadata',
        'Dream rehearsal import payload is invalid'
      );
    }
    if (payload.version !== LUCID_DREAM_REHEARSAL_STORE_VERSION) {
      throw new LucidDreamRehearsalStorageError(
        'invalid_metadata',
        'Dream rehearsal import version is unknown'
      );
    }
    if (payload.userScope !== userScope) {
      throw new LucidDreamRehearsalStorageError(
        'invalid_metadata',
        'Dream rehearsal import scope does not match'
      );
    }
    const parsed = parseEnvelope(payload, userScope);
    if (!parsed) {
      throw new LucidDreamRehearsalStorageError(
        'invalid_metadata',
        'Dream rehearsal import payload is invalid'
      );
    }
    await saveEnvelope(parsed, storage);
    return cloneEnvelope(parsed);
  });
}

export function assertLucidDreamRehearsalStoreContract(): void {
  if (LUCID_DREAM_REHEARSAL_STORE_VERSION !== LUCID_DREAM_REHEARSAL_VERSION) {
    throw new Error('Dream rehearsal store version must stay aligned with the domain');
  }
}
