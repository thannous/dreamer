import { describe, expect, it } from 'vitest';

import { mergeFinalChunk } from '../nativeSpeechRecognition';

describe('mergeFinalChunk', () => {
  it('replaces the last chunk when the new chunk extends it', () => {
    const result = mergeFinalChunk(['je dors'], 'je dors dans mon lit');

    expect(result).toEqual(['je dors dans mon lit']);
  });

  it('ignores a shorter duplicate chunk', () => {
    const result = mergeFinalChunk(['hello world'], 'hello');

    expect(result).toEqual(['hello world']);
  });

  it('keeps existing when chunk is identical', () => {
    const result = mergeFinalChunk(['bonjour'], 'Bonjour   ');

    expect(result).toEqual(['bonjour']);
  });

  it('appends unrelated chunks', () => {
    const result = mergeFinalChunk(['first chunk'], 'second part');

    expect(result).toEqual(['first chunk', 'second part']);
  });

  it('returns original list for empty input', () => {
    const result = mergeFinalChunk(['kept'], '   ');

    expect(result).toEqual(['kept']);
  });
});
