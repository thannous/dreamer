import {
  LUCID_SSILD_SENSORY_LAB_VERSION,
  isLucidSsildSensoryLabSession,
  parseLucidSsildSensoryLabSession,
  type LucidSsildSensoryLabSession,
} from '@/lib/lucid/ssildSensoryLab';
import { getLucidKeyValueStorage, type LucidKeyValueStorage } from '@/services/lucidKeyValueStorage';
import {
  createLucidPracticeStore,
  hasPracticeEnvelopeKeys,
  type LucidPracticeStorageErrorReason,
} from '@/services/lucidPracticeStore';

export const LUCID_SSILD_SENSORY_LAB_STORE_VERSION = 1 as const satisfies typeof LUCID_SSILD_SENSORY_LAB_VERSION;
const ENVELOPE_KEYS = ['version', 'userScope', 'currentSession'] as const;

export type LucidSsildSensoryLabStoredEnvelope = {
  version: typeof LUCID_SSILD_SENSORY_LAB_STORE_VERSION;
  userScope: string;
  currentSession: LucidSsildSensoryLabSession | null;
};

export type LucidSsildSensoryLabExport = LucidSsildSensoryLabStoredEnvelope;
export type LucidSsildSensoryLabStorageErrorReason = LucidPracticeStorageErrorReason;

export class LucidSsildSensoryLabStorageError extends Error {
  readonly reason: LucidSsildSensoryLabStorageErrorReason;

  constructor(reason: LucidSsildSensoryLabStorageErrorReason, message?: string) {
    super(message ?? reason);
    this.name = 'LucidSsildSensoryLabStorageError';
    this.reason = reason;
  }
}

const store = createLucidPracticeStore({
  namespace: 'noctalia_lucid_ssild_sensory_lab',
  suffix: 'state_v1',
  practice: 'SSILD sensory lab',
  storageLabel: 'SSILD sensory-lab',
  ErrorType: LucidSsildSensoryLabStorageError,
  version: LUCID_SSILD_SENSORY_LAB_STORE_VERSION,
  keys: ENVELOPE_KEYS,
  parse: parseEnvelope,
  empty: emptyEnvelope,
});

export const getLucidSsildSensoryLabStorageKey = store.storageKey;
export const countLucidSsildSensoryLabScopeLocksForTests = store.countScopeLocks;

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
  if (!hasPracticeEnvelopeKeys(value, ENVELOPE_KEYS)) return null;
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

export async function loadLucidSsildSensoryLabState(
  userScope: string,
  storage: LucidKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidSsildSensoryLabStoredEnvelope> {
  return store.run(userScope, storage, async (transaction) => {
    return cloneEnvelope(await transaction.load());
  });
}

export async function loadLucidSsildSensoryLabCurrentSession(
  userScope: string,
  storage: LucidKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidSsildSensoryLabSession | null> {
  const state = await loadLucidSsildSensoryLabState(userScope, storage);
  return state.currentSession;
}

export async function saveLucidSsildSensoryLabCurrentSession(
  userScope: string,
  session: LucidSsildSensoryLabSession,
  storage: LucidKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidSsildSensoryLabSession> {
  return store.run(userScope, storage, async (transaction) => {
    if (!isLucidSsildSensoryLabSession(session)) {
      throw new LucidSsildSensoryLabStorageError(
        'invalid_metadata',
        'Invalid SSILD sensory lab session'
      );
    }
    const nextSession = cloneSession(session);
    await transaction.save({
      version: LUCID_SSILD_SENSORY_LAB_STORE_VERSION,
      userScope,
      currentSession: nextSession,
    });
    return cloneSession(nextSession);
  });
}

export async function updateLucidSsildSensoryLabCurrentSession(
  userScope: string,
  updater: (
    current: LucidSsildSensoryLabSession | null
  ) => LucidSsildSensoryLabSession | null | Promise<LucidSsildSensoryLabSession | null>,
  storage: LucidKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidSsildSensoryLabSession | null> {
  return store.run(userScope, storage, async (transaction) => {
    const current = (await transaction.load()).currentSession;
    const updated = await updater(current ? cloneSession(current) : null);
    if (updated === null) {
      await transaction.save(emptyEnvelope(userScope));
      return null;
    }
    if (!isLucidSsildSensoryLabSession(updated)) {
      throw new LucidSsildSensoryLabStorageError(
        'invalid_metadata',
        'Invalid SSILD sensory lab session'
      );
    }
    const nextSession = cloneSession(updated);
    await transaction.save({
      version: LUCID_SSILD_SENSORY_LAB_STORE_VERSION,
      userScope,
      currentSession: nextSession,
    });
    return cloneSession(nextSession);
  });
}

export async function clearLucidSsildSensoryLabCurrentSession(
  userScope: string,
  storage: LucidKeyValueStorage = getLucidKeyValueStorage()
): Promise<void> {
  return store.run(userScope, storage, ({ clear }) => clear());
}

export const exportLucidSsildSensoryLabState = loadLucidSsildSensoryLabState;

export async function importLucidSsildSensoryLabState(
  userScope: string,
  payload: unknown,
  storage: LucidKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidSsildSensoryLabSession | null> {
  const envelope = await store.importEnvelope(userScope, payload, storage);
  return envelope.currentSession;
}
