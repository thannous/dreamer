/* @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import type { RecordingDraftReadResult } from '@/lib/types';

import {
  RECORDING_DRAFT_AUTOSAVE_DELAY_MS,
  useRecordingDraftPersistence,
} from '../useRecordingDraftPersistence';

const mockGetSavedTranscript = jest.fn(async (): Promise<string> => '');
const mockGetRecordingDraft = jest.fn(async (): Promise<RecordingDraftReadResult> => ({ status: 'absent' }));
const mockSaveTranscript = jest.fn(async (_value: string): Promise<void> => undefined);

jest.mock('@/services/storageService', () => ({
  getRecordingDraft: () => mockGetRecordingDraft(),
  saveTranscript: (value: string) => mockSaveTranscript(value),
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

let appStateListener: ((state: AppStateStatus) => void) | undefined;
let removeSubscription: jest.Mock;

describe('useRecordingDraftPersistence', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetSavedTranscript.mockReset();
    mockSaveTranscript.mockReset();
    mockGetSavedTranscript.mockResolvedValue('');
    mockGetRecordingDraft.mockReset().mockImplementation(async () => {
      const value = await mockGetSavedTranscript();
      return value ? { status: 'loaded', value } : { status: 'absent' };
    });
    mockSaveTranscript.mockResolvedValue(undefined);
    appStateListener = undefined;
    removeSubscription = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((
      _type: 'change',
      listener: (state: AppStateStatus) => void
    ) => {
      appStateListener = listener;
      return { remove: removeSubscription };
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('restores a saved draft after remount', async () => {
    mockGetSavedTranscript.mockResolvedValue('a remembered dream');
    const onRestore = jest.fn();

    const first = renderHook(() =>
      useRecordingDraftPersistence({ transcript: '', onRestore })
    );
    await flushPromises();
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledWith('a remembered dream');
    expect(first.result.current.isHydrated).toBe(true);
    first.unmount();

    onRestore.mockClear();
    renderHook(() => useRecordingDraftPersistence({ transcript: '', onRestore }));
    await flushPromises();

    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledWith('a remembered dream');
    expect(mockSaveTranscript).not.toHaveBeenCalled();
  });

  it('autosaves a typed transcript of 601 and 10000 characters intact', async () => {
    const onRestore = jest.fn();
    const { result } = renderHook(() =>
      useRecordingDraftPersistence({ transcript: '', onRestore })
    );
    await flushPromises();

    const long601 = 'a'.repeat(601);
    act(() => {
      expect(result.current.noteInput(long601)).toBe(true);
    });
    act(() => {
      jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS);
    });
    await flushPromises();

    expect(mockSaveTranscript).toHaveBeenCalledWith(long601);
    expect(mockSaveTranscript.mock.calls.at(-1)?.[0]).toHaveLength(601);

    const long10000 = 'b'.repeat(10_000);
    act(() => {
      result.current.noteInput(long10000);
    });
    act(() => {
      jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS);
    });
    await flushPromises();

    expect(mockSaveTranscript).toHaveBeenCalledWith(long10000);
    expect(mockSaveTranscript.mock.calls.at(-1)?.[0]).toHaveLength(10_000);
    expect(mockSaveTranscript.mock.calls.at(-1)?.[0]).toBe(long10000);
  });

  it('autosaves a voice-updated transcript without trimming', async () => {
    const onRestore = jest.fn();
    const { result } = renderHook(() =>
      useRecordingDraftPersistence({ transcript: '', onRestore })
    );
    await flushPromises();

    const voiced = '  a fox waits beside a frozen lake  ';
    act(() => {
      expect(result.current.noteInput(voiced)).toBe(true);
    });
    act(() => {
      jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS);
    });
    await flushPromises();

    expect(mockSaveTranscript).toHaveBeenCalledTimes(1);
    expect(mockSaveTranscript).toHaveBeenCalledWith(voiced);
  });

  it('does not clear a draft when addDream never succeeds', async () => {
    const onRestore = jest.fn();
    const { result } = renderHook(() =>
      useRecordingDraftPersistence({ transcript: '', onRestore })
    );
    await flushPromises();

    act(() => {
      expect(result.current.noteInput('keep me after a failed save')).toBe(true);
    });
    act(() => {
      jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS);
    });
    await flushPromises();

    expect(mockSaveTranscript).toHaveBeenCalledWith('keep me after a failed save');
    expect(mockSaveTranscript).not.toHaveBeenCalledWith('');
  });

  it('clears the draft exactly once after a successful save and ignores stale writes', async () => {
    const writes: { value: string; resolve: () => void }[] = [];
    mockSaveTranscript.mockImplementation(
      (value: string) =>
        new Promise<void>((resolve) => {
          writes.push({
            value,
            resolve: () => resolve(),
          });
        })
    );

    const onRestore = jest.fn();
    const { result, rerender } = renderHook(
      ({ transcript }) => useRecordingDraftPersistence({ transcript, onRestore }),
      { initialProps: { transcript: '' } }
    );
    await flushPromises();

    act(() => {
      expect(result.current.noteInput('hello from the editor')).toBe(true);
    });
    rerender({ transcript: 'hello from the editor' });
    act(() => {
      jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS);
    });
    await flushPromises();

    expect(writes).toHaveLength(1);
    expect(writes[0]?.value).toBe('hello from the editor');

    act(() => {
      result.current.clearAfterSuccessfulSave();
    });
    rerender({ transcript: '' });

    await act(async () => {
      writes[0]?.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await flushPromises();

    expect(writes).toHaveLength(2);
    expect(writes[1]?.value).toBe('');

    await act(async () => {
      writes[1]?.resolve();
      await Promise.resolve();
    });

    act(() => {
      jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS * 2);
    });
    await flushPromises();

    expect(writes).toHaveLength(2);
    expect(writes.filter((write) => write.value === '').length).toBe(1);
    expect(writes.at(-1)?.value).toBe('');
  });

  it('cancels a pending debounce so it cannot rewrite after clear', async () => {
    const onRestore = jest.fn();
    const { result, rerender } = renderHook(
      ({ transcript }) => useRecordingDraftPersistence({ transcript, onRestore }),
      { initialProps: { transcript: '' } }
    );
    await flushPromises();

    act(() => {
      expect(result.current.noteInput('should never land')).toBe(true);
    });
    act(() => {
      result.current.clearAfterSuccessfulSave();
    });
    rerender({ transcript: '' });
    act(() => {
      jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS * 2);
    });
    await flushPromises();

    expect(mockSaveTranscript).toHaveBeenCalledTimes(1);
    expect(mockSaveTranscript).toHaveBeenCalledWith('');
    expect(mockSaveTranscript).not.toHaveBeenCalledWith('should never land');
  });

  it('refuses input before restore and still restores the stored draft', async () => {
    const getDeferred = deferred<string>();
    mockGetSavedTranscript.mockReturnValue(getDeferred.promise);
    const onRestore = jest.fn();
    const { result, rerender } = renderHook(
      ({ transcript }) => useRecordingDraftPersistence({ transcript, onRestore }),
      { initialProps: { transcript: '' } }
    );

    expect(result.current.isHydrated).toBe(false);
    act(() => {
      expect(result.current.noteInput('typed while loading')).toBe(false);
    });
    act(() => {
      result.current.clearAfterSuccessfulSave();
    });
    expect(mockSaveTranscript).not.toHaveBeenCalled();

    await act(async () => {
      getDeferred.resolve('saved draft from disk');
      await getDeferred.promise;
    });

    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledWith('saved draft from disk');
    expect(result.current.isHydrated).toBe(true);
    rerender({ transcript: 'saved draft from disk' });

    act(() => {
      jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS);
    });
    await flushPromises();

    expect(mockSaveTranscript).not.toHaveBeenCalled();
    act(() => {
      expect(result.current.noteInput('typed after restore')).toBe(true);
    });
    act(() => {
      jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS);
    });
    await flushPromises();
    expect(mockSaveTranscript).toHaveBeenCalledWith('typed after restore');
  });

  it('does not erase stored content during the initial empty render', async () => {
    const getDeferred = deferred<string>();
    mockGetSavedTranscript.mockReturnValue(getDeferred.promise);
    const onRestore = jest.fn();

    const { rerender } = renderHook(
      ({ transcript }) => useRecordingDraftPersistence({ transcript, onRestore }),
      { initialProps: { transcript: '' } }
    );

    act(() => {
      jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS * 3);
    });
    await flushPromises();
    expect(mockSaveTranscript).not.toHaveBeenCalled();

    await act(async () => {
      getDeferred.resolve('stored dream');
      await getDeferred.promise;
    });
    rerender({ transcript: 'stored dream' });

    act(() => {
      jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS * 3);
    });
    await flushPromises();

    expect(onRestore).toHaveBeenCalledWith('stored dream');
    expect(mockSaveTranscript).not.toHaveBeenCalled();
  });

  it('does not block edits after a write failure once the draft read has succeeded', async () => {
    mockSaveTranscript.mockRejectedValue(new Error('write failed'));
    const onRestore = jest.fn();

    const { result } = renderHook(() =>
      useRecordingDraftPersistence({ transcript: '', onRestore })
    );
    await flushPromises();
    expect(onRestore).not.toHaveBeenCalled();

    act(() => {
      expect(result.current.noteInput('still capturable')).toBe(true);
    });
    act(() => {
      jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS);
    });
    await flushPromises();

    expect(mockSaveTranscript).toHaveBeenCalledWith('still capturable');
    expect(result.current.lastPersistedValue).toBe('');

    act(() => {
      result.current.clearAfterSuccessfulSave();
    });
    await flushPromises();
    expect(mockSaveTranscript).toHaveBeenCalledWith('');
  });

  it('flushes a pending typed draft on AppState background without waiting for debounce', async () => {
    const onRestore = jest.fn();
    const { result } = renderHook(() =>
      useRecordingDraftPersistence({ transcript: '', onRestore })
    );
    await flushPromises();
    expect(appStateListener).toEqual(expect.any(Function));

    act(() => {
      expect(result.current.noteInput('keep this across background')).toBe(true);
    });
    expect(mockSaveTranscript).not.toHaveBeenCalled();

    act(() => {
      appStateListener?.('background');
    });
    await flushPromises();

    expect(mockSaveTranscript).toHaveBeenCalledTimes(1);
    expect(mockSaveTranscript).toHaveBeenCalledWith('keep this across background');
  });

  it('flushes a pending draft on AppState inactive', async () => {
    const onRestore = jest.fn();
    const { result } = renderHook(() =>
      useRecordingDraftPersistence({ transcript: '', onRestore })
    );
    await flushPromises();

    act(() => {
      expect(result.current.noteInput('inactive fragment')).toBe(true);
    });
    act(() => {
      appStateListener?.('inactive');
    });
    await flushPromises();

    expect(mockSaveTranscript).toHaveBeenCalledTimes(1);
    expect(mockSaveTranscript).toHaveBeenCalledWith('inactive fragment');
  });

  it('flushes a pending draft on unmount without waiting for debounce', async () => {
    const onRestore = jest.fn();
    const { result, unmount } = renderHook(() =>
      useRecordingDraftPersistence({ transcript: '', onRestore })
    );
    await flushPromises();

    act(() => {
      expect(result.current.noteInput('survive unmount')).toBe(true);
    });
    expect(mockSaveTranscript).not.toHaveBeenCalled();

    act(() => {
      unmount();
    });
    await flushPromises();

    expect(mockSaveTranscript).toHaveBeenCalledTimes(1);
    expect(mockSaveTranscript).toHaveBeenCalledWith('survive unmount');
    expect(removeSubscription).toHaveBeenCalledTimes(1);
  });

  it('does not resurrect a cleared draft on background or unmount', async () => {
    const onRestore = jest.fn();
    const { result, unmount } = renderHook(() =>
      useRecordingDraftPersistence({ transcript: '', onRestore })
    );
    await flushPromises();

    act(() => {
      expect(result.current.noteInput('should never land after save')).toBe(true);
    });
    act(() => {
      result.current.clearAfterSuccessfulSave();
    });
    await flushPromises();

    expect(mockSaveTranscript).toHaveBeenCalledTimes(1);
    expect(mockSaveTranscript).toHaveBeenCalledWith('');

    act(() => {
      appStateListener?.('background');
    });
    act(() => {
      jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS * 2);
    });
    await flushPromises();

    act(() => {
      unmount();
    });
    await flushPromises();

    expect(mockSaveTranscript).toHaveBeenCalledTimes(1);
    expect(mockSaveTranscript).not.toHaveBeenCalledWith('should never land after save');
  });

  it('does not write an empty draft on unmount before hydration', async () => {
    const getDeferred = deferred<string>();
    mockGetSavedTranscript.mockReturnValue(getDeferred.promise);
    const onRestore = jest.fn();

    const { unmount } = renderHook(() =>
      useRecordingDraftPersistence({ transcript: '', onRestore })
    );

    expect(mockSaveTranscript).not.toHaveBeenCalled();
    act(() => {
      unmount();
    });
    await act(async () => {
      getDeferred.resolve('stored dream');
      await getDeferred.promise;
    });
    await flushPromises();

    expect(mockSaveTranscript).not.toHaveBeenCalled();
    expect(onRestore).not.toHaveBeenCalled();
  });

  it('exposes lastPersistedValue only after a successful write', async () => {
    const onRestore = jest.fn();
    const { result } = renderHook(() =>
      useRecordingDraftPersistence({ transcript: '', onRestore })
    );
    await flushPromises();
    expect(result.current.lastPersistedValue).toBe('');

    act(() => {
      expect(result.current.noteInput('Rain on the glass')).toBe(true);
    });
    expect(result.current.lastPersistedValue).toBe('');
    expect(mockSaveTranscript).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS);
    });
    await flushPromises();

    expect(mockSaveTranscript).toHaveBeenCalledWith('Rain on the glass');
    expect(result.current.lastPersistedValue).toBe('Rain on the glass');
  });

  it.each(['result', 'rejection'])('keeps all writes blocked after a read %s failure', async (failure: string) => {
    if (failure === 'result') mockGetRecordingDraft.mockResolvedValue({ status: 'error' });
    else mockGetRecordingDraft.mockRejectedValue(new Error('unreadable'));
    const onRestore = jest.fn();
    const { result, rerender, unmount } = renderHook(
      ({ transcript }) => useRecordingDraftPersistence({ transcript, onRestore }),
      { initialProps: { transcript: '' } }
    );
    await flushPromises();
    expect(result.current.hydrationStatus).toBe('error');
    expect(result.current.isHydrated).toBe(false);
    expect(result.current.lastPersistedValue).toBeNull();
    act(() => {
      expect(result.current.noteInput('must not overwrite stored dream')).toBe(false);
      result.current.clearAfterSuccessfulSave();
      appStateListener?.('background');
      jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS * 2);
    });
    rerender({ transcript: 'late voice update' });
    unmount();
    await flushPromises();
    expect(onRestore).not.toHaveBeenCalled();
    expect(mockSaveTranscript).not.toHaveBeenCalled();
  });

  it('retries exclusively and restores the original before enabling any input', async () => {
    mockGetRecordingDraft.mockResolvedValueOnce({ status: 'error' });
    const pending = deferred<RecordingDraftReadResult>();
    mockGetRecordingDraft.mockReturnValueOnce(pending.promise);
    const onRestore = jest.fn();
    const { result } = renderHook(() => useRecordingDraftPersistence({ transcript: '', onRestore }));
    await flushPromises();
    act(() => {
      result.current.retryHydration();
      result.current.retryHydration();
      expect(result.current.noteInput('early')).toBe(false);
      result.current.clearAfterSuccessfulSave();
    });
    expect(result.current.hydrationStatus).toBe('loading');
    expect(mockGetRecordingDraft).toHaveBeenCalledTimes(2);
    expect(mockSaveTranscript).not.toHaveBeenCalled();
    await act(async () => { pending.resolve({ status: 'loaded', value: 'original dream' }); });
    expect(onRestore).toHaveBeenCalledWith('original dream');
    expect(result.current.hydrationStatus).toBe('ready');
    expect(result.current.isHydrated).toBe(true);
    expect(result.current.lastPersistedValue).toBe('original dream');
    act(() => { result.current.retryHydration(); });
    expect(mockGetRecordingDraft).toHaveBeenCalledTimes(2);
    expect(mockSaveTranscript).not.toHaveBeenCalled();
  });

  it('keeps an unsuccessful retry blocked and permits another attempt', async () => {
    mockGetRecordingDraft.mockResolvedValue({ status: 'error' });
    const { result } = renderHook(() => useRecordingDraftPersistence({ transcript: '', onRestore: jest.fn() }));
    await flushPromises();
    act(() => { result.current.retryHydration(); });
    await flushPromises();
    expect(result.current.hydrationStatus).toBe('error');
    expect(result.current.isHydrated).toBe(false);
    mockGetRecordingDraft.mockResolvedValueOnce({ status: 'absent' });
    act(() => { result.current.retryHydration(); });
    await flushPromises();
    expect(result.current.hydrationStatus).toBe('ready');
    expect(result.current.lastPersistedValue).toBe('');
    expect(mockSaveTranscript).not.toHaveBeenCalled();
  });

  it('ignores a late retry result after unmount and cannot start another read', async () => {
    mockGetRecordingDraft.mockResolvedValueOnce({ status: 'error' });
    const pending = deferred<RecordingDraftReadResult>();
    mockGetRecordingDraft.mockReturnValueOnce(pending.promise);
    const onRestore = jest.fn();
    const { result, unmount } = renderHook(() => useRecordingDraftPersistence({ transcript: '', onRestore }));
    await flushPromises();
    const retry = result.current.retryHydration;
    act(() => { retry(); });
    unmount();
    await act(async () => { pending.resolve({ status: 'loaded', value: 'original dream' }); });
    retry();
    expect(mockGetRecordingDraft).toHaveBeenCalledTimes(2);
    expect(onRestore).not.toHaveBeenCalled();
    expect(mockSaveTranscript).not.toHaveBeenCalled();
  });

  it('ignores the first effect attempt after StrictMode restarts hydration', async () => {
    const first = deferred<RecordingDraftReadResult>();
    const second = deferred<RecordingDraftReadResult>();
    mockGetRecordingDraft.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const onRestore = jest.fn();
    const { result } = renderHook(() => useRecordingDraftPersistence({ transcript: '', onRestore }), {
      reactStrictMode: true,
    });
    expect(mockGetRecordingDraft).toHaveBeenCalledTimes(2);
    await act(async () => { second.resolve({ status: 'loaded', value: 'current dream' }); });
    await act(async () => { first.resolve({ status: 'loaded', value: 'stale dream' }); });
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledWith('current dream');
    expect(result.current.lastPersistedValue).toBe('current dream');
    expect(result.current.hydrationStatus).toBe('ready');
    expect(mockSaveTranscript).not.toHaveBeenCalled();
  });

  it('does not persist a transcript prop received while reads were blocked after retry succeeds', async () => {
    mockGetRecordingDraft.mockResolvedValueOnce({ status: 'error' })
      .mockResolvedValueOnce({ status: 'loaded', value: 'original dream' });
    const onRestore = jest.fn();
    const { result, rerender } = renderHook(
      ({ transcript }) => useRecordingDraftPersistence({ transcript, onRestore }),
      { initialProps: { transcript: '' } }
    );
    await flushPromises();
    rerender({ transcript: 'late voice result while blocked' });
    act(() => { result.current.retryHydration(); });
    await flushPromises();
    act(() => { jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS * 2); });
    await flushPromises();
    expect(onRestore).toHaveBeenCalledWith('original dream');
    expect(mockSaveTranscript).not.toHaveBeenCalled();
    expect(result.current.lastPersistedValue).toBe('original dream');
    rerender({ transcript: 'original dream' });
    act(() => { expect(result.current.noteInput('original dream with details')).toBe(true); });
    rerender({ transcript: 'original dream with details' });
    act(() => { jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS); });
    await flushPromises();
    expect(mockSaveTranscript).toHaveBeenCalledWith('original dream with details');
  });

  it('preserves the actual native draft when reads fail but writes would succeed', async () => {
    const previousPlatform = Platform.OS;
    Platform.OS = 'android';
    const key = 'gemini_dream_journal_recording_transcript';
    const values = new Map([[key, 'original native dream']]);
    let readFailed = true;
    const kv = {
      getItem: jest.fn(async (storageKey: string) => {
        if (readFailed) throw new Error('temporary native read failure');
        return values.get(storageKey) ?? null;
      }),
      setItem: jest.fn(async (storageKey: string, value: string) => { values.set(storageKey, value); }),
      removeItem: jest.fn(async (storageKey: string) => { values.delete(storageKey); }),
    };
    jest.doMock('expo-sqlite/kv-store', () => ({ default: kv }));
    try {
      const storage = jest.requireActual('../../services/storageServiceReal') as typeof import('../../services/storageServiceReal');
      mockGetRecordingDraft.mockImplementation(storage.getRecordingDraft);
      mockSaveTranscript.mockImplementation(storage.saveTranscript);
      const onRestore = jest.fn();
      const { result, rerender, unmount } = renderHook(
        ({ transcript }) => useRecordingDraftPersistence({ transcript, onRestore }),
        { initialProps: { transcript: '' } }
      );
      await waitFor(() => expect(result.current.hydrationStatus).toBe('error'));
      act(() => {
        expect(result.current.noteInput('overwrite attempt')).toBe(false);
        result.current.clearAfterSuccessfulSave();
        appStateListener?.('background');
        jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS * 2);
      });
      await flushPromises();
      expect(values.get(key)).toBe('original native dream');
      expect(kv.setItem).not.toHaveBeenCalled();
      expect(kv.removeItem).not.toHaveBeenCalled();
      readFailed = false;
      act(() => { result.current.retryHydration(); });
      await waitFor(() => expect(result.current.hydrationStatus).toBe('ready'));
      expect(onRestore).toHaveBeenCalledWith('original native dream');
      rerender({ transcript: 'original native dream' });
      act(() => { expect(result.current.noteInput('original native dream with details')).toBe(true); });
      rerender({ transcript: 'original native dream with details' });
      act(() => { jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS); });
      await waitFor(() => expect(values.get(key)).toBe('original native dream with details'));
      unmount();
    } finally {
      Platform.OS = previousPlatform;
    }
  });
});
