// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react';
import { AudioModule, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Alert, AppState } from 'react-native';

import { ensureOfflineSttModel, startNativeSpeechSession } from '../../services/nativeSpeechRecognition';
import { transcribeAudio } from '../../services/speechToText';

import { useRecordingSession } from '../useRecordingSession';

// Mock dependencies
vi.mock('expo-audio', () => ({
  AudioModule: {
    requestRecordingPermissionsAsync: vi.fn().mockResolvedValue({ granted: true }),
  },
  AudioQuality: { MEDIUM: 'medium' },
  IOSOutputFormat: { LINEARPCM: 'linearpcm' },
  RecordingPresets: {
    HIGH_QUALITY: {
      android: {},
      ios: {},
    },
  },
  setAudioModeAsync: vi.fn().mockResolvedValue(undefined),
  useAudioRecorder: vi.fn().mockReturnValue({
    isRecording: false,
    uri: null,
    prepareToRecordAsync: vi.fn().mockResolvedValue(undefined),
    record: vi.fn(),
    stop: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('expo-router', () => ({
  useFocusEffect: vi.fn((cb) => cb()),
}));

vi.mock('../../services/nativeSpeechRecognition', () => ({
  getSpeechLocaleAvailability: vi.fn().mockResolvedValue({
    isInstalled: true,
    installedLocales: [],
  }),
  ensureOfflineSttModel: vi.fn().mockResolvedValue(false),
  startNativeSpeechSession: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/speechToText', () => ({
  transcribeAudio: vi.fn().mockResolvedValue('transcribed text'),
}));

vi.mock('react-native', () => ({
  Alert: {
    alert: vi.fn(),
  },
  AppState: {
    addEventListener: vi.fn().mockReturnValue({ remove: vi.fn() }),
  },
  Platform: {
    OS: 'ios',
  },
  TurboModuleRegistry: {
    get: vi.fn(),
  },
  NativeModules: {
    ExponentConstants: {},
  },
}));

describe('useRecordingSession', () => {
  const defaultOptions = {
    transcriptionLocale: 'en-US',
    t: (key: string) => key,
    onPartialTranscript: vi.fn(),
    onLimitReached: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock implementations
    vi.mocked(AudioModule.requestRecordingPermissionsAsync).mockResolvedValue({ granted: true } as never);
    vi.mocked(useAudioRecorder).mockReturnValue({
      isRecording: false,
      uri: null,
      prepareToRecordAsync: vi.fn().mockResolvedValue(undefined),
      record: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
    } as never);
    vi.mocked(ensureOfflineSttModel).mockResolvedValue(false as never);
    vi.mocked(startNativeSpeechSession).mockResolvedValue(null);
    vi.mocked(transcribeAudio).mockResolvedValue('transcribed text');
    vi.mocked(setAudioModeAsync).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with isRecording false', () => {
    const { result } = renderHook(() => useRecordingSession(defaultOptions));

    expect(result.current.isRecording).toBe(false);
  });

  it('should provide startRecording function', () => {
    const { result } = renderHook(() => useRecordingSession(defaultOptions));

    expect(typeof result.current.startRecording).toBe('function');
  });

  it('should provide stopRecording function', () => {
    const { result } = renderHook(() => useRecordingSession(defaultOptions));

    expect(typeof result.current.stopRecording).toBe('function');
  });

  it('should provide toggleRecording function', () => {
    const { result } = renderHook(() => useRecordingSession(defaultOptions));

    expect(typeof result.current.toggleRecording).toBe('function');
  });

  it('should provide forceStopRecording function', () => {
    const { result } = renderHook(() => useRecordingSession(defaultOptions));

    expect(typeof result.current.forceStopRecording).toBe('function');
  });

  it('should provide requestPermissions function', () => {
    const { result } = renderHook(() => useRecordingSession(defaultOptions));

    expect(typeof result.current.requestPermissions).toBe('function');
  });

  it('should provide setupAppStateListener function', () => {
    const { result } = renderHook(() => useRecordingSession(defaultOptions));

    expect(typeof result.current.setupAppStateListener).toBe('function');
  });

  it('startRecording should return success when permissions granted', async () => {
    const { result } = renderHook(() => useRecordingSession(defaultOptions));

    let response: { success: boolean; error?: string } | undefined;
    await act(async () => {
      response = await result.current.startRecording('');
    });

    expect(response?.success).toBe(true);
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
    vi.mocked(AudioModule.requestRecordingPermissionsAsync).mockResolvedValueOnce({
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

    it('should handle native session transcript', async () => {
      vi.mocked(startNativeSpeechSession).mockResolvedValueOnce({
        stop: vi.fn().mockResolvedValue({ transcript: 'native transcript', recordedUri: '/path/to/audio.caf' }),
        abort: vi.fn(),
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
    });

    it('should not fallback to Google STT when native session exists (even if transcript is empty)', async () => {
      vi.mocked(startNativeSpeechSession).mockResolvedValueOnce({
        stop: vi.fn().mockResolvedValue({ transcript: '', recordedUri: '/path/to/audio.caf' }),
        abort: vi.fn(),
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

      expect(transcribeAudio).not.toHaveBeenCalled();
      expect(response?.transcript).toBe('');
    });

    it('should fallback to Google STT when native session is unavailable', async () => {
      vi.mocked(startNativeSpeechSession).mockResolvedValueOnce(null);
      vi.mocked(useAudioRecorder).mockReturnValue({
        isRecording: false,
        uri: '/path/to/recorded.caf',
        prepareToRecordAsync: vi.fn().mockResolvedValue(undefined),
        record: vi.fn(),
        stop: vi.fn().mockResolvedValue(undefined),
      } as never);

      vi.mocked(transcribeAudio).mockResolvedValueOnce('google transcript');

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      await act(async () => {
        await result.current.startRecording('');
      });

      let response: { transcript: string; error?: string } | undefined;
      await act(async () => {
        response = await result.current.stopRecording();
      });

      expect(transcribeAudio).toHaveBeenCalledWith({
        uri: '/path/to/recorded.caf',
        languageCode: 'en-US',
      });
      expect(response?.transcript).toBe('google transcript');
    });

    it('should not call Google STT when native error is "no speech"', async () => {
      vi.mocked(startNativeSpeechSession).mockResolvedValueOnce({
        stop: vi.fn().mockResolvedValue({ transcript: '', error: 'no speech detected', recordedUri: '/path/audio.caf' }),
        abort: vi.fn(),
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

      expect(transcribeAudio).not.toHaveBeenCalled();
      expect(response?.transcript).toBe('');
    });

    it('should handle transcription error', async () => {
      vi.mocked(useAudioRecorder).mockReturnValue({
        isRecording: false,
        uri: '/path/to/recorded.caf',
        prepareToRecordAsync: vi.fn().mockResolvedValue(undefined),
        record: vi.fn(),
        stop: vi.fn().mockResolvedValue(undefined),
      } as never);

      vi.mocked(transcribeAudio).mockRejectedValueOnce(new Error('Transcription failed'));

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      await act(async () => {
        await result.current.startRecording('');
      });

      let response: { transcript: string; error?: string } | undefined;
      await act(async () => {
        response = await result.current.stopRecording();
      });

      expect(response?.transcript).toBe('');
      expect(response?.error).toBe('Transcription failed');
    });
  });

  describe('forceStopRecording', () => {
    it('should stop recording on blur', async () => {
      const mockAbort = vi.fn();

      vi.mocked(startNativeSpeechSession).mockResolvedValueOnce({
        stop: vi.fn().mockResolvedValue({ transcript: '' }),
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
      let response1: { success?: boolean; error?: string } | undefined;
      let response2: { success?: boolean; error?: string } | undefined;

      await act(async () => {
        const promise1 = result.current.toggleRecording('');
        const promise2 = result.current.toggleRecording('');
        [response1, response2] = await Promise.all([promise1, promise2]);
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

      vi.mocked(AppState.addEventListener).mockImplementation((_, callback) => {
        appStateCallback = callback as (state: string) => void;
        return { remove: vi.fn() };
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

      vi.mocked(AppState.addEventListener).mockImplementation((_, callback) => {
        appStateCallback = callback as (state: string) => void;
        return { remove: vi.fn() };
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
    it('should show alert when permissions denied', async () => {
      vi.mocked(AudioModule.requestRecordingPermissionsAsync).mockResolvedValueOnce({
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
      vi.mocked(AudioModule.requestRecordingPermissionsAsync).mockResolvedValueOnce({
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
      vi.mocked(useAudioRecorder).mockReturnValue({
        isRecording: false,
        uri: null,
        prepareToRecordAsync: vi.fn().mockRejectedValue(new Error('Recorder init failed')),
        record: vi.fn(),
        stop: vi.fn().mockResolvedValue(undefined),
      } as never);

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      let response: { success: boolean; error?: string } | undefined;
      await act(async () => {
        response = await result.current.startRecording('');
      });

      expect(response?.success).toBe(false);
      expect(response?.error).toBe('Recorder init failed');
    });

    it('should handle recorder already released error gracefully', async () => {
      vi.mocked(useAudioRecorder).mockReturnValue({
        isRecording: false,
        uri: '/path/audio.caf',
        prepareToRecordAsync: vi.fn().mockResolvedValue(undefined),
        record: vi.fn(),
        stop: vi.fn().mockRejectedValue(new Error('Recorder was already released')),
      } as never);

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
      vi.mocked(setAudioModeAsync).mockRejectedValueOnce(new Error('Audio mode failed'));

      const { result } = renderHook(() => useRecordingSession(defaultOptions));

      let response: { success: boolean; error?: string } | undefined;
      await act(async () => {
        response = await result.current.startRecording('');
      });

      expect(response?.success).toBe(false);
      expect(response?.error).toBe('Audio mode failed');
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
      const onPartialMock = vi.fn();
      let capturedOnPartial: ((text: string) => void) | undefined;

      vi.mocked(startNativeSpeechSession).mockImplementation(async (_locale, options) => {
        capturedOnPartial = options?.onPartial;
        return {
          stop: vi.fn().mockResolvedValue({ transcript: 'final' }),
          abort: vi.fn(),
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
