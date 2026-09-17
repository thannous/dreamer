import { type LibraryState } from '@/lib/types';
import { readJsonStrict, StorageKey, writeJsonStrict } from '@/services/storageService';

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function progress(value: unknown): LibraryState['progress'] {
  if (!object(value) || !Object.values(value).every((entry) =>
    object(entry) && typeof entry.positionSec === 'number' && Number.isFinite(entry.positionSec) &&
    typeof entry.completedCount === 'number' && Number.isFinite(entry.completedCount) &&
    typeof entry.lastPlayedISO === 'string')) throw new Error('Invalid library progress');
  return value as LibraryState['progress'];
}

function metadata(value: unknown): Pick<LibraryState, 'favorites' | 'practiceLog'> {
  if (!object(value) || ('version' in value && value.version !== 1)) throw new Error('Invalid library metadata');
  const favorites = value.favorites === undefined ? [] : value.favorites;
  const practiceLog = value.practiceLog === undefined ? [] : value.practiceLog;
  if (!Array.isArray(favorites) || !favorites.every((id) => typeof id === 'string') ||
    !Array.isArray(practiceLog) || !practiceLog.every((entry) => object(entry) &&
      typeof entry.dateISO === 'string' && typeof entry.seconds === 'number' && Number.isFinite(entry.seconds) &&
      (entry.sessionId === undefined || typeof entry.sessionId === 'string') &&
      (entry.patternId === undefined || typeof entry.patternId === 'string'))) throw new Error('Invalid library metadata');
  return { favorites, practiceLog };
}

/** One provider owns one instance and supplies immutable state snapshots. Failed reads never grant permission to write. */
export function createLibraryPersistence() {
  let hydrated = false;
  let tail: Promise<unknown> = Promise.resolve();
  const durable = new Map<string, string>();
  const serialize = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(operation);
    tail = result.catch(() => undefined);
    return result;
  };
  const write = async (key: typeof StorageKey.favorites | typeof StorageKey.progress, value: unknown) => {
    const json = typeof value === 'object' && value !== null && metadataJson.has(value)
      ? metadataJson.get(value)! : JSON.stringify(value);
    if (durable.get(key) === json) return;
    await writeJsonStrict(key, value);
    durable.set(key, json);
  };
  let lastMetadata: Pick<LibraryState, 'favorites' | 'practiceLog'> | undefined;
  let metadataPayload: { version: number; favorites: LibraryState['favorites']; practiceLog: LibraryState['practiceLog'] };
  const metadataJson = new WeakMap<object, string>();
  return {
    load: () => serialize(async (): Promise<LibraryState> => {
      hydrated = false;
      const [legacy, storedProgress] = await Promise.all([
        readJsonStrict(StorageKey.favorites), readJsonStrict(StorageKey.progress),
      ]);
      const meta = metadata(legacy === undefined ? {} : legacy);
      let restoredProgress: LibraryState['progress'];
      if (storedProgress !== undefined) {
        if (!object(storedProgress) || storedProgress.version !== 1) throw new Error('Unsupported library progress');
        restoredProgress = progress(storedProgress.progress);
      } else {
        // Missing split progress after a committed migration is a failure, not an empty library.
        if (object(legacy) && legacy.version === 1) throw new Error('Missing library progress');
        restoredProgress = progress(object(legacy) ? (legacy.progress === undefined ? {} : legacy.progress) : {});
      }
      durable.clear();
      if (legacy !== undefined) durable.set(StorageKey.favorites, JSON.stringify(legacy));
      if (storedProgress !== undefined) durable.set(StorageKey.progress, JSON.stringify(storedProgress));
      hydrated = true;
      return { ...meta, progress: restoredProgress };
    }),
    save: (state: LibraryState) => {
      // Provider state is immutable: retain its references across the serialized queue.
      // Metadata payload identity is stable during progress-only updates.
      const snapshot = state;
      if (!lastMetadata || lastMetadata.favorites !== state.favorites || lastMetadata.practiceLog !== state.practiceLog) {
        lastMetadata = state;
        metadataPayload = { version: 1, favorites: state.favorites, practiceLog: state.practiceLog };
        metadataJson.set(metadataPayload, JSON.stringify(metadataPayload));
      }
      const queuedMetadata = metadataPayload;
      return serialize(async () => {
        if (!hydrated) throw new Error('Library must be loaded successfully before saving');
        // Copy progress first. A crash/failure leaves the legacy full library intact.
        await write(StorageKey.progress, { version: 1, progress: snapshot.progress });
        await write(StorageKey.favorites, queuedMetadata);
      });
    },
  };
}
