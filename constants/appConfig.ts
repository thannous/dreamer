/**
 * Centralized configuration constants for the Dreamer app.
 * Replaces magic numbers throughout the codebase.
 */

export const SPLASH_ANIMATION = {
  /** Delay before starting outro animation */
  OUTRO_DELAY_MS: 2800,
  /** Duration of fade animation */
  FADE_DURATION_MS: 300,
} as const;

export const RECORDING = {
  /** Maximum characters allowed in transcript */
  MAX_TRANSCRIPT_CHARS: 600,
  /** Timeout for speech recognition end event */
  END_TIMEOUT_MS: 4000,
  /** Recorder release error snippet for detection */
  RELEASE_ERROR_SNIPPET: 'shared object that was already released',
} as const;

export const JOURNAL_LIST = {
  /** Number of items to load immediately without lazy loading */
  INITIAL_VISIBLE_COUNT: 5,
  /** Number of items to preload ahead/behind viewport */
  PRELOAD_BUFFER: 2,
  /** Initial items to render on desktop layout */
  DESKTOP_INITIAL_COUNT: 12,
  /** Minimum percentage visible to consider item in viewport */
  VIEWABILITY_THRESHOLD: 10,
  /** Minimum view time in ms before considering item visible */
  MINIMUM_VIEW_TIME: 100,
} as const;

export const TIMEOUTS = {
  /** Default HTTP request timeout */
  HTTP_DEFAULT_MS: 30000,
  /** Extended timeout for image generation */
  IMAGE_GENERATION_MS: 60000,
  /** Delay between retry attempts */
  RETRY_DELAY_MS: 2000,
  /** Animation timing defaults */
  ANIMATION_DEFAULT_MS: 300,
  ANIMATION_SLOW_MS: 500,
} as const;

export const DESKTOP_LAYOUT = {
  /** Breakpoint for desktop layout */
  BREAKPOINT: 1024,
  /** Breakpoint for 4-column layout */
  WIDE_BREAKPOINT: 1440,
  /** Maximum content width */
  MAX_WIDTH: 1200,
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
