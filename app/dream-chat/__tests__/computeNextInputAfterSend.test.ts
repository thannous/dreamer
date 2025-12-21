import { describe, expect, it } from 'vitest';

import { computeNextInputAfterSend } from '@/lib/chat/composerUtils';

describe('computeNextInputAfterSend', () => {
  it('clears when the current text matches the sent text', () => {
    expect(computeNextInputAfterSend('Hello world', 'Hello world')).toBe('');
  });

  it('clears when differences are only whitespace', () => {
    expect(computeNextInputAfterSend('  Hello world  ', 'Hello world')).toBe('');
  });

  it('preserves drafts that differ from the sent text', () => {
    expect(computeNextInputAfterSend('New draft while waiting', 'Old message')).toBe(
      'New draft while waiting'
    );
  });
});
