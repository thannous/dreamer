import {
  AudioQuality,
  IOSOutputFormat,
  RecordingPresets,
  type RecordingOptions,
} from 'expo-audio';

import { AUDIO_CONFIG, RECORDING } from '@/constants/appConfig';

export const RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: false,
  extension: '.caf',
  sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
  numberOfChannels: AUDIO_CONFIG.CHANNELS,
  bitRate: AUDIO_CONFIG.BIT_RATE,
  android: {
    ...RecordingPresets.HIGH_QUALITY.android,
    extension: '.amr',
    outputFormat: 'amrwb',
    audioEncoder: 'amr_wb',
    sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
  },
  ios: {
    ...RecordingPresets.HIGH_QUALITY.ios,
    extension: '.caf',
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.MEDIUM,
    sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: Math.max(AUDIO_CONFIG.BIT_RATE, AUDIO_CONFIG.WEB_MIN_BIT_RATE),
  },
};

export function isRecorderReleasedError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    typeof error.message === 'string' &&
    error.message.toLowerCase().includes(RECORDING.RELEASE_ERROR_SNIPPET)
  );
}

export function handleRecorderReleaseError(context: string, error: unknown): boolean {
  if (isRecorderReleasedError(error)) {
    if (__DEV__) {
      console.warn(`[Recording] AudioRecorder already released during ${context}.`, error);
    }
    return true;
  }
  return false;
}
