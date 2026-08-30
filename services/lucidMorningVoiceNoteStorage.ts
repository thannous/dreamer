import { Directory, File, Paths } from 'expo-file-system';
import {
  getLucidKeyValueStorage,
  isLucidNativeKeyValueStorage,
  type LucidKeyValueStorage,
} from '@/services/lucidKeyValueStorage';

import {
  LucidMorningVoiceNoteError,
  assertLucidMorningVoiceNote,
  classifyLucidMorningVoiceFailure,
  createLucidMorningVoiceNote,
  createLucidMorningVoiceNoteId,
  isLucidMorningVoiceNoteId,
  isLucidMorningVoiceUserScope,
  isLocalLucidMorningVoiceUri,
  linkLucidMorningVoiceNoteToExperiment,
  parseLucidMorningVoiceNote,
  renameLucidMorningVoiceNote,
  withLucidMorningVoiceNoteTranscript,
  type LucidMorningVoiceExtension,
  type LucidMorningVoiceMimeType,
  type LucidMorningVoiceNote,
  type LucidMorningVoiceNoteStatus,
} from '@/lib/lucid/morningVoiceNote';
import {
  isLucidTrainerEncryptedValueError,
  protectLucidTrainerStoredValue,
  revealLucidTrainerStoredValue,
} from '@/services/lucidTrainerSecureStorage';

const STORAGE_NAMESPACE = 'noctalia_lucid_morning_voice';
const NOTES_KEY_VERSION = 'notes_v1';
export const LUCID_MORNING_VOICE_NOTE_STORE_VERSION = 1 as const;
const DIRECTORY_SEGMENT = 'noctalia-lucid-morning-voice';
const ENVELOPE_KEYS = ['version', 'userScope', 'notes'] as const;

type AsyncKeyValueStorage = LucidKeyValueStorage;

export type LucidMorningVoiceFileAdapter = {
  exists(uri: string): Promise<boolean>;
  ensureDirectory(uri: string): Promise<void>;
  copy(fromUri: string, toUri: string): Promise<void>;
  move(fromUri: string, toUri: string): Promise<void>;
  delete(uri: string): Promise<void>;
  documentDirectoryUri(): string;
};

type Envelope = {
  version: typeof LUCID_MORNING_VOICE_NOTE_STORE_VERSION;
  userScope: string;
  notes: LucidMorningVoiceNote[];
};

const scopeLocks = new Map<string, Promise<void>>();

function usesNativeStorage(storage: AsyncKeyValueStorage): boolean {
  return isLucidNativeKeyValueStorage(storage);
}

function persistenceError(error: unknown): LucidMorningVoiceNoteError {
  if (error instanceof LucidMorningVoiceNoteError) return error;
  const reason = classifyLucidMorningVoiceFailure(error);
  return new LucidMorningVoiceNoteError(
    reason === 'storage_full' ? 'storage_full' : 'persistence_failed',
    reason === 'storage_full' ? 'Local storage is full' : 'Local voice-note persistence failed'
  );
}

async function runFileOp<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw persistenceError(error);
  }
}

async function fileExists(files: LucidMorningVoiceFileAdapter, uri: string): Promise<boolean> {
  return runFileOp(async () => files.exists(uri));
}

async function fileEnsureDirectory(files: LucidMorningVoiceFileAdapter, uri: string): Promise<void> {
  await runFileOp(async () => files.ensureDirectory(uri));
}

async function fileCopy(
  files: LucidMorningVoiceFileAdapter,
  fromUri: string,
  toUri: string
): Promise<void> {
  await runFileOp(async () => files.copy(fromUri, toUri));
}

async function fileMove(
  files: LucidMorningVoiceFileAdapter,
  fromUri: string,
  toUri: string
): Promise<void> {
  await runFileOp(async () => files.move(fromUri, toUri));
}

async function fileDelete(files: LucidMorningVoiceFileAdapter, uri: string): Promise<void> {
  await runFileOp(async () => files.delete(uri));
}

function assertScope(userScope: string): string {
  if (!isLucidMorningVoiceUserScope(userScope)) {
    throw new LucidMorningVoiceNoteError('invalid_scope', 'Voice note user scope is invalid');
  }
  return userScope;
}

function assertNoteId(id: string): string {
  if (!isLucidMorningVoiceNoteId(id)) {
    throw new LucidMorningVoiceNoteError('invalid_id', 'Voice note id is invalid');
  }
  return id;
}

export function getLucidMorningVoiceNoteStorageKey(userScope: string): string {
  return `${STORAGE_NAMESPACE}:${encodeURIComponent(assertScope(userScope))}:${NOTES_KEY_VERSION}`;
}

function encodeScopeDirectory(userScope: string): string {
  return encodeURIComponent(assertScope(userScope));
}

function documentDirectoryUri(files: LucidMorningVoiceFileAdapter): string {
  try {
    return files.documentDirectoryUri().replace(/\/+$/, '');
  } catch (error) {
    throw persistenceError(error);
  }
}

export function getLucidMorningVoiceNoteDirectoryUri(
  userScope: string,
  files: LucidMorningVoiceFileAdapter = createNativeFileAdapter()
): string {
  return `${documentDirectoryUri(files)}/${DIRECTORY_SEGMENT}/${encodeScopeDirectory(userScope)}`;
}

export function getLucidMorningVoiceNoteFileUri(
  userScope: string,
  noteId: string,
  extension: LucidMorningVoiceExtension,
  files: LucidMorningVoiceFileAdapter = createNativeFileAdapter()
): string {
  return `${getLucidMorningVoiceNoteDirectoryUri(userScope, files)}/${assertNoteId(noteId)}${extension}`;
}

function quarantineUriFor(uri: string): string {
  return `${uri}.deleting`;
}

function createNativeFileAdapter(): LucidMorningVoiceFileAdapter {
  const toFile = (uri: string) => new File(uri);
  return {
    async exists(uri: string) {
      try {
        return toFile(uri).exists;
      } catch (error) {
        throw persistenceError(error);
      }
    },
    async ensureDirectory(uri: string) {
      try {
        const directory = new Directory(uri);
        directory.create({ idempotent: true, intermediates: true });
      } catch (error) {
        throw persistenceError(error);
      }
    },
    async copy(fromUri: string, toUri: string) {
      try {
        await toFile(fromUri).copy(toFile(toUri));
      } catch (error) {
        throw persistenceError(error);
      }
    },
    async move(fromUri: string, toUri: string) {
      try {
        await toFile(fromUri).move(toFile(toUri));
      } catch (error) {
        throw persistenceError(error);
      }
    },
    async delete(uri: string) {
      try {
        const file = toFile(uri);
        if (file.exists) file.delete();
      } catch (error) {
        throw persistenceError(error);
      }
    },
    documentDirectoryUri() {
      try {
        return Paths.document.uri;
      } catch (error) {
        throw persistenceError(error);
      }
    },
  };
}

function emptyEnvelope(userScope: string): Envelope {
  return {
    version: LUCID_MORNING_VOICE_NOTE_STORE_VERSION,
    userScope,
    notes: [],
  };
}

function sortNotes(notes: LucidMorningVoiceNote[]): LucidMorningVoiceNote[] {
  return [...notes].sort((left, right) => {
    if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
    return left.id.localeCompare(right.id);
  });
}

function hasExactKeys(value: object, allowed: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === allowed.length && keys.every((key) => allowed.includes(key));
}

function parseEnvelope(value: unknown, userScope: string): Envelope | null {
  if (!value || typeof value !== 'object') return null;
  if (!hasExactKeys(value, ENVELOPE_KEYS)) return null;
  const envelope = value as Envelope;
  if (envelope.version !== LUCID_MORNING_VOICE_NOTE_STORE_VERSION) return null;
  if (envelope.userScope !== userScope) return null;
  if (!Array.isArray(envelope.notes)) return null;
  const notes: LucidMorningVoiceNote[] = [];
  const seen = new Set<string>();
  for (const item of envelope.notes) {
    const parsed = parseLucidMorningVoiceNote(item);
    if (!parsed || parsed.userScope !== userScope) return null;
    if (seen.has(parsed.id)) return null;
    seen.add(parsed.id);
    notes.push(parsed);
  }
  return { version: LUCID_MORNING_VOICE_NOTE_STORE_VERSION, userScope, notes: sortNotes(notes) };
}

async function readPlaintext(key: string, storage: AsyncKeyValueStorage): Promise<string | null> {
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

async function withOrderedScopeLocks<T>(
  scopes: readonly string[],
  work: () => Promise<T>
): Promise<T> {
  const unique = [...new Set(scopes.map(assertScope))].sort((left, right) =>
    left.localeCompare(right)
  );
  const acquire = (index: number): Promise<T> => {
    if (index >= unique.length) return work();
    return withScopeLock(unique[index], () => acquire(index + 1));
  };
  return acquire(0);
}

export function countLucidMorningVoiceNoteScopeLocksForTests(): number {
  return scopeLocks.size;
}

async function loadEnvelope(
  userScope: string,
  storage: AsyncKeyValueStorage
): Promise<Envelope> {
  const key = getLucidMorningVoiceNoteStorageKey(userScope);
  const plaintext = await readPlaintext(key, storage);
  if (!plaintext) return emptyEnvelope(userScope);
  try {
    const parsed = parseEnvelope(JSON.parse(plaintext) as unknown, userScope);
    if (parsed) return parsed;
  } catch {
    // Corrupt JSON is discarded locally.
  }
  await storage.removeItem(key).catch(() => undefined);
  return emptyEnvelope(userScope);
}

async function saveEnvelope(
  envelope: Envelope,
  storage: AsyncKeyValueStorage
): Promise<void> {
  const unique = parseEnvelope(envelope, envelope.userScope);
  if (!unique) {
    throw new LucidMorningVoiceNoteError('invalid_metadata', 'Invalid local voice-note envelope');
  }
  await writePlaintext(
    getLucidMorningVoiceNoteStorageKey(envelope.userScope),
    JSON.stringify(unique),
    storage
  );
}

function findNote(envelope: Envelope, noteId: string): LucidMorningVoiceNote | null {
  return envelope.notes.find((note) => note.id === noteId) ?? null;
}

function upsertNote(envelope: Envelope, note: LucidMorningVoiceNote): Envelope {
  assertLucidMorningVoiceNote(note);
  if (note.userScope !== envelope.userScope) {
    throw new LucidMorningVoiceNoteError('invalid_scope', 'Voice note user scope is invalid');
  }
  const notes = envelope.notes.filter((item) => item.id !== note.id);
  notes.push(note);
  return { ...envelope, notes: sortNotes(notes) };
}

export async function loadLucidMorningVoiceNotes(
  userScope: string,
  storage: AsyncKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidMorningVoiceNote[]> {
  return withScopeLock(assertScope(userScope), async () => {
    const envelope = await loadEnvelope(userScope, storage);
    return envelope.notes;
  });
}

export async function getLucidMorningVoiceNote(
  userScope: string,
  noteId: string,
  storage: AsyncKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidMorningVoiceNote | null> {
  const notes = await loadLucidMorningVoiceNotes(userScope, storage);
  return notes.find((note) => note.id === assertNoteId(noteId)) ?? null;
}

export async function getLucidMorningVoiceNoteByExperimentId(
  userScope: string,
  experimentId: string,
  storage: AsyncKeyValueStorage = getLucidKeyValueStorage()
): Promise<LucidMorningVoiceNote | null> {
  const notes = await loadLucidMorningVoiceNotes(userScope, storage);
  return notes.find((note) => note.experimentId === assertNoteId(experimentId)) ?? null;
}

async function discardUnpublishedDestination(
  files: LucidMorningVoiceFileAdapter,
  destinationUri: string
): Promise<void> {
  try {
    await fileDelete(files, destinationUri);
  } catch (error) {
    throw persistenceError(error);
  }
  if (await fileExists(files, destinationUri)) {
    throw new LucidMorningVoiceNoteError(
      'persistence_failed',
      'Local voice-note persistence failed'
    );
  }
}

async function restoreOriginalFile(
  files: LucidMorningVoiceFileAdapter,
  originalUri: string,
  quarantineUri: string
): Promise<void> {
  const quarantineExists = await fileExists(files, quarantineUri);
  if (!quarantineExists) return;
  if (await fileExists(files, originalUri)) {
    await fileDelete(files, originalUri);
  }
  await fileMove(files, quarantineUri, originalUri);
}

async function deleteNoteFromEnvelope(
  envelope: Envelope,
  note: LucidMorningVoiceNote,
  storage: AsyncKeyValueStorage,
  files: LucidMorningVoiceFileAdapter
): Promise<Envelope> {
  const originalUri = note.uri;
  const quarantineUri = quarantineUriFor(originalUri);
  let quarantined = false;
  try {
    const originalExists = await fileExists(files, originalUri);
    const quarantineExists = await fileExists(files, quarantineUri);
    if (originalExists) {
      await fileMove(files, originalUri, quarantineUri);
      quarantined = true;
    } else if (!quarantineExists && originalExists === false) {
      quarantined = false;
    }
    const next = {
      ...envelope,
      notes: envelope.notes.filter((item) => item.id !== note.id),
    };
    await saveEnvelope(next, storage);
    try {
      if (await fileExists(files, quarantineUri)) {
        await fileDelete(files, quarantineUri);
      }
      if (await fileExists(files, originalUri)) {
        await fileDelete(files, originalUri);
      }
      if ((await fileExists(files, quarantineUri)) || (await fileExists(files, originalUri))) {
        throw new LucidMorningVoiceNoteError(
          'persistence_failed',
          'Local voice-note persistence failed'
        );
      }
    } catch (error) {
      await restoreOriginalFile(files, originalUri, quarantineUri).catch(() => undefined);
      await saveEnvelope(envelope, storage).catch(() => undefined);
      throw persistenceError(error);
    }
    return next;
  } catch (error) {
    if (quarantined) {
      await restoreOriginalFile(files, originalUri, quarantineUri).catch(() => undefined);
    }
    throw persistenceError(error);
  }
}

function assertImmutableMedia(
  existing: LucidMorningVoiceNote,
  input: {
    extension: LucidMorningVoiceExtension;
    mimeType: LucidMorningVoiceMimeType;
    destinationUri: string;
    durationMs: number;
    title?: string;
    transcript?: string | null;
    experimentId?: string | null;
  }
): void {
  if (
    existing.extension !== input.extension ||
    existing.mimeType !== input.mimeType ||
    existing.uri !== input.destinationUri
  ) {
    throw new LucidMorningVoiceNoteError(
      'invalid_uri',
      'Voice note URI, extension and MIME type must match'
    );
  }
  if (existing.durationMs !== input.durationMs) {
    throw new LucidMorningVoiceNoteError('invalid_duration', 'Voice note duration is invalid');
  }
  if (
    (input.title !== undefined && input.title !== existing.title) ||
    (input.transcript !== undefined && input.transcript !== existing.transcript) ||
    (input.experimentId !== undefined && input.experimentId !== existing.experimentId)
  ) {
    throw new LucidMorningVoiceNoteError('invalid_metadata', 'Invalid local voice-note envelope');
  }
}

export async function persistLucidMorningVoiceNoteFromRecorder(input: {
  userScope: string;
  sourceUri: string;
  mimeType: LucidMorningVoiceMimeType;
  extension: LucidMorningVoiceExtension;
  durationMs: number;
  status?: LucidMorningVoiceNoteStatus;
  title?: string;
  transcript?: string | null;
  experimentId?: string | null;
  noteId?: string;
  now?: number;
  storage?: AsyncKeyValueStorage;
  files?: LucidMorningVoiceFileAdapter;
}): Promise<LucidMorningVoiceNote> {
  const userScope = assertScope(input.userScope);
  const storage = input.storage ?? getLucidKeyValueStorage();
  const files = input.files ?? createNativeFileAdapter();
  const now = input.now ?? Date.now();
  const noteId = input.noteId ?? createLucidMorningVoiceNoteId(now);
  assertNoteId(noteId);
  if (!isLocalLucidMorningVoiceUri(input.sourceUri)) {
    throw new LucidMorningVoiceNoteError('invalid_uri', 'Voice note URI must stay local');
  }

  return withScopeLock(userScope, async () => {
    const envelope = await loadEnvelope(userScope, storage);
    const existing = findNote(envelope, noteId);
    const destinationUri = getLucidMorningVoiceNoteFileUri(
      userScope,
      noteId,
      input.extension,
      files
    );
    const intended = createLucidMorningVoiceNote({
      id: noteId,
      userScope,
      experimentId: input.experimentId ?? existing?.experimentId ?? null,
      status: input.status ?? existing?.status ?? 'draft',
      title: input.title ?? existing?.title,
      transcript: input.transcript !== undefined ? input.transcript : existing?.transcript ?? null,
      durationMs: input.durationMs,
      mimeType: input.mimeType,
      extension: input.extension,
      uri: destinationUri,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      recoverable: (input.status ?? existing?.status ?? 'draft') === 'draft',
      now,
    });

    let copied = false;
    if (existing) {
      assertImmutableMedia(existing, {
        extension: input.extension,
        mimeType: input.mimeType,
        destinationUri,
        durationMs: input.durationMs,
        title: input.title,
        transcript: input.transcript,
        experimentId: input.experimentId,
      });
      if (!(await fileExists(files, existing.uri))) {
        throw new LucidMorningVoiceNoteError(
          'persistence_failed',
          'Local voice-note persistence failed'
        );
      }
      const sourceExists = await fileExists(files, input.sourceUri);
      if (sourceExists && input.sourceUri !== existing.uri) {
        throw new LucidMorningVoiceNoteError(
          'invalid_uri',
          'Voice note URI, extension and MIME type must match'
        );
      }
    } else {
      if (await fileExists(files, destinationUri)) {
        throw new LucidMorningVoiceNoteError(
          'persistence_failed',
          'Local voice-note persistence failed'
        );
      }
      if (!(await fileExists(files, input.sourceUri))) {
        throw new LucidMorningVoiceNoteError('invalid_uri', 'Voice note URI must stay local');
      }
      await fileEnsureDirectory(
        files,
        getLucidMorningVoiceNoteDirectoryUri(userScope, files)
      );
      try {
        await fileCopy(files, input.sourceUri, destinationUri);
        copied = true;
        if (!(await fileExists(files, destinationUri))) {
          throw new LucidMorningVoiceNoteError(
            'persistence_failed',
            'Local voice-note persistence failed'
          );
        }
      } catch (error) {
        try {
          await discardUnpublishedDestination(files, destinationUri);
        } catch (cleanupError) {
          throw persistenceError(cleanupError);
        }
        throw persistenceError(error);
      }
    }

    try {
      await saveEnvelope(upsertNote(envelope, intended), storage);
    } catch (error) {
      if (copied) {
        await discardUnpublishedDestination(files, destinationUri);
      }
      throw persistenceError(error);
    }

    if (copied) {
      try {
        await fileDelete(files, input.sourceUri);
      } catch {
        // Durable metadata already references the copy; source leftover is recoverable.
      }
    }
    return intended;
  });
}

export async function renameStoredLucidMorningVoiceNote(
  userScope: string,
  noteId: string,
  title: string,
  options?: { now?: number; storage?: AsyncKeyValueStorage }
): Promise<LucidMorningVoiceNote> {
  const storage = options?.storage ?? getLucidKeyValueStorage();
  return withScopeLock(assertScope(userScope), async () => {
    const envelope = await loadEnvelope(userScope, storage);
    const current = findNote(envelope, assertNoteId(noteId));
    if (!current) {
      throw new LucidMorningVoiceNoteError('invalid_id', 'Voice note id is invalid');
    }
    const next = renameLucidMorningVoiceNote(current, title, options?.now ?? Date.now());
    await saveEnvelope(upsertNote(envelope, next), storage);
    return next;
  });
}

export async function updateStoredLucidMorningVoiceNoteTranscript(
  userScope: string,
  noteId: string,
  transcript: string | null,
  options?: { now?: number; storage?: AsyncKeyValueStorage }
): Promise<LucidMorningVoiceNote> {
  const storage = options?.storage ?? getLucidKeyValueStorage();
  return withScopeLock(assertScope(userScope), async () => {
    const envelope = await loadEnvelope(userScope, storage);
    const current = findNote(envelope, assertNoteId(noteId));
    if (!current) {
      throw new LucidMorningVoiceNoteError('invalid_id', 'Voice note id is invalid');
    }
    const next = withLucidMorningVoiceNoteTranscript(
      current,
      transcript,
      options?.now ?? Date.now()
    );
    await saveEnvelope(upsertNote(envelope, next), storage);
    return next;
  });
}

export async function linkStoredLucidMorningVoiceNoteToExperiment(
  userScope: string,
  noteId: string,
  experimentId: string,
  options?: { now?: number; storage?: AsyncKeyValueStorage }
): Promise<LucidMorningVoiceNote> {
  const storage = options?.storage ?? getLucidKeyValueStorage();
  return withScopeLock(assertScope(userScope), async () => {
    const envelope = await loadEnvelope(userScope, storage);
    const current = findNote(envelope, assertNoteId(noteId));
    if (!current) {
      throw new LucidMorningVoiceNoteError('invalid_id', 'Voice note id is invalid');
    }
    const next = linkLucidMorningVoiceNoteToExperiment(
      current,
      experimentId,
      options?.now ?? Date.now()
    );
    await saveEnvelope(upsertNote(envelope, next), storage);
    return next;
  });
}

export async function unlinkLucidMorningVoiceNotesFromExperiment(
  userScope: string,
  experimentId: string,
  options?: { now?: number; storage?: AsyncKeyValueStorage }
): Promise<LucidMorningVoiceNote[]> {
  const storage = options?.storage ?? getLucidKeyValueStorage();
  return withScopeLock(assertScope(userScope), async () => {
    if (!isLucidMorningVoiceNoteId(experimentId)) {
      throw new LucidMorningVoiceNoteError('invalid_id', 'Experiment id is invalid');
    }
    const envelope = await loadEnvelope(userScope, storage);
    const linked = envelope.notes.filter((note) => note.experimentId === experimentId);
    if (linked.length === 0) return [];

    const now = options?.now ?? Date.now();
    const unlinked = linked.map((note) => {
      const next: LucidMorningVoiceNote = {
        ...note,
        experimentId: null,
        updatedAt: Math.max(now, note.updatedAt, note.createdAt),
      };
      assertLucidMorningVoiceNote(next);
      return next;
    });
    const replacements = new Map(unlinked.map((note) => [note.id, note]));
    await saveEnvelope(
      {
        ...envelope,
        notes: envelope.notes.map((note) => replacements.get(note.id) ?? note),
      },
      storage
    );
    return unlinked;
  });
}

export async function deleteLucidMorningVoiceNote(
  userScope: string,
  noteId: string,
  options?: { storage?: AsyncKeyValueStorage; files?: LucidMorningVoiceFileAdapter }
): Promise<LucidMorningVoiceNote | null> {
  const storage = options?.storage ?? getLucidKeyValueStorage();
  const files = options?.files ?? createNativeFileAdapter();
  return withScopeLock(assertScope(userScope), async () => {
    const envelope = await loadEnvelope(userScope, storage);
    const current = findNote(envelope, assertNoteId(noteId));
    if (!current) return null;
    await deleteNoteFromEnvelope(envelope, current, storage, files);
    return current;
  });
}

export async function clearLucidMorningVoiceNotes(
  userScope: string,
  options?: { storage?: AsyncKeyValueStorage; files?: LucidMorningVoiceFileAdapter }
): Promise<void> {
  const storage = options?.storage ?? getLucidKeyValueStorage();
  const files = options?.files ?? createNativeFileAdapter();
  await withScopeLock(assertScope(userScope), async () => {
    let envelope = await loadEnvelope(userScope, storage);
    for (const note of [...envelope.notes]) {
      envelope = await deleteNoteFromEnvelope(envelope, note, storage, files);
    }
    try {
      await storage.removeItem(getLucidMorningVoiceNoteStorageKey(userScope));
    } catch (error) {
      throw persistenceError(error);
    }
  });
}


export const LUCID_MORNING_VOICE_GUEST_SCOPE = 'guest' as const;

export type LucidMorningVoiceGuestClaimResult = {
  claimed: boolean;
  transferred: number;
  skipped: number;
  retainedGuest: number;
};

function collisionSuffix(note: LucidMorningVoiceNote, targetUserScope: string): string {
  const seed = `${note.id}:${note.createdAt}:${targetUserScope}`;
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function remappedClaimedNoteId(
  note: LucidMorningVoiceNote,
  targetUserScope: string
): string {
  const suffix = collisionSuffix(note, targetUserScope);
  const prefix = note.id.slice(0, Math.max(8, 64 - 1 - suffix.length));
  const candidate = `${prefix}_${suffix}`.slice(0, 64);
  if (!isLucidMorningVoiceNoteId(candidate) || candidate === note.id) {
    throw new LucidMorningVoiceNoteError(
      'invalid_id',
      'Voice note id collision could not be resolved without overwrite'
    );
  }
  return candidate;
}

function claimedNoteIdFor(
  note: LucidMorningVoiceNote,
  occupied: ReadonlySet<string>,
  targetUserScope: string
): string {
  if (!occupied.has(note.id)) return note.id;
  return remappedClaimedNoteId(note, targetUserScope);
}

function notesMatchForIdempotentClaim(
  existing: LucidMorningVoiceNote,
  guest: LucidMorningVoiceNote
): boolean {
  return (
    existing.createdAt === guest.createdAt &&
    existing.durationMs === guest.durationMs &&
    existing.extension === guest.extension &&
    existing.mimeType === guest.mimeType &&
    existing.status === guest.status &&
    existing.title === guest.title &&
    existing.transcript === guest.transcript &&
    existing.experimentId === guest.experimentId &&
    existing.recoverable === guest.recoverable
  );
}

function expectedClaimUri(
  userScope: string,
  note: Pick<LucidMorningVoiceNote, 'id' | 'extension'>,
  files: LucidMorningVoiceFileAdapter
): string {
  return getLucidMorningVoiceNoteFileUri(userScope, note.id, note.extension, files);
}

async function discardOrphanDestinationFile(
  files: LucidMorningVoiceFileAdapter,
  destinationUri: string,
  referencedUris: ReadonlySet<string>
): Promise<void> {
  if (!(await fileExists(files, destinationUri))) return;
  if (referencedUris.has(destinationUri)) {
    throw new LucidMorningVoiceNoteError(
      'persistence_failed',
      'Local voice-note persistence failed'
    );
  }
  await discardUnpublishedDestination(files, destinationUri);
}

async function copyNoteFileOrRollback(
  files: LucidMorningVoiceFileAdapter,
  sourceUri: string,
  destinationUri: string,
  directoryUri: string,
  referencedUris: ReadonlySet<string>
): Promise<boolean> {
  await discardOrphanDestinationFile(files, destinationUri, referencedUris);
  if (!(await fileExists(files, sourceUri))) {
    throw new LucidMorningVoiceNoteError('invalid_uri', 'Voice note URI must stay local');
  }
  await fileEnsureDirectory(files, directoryUri);
  try {
    await fileCopy(files, sourceUri, destinationUri);
    if (!(await fileExists(files, destinationUri))) {
      throw new LucidMorningVoiceNoteError(
        'persistence_failed',
        'Local voice-note persistence failed'
      );
    }
    return true;
  } catch (error) {
    await discardUnpublishedDestination(files, destinationUri);
    throw persistenceError(error);
  }
}

async function rollbackCopiedClaimFiles(
  files: LucidMorningVoiceFileAdapter,
  uris: readonly string[]
): Promise<void> {
  for (const uri of [...uris].reverse()) {
    await discardUnpublishedDestination(files, uri);
  }
}

async function deleteCommittedGuestNote(
  envelope: Envelope,
  note: LucidMorningVoiceNote,
  storage: AsyncKeyValueStorage,
  files: LucidMorningVoiceFileAdapter
): Promise<Envelope> {
  try {
    return await deleteNoteFromEnvelope(envelope, note, storage, files);
  } catch (error) {
    const current = await loadEnvelope(envelope.userScope, storage);
    if (!findNote(current, note.id) && !(await fileExists(files, note.uri))) {
      return current;
    }
    throw persistenceError(error);
  }
}

/**
 * Transfers local morning-voice notes from one device scope to another.
 *
 * Trainer claim and voice files cannot share one atomic transaction. Copy the
 * files, commit the destination envelope, then purge the source. Call this
 * before `claimLucidTrainerGuestScope` so a later trainer failure still leaves
 * the audio on the account. Media never leaves the device.
 */
export async function claimLucidMorningVoiceNoteScope(
  sourceScope: string,
  targetScope: string,
  options?: {
    storage?: AsyncKeyValueStorage;
    files?: LucidMorningVoiceFileAdapter;
  }
): Promise<LucidMorningVoiceGuestClaimResult> {
  const guestScope = assertScope(sourceScope);
  const destinationScope = assertScope(targetScope);
  if (destinationScope === guestScope) {
    throw new LucidMorningVoiceNoteError(
      'invalid_scope',
      'Voice note user scope is invalid'
    );
  }
  const storage = options?.storage ?? getLucidKeyValueStorage();
  const files = options?.files ?? createNativeFileAdapter();

  return withOrderedScopeLocks([guestScope, destinationScope], async () => {
    const guestEnvelope = await loadEnvelope(guestScope, storage);
    const destinationEnvelope = await loadEnvelope(destinationScope, storage);
    if (guestEnvelope.notes.length === 0) {
      try {
        await storage.removeItem(getLucidMorningVoiceNoteStorageKey(guestScope));
      } catch {
        // An empty source envelope may already be absent.
      }
      return { claimed: false, transferred: 0, skipped: 0, retainedGuest: 0 };
    }

    const occupied = new Set(destinationEnvelope.notes.map((note) => note.id));
    const destinationById = new Map(destinationEnvelope.notes.map((note) => [note.id, note]));
    const planned: {
      guest: LucidMorningVoiceNote;
      intended: LucidMorningVoiceNote;
    }[] = [];
    const copiedUris: string[] = [];
    let skipped = 0;

    try {
      for (const guest of guestEnvelope.notes) {
        const original = destinationById.get(guest.id);
        const originalUri = expectedClaimUri(destinationScope, guest, files);
        if (
          original &&
          notesMatchForIdempotentClaim(original, guest) &&
          original.uri === originalUri
        ) {
          if (!(await fileExists(files, original.uri))) {
            throw new LucidMorningVoiceNoteError(
              'persistence_failed',
              'Local voice-note persistence failed'
            );
          }
          skipped += 1;
          planned.push({ guest, intended: original });
          continue;
        }

        const claimedId = claimedNoteIdFor(guest, occupied, destinationScope);
        const destinationUri = expectedClaimUri(
          destinationScope,
          { id: claimedId, extension: guest.extension },
          files
        );
        const existing = destinationById.get(claimedId);
        if (existing) {
          if (
            !notesMatchForIdempotentClaim(existing, guest) ||
            existing.uri !== destinationUri
          ) {
            throw new LucidMorningVoiceNoteError(
              'invalid_id',
              'Voice note id collision could not be resolved without overwrite'
            );
          }
          if (!(await fileExists(files, existing.uri))) {
            throw new LucidMorningVoiceNoteError(
              'persistence_failed',
              'Local voice-note persistence failed'
            );
          }
          skipped += 1;
          planned.push({ guest, intended: existing });
          continue;
        }

        const intended = createLucidMorningVoiceNote({
          id: claimedId,
          userScope: destinationScope,
          experimentId: guest.experimentId,
          status: guest.status,
          title: guest.title,
          transcript: guest.transcript,
          durationMs: guest.durationMs,
          mimeType: guest.mimeType,
          extension: guest.extension,
          uri: destinationUri,
          createdAt: guest.createdAt,
          updatedAt: guest.updatedAt,
          recoverable: guest.recoverable,
          now: guest.updatedAt,
        });
        const referencedUris = new Set([
          ...destinationEnvelope.notes.map((note) => note.uri),
          ...planned.map((item) => item.intended.uri),
        ]);
        const copied = await copyNoteFileOrRollback(
          files,
          guest.uri,
          destinationUri,
          getLucidMorningVoiceNoteDirectoryUri(destinationScope, files),
          referencedUris
        );
        if (copied) copiedUris.push(destinationUri);
        planned.push({ guest, intended });
        occupied.add(claimedId);
        destinationById.set(claimedId, intended);
      }

      const committedNotes = planned.map((item) => item.intended);
      const nextDestination: Envelope = {
        ...destinationEnvelope,
        notes: sortNotes([
          ...destinationEnvelope.notes.filter(
            (note) => !committedNotes.some((item) => item.id === note.id)
          ),
          ...committedNotes,
        ]),
      };
      await saveEnvelope(nextDestination, storage);
    } catch (error) {
      await rollbackCopiedClaimFiles(files, copiedUris);
      throw persistenceError(error);
    }

    let remainingGuest = guestEnvelope;
    for (const item of planned) {
      remainingGuest = await deleteCommittedGuestNote(
        remainingGuest,
        item.guest,
        storage,
        files
      );
    }
    try {
      await storage.removeItem(getLucidMorningVoiceNoteStorageKey(guestScope));
    } catch (error) {
      if (remainingGuest.notes.length > 0) throw persistenceError(error);
    }

    return {
      claimed: planned.length > 0,
      transferred: planned.length - skipped,
      skipped,
      retainedGuest: 0,
    };
  });
}
