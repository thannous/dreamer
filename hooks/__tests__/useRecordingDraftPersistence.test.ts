/* @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppState, type AppStateStatus } from 'react-native';

import {
  RECORDING_DRAFT_AUTOSAVE_DELAY_MS,
  useRecordingDraftPersistence,
} from '../useRecordingDraftPersistence';

const mockGetSavedTranscript = jest.fn(async (): Promise<string> => '');
const mockSaveTranscript = jest.fn(async (_value: string): Promise<void> => undefined);

jest.mock('@/services/storageService', () => ({
  getSavedTranscript: (...args: unknown[]) => mockGetSavedTranscript(...(args as [])),
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
      result.current.noteInput(long601);
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
      result.current.noteInput(voiced);
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
      result.current.noteInput('keep me after a failed save');
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
      result.current.noteInput('hello from the editor');
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
      result.current.noteInput('should never land');
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

  it('lets user input win over a late restore', async () => {
    const getDeferred = deferred<string>();
    mockGetSavedTranscript.mockReturnValue(getDeferred.promise);
    const onRestore = jest.fn();
    const { result, rerender } = renderHook(
      ({ transcript }) => useRecordingDraftPersistence({ transcript, onRestore }),
      { initialProps: { transcript: '' } }
    );

    act(() => {
      result.current.noteInput('typed while loading');
    });
    rerender({ transcript: 'typed while loading' });

    await act(async () => {
      getDeferred.resolve('saved draft from disk');
      await getDeferred.promise;
    });

    expect(onRestore).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS);
    });
    await flushPromises();

    expect(mockSaveTranscript).toHaveBeenCalledWith('typed while loading');
    expect(mockSaveTranscript).not.toHaveBeenCalledWith('saved draft from disk');
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

  it('swallows storage read and write errors without blocking later capture', async () => {
    mockGetSavedTranscript.mockRejectedValue(new Error('read failed'));
    mockSaveTranscript.mockRejectedValue(new Error('write failed'));
    const onRestore = jest.fn();

    const { result } = renderHook(() =>
      useRecordingDraftPersistence({ transcript: '', onRestore })
    );
    await flushPromises();
    expect(onRestore).not.toHaveBeenCalled();

    act(() => {
      result.current.noteInput('still capturable');
    });
    act(() => {
      jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS);
    });
    await flushPromises();

    expect(mockSaveTranscript).toHaveBeenCalledWith('still capturable');

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
      result.current.noteInput('keep this across background');
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
      result.current.noteInput('inactive fragment');
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
      result.current.noteInput('survive unmount');
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
      result.current.noteInput('should never land after save');
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
});
