/**
 * Chat context and providers inspired by Vercel v0 chat architecture.
 * Exposes shared values for keyboard/composer height, message list scroll,
 * and lightweight animation helpers for new messages.
 */
import type { LegendListRef } from '@legendapp/list';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

type SharedValueAdapter<T> = {
  value: SharedValue<T>;
  get: () => T;
  set: (next: T) => void;
};

type ComposerHeightContextValue = {
  composerHeight: SharedValueAdapter<number>;
};

type KeyboardStateContextValue = {
  isKeyboardVisible: SharedValueAdapter<boolean>;
  keyboardHeight: SharedValueAdapter<number>;
};

type MessageListContextValue = {
  listRef: React.MutableRefObject<LegendListRef | null>;
  scrollToEnd: (options?: { animated?: boolean }) => void;
  containerHeight: SharedValueAdapter<number>;
  contentHeight: SharedValueAdapter<number>;
  scrollY: SharedValueAdapter<number>;
  lastMessageIndex: SharedValueAdapter<number>;
};

type NewMessageAnimationContextValue = {
  isStreaming: SharedValueAdapter<boolean>;
  hasAnimatedMessages: React.MutableRefObject<Set<string>>;
  setIsStreaming: (value: boolean) => void;
  resetAnimations: () => void;
};

type MessageContextValue = {
  messageId: string;
  index: number;
  isStreaming: boolean;
  isNew: boolean;
};

const ComposerHeightContext = createContext<ComposerHeightContextValue | null>(null);
const KeyboardStateContext = createContext<KeyboardStateContextValue | null>(null);
const MessageListContext = createContext<MessageListContextValue | null>(null);
const NewMessageAnimationContext = createContext<NewMessageAnimationContextValue | null>(null);
const MessageContext = createContext<MessageContextValue | null>(null);

const createAdapter = <T,>(shared: SharedValue<T>): SharedValueAdapter<T> => ({
  value: shared,
  get: () => {
    'worklet';
    return shared.value;
  },
  set: (next: T) => {
    'worklet';
    shared.value = next;
  },
});

function ComposerHeightProvider({ children }: { children: ReactNode }) {
  const composerHeightValue = useSharedValue(0);
  const composerHeight = useMemo(() => createAdapter(composerHeightValue), [composerHeightValue]);

  const value = useMemo(() => ({ composerHeight }), [composerHeight]);

  return (
    <ComposerHeightContext.Provider value={value}>
      {children}
    </ComposerHeightContext.Provider>
  );
}

function KeyboardStateProvider({ children }: { children: ReactNode }) {
  const isKeyboardVisibleValue = useSharedValue(false);
  const keyboardHeightValue = useSharedValue(0);

  const isKeyboardVisible = useMemo(() => createAdapter(isKeyboardVisibleValue), [isKeyboardVisibleValue]);
  const keyboardHeight = useMemo(() => createAdapter(keyboardHeightValue), [keyboardHeightValue]);

  const value = useMemo(
    () => ({
      isKeyboardVisible,
      keyboardHeight,
    }),
    [isKeyboardVisible, keyboardHeight]
  );

  return (
    <KeyboardStateContext.Provider value={value}>
      {children}
    </KeyboardStateContext.Provider>
  );
}

function MessageListProvider({ children }: { children: ReactNode }) {
  const listRef = useRef<LegendListRef | null>(null);

  const containerHeightValue = useSharedValue(0);
  const contentHeightValue = useSharedValue(0);
  const scrollYValue = useSharedValue(0);
  const lastMessageIndexValue = useSharedValue(-1);

  const containerHeight = useMemo(() => createAdapter(containerHeightValue), [containerHeightValue]);
  const contentHeight = useMemo(() => createAdapter(contentHeightValue), [contentHeightValue]);
  const scrollY = useMemo(() => createAdapter(scrollYValue), [scrollYValue]);
  const lastMessageIndex = useMemo(() => createAdapter(lastMessageIndexValue), [lastMessageIndexValue]);

  const scrollToEnd = useCallback(
    (options?: { animated?: boolean }) => {
      const animated = options?.animated ?? true;
      listRef.current?.scrollToEnd({ animated });
    },
    []
  );

  const value = useMemo(
    () => ({
      listRef,
      scrollToEnd,
      containerHeight,
      contentHeight,
      scrollY,
      lastMessageIndex,
    }),
    [containerHeight, contentHeight, lastMessageIndex, scrollToEnd, scrollY]
  );

  return (
    <MessageListContext.Provider value={value}>
      {children}
    </MessageListContext.Provider>
  );
}

function NewMessageAnimationProvider({
  children,
  isStreaming: streamingProp = false,
}: {
  children: ReactNode;
  isStreaming?: boolean;
}) {
  const isStreamingValue = useSharedValue(streamingProp);
  const hasAnimatedMessages = useRef<Set<string>>(new Set());

  const isStreaming = useMemo(() => createAdapter(isStreamingValue), [isStreamingValue]);

  useEffect(() => {
    isStreaming.set(streamingProp);
  }, [isStreaming, streamingProp]);

  const setIsStreaming = useCallback(
    (value: boolean) => {
      isStreaming.set(value);
    },
    [isStreaming]
  );

  const resetAnimations = useCallback(() => {
    hasAnimatedMessages.current.clear();
  }, []);

  const value = useMemo(
    () => ({
      isStreaming,
      hasAnimatedMessages,
      setIsStreaming,
      resetAnimations,
    }),
    [hasAnimatedMessages, isStreaming, resetAnimations, setIsStreaming]
  );

  return (
    <NewMessageAnimationContext.Provider value={value}>
      {children}
    </NewMessageAnimationContext.Provider>
  );
}

export function MessageContextProvider({
  children,
  messageId,
  index,
  isStreaming,
  isNew,
}: MessageContextValue & { children: ReactNode }) {
  const value = useMemo(
    () => ({
      messageId,
      index,
      isStreaming,
      isNew,
    }),
    [index, isNew, isStreaming, messageId]
  );

  return <MessageContext.Provider value={value}>{children}</MessageContext.Provider>;
}

export function ChatProvider({
  children,
  isStreaming = false,
}: {
  children: ReactNode;
  isStreaming?: boolean;
}) {
  return (
    <ComposerHeightProvider>
      <MessageListProvider>
        <NewMessageAnimationProvider isStreaming={isStreaming}>
          <KeyboardStateProvider>{children}</KeyboardStateProvider>
        </NewMessageAnimationProvider>
      </MessageListProvider>
    </ComposerHeightProvider>
  );
}

export function useComposerHeightContext() {
  const context = useContext(ComposerHeightContext);
  if (!context) {
    throw new Error('useComposerHeightContext must be used within ComposerHeightProvider');
  }
  return context;
}

export function useKeyboardStateContext() {
  const context = useContext(KeyboardStateContext);
  if (!context) {
    throw new Error('useKeyboardStateContext must be used within KeyboardStateProvider');
  }
  return context;
}

export function useMessageListContext() {
  const context = useContext(MessageListContext);
  if (!context) {
    throw new Error('useMessageListContext must be used within MessageListProvider');
  }
  return context;
}

export function useNewMessageAnimationContext() {
  const context = useContext(NewMessageAnimationContext);
  if (!context) {
    throw new Error('useNewMessageAnimationContext must be used within NewMessageAnimationProvider');
  }
  return context;
}

export function useMessageContext() {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error('useMessageContext must be used within MessageContextProvider');
  }
  return context;
}
