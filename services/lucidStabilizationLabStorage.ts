import {
  LUCID_STABILIZATION_LAB_MAX_SESSIONS,
  LUCID_STABILIZATION_LAB_VERSION,
  isLucidStabilizationLabSession,
  normalizeLucidStabilizationLabSessions,
  parseLucidStabilizationLabSession,
  type LucidStabilizationLabSession,
} from '@/lib/lucid/stabilizationLab';
import { getLucidKeyValueStorage, type LucidKeyValueStorage } from '@/services/lucidKeyValueStorage';
import {
  createLucidPracticeStore,
  hasPracticeEnvelopeKeys,
  type LucidPracticeStorageErrorReason,
} from '@/services/lucidPracticeStore';

export const LUCID_STABILIZATION_LAB_STORE_VERSION = 1 as const satisfies typeof LUCID_STABILIZATION_LAB_VERSION;
export const LUCID_STABILIZATION_LAB_MAX_STORED_SESSIONS = LUCID_STABILIZATION_LAB_MAX_SESSIONS;
const ENVELOPE_KEYS = ['version', 'userScope', 'sessions'] as const;

export type LucidStabilizationLabStoredEnvelope = {
  version: typeof LUCID_STABILIZATION_LAB_STORE_VERSION;
  userScope: string;
  sessions: LucidStabilizationLabSession[];
};

export type LucidStabilizationLabExport = LucidStabilizationLabStoredEnvelope;
export type LucidStabilizationLabStorageErrorReason = LucidPracticeStorageErrorReason;

export class LucidStabilizationLabStorageError extends Error {
  readonly reason: LucidStabilizationLabStorageErrorReason;

  constructor(reason: LucidStabilizationLabStorageErrorReason, message?: string) {
    super(message ?? reason);
    this.name = 'LucidStabilizationLabStorageError';
    this.reason = reason;
  }
}

const store = createLucidPracticeStore({
  namespace: 'noctalia_lucid_stabilization_lab',
  suffix: 'sessions_v1',
  practice: 'Stabilization lab',
  storageLabel: 'stabilization-lab',
  ErrorType: LucidStabilizationLabStorageError,
  version: LUCID_STABILIZATION_LAB_STORE_VERSION,
  keys: ENVELOPE_KEYS,
  parse: parseEnvelope,
  empty: emptyEnvelope,
});

export const getLucidStabilizationLabStorageKey = store.storageKey;
export const countLucidStabilizationLabScopeLocksForTests = store.countScopeLocks;

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

function normalizeSessions(sessions: readonly unknown[]): LucidStabilizationLabSession[] | null {
  if (!Array.isArray(sessions) || sessions.length > LUCID_STABILIZATION_LAB_MAX_STORED_SESSIONS) {
    return null;
  }
  return normalizeLucidStabilizationLabSessions(sessions);
}

function parseEnvelope(value: unknown, userScope: string): LucidStabilizationLabStoredEnvelope | null {
  if (!hasPracticeEnvelopeKeys(value, ENVELOPE_KEYS)) return null;
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

export async function loadLucidStabilizationLabSessions(
  userScope: string,
  storage: LucidKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidStabilizationLabSession[]> {
  return store.run(userScope, storage, async (transaction) => {
    const envelope = await transaction.load();
    return envelope.sessions.map(cloneSession);
  });
}

export async function upsertLucidStabilizationLabSession(
  userScope: string,
  session: LucidStabilizationLabSession,
  storage: LucidKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidStabilizationLabSession[]> {
  return store.run(userScope, storage, async (transaction) => {
    if (!isLucidStabilizationLabSession(session)) {
      throw new LucidStabilizationLabStorageError(
        'invalid_metadata',
        'Invalid stabilization lab session'
      );
    }
    const current = await transaction.load();
    const sessions = normalizeLucidStabilizationLabSessions([...current.sessions, session]);
    if (!sessions) {
      throw new LucidStabilizationLabStorageError('invalid_metadata', 'Invalid stabilization lab sessions');
    }
    await transaction.save({ version: LUCID_STABILIZATION_LAB_STORE_VERSION, userScope, sessions });
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
  storage: LucidKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidStabilizationLabSession[]> {
  return store.run(userScope, storage, async (transaction) => {
    const current = await transaction.load();
    const updated = await updater(current.sessions);
    const sessions = normalizeSessions(updated);
    if (!sessions) {
      throw new LucidStabilizationLabStorageError(
        'invalid_metadata',
        'Invalid stabilization lab sessions'
      );
    }
    await transaction.save({ version: LUCID_STABILIZATION_LAB_STORE_VERSION, userScope, sessions });
    return sessions.map(cloneSession);
  });
}

export async function clearLucidStabilizationLabSessions(
  userScope: string,
  storage: LucidKeyValueStorage = getLucidKeyValueStorage()
): Promise<void> {
  return store.run(userScope, storage, ({ clear }) => clear());
}

export async function exportLucidStabilizationLabSessions(
  userScope: string,
  storage: LucidKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidStabilizationLabExport> {
  const sessions = await loadLucidStabilizationLabSessions(userScope, storage);
  return {
    version: LUCID_STABILIZATION_LAB_STORE_VERSION,
    userScope,
    sessions,
  };
}

export async function importLucidStabilizationLabSessions(
  userScope: string,
  payload: unknown,
  storage: LucidKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidStabilizationLabSession[]> {
  const envelope = await store.importEnvelope(userScope, payload, storage);
  return envelope.sessions;
}
