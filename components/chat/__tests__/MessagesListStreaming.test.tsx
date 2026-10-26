/** @jest-environment jsdom */
// Isolation exception: a device journey cannot tell which components a streamed fragment
// renders, nor hold the one commit in which the completed reply replaces its bubble.
import React, { useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createStreamingReplyChannel } from '@/lib/chat/streamingReplyChannel';
import type { ChatMessage } from '@/lib/types';

const mockAnimatedMessages = { current: new Set<string>() };
const mockListData: string[][] = [];

jest.mock('react-native', () => ({
  Platform: { OS: 'android', select: (options: any) => options.android ?? options.default },
  Pressable: ({ children }: any) => <button>{children}</button>,
  StyleSheet: { create: (styles: any) => styles },
  View: ({ children }: any) => <div>{children}</div>,
}));
jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('@/constants/journalTheme').DarkTheme, mode: 'dark' }),
}));
jest.mock('@/context/ChatContext', () => ({
  MessageContextProvider: ({ children, messageId, isNew }: any) => (
    <div data-testid={`row-${messageId}`} data-new={String(isNew)}>{children}</div>
  ),
  useComposerHeightContext: () => ({ composerHeight: { get: () => 0 } }),
  useMessageListContext: () => ({ isNearBottom: { get: () => true } }),
  useNewMessageAnimationContext: () => ({ isStreaming: { get: () => true }, hasAnimatedMessages: mockAnimatedMessages }),
}));
jest.mock('@/hooks/useChatList', () => ({
  useKeyboardAwareMessageList: () => {},
  useKeyboardSpacer: () => ({ height: 0, onLayout: () => {} }),
  useFollowComposerResize: () => () => {},
  useRevealLatestMessageOnOpen: () => {},
  useUpdateLastMessageIndex: () => {},
  useMessageListProps: () => ({ ref: { current: null }, onContentSizeChange: () => {}, onLayout: () => {}, onScroll: () => {} }),
}));
jest.mock('@legendapp/list/reanimated', () => ({
  AnimatedLegendList: ({ data, renderItem, keyExtractor }: any) => {
    mockListData.push(data.map((item: ChatMessage) => item.id));
    return <div>{data.map((item: ChatMessage, index: number) => (
      <div key={keyExtractor(item)}>{renderItem({ item, index })}</div>
    ))}</div>;
  },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/lib/moti', () => ({ MotiView: () => null }));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('../FadeInStaggered', () => ({ FadeInStaggered: ({ children }: any) => <>{children}</> }));
jest.mock('../ScrollToBottomButton', () => ({ ScrollToBottomButton: () => null }));
jest.mock('../MarkdownText', () => ({ MarkdownText: ({ children }: any) => <span>{children}</span> }));

const { MessagesList } = require('../MessagesList');

const greeting: ChatMessage = { id: 'greeting', role: 'model', text: 'Synthetic greeting', createdAt: 1 };
const question: ChatMessage = { id: 'request-1', role: 'user', text: 'Synthetic question', createdAt: 2 };
const reply: ChatMessage = { id: 'reply-1', role: 'model', text: 'First fragment, then the rest.', createdAt: 3 };

function setup() {
  const channel = createStreamingReplyChannel();
  let screenRenders = 0;
  let setHistory!: (next: ChatMessage[]) => void;
  function ChatScreen() {
    screenRenders += 1;
    const [history, update] = useState<ChatMessage[]>([greeting, question]);
    setHistory = update;
    return <MessagesList messages={history} streamingReply={channel} />;
  }
  render(<ChatScreen />);
  return { channel, setHistory: (next: ChatMessage[]) => setHistory(next), screenRenders: () => screenRenders };
}

describe('MessagesList streamed reply', () => {
  beforeEach(() => {
    mockAnimatedMessages.current = new Set();
    mockListData.length = 0;
  });

  it('shows fragments without rendering the screen, then settles the reply in place', () => {
    const { channel, setHistory, screenRenders } = setup();
    const rendersBeforeStream = screenRenders();

    act(() => channel.publish({ requestId: question.id, text: 'First fragment' }));
    expect(screen.getByTestId('row-streaming-reply').textContent).toBe('First fragment');
    act(() => channel.publish({ requestId: question.id, text: reply.text }));
    expect(screen.getByTestId('row-streaming-reply').textContent).toBe(reply.text);
    expect(screenRenders()).toBe(rendersBeforeStream);

    const streamedFrom = mockListData.length;
    // The send flow stores the completed reply and ends the stream in one task.
    act(() => {
      setHistory([greeting, question, reply]);
      channel.end(reply.id);
    });

    expect(screen.queryByTestId('row-streaming-reply')).toBeNull();
    const settled = screen.getByTestId('row-reply-1');
    expect(settled.textContent).toBe(reply.text);
    // Already on screen while it streamed: it does not fade in a second time.
    expect(settled.getAttribute('data-new')).toBe('false');
    // No commit showed the question without its reply in between.
    expect(mockListData.slice(streamedFrom)).toEqual([['greeting', 'request-1', 'reply-1']]);
  });

  // A browser journey cannot replace the channel between two fragment callbacks.
  it('switches channels without displaying or accepting the previous stream', () => {
    const first = createStreamingReplyChannel();
    const next = createStreamingReplyChannel();
    first.publish({ requestId: 'old-request', text: 'Previous conversation fragment' });
    next.publish({ requestId: 'new-request', text: 'Current conversation fragment' });
    const view = render(<MessagesList messages={[question]} streamingReply={first} />);
    expect(screen.getByTestId('row-streaming-reply').textContent).toBe('Previous conversation fragment');

    view.rerender(<MessagesList messages={[question]} streamingReply={next} />);
    expect(screen.getByTestId('row-streaming-reply').textContent).toBe('Current conversation fragment');
    expect(view.container.textContent).not.toContain('Previous conversation fragment');
    act(() => first.publish({ requestId: 'old-request', text: 'Delayed previous fragment' }));
    expect(view.container.textContent).not.toContain('Delayed previous fragment');

    const empty = createStreamingReplyChannel();
    view.rerender(<MessagesList messages={[question]} streamingReply={empty} />);
    expect(screen.queryByTestId('row-streaming-reply')).toBeNull();
  });

  it('still introduces a reply that arrives without streamed text', () => {
    const { channel, setHistory } = setup();

    act(() => {
      setHistory([greeting, question, reply]);
      channel.end(reply.id);
    });

    expect(screen.getByTestId('row-reply-1').getAttribute('data-new')).toBe('true');
  });
});
