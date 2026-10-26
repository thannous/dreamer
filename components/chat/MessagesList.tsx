/**
 * MessagesList - Optimized virtualized message list
 * Based on v0's LegendList approach: https://vercel.com/blog/how-we-built-the-v0-ios-app
 *
 * Key features:
 * - LegendList for fast virtualization
 * - Composable hooks for keyboard awareness and auto-scroll
 * - Animated props for smooth contentInset updates
 * - Per-message animation context
 */

import { Fonts } from '@/constants/theme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import {
  MessageContextProvider,
  useComposerHeightContext,
  useMessageListContext,
  useNewMessageAnimationContext,
} from '@/context/ChatContext';
import { useTheme } from '@/context/ThemeContext';
import {
  useKeyboardAwareMessageList,
  useKeyboardSpacer,
  useMessageListProps,
  useRevealLatestMessageOnOpen,
  useUpdateLastMessageIndex,
} from '@/hooks/useChatList';
import { buildDisplayMessages } from '@/lib/chat/streamingDisplay';
import type { StreamingReply, StreamingReplyChannel } from '@/lib/chat/streamingReplyChannel';
import { MotiView } from '@/lib/moti';
import type { ChatMessage } from '@/lib/types';
import { AnimatedLegendList } from '@legendapp/list/reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeInStaggered } from './FadeInStaggered';
import { MarkdownText } from './MarkdownText';
import { ScrollToBottomButton } from './ScrollToBottomButton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TypeScale } from '@/constants/typeScale';

type LegendListComponent = React.ComponentType<any> | React.ReactElement | null;

interface MessagesListProps {
  messages: ChatMessage[];
  /** A reply streaming in, shown after `messages` until history holds it. */
  streamingReply?: StreamingReplyChannel;
  isLoading?: boolean;
  loadingText?: string;
  ListHeaderComponent?: LegendListComponent;
  ListFooterComponent?: LegendListComponent;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  onRetryMessage?: (message: ChatMessage) => void;
  retryA11yLabel?: string;
  onScrollStateChange?: (isScrolling: boolean) => void;
}

/**
 * UserMessage - Styled user message bubble
 */
// Perf: memoize message bubbles so list-level rerenders don't re-render every visible message on the JS thread.
const UserMessage = memo(function UserMessage({ message }: { message: ChatMessage; index: number }) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

  return (
    <FadeInStaggered>
      <View style={[styles.messageRow, styles.messageRowUser]}>
        <LinearGradient
          colors={[noctalia.action.primary, noctalia.accent.strong]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.messageBubble, styles.messageBubbleUser]}
        >
          <MarkdownText tone="onAccent" style={[styles.messageText, { color: noctalia.action.primaryText }]}>
            {message.text}
          </MarkdownText>
        </LinearGradient>
        <View style={[styles.avatar, { backgroundColor: noctalia.surface.active }]}>
          <IconSymbol name="person.fill" size={20} color={noctalia.text.primary} />
        </View>
      </View>
    </FadeInStaggered>
  );
});

/**
 * AssistantMessage - Styled AI message bubble with streaming support
 */
const AssistantMessage = memo(function AssistantMessage({
  message,
  isStreaming,
  shouldHandwrite,
  isRetryableError,
  onRetry,
  retryA11yLabel,
}: {
  message: ChatMessage;
  index: number;
  isStreaming: boolean;
  shouldHandwrite: boolean;
  isRetryableError: boolean;
  onRetry?: () => void;
  retryA11yLabel?: string;
}) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const aiBubbleStyle = {
    backgroundColor: noctalia.surface.raised,
    borderColor: noctalia.surface.border,
    borderWidth: 1,
  };

  const messageContent = (
    <MarkdownText style={[styles.messageText, { color: noctalia.text.primary }]} isStreaming={isStreaming}>
      {message.text}
    </MarkdownText>
  );

  return (
    <FadeInStaggered>
      <View style={[styles.messageRow, styles.messageRowAI]}>
        <View style={styles.avatarContainer}>
          <MotiView
            from={{ opacity: 0.15, scale: 1 }}
            animate={{ opacity: shouldHandwrite ? 0.5 : 0.15, scale: shouldHandwrite ? 1.25 : 1 }}
            transition={{ type: 'timing', duration: 600 }}
            style={[styles.avatarGlow, { backgroundColor: noctalia.accent.base }]}
          />
          <View style={[styles.avatar, { backgroundColor: noctalia.accent.base }]}>
            <IconSymbol name="brain" size={20} color={noctalia.action.primaryText} />
          </View>
        </View>
        <View style={[styles.messageBubble, styles.messageBubbleAI, aiBubbleStyle]}>
          {messageContent}
        </View>
        {isRetryableError && onRetry && (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={retryA11yLabel}
            style={({ pressed }) => [
              styles.retryButton,
              {
                backgroundColor: noctalia.surface.soft,
                borderColor: noctalia.surface.border,
              },
              pressed && styles.retryButtonPressed,
            ]}
          >
            <IconSymbol name="arrow.clockwise" size={18} color={noctalia.text.secondary} />
          </Pressable>
        )}
      </View>
    </FadeInStaggered>
  );
});

export { LoadingIndicator } from './LoadingIndicator';

/**
 * BottomSpacer - Adds space at the bottom of the list for the floating composer
 * and, while one is up, for the keyboard it rides on
 */
function BottomSpacer() {
  const { composerHeight } = useComposerHeightContext();
  const insets = useSafeAreaInsets();
  const keyboardSpacer = useKeyboardSpacer();

  const animatedStyle = useAnimatedStyle(() => {
    // Space for composer + safe area + extra padding
    const height = composerHeight.get() + insets.bottom + 40;
    return { height };
  }, [insets.bottom]);

  return (
    <>
      <Animated.View style={animatedStyle} />
      <View style={{ height: keyboardSpacer.height }} onLayout={keyboardSpacer.onLayout} />
    </>
  );
}

const MAINTAIN_SCROLL_AT_END = { onDataChange: true, onItemLayout: true };

const emptyStreamingReply = () => null;
const subscribeToEmptyReply = () => () => {};

/** The reply streaming in; a new fragment renders the list that reads it, not its screen. */
function useStreamingReply(channel?: StreamingReplyChannel): StreamingReply | null {
  // Read the new channel in the same render: a replaced conversation must never
  // borrow the previous channel's fragment while waiting for its next callback.
  return useSyncExternalStore(
    channel?.subscribe ?? subscribeToEmptyReply,
    channel?.get ?? emptyStreamingReply,
    channel?.get ?? emptyStreamingReply,
  );
}

export function MessagesList({
  messages: history,
  streamingReply,
  isLoading,
  loadingText,
  ListHeaderComponent,
  ListFooterComponent,
  style,
  contentContainerStyle,
  onRetryMessage,
  retryA11yLabel,
  onScrollStateChange,
}: MessagesListProps) {
  const streaming = useStreamingReply(streamingReply);
  const messages = useMemo(
    () => buildDisplayMessages(history, streaming?.text ?? null, streaming?.requestId ?? null),
    [history, streaming]
  );
  const handwritingAnimatedMessages = useRef<Set<string>>(new Set());
  const lastMessage = messages.at(-1);
  const [transition, setTransition] = useState(() => ({
    length: messages.length, lastId: lastMessage?.id, lastRole: lastMessage?.role,
    previousLength: 0, previousLastRole: undefined as ChatMessage['role'] | undefined,
  }));
  // Track message arrivals as render state, without mutable render-time refs or
  // another state update for each text fragment of the same streaming message.
  if (transition.length !== messages.length || transition.lastId !== lastMessage?.id
    || transition.lastRole !== lastMessage?.role) {
    setTransition({
      length: messages.length, lastId: lastMessage?.id, lastRole: lastMessage?.role,
      previousLength: transition.length,
      previousLastRole: transition.lastRole,
    });
  }
  const insets = useSafeAreaInsets();

  const prevLength = transition.previousLength;
  const delta = messages.length - prevLength;
  const didInitialHydrate = prevLength === 0 && messages.length > 0;
  const canHandwriteNewAiMessage =
    !didInitialHydrate &&
    messages.length > 0 &&
    messages[messages.length - 1].role === 'model' &&
    ((delta === 1 && transition.previousLastRole === 'user') ||
      (delta === 2 && messages.length >= 2 && messages[messages.length - 2].role === 'user'));

  // Apply composable hooks for chat behavior
  const hasUserScrolledRef = useRef(false);
  const hasUserScrolled = useCallback(() => hasUserScrolledRef.current, []);
  useKeyboardAwareMessageList();
  useUpdateLastMessageIndex(messages.length);
  useRevealLatestMessageOnOpen(messages.length > 0, hasUserScrolled);

  const { ref, onContentSizeChange, onLayout, onScroll } = useMessageListProps();
  const { isStreaming, hasAnimatedMessages } = useNewMessageAnimationContext();
  const { isNearBottom } = useMessageListContext();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const [isStreamingSnapshot, setIsStreamingSnapshot] = useState(false);
  const [isNearBottomSnapshot, setIsNearBottomSnapshot] = useState(true);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollStateRef = useRef(false);
  const lastErrorMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === 'model' && message.meta?.isError) {
        return message.id;
      }
    }
    return null;
  }, [messages]);

  useAnimatedReaction(
    () => isStreaming.get(),
    (current, prev) => {
      if (current === prev) return;
      runOnJS(setIsStreamingSnapshot)(current);
    },
    [isStreaming]
  );

  // Avoid running "new message" animations for existing history.
  // Without this, older messages can be treated as "new" the first time they scroll into view.
  useEffect(() => {
    if (!didInitialHydrate) return;
    for (let index = 0; index < messages.length; index++) {
      hasAnimatedMessages.current.add(messages[index].id);
    }
  }, [didInitialHydrate, hasAnimatedMessages, messages]);

  const setScrolling = useCallback((next: boolean) => {
    if (next) hasUserScrolledRef.current = true;
    if (scrollStateRef.current === next) return;
    scrollStateRef.current = next;
    setIsUserScrolling(next);
    onScrollStateChange?.(next);
  }, [onScrollStateChange]);

  useAnimatedReaction(
    () => isNearBottom.get(),
    (current, prev) => {
      if (current === prev) return;
      runOnJS(setIsNearBottomSnapshot)(current);
    },
    [isNearBottom]
  );

  // Render individual message with context
  const renderItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const messageId = item.id;
      // A completed reply takes the place of its streaming bubble: it is already on screen.
      const isNew = !didInitialHydrate && !hasAnimatedMessages.current.has(messageId)
        && !streamingReply?.continuesStream(messageId);
      const isStreamingMessage =
        isStreamingSnapshot && index === messages.length - 1 && item.role === 'model';
      const allowHandwrite = isNearBottomSnapshot && !isUserScrolling;
      const hasAnimatedHandwriting = handwritingAnimatedMessages.current.has(messageId);
      let shouldHandwrite = false;
      const isRetryableError = Boolean(
        onRetryMessage &&
        item.role === 'model' &&
        item.meta?.isError &&
        item.meta.retry &&
        lastErrorMessageId &&
        item.id === lastErrorMessageId
      );

      if (hasAnimatedHandwriting && allowHandwrite) {
        shouldHandwrite = true;
      } else if (
        !hasAnimatedHandwriting &&
        canHandwriteNewAiMessage &&
        isNew &&
        allowHandwrite &&
        item.role === 'model' &&
        index === messages.length - 1
      ) {
        shouldHandwrite = true;
        handwritingAnimatedMessages.current.add(messageId);
      }

      // Mark as animated
      if (isNew) {
        hasAnimatedMessages.current.add(messageId);
      }

      return (
        <MessageContextProvider
          messageId={messageId}
          index={index}
          isStreaming={isStreamingMessage}
          isNew={isNew}
        >
          {item.role === 'user' ? (
            <UserMessage message={item} index={index} />
          ) : (
            <AssistantMessage
              message={item}
              index={index}
              isStreaming={isStreamingMessage}
              shouldHandwrite={shouldHandwrite}
              isRetryableError={isRetryableError}
              onRetry={isRetryableError ? () => onRetryMessage?.(item) : undefined}
              retryA11yLabel={retryA11yLabel}
            />
          )}
        </MessageContextProvider>
      );
    },
    [
      canHandwriteNewAiMessage,
      didInitialHydrate,
      hasAnimatedMessages,
      isNearBottomSnapshot,
      isStreamingSnapshot,
      isUserScrolling,
      lastErrorMessageId,
      messages.length,
      onRetryMessage,
      retryA11yLabel,
      streamingReply,
    ]
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  // Avoid copying data on every render (can trigger extra list work)
  const listData = messages;

  const loadingAccessibility = isLoading
    ? { accessibilityState: { busy: true }, accessibilityLabel: loadingText }
    : undefined;

  // Combine custom footer with half-height spacer for composer clearance
  const footerComponent = (
    <>
      {ListFooterComponent}
      <BottomSpacer />
    </>
  );

  return (
    <View
      style={[styles.container, style, { backgroundColor: noctalia.screen.background }]}
      {...loadingAccessibility}
    >
      <AnimatedLegendList
        ref={ref}
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onContentSizeChange={onContentSizeChange}
        onLayout={onLayout}
        onScroll={onScroll}
        onScrollBeginDrag={() => setScrolling(true)}
        onScrollEndDrag={() => setScrolling(false)}
        onMomentumScrollBegin={() => setScrolling(true)}
        onMomentumScrollEnd={() => setScrolling(false)}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        // The iPhone keyboard has no key to hide it: a drag or a tap on the conversation does.
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 8 }, contentContainerStyle]}
        // LegendList specific props for chat UX
        // A reader at the end follows a sent message and the reply streaming in.
        maintainScrollAtEnd={MAINTAIN_SCROLL_AT_END}
        recycleItems
        estimatedItemSize={80}
        ListHeaderComponent={ListHeaderComponent ?? null}
        ListFooterComponent={footerComponent}
      />
      <ScrollToBottomButton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 16,
    // The composer's and the keyboard's room is the list footer (BottomSpacer)
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    marginHorizontal: 8,
    gap: 8,
  },
  messageRowAI: {
    justifyContent: 'flex-start',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  avatarContainer: {
    position: 'relative',
    width: 32,
    height: 32,
  },
  avatarGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    top: -4,
    left: -4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: 12,
    padding: 12,
  },
  messageBubbleAI: {},
  messageBubbleUser: {},
  messageText: {
    fontSize: TypeScale.bodySm.fontSize,
    fontFamily: Fonts.outfit.regular,
    lineHeight: 20,
  },
  messageContent: {
    width: '100%',
  },
  contentLayer: {
    width: '100%',
  },
  contentLayerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  layerHidden: {
    opacity: 0,
  },
  layerVisible: {
    opacity: 1,
  },
  retryButton: {
    alignSelf: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  retryButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
});
