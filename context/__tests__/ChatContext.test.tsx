/* @vitest-environment happy-dom */
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native-reanimated', () => ({
  useSharedValue: (value: any) => ({ value }),
}));

const {
  ChatProvider,
  MessageContextProvider,
  useMessageListContext,
  useNewMessageAnimationContext,
  useMessageContext,
} = await import('../ChatContext');

describe('ChatContext', () => {
  it('given ChatProvider__when scrolling to end__then delegates to listRef', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ChatProvider>{children}</ChatProvider>
    );

    const { result } = renderHook(() => useMessageListContext(), { wrapper });
    const scrollSpy = vi.fn();

    act(() => {
      result.current.listRef.current = { scrollToEnd: scrollSpy } as any;
    });

    act(() => {
      result.current.scrollToEnd();
      result.current.scrollToEnd({ animated: false });
    });

    expect(scrollSpy).toHaveBeenCalledWith({ animated: true });
    expect(scrollSpy).toHaveBeenCalledWith({ animated: false });
  });

  it('given ChatProvider streaming__when toggling__then updates streaming shared value', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ChatProvider isStreaming>{children}</ChatProvider>
    );

    const { result } = renderHook(() => useNewMessageAnimationContext(), { wrapper });

    expect(result.current.isStreaming.get()).toBe(true);

    act(() => {
      result.current.setIsStreaming(false);
    });

    expect(result.current.isStreaming.get()).toBe(false);
  });

  it('given MessageContextProvider__when consuming__then exposes message metadata', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MessageContextProvider messageId="msg-1" index={2} isStreaming={false} isNew>
        {children}
      </MessageContextProvider>
    );

    const { result } = renderHook(() => useMessageContext(), { wrapper });

    expect(result.current.messageId).toBe('msg-1');
    expect(result.current.index).toBe(2);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.isNew).toBe(true);
  });

  it('given missing provider__when using message list hook__then throws', () => {
    expect(() => renderHook(() => useMessageListContext())).toThrow(
      'useMessageListContext must be used within MessageListProvider'
    );
  });
});
