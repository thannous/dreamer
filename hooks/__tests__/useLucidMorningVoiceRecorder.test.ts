/* @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import {
  AudioModule,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { AppState } from 'react-native';

import { LucidMorningVoiceNoteError } from '@/lib/lucid/morningVoiceNote';
import { useLucidMorningVoiceRecorder } from '@/hooks/useLucidMorningVoiceRecorder';

const SOURCE = 'file:///tmp/recorder/morning.m4a';
const NOW = Date.UTC(2026, 7, 28, 8, 0, 0);

function createRecorder(overrides?: Record<string, unknown>) {
  let isRecording = false;
  const recorder: Record<string, unknown> = {
    uri: SOURCE,
    durationMillis: 1500,
    prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
    record: jest.fn(() => {
      isRecording = true;
    }),
    pause: jest.fn(() => {
      isRecording = false;
    }),
    stop: jest.fn().mockImplementation(async () => {
      isRecording = false;
      recorder.durationMillis = 0;
    }),
    getStatus: jest.fn(() => ({
      canRecord: true,
      isRecording,
      durationMillis: isRecording ? 1500 : (recorder.durationMillis ?? 1500),
      mediaServicesDidReset: false,
      url: SOURCE,
    })),
    ...overrides,
  };
  return recorder;
}

const recorderState = {
  canRecord: true,
  isRecording: false,
  durationMillis: 1500,
  mediaServicesDidReset: false,
  url: SOURCE,
};

jest.mock('expo-audio', () => ({
  AudioModule: {
    getRecordingPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
    requestRecordingPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  },
  RecordingPresets: { HIGH_QUALITY: { extension: '.m4a' } },
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  useAudioRecorder: jest.fn(),
  useAudioRecorderState: jest.fn(),
}));

jest.mock('@/services/lucidMorningVoiceNoteStorage', () => ({
  persistLucidMorningVoiceNoteFromRecorder: jest.fn(),
}));

const appStateListeners: ((state: string) => void)[] = [];

jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn((event: string, listener: (state: string) => void) => {
      if (event === 'change') appStateListeners.push(listener);
      return { remove: jest.fn(() => {
        const index = appStateListeners.indexOf(listener);
        if (index >= 0) appStateListeners.splice(index, 1);
      }) };
    }),
  },
  Platform: { OS: 'ios' },
}));

function persistedNote(overrides: Record<string, unknown> = {}) {
  return {
    version: 1 as const,
    id: 'mvn_recording_hook01',
    userScope: 'guest',
    experimentId: null,
    status: 'ready',
    title: 'Morning voice note',
    transcript: null,
    durationMs: 1500,
    mimeType: 'audio/mp4',
    extension: '.m4a',
    uri: 'file:///data/user/0/app/files/noctalia-lucid-morning-voice/guest/mvn_recording_hook01.m4a',
    createdAt: NOW,
    updatedAt: NOW,
    recoverable: false,
    ...overrides,
  };
}

describe('useLucidMorningVoiceRecorder', () => {
  const persist = jest.fn(async (input: { durationMs: number; status: 'draft' | 'ready'; sourceUri: string }) =>
    persistedNote({
      status: input.status,
      durationMs: input.durationMs,
      recoverable: input.status === 'draft',
    })
  );

  beforeEach(() => {
    jest.clearAllMocks();
    appStateListeners.length = 0;
    persist.mockClear();
    const recorder = createRecorder();
    jest.mocked(useAudioRecorder).mockReturnValue(recorder as never);
    jest.mocked(useAudioRecorderState).mockReturnValue({ ...recorderState, isRecording: false } as never);
    jest.mocked(AudioModule.getRecordingPermissionsAsync).mockResolvedValue({ granted: false } as never);
    jest.mocked(AudioModule.requestRecordingPermissionsAsync).mockResolvedValue({ granted: true } as never);
    jest.mocked(setAudioModeAsync).mockResolvedValue(undefined);
    (AppState as { currentState: string }).currentState = 'active';
  });

  function renderRecorder(overrides: Record<string, unknown> = {}) {
    return renderHook(() =>
      useLucidMorningVoiceRecorder({
        userScope: 'guest',
        title: 'Morning voice note',
        persist: persist as never,
        now: () => NOW,
        createNoteId: () => 'mvn_recording_hook01',
        ...overrides,
      })
    );
  }

  it('does not query permission on mount', () => {
    renderRecorder();
    expect(AudioModule.getRecordingPermissionsAsync).not.toHaveBeenCalled();
    expect(AudioModule.requestRecordingPermissionsAsync).not.toHaveBeenCalled();
  });

  it('does not re-request permission when already granted', async () => {
    jest.mocked(AudioModule.getRecordingPermissionsAsync).mockResolvedValue({ granted: true } as never);
    const { result } = renderRecorder();
    await act(async () => {
      await result.current.start();
    });
    expect(AudioModule.requestRecordingPermissionsAsync).not.toHaveBeenCalled();
    expect(result.current.permission).toBe('granted');
    expect(result.current.capture.phase).toBe('recording');
  });

  it('records a denied permission without persisting a fake note', async () => {
    jest.mocked(AudioModule.requestRecordingPermissionsAsync).mockResolvedValue({ granted: false } as never);
    const { result } = renderRecorder();
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.permission).toBe('denied');
    expect(result.current.capture.phase).toBe('error');
    expect(result.current.errorReason).toBe('permission_denied');
    expect(persist).not.toHaveBeenCalled();
    expect(jest.mocked(useAudioRecorder).mock.results[0]?.value.prepareToRecordAsync).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent starts into one request, prepare and record', async () => {
    const { result } = renderRecorder();
    await act(async () => {
      await Promise.all([result.current.start(), result.current.start()]);
    });
    expect(AudioModule.requestRecordingPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(jest.mocked(useAudioRecorder).mock.results[0]?.value.prepareToRecordAsync).toHaveBeenCalledTimes(1);
    expect(jest.mocked(useAudioRecorder).mock.results[0]?.value.record).toHaveBeenCalledTimes(1);
    expect(setAudioModeAsync).toHaveBeenCalledWith({
      allowsRecording: true,
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
      allowsBackgroundRecording: false,
    });
  });

  it('pauses, resumes and reports duration without requesting permission again', async () => {
    const { result } = renderRecorder();
    await act(async () => {
      await result.current.start();
      await result.current.pause();
    });
    expect(result.current.capture.phase).toBe('paused');
    await act(async () => {
      await result.current.resume();
    });
    expect(result.current.capture.phase).toBe('recording');
    expect(result.current.durationMillis).toBe(1500);
    expect(AudioModule.requestRecordingPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('stops once and persists a ready note', async () => {
    const { result } = renderRecorder();
    await act(async () => {
      await result.current.start();
      await Promise.all([result.current.stop(), result.current.stop()]);
    });
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist.mock.calls[0][0]).toMatchObject({
      status: 'ready',
      sourceUri: SOURCE,
      durationMs: 1500,
    });
    expect(result.current.capture.phase).toBe('stopped');
    expect(result.current.note?.status).toBe('ready');
    expect(setAudioModeAsync).toHaveBeenLastCalledWith(expect.objectContaining({ allowsRecording: false }));
  });

  it('persists a recoverable draft on background or inactive', async () => {
    persist.mockImplementationOnce(async (input) =>
      persistedNote({ status: 'draft', recoverable: true, durationMs: input.durationMs })
    );
    const { result } = renderRecorder();
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      appStateListeners.forEach((listener) => listener('background'));
      await Promise.resolve();
    });
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' }));
    expect(result.current.capture.phase).toBe('recoverable');
  });

  it('persists a recoverable draft when media services reset', async () => {
    persist.mockImplementationOnce(async (input) =>
      persistedNote({ status: 'draft', recoverable: true, durationMs: input.durationMs })
    );
    const { result, rerender } = renderRecorder();
    await act(async () => {
      await result.current.start();
    });
    jest.mocked(useAudioRecorderState).mockReturnValue({
      ...recorderState,
      mediaServicesDidReset: true,
    } as never);
    await act(async () => {
      rerender();
    });
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' }));
  });

  it('persists a recoverable draft on unmount without deleting the URI', async () => {
    persist.mockImplementationOnce(async (input) =>
      persistedNote({ status: 'draft', recoverable: true, durationMs: input.durationMs })
    );
    const { result, unmount } = renderRecorder();
    await act(async () => {
      await result.current.start();
    });
    unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft', sourceUri: SOURCE }));
  });

  it('does not double-stop when a manual stop races AppState', async () => {
    const { result } = renderRecorder();
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      const stopping = result.current.stop();
      appStateListeners.forEach((listener) => listener('inactive'));
      await stopping;
    });
    expect(persist).toHaveBeenCalledTimes(1);
    expect(jest.mocked(useAudioRecorder).mock.results[0]?.value.stop).toHaveBeenCalledTimes(1);
  });

  it('fails typed when the recorder URI is missing', async () => {
    jest.mocked(useAudioRecorder).mockReturnValue(createRecorder({ uri: null }) as never);
    const { result } = renderRecorder();
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await expect(result.current.stop()).rejects.toMatchObject({ reason: 'invalid_uri' });
    });
    expect(result.current.errorReason).toBe('invalid_uri');
    expect(['stopping', 'error']).toContain(result.current.capture.phase);
  });

  it('exposes storage_full and keeps the URI for retry', async () => {
    persist.mockRejectedValueOnce(new LucidMorningVoiceNoteError('storage_full', 'Local storage is full'));
    persist.mockResolvedValueOnce(persistedNote());
    const { result } = renderRecorder();
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await expect(result.current.stop()).rejects.toMatchObject({ reason: 'storage_full' });
    });
    expect(result.current.sourceUri).toBe(SOURCE);
    expect(result.current.errorReason).toBe('storage_full');
    await act(async () => {
      await result.current.stop();
    });
    expect(persist).toHaveBeenCalledTimes(2);
    expect(result.current.capture.phase).toBe('stopped');
  });

  it('disables audio mode immediately after a successful stop even if persistence fails', async () => {
    persist.mockRejectedValueOnce(new LucidMorningVoiceNoteError('storage_full', 'Local storage is full'));
    persist.mockResolvedValueOnce(persistedNote());
    const { result } = renderRecorder();
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await expect(result.current.stop()).rejects.toMatchObject({ reason: 'storage_full' });
    });
    expect(setAudioModeAsync).toHaveBeenLastCalledWith(expect.objectContaining({ allowsRecording: false }));
    await act(async () => {
      await result.current.stop();
    });
    expect(persist).toHaveBeenCalledTimes(2);
    expect(result.current.capture.phase).toBe('stopped');
  });

  it('resets audio mode after a start failure and never uploads', async () => {
    const recorder = createRecorder({
      prepareToRecordAsync: jest.fn().mockRejectedValue(new Error('recorder unavailable')),
    });
    jest.mocked(useAudioRecorder).mockReturnValue(recorder as never);
    const { result } = renderRecorder();
    await act(async () => {
      await expect(result.current.start()).rejects.toMatchObject({ reason: 'recorder_unavailable' });
    });
    expect(setAudioModeAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsRecording: true }));
    expect(setAudioModeAsync).toHaveBeenLastCalledWith(expect.objectContaining({ allowsRecording: false }));
    expect(JSON.stringify(persist.mock.calls)).not.toMatch(/upload|cloud|sync/i);
  });

  it('persists the max observed duration even if status is 0 after stop', async () => {
    const recorder = createRecorder();
    jest.mocked(useAudioRecorder).mockReturnValue(recorder as never);
    const { result } = renderRecorder();
    await act(async () => {
      await result.current.start();
      await result.current.stop();
    });
    expect(persist.mock.calls[0][0].durationMs).toBe(1500);
  });

  it('stays requesting permission until record() succeeds after OS activity', async () => {
    jest.useFakeTimers();
    (AppState as { currentState: string }).currentState = 'inactive';
    let releaseRequest: (value: { granted: boolean }) => void = () => undefined;
    jest.mocked(AudioModule.requestRecordingPermissionsAsync).mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseRequest = (value) => resolve(value as never);
        })
    );
    const recorder = createRecorder();
    jest.mocked(useAudioRecorder).mockReturnValue(recorder as never);
    const { result } = renderRecorder();
    let started: Promise<void> | undefined;
    await act(async () => {
      started = result.current.start();
    });
    expect(result.current.capture.phase).toBe('requesting_permission');
    await act(async () => {
      releaseRequest({ granted: true });
    });
    expect(result.current.capture.phase).toBe('requesting_permission');
    expect(recorder.record).not.toHaveBeenCalled();
    await act(async () => {
      (AppState as { currentState: string }).currentState = 'active';
      appStateListeners.forEach((listener) => listener('active'));
      jest.advanceTimersByTime(300);
      await started;
    });
    expect(result.current.capture.phase).toBe('recording');
    jest.useRealTimers();
  });

  it('wraps a permission request rejection as a typed recorder error', async () => {
    jest.mocked(AudioModule.requestRecordingPermissionsAsync).mockRejectedValue(new Error('prompt failed'));
    const { result } = renderRecorder();
    await act(async () => {
      await expect(result.current.start()).rejects.toMatchObject({ reason: 'recorder_unavailable' });
    });
    expect(result.current.capture.phase).toBe('error');
    expect(result.current.errorReason).toBe('recorder_unavailable');
    expect(persist).not.toHaveBeenCalled();
  });

  it('cancels a pending permission wait on unmount and does not start later', async () => {
    (AppState as { currentState: string }).currentState = 'inactive';
    const recorder = createRecorder();
    jest.mocked(useAudioRecorder).mockReturnValue(recorder as never);
    const { result, unmount } = renderRecorder();
    await act(async () => {
      void result.current.start();
    });
    expect(result.current.capture.phase).toBe('requesting_permission');
    unmount();
    await act(async () => {
      (AppState as { currentState: string }).currentState = 'active';
      appStateListeners.forEach((listener) => listener('active'));
      await Promise.resolve();
    });
    expect(recorder.prepareToRecordAsync).not.toHaveBeenCalled();
    expect(recorder.record).not.toHaveBeenCalled();
  });

  it('does not record or leave audio mode active if unmounted during delayed prepare', async () => {
    let releasePrepare: () => void = () => undefined;
    const recorder = createRecorder({
      prepareToRecordAsync: jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            releasePrepare = () => resolve(undefined);
          })
      ),
    });
    jest.mocked(useAudioRecorder).mockReturnValue(recorder as never);
    const { result, unmount } = renderRecorder();
    let started: Promise<void> | undefined;
    await act(async () => {
      started = result.current.start();
    });
    unmount();
    await act(async () => {
      releasePrepare();
      await started;
    });
    expect(recorder.record).not.toHaveBeenCalled();
    expect(setAudioModeAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsRecording: true }));
    expect(setAudioModeAsync).toHaveBeenLastCalledWith(expect.objectContaining({ allowsRecording: false }));
  });

  it('classifies pause and resume recorder errors without leaving a false phase', async () => {
    const recorder = createRecorder({
      pause: jest.fn(() => {
        throw new Error('pause failed');
      }),
    });
    jest.mocked(useAudioRecorder).mockReturnValue(recorder as never);
    const { result } = renderRecorder();
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await expect(result.current.pause()).rejects.toMatchObject({ reason: 'recorder_unavailable' });
    });
    expect(result.current.capture.phase).toBe('error');

    const resumeRecorder = createRecorder({
      record: jest.fn(() => {
        if (resumeRecorder.resumeShouldFail) throw new Error('resume failed');
      }),
    });
    (resumeRecorder as { resumeShouldFail?: boolean }).resumeShouldFail = false;
    jest.mocked(useAudioRecorder).mockReturnValue(resumeRecorder as never);
    const resumed = renderRecorder();
    await act(async () => {
      await resumed.result.current.start();
      await resumed.result.current.pause();
    });
    (resumeRecorder as { resumeShouldFail?: boolean }).resumeShouldFail = true;
    await act(async () => {
      await expect(resumed.result.current.resume()).rejects.toMatchObject({
        reason: 'recorder_unavailable',
      });
    });
    expect(resumed.result.current.capture.phase).toBe('error');
  });

  it('does not persist from idle', async () => {
    const { result } = renderRecorder();
    await act(async () => {
      await result.current.stop();
    });
    expect(persist).not.toHaveBeenCalled();
    expect(result.current.capture.phase).toBe('idle');
  });

  it('retries ready persistence without a second native stop', async () => {
    persist.mockRejectedValueOnce(new LucidMorningVoiceNoteError('storage_full', 'Local storage is full'));
    persist.mockResolvedValueOnce(persistedNote());
    const recorder = createRecorder();
    jest.mocked(useAudioRecorder).mockReturnValue(recorder as never);
    const { result } = renderRecorder();
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await expect(result.current.stop()).rejects.toMatchObject({ reason: 'storage_full' });
    });
    await act(async () => {
      await result.current.stop();
    });
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist.mock.calls[1][0].status).toBe('ready');
  });

  it('retries a failed interrupted draft instead of converting it to ready', async () => {
    persist.mockRejectedValueOnce(new LucidMorningVoiceNoteError('persistence_failed'));
    persist.mockResolvedValueOnce(persistedNote({ status: 'draft', recoverable: true }));
    const recorder = createRecorder();
    jest.mocked(useAudioRecorder).mockReturnValue(recorder as never);
    const { result } = renderRecorder();
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      appStateListeners.forEach((listener) => listener('background'));
      await Promise.resolve();
    });
    expect(persist.mock.calls[0][0].status).toBe('draft');
    await act(async () => {
      await result.current.stop();
    });
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(persist.mock.calls[1][0].status).toBe('draft');
  });

  it('does not double persist when a manual stop races unmount', async () => {
    const { result, unmount } = renderRecorder();
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      const stopping = result.current.stop();
      unmount();
      await stopping;
    });
    expect(persist).toHaveBeenCalledTimes(1);
    expect(jest.mocked(useAudioRecorder).mock.results[0]?.value.stop).toHaveBeenCalledTimes(1);
  });

  it('freezes userScope at start even if options change', async () => {
    const persistScoped = jest.fn(async (input: { userScope: string; status: 'draft' | 'ready'; durationMs: number; sourceUri: string }) =>
      persistedNote({ userScope: input.userScope, status: input.status, durationMs: input.durationMs })
    );
    const { result, rerender } = renderHook(
      ({ userScope }: { userScope: string }) =>
        useLucidMorningVoiceRecorder({
          userScope,
          title: 'Morning voice note',
          persist: persistScoped as never,
          now: () => NOW,
          createNoteId: () => 'mvn_recording_hook01',
        }),
      { initialProps: { userScope: 'guest' } }
    );
    await act(async () => {
      await result.current.start();
    });
    rerender({ userScope: 'signed-in' });
    await act(async () => {
      await result.current.stop();
    });
    expect(persistScoped.mock.calls[0][0].userScope).toBe('guest');
  });

  it('rejects an unsupported URI extension instead of defaulting to m4a', async () => {
    jest.mocked(useAudioRecorder).mockReturnValue(
      createRecorder({ uri: 'file:///tmp/recorder/morning.ogg' }) as never
    );
    const { result } = renderRecorder();
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await expect(result.current.stop()).rejects.toMatchObject({ reason: 'invalid_uri' });
    });
    expect(persist).not.toHaveBeenCalled();
  });

  it('calls onPersistenceError exactly once when AppState draft persistence fails', async () => {
    persist.mockRejectedValueOnce(
      new LucidMorningVoiceNoteError('persistence_failed', 'Draft persist failed')
    );
    const onPersistenceError = jest.fn();
    const { result } = renderRecorder({ onPersistenceError });
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      appStateListeners.forEach((listener) => listener('background'));
      await Promise.resolve();
    });
    expect(onPersistenceError).toHaveBeenCalledTimes(1);
    expect(onPersistenceError).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'persistence_failed' })
    );
  });

  it('does not reject stop or undo a successful note when onPersisted throws', async () => {
    const onPersisted = jest.fn(() => {
      throw new Error('consumer onPersisted failed');
    });
    const { result } = renderRecorder({ onPersisted });
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await expect(result.current.stop()).resolves.toMatchObject({ status: 'ready' });
    });
    expect(onPersisted).toHaveBeenCalledTimes(1);
    expect(result.current.capture.phase).toBe('stopped');
    expect(result.current.note?.status).toBe('ready');
  });

  it('absorbs a throwing onPersistenceError while stop still rejects the original typed error', async () => {
    persist.mockRejectedValueOnce(new LucidMorningVoiceNoteError('storage_full', 'Local storage is full'));
    const onPersistenceError = jest.fn(() => {
      throw new Error('consumer onPersistenceError failed');
    });
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const { result } = renderRecorder({ onPersistenceError });
      await act(async () => {
        await result.current.start();
      });
      await act(async () => {
        await expect(result.current.stop()).rejects.toMatchObject({ reason: 'storage_full' });
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(onPersistenceError).toHaveBeenCalledTimes(1);
      expect(onPersistenceError).toHaveBeenCalledWith(expect.objectContaining({ reason: 'storage_full' }));
      expect(unhandled).toHaveLength(0);
      expect(result.current.errorReason).toBe('storage_full');
    } finally {
      process.removeListener('unhandledRejection', onUnhandled);
    }
  });
});
