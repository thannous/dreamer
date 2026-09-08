import type { JournalImportSnapshot, JournalImportStorage } from '@/lib/lucid/journalImport';
import { isJournalImportSourceDate, isJournalImportRevision, journalCopyIdentity } from '@/lib/lucid/journalImport';
import { getLucidKeyValueStorage, isLucidNativeKeyValueStorage, type LucidKeyValueStorage } from './lucidKeyValueStorage';
import { isLucidTrainerEncryptedValue, protectLucidTrainerStoredValue, revealLucidTrainerStoredValue } from './lucidTrainerSecureStorage';

function key(scope: string): string {
  if (scope.length > 256 || !/^(guest|user:[^\u0000-\u001f\u007f]+)$/.test(scope)) throw new Error('Invalid destination scope');
  return `noctalia_lucid_journal_copies:${encodeURIComponent(scope)}:v2`;
}
function parse(raw: string): JournalImportSnapshot {
  const value = JSON.parse(raw) as JournalImportSnapshot;
  if (!value || value.version !== 1 || !value.copies || typeof value.copies !== 'object' || Array.isArray(value.copies) ||
    !Object.hasOwn(value, 'checkpoint')) throw new Error('Invalid import storage');
  for (const [identity, copy] of Object.entries(value.copies)) {
    if (!copy || copy.identity !== identity || copy.sourceProduct !== 'journal' ||
      typeof copy.sourceAccount !== 'string' || !copy.sourceAccount || typeof copy.sourceId !== 'string' ||
      identity !== journalCopyIdentity(copy.sourceAccount, copy.sourceId) || !/^\d+$/.test(copy.sourceId) ||
      !isJournalImportRevision(copy.sourceRevision) ||
      typeof copy.text !== 'string' || typeof copy.edited !== 'boolean' || typeof copy.deleted !== 'boolean' ||
      !isJournalImportSourceDate(copy.createdAt) || typeof copy.importedAt !== 'string' ||
      !Number.isFinite(Date.parse(copy.importedAt)) ||
      (copy.incoming !== undefined && (!copy.incoming || typeof copy.incoming !== 'object' || Array.isArray(copy.incoming) || typeof copy.incoming.text !== 'string' || !isJournalImportRevision(copy.incoming.revision) ||
        !isJournalImportSourceDate(copy.incoming.createdAt)))) throw new Error('Invalid stored copy');
  }
  const cp = value.checkpoint;
  if (cp !== null && (!cp || typeof cp.grantId !== 'string' || !cp.grantId || typeof cp.sourceAccount !== 'string' ||
    !cp.sourceAccount || typeof cp.done !== 'boolean' || (cp.done ? cp.cursor !== null : typeof cp.cursor !== 'string' || !cp.cursor))) {
    throw new Error('Invalid import checkpoint');
  }
  return value;
}
interface Manifest { version: 2; generation: string; chunks: number }
interface Pending { version: 2; next: Manifest; previous: Manifest | null }
const locks = new Map<string, Promise<unknown>>();
let sequence = 0;
function serialized<T>(scope: string, run: () => Promise<T>): Promise<T> {
  const task = (locks.get(scope) ?? Promise.resolve()).then(run, run);
  const settled = task.catch(() => undefined);
  locks.set(scope, settled);
  void settled.then(() => { if (locks.get(scope) === settled) locks.delete(scope); });
  return task;
}
function manifest(value: unknown): Manifest {
  const item = value as Manifest;
  if (!item || item.version !== 2 || typeof item.generation !== 'string' ||
    !/^[a-z0-9-]{1,100}$/.test(item.generation) || !Number.isSafeInteger(item.chunks) || item.chunks < 1) {
    throw new Error('Invalid import manifest');
  }
  return item;
}
function chunks(text: string): string[] {
  const result: string[] = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + 128_000, text.length);
    if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1])) end -= 1;
    result.push(text.slice(start, end));
    start = end;
  }
  return result;
}
/** Protected immutable chunks; only the small atomic manifest publishes a new page/cursor. */
export function createLucidJournalImportStorage(
  storage: LucidKeyValueStorage = getLucidKeyValueStorage()
): JournalImportStorage & { clear(scope: string): Promise<void> } {
  const native = isLucidNativeKeyValueStorage(storage);
  const read = async (storageKey: string) => {
    const raw = await storage.getItem(storageKey);
    if (raw === null) return null;
    if (native && !isLucidTrainerEncryptedValue(raw)) throw new Error('Unprotected import storage');
    return native ? revealLucidTrainerStoredValue(storageKey, raw) : raw;
  };
  const write = async (storageKey: string, plaintext: string, check: () => void) => {
    check();
    const raw = native ? await protectLucidTrainerStoredValue(storageKey, plaintext) : plaintext;
    check();
    await storage.setItem(storageKey, raw);
    check();
  };
  const readManifest = async (base: string) => {
    const raw = await read(base);
    return raw === null ? null : manifest(JSON.parse(raw));
  };
  const chunkKey = (base: string, item: Manifest, index: number) => `${base}:chunk:${item.generation}:${index}`;
  // Persist the complete inventory before removing any sensitive chunk. The marker
  // survives partial deletion, including lost acknowledgements, and blocks reads/writes
  // until cleanup succeeds. It contains no transcript and is protected like the manifest.
  const finishErasure = async (base: string): Promise<boolean> => {
    const raw = await read(`${base}:erasing`);
    if (raw === null) return false;
    const intent = JSON.parse(raw) as { version: number; manifests: unknown[] };
    if (!intent || intent.version !== 1 || !Array.isArray(intent.manifests)) throw new Error('Invalid import erasure');
    const generations = intent.manifests.map(manifest);
    for (const item of generations) {
      for (let index = 0; index < item.chunks; index += 1) await storage.removeItem(chunkKey(base, item, index));
    }
    await storage.removeItem(`${base}:pending`);
    await storage.removeItem(base);
    await storage.removeItem(`${base}:erasing`);
    return true;
  };
  // This journal is written before any chunk. Recovery never removes the active generation.
  const recover = async (base: string, deferCleanupFailure = false): Promise<Manifest | null> => {
    const current = await readManifest(base);
    const raw = await read(`${base}:pending`);
    if (raw === null) return current;
    const pending = JSON.parse(raw) as Pending;
    if (!pending || pending.version !== 2) throw new Error('Invalid import pending generation');
    const candidates = [manifest(pending.next), ...(pending.previous === null ? [] : [manifest(pending.previous)])];
    try {
      for (const candidate of candidates) {
        if (candidate.generation === current?.generation) continue;
        for (let index = 0; index < candidate.chunks; index += 1) await storage.removeItem(chunkKey(base, candidate, index));
      }
      await storage.removeItem(`${base}:pending`);
    } catch (error) {
      // An inactive chunk must not hide an intact active snapshot. Keep the journal
      // for retry, and require successful cleanup before a later save replaces it.
      if (!deferCleanupFailure) throw error;
    }
    return current;
  };
  return {
    clear(scope) {
      return serialized(scope, async () => {
        const base = key(scope);
        if (await finishErasure(base)) return;
        const current = await readManifest(base);
        const raw = await read(`${base}:pending`);
        const generations = current ? [current] : [];
        if (raw !== null) {
          const pending = JSON.parse(raw) as Pending;
          if (!pending || pending.version !== 2) throw new Error('Invalid import pending generation');
          generations.push(manifest(pending.next));
          if (pending.previous !== null) generations.push(manifest(pending.previous));
        }
        if (!generations.length) return;
        await write(`${base}:erasing`, JSON.stringify({ version: 1, manifests: generations }), () => undefined);
        await finishErasure(base);
      });
    },
    load(scope) {
      return serialized(scope, async () => {
        const base = key(scope);
        await finishErasure(base);
        const current = await recover(base, true);
        if (!current) return null;
        const parts: string[] = [];
        for (let index = 0; index < current.chunks; index += 1) {
          const part = await read(chunkKey(base, current, index));
          if (part === null) throw new Error('Missing import chunk');
          parts.push(part);
        }
        return parse(parts.join(''));
      });
    },
    save(scope, snapshot, assertActive) {
      // Capture synchronously so the caller cannot mutate a queued write.
      const plaintext = JSON.stringify(snapshot);
      parse(plaintext);
      return serialized(scope, async () => {
        const base = key(scope);
        assertActive();
        await finishErasure(base);
        assertActive();
        const previous = await recover(base);
        assertActive();
        const parts = chunks(plaintext);
        const next: Manifest = { version: 2, generation: `${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2)}`, chunks: parts.length };
        try {
          await write(`${base}:pending`, JSON.stringify({ version: 2, next, previous } satisfies Pending), assertActive);
          for (let index = 0; index < parts.length; index += 1) await write(chunkKey(base, next, index), parts[index], assertActive);
          await write(base, JSON.stringify(next), assertActive);
        } catch (error) {
          // If cleanup itself fails, the protected journal remains for the next read/write.
          try { await recover(base); } catch { /* preserve original failure */ }
          throw error;
        }
        await recover(base, true);
        assertActive();
      });
    },
  };
}

/** The runtime owner must cancel its import engine before clearing this namespace. */
export function clearLucidJournalImportStorage(
  scope: string,
  storage: LucidKeyValueStorage = getLucidKeyValueStorage()
): Promise<void> {
  return createLucidJournalImportStorage(storage).clear(scope);
}
