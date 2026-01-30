// @vitest-environment happy-dom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

let themeCallCount = 0;

vi.mock('react-native', async () => {
  const React = await import('react');
  return {
    Platform: {
      OS: 'web',
      select: (obj: Record<string, any>) => obj.web ?? obj.default,
    },
    NativeModules: {},
    InteractionManager: {
      runAfterInteractions: (cb: () => void) => {
        cb();
        return { cancel: () => {} };
      },
    },
    View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    ScrollView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Image: (props: { alt?: string }) => <img alt={props.alt ?? ''} />,
    Pressable: ({ children, onPress }: { children?: React.ReactNode; onPress?: () => void }) => (
      <button onClick={onPress}>{children}</button>
    ),
    StyleSheet: { create: (styles: any) => styles, absoluteFillObject: {} },
  };
});

vi.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: () => null,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('react-native-reanimated', async () => {
  const React = await import('react');
  const Animated = {
    View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    ScrollView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    createAnimatedComponent: (Component: any) => Component,
  };

  return {
    __esModule: true,
    default: Animated,
    ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
    Easing: { out: (fn: any) => fn, quad: () => 0 },
    runOnJS: (fn: any) => fn,
    useAnimatedReaction: () => {},
    useAnimatedStyle: (factory: () => any) => factory(),
    useSharedValue: (value: any) => ({ value }),
    withDelay: (_delay: number, value: any) => value,
    withRepeat: (value: any) => value,
    withSequence: (...values: any[]) => values[values.length - 1],
    withTiming: (value: any) => value,
  };
});

vi.mock('@legendapp/list/reanimated', async () => {
  const React = await import('react');

  return {
    AnimatedLegendList: ({
      data,
      renderItem,
      keyExtractor,
      ListHeaderComponent,
      ListFooterComponent,
    }: any) => (
      <div>
        {ListHeaderComponent}
        {data.map((item: any, index: number) => (
          <React.Fragment key={keyExtractor?.(item) ?? index}>
            {renderItem({ item, index })}
          </React.Fragment>
        ))}
        {ListFooterComponent}
      </div>
    ),
  };
});

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => {
    themeCallCount += 1;
    return {
      mode: 'dark',
      colors: {
        accent: '#00f',
        backgroundCard: '#111',
        backgroundDark: '#000',
        backgroundSecondary: '#222',
        divider: '#333',
        textPrimary: '#fff',
        textSecondary: '#aaa',
      },
      shadows: {},
    };
  },
}));

vi.mock('../../../context/ChatContext', () => ({
  MessageContextProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  useComposerHeightContext: () => ({ composerHeight: { value: { value: 0 } } }),
  useMessageListContext: () => ({ isNearBottom: { value: { value: true } } }),
  useNewMessageAnimationContext: () => ({
    isStreaming: { value: { value: false } },
    hasAnimatedMessages: { current: new Set<string>() },
  }),
}));

vi.mock('../../../hooks/useChatList', () => ({
  useAutoScrollOnNewMessage: () => {},
  useInitialScrollToEnd: () => {},
  useKeyboardAwareMessageList: () => {},
  useMessageListProps: () => ({
    animatedProps: {},
    ref: { current: null },
    onContentSizeChange: () => {},
    onScroll: () => {},
  }),
  useScrollWhenComposerSizeUpdates: () => {},
  useUpdateLastMessageIndex: () => {},
}));

vi.mock('../FadeInStaggered', () => ({
  FadeInStaggered: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  TextFadeInStaggeredIfStreaming: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../ScrollToBottomButton', () => ({
  ScrollToBottomButton: () => null,
}));

vi.mock('../MarkdownText', () => ({
  MarkdownText: ({ children }: { children: string }) => <>{children}</>,
}));

const messages = Array.from({ length: 100 }, (_, index) => ({
  id: `m-${index}`,
  role: index % 2 === 0 ? 'user' : 'model',
  text: index % 2 === 0 ? `User message ${index}` : `Assistant message ${index} **bold**`,
}));

describe('perf(MessagesList): rerender churn', () => {
  it('logs how many themed components render on a no-op rerender', async () => {
    const { MessagesList } = await import('../MessagesList');

    const utils = render(<MessagesList messages={messages as any} style={{ opacity: 1 }} />);
    themeCallCount = 0;

    utils.rerender(<MessagesList messages={messages as any} style={{ opacity: 1 }} />);

    // This is intentionally informational (baseline vs after is captured in CLI output).
    console.log(`[perf] MessagesList useTheme() calls on no-op rerender: ${themeCallCount}`);
    expect(themeCallCount).toBeGreaterThan(0);
  });
});
