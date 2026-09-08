/** Local copies only. This module has no Journal provider or Lucid sync dependency. */
export interface JournalImportItem {
  id: string;
  clientRequestId: string | null;
  revision: string;
  createdAt: string;
  transcript: string;
}
export interface JournalImportPage {
  grantId: string;
  items: JournalImportItem[];
  nextCursor: string | null;
  done: boolean;
}
export interface JournalImportConfirmation {
  confirmed: true;
  grantId: string;
  cursor: string;
  expiresAt: string;
  sourceAccount: string;
  destinationScope: string;
}
export interface JournalCopy {
  identity: string;
  sourceProduct: 'journal';
  sourceAccount: string;
  sourceId: string;
  sourceRevision: string;
  createdAt: string;
  importedAt: string;
  text: string;
  edited: boolean;
  deleted: boolean;
  incoming?: { text: string; revision: string; createdAt: string };
}
export interface JournalImportSnapshot {
  version: 1;
  copies: Record<string, JournalCopy>;
  checkpoint: { grantId: string; sourceAccount: string; cursor: string | null; done: boolean } | null;
}
export interface JournalImportStorage {
  load(scope: string): Promise<JournalImportSnapshot | null>;
  save(scope: string, snapshot: JournalImportSnapshot, assertActive: () => void): Promise<void>;
}
export const journalCopyIdentity = (account: string, id: string): string => JSON.stringify(['journal', account, id]);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function createJournalImportEngine(deps: {
  storage: JournalImportStorage;
  readPage(input: { grantId: string; cursor: string; sourceAccount: string }): Promise<JournalImportPage>;
  getCurrentDestinationScope(): string | null;
  getCurrentSourceAccount(): string | null;
  now(): Date;
}) {
  let generation = 0;
  let tail: Promise<unknown> = Promise.resolve();
  const serial = <T>(action: () => Promise<T>): Promise<T> => {
    const pending = tail.then(action, action);
    tail = pending.catch(() => undefined);
    return pending;
  };
  const guard = (scope: string, token: number, source?: string) => () => {
    if (generation !== token || deps.getCurrentDestinationScope() !== scope ||
      (source !== undefined && deps.getCurrentSourceAccount() !== source)) throw new Error('Import cancelled or account changed');
  };
  const load = async (scope: string, check: () => void) => {
    check();
    const saved = await deps.storage.load(scope);
    check();
    return saved ? clone(saved) : { version: 1 as const, copies: {}, checkpoint: null };
  };
  return {
    cancel() { generation += 1; },
    start(confirmation: JournalImportConfirmation): Promise<JournalImportSnapshot> {
      const token = ++generation;
      const input = { ...confirmation };
      return serial(async () => {
        if (input.confirmed !== true || !input.grantId || !input.cursor || !input.sourceAccount ||
          !Number.isFinite(Date.parse(input.expiresAt))) throw new Error('Explicit import confirmation required');
        const check = guard(input.destinationScope, token, input.sourceAccount);
        let state = await load(input.destinationScope, check);
        const checkpoint = state.checkpoint;
        if (checkpoint?.grantId === input.grantId && checkpoint.sourceAccount === input.sourceAccount && checkpoint.done) return state;
        let cursor = checkpoint?.grantId === input.grantId && checkpoint.sourceAccount === input.sourceAccount
          ? checkpoint.cursor : input.cursor;
        const seen = new Set<string>();
        while (cursor !== null) {
          check();
          if (deps.now().getTime() >= Date.parse(input.expiresAt)) throw new Error('Import grant expired');
          if (seen.has(cursor)) throw new Error('Repeated import cursor');
          seen.add(cursor);
          const page = await deps.readPage({ grantId: input.grantId, cursor, sourceAccount: input.sourceAccount });
          check();
          if (page.grantId !== input.grantId || !Array.isArray(page.items) || typeof page.done !== 'boolean' ||
            (page.done ? page.nextCursor !== null : typeof page.nextCursor !== 'string' || !page.nextCursor || page.nextCursor === cursor)) {
            throw new Error('Invalid import page');
          }
          const next = clone(state);
          for (const item of page.items) {
            if (!item || typeof item.id !== 'string' || typeof item.revision !== 'string' ||
              !/^\d+$/.test(item.id) || !/^\d+$/.test(item.revision) ||
              typeof item.transcript !== 'string' || !Number.isFinite(Date.parse(item.createdAt))) throw new Error('Invalid import item');
            const identity = journalCopyIdentity(input.sourceAccount, item.id);
            const previous = next.copies[identity];
            if (previous?.deleted || previous?.sourceRevision === item.revision) continue;
            if (previous?.edited) {
              previous.incoming = { text: item.transcript, revision: item.revision, createdAt: item.createdAt };
            } else {
              next.copies[identity] = { identity, sourceProduct: 'journal', sourceAccount: input.sourceAccount,
                sourceId: item.id, sourceRevision: item.revision, createdAt: item.createdAt,
                importedAt: deps.now().toISOString(), text: item.transcript, edited: false, deleted: false };
            }
          }
          next.checkpoint = { grantId: input.grantId, sourceAccount: input.sourceAccount, cursor: page.nextCursor, done: page.done };
          check();
          await deps.storage.save(input.destinationScope, next, check);
          check();
          state = next;
          cursor = page.nextCursor;
        }
        return clone(state);
      });
    },
    inspect(scope: string) {
      const check = guard(scope, generation);
      return serial(() => load(scope, check));
    },
    updateCopy(scope: string, identity: string, action: { type: 'edit'; text: string } | { type: 'delete' | 'keepLocal' | 'useIncoming' }) {
      const check = guard(scope, generation);
      return serial(async () => {
        const state = await load(scope, check);
        const copy = state.copies[identity];
        if (!copy || copy.deleted) throw new Error('Copy unavailable');
        if (action.type === 'delete') {
          copy.deleted = true; copy.text = ''; delete copy.incoming;
        } else if (action.type === 'edit') {
          copy.text = action.text; copy.edited = true;
        } else {
          if (!copy.incoming) throw new Error('No import conflict');
          if (action.type === 'useIncoming') {
            copy.text = copy.incoming.text; copy.createdAt = copy.incoming.createdAt; copy.edited = false;
          }
          copy.sourceRevision = copy.incoming.revision;
          delete copy.incoming;
        }
        check();
        await deps.storage.save(scope, state, check);
        check();
        return clone(state);
      });
    },
  };
}
