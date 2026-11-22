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
import { getLucidKeyValueStorage, type LucidKeyValueStorage } from '@/services/lucidKeyValueStorage';
import {
  createLucidPracticeStore,
  hasPracticeEnvelopeKeys,
  type LucidPracticeStorageErrorReason,
} from '@/services/lucidPracticeStore';

export const LUCID_DREAM_REHEARSAL_STORE_VERSION = 1 as const satisfies typeof LUCID_DREAM_REHEARSAL_VERSION;
export const LUCID_DREAM_REHEARSAL_MAX_STORED_COMPLETIONS = 500 as const;
const ENVELOPE_KEYS = ['version', 'userScope', 'currentSession', 'completions'] as const;

export type LucidDreamRehearsalStoredEnvelope = {
  version: typeof LUCID_DREAM_REHEARSAL_STORE_VERSION;
  userScope: string;
  currentSession: LucidDreamRehearsalSession | null;
  completions: LucidDreamRehearsalCompletion[];
};

export type LucidDreamRehearsalExport = LucidDreamRehearsalStoredEnvelope;
export type LucidDreamRehearsalStorageErrorReason = LucidPracticeStorageErrorReason;

export class LucidDreamRehearsalStorageError extends Error {
  readonly reason: LucidDreamRehearsalStorageErrorReason;

  constructor(reason: LucidDreamRehearsalStorageErrorReason, message?: string) {
    super(message ?? reason);
    this.name = 'LucidDreamRehearsalStorageError';
    this.reason = reason;
  }
}

const store = createLucidPracticeStore({
  namespace: 'noctalia_lucid_dream_rehearsal',
  suffix: 'state_v1',
  practice: 'Dream rehearsal',
  storageLabel: 'dream-rehearsal',
  ErrorType: LucidDreamRehearsalStorageError,
  version: LUCID_DREAM_REHEARSAL_STORE_VERSION,
  keys: ENVELOPE_KEYS,
  parse: parseEnvelope,
  empty: emptyEnvelope,
});

export const getLucidDreamRehearsalStorageKey = store.storageKey;
export const countLucidDreamRehearsalScopeLocksForTests = store.countScopeLocks;

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
  if (!hasPracticeEnvelopeKeys(value, ENVELOPE_KEYS)) return null;
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

export async function loadLucidDreamRehearsalState(
  userScope: string,
  storage: LucidKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidDreamRehearsalStoredEnvelope> {
  return store.run(userScope, storage, async (transaction) => {
    return cloneEnvelope(await transaction.load());
  });
}

export async function loadLucidDreamRehearsalCurrentSession(
  userScope: string,
  storage: LucidKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidDreamRehearsalSession | null> {
  const state = await loadLucidDreamRehearsalState(userScope, storage);
  return state.currentSession;
}

export async function loadLucidDreamRehearsalCompletions(
  userScope: string,
  storage: LucidKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidDreamRehearsalCompletion[]> {
  const state = await loadLucidDreamRehearsalState(userScope, storage);
  return state.completions;
}

export async function saveLucidDreamRehearsalCurrentSession(
  userScope: string,
  session: LucidDreamRehearsalSession,
  storage: LucidKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidDreamRehearsalStoredEnvelope> {
  return store.run(userScope, storage, async (transaction) => {
    if (!isLucidDreamRehearsalSession(session)) {
      throw new LucidDreamRehearsalStorageError(
        'invalid_metadata',
        'Invalid dream rehearsal session'
      );
    }
    const current = await transaction.load();
    const nextSession = cloneSession(session);
    const projected = projectLucidDreamRehearsalCompletion(nextSession);
    const completions = projected
      ? upsertIntoCompletions(current.completions, projected)
      : current.completions.map(cloneCompletion);
    const envelope: LucidDreamRehearsalStoredEnvelope = {
      version: LUCID_DREAM_REHEARSAL_STORE_VERSION,
      userScope,
      currentSession: nextSession,
      completions,
    };
    await transaction.save(envelope);
    return cloneEnvelope(envelope);
  });
}

export async function clearLucidDreamRehearsalCurrentSession(
  userScope: string,
  storage: LucidKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidDreamRehearsalStoredEnvelope> {
  return store.run(userScope, storage, async (transaction) => {
    const current = await transaction.load();
    const envelope: LucidDreamRehearsalStoredEnvelope = {
      version: LUCID_DREAM_REHEARSAL_STORE_VERSION,
      userScope,
      currentSession: null,
      completions: current.completions.map(cloneCompletion),
    };
    await transaction.save(envelope);
    return cloneEnvelope(envelope);
  });
}

export async function upsertLucidDreamRehearsalCompletion(
  userScope: string,
  completion: LucidDreamRehearsalCompletion,
  storage: LucidKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidDreamRehearsalCompletion[]> {
  return store.run(userScope, storage, async (transaction) => {
    if (!isLucidDreamRehearsalCompletion(completion)) {
      throw new LucidDreamRehearsalStorageError(
        'invalid_metadata',
        'Invalid dream rehearsal completion'
      );
    }
    const current = await transaction.load();
    const completions = upsertIntoCompletions(current.completions, completion);
    await transaction.save({
      version: LUCID_DREAM_REHEARSAL_STORE_VERSION,
      userScope,
      currentSession: current.currentSession,
      completions,
    });
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
  storage: LucidKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidDreamRehearsalStoredEnvelope> {
  return store.run(userScope, storage, async (transaction) => {
    const updated = await updater(await transaction.load());
    const parsed = parseEnvelope(updated, userScope);
    if (!parsed) {
      throw new LucidDreamRehearsalStorageError(
        'invalid_metadata',
        'Invalid dream rehearsal state'
      );
    }
    await transaction.save(parsed);
    return cloneEnvelope(parsed);
  });
}

export async function clearLucidDreamRehearsalState(
  userScope: string,
  storage: LucidKeyValueStorage = getLucidKeyValueStorage()
): Promise<void> {
  return store.run(userScope, storage, ({ clear }) => clear());
}

export const exportLucidDreamRehearsalState = loadLucidDreamRehearsalState;

export async function importLucidDreamRehearsalState(
  userScope: string,
  payload: unknown,
  storage: LucidKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidDreamRehearsalStoredEnvelope> {
  return store.importEnvelope(userScope, payload, storage);
}
