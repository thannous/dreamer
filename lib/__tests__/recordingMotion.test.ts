import { describe, expect, it } from '@jest/globals';

import { shouldAnimateMicButtonSurface } from '@/lib/recordingMotion';

describe('shouldAnimateMicButtonSurface', () => {
  it('keeps the idle microphone surface static', () => {
    expect(shouldAnimateMicButtonSurface('idle')).toBe(false);
  });

  it('animates only active microphone transitions', () => {
    expect(shouldAnimateMicButtonSurface('preparing')).toBe(true);
    expect(shouldAnimateMicButtonSurface('recording')).toBe(true);
  });
});
