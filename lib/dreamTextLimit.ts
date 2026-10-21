import { DREAM_TRANSCRIPT_MAX_CHARS } from '@/constants/limits';

// JavaScript counts UTF-16 units, never fewer than the characters the sync
// function counts, so the app is never looser than the server.

/**
 * A dream text input's limit: nothing new past the maximum, and a longer text
 * already there (a dream stored before the limit, a long dictation) is never cut.
 */
export function getDreamTextInputLimit(currentLength: number, storedLength = 0): number {
  return Math.max(DREAM_TRANSCRIPT_MAX_CHARS, storedLength, currentLength);
}

/** True when the sync function would refuse this text for a dream stored with `storedLength` characters. */
export function isDreamTextTooLong(text: string, storedLength = 0): boolean {
  return text.length > Math.max(DREAM_TRANSCRIPT_MAX_CHARS, storedLength);
}

/** The counter shows from 90 % of the maximum, so an ordinary dream never sees it. */
export function shouldShowDreamLengthCounter(length: number): boolean {
  return length >= DREAM_TRANSCRIPT_MAX_CHARS * 0.9;
}
