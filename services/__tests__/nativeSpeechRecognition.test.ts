import { describe, expect, it } from 'vitest';

import { buildPreview, mergeFinalChunk } from '../nativeSpeechRecognition';

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

describe('buildPreview', () => {
  it('avoids duplication when partial extends last final chunk', () => {
    // Scenario: user says "J'ai fait un rêve", it becomes final,
    // then continues with "étrange" but STT sends full sentence as partial
    const finalChunks = ["J'ai fait un rêve"];
    const lastPartial = "J'ai fait un rêve étrange";

    const result = buildPreview(finalChunks, lastPartial);

    // Should NOT be "J'ai fait un rêve J'ai fait un rêve étrange"
    expect(result).toBe("J'ai fait un rêve étrange");
  });

  it('concatenates when partial is unrelated to final chunks', () => {
    const finalChunks = ['première phrase'];
    const lastPartial = 'deuxième phrase';

    const result = buildPreview(finalChunks, lastPartial);

    expect(result).toBe('première phrase deuxième phrase');
  });

  it('preserves earlier chunks when partial extends only the last one', () => {
    const finalChunks = ['début du rêve', 'ensuite il y avait'];
    const lastPartial = 'ensuite il y avait un chat';

    const result = buildPreview(finalChunks, lastPartial);

    expect(result).toBe('début du rêve ensuite il y avait un chat');
  });

  it('returns only partial when no final chunks and partial exists', () => {
    const result = buildPreview([], 'just a partial');

    expect(result).toBe('just a partial');
  });

  it('returns final chunks when partial is empty', () => {
    const result = buildPreview(['chunk one', 'chunk two'], '');

    expect(result).toBe('chunk one chunk two');
  });

  it('handles case and spacing differences', () => {
    const finalChunks = ['Hello world'];
    const lastPartial = 'hello world how are you';

    const result = buildPreview(finalChunks, lastPartial);

    expect(result).toBe('hello world how are you');
  });

  it('returns empty string when both inputs are empty', () => {
    const result = buildPreview([], '');

    expect(result).toBe('');
  });
});
