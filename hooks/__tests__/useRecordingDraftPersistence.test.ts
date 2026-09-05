/* @jest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
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

const deferredCleanup = new Set<() => void>();

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const settle = () => resolve(undefined as T);
  deferredCleanup.add(settle);
  void promise.then(() => deferredCleanup.delete(settle), () => deferredCleanup.delete(settle));
  return { promise, resolve, reject };
}

function loadRealStorage(): typeof import('../../services/storageServiceReal') {
  const nativeModule = require('react-native') as typeof import('react-native');
  // The real service lazily imports KV; reset that cache while keeping the
  // React Native objects already used by the mounted hook and test renderer.
  jest.resetModules();
  jest.doMock('react-native', () => nativeModule);
  return jest.requireActual('../../services/storageServiceReal');
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

  afterEach(async () => {
    cleanup();
    deferredCleanup.forEach((settle) => settle());
    await act(async () => { await jest.runAllTimersAsync(); });
    await flushPromises();
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

  it('retries a failed write without another edit and reports success only after storage resolves', async () => {
    const first = deferred<void>();
    const retry = deferred<void>();
    mockSaveTranscript.mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise);
    const { result } = renderHook(() =>
      useRecordingDraftPersistence({ transcript: '', onRestore: jest.fn() })
    );
    await flushPromises();

    act(() => {
      expect(result.current.noteInput('the only copy of this dream')).toBe(true);
      jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS);
    });
    await flushPromises();
    await act(async () => { first.reject(new Error('temporary write failure')); });
    act(() => { jest.runOnlyPendingTimers(); });
    await flushPromises();

    expect(mockSaveTranscript.mock.calls).toEqual([
      ['the only copy of this dream'],
      ['the only copy of this dream'],
    ]);
    expect(result.current.lastPersistedValue).toBe('');
    await act(async () => { retry.resolve(); });
    expect(result.current.lastPersistedValue).toBe('the only copy of this dream');
  });

  it('bounds automatic retries during a permanent failure and retries again on later lifecycle flushes', async () => {
    mockSaveTranscript.mockRejectedValue(new Error('storage unavailable'));
    const { result, unmount } = renderHook(() =>
      useRecordingDraftPersistence({ transcript: '', onRestore: jest.fn() })
    );
    await flushPromises();
    act(() => {
      result.current.noteInput('keep trying this dream');
      jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS);
    });
    await flushPromises();
    act(() => { jest.advanceTimersByTime(10_000); });
    await flushPromises();
    expect(mockSaveTranscript).toHaveBeenCalledTimes(2);
    expect(result.current.lastPersistedValue).toBe('');

    act(() => { appStateListener?.('background'); });
    await flushPromises();
    expect(mockSaveTranscript).toHaveBeenCalledTimes(3);
    act(() => { appStateListener?.('inactive'); });
    await flushPromises();
    expect(mockSaveTranscript).toHaveBeenCalledTimes(4);

    mockSaveTranscript.mockResolvedValue(undefined);
    unmount();
    await flushPromises();
    expect(mockSaveTranscript.mock.calls).toEqual(Array.from({ length: 5 }, () => ['keep trying this dream']));
    act(() => { jest.advanceTimersByTime(10_000); });
    await flushPromises();
    expect(mockSaveTranscript).toHaveBeenCalledTimes(5);
  });

  it.each(['background', 'inactive', 'unmount'] as const)(
    'preserves a %s flush that arrives before the initial write fails',
    async (lifecycle: 'background' | 'inactive' | 'unmount') => {
      const first = deferred<void>();
      mockSaveTranscript.mockReturnValueOnce(first.promise);
      const { result, unmount } = renderHook(() =>
        useRecordingDraftPersistence({ transcript: '', onRestore: jest.fn() })
      );
      await flushPromises();
      act(() => {
        result.current.noteInput('a dream leaving the foreground');
        jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS);
      });
      await flushPromises();
      act(() => {
        if (lifecycle === 'unmount') unmount();
        else appStateListener?.(lifecycle);
      });
      await act(async () => { first.reject(new Error('late write failure')); });
      await flushPromises();

      expect(mockSaveTranscript.mock.calls).toEqual([
        ['a dream leaving the foreground'],
        ['a dream leaving the foreground'],
      ]);
      if (lifecycle !== 'unmount') {
        expect(result.current.lastPersistedValue).toBe('a dream leaving the foreground');
      }
    }
  );

  it.each(['background', 'inactive', 'unmount'] as const)(
    'preserves a %s flush during the final automatic attempt if that attempt fails',
    async (lifecycle: 'background' | 'inactive' | 'unmount') => {
      const retry = deferred<void>();
      mockSaveTranscript.mockRejectedValueOnce(new Error('initial write failure')).mockReturnValueOnce(retry.promise);
      const { result, unmount } = renderHook(() =>
        useRecordingDraftPersistence({ transcript: '', onRestore: jest.fn() })
      );
      await flushPromises();
      act(() => {
        result.current.noteInput('do not lose the last flush');
        jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS);
      });
      await flushPromises();
      expect(mockSaveTranscript).toHaveBeenCalledTimes(2);
      act(() => {
        if (lifecycle === 'unmount') unmount();
        else appStateListener?.(lifecycle);
      });
      await act(async () => { retry.reject(new Error('automatic retry failed')); });
      await flushPromises();

      expect(mockSaveTranscript.mock.calls).toEqual(Array.from({ length: 3 }, () => ['do not lose the last flush']));
      if (lifecycle !== 'unmount') expect(result.current.lastPersistedValue).toBe('do not lose the last flush');
      act(() => { jest.advanceTimersByTime(10_000); });
      await flushPromises();
      expect(mockSaveTranscript).toHaveBeenCalledTimes(3);
    }
  );

  it.each([false, true])('supersedes a failed write with newer text (already queued: %s)', async (queued: boolean) => {
    const first = deferred<void>();
    mockSaveTranscript.mockReturnValueOnce(first.promise);
    const { result } = renderHook(() =>
      useRecordingDraftPersistence({ transcript: '', onRestore: jest.fn() })
    );
    await flushPromises();
    act(() => {
      result.current.noteInput('the older version');
      jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS);
    });
    await flushPromises();
    act(() => {
      result.current.noteInput('the latest version');
      if (queued) jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS);
    });
    await act(async () => { first.reject(new Error('old write failed')); });
    act(() => { jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS); });
    await flushPromises();
    expect(mockSaveTranscript.mock.calls).toEqual([['the older version'], ['the latest version']]);
    expect(result.current.lastPersistedValue).toBe('the latest version');
  });

  it('restores the last persisted text after a different in-flight write succeeds', async () => {
    mockGetSavedTranscript.mockResolvedValue('original dream');
    const pending = deferred<void>();
    mockSaveTranscript.mockReturnValueOnce(pending.promise);
    const { result, rerender } = renderHook(
      ({ transcript }) => useRecordingDraftPersistence({ transcript, onRestore: jest.fn() }),
      { initialProps: { transcript: '' } }
    );
    await flushPromises();
    rerender({ transcript: 'original dream' });
    rerender({ transcript: 'temporary voice update' });
    act(() => { jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS); });
    await flushPromises();
    rerender({ transcript: 'original dream' });
    act(() => { jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS); });
    await act(async () => { pending.resolve(); });
    await flushPromises();
    expect(mockSaveTranscript.mock.calls).toEqual([['temporary voice update'], ['original dream']]);
    expect(result.current.lastPersistedValue).toBe('original dream');
  });

  it('never retries a failed old generation after clear, and retries the failed clear itself', async () => {
    mockGetSavedTranscript.mockResolvedValue('previously persisted dream');
    const oldWrite = deferred<void>();
    const clearRetry = deferred<void>();
    mockSaveTranscript.mockReturnValueOnce(oldWrite.promise)
      .mockRejectedValueOnce(new Error('clear failed'))
      .mockReturnValueOnce(clearRetry.promise);
    const { result, rerender } = renderHook(
      ({ transcript }) => useRecordingDraftPersistence({ transcript, onRestore: jest.fn() }),
      { initialProps: { transcript: '' } }
    );
    await flushPromises();
    act(() => {
      result.current.noteInput('already added to the journal');
      jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS);
    });
    await flushPromises();
    act(() => {
      result.current.noteInput('queued before journal success');
      appStateListener?.('background');
      result.current.clearAfterSuccessfulSave();
    });
    rerender({ transcript: '' });
    await act(async () => { oldWrite.reject(new Error('old write failed')); });
    await flushPromises();
    expect(mockSaveTranscript.mock.calls).toEqual([['already added to the journal'], [''], ['']]);
    expect(result.current.lastPersistedValue).toBe('previously persisted dream');
    await act(async () => { clearRetry.resolve(); });
    expect(result.current.lastPersistedValue).toBe('');
    act(() => {
      appStateListener?.('background');
      jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS);
    });
    await flushPromises();
    expect(mockSaveTranscript).toHaveBeenCalledTimes(3);
  });

  it('retries an exhausted clear on a later flush even if hydration originally found no draft', async () => {
    const oldWrite = deferred<void>();
    mockSaveTranscript.mockReturnValueOnce(oldWrite.promise)
      .mockRejectedValueOnce(new Error('clear failed'))
      .mockRejectedValueOnce(new Error('clear retry failed'));
    const { result } = renderHook(() =>
      useRecordingDraftPersistence({ transcript: '', onRestore: jest.fn() })
    );
    await flushPromises();
    act(() => {
      result.current.noteInput('journal saved this');
      jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS);
    });
    await flushPromises();
    act(() => { result.current.clearAfterSuccessfulSave(); });
    await act(async () => { oldWrite.resolve(); });
    await flushPromises();
    expect(mockSaveTranscript.mock.calls).toEqual([['journal saved this'], [''], ['']]);
    act(() => { appStateListener?.('background'); });
    await flushPromises();
    expect(mockSaveTranscript.mock.calls).toEqual([['journal saved this'], [''], [''], ['']]);
    expect(result.current.lastPersistedValue).toBe('');
  });

  it('clears the journal-saved draft before newer input even if that input cannot be persisted', async () => {
    const oldWrite = deferred<void>();
    let stored = 'draft already saved in the journal';
    mockSaveTranscript.mockReturnValueOnce(oldWrite.promise).mockImplementation(async (value: string) => {
      if (value) throw new Error('new draft write failed');
      stored = '';
    });
    const { result } = renderHook(() =>
      useRecordingDraftPersistence({ transcript: '', onRestore: jest.fn() })
    );
    await flushPromises();
    act(() => {
      result.current.noteInput('draft already saved in the journal');
      jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS);
    });
    await flushPromises();
    act(() => {
      result.current.clearAfterSuccessfulSave();
      result.current.noteInput('the next dream');
      appStateListener?.('background');
    });
    await act(async () => { oldWrite.resolve(); });
    await flushPromises();

    expect(mockSaveTranscript.mock.calls).toEqual([
      ['draft already saved in the journal'], [''], ['the next dream'], ['the next dream'],
    ]);
    expect(stored).toBe('');
    expect(result.current.lastPersistedValue).toBe('');
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
    await flushPromises();
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
    await flushPromises();
    unmount();
    await act(async () => { pending.resolve({ status: 'loaded', value: 'original dream' }); });
    retry();
    expect(mockGetRecordingDraft).toHaveBeenCalledTimes(2);
    expect(onRestore).not.toHaveBeenCalled();
    expect(mockSaveTranscript).not.toHaveBeenCalled();
  });

  it('skips the canceled queued hydration after StrictMode restarts its effect', async () => {
    const pending = deferred<RecordingDraftReadResult>();
    mockGetRecordingDraft.mockReturnValueOnce(pending.promise);
    const onRestore = jest.fn();
    const { result } = renderHook(() => useRecordingDraftPersistence({ transcript: '', onRestore }), {
      reactStrictMode: true,
    });
    await flushPromises();
    expect(mockGetRecordingDraft).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve({ status: 'loaded', value: 'current dream' }); });
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
      const storage = loadRealStorage();
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

  it('holds replacement hydration behind an unmounted native write and its service and hook retries', async () => {
    const previousPlatform = Platform.OS;
    Platform.OS = 'android';
    const key = 'gemini_dream_journal_recording_transcript';
    const values = new Map([[key, '']]);
    const kv = {
      getItem: jest.fn(async (storageKey: string) => values.get(storageKey) ?? null),
      setItem: jest.fn(async (storageKey: string, value: string) => { values.set(storageKey, value); })
        .mockRejectedValueOnce(new Error('SQLITE_BUSY'))
        .mockRejectedValueOnce(new Error('temporary write failure')),
      removeItem: jest.fn(async (storageKey: string) => { values.delete(storageKey); }),
    };
    jest.doMock('expo-sqlite/kv-store', () => ({ default: kv }));
    try {
      const storage = loadRealStorage();
      mockGetRecordingDraft.mockImplementation(storage.getRecordingDraft);
      mockSaveTranscript.mockImplementation(storage.saveTranscript);
      const first = renderHook(() => useRecordingDraftPersistence({ transcript: '', onRestore: jest.fn() }));
      await waitFor(() => expect(first.result.current.isHydrated).toBe(true));
      act(() => {
        first.result.current.noteInput('old instance A');
        jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS);
      });
      await waitFor(() => expect(kv.setItem).toHaveBeenCalledTimes(1));
      first.unmount();
      const onRestore = jest.fn();
      const replacement = renderHook(() => useRecordingDraftPersistence({ transcript: '', onRestore }));
      await flushPromises();
      expect(replacement.result.current.hydrationStatus).toBe('loading');
      expect(kv.getItem).toHaveBeenCalledTimes(1);
      expect(onRestore).not.toHaveBeenCalled();

      await act(async () => { await jest.advanceTimersByTimeAsync(60); });
      await waitFor(() => expect(replacement.result.current.isHydrated).toBe(true));
      expect(onRestore).toHaveBeenCalledWith('old instance A');
      expect(first.result.current.lastPersistedValue).toBe('');
      act(() => {
        replacement.result.current.noteInput('replacement instance B');
        appStateListener?.('background');
      });
      await waitFor(() => expect(replacement.result.current.lastPersistedValue).toBe('replacement instance B'));
      act(() => {
        expect(first.result.current.noteInput('late callback from retired A')).toBe(false);
        first.result.current.clearAfterSuccessfulSave();
      });
      await act(async () => { await jest.runAllTimersAsync(); });
      expect(values.get(key)).toBe('replacement instance B');
      expect(await storage.getRecordingDraft()).toEqual({ status: 'loaded', value: 'replacement instance B' });
      expect(kv.setItem.mock.calls.map(([, value]: [string, string]) => value)).toEqual([
        'old instance A', 'old instance A', 'old instance A', 'replacement instance B',
      ]);
      replacement.unmount();
    } finally {
      cleanup();
      await act(async () => { await jest.runAllTimersAsync(); });
      await flushPromises();
      Platform.OS = previousPlatform;
    }
  });

  it('serializes a replacement read after an already running read without restoring into the retired instance', async () => {
    const pending = deferred<RecordingDraftReadResult>();
    mockGetRecordingDraft.mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce({ status: 'loaded', value: 'current durable draft' });
    const oldRestore = jest.fn();
    const first = renderHook(() => useRecordingDraftPersistence({ transcript: '', onRestore: oldRestore }));
    await flushPromises();
    expect(mockGetRecordingDraft).toHaveBeenCalledTimes(1);
    first.unmount();
    const currentRestore = jest.fn();
    const replacement = renderHook(() => useRecordingDraftPersistence({ transcript: '', onRestore: currentRestore }));
    await flushPromises();
    expect(mockGetRecordingDraft).toHaveBeenCalledTimes(1);
    expect(replacement.result.current.isHydrated).toBe(false);
    await act(async () => { pending.resolve({ status: 'loaded', value: 'obsolete read result' }); });
    await flushPromises();
    expect(mockGetRecordingDraft).toHaveBeenCalledTimes(2);
    expect(oldRestore).not.toHaveBeenCalled();
    expect(currentRestore).toHaveBeenCalledWith('current durable draft');
    expect(replacement.result.current.lastPersistedValue).toBe('current durable draft');
    expect(mockSaveTranscript).not.toHaveBeenCalled();
  });

  it.each(['write', 'clear'])('releases replacement hydration after a native %s exhausts all bounded retries', async (operation: string) => {
    const previousPlatform = Platform.OS;
    Platform.OS = 'android';
    const key = 'gemini_dream_journal_recording_transcript';
    const values = new Map([[key, 'confirmed primary draft']]);
    const failedValue = operation === 'clear' ? '' : 'unpersisted old instance';
    const kv = {
      getItem: jest.fn(async (storageKey: string) => values.get(storageKey) ?? null),
      setItem: jest.fn(async (storageKey: string, value: string) => {
        if (value === failedValue) throw new Error('SQLITE_BUSY');
        values.set(storageKey, value);
      }),
      removeItem: jest.fn(async (storageKey: string) => { values.delete(storageKey); }),
    };
    const legacy = {
      getItem: jest.fn(async () => 'stale legacy draft'),
      setItem: jest.fn(async () => undefined),
      removeItem: jest.fn(async () => undefined),
    };
    jest.doMock('expo-sqlite/kv-store', () => ({ default: kv }));
    jest.doMock('@react-native-async-storage/async-storage', () => ({ default: legacy }));
    try {
      const storage = loadRealStorage();
      mockGetRecordingDraft.mockImplementation(storage.getRecordingDraft);
      mockSaveTranscript.mockImplementation(storage.saveTranscript);
      const first = renderHook(() => useRecordingDraftPersistence({ transcript: '', onRestore: jest.fn() }));
      await waitFor(() => expect(first.result.current.isHydrated).toBe(true));
      act(() => {
        if (operation === 'clear') first.result.current.clearAfterSuccessfulSave();
        else {
          first.result.current.noteInput(failedValue);
          jest.advanceTimersByTime(RECORDING_DRAFT_AUTOSAVE_DELAY_MS);
        }
      });
      await waitFor(() => expect(kv.setItem).toHaveBeenCalledTimes(1));
      first.unmount();
      const onRestore = jest.fn();
      const replacement = renderHook(() => useRecordingDraftPersistence({ transcript: '', onRestore }));
      await flushPromises();
      expect(replacement.result.current.hydrationStatus).toBe('loading');
      await act(async () => { await jest.runAllTimersAsync(); });
      await waitFor(() => expect(replacement.result.current.isHydrated).toBe(true));
      expect(kv.setItem.mock.calls.map(([, value]: [string, string]) => value)).toEqual(Array(6).fill(failedValue));
      expect(onRestore).toHaveBeenCalledWith('confirmed primary draft');
      expect(first.result.current.lastPersistedValue).toBe('confirmed primary draft');
      expect(legacy.setItem).not.toHaveBeenCalled();
      expect(legacy.removeItem).not.toHaveBeenCalled();
      act(() => {
        replacement.result.current.noteInput('replacement B survives');
        appStateListener?.('background');
      });
      await waitFor(() => expect(replacement.result.current.lastPersistedValue).toBe('replacement B survives'));
      await act(async () => { await jest.runAllTimersAsync(); });
      expect(await storage.getRecordingDraft()).toEqual({ status: 'loaded', value: 'replacement B survives' });
      replacement.unmount();
    } finally {
      cleanup();
      await act(async () => { await jest.runAllTimersAsync(); });
      await flushPromises();
      Platform.OS = previousPlatform;
    }
  });

  it('publishes capture clear only after its real native tombstone succeeds and suppresses stale legacy on remount', async () => {
    const previousPlatform = Platform.OS;
    Platform.OS = 'android';
    const key = 'gemini_dream_journal_recording_transcript';
    const values = new Map([[key, 'already journaled draft']]);
    const retry = deferred<void>();
    const kv = {
      getItem: jest.fn(async (storageKey: string) => values.get(storageKey) ?? null),
      setItem: jest.fn(async (storageKey: string, value: string) => {
        await retry.promise;
        values.set(storageKey, value);
      }).mockRejectedValueOnce(new Error('temporary clear failure')),
      removeItem: jest.fn(async (storageKey: string) => { values.delete(storageKey); }),
    };
    const legacy = {
      getItem: jest.fn(async () => 'stale legacy dream'),
      setItem: jest.fn(async () => undefined),
      removeItem: jest.fn(async () => { throw new Error('legacy cleanup failed'); }),
    };
    jest.doMock('expo-sqlite/kv-store', () => ({ default: kv }));
    jest.doMock('@react-native-async-storage/async-storage', () => ({ default: legacy }));
    try {
      const storage = loadRealStorage();
      mockGetRecordingDraft.mockImplementation(storage.getRecordingDraft);
      mockSaveTranscript.mockImplementation(storage.saveTranscript);
      const first = renderHook(() => useRecordingDraftPersistence({ transcript: '', onRestore: jest.fn() }));
      await waitFor(() => expect(first.result.current.isHydrated).toBe(true));
      act(() => { first.result.current.clearAfterSuccessfulSave(); });
      await waitFor(() => expect(kv.setItem).toHaveBeenCalledTimes(2));
      expect(first.result.current.lastPersistedValue).toBe('already journaled draft');
      expect(values.get(key)).toBe('already journaled draft');
      await act(async () => { retry.resolve(); });
      await waitFor(() => expect(first.result.current.lastPersistedValue).toBe(''));
      expect(values.get(key)).toBe('');
      expect(kv.removeItem).not.toHaveBeenCalled();
      first.unmount();
      const onRestore = jest.fn();
      const replacement = renderHook(() => useRecordingDraftPersistence({ transcript: '', onRestore }));
      await waitFor(() => expect(replacement.result.current.isHydrated).toBe(true));
      expect(replacement.result.current.lastPersistedValue).toBe('');
      expect(onRestore).not.toHaveBeenCalled();
      expect(legacy.getItem).not.toHaveBeenCalled();
      expect(legacy.removeItem).toHaveBeenCalledTimes(1);
      replacement.unmount();
    } finally {
      retry.resolve();
      cleanup();
      await act(async () => { await jest.runAllTimersAsync(); });
      await flushPromises();
      Platform.OS = previousPlatform;
    }
  });
});
