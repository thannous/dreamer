/** @jest-environment jsdom */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { useChatCategoryPrompt } from '../useChatCategoryPrompt';

// The UI cannot deterministically replace a hydrated dream or quota result inside
// the 500 ms scheduling window. Exercise that lifecycle with a controlled clock.
describe('category question scheduling', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { cleanup(); jest.useRealTimers(); });

  it('sends the latest hydrated payload exactly once when it changes before dispatch', () => {
    const staleSend = jest.fn();
    const latestSend = jest.fn();
    const initial = { scopeKey: 'account:dream', promptKey: 'dream:symbols', enabled: true, onSend: staleSend };
    const { rerender } = renderHook(useChatCategoryPrompt, { initialProps: initial });
    act(() => jest.advanceTimersByTime(250));
    rerender({ ...initial, onSend: latestSend });
    act(() => jest.advanceTimersByTime(500));
    expect(staleSend).not.toHaveBeenCalled();
    expect(latestSend).toHaveBeenCalledTimes(1);
    const duplicateSend = jest.fn();
    rerender({ ...initial, onSend: duplicateSend });
    act(() => jest.advanceTimersByTime(1000));
    expect(latestSend).toHaveBeenCalledTimes(1);
    expect(duplicateSend).not.toHaveBeenCalled();
  });

  it('waits through a quota refresh without losing a cancelled pending question', () => {
    const onSend = jest.fn();
    const initial = { scopeKey: 'account:dream', promptKey: 'dream:emotions', enabled: true, onSend };
    const { rerender } = renderHook(useChatCategoryPrompt, { initialProps: initial });
    act(() => jest.advanceTimersByTime(250));
    rerender({ ...initial, enabled: false });
    act(() => jest.advanceTimersByTime(1000));
    expect(onSend).not.toHaveBeenCalled();
    rerender(initial);
    act(() => jest.advanceTimersByTime(500));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('cancels a superseded category and unmounted session, allowing a new owner to send', () => {
    const symbols = jest.fn();
    const emotions = jest.fn();
    const initial = { scopeKey: 'first:dream', promptKey: 'dream:symbols', enabled: true, onSend: symbols };
    const { rerender, unmount } = renderHook(useChatCategoryPrompt, { initialProps: initial });
    act(() => jest.advanceTimersByTime(250));
    rerender({ ...initial, promptKey: 'dream:emotions', onSend: emotions });
    act(() => jest.advanceTimersByTime(500));
    expect(symbols).not.toHaveBeenCalled();
    expect(emotions).toHaveBeenCalledTimes(1);
    rerender({ ...initial, scopeKey: 'second:dream', promptKey: 'dream:emotions', onSend: emotions });
    act(() => jest.advanceTimersByTime(500));
    expect(emotions).toHaveBeenCalledTimes(2);
    rerender(initial);
    unmount();
    act(() => jest.advanceTimersByTime(500));
    expect(symbols).not.toHaveBeenCalled();
  });
});
