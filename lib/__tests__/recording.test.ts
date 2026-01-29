import { afterEach, describe, expect, it, vi } from 'vitest';

import { RECORDING } from '../../constants/appConfig';
import { handleRecorderReleaseError, isRecorderReleasedError, RECORDING_OPTIONS } from '../recording';

vi.mock('expo-audio', () => ({
  RecordingPresets: {
    HIGH_QUALITY: {
      android: {},
      ios: {},
    },
  },
  AudioQuality: { MEDIUM: 'medium' },
  IOSOutputFormat: { LINEARPCM: 'linearpcm' },
}));

describe('recording utilities', () => {
  const originalDev = (globalThis as any).__DEV__;

  afterEach(() => {
    (globalThis as any).__DEV__ = originalDev;
    vi.restoreAllMocks();
  });

  it('detects recorder release errors', () => {
    const error = new Error(`Audio error: ${RECORDING.RELEASE_ERROR_SNIPPET}`);

    expect(isRecorderReleasedError(error)).toBe(true);
    expect(isRecorderReleasedError(new Error('Other error'))).toBe(false);
    expect(isRecorderReleasedError(null)).toBe(false);
  });

  it('handles recorder release errors and warns in dev', () => {
    (globalThis as any).__DEV__ = true;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = new Error(`Audio error: ${RECORDING.RELEASE_ERROR_SNIPPET}`);

    const handled = handleRecorderReleaseError('stop', error);

    expect(handled).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('returns false when error is unrelated to release', () => {
    (globalThis as any).__DEV__ = true;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const handled = handleRecorderReleaseError('pause', new Error('random'));

    expect(handled).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('builds recording options with platform overrides', () => {
    expect(RECORDING_OPTIONS.extension).toBe('.caf');
    expect(RECORDING_OPTIONS.android?.extension).toBe('.amr');
    expect(RECORDING_OPTIONS.ios?.linearPCMBitDepth).toBe(16);
    expect(RECORDING_OPTIONS.web?.mimeType).toBe('audio/webm');
  });
});
