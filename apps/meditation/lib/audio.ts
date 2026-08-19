/**
 * Pure playback arithmetic. Kept out of the provider so the rules that decide
 * what the player does can be tested without a native module.
 */

export const SEEK_STEP_SEC = 15;

export const PLAYBACK_RATES = [0.75, 1, 1.25] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

/** Fade-out choices, in minutes. `null` means "run to the end of the session". */
export const FADE_TIMERS = [5, 10, 15, 30] as const;
export type FadeTimerMinutes = (typeof FADE_TIMERS)[number];

/** A session counts as practised past this much of it — not only at the very end. */
export const COMPLETION_RATIO = 0.9;

/** `7:05`, never `7:5`. Hours are not shown: no session is that long. */
export function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/** Keeps a seek inside the track. A negative target is 0, never a rewind past it. */
export function clampSeek(target: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(Math.max(target, 0), duration);
}

export const seekBy = (current: number, delta: number, duration: number): number =>
  clampSeek(current + delta, duration);

/**
 * Volume of the fade-out tail.
 *
 * The last minute of a fade timer ramps to silence instead of cutting: someone
 * on the edge of sleep must not be pulled back by an abrupt stop.
 */
export const FADE_TAIL_SEC = 60;

export function fadeVolume(secondsRemaining: number, baseVolume = 1): number {
  if (secondsRemaining >= FADE_TAIL_SEC) return baseVolume;
  if (secondsRemaining <= 0) return 0;
  return baseVolume * (secondsRemaining / FADE_TAIL_SEC);
}

/** True once the listener has heard enough of a session to have practised it. */
export const isPractised = (positionSec: number, durationSec: number): boolean =>
  durationSec > 0 && positionSec / durationSec >= COMPLETION_RATIO;

/**
 * The duration the UI should trust. The loaded file is the truth; the
 * catalogue's advertised length is the fallback while it is still loading.
 */
export const effectiveDuration = (loadedSec: number, advertisedSec: number): number =>
  Number.isFinite(loadedSec) && loadedSec > 0 ? loadedSec : advertisedSec;
