/**
 * Centralized configuration constants for the Dreamer app.
 * Replaces magic numbers throughout the codebase.
 */

export const RECORDING = {
  /** Soft visual reference for recording progress. Not a storage or input limit. */
  TRANSCRIPT_PROGRESS_REFERENCE_CHARS: 600,
  /** Timeout for speech recognition end event */
  END_TIMEOUT_MS: 4000,
  /** Recorder release error snippet for detection */
  RELEASE_ERROR_SNIPPET: 'shared object that was already released',
} as const;

export const JOURNAL_LIST = {
  /** Number of items to preload ahead/behind viewport */
  PRELOAD_BUFFER: 2,
  /** Minimum percentage visible to consider item in viewport */
  VIEWABILITY_THRESHOLD: 10,
  /** Minimum view time in ms before considering item visible */
  MINIMUM_VIEW_TIME: 100,
} as const;

export const AUDIO_CONFIG = {
  /** Sample rate for recording */
  SAMPLE_RATE: 16000,
  /** Bit rate for recording */
  BIT_RATE: 64000,
  /** Minimum allowed web bitrate to avoid browser clamping (e.g., Chrome floor is 75 kbps) */
  WEB_MIN_BIT_RATE: 75000,
  /** Number of audio channels */
  CHANNELS: 1,
} as const;
