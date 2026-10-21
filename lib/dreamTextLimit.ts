import { DREAM_TRANSCRIPT_MAX_CHARS } from '@/constants/limits';

// Text inputs count UTF-16 units, never fewer than the characters the sync
// function counts, so an input limit is never looser than the server. A save
// check counts characters (code points) exactly as PostgreSQL's char_length.

const countCharacters = (text: string): number => Array.from(text).length;

/**
 * A dream text input's limit: nothing new past the maximum, and a longer text
 * already there (a dream stored before the limit, a long dictation) is never cut.
 */
export function getDreamTextInputLimit(currentLength: number, storedLength = 0): number {
  return Math.max(DREAM_TRANSCRIPT_MAX_CHARS, storedLength, currentLength);
}

/** True when the sync function would refuse this text for a dream whose stored text is `storedText`. */
export function isDreamTextTooLong(text: string, storedText = ''): boolean {
  return countCharacters(text) > Math.max(DREAM_TRANSCRIPT_MAX_CHARS, countCharacters(storedText));
}

/** The counter shows from 90 % of the maximum, so an ordinary dream never sees it. */
export function shouldShowDreamLengthCounter(length: number): boolean {
  return length >= DREAM_TRANSCRIPT_MAX_CHARS * 0.9;
}
