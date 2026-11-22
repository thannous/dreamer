/** @jest-environment jsdom */
// Isolation exception: a device journey shows that « Try again » did nothing, not which
// render's handler the drawn row kept. The list stand-in renders a row again only when its
// item or `extraData` changes, like LegendList's containers.
import React, { useMemo } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';
import type { ChatMessage } from '@/lib/types';

jest.mock('react-native', () => ({
  Platform: { OS: 'android', select: (options: any) => options.android ?? options.default },
  Pressable: ({ children, onPress, accessibilityLabel }: any) => (
    <button aria-label={accessibilityLabel} onClick={onPress}>{children}</button>
  ),
  StyleSheet: { create: (styles: any) => styles },
  Text: ({ children }: any) => <span>{children}</span>,
  View: ({ children }: any) => <div>{children}</div>,
}));
jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('@/constants/journalTheme').DarkTheme, mode: 'dark' }),
}));
jest.mock('@/context/ChatContext', () => ({
  MessageContextProvider: ({ children }: any) => <>{children}</>,
  useComposerHeightContext: () => ({ composerHeight: { get: () => 0 } }),
  useKeyboardStateContext: () => ({ isKeyboardVisible: { get: () => false } }),
  useMessageListContext: () => ({ isNearBottom: { get: () => true } }),
  useNewMessageAnimationContext: () => ({ isStreaming: { get: () => false }, hasAnimatedMessages: { current: new Set() } }),
}));
jest.mock('@/hooks/useChatList', () => ({
  useKeyboardAwareMessageList: () => {},
  useKeyboardSpacer: () => ({ height: 0, onLayout: () => {} }),
  useFollowComposerResize: () => () => {},
  useRevealLatestMessageOnOpen: () => {},
  useUpdateLastMessageIndex: () => {},
  useMessageListProps: () => ({ ref: { current: null }, onContentSizeChange: () => {}, onLayout: () => {}, onScroll: () => {} }),
}));
jest.mock('@legendapp/list/reanimated', () => {
  const { memo } = require('react');
  const Row = memo(
    function Row({ item, index, renderItem }: any) { return renderItem({ item, index }); },
    (previous: any, next: any) => previous.item === next.item && previous.extraData === next.extraData,
  );
  return {
    AnimatedLegendList: ({ data, renderItem, keyExtractor, extraData }: any) => (
      <div>{data.map((item: ChatMessage, index: number) => (
        <Row key={keyExtractor(item)} item={item} index={index} renderItem={renderItem} extraData={extraData} />
      ))}</div>
    ),
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/lib/moti', () => ({ MotiView: () => null }));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('../FadeInStaggered', () => ({ FadeInStaggered: ({ children }: any) => <>{children}</> }));
jest.mock('../ScrollToBottomButton', () => ({ ScrollToBottomButton: () => null }));
jest.mock('@/components/ui/MarkdownText', () => ({ MarkdownText: ({ children }: any) => <span>{children}</span> }));

const { MessagesList } = require('../MessagesList');

const question: ChatMessage = { id: 'request-1', role: 'user', text: 'Synthetic question', createdAt: 1 };
const failure: ChatMessage = {
  id: 'error-1', role: 'model', text: 'Synthetic failure', createdAt: 2,
  meta: { isError: true, retry: { messageText: 'Synthetic question', clientRequestId: 'request-1' } },
};

function Screen({ locked, onRetry }: { locked: boolean; onRetry: (message: ChatMessage, locked: boolean) => void }) {
  // The screen's handler closes over the send lock of its render, as the chat screen's does.
  const handleRetry = useMemo(() => (message: ChatMessage) => onRetry(message, locked), [locked, onRetry]);
  const messages = useMemo(() => [question, failure], []);
  return <MessagesList messages={messages} onRetryMessage={handleRetry} retryA11yLabel="Retry" />;
}

describe('MessagesList retry row', () => {
  it('runs the handler of the latest render, not the one the row was first drawn with', () => {
    const onRetry = jest.fn();
    // The error appears while the send lock is still held, then the lock is released.
    const view = render(<Screen locked onRetry={onRetry} />);
    view.rerender(<Screen locked={false} onRetry={onRetry} />);

    fireEvent.click(screen.getByLabelText('Retry'));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(failure, false);
  });

  it('shows the retry label next to its icon', () => {
    render(<Screen locked={false} onRetry={jest.fn()} />);
    expect(screen.getByLabelText('Retry').textContent).toBe('Retry');
  });
});
