import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('@/services/nativeSpeechRecognition', () => ({
  startNativeSpeechSession: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/services/speechToText', () => ({
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
    const AudioModule = await import('expo-audio');
    vi.mocked(AudioModule.AudioModule.requestRecordingPermissionsAsync).mockResolvedValueOnce({ 
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
});
