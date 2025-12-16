import { describe, expect, it } from 'vitest';

import { combineTranscript } from '../transcriptMerge';

describe('transcriptMerge', () => {
  it('keeps base when the addition is already included (dedupe)', () => {
    const result = combineTranscript({
      base: 'Hello world',
      addition: 'Hello',
      maxChars: 10_000,
    });

    expect(result).toEqual({ text: 'Hello world', truncated: false });
  });

  it('replaces base when recognizer returns the full transcript plus new words', () => {
    const result = combineTranscript({
      base: 'Hello world',
      addition: 'Hello world again',
      maxChars: 10_000,
    });

    expect(result.text).toBe('Hello world again');
    expect(result.truncated).toBe(false);
  });

  it('treats punctuation-only differences as duplicates', () => {
    const result = combineTranscript({
      base: 'I was there',
      addition: 'I was there.',
      maxChars: 10_000,
    });

    expect(result.text).toBe('I was there');
  });

  it('replaces only the last line when it is being incrementally extended', () => {
    const result = combineTranscript({
      base: 'first line\nhello worl',
      addition: 'hello world',
      maxChars: 10_000,
    });

    expect(result.text).toBe('first line\nhello world');
  });

  it('appends as a new line when there is no overlap', () => {
    const result = combineTranscript({
      base: 'a',
      addition: 'b',
      maxChars: 10_000,
    });

    expect(result.text).toBe('a\nb');
  });

  it('clamps the transcript and reports truncation', () => {
    const result = combineTranscript({
      base: '12345',
      addition: '67890',
      maxChars: 8,
    });

    expect(result.text.length).toBe(8);
    expect(result.truncated).toBe(true);
  });
});

