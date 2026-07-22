/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from '@jest/globals';

import { useChatSendLock } from '../useChatSendLock';

describe('useChatSendLock', () => {
  it('rejects a second category while the first send is starting', () => {
    const { result } = renderHook(() => useChatSendLock());

    act(() => {
      expect(result.current.tryAcquire('emotions')).toBe(true);
      expect(result.current.tryAcquire('growth')).toBe(false);
    });

    expect(result.current.isLocked).toBe(true);
    expect(result.current.activeCategory).toBe('emotions');
  });

  it('allows another send after the lock is released', () => {
    const { result } = renderHook(() => useChatSendLock());

    act(() => {
      expect(result.current.tryAcquire()).toBe(true);
    });
    expect(result.current.activeCategory).toBe('general');

    act(() => {
      result.current.release();
      expect(result.current.tryAcquire('growth')).toBe(true);
    });

    expect(result.current.activeCategory).toBe('growth');
  });
});
