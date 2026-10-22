/* @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { AudioModule, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { Alert, AppState, Linking, Platform } from 'react-native';

import {
  ensureOfflineSttModel,
  getSpeechLocaleAvailability,
  startNativeSpeechSession,
} from '../../services/nativeSpeechRecognition';
import { isMicrophoneHeld } from '../../services/microphoneHold';
import { transcribeAudio } from '../../services/speechToText';
import { useRecordingSession, type RecordingSessionResult } from '../useRecordingSession';

function mockCreateMockRecorder(overrides?: Record<string, unknown>) {
  let isRecording = false;

  const recorder: Record<string, unknown> = {
    uri: null,
    prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
    record: jest.fn(() => {
      isRecording = true;
    }),
    stop: jest.fn().mockImplementation(async () => {
      isRecording = false;
    }),
    getStatus: jest.fn(() => ({
      canRecord: isRecording,
      isRecording,
      durationMillis: 0,
      mediaServicesDidReset: false,
      url: recorder.uri,
    })),
    ...overrides,
  };

  return recorder;
}

// Mock dependencies
jest.mock('expo-audio', () => ({
  AudioModule: {
    getRecordingPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
    requestRecordingPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  },
  AudioQuality: { MEDIUM: 'medium' },
  IOSOutputFormat: { LINEARPCM: 'linearpcm' },
  RecordingPresets: {
    HIGH_QUALITY: {
      android: {},
      ios: {},
    },
  },
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  useAudioRecorder: jest.fn().mockReturnValue(mockCreateMockRecorder()),
}));

jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn((cb) => cb()),
}));

jest.mock('../../services/nativeSpeechRecognition', () => ({
  getSpeechLocaleAvailability: jest.fn().mockResolvedValue({
    isInstalled: true,
    installedLocales: [],
  }),
  ensureOfflineSttModel: jest.fn().mockResolvedValue(false),
  startNativeSpeechSession: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../services/speechToText', () => ({
  transcribeAudio: jest.fn().mockResolvedValue(''),
}));

jest.mock('react-native', () => ({
  Linking: { openSettings: jest.fn().mockResolvedValue(undefined) },
  Alert: {
    alert: jest.fn(),
  },
  AppState: {
    addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  },
  Platform: {
    OS: 'ios',
  },
  TurboModuleRegistry: {
    get: jest.fn(),
  },
  NativeModules: {
    ExponentConstants: {},
  },
}));

describe('useRecordingSession', () => {
  const defaultOptions = {
    transcriptionLocale: 'en-US',
    t: (key: string) => key,
    onPartialTranscript: jest.fn(),
    onLimitReached: jest.fn(),
  };

  beforeEach(async () => {
    // A test that ends while recording unmounts its hook, which gives the microphone back a
    // turn later (setTimeout 0). Let that turn pass first, so no hold leaks into this test.
    await new Promise((resolve) => setTimeout(resolve, 0));
    jest.clearAllMocks();
    (Platform as { OS: string }).OS = 'android';
    // Reset default mock implementations
    jest.mocked(AudioModule.getRecordingPermissionsAsync).mockResolvedValue({ granted: false } as never);
    jest.mocked(AudioModule.requestRecordingPermissionsAsync).mockResolvedValue({ granted: true } as never);
    jest.mocked(useAudioRecorder).mockReturnValue(mockCreateMockRecorder() as never);
    jest.mocked(getSpeechLocaleAvailability).mockResolvedValue({
      isInstalled: true,
      installedLocales: [],
    } as never);
    jest.mocked(ensureOfflineSttModel).mockResolvedValue(false as never);
    jest.mocked(startNativeSpeechSession).mockResolvedValue(null);
    jest.mocked(transcribeAudio).mockResolvedValue('');
    jest.mocked(FileSystemLegacy.deleteAsync).mockResolvedValue(undefined);
    jest.mocked(setAudioModeAsync).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize with isRecording false', () => {
    const { result } = renderHook(() => useRecordingSession(defaultOptions));

    expect(result.current.isRecording).toBe(false);
  });

  it('should initialize with unknown recording permission state', () => {
    const { result } = renderHook(() => useRecordingSession(defaultOptions));

    expect(result.current.recordingPermissionState).toBe('unknown');
  });

  it('forwards an unexpected native end to the recording screen', async () => {
    const onNativeEnd = jest.fn();
    let nativeOnEnd: (() => void) | undefined;
    jest.mocked(startNativeSpeechSession).mockImplementationOnce(async (_language, options) => {
      nativeOnEnd = options?.onEnd;
      return {
        stop: jest.fn().mockResolvedValue({ transcript: '' }),
        abort: jest.fn(),
        hasRecording: true,
      };
    });

    const { result } = renderHook(() =>
      useRecordingSession({
        ...defaultOptions,
        onNativeEnd,
      })
    );

    await act(async () => {
      await result.current.startRecording('');
    });

    act(() => {
      nativeOnEnd?.();
    });

    expect(onNativeEnd).toHaveBeenCalledTimes(1);
  });

  it('waits for recognizer readiness before reporting active speech, then clears it on end', async () => {
    let onListeningChange: ((listening: boolean) => void) | undefined;
    jest.mocked(startNativeSpeechSession).mockImplementationOnce(async (_locale, options) => {
      onListeningChange = options?.onListeningChange;
      return { stop: jest.fn(), abort: jest.fn(), hasRecording: true };
    });
    const { result } = renderHook(() => useRecordingSession(defaultOptions));
    await act(async () => { await result.current.startRecording('A blue room'); });
    expect(result.current.isSpeechListening).toBe(false);
    act(() => onListeningChange?.(true));
    expect(result.current.isSpeechListening).toBe(true);
    act(() => onListeningChange?.(false));
    expect(result.current.isSpeechListening).toBe(false);
  });

  it.each([
    ['ios', 'blur'], ['ios', 'unmount'], ['ios', 'pause'], ['android', 'pause'],
  ] as const)('cancels pending startup on %s %s', async (platform, reason) => {
    (Platform as { OS: string }).OS = platform;
    jest.mocked(AudioModule.getRecordingPermissionsAsync).mockResolvedValue({ granted: true } as never);
    let finishStart!: (session: any) => void;
    jest.mocked(startNativeSpeechSession).mockImplementation(() => new Promise((resolve) => { finishStart = resolve; }));
    const session = { abort: jest.fn(), stop: jest.fn() };
    const { result } = renderHook(() => useRecordingSession(defaultOptions));
    let pending!: ReturnType<typeof result.current.startRecording>;
    await act(async () => { pending = result.current.startRecording('My draft'); });
    const options = jest.mocked(startNativeSpeechSession).mock.calls[0][1];
    await act(async () => {
      if (reason === 'pause') await result.current.stopRecording();
      else await result.current.forceStopRecording(reason);
    });
    await act(async () => { finishStart(session); await pending; });
    await expect(pending).resolves.toEqual({ success: false, error: 'cancelled' });
    expect(options?.signal?.aborted).toBe(true);
    expect(session.abort).toHaveBeenCalled();
    expect(result.current.isRecording).toBe(false);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('reports speech permission denial with a working Settings recovery action', async () => {
    (Platform as { OS: string }).OS = 'ios';
    jest.mocked(startNativeSpeechSession).mockRejectedValue(new Error('speech_permission_denied'));
    const { result } = renderHook(() => useRecordingSession(defaultOptions));
    let response: { success: boolean; error?: string } | undefined;
    await act(async () => { response = await result.current.startRecording(''); });
    expect(response).toEqual({ success: false, error: 'permission_denied' });
    expect(result.current.isRecording).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith(
      'recording.alert.permission_required.title',
      'recording.alert.speech_permission_required.message',
      expect.any(Array),
    );
    const buttons = jest.mocked(Alert.alert).mock.calls[0][2];
    await act(async () => { buttons?.[1].onPress?.(); });
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
  });

  it('startRecording should return success when permissions granted', async () => {
    const { result } = renderHook(() => useRecordingSession(defaultOptions));

    let response: { success: boolean; error?: string } | undefined;
    await act(async () => {
      response = await result.current.startRecording('');
    });

    expect(response?.success).toBe(true);
    expect(result.current.recordingPermissionState).toBe('granted');
  });

  it('does not reopen the Android permission activity when microphone access is already granted', async () => {
    jest.mocked(AudioModule.getRecordingPermissionsAsync).mockResolvedValue({ granted: true } as never);

    const { result } = renderHook(() => useRecordingSession(defaultOptions));

    await act(async () => {
      await result.current.startRecording('');
    });

    expect(AudioModule.getRecordingPermissionsAsync).toHaveBeenCalled();
    expect(AudioModule.requestRecordingPermissionsAsync).not.toHaveBeenCalled();
    expect(result.current.isRecording).toBe(true);
  });

  it('requests Android microphone access when it is not already granted', async () => {
    jest.mocked(AudioModule.getRecordingPermissionsAsync).mockResolvedValue({ granted: false } as never);

    const { result } = renderHook(() => useRecordingSession(defaultOptions));

    await act(async () => {
      await result.current.startRecording('');
    });

    expect(AudioModule.requestRecordingPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(true);
  });

  it('starts immediately after the first permission grant without requiring an offline language pack', async () => {
    jest.mocked(getSpeechLocaleAvailability).mockResolvedValueOnce({
      isInstalled: false,
      installedLocales: ['en-US'],
    } as never);

    const { result } = renderHook(() => useRecordingSession({
      ...defaultOptions,
      transcriptionLocale: 'fr-FR',
    }));

    let response: { success: boolean; error?: string } | undefined;
    await act(async () => {
      response = await result.current.startRecording('');
    });

    expect(response).toEqual({ success: true });
    expect(result.current.recordingPermissionState).toBe('granted');
    expect(ensureOfflineSttModel).not.toHaveBeenCalled();
    expect(getSpeechLocaleAvailability).not.toHaveBeenCalled();
    expect(startNativeSpeechSession).toHaveBeenCalledWith(
      'fr-FR',
      expect.objectContaining({
        onPartial: expect.any(Function),
        permissionAlreadyGranted: true,
      })
    );
  });

  it('holds the microphone from the start’s audio mode to the stop’s, so the app’s cues leave the recording alone', async () => {
    const heldOnModeChange: boolean[] = [];
    jest.mocked(setAudioModeAsync).mockImplementation(async () => {
      heldOnModeChange.push(isMicrophoneHeld());
    });
    expect(isMicrophoneHeld()).toBe(false);
    const { result } = renderHook(() => useRecordingSession(defaultOptions));

    await act(async () => {
      await result.current.startRecording('');
    });
    expect(isMicrophoneHeld()).toBe(true);

    await act(async () => {
      await result.current.stopRecording();
    });
    expect(isMicrophoneHeld()).toBe(false);
    expect(heldOnModeChange).toEqual([true, true]);
  });

  it('keeps the microphone held through an unmount until the forced stop has torn down', async () => {
    const heldOnReset: boolean[] = [];
    jest.mocked(setAudioModeAsync).mockImplementation(async (mode) => {
      if ((mode as { allowsRecording?: boolean }).allowsRecording === false) heldOnReset.push(isMicrophoneHeld());
    });
    const { result, unmount } = renderHook(() => useRecordingSession(defaultOptions));
    await act(async () => {
      await result.current.startRecording('');
    });
    const { forceStopRecording } = result.current;

    // The screen's own cleanup, which forces the stop, runs after the hook's.
    unmount();
    expect(isMicrophoneHeld()).toBe(true);
    await act(async () => {
      await forceStopRecording('unmount');
    });

    expect(heldOnReset).toEqual([true]);
    expect(isMicrophoneHeld()).toBe(false);
  });

  it('gives the microphone back after an unmount that no forced stop follows', async () => {
    const { result, unmount } = renderHook(() => useRecordingSession(defaultOptions));
    await act(async () => {
      await result.current.startRecording('');
    });

    unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Otherwise the app's cues would stay silent for the rest of the launch.
    expect(isMicrophoneHeld()).toBe(false);
  });

  it('stopRecording should return transcript result', async () => {
    const { result } = renderHook(() => useRecordingSession(defaultOptions));

    let response: { transcript: string; error?: string } | undefined;
    await act(async () => {
      response = await result.current.stopRecording();
    });

    expect(response).toHaveProperty('transcript');
  });

  it('toggleRecording should start recording when not recording', async () => {
    const { result } = renderHook(() => useRecordingSession(defaultOptions));

    await act(async () => {
      await result.current.toggleRecording('');
    });

    // The recording should have started (isRecording becomes true)
    expect(result.current.isRecording).toBe(true);
  });

  it('should handle permission denied', async () => {
    jest.mocked(AudioModule.requestRecordingPermissionsAsync).mockResolvedValueOnce({
      granted: false,
      canAskAgain: true,
      expires: 'never',
      status: 'denied',
    } as never);

    const { result } = renderHook(() => useRecordingSession(defaultOptions));

    let response: { success: boolean; error?: string } | undefined;
    await act(async () => {
      response = await result.current.startRecording('');
    });

    expect(response?.success).toBe(false);
    expect(response?.error).toBe('permission_denied');
    expect(result.current.recordingPermissionState).toBe('denied');
  });

  describe('stopRecording', () => {
    it('should return empty transcript when no recording exists', async () => {
      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      let response: { transcript: string; error?: string; recordedUri?: string | null } | undefined;
      await act(async () => {
        response = await result.current.stopRecording();
      });

      expect(response?.transcript).toBe('');
    });

    it('should be safe to call stopRecording twice concurrently', async () => {
      const recorder = mockCreateMockRecorder({ uri: '/path/to/recorded.caf' });
      jest.mocked(useAudioRecorder).mockReturnValue(recorder as never);

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      await act(async () => {
        await result.current.startRecording('');
      });

      await act(async () => {
        await Promise.all([result.current.stopRecording(), result.current.stopRecording()]);
      });

      expect(recorder.stop as any).toHaveBeenCalledTimes(1);
    });

    it('should be safe to call stopRecording twice sequentially', async () => {
      const recorder = mockCreateMockRecorder({ uri: '/path/to/recorded.caf' });
      jest.mocked(useAudioRecorder).mockReturnValue(recorder as never);

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      await act(async () => {
        await result.current.startRecording('');
      });

      await act(async () => {
        await result.current.stopRecording();
      });

      await act(async () => {
        await result.current.stopRecording();
      });

      expect(recorder.stop as any).toHaveBeenCalledTimes(1);
    });

    it('should handle native session transcript', async () => {
      jest.mocked(startNativeSpeechSession).mockResolvedValueOnce({
        stop: jest.fn().mockResolvedValue({ transcript: 'native transcript', recordedUri: '/path/to/audio.caf' }),
        abort: jest.fn(),
        hasRecording: true,
      });

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      // Start recording first to initialize native session
      await act(async () => {
        await result.current.startRecording('');
      });

      let response: { transcript: string; error?: string; recordedUri?: string | null } | undefined;
      await act(async () => {
        response = await result.current.stopRecording();
      });

      expect(response?.transcript).toBe('native transcript');
      expect(response?.recordedUri).toBe('/path/to/audio.caf');
      expect(FileSystemLegacy.deleteAsync).toHaveBeenCalledWith('/path/to/audio.caf', {
        idempotent: true,
      });
    });

    it('should return no_speech when native session exists but transcript is empty', async () => {
      jest.mocked(startNativeSpeechSession).mockResolvedValueOnce({
        stop: jest.fn().mockResolvedValue({ transcript: '', recordedUri: '/path/to/audio.caf' }),
        abort: jest.fn(),
        hasRecording: true,
      });

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      await act(async () => {
        await result.current.startRecording('');
      });

      let response: { transcript: string; error?: string } | undefined;
      await act(async () => {
        response = await result.current.stopRecording();
      });

      expect(response?.transcript).toBe('');
      expect(response?.error).toBe('no_speech');
    });

    it('should use native recognition only on iOS', async () => {
      (Platform as { OS: string }).OS = 'ios';
      jest.mocked(startNativeSpeechSession).mockResolvedValueOnce({
        stop: jest.fn().mockResolvedValue({ transcript: '', recordedUri: '/path/to/audio.caf' }),
        abort: jest.fn(),
        hasRecording: true,
      });

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      await act(async () => {
        await result.current.startRecording('');
      });

      let response: RecordingSessionResult | undefined;
      await act(async () => {
        response = await result.current.stopRecording();
      });

      expect(response).toMatchObject({ transcript: '', error: 'no_speech' });
      expect(transcribeAudio).not.toHaveBeenCalled();
    });

    it('should report native recognition as unavailable on iOS instead of recording for server STT', async () => {
      (Platform as { OS: string }).OS = 'ios';
      const recorder = mockCreateMockRecorder({ uri: '/path/to/recorded.caf' });
      jest.mocked(useAudioRecorder).mockReturnValue(recorder as never);
      jest.mocked(startNativeSpeechSession).mockResolvedValueOnce(null);

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      let response: { success: boolean; error?: string } | undefined;
      await act(async () => {
        response = await result.current.startRecording('');
      });

      expect(response).toEqual({ success: false, error: 'stt_unavailable' });
      // A start that gives up hands the microphone back.
      expect(isMicrophoneHeld()).toBe(false);
      expect(recorder.prepareToRecordAsync).not.toHaveBeenCalled();
      expect(recorder.record).not.toHaveBeenCalled();
      expect(transcribeAudio).not.toHaveBeenCalled();
      expect(setAudioModeAsync).toHaveBeenLastCalledWith({ allowsRecording: false });
    });

    it('should return stt_unavailable when native session is unavailable', async () => {
      jest.mocked(startNativeSpeechSession).mockResolvedValueOnce(null);
      jest.mocked(useAudioRecorder).mockReturnValue(
        mockCreateMockRecorder({ uri: '/path/to/recorded.caf' }) as never
      );

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      await act(async () => {
        await result.current.startRecording('');
      });

      let response: { transcript: string; error?: string; recordedUri?: string | null } | undefined;
      await act(async () => {
        response = await result.current.stopRecording();
      });

      expect(response?.transcript).toBe('');
      expect(response?.recordedUri).toBe('/path/to/recorded.caf');
      expect(response?.error).toBe('stt_unavailable');
      expect(transcribeAudio).toHaveBeenCalledWith({
        uri: '/path/to/recorded.caf',
        languageCode: 'en-US',
      });
      expect(FileSystemLegacy.deleteAsync).toHaveBeenCalledWith('/path/to/recorded.caf', {
        idempotent: true,
      });
    });

    it('should fall back to server transcription when native speech is unavailable', async () => {
      const recorder = mockCreateMockRecorder({ uri: '/path/to/server-fallback.amr' });
      jest.mocked(startNativeSpeechSession).mockResolvedValueOnce(null);
      jest.mocked(useAudioRecorder).mockReturnValue(recorder as never);
      jest.mocked(transcribeAudio).mockResolvedValueOnce('server transcript');

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      await act(async () => {
        await result.current.startRecording('');
      });

      let response: RecordingSessionResult | undefined;
      await act(async () => {
        response = await result.current.stopRecording();
      });

      expect(response).toMatchObject({
        transcript: 'server transcript',
        recordedUri: '/path/to/server-fallback.amr',
        error: undefined,
      });
      expect(transcribeAudio).toHaveBeenCalledWith({
        uri: '/path/to/server-fallback.amr',
        languageCode: 'en-US',
      });
      expect(FileSystemLegacy.deleteAsync).toHaveBeenCalledWith('/path/to/server-fallback.amr', {
        idempotent: true,
      });
    });

    it('says when server transcription has spent its daily budget, then stops asking it', async () => {
      const recorder = mockCreateMockRecorder({ uri: '/path/to/server-fallback.amr' });
      jest.mocked(startNativeSpeechSession).mockResolvedValue(null);
      jest.mocked(useAudioRecorder).mockReturnValue(recorder as never);
      jest.mocked(transcribeAudio).mockRejectedValueOnce(Object.assign(new Error('HTTP 429'), {
        status: 429,
        body: { code: 'AI_DAILY_LIMIT', retryAfter: 3600 },
      }));

      const { result, rerender } = renderHook(
        ({ scope }: { scope: string }) => useRecordingSession({ ...defaultOptions, transcriptionScope: scope }),
        { initialProps: { scope: 'guest' } }
      );
      const record = async () => {
        let response: RecordingSessionResult | undefined;
        await act(async () => {
          await result.current.startRecording('');
        });
        await act(async () => {
          response = await result.current.stopRecording();
        });
        return response;
      };

      expect((await record())?.error).toBe('daily_ai_limit');
      // Paused: the server is not asked, and the user still hears why.
      expect((await record())?.error).toBe('daily_ai_limit');
      expect(transcribeAudio).toHaveBeenCalledTimes(1);

      // A guest who signs in has the account's own budget.
      rerender({ scope: 'user-1' });
      expect((await record())?.error).toBe('stt_unavailable');
      expect(transcribeAudio).toHaveBeenCalledTimes(2);

      // The budget comes back after the delay the server gave.
      jest.mocked(transcribeAudio).mockRejectedValueOnce(Object.assign(new Error('HTTP 429'), {
        status: 429,
        body: { code: 'AI_DAILY_LIMIT', retryAfter: 3600 },
      }));
      expect((await record())?.error).toBe('daily_ai_limit');
      const now = Date.now();
      const clock = jest.spyOn(Date, 'now').mockReturnValue(now + 3601 * 1000);
      try {
        expect((await record())?.error).toBe('stt_unavailable');
        expect(transcribeAudio).toHaveBeenCalledTimes(4);
      } finally {
        clock.mockRestore();
      }
    });

    it('does not pause a newly signed-in account for a guest refusal still on its way', async () => {
      const recorder = mockCreateMockRecorder({ uri: '/path/to/server-fallback.amr' });
      jest.mocked(startNativeSpeechSession).mockResolvedValue(null);
      jest.mocked(useAudioRecorder).mockReturnValue(recorder as never);
      let refuse!: (error: unknown) => void;
      jest.mocked(transcribeAudio).mockImplementationOnce(() => new Promise((_resolve, reject) => { refuse = reject; }));

      const { result, rerender } = renderHook(
        ({ scope }: { scope: string }) => useRecordingSession({ ...defaultOptions, transcriptionScope: scope }),
        { initialProps: { scope: 'guest' } }
      );
      await act(async () => {
        await result.current.startRecording('');
      });
      let stopping!: Promise<RecordingSessionResult>;
      await act(async () => {
        stopping = result.current.stopRecording();
      });
      await waitFor(() => expect(transcribeAudio).toHaveBeenCalledTimes(1));
      rerender({ scope: 'user-1' });
      let stale: RecordingSessionResult | undefined;
      await act(async () => {
        refuse(Object.assign(new Error('HTTP 429'), { status: 429, body: { code: 'AI_DAILY_LIMIT', retryAfter: 3600 } }));
        stale = await stopping;
      });
      expect(stale?.error).not.toBe('daily_ai_limit');

      await act(async () => {
        await result.current.startRecording('');
      });
      await act(async () => {
        await result.current.stopRecording();
      });
      expect(transcribeAudio).toHaveBeenCalledTimes(2);
    });

    it('should return no_speech when native error is "no speech"', async () => {
      jest.mocked(startNativeSpeechSession).mockResolvedValueOnce({
        stop: jest.fn().mockResolvedValue({ transcript: '', error: 'no speech detected', recordedUri: '/path/audio.caf' }),
        abort: jest.fn(),
        hasRecording: true,
      });

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      await act(async () => {
        await result.current.startRecording('');
      });

      let response: { transcript: string; error?: string } | undefined;
      await act(async () => {
        response = await result.current.stopRecording();
      });

      expect(response?.transcript).toBe('');
      expect(response?.error).toBe('no_speech');
    });

    it('should return stt_unavailable when no native session and no transcript', async () => {
      jest.mocked(startNativeSpeechSession).mockResolvedValueOnce(null);

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      await act(async () => {
        await result.current.startRecording('');
      });

      let response: { transcript: string; error?: string } | undefined;
      await act(async () => {
        response = await result.current.stopRecording();
      });

      expect(response?.transcript).toBe('');
      expect(response?.error).toBe('stt_unavailable');
    });
  });

  describe('forceStopRecording', () => {
    it('should stop recording on blur', async () => {
      const mockAbort = jest.fn();

      jest.mocked(startNativeSpeechSession).mockResolvedValueOnce({
        stop: jest.fn().mockResolvedValue({ transcript: '' }),
        abort: mockAbort,
        hasRecording: true,
      });

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      await act(async () => {
        await result.current.startRecording('');
      });

      expect(result.current.isRecording).toBe(true);

      await act(async () => {
        await result.current.forceStopRecording('blur');
      });

      expect(result.current.isRecording).toBe(false);
      expect(mockAbort).toHaveBeenCalled();
    });

    it('should stop recording on unmount', async () => {
      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      await act(async () => {
        await result.current.startRecording('');
      });

      await act(async () => {
        await result.current.forceStopRecording('unmount');
      });

      expect(result.current.isRecording).toBe(false);
    });

    it('should do nothing when not recording', async () => {
      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      await act(async () => {
        await result.current.forceStopRecording('blur');
      });

      // Should not throw and state should remain false
      expect(result.current.isRecording).toBe(false);
    });
  });

  describe('toggleRecording', () => {
    it('should stop recording when already recording', async () => {
      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      // Start recording
      await act(async () => {
        await result.current.startRecording('');
      });

      expect(result.current.isRecording).toBe(true);

      // Toggle should stop
      await act(async () => {
        await result.current.toggleRecording('');
      });

      expect(result.current.isRecording).toBe(false);
    });

    it('should prevent concurrent transitions', async () => {
      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      // Start two toggles simultaneously
      let response2: { success?: boolean; error?: string } | undefined;

      await act(async () => {
        const promise1 = result.current.toggleRecording('');
        const promise2 = result.current.toggleRecording('');
        [, response2] = await Promise.all([promise1, promise2]);
      });

      // Second one should fail due to transition in progress
      expect(response2?.error).toBe('transition_in_progress');
    });
  });

  describe('setupAppStateListener', () => {
    it('should return cleanup function', () => {
      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      const cleanup = result.current.setupAppStateListener();

      expect(typeof cleanup).toBe('function');
    });

    it('should stop recording when app goes to background', async () => {
      let appStateCallback: ((state: string) => void) | undefined;

      jest.mocked(AppState.addEventListener).mockImplementation((_, callback) => {
        appStateCallback = callback as (state: string) => void;
        return { remove: jest.fn() };
      });

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      // Start recording
      await act(async () => {
        await result.current.startRecording('');
      });

      // Setup listener
      act(() => {
        result.current.setupAppStateListener();
      });

      // Simulate app going to background
      await act(async () => {
        appStateCallback?.('background');
      });

      // Should have stopped recording
      expect(result.current.isRecording).toBe(false);
    });

    it('should stop recording when app becomes inactive', async () => {
      let appStateCallback: ((state: string) => void) | undefined;

      jest.mocked(AppState.addEventListener).mockImplementation((_, callback) => {
        appStateCallback = callback as (state: string) => void;
        return { remove: jest.fn() };
      });

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      await act(async () => {
        await result.current.startRecording('');
      });

      act(() => {
        result.current.setupAppStateListener();
      });

      await act(async () => {
        appStateCallback?.('inactive');
      });

      expect(result.current.isRecording).toBe(false);
    });
  });

  describe('requestPermissions', () => {
    it('does not reopen the system prompt when permissions are already granted', async () => {
      jest.mocked(AudioModule.getRecordingPermissionsAsync).mockResolvedValue({
        granted: true,
      } as never);

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      await act(async () => {
        await result.current.requestPermissions();
      });

      expect(AudioModule.requestRecordingPermissionsAsync).not.toHaveBeenCalled();
      expect(result.current.recordingPermissionState).toBe('granted');
    });

    it('should show alert when permissions denied', async () => {
      jest.mocked(AudioModule.requestRecordingPermissionsAsync).mockResolvedValueOnce({
        granted: false,
        canAskAgain: true,
        expires: 'never',
        status: 'denied',
      } as never);

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      await act(async () => {
        await result.current.requestPermissions();
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'recording.alert.permission_required.title',
        'recording.alert.permission_required.message'
      );
    });

    it('should not show alert when permissions granted', async () => {
      jest.mocked(AudioModule.requestRecordingPermissionsAsync).mockResolvedValueOnce({
        granted: true,
      } as never);

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      await act(async () => {
        await result.current.requestPermissions();
      });

      expect(Alert.alert).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle audio recorder error during start', async () => {
      jest.mocked(useAudioRecorder).mockReturnValue(
        mockCreateMockRecorder({
          prepareToRecordAsync: jest.fn().mockRejectedValue(new Error('Recorder init failed')),
        }) as never
      );

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      let response: { success: boolean; error?: string } | undefined;
      await act(async () => {
        response = await result.current.startRecording('');
      });

      expect(response?.success).toBe(false);
      expect(response?.error).toBe('Recorder init failed');
    });

    it('should handle recorder already released error gracefully', async () => {
      jest.mocked(useAudioRecorder).mockReturnValue(
        mockCreateMockRecorder({
          uri: '/path/audio.caf',
          stop: jest.fn().mockRejectedValue(new Error('Recorder was already released')),
        }) as never
      );

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      await act(async () => {
        await result.current.startRecording('');
      });

      let response: { transcript: string; error?: string } | undefined;
      await act(async () => {
        response = await result.current.stopRecording();
      });

      // The recorder release error is silently handled (swallowed), so the flow continues
      // and ends up returning a result (possibly from Google STT fallback)
      // The key is that it doesn't throw
      expect(response).toBeDefined();
      expect(response?.transcript).toBeDefined();
    });

    it('should handle setAudioModeAsync error during start', async () => {
      jest.mocked(setAudioModeAsync).mockRejectedValueOnce(new Error('Audio mode failed'));

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      let response: { success: boolean; error?: string } | undefined;
      await act(async () => {
        response = await result.current.startRecording('');
      });

      expect(response?.success).toBe(false);
      expect(response?.error).toBe('Audio mode failed');
    });

    it('should reset audio mode when native speech startup fails', async () => {
      jest.mocked(startNativeSpeechSession).mockRejectedValueOnce(new Error('Speech start failed'));

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      let response: { success: boolean; error?: string } | undefined;
      await act(async () => {
        response = await result.current.startRecording('');
      });

      expect(response).toEqual({ success: false, error: 'Speech start failed' });
      expect(setAudioModeAsync).toHaveBeenNthCalledWith(1, {
        allowsRecording: true,
        playsInSilentMode: true,
      });
      expect(setAudioModeAsync).toHaveBeenNthCalledWith(2, { allowsRecording: false });
    });
  });

  describe('baseTranscriptRef', () => {
    it('should store current transcript on start', async () => {
      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      await act(async () => {
        await result.current.startRecording('existing transcript');
      });

      expect(result.current.baseTranscriptRef.current).toBe('existing transcript');
    });
  });

  describe('onPartialTranscript callback', () => {
    it('should call onPartialTranscript when native session provides partial', async () => {
      const onPartialMock = jest.fn();
      let capturedOnPartial: ((text: string) => void) | undefined;

      jest.mocked(startNativeSpeechSession).mockImplementation(async (_locale, options) => {
        capturedOnPartial = options?.onPartial;
        return {
          stop: jest.fn().mockResolvedValue({ transcript: 'final' }),
          abort: jest.fn(),
          hasRecording: true,
        };
      });

      const { result } = renderHook(() =>
        useRecordingSession({ ...defaultOptions, onPartialTranscript: onPartialMock })
      );

      await act(async () => {
        await result.current.startRecording('');
      });

      // Simulate partial transcript callback
      act(() => {
        capturedOnPartial?.('partial text');
      });

      expect(onPartialMock).toHaveBeenCalledWith('partial text', { baseTranscript: '' });
    });
  });
});
