import { describe, expect, it } from '@jest/globals';

import { combineTranscript } from '../transcriptMerge';

describe('transcriptMerge', () => {
  it('keeps base when the addition is already included (dedupe)', () => {
    const result = combineTranscript({
      base: 'Hello world',
      addition: 'Hello',
    });

    expect(result).toEqual({ text: 'Hello world', truncated: false });
  });

  it('replaces base when recognizer returns the full transcript plus new words', () => {
    const result = combineTranscript({
      base: 'Hello world',
      addition: 'Hello world again',
    });

    expect(result.text).toBe('Hello world again');
    expect(result.truncated).toBe(false);
  });

  it('treats punctuation-only differences as duplicates', () => {
    const result = combineTranscript({
      base: 'I was there',
      addition: 'I was there.',
    });

    expect(result.text).toBe('I was there');
  });

  it('replaces only the last line when it is being incrementally extended', () => {
    const result = combineTranscript({
      base: 'first line\nhello worl',
      addition: 'hello world',
    });

    expect(result.text).toBe('first line\nhello world');
  });

  it('appends as a new line when there is no overlap', () => {
    const result = combineTranscript({
      base: 'a',
      addition: 'b',
    });

    expect(result.text).toBe('a\nb');
  });

  it('preserves combined transcripts beyond 600 characters', () => {
    const base = 'n'.repeat(400);
    const addition = 'w'.repeat(201);
    const result = combineTranscript({ base, addition });

    expect(result.text).toBe(`${base}\n${addition}`);
    expect(result.text.length).toBe(602);
    expect(result.truncated).toBe(false);
  });

  it('preserves a much longer combined transcript without slicing', () => {
    const base = 'day '.repeat(300);
    const addition = 'night '.repeat(200);
    const result = combineTranscript({ base, addition });

    expect(result.text).toBe(`${base.trim()}\n${addition.trim()}`);
    expect(result.text.length).toBeGreaterThan(1200);
    expect(result.truncated).toBe(false);
  });
});

