import {
  createLucidMorningVoiceNote,
  LucidMorningVoiceNoteError,
} from '@/lib/lucid/morningVoiceNote';
import {
  claimLucidMorningVoiceNoteScope,
  clearLucidMorningVoiceNotes,
  countLucidMorningVoiceNoteScopeLocksForTests,
  deleteLucidMorningVoiceNote,
  getLucidMorningVoiceNote,
  getLucidMorningVoiceNoteByExperimentId,
  getLucidMorningVoiceNoteFileUri,
  getLucidMorningVoiceNoteStorageKey,
  linkStoredLucidMorningVoiceNoteToExperiment,
  loadLucidMorningVoiceNotes,
  persistLucidMorningVoiceNoteFromRecorder,
  renameStoredLucidMorningVoiceNote,
  updateStoredLucidMorningVoiceNoteTranscript,
  type LucidMorningVoiceFileAdapter,
} from '@/services/lucidMorningVoiceNoteStorage';

const NOW = Date.UTC(2026, 7, 28, 7, 20, 0);
const SOURCE = 'file:///tmp/recorder/temp-voice.m4a';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

function memoryKv() {
  const memory = new Map<string, string>();
  return {
    memory,
    storage: {
      getItem: jest.fn(async (key: string) => memory.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        memory.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        memory.delete(key);
      }),
    },
  };
}

function memoryFiles(initial: string[] = [SOURCE]): LucidMorningVoiceFileAdapter & {
  files: Set<string>;
  copies: { from: string; to: string }[];
  moves: { from: string; to: string }[];
} {
  const files = new Set(initial);
  const copies: { from: string; to: string }[] = [];
  const moves: { from: string; to: string }[] = [];
  return {
    files,
    copies,
    moves,
    async exists(uri: string) {
      return files.has(uri);
    },
    async ensureDirectory() {
      return;
    },
    async copy(fromUri: string, toUri: string) {
      if (!files.has(fromUri)) throw new Error('missing source');
      files.add(toUri);
      copies.push({ from: fromUri, to: toUri });
    },
    async move(fromUri: string, toUri: string) {
      if (!files.has(fromUri)) throw new Error('missing source');
      files.delete(fromUri);
      files.add(toUri);
      moves.push({ from: fromUri, to: toUri });
    },
    async delete(uri: string) {
      files.delete(uri);
    },
    documentDirectoryUri() {
      return 'file:///data/user/0/app/files';
    },
  };
}

describe('Lucid morning voice-note local storage', () => {
  it('promotes a recorder temp file before metadata, then deletes the source', async () => {
    const { storage } = memoryKv();
    const files = memoryFiles();
    const note = await persistLucidMorningVoiceNoteFromRecorder({
      userScope: 'guest',
      sourceUri: SOURCE,
      mimeType: 'audio/mp4',
      extension: '.m4a',
      durationMs: 0,
      status: 'draft',
      title: 'Morning capture',
      noteId: 'mvn_recording_draft01',
      now: NOW,
      storage,
      files,
    });
    expect(getLucidMorningVoiceNoteStorageKey('guest')).toBe(
      'noctalia_lucid_morning_voice:guest:notes_v1'
    );
    expect(getLucidMorningVoiceNoteStorageKey('guest')).not.toContain('noctalia_lucid_trainer');
    expect(note.uri).toBe(
      getLucidMorningVoiceNoteFileUri('guest', 'mvn_recording_draft01', '.m4a', files)
    );
    expect(files.copies).toEqual([{ from: SOURCE, to: note.uri }]);
    expect(files.files.has(SOURCE)).toBe(false);
    expect(files.files.has(note.uri)).toBe(true);
    await expect(loadLucidMorningVoiceNotes('guest', storage)).resolves.toEqual([note]);
    expect(JSON.stringify(storage.setItem.mock.calls)).not.toMatch(/upload|cloud|sync/i);
  });

  it('keeps durable metadata if source cleanup fails after a successful persist', async () => {
    const { storage } = memoryKv();
    const files = memoryFiles();
    const originalDelete = files.delete.bind(files);
    files.delete = jest.fn(async (uri: string) => {
      if (uri === SOURCE) throw new Error('temp leftover');
      return originalDelete(uri);
    });
    const note = await persistLucidMorningVoiceNoteFromRecorder({
      userScope: 'guest',
      sourceUri: SOURCE,
      mimeType: 'audio/mp4',
      extension: '.m4a',
      durationMs: 0,
      status: 'draft',
      title: 'Morning capture',
      noteId: 'mvn_recording_draft05',
      now: NOW,
      storage,
      files,
    });
    expect(files.files.has(SOURCE)).toBe(true);
    expect(files.files.has(note.uri)).toBe(true);
    await expect(getLucidMorningVoiceNote('guest', note.id, storage)).resolves.toEqual(note);
  });

  it('cleans a partial copy if copy throws after creating the destination', async () => {
    const { storage } = memoryKv();
    const files = memoryFiles();
    files.copy = jest.fn(async (fromUri: string, toUri: string) => {
      files.files.add(toUri);
      files.copies.push({ from: fromUri, to: toUri });
      throw new Error('copy interrupted');
    });
    await expect(
      persistLucidMorningVoiceNoteFromRecorder({
        userScope: 'guest',
        sourceUri: SOURCE,
        mimeType: 'audio/mp4',
        extension: '.m4a',
        durationMs: 400,
        noteId: 'mvn_recording_partcopy',
        now: NOW,
        storage,
        files,
      })
    ).rejects.toMatchObject({ reason: 'persistence_failed' });
    expect(files.files.has(SOURCE)).toBe(true);
    expect(
      files.files.has(getLucidMorningVoiceNoteFileUri('guest', 'mvn_recording_partcopy', '.m4a', files))
    ).toBe(false);
  });

  it('cleans a destination if post-copy verification fails', async () => {
    const { storage } = memoryKv();
    const files = memoryFiles();
    const originalExists = files.exists.bind(files);
    let checks = 0;
    files.exists = jest.fn(async (uri: string) => {
      const destination = getLucidMorningVoiceNoteFileUri('guest', 'mvn_recording_postcopy', '.m4a', files);
      if (uri === destination) {
        checks += 1;
        if (checks === 2) throw new Error('exists failed');
      }
      return originalExists(uri);
    });
    await expect(
      persistLucidMorningVoiceNoteFromRecorder({
        userScope: 'guest',
        sourceUri: SOURCE,
        mimeType: 'audio/mp4',
        extension: '.m4a',
        durationMs: 400,
        noteId: 'mvn_recording_postcopy',
        now: NOW,
        storage,
        files,
      })
    ).rejects.toMatchObject({ reason: 'persistence_failed' });
    expect(files.files.has(SOURCE)).toBe(true);
    expect(
      files.files.has(getLucidMorningVoiceNoteFileUri('guest', 'mvn_recording_postcopy', '.m4a', files))
    ).toBe(false);
  });

  it('keeps the source and deletes the copy if metadata write fails', async () => {
    const { storage } = memoryKv();
    storage.setItem.mockRejectedValueOnce(new Error('kv down'));
    const files = memoryFiles();
    await expect(
      persistLucidMorningVoiceNoteFromRecorder({
        userScope: 'guest',
        sourceUri: SOURCE,
        mimeType: 'audio/mp4',
        extension: '.m4a',
        durationMs: 1200,
        status: 'ready',
        noteId: 'mvn_recording_ready01',
        now: NOW,
        storage,
        files,
      })
    ).rejects.toMatchObject({ reason: 'persistence_failed' });
    expect(files.files.has(SOURCE)).toBe(true);
    expect(
      files.files.has(getLucidMorningVoiceNoteFileUri('guest', 'mvn_recording_ready01', '.m4a', files))
    ).toBe(false);
  });

  it('does not delete the source if promoted destination cleanup also fails', async () => {
    const { storage } = memoryKv();
    storage.setItem.mockRejectedValueOnce(new Error('kv down'));
    const files = memoryFiles();
    const originalDelete = files.delete.bind(files);
    files.delete = jest.fn(async (uri: string) => {
      if (uri.includes('mvn_recording_ready03')) throw new Error('cleanup failed');
      return originalDelete(uri);
    });
    await expect(
      persistLucidMorningVoiceNoteFromRecorder({
        userScope: 'guest',
        sourceUri: SOURCE,
        mimeType: 'audio/mp4',
        extension: '.m4a',
        durationMs: 1200,
        status: 'ready',
        noteId: 'mvn_recording_ready03',
        now: NOW,
        storage,
        files,
      })
    ).rejects.toMatchObject({ reason: 'persistence_failed' });
    expect(files.files.has(SOURCE)).toBe(true);
    expect(
      files.files.has(getLucidMorningVoiceNoteFileUri('guest', 'mvn_recording_ready03', '.m4a', files))
    ).toBe(true);
  });

  it('retries metadata finalization after source cleanup without replacing durable audio', async () => {
    const { storage } = memoryKv();
    const files = memoryFiles();
    const first = await persistLucidMorningVoiceNoteFromRecorder({
      userScope: 'guest',
      sourceUri: SOURCE,
      mimeType: 'audio/mp4',
      extension: '.m4a',
      durationMs: 900,
      status: 'draft',
      noteId: 'mvn_recording_draft02',
      now: NOW,
      storage,
      files,
    });
    const second = await persistLucidMorningVoiceNoteFromRecorder({
      userScope: 'guest',
      sourceUri: SOURCE,
      mimeType: 'audio/mp4',
      extension: '.m4a',
      durationMs: 900,
      status: 'ready',
      noteId: 'mvn_recording_draft02',
      storage,
      files,
    });
    expect(files.copies).toHaveLength(1);
    expect(files.files.has(SOURCE)).toBe(false);
    expect(second.uri).toBe(first.uri);
    expect(second.status).toBe('ready');
    expect(second.durationMs).toBe(900);
  });

  it('rejects a duration change against an unchanged durable file', async () => {
    const { storage } = memoryKv();
    const files = memoryFiles();
    await persistLucidMorningVoiceNoteFromRecorder({
      userScope: 'guest',
      sourceUri: SOURCE,
      mimeType: 'audio/mp4',
      extension: '.m4a',
      durationMs: 900,
      status: 'draft',
      noteId: 'mvn_recording_draft04',
      now: NOW,
      storage,
      files,
    });
    await expect(
      persistLucidMorningVoiceNoteFromRecorder({
        userScope: 'guest',
        sourceUri: SOURCE,
        mimeType: 'audio/mp4',
        extension: '.m4a',
        durationMs: 1800,
        status: 'ready',
        noteId: 'mvn_recording_draft04',
        now: NOW + 1,
        storage,
        files,
      })
    ).rejects.toMatchObject({ reason: 'invalid_duration' });
    const stored = await getLucidMorningVoiceNote('guest', 'mvn_recording_draft04', storage);
    expect(stored?.durationMs).toBe(900);
    expect(stored?.status).toBe('draft');
  });

  it('rejects a different extension or mime on an existing note', async () => {
    const { storage } = memoryKv();
    const files = memoryFiles();
    await persistLucidMorningVoiceNoteFromRecorder({
      userScope: 'guest',
      sourceUri: SOURCE,
      mimeType: 'audio/mp4',
      extension: '.m4a',
      durationMs: 900,
      noteId: 'mvn_recording_draft03',
      now: NOW,
      storage,
      files,
    });
    files.files.add('file:///tmp/recorder/temp-voice.caf');
    await expect(
      persistLucidMorningVoiceNoteFromRecorder({
        userScope: 'guest',
        sourceUri: 'file:///tmp/recorder/temp-voice.caf',
        mimeType: 'audio/x-caf',
        extension: '.caf',
        durationMs: 900,
        noteId: 'mvn_recording_draft03',
        now: NOW + 1,
        storage,
        files,
      })
    ).rejects.toMatchObject({ reason: 'invalid_uri' });
    expect(files.files.has(getLucidMorningVoiceNoteFileUri('guest', 'mvn_recording_draft03', '.m4a', files))).toBe(true);
    expect(files.files.has(getLucidMorningVoiceNoteFileUri('guest', 'mvn_recording_draft03', '.caf', files))).toBe(false);
  });

  it('does not bind an orphan destination file to a new note', async () => {
    const { storage } = memoryKv();
    const files = memoryFiles();
    const destination = getLucidMorningVoiceNoteFileUri('guest', 'mvn_recording_orph01', '.m4a', files);
    files.files.add(destination);
    await expect(
      persistLucidMorningVoiceNoteFromRecorder({
        userScope: 'guest',
        sourceUri: SOURCE,
        mimeType: 'audio/mp4',
        extension: '.m4a',
        durationMs: 400,
        noteId: 'mvn_recording_orph01',
        now: NOW,
        storage,
        files,
      })
    ).rejects.toMatchObject({ reason: 'persistence_failed' });
    expect(files.files.has(SOURCE)).toBe(true);
    expect(files.copies).toEqual([]);
    await expect(loadLucidMorningVoiceNotes('guest', storage)).resolves.toEqual([]);
  });

  it('cleans scope locks after many serialized operations', async () => {
    const { storage } = memoryKv();
    for (let index = 0; index < 8; index += 1) {
      const files = memoryFiles([`file:///tmp/recorder/s${index}.m4a`]);
      await persistLucidMorningVoiceNoteFromRecorder({
        userScope: `user-${index}`,
        sourceUri: `file:///tmp/recorder/s${index}.m4a`,
        mimeType: 'audio/mp4',
        extension: '.m4a',
        durationMs: 100,
        noteId: `mvn_recording_lock0${index}`,
        now: NOW + index,
        storage,
        files,
      });
    }
    expect(countLucidMorningVoiceNoteScopeLocksForTests()).toBe(0);
  });

  it('classifies ENOSPC as storage_full without leaking audio content', async () => {
    const { storage } = memoryKv();
    const files = memoryFiles();
    files.copy = jest.fn(async () => {
      throw new Error('ENOSPC: no space left');
    });
    await expect(
      persistLucidMorningVoiceNoteFromRecorder({
        userScope: 'guest',
        sourceUri: SOURCE,
        mimeType: 'audio/mp4',
        extension: '.m4a',
        durationMs: 0,
        noteId: 'mvn_recording_full01',
        now: NOW,
        storage,
        files,
      })
    ).rejects.toMatchObject({ reason: 'storage_full' });
    try {
      await persistLucidMorningVoiceNoteFromRecorder({
        userScope: 'guest',
        sourceUri: SOURCE,
        mimeType: 'audio/mp4',
        extension: '.m4a',
        durationMs: 0,
        noteId: 'mvn_recording_full02',
        now: NOW,
        storage,
        files,
      });
    } catch (error) {
      expect(String(error)).not.toMatch(/I dreamed|transcript|http/i);
    }
  });

  it('rejects a zero-duration ready promotion and mismatched media', async () => {
    const { storage } = memoryKv();
    const files = memoryFiles();
    await expect(
      persistLucidMorningVoiceNoteFromRecorder({
        userScope: 'guest',
        sourceUri: SOURCE,
        mimeType: 'audio/mp4',
        extension: '.m4a',
        durationMs: 0,
        status: 'ready',
        noteId: 'mvn_recording_ready00',
        now: NOW,
        storage,
        files,
      })
    ).rejects.toMatchObject({ reason: 'invalid_duration' });
    await expect(
      persistLucidMorningVoiceNoteFromRecorder({
        userScope: 'guest',
        sourceUri: SOURCE,
        mimeType: 'audio/wav',
        extension: '.m4a',
        durationMs: 100,
        noteId: 'mvn_recording_mime01',
        now: NOW,
        storage,
        files,
      })
    ).rejects.toBeInstanceOf(LucidMorningVoiceNoteError);
  });

  it('removes corrupt and wrong-scope envelopes instead of exposing them', async () => {
    const { memory, storage } = memoryKv();
    const key = getLucidMorningVoiceNoteStorageKey('guest');
    await storage.setItem(key, '{not-json');
    await expect(loadLucidMorningVoiceNotes('guest', storage)).resolves.toEqual([]);
    expect(memory.has(key)).toBe(false);

    await storage.setItem(
      key,
      JSON.stringify({
        version: 1,
        userScope: 'someone-else',
        notes: [
          createLucidMorningVoiceNote({
            id: 'mvn_recording_scope01',
            userScope: 'someone-else',
            durationMs: 100,
            mimeType: 'audio/mp4',
            extension: '.m4a',
            uri: 'file:///tmp/a.m4a',
            now: NOW,
          }),
        ],
      })
    );
    await expect(loadLucidMorningVoiceNotes('guest', storage)).resolves.toEqual([]);
    expect(memory.has(key)).toBe(false);

    const extra = createLucidMorningVoiceNote({
      id: 'mvn_recording_extra01',
      userScope: 'guest',
      durationMs: 100,
      mimeType: 'audio/mp4',
      extension: '.m4a',
      uri: 'file:///data/user/0/app/files/noctalia-lucid-morning-voice/guest/mvn_recording_extra01.m4a',
      now: NOW,
    });
    await storage.setItem(
      key,
      JSON.stringify({
        version: 1,
        userScope: 'guest',
        notes: [extra],
        extra: true,
      })
    );
    await expect(loadLucidMorningVoiceNotes('guest', storage)).resolves.toEqual([]);
    expect(memory.has(key)).toBe(false);

    const valid = createLucidMorningVoiceNote({
      id: 'mvn_recording_dupl01',
      userScope: 'guest',
      durationMs: 100,
      mimeType: 'audio/mp4',
      extension: '.m4a',
      uri: 'file:///data/user/0/app/files/noctalia-lucid-morning-voice/guest/mvn_recording_dupl01.m4a',
      now: NOW,
    });
    await storage.setItem(
      key,
      JSON.stringify({
        version: 1,
        userScope: 'guest',
        notes: [valid, valid],
      })
    );
    await expect(loadLucidMorningVoiceNotes('guest', storage)).resolves.toEqual([]);
    expect(memory.has(key)).toBe(false);
  });

  it('serializes concurrent upserts and keeps unique ids', async () => {
    const { storage } = memoryKv();
    const files = memoryFiles([
      'file:///tmp/recorder/a.m4a',
      'file:///tmp/recorder/b.m4a',
    ]);
    await Promise.all([
      persistLucidMorningVoiceNoteFromRecorder({
        userScope: 'guest',
        sourceUri: 'file:///tmp/recorder/a.m4a',
        mimeType: 'audio/mp4',
        extension: '.m4a',
        durationMs: 100,
        noteId: 'mvn_recording_conc01',
        now: NOW,
        storage,
        files,
      }),
      persistLucidMorningVoiceNoteFromRecorder({
        userScope: 'guest',
        sourceUri: 'file:///tmp/recorder/b.m4a',
        mimeType: 'audio/mp4',
        extension: '.m4a',
        durationMs: 200,
        noteId: 'mvn_recording_conc02',
        now: NOW + 1,
        storage,
        files,
      }),
    ]);
    const notes = await loadLucidMorningVoiceNotes('guest', storage);
    expect(notes.map((note) => note.id)).toEqual([
      'mvn_recording_conc01',
      'mvn_recording_conc02',
    ]);
  });

  it('renames, edits transcript, links experiment and queries by experiment id', async () => {
    const { storage } = memoryKv();
    const files = memoryFiles();
    const note = await persistLucidMorningVoiceNoteFromRecorder({
      userScope: 'guest',
      sourceUri: SOURCE,
      mimeType: 'audio/mp4',
      extension: '.m4a',
      durationMs: 400,
      noteId: 'mvn_recording_link01',
      now: NOW,
      storage,
      files,
    });
    const renamed = await renameStoredLucidMorningVoiceNote('guest', note.id, '  Recalled\n dream ', {
      now: NOW + 1,
      storage,
    });
    expect(renamed.title).toBe('Recalled dream');
    const edited = await updateStoredLucidMorningVoiceNoteTranscript(
      'guest',
      note.id,
      'I noticed my hands',
      { now: NOW + 2, storage }
    );
    expect(edited.transcript).toBe('I noticed my hands');
    const linked = await linkStoredLucidMorningVoiceNoteToExperiment(
      'guest',
      note.id,
      'exp_morning_link01',
      { now: NOW + 3, storage }
    );
    expect(linked.experimentId).toBe('exp_morning_link01');
    await expect(
      getLucidMorningVoiceNoteByExperimentId('guest', 'exp_morning_link01', storage)
    ).resolves.toEqual(linked);
    await expect(getLucidMorningVoiceNote('guest', note.id, storage)).resolves.toEqual(linked);
  });

  it('quarantines the file before metadata delete and rolls back if metadata fails', async () => {
    const { storage } = memoryKv();
    const files = memoryFiles();
    const note = await persistLucidMorningVoiceNoteFromRecorder({
      userScope: 'guest',
      sourceUri: SOURCE,
      mimeType: 'audio/mp4',
      extension: '.m4a',
      durationMs: 700,
      noteId: 'mvn_recording_del01',
      now: NOW,
      storage,
      files,
    });
    storage.setItem.mockRejectedValueOnce(new Error('kv down'));
    await expect(
      deleteLucidMorningVoiceNote('guest', note.id, { storage, files })
    ).rejects.toMatchObject({ reason: 'persistence_failed' });
    expect(files.files.has(note.uri)).toBe(true);
    await expect(getLucidMorningVoiceNote('guest', note.id, storage)).resolves.toMatchObject({
      id: note.id,
    });

    await deleteLucidMorningVoiceNote('guest', note.id, { storage, files });
    await expect(getLucidMorningVoiceNote('guest', note.id, storage)).resolves.toBeNull();
    expect(files.files.has(note.uri)).toBe(false);
    await expect(deleteLucidMorningVoiceNote('guest', note.id, { storage, files })).resolves.toBeUndefined();
  });

  it('restores metadata and audio if quarantine purge fails', async () => {
    const { storage } = memoryKv();
    const files = memoryFiles();
    const note = await persistLucidMorningVoiceNoteFromRecorder({
      userScope: 'guest',
      sourceUri: SOURCE,
      mimeType: 'audio/mp4',
      extension: '.m4a',
      durationMs: 700,
      noteId: 'mvn_recording_del02',
      now: NOW,
      storage,
      files,
    });
    const originalDelete = files.delete.bind(files);
    files.delete = jest.fn(async (uri: string) => {
      if (uri.endsWith('.deleting')) throw new Error('purge failed');
      return originalDelete(uri);
    });
    await expect(deleteLucidMorningVoiceNote('guest', note.id, { storage, files })).rejects.toMatchObject({
      reason: 'persistence_failed',
    });
    await expect(getLucidMorningVoiceNote('guest', note.id, storage)).resolves.toMatchObject({
      id: note.id,
      uri: note.uri,
    });
    expect(files.files.has(note.uri)).toBe(true);
    expect(files.files.has(`${note.uri}.deleting`)).toBe(false);
  });

  it('finishes a prior-crash delete where only the quarantine file remains', async () => {
    const { storage } = memoryKv();
    const files = memoryFiles();
    const note = await persistLucidMorningVoiceNoteFromRecorder({
      userScope: 'guest',
      sourceUri: SOURCE,
      mimeType: 'audio/mp4',
      extension: '.m4a',
      durationMs: 700,
      noteId: 'mvn_recording_del03',
      now: NOW,
      storage,
      files,
    });
    files.files.delete(note.uri);
    files.files.add(`${note.uri}.deleting`);
    await deleteLucidMorningVoiceNote('guest', note.id, { storage, files });
    await expect(getLucidMorningVoiceNote('guest', note.id, storage)).resolves.toBeNull();
    expect(files.files.has(note.uri)).toBe(false);
    expect(files.files.has(`${note.uri}.deleting`)).toBe(false);
  });

  it('clears the scope and reports leftover files', async () => {
    const { memory, storage } = memoryKv();
    const files = memoryFiles();
    const note = await persistLucidMorningVoiceNoteFromRecorder({
      userScope: 'guest',
      sourceUri: SOURCE,
      mimeType: 'audio/mp4',
      extension: '.m4a',
      durationMs: 500,
      noteId: 'mvn_recording_clr01',
      now: NOW,
      storage,
      files,
    });
    await clearLucidMorningVoiceNotes('guest', { storage, files });
    expect(memory.size).toBe(0);
    expect(files.files.has(note.uri)).toBe(false);

    files.files.add(SOURCE);
    const leftover = await persistLucidMorningVoiceNoteFromRecorder({
      userScope: 'guest',
      sourceUri: SOURCE,
      mimeType: 'audio/mp4',
      extension: '.m4a',
      durationMs: 500,
      noteId: 'mvn_recording_clr02',
      now: NOW,
      storage,
      files,
    });
    const originalDelete = files.delete.bind(files);
    files.delete = jest.fn(async (uri: string) => {
      if (uri === leftover.uri || uri.endsWith('.deleting')) throw new Error('still there');
      return originalDelete(uri);
    });
    await expect(clearLucidMorningVoiceNotes('guest', { storage, files })).rejects.toMatchObject({
      reason: 'persistence_failed',
    });
    await expect(getLucidMorningVoiceNote('guest', leftover.id, storage)).resolves.toMatchObject({
      id: leftover.id,
    });

    files.delete = originalDelete;
    await clearLucidMorningVoiceNotes('guest', { storage, files });
    await expect(loadLucidMorningVoiceNotes('guest', storage)).resolves.toEqual([]);
  });

  it('keeps an empty envelope if metadata key removal fails after files are gone', async () => {
    const { memory, storage } = memoryKv();
    const files = memoryFiles();
    const note = await persistLucidMorningVoiceNoteFromRecorder({
      userScope: 'guest',
      sourceUri: SOURCE,
      mimeType: 'audio/mp4',
      extension: '.m4a',
      durationMs: 500,
      noteId: 'mvn_recording_clr03',
      now: NOW,
      storage,
      files,
    });
    storage.removeItem.mockRejectedValueOnce(new Error('kv down'));
    await expect(clearLucidMorningVoiceNotes('guest', { storage, files })).rejects.toMatchObject({
      reason: 'persistence_failed',
    });
    expect(files.files.has(note.uri)).toBe(false);
    expect(files.files.has(`${note.uri}.deleting`)).toBe(false);
    const leftover = JSON.parse(memory.get(getLucidMorningVoiceNoteStorageKey('guest')) ?? '{"notes":["x"]}');
    expect(leftover.notes).toEqual([]);
    storage.removeItem.mockImplementation(async (key: string) => {
      memory.delete(key);
    });
    await clearLucidMorningVoiceNotes('guest', { storage, files });
    expect(memory.size).toBe(0);
  });
  it('keeps remaining notes referenced when a later clear deletion fails', async () => {
    const { storage } = memoryKv();
    const files = memoryFiles(['file:///tmp/recorder/a.m4a', 'file:///tmp/recorder/b.m4a']);
    const first = await persistLucidMorningVoiceNoteFromRecorder({
      userScope: 'guest',
      sourceUri: 'file:///tmp/recorder/a.m4a',
      mimeType: 'audio/mp4',
      extension: '.m4a',
      durationMs: 100,
      noteId: 'mvn_recording_part01',
      now: NOW,
      storage,
      files,
    });
    const second = await persistLucidMorningVoiceNoteFromRecorder({
      userScope: 'guest',
      sourceUri: 'file:///tmp/recorder/b.m4a',
      mimeType: 'audio/mp4',
      extension: '.m4a',
      durationMs: 200,
      noteId: 'mvn_recording_part02',
      storage,
      files,
    });
    const originalDelete = files.delete.bind(files);
    files.delete = jest.fn(async (uri: string) => {
      if (uri === second.uri || uri === `${second.uri}.deleting`) throw new Error('second remains');
      return originalDelete(uri);
    });
    await expect(clearLucidMorningVoiceNotes('guest', { storage, files })).rejects.toMatchObject({
      reason: 'persistence_failed',
    });
    const remaining = await loadLucidMorningVoiceNotes('guest', storage);
    expect(remaining.map((note) => note.id)).toEqual([second.id]);
    expect(files.files.has(first.uri)).toBe(false);
    files.delete = originalDelete;
    await clearLucidMorningVoiceNotes('guest', { storage, files });
    await expect(loadLucidMorningVoiceNotes('guest', storage)).resolves.toEqual([]);
  });
});

describe('Lucid morning voice-note guest claim', () => {
  const ACCOUNT = 'user:user-1';
  const GUEST_A = 'mvn_recording_claimA1';
  const GUEST_B = 'mvn_recording_claimB1';
  const ACCOUNT_A = 'mvn_recording_acctA1';

  async function persistNote(params: {
    userScope: string;
    noteId: string;
    sourceUri: string;
    storage: ReturnType<typeof memoryKv>['storage'];
    files: ReturnType<typeof memoryFiles>;
    title?: string;
    durationMs?: number;
    now?: number;
  }) {
    return persistLucidMorningVoiceNoteFromRecorder({
      userScope: params.userScope,
      sourceUri: params.sourceUri,
      mimeType: 'audio/mp4',
      extension: '.m4a',
      durationMs: params.durationMs ?? 900,
      status: 'ready',
      title: params.title ?? 'Guest recall',
      noteId: params.noteId,
      now: params.now ?? NOW,
      storage: params.storage,
      files: params.files,
    });
  }

  it('copies guest audio and metadata into the account then purges guest without orphans', async () => {
    const { storage } = memoryKv();
    const sourceA = 'file:///tmp/recorder/claim-a.m4a';
    const sourceB = 'file:///tmp/recorder/claim-b.m4a';
    const files = memoryFiles([sourceA, sourceB]);
    const guestA = await persistNote({
      userScope: 'guest',
      noteId: GUEST_A,
      sourceUri: sourceA,
      storage,
      files,
      title: 'First recall',
    });
    const guestB = await persistNote({
      userScope: 'guest',
      noteId: GUEST_B,
      sourceUri: sourceB,
      storage,
      files,
      title: 'Second recall',
      now: NOW + 1,
    });

    const result = await claimLucidMorningVoiceNoteScope('guest', ACCOUNT, {
      storage,
      files,
    });
    expect(result).toEqual({ claimed: true, transferred: 2, skipped: 0, retainedGuest: 0 });
    const accountNotes = await loadLucidMorningVoiceNotes(ACCOUNT, storage);
    expect(accountNotes.map((note) => note.id).sort()).toEqual([GUEST_A, GUEST_B].sort());
    expect(accountNotes.every((note) => note.userScope === ACCOUNT)).toBe(true);
    expect(accountNotes.every((note) => note.uri.startsWith(getLucidMorningVoiceNoteFileUri(ACCOUNT, note.id, '.m4a', files).slice(0, -4)))).toBe(true);
    for (const note of accountNotes) {
      expect(files.files.has(note.uri)).toBe(true);
      expect(note.uri).toBe(getLucidMorningVoiceNoteFileUri(ACCOUNT, note.id, '.m4a', files));
    }
    await expect(loadLucidMorningVoiceNotes('guest', storage)).resolves.toEqual([]);
    expect(files.files.has(guestA.uri)).toBe(false);
    expect(files.files.has(guestB.uri)).toBe(false);
    expect(JSON.stringify(storage.setItem.mock.calls)).not.toMatch(/upload|cloud|sync|http/i);
    expect(countLucidMorningVoiceNoteScopeLocksForTests()).toBe(0);
  });

  it('keeps an existing account note and assigns a deterministic id on collision', async () => {
    const { storage } = memoryKv();
    const sourceGuest = 'file:///tmp/recorder/claim-collision-guest.m4a';
    const sourceAccount = 'file:///tmp/recorder/claim-collision-account.m4a';
    const files = memoryFiles([sourceGuest, sourceAccount]);
    const accountNote = await persistNote({
      userScope: ACCOUNT,
      noteId: GUEST_A,
      sourceUri: sourceAccount,
      storage,
      files,
      title: 'Account original',
      durationMs: 400,
    });
    const guestNote = await persistNote({
      userScope: 'guest',
      noteId: GUEST_A,
      sourceUri: sourceGuest,
      storage,
      files,
      title: 'Guest original',
      durationMs: 1200,
    });

    const result = await claimLucidMorningVoiceNoteScope('guest', ACCOUNT, {
      storage,
      files,
    });
    expect(result.transferred).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.retainedGuest).toBe(0);
    const accountNotes = await loadLucidMorningVoiceNotes(ACCOUNT, storage);
    const kept = accountNotes.find((note) => note.id === GUEST_A);
    const moved = accountNotes.find((note) => note.id !== GUEST_A);
    expect(kept).toEqual(accountNote);
    expect(moved).toMatchObject({
      userScope: ACCOUNT,
      title: 'Guest original',
      durationMs: 1200,
    });
    expect(moved?.id).not.toBe(GUEST_A);
    expect(files.files.has(accountNote.uri)).toBe(true);
    expect(files.files.has(guestNote.uri)).toBe(false);
    expect(files.files.has(moved?.uri ?? '')).toBe(true);

    const retry = await claimLucidMorningVoiceNoteScope('guest', ACCOUNT, {
      storage,
      files,
    });
    expect(retry).toEqual({ claimed: false, transferred: 0, skipped: 0, retainedGuest: 0 });
    await expect(loadLucidMorningVoiceNotes(ACCOUNT, storage)).resolves.toEqual(accountNotes);
  });

  it('rolls back destination copies when a file copy fails and keeps guest intact', async () => {
    const { storage } = memoryKv();
    const sourceA = 'file:///tmp/recorder/claim-fail-a.m4a';
    const sourceB = 'file:///tmp/recorder/claim-fail-b.m4a';
    const files = memoryFiles([sourceA, sourceB]);
    const guestA = await persistNote({
      userScope: 'guest',
      noteId: GUEST_A,
      sourceUri: sourceA,
      storage,
      files,
    });
    const guestB = await persistNote({
      userScope: 'guest',
      noteId: GUEST_B,
      sourceUri: sourceB,
      storage,
      files,
      now: NOW + 2,
    });
    const originalCopy = files.copy.bind(files);
    files.copy = jest.fn(async (fromUri: string, toUri: string) => {
      if (fromUri === guestB.uri) throw new Error('copy interrupted');
      return originalCopy(fromUri, toUri);
    });

    await expect(
      claimLucidMorningVoiceNoteScope('guest', ACCOUNT, { storage, files })
    ).rejects.toMatchObject({ reason: 'persistence_failed' });

    await expect(loadLucidMorningVoiceNotes('guest', storage)).resolves.toEqual([guestA, guestB]);
    await expect(loadLucidMorningVoiceNotes(ACCOUNT, storage)).resolves.toEqual([]);
    expect(files.files.has(guestA.uri)).toBe(true);
    expect(files.files.has(guestB.uri)).toBe(true);
    expect(
      [...files.files].some((uri) => uri.includes('/noctalia-lucid-morning-voice/user%3Auser-1/'))
    ).toBe(false);
  });

  it('rolls back destination files when destination metadata cannot be written', async () => {
    const { storage } = memoryKv();
    const sourceA = 'file:///tmp/recorder/claim-meta-a.m4a';
    const files = memoryFiles([sourceA]);
    const guestA = await persistNote({
      userScope: 'guest',
      noteId: GUEST_A,
      sourceUri: sourceA,
      storage,
      files,
    });
    const accountKey = getLucidMorningVoiceNoteStorageKey(ACCOUNT);
    const originalSetItem = storage.setItem.getMockImplementation();
    storage.setItem.mockImplementation(async (key: string, value: string) => {
      if (key === accountKey) throw new Error('metadata write failed');
      return originalSetItem?.(key, value);
    });

    await expect(
      claimLucidMorningVoiceNoteScope('guest', ACCOUNT, { storage, files })
    ).rejects.toMatchObject({ reason: 'persistence_failed' });

    await expect(loadLucidMorningVoiceNotes('guest', storage)).resolves.toEqual([guestA]);
    await expect(loadLucidMorningVoiceNotes(ACCOUNT, storage)).resolves.toEqual([]);
    expect(files.files.has(guestA.uri)).toBe(true);
    expect(
      files.files.has(getLucidMorningVoiceNoteFileUri(ACCOUNT, GUEST_A, '.m4a', files))
    ).toBe(false);
  });

  it('throws after destination commit if guest purge fails, then retry finishes the purge', async () => {
    const { storage } = memoryKv();
    const sourceA = 'file:///tmp/recorder/claim-retry-a.m4a';
    const files = memoryFiles([sourceA]);
    const guestA = await persistNote({
      userScope: 'guest',
      noteId: GUEST_A,
      sourceUri: sourceA,
      storage,
      files,
    });
    const originalDelete = files.delete.bind(files);
    let blockedOnce = false;
    files.delete = jest.fn(async (uri: string) => {
      if (!blockedOnce && (uri === guestA.uri || uri === `${guestA.uri}.deleting`)) {
        blockedOnce = true;
        throw new Error('guest purge blocked');
      }
      return originalDelete(uri);
    });

    await expect(
      claimLucidMorningVoiceNoteScope('guest', ACCOUNT, { storage, files })
    ).rejects.toMatchObject({ reason: 'persistence_failed' });
    const copied = await loadLucidMorningVoiceNotes(ACCOUNT, storage);
    expect(copied).toHaveLength(1);
    expect(copied[0]?.userScope).toBe(ACCOUNT);
    expect(files.files.has(copied[0]?.uri ?? '')).toBe(true);
    await expect(loadLucidMorningVoiceNotes('guest', storage)).resolves.toEqual([guestA]);

    const retry = await claimLucidMorningVoiceNoteScope('guest', ACCOUNT, {
      storage,
      files,
    });
    expect(retry).toEqual({ claimed: true, transferred: 0, skipped: 1, retainedGuest: 0 });
    await expect(loadLucidMorningVoiceNotes(ACCOUNT, storage)).resolves.toEqual(copied);
    await expect(loadLucidMorningVoiceNotes('guest', storage)).resolves.toEqual([]);
    expect(files.files.has(guestA.uri)).toBe(false);
    expect(countLucidMorningVoiceNoteScopeLocksForTests()).toBe(0);
  });

  it('retries a remapped collision id without overwriting the original account note', async () => {
    const { storage } = memoryKv();
    const sourceGuest = 'file:///tmp/recorder/claim-collision-retry-guest.m4a';
    const sourceAccount = 'file:///tmp/recorder/claim-collision-retry-account.m4a';
    const files = memoryFiles([sourceGuest, sourceAccount]);
    const accountNote = await persistNote({
      userScope: ACCOUNT,
      noteId: GUEST_A,
      sourceUri: sourceAccount,
      storage,
      files,
      title: 'Account original',
      durationMs: 400,
    });
    const guestNote = await persistNote({
      userScope: 'guest',
      noteId: GUEST_A,
      sourceUri: sourceGuest,
      storage,
      files,
      title: 'Guest original',
      durationMs: 1200,
    });
    const originalDelete = files.delete.bind(files);
    let blockedOnce = false;
    files.delete = jest.fn(async (uri: string) => {
      if (!blockedOnce && (uri === guestNote.uri || uri === `${guestNote.uri}.deleting`)) {
        blockedOnce = true;
        throw new Error('guest purge blocked');
      }
      return originalDelete(uri);
    });

    await expect(
      claimLucidMorningVoiceNoteScope('guest', ACCOUNT, { storage, files })
    ).rejects.toMatchObject({ reason: 'persistence_failed' });
    const afterFirst = await loadLucidMorningVoiceNotes(ACCOUNT, storage);
    const remapped = afterFirst.find((note) => note.id !== GUEST_A);
    expect(afterFirst.find((note) => note.id === GUEST_A)).toEqual(accountNote);
    expect(remapped).toMatchObject({
      userScope: ACCOUNT,
      title: 'Guest original',
      durationMs: 1200,
      createdAt: guestNote.createdAt,
      experimentId: guestNote.experimentId,
    });
    await expect(loadLucidMorningVoiceNotes('guest', storage)).resolves.toEqual([guestNote]);

    const retry = await claimLucidMorningVoiceNoteScope('guest', ACCOUNT, {
      storage,
      files,
    });
    expect(retry).toEqual({ claimed: true, transferred: 0, skipped: 1, retainedGuest: 0 });
    await expect(loadLucidMorningVoiceNotes(ACCOUNT, storage)).resolves.toEqual(afterFirst);
    await expect(loadLucidMorningVoiceNotes('guest', storage)).resolves.toEqual([]);
    expect(files.files.has(accountNote.uri)).toBe(true);
    expect(files.files.has(remapped?.uri ?? '')).toBe(true);
    expect(files.files.has(guestNote.uri)).toBe(false);
  });

  it('reclaims an unreferenced destination file left by a crashed copy then purges guest', async () => {
    const { storage } = memoryKv();
    const sourceA = 'file:///tmp/recorder/claim-orphan-a.m4a';
    const files = memoryFiles([sourceA]);
    const guestA = await persistNote({
      userScope: 'guest',
      noteId: GUEST_A,
      sourceUri: sourceA,
      storage,
      files,
      title: 'Recovered after crash',
    });
    const orphanUri = getLucidMorningVoiceNoteFileUri(ACCOUNT, GUEST_A, '.m4a', files);
    files.files.add(orphanUri);
    await expect(loadLucidMorningVoiceNotes(ACCOUNT, storage)).resolves.toEqual([]);

    const result = await claimLucidMorningVoiceNoteScope('guest', ACCOUNT, { storage, files });
    expect(result).toEqual({ claimed: true, transferred: 1, skipped: 0, retainedGuest: 0 });
    const accountNotes = await loadLucidMorningVoiceNotes(ACCOUNT, storage);
    expect(accountNotes).toHaveLength(1);
    expect(accountNotes[0]).toMatchObject({
      id: GUEST_A,
      userScope: ACCOUNT,
      title: 'Recovered after crash',
      uri: orphanUri,
      createdAt: guestA.createdAt,
      experimentId: guestA.experimentId,
    });
    expect(files.files.has(orphanUri)).toBe(true);
    await expect(loadLucidMorningVoiceNotes('guest', storage)).resolves.toEqual([]);
    expect(files.files.has(guestA.uri)).toBe(false);
  });

  it('leaves an unrelated account note untouched when guest is empty', async () => {
    const { storage } = memoryKv();
    const sourceAccount = 'file:///tmp/recorder/claim-empty-account.m4a';
    const files = memoryFiles([sourceAccount]);
    const accountNote = await persistNote({
      userScope: ACCOUNT,
      noteId: ACCOUNT_A,
      sourceUri: sourceAccount,
      storage,
      files,
      title: 'Already on account',
    });
    const result = await claimLucidMorningVoiceNoteScope('guest', ACCOUNT, {
      storage,
      files,
    });
    expect(result).toEqual({ claimed: false, transferred: 0, skipped: 0, retainedGuest: 0 });
    await expect(loadLucidMorningVoiceNotes(ACCOUNT, storage)).resolves.toEqual([accountNote]);
  });
});

describe('Lucid morning voice-note native storage encryption contract', () => {
  it('protects writes and reveals reads when using the default sqlite identity', async () => {
    jest.resetModules();
    const nativeValues = new Map<string, string>();
    const sqlite = {
      getItem: jest.fn(async (key: string) => nativeValues.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        nativeValues.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        nativeValues.delete(key);
      }),
    };
    const prefix = 'test-aesgcm-v1:';
    const encode = (value: string) => Buffer.from(value, 'utf8').toString('base64');
    const decode = (value: string) => Buffer.from(value, 'base64').toString('utf8');
    const protectLucidTrainerStoredValue = jest.fn(async (key: string, plaintext: string) => {
      return `${prefix}${encode(JSON.stringify({ key, plaintext }))}`;
    });
    const revealLucidTrainerStoredValue = jest.fn(async (key: string, storedValue: string) => {
      const payload = JSON.parse(decode(storedValue.slice(prefix.length)));
      if (payload.key !== key) throw new Error('aad mismatch');
      return payload.plaintext as string;
    });
    const { Platform } = require('react-native') as typeof import('react-native');
    Platform.OS = 'ios';
    jest.doMock('expo-sqlite/kv-store', () => ({ __esModule: true, default: sqlite }));
    jest.doMock('@react-native-async-storage/async-storage', () => ({
      __esModule: true,
      default: {
        getItem: jest.fn(async () => {
          throw new Error('web AsyncStorage must not back native encryption tests');
        }),
        setItem: jest.fn(async () => undefined),
        removeItem: jest.fn(async () => undefined),
      },
    }));
    jest.doMock('@/services/lucidTrainerSecureStorage', () => ({
      isLucidTrainerEncryptedValueError: (value: unknown) =>
        (value as { code?: string } | null)?.code === 'invalid_encrypted_value',
      protectLucidTrainerStoredValue,
      revealLucidTrainerStoredValue,
    }));

    const {
      persistLucidMorningVoiceNoteFromRecorder,
      loadLucidMorningVoiceNotes,
      getLucidMorningVoiceNoteStorageKey,
    } = require('@/services/lucidMorningVoiceNoteStorage');
    const present = new Set([SOURCE]);
    const files = {
      exists: jest.fn(async (uri: string) => present.has(uri)),
      ensureDirectory: jest.fn(async () => undefined),
      copy: jest.fn(async (fromUri: string, toUri: string) => {
        if (!present.has(fromUri)) throw new Error('missing source');
        present.add(toUri);
      }),
      move: jest.fn(async () => undefined),
      delete: jest.fn(async (uri: string) => {
        present.delete(uri);
      }),
      documentDirectoryUri: () => 'file:///data/user/0/app/files',
    };
    await persistLucidMorningVoiceNoteFromRecorder({
      userScope: 'native-user',
      sourceUri: SOURCE,
      mimeType: 'audio/mp4',
      extension: '.m4a',
      durationMs: 800,
      noteId: 'mvn_recording_enc01',
      now: NOW,
      files,
    });
    const stored = nativeValues.get(getLucidMorningVoiceNoteStorageKey('native-user')) ?? '';
    expect(protectLucidTrainerStoredValue).toHaveBeenCalled();
    expect(stored.startsWith(prefix)).toBe(true);
    await expect(loadLucidMorningVoiceNotes('native-user')).resolves.toHaveLength(1);
    expect(revealLucidTrainerStoredValue).toHaveBeenCalled();
  });
});
