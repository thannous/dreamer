/* @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useLucidMorningVoiceNotes } from '@/hooks/useLucidMorningVoiceNotes';
import {
  LucidMorningVoiceNoteError,
  createLucidMorningVoiceNote,
  type LucidMorningVoiceNote,
} from '@/lib/lucid/morningVoiceNote';
import {
  deleteLucidMorningVoiceNote,
  linkStoredLucidMorningVoiceNoteToExperiment,
  loadLucidMorningVoiceNotes,
  renameStoredLucidMorningVoiceNote,
  updateStoredLucidMorningVoiceNoteTranscript,
} from '@/services/lucidMorningVoiceNoteStorage';

const NOW = Date.UTC(2026, 7, 28, 8, 30, 0);

jest.mock('@/services/lucidMorningVoiceNoteStorage', () => ({
  deleteLucidMorningVoiceNote: jest.fn(),
  linkStoredLucidMorningVoiceNoteToExperiment: jest.fn(),
  loadLucidMorningVoiceNotes: jest.fn(),
  renameStoredLucidMorningVoiceNote: jest.fn(),
  updateStoredLucidMorningVoiceNoteTranscript: jest.fn(),
}));

const loadNotes = jest.mocked(loadLucidMorningVoiceNotes);
const renameNote = jest.mocked(renameStoredLucidMorningVoiceNote);
const updateTranscript = jest.mocked(updateStoredLucidMorningVoiceNoteTranscript);
const linkNote = jest.mocked(linkStoredLucidMorningVoiceNoteToExperiment);
const deleteNote = jest.mocked(deleteLucidMorningVoiceNote);

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function note(overrides: Partial<LucidMorningVoiceNote> & { userScope?: string } = {}): LucidMorningVoiceNote {
  const userScope = overrides.userScope ?? 'guest';
  const id = overrides.id ?? 'mvn_morning_note01';
  const createdAt = overrides.createdAt ?? NOW;
  const updatedAt = Math.max(overrides.updatedAt ?? createdAt, createdAt);
  return createLucidMorningVoiceNote({
    id,
    userScope,
    experimentId: overrides.experimentId ?? null,
    status: overrides.status ?? 'ready',
    title: overrides.title ?? 'Morning voice note',
    transcript: overrides.transcript ?? null,
    durationMs: overrides.durationMs ?? 1_800,
    mimeType: 'audio/mp4',
    extension: '.m4a',
    uri: overrides.uri ?? `file:///data/user/0/app/files/noctalia-lucid-morning-voice/${userScope}/${id}.m4a`,
    createdAt,
    updatedAt,
    recoverable: overrides.recoverable ?? false,
    now: updatedAt,
  });
}

function renderNotes(
  userScope = 'guest',
  onLinkedNoteDeleted?: (experimentId: string) => Promise<void>
) {
  return renderHook(({ userScope: scope }) => useLucidMorningVoiceNotes({
    userScope: scope,
    onLinkedNoteDeleted,
  }), {
    initialProps: { userScope },
  });
}

describe('useLucidMorningVoiceNotes', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    loadNotes.mockReset();
    renameNote.mockReset();
    updateTranscript.mockReset();
    linkNote.mockReset();
    deleteNote.mockReset();
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('loads notes for the current scope and looks them up by experiment id', async () => {
    const first = note({
      id: 'mvn_morning_note01',
      experimentId: 'exp_morning_link01',
      title: 'Linked morning',
    });
    const second = note({
      id: 'mvn_morning_note02',
      createdAt: NOW + 1,
      title: 'Later morning',
    });
    const load = deferred<LucidMorningVoiceNote[]>();
    loadNotes.mockReturnValueOnce(load.promise);

    const { result } = renderNotes('guest');
    expect(result.current.notes).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.getByExperimentId('exp_morning_link01')).toBeNull();

    await act(async () => {
      load.resolve([second, first]);
      await load.promise;
    });

    expect(loadNotes).toHaveBeenCalledWith('guest');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.notes.map((item) => item.id)).toEqual([
      'mvn_morning_note01',
      'mvn_morning_note02',
    ]);
    expect(result.current.getByExperimentId('exp_morning_link01')).toEqual(first);
    expect(result.current.getByExperimentId('exp_missing')).toBeNull();
  });

  it('clears notes immediately on scope change and ignores stale A results while B is mutating independently', async () => {
    const guestLoad = deferred<LucidMorningVoiceNote[]>();
    const signedLoad = deferred<LucidMorningVoiceNote[]>();
    const guestRename = deferred<LucidMorningVoiceNote>();
    loadNotes
      .mockReturnValueOnce(guestLoad.promise)
      .mockReturnValueOnce(signedLoad.promise);
    renameNote.mockReturnValueOnce(guestRename.promise);

    const guestNote = note({ id: 'mvn_morning_guest1', userScope: 'guest' });
    const signedNote = note({ id: 'mvn_morning_user01', userScope: 'signed-in', title: 'Signed morning' });

    const { result, rerender } = renderNotes('guest');
    await act(async () => {
      guestLoad.resolve([guestNote]);
      await guestLoad.promise;
    });

    let guestRenamePromise!: Promise<LucidMorningVoiceNote>;
    await act(async () => {
      guestRenamePromise = result.current.renameNote('mvn_morning_guest1', 'Guest title');
    });
    expect(result.current.isMutating).toBe(true);

    rerender({ userScope: 'signed-in' });
    expect(result.current.notes).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isMutating).toBe(false);
    expect(result.current.getByExperimentId('exp_morning_link01')).toBeNull();

    await act(async () => {
      guestLoad.reject(new LucidMorningVoiceNoteError('persistence_failed'));
      await guestLoad.promise.catch(() => undefined);
    });
    await act(async () => {
      guestRename.resolve({ ...guestNote, title: 'Guest title', updatedAt: NOW + 4 });
      await guestRenamePromise.catch(() => undefined);
    });

    expect(result.current.notes).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.isMutating).toBe(false);

    await act(async () => {
      signedLoad.resolve([signedNote]);
      await signedLoad.promise;
    });

    expect(result.current.notes).toEqual([signedNote]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isMutating).toBe(false);
    expect(renameNote).toHaveBeenCalledWith('guest', 'mvn_morning_guest1', 'Guest title');
  });

  it('lets the latest refresh win, marks loading, and keeps notes on a same-scope refresh error', async () => {
    const initial = deferred<LucidMorningVoiceNote[]>();
    const firstRefresh = deferred<LucidMorningVoiceNote[]>();
    const secondRefresh = deferred<LucidMorningVoiceNote[]>();
    const failedRefresh = deferred<LucidMorningVoiceNote[]>();
    const current = note({ id: 'mvn_morning_note01' });
    const later = note({ id: 'mvn_morning_note03', title: 'Refreshed morning', createdAt: NOW + 8 });
    loadNotes
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(firstRefresh.promise)
      .mockReturnValueOnce(secondRefresh.promise)
      .mockReturnValueOnce(failedRefresh.promise);

    const { result } = renderNotes('guest');
    await act(async () => {
      initial.resolve([current]);
      await initial.promise;
    });

    let firstRefreshPromise!: Promise<void>;
    let secondRefreshPromise!: Promise<void>;
    await act(async () => {
      firstRefreshPromise = result.current.refresh();
    });
    expect(result.current.isLoading).toBe(true);
    await act(async () => {
      secondRefreshPromise = result.current.refresh();
    });
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      firstRefresh.resolve([note({ id: 'mvn_morning_stale1', title: 'Stale morning' })]);
      await firstRefreshPromise;
    });
    expect(result.current.notes).toEqual([current]);

    await act(async () => {
      secondRefresh.resolve([later]);
      await secondRefreshPromise;
    });
    expect(result.current.notes).toEqual([later]);
    expect(result.current.isLoading).toBe(false);

    let failedRefreshPromise!: Promise<void>;
    await act(async () => {
      failedRefreshPromise = result.current.refresh();
    });
    expect(result.current.isLoading).toBe(true);
    await act(async () => {
      failedRefresh.reject(new LucidMorningVoiceNoteError('persistence_failed', 'Local voice-note persistence failed'));
      await failedRefreshPromise;
    });

    expect(result.current.notes).toEqual([later]);
    expect(result.current.error).toBe('persistence_failed');
    expect(result.current.isLoading).toBe(false);
  });

  it('renames, updates transcript and links using the frozen current scope', async () => {
    const current = note({ id: 'mvn_morning_note01' });
    const renamed = note({ id: 'mvn_morning_note01', title: 'Renamed morning', updatedAt: NOW + 1 });
    const transcribed = note({
      id: 'mvn_morning_note01',
      title: 'Renamed morning',
      transcript: 'Woke lucid',
      updatedAt: NOW + 2,
    });
    const linked = note({
      id: 'mvn_morning_note01',
      title: 'Renamed morning',
      transcript: 'Woke lucid',
      experimentId: 'exp_morning_link01',
      updatedAt: NOW + 3,
    });
    loadNotes.mockResolvedValueOnce([current]);
    renameNote.mockResolvedValueOnce(renamed);
    updateTranscript.mockResolvedValueOnce(transcribed);
    linkNote.mockResolvedValueOnce(linked);

    const { result } = renderNotes('guest');
    await act(async () => undefined);

    await act(async () => {
      await result.current.renameNote('mvn_morning_note01', 'Renamed morning');
    });
    expect(renameNote).toHaveBeenCalledWith('guest', 'mvn_morning_note01', 'Renamed morning');
    expect(result.current.notes).toEqual([renamed]);

    await act(async () => {
      await result.current.updateTranscript('mvn_morning_note01', 'Woke lucid');
    });
    expect(updateTranscript).toHaveBeenCalledWith('guest', 'mvn_morning_note01', 'Woke lucid');
    expect(result.current.notes).toEqual([transcribed]);

    await act(async () => {
      await result.current.linkToExperiment('mvn_morning_note01', 'exp_morning_link01');
    });
    expect(linkNote).toHaveBeenCalledWith('guest', 'mvn_morning_note01', 'exp_morning_link01');
    expect(result.current.notes).toEqual([linked]);
    expect(result.current.getByExperimentId('exp_morning_link01')).toEqual(linked);
    expect(result.current.isMutating).toBe(false);
  });

  it('removes a note after a successful local delete', async () => {
    const current = note({ id: 'mvn_morning_note01' });
    const other = note({ id: 'mvn_morning_note02', createdAt: NOW + 2 });
    loadNotes.mockResolvedValueOnce([current, other]);
    deleteNote.mockResolvedValueOnce(current);

    const { result } = renderNotes('guest');
    await act(async () => undefined);

    await act(async () => {
      await result.current.deleteNote('mvn_morning_note01');
    });

    expect(deleteNote).toHaveBeenCalledWith('guest', 'mvn_morning_note01');
    expect(result.current.notes).toEqual([other]);
    expect(result.current.isMutating).toBe(false);
  });

  it('clears the linked experiment marker after deleting its local note', async () => {
    const current = note({
      id: 'mvn_morning_note01',
      experimentId: 'exp_morning_link01',
    });
    const clearExperiment = jest.fn(async () => undefined);
    loadNotes.mockResolvedValueOnce([current]);
    deleteNote.mockResolvedValueOnce(current);

    const { result } = renderNotes('guest', clearExperiment);
    await act(async () => undefined);

    await act(async () => {
      await result.current.deleteNote(current.id);
    });

    expect(deleteNote).toHaveBeenCalledWith('guest', current.id);
    expect(clearExperiment).toHaveBeenCalledWith('exp_morning_link01');
    expect(result.current.notes).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('keeps only the latest same-note update when older work resolves last and stays mutating until both finish', async () => {
    const current = note({ id: 'mvn_morning_note01' });
    const first = deferred<LucidMorningVoiceNote>();
    const second = deferred<LucidMorningVoiceNote>();
    loadNotes.mockResolvedValueOnce([current]);
    renameNote.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result } = renderNotes('guest');
    await act(async () => undefined);

    let firstPromise!: Promise<LucidMorningVoiceNote>;
    let secondPromise!: Promise<LucidMorningVoiceNote>;
    await act(async () => {
      firstPromise = result.current.renameNote('mvn_morning_note01', 'First title');
      secondPromise = result.current.renameNote('mvn_morning_note01', 'Second title');
    });
    expect(result.current.isMutating).toBe(true);

    await act(async () => {
      second.resolve(note({ id: 'mvn_morning_note01', title: 'Second title', updatedAt: NOW + 5 }));
      await secondPromise;
    });
    expect(result.current.notes[0]?.title).toBe('Second title');
    expect(result.current.isMutating).toBe(true);

    await act(async () => {
      first.resolve(note({ id: 'mvn_morning_note01', title: 'First title', updatedAt: NOW + 4 }));
      await firstPromise;
    });
    expect(result.current.notes[0]?.title).toBe('Second title');
    expect(result.current.isMutating).toBe(false);
  });

  it('retries an invalidated load after the last mutation finishes and restores every stored note', async () => {
    const current = note({ id: 'mvn_morning_note01' });
    const sibling = note({ id: 'mvn_morning_note02', createdAt: NOW + 3 });
    const initial = deferred<LucidMorningVoiceNote[]>();
    const refreshLoad = deferred<LucidMorningVoiceNote[]>();
    const retryLoad = deferred<LucidMorningVoiceNote[]>();
    const renameWork = deferred<LucidMorningVoiceNote>();
    loadNotes
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(refreshLoad.promise)
      .mockReturnValueOnce(retryLoad.promise);
    renameNote.mockReturnValueOnce(renameWork.promise);

    const { result } = renderNotes('guest');
    await act(async () => {
      initial.resolve([current]);
      await initial.promise;
    });

    let refreshPromise!: Promise<void>;
    await act(async () => {
      refreshPromise = result.current.refresh();
    });
    let renamePromise!: Promise<LucidMorningVoiceNote>;
    await act(async () => {
      renamePromise = result.current.renameNote('mvn_morning_note01', 'During refresh');
    });

    await act(async () => {
      refreshLoad.resolve([current]);
      await refreshPromise;
    });
    expect(result.current.notes).toEqual([current]);
    expect(result.current.isMutating).toBe(true);

    await act(async () => {
      renameWork.resolve(note({ id: 'mvn_morning_note01', title: 'During refresh', updatedAt: NOW + 6 }));
      await renamePromise;
    });

    await act(async () => {
      retryLoad.resolve([
        note({ id: 'mvn_morning_note01', title: 'During refresh', updatedAt: NOW + 6 }),
        sibling,
      ]);
      await retryLoad.promise;
    });

    expect(loadNotes).toHaveBeenCalledTimes(3);
    expect(result.current.notes.map((item) => item.id)).toEqual([
      'mvn_morning_note01',
      'mvn_morning_note02',
    ]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isMutating).toBe(false);
  });

  it('reconciles storage after a delete fails over a masked update and keeps the delete error', async () => {
    const current = note({ id: 'mvn_morning_note01' });
    const sibling = note({ id: 'mvn_morning_note02', createdAt: NOW + 2 });
    const renamed = note({ id: 'mvn_morning_note01', title: 'Masked title', updatedAt: NOW + 7 });
    const renameWork = deferred<LucidMorningVoiceNote>();
    const deleteWork = deferred<LucidMorningVoiceNote | null>();
    const reconcile = deferred<LucidMorningVoiceNote[]>();
    loadNotes.mockResolvedValueOnce([current, sibling]).mockReturnValueOnce(reconcile.promise);
    renameNote.mockReturnValueOnce(renameWork.promise);
    deleteNote.mockReturnValueOnce(deleteWork.promise);

    const { result } = renderNotes('guest');
    await act(async () => undefined);

    let renamePromise!: Promise<LucidMorningVoiceNote>;
    let deletePromise!: Promise<void>;
    await act(async () => {
      renamePromise = result.current.renameNote('mvn_morning_note01', 'Masked title');
      deletePromise = result.current.deleteNote('mvn_morning_note01');
    });

    await act(async () => {
      renameWork.resolve(renamed);
      await renamePromise;
    });
    expect(result.current.notes.map((item) => item.id)).toEqual([
      'mvn_morning_note01',
      'mvn_morning_note02',
    ]);
    expect(result.current.notes.find((item) => item.id === 'mvn_morning_note01')?.title).toBe('Morning voice note');

    let deleteRejected: unknown;
    await act(async () => {
      deleteWork.reject(new LucidMorningVoiceNoteError('persistence_failed', 'Local voice-note persistence failed'));
      reconcile.resolve([renamed, sibling]);
      try {
        await deletePromise;
      } catch (error) {
        deleteRejected = error;
      }
    });

    expect(loadNotes).toHaveBeenLastCalledWith('guest');
    expect(result.current.notes.map((item) => item.id).sort()).toEqual([
      'mvn_morning_note01',
      'mvn_morning_note02',
    ]);
    expect(deleteRejected).toMatchObject({ reason: 'persistence_failed' });
    expect(result.current.error).toBe('persistence_failed');
    expect(result.current.isMutating).toBe(false);
  });

  it('does not let an old A mutation replace a newer A after A→B→A', async () => {
    const guestFirst = note({ id: 'mvn_morning_note01', userScope: 'guest', title: 'First A' });
    const guestLater = note({ id: 'mvn_morning_note01', userScope: 'guest', title: 'Latest A', updatedAt: NOW + 9 });
    const signedNote = note({ id: 'mvn_morning_user01', userScope: 'signed-in' });
    const firstA = deferred<LucidMorningVoiceNote[]>();
    const scopeB = deferred<LucidMorningVoiceNote[]>();
    const scopeAAgain = deferred<LucidMorningVoiceNote[]>();
    const scopeARetry = deferred<LucidMorningVoiceNote[]>();
    const staleRename = deferred<LucidMorningVoiceNote>();
    const freshRename = deferred<LucidMorningVoiceNote>();
    loadNotes
      .mockReturnValueOnce(firstA.promise)
      .mockReturnValueOnce(scopeB.promise)
      .mockReturnValueOnce(scopeAAgain.promise)
      .mockReturnValueOnce(scopeARetry.promise);
    renameNote.mockReturnValueOnce(staleRename.promise).mockReturnValueOnce(freshRename.promise);

    const { result, rerender } = renderNotes('guest');
    await act(async () => {
      firstA.resolve([guestFirst]);
      await firstA.promise;
    });

    let stalePromise!: Promise<LucidMorningVoiceNote>;
    await act(async () => {
      stalePromise = result.current.renameNote('mvn_morning_note01', 'Stale A');
    });

    rerender({ userScope: 'signed-in' });
    await act(async () => {
      scopeB.resolve([signedNote]);
      await scopeB.promise;
    });

    rerender({ userScope: 'guest' });
    await act(async () => {
      scopeAAgain.resolve([guestFirst]);
      await scopeAAgain.promise;
    });
    await act(async () => {
      staleRename.resolve(note({ id: 'mvn_morning_note01', userScope: 'guest', title: 'Stale A', updatedAt: NOW + 8 }));
      await stalePromise.catch(() => undefined);
    });
    await act(async () => {
      scopeARetry.resolve([guestFirst]);
      await scopeARetry.promise;
    });
    expect(result.current.notes.map((item) => item.title)).toEqual(['First A']);

    let freshPromise!: Promise<LucidMorningVoiceNote>;
    await act(async () => {
      freshPromise = result.current.renameNote('mvn_morning_note01', 'Latest A');
    });

    await act(async () => {
      freshRename.resolve(guestLater);
      await freshPromise;
    });
    expect(result.current.notes).toEqual([guestLater]);
  });

  it('is unmount-safe and does not warn after a late load', async () => {
    const load = deferred<LucidMorningVoiceNote[]>();
    loadNotes.mockReturnValueOnce(load.promise);
    const { unmount } = renderNotes('guest');

    unmount();
    await act(async () => {
      load.resolve([note()]);
      await load.promise;
    });

    expect(consoleError).not.toHaveBeenCalled();
  });

  it('never reaches permission, audio, network or sync APIs', async () => {
    loadNotes.mockResolvedValueOnce([]);
    const { result } = renderNotes('guest');
    await act(async () => undefined);

    const source = JSON.stringify({
      load: loadNotes.mock.calls,
      rename: renameNote.mock.calls,
      transcript: updateTranscript.mock.calls,
      link: linkNote.mock.calls,
      delete: deleteNote.mock.calls,
      result: result.current.notes,
    });
    expect(source).not.toMatch(/permission|AudioModule|fetch\(|sync|upload|cloud/i);
    expect(loadNotes).toHaveBeenCalledTimes(1);
  });
});
