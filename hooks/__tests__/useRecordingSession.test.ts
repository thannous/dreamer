/* @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { AudioModule, setAudioModeAsync } from 'expo-audio';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { Alert, AppState, Linking, Platform } from 'react-native';

import {
  ensureOfflineSttModel,
  getSpeechLocaleAvailability,
  startNativeSpeechSession,
} from '../../services/nativeSpeechRecognition';
import { isMicrophoneHeld } from '../../services/microphoneHold';
import { useRecordingSession, type RecordingSessionResult } from '../useRecordingSession';

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
  isWebSpeechRecognitionAvailable: jest.fn().mockReturnValue(true),
  startNativeSpeechSession: jest.fn().mockResolvedValue(null),
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
  };

  beforeEach(async () => {
    // A test that ends while recording unmounts its hook, which gives the microphone back a
    // turn later (setTimeout 0). Let that turn pass first, so no hold leaks into this test.
    await new Promise((resolve) => setTimeout(resolve, 0));
    jest.clearAllMocks();
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    (Platform as { OS: string }).OS = 'android';
    // Reset default mock implementations
    jest.mocked(AudioModule.getRecordingPermissionsAsync).mockResolvedValue({ granted: false } as never);
    jest.mocked(AudioModule.requestRecordingPermissionsAsync).mockResolvedValue({ granted: true } as never);
    jest.mocked(getSpeechLocaleAvailability).mockResolvedValue({
      isInstalled: true,
      installedLocales: [],
    } as never);
    jest.mocked(ensureOfflineSttModel).mockResolvedValue(false as never);
    jest.mocked(startNativeSpeechSession).mockResolvedValue({
      stop: jest.fn().mockResolvedValue({ transcript: '' }),
      abort: jest.fn(),
    });
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
      return { stop: jest.fn(), abort: jest.fn() };
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
  ] as const)('cancels pending startup on %s %s', async (platform: 'ios' | 'android', reason: 'blur' | 'unmount' | 'pause') => {
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

      let response: RecordingSessionResult | undefined;
      await act(async () => {
        response = await result.current.stopRecording();
      });

      expect(response?.transcript).toBe('');
    });

    it('should be safe to call stopRecording twice concurrently', async () => {
      const session = { stop: jest.fn().mockResolvedValue({ transcript: '' }), abort: jest.fn() };
      jest.mocked(startNativeSpeechSession).mockResolvedValueOnce(session);

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      await act(async () => {
        await result.current.startRecording('');
      });

      await act(async () => {
        await Promise.all([result.current.stopRecording(), result.current.stopRecording()]);
      });

      expect(session.stop).toHaveBeenCalledTimes(1);
    });

    it('should be safe to call stopRecording twice sequentially', async () => {
      const session = { stop: jest.fn().mockResolvedValue({ transcript: '' }), abort: jest.fn() };
      jest.mocked(startNativeSpeechSession).mockResolvedValueOnce(session);

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

      expect(session.stop).toHaveBeenCalledTimes(1);
    });

    it('should handle native session transcript', async () => {
      jest.mocked(startNativeSpeechSession).mockResolvedValueOnce({
        stop: jest.fn().mockResolvedValue({ transcript: 'native transcript' }),
        abort: jest.fn(),
      });

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      // Start recording first to initialize native session
      await act(async () => {
        await result.current.startRecording('');
      });

      let response: RecordingSessionResult | undefined;
      await act(async () => {
        response = await result.current.stopRecording();
      });

      expect(response?.transcript).toBe('native transcript');
      expect(response).not.toHaveProperty('recordedUri');
    });

    it('should return no_speech when native session exists but transcript is empty', async () => {
      jest.mocked(startNativeSpeechSession).mockResolvedValueOnce({
        stop: jest.fn().mockResolvedValue({ transcript: '' }),
        abort: jest.fn(),
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

    it.each(['ios', 'android', 'web'] as const)(
      'reports unavailable on %s when there is no system recognizer',
      async (platform: 'ios' | 'android' | 'web') => {
        (Platform as { OS: string }).OS = platform;
        jest.mocked(startNativeSpeechSession).mockResolvedValueOnce(null);
        const fetchSpy = jest.spyOn(globalThis, 'fetch');
        const { result } = renderHook(() => useRecordingSession(defaultOptions));

        let response: { success: boolean; error?: string } | undefined;
        await act(async () => {
          response = await result.current.startRecording('A draft');
        });

        expect(response).toEqual({ success: false, error: 'stt_unavailable' });
        expect(result.current.baseTranscriptRef.current).toBe('A draft');
        expect(isMicrophoneHeld()).toBe(false);
        expect(setAudioModeAsync).toHaveBeenLastCalledWith({ allowsRecording: false });
        expect(fetchSpy).not.toHaveBeenCalled();
      }
    );

    it.each(['ios', 'android', 'web'] as const)(
      'does not upload an audio file when %s recognition returns no speech',
      async (platform: 'ios' | 'android' | 'web') => {
        (Platform as { OS: string }).OS = platform;
        const fetchSpy = jest.spyOn(globalThis, 'fetch');
        // Even an unexpected URI from a system recognizer must never be uploaded.
        jest.mocked(startNativeSpeechSession).mockResolvedValueOnce({
          stop: jest.fn().mockResolvedValue({ transcript: '', recordedUri: '/path/to/audio.wav' }),
          abort: jest.fn(),
        });
        const { result } = renderHook(() => useRecordingSession(defaultOptions));
        await act(async () => { await result.current.startRecording('Existing draft'); });
        let response: RecordingSessionResult | undefined;
        await act(async () => { response = await result.current.stopRecording(); });

        expect(response).toMatchObject({ transcript: '', error: 'no_speech' });
        expect(result.current.baseTranscriptRef.current).toBe('Existing draft');
        expect(fetchSpy).not.toHaveBeenCalled();
      }
    );

    it('should return no_speech when native error is "no speech"', async () => {
      jest.mocked(startNativeSpeechSession).mockResolvedValueOnce({
        stop: jest.fn().mockResolvedValue({ transcript: '', error: 'no speech detected' }),
        abort: jest.fn(),
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
    it('returns a system recognition error without losing the draft', async () => {
      jest.mocked(startNativeSpeechSession).mockRejectedValueOnce(new Error('Speech start failed'));
      const { result } = renderHook(() => useRecordingSession(defaultOptions));
      let response: { success: boolean; error?: string } | undefined;
      await act(async () => { response = await result.current.startRecording('A draft'); });
      expect(response).toEqual({ success: false, error: 'Speech start failed' });
      expect(result.current.baseTranscriptRef.current).toBe('A draft');
      expect(isMicrophoneHeld()).toBe(false);
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
