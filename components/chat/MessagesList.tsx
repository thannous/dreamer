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
import {
  MessageContextProvider,
  useComposerHeightContext,
  useMessageListContext,
  useNewMessageAnimationContext,
} from '@/context/ChatContext';
import { useTheme } from '@/context/ThemeContext';
import {
  useAutoScrollOnNewMessage,
  useInitialScrollToEnd,
  useKeyboardAwareMessageList,
  useMessageListProps,
  useScrollWhenComposerSizeUpdates,
  useUpdateLastMessageIndex,
} from '@/hooks/useChatList';
import type { ChatMessage } from '@/lib/types';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AnimatedLegendList } from '@legendapp/list/reanimated';
import { MarkdownText } from './MarkdownText';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeInStaggered } from './FadeInStaggered';
import { ScrollToBottomButton } from './ScrollToBottomButton';

type LegendListComponent = React.ComponentType<any> | React.ReactElement | null;

interface MessagesListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  loadingText?: string;
  ListHeaderComponent?: LegendListComponent;
  ListFooterComponent?: LegendListComponent;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  onRetryMessage?: (message: ChatMessage) => void;
  retryA11yLabel?: string;
}

/**
 * UserMessage - Styled user message bubble
 */
// Perf: memoize message bubbles so list-level rerenders don't re-render every visible message on the JS thread.
const UserMessage = memo(function UserMessage({ message }: { message: ChatMessage; index: number }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.messageRow, styles.messageRowUser]}>
      <View style={[styles.messageBubble, styles.messageBubbleUser, { backgroundColor: colors.accent }]}>
        <Text style={[styles.messageText, { color: colors.textPrimary }]}>
          {message.text}
        </Text>
      </View>
      <View style={[styles.avatar, { backgroundColor: colors.backgroundSecondary }]}>
        <MaterialCommunityIcons name="account" size={20} color={colors.textPrimary} />
      </View>
    </View>
  );
});

/**
 * AssistantMessage - Styled AI message bubble with streaming support
 */
const HANDWRITING_CHAR_MS = 26;
const HANDWRITING_MIN_DURATION = 650;
const HANDWRITING_MAX_DURATION = 2400;
const HANDWRITING_TICK_MS = 16;

const stripMarkdownForHandwriting = (value: string): string => {
  return value
    .replace(/```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-+*]\s+/gm, '');
};

type HandwritingTextProps = {
  text: string;
  style?: StyleProp<TextStyle>;
  animate: boolean;
  onComplete?: () => void;
};

function HandwritingText({ text, style, animate, onComplete }: HandwritingTextProps) {
  const [displayedText, setDisplayedText] = useState(animate ? '' : text);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didCompleteRef = useRef(false);

  useEffect(() => {
    didCompleteRef.current = false;
    if (!animate) {
      setDisplayedText(text);
      if (!didCompleteRef.current) {
        didCompleteRef.current = true;
        onComplete?.();
      }
      return undefined;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setDisplayedText('');

    const totalDuration = Math.min(
      HANDWRITING_MAX_DURATION,
      Math.max(HANDWRITING_MIN_DURATION, text.length * HANDWRITING_CHAR_MS)
    );
    const step = Math.max(1, Math.ceil(text.length / (totalDuration / HANDWRITING_TICK_MS)));

    if (__DEV__) {
      console.debug('[HandwritingText] start', {
        length: text.length,
        totalDuration,
        step,
      });
    }

    let index = 0;
    const finish = () => {
      if (!didCompleteRef.current) {
        didCompleteRef.current = true;
        if (__DEV__) {
          console.debug('[HandwritingText] complete', { length: text.length });
        }
        onComplete?.();
      }
    };

    timeoutRef.current = setTimeout(() => {
      finish();
    }, totalDuration + HANDWRITING_TICK_MS);

    timerRef.current = setInterval(() => {
      index = Math.min(text.length, index + step);
      setDisplayedText(text.slice(0, index));

      if (index >= text.length && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        finish();
      }
    }, HANDWRITING_TICK_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [animate, onComplete, text]);

  return (
    <Text style={style}>
      {displayedText}
    </Text>
  );
}

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
  const [handwritingComplete, setHandwritingComplete] = useState(!shouldHandwrite);
  // Deferred state to prevent abrupt view tree changes during Android draw cycle.
  // The switch to MarkdownText is delayed by one frame to let the view hierarchy stabilize.
  const [deferredHandwritingComplete, setDeferredHandwritingComplete] = useState(!shouldHandwrite);
  const handwritingText = useMemo(() => stripMarkdownForHandwriting(message.text), [message.text]);
  const handleHandwritingComplete = useCallback(() => {
    setHandwritingComplete(true);
    // On Android, defer the visual switch to MarkdownText to avoid NullPointerException
    // in ViewGroup.dispatchDraw when the view tree changes during a draw cycle.
    if (Platform.OS === 'android') {
      requestAnimationFrame(() => {
        setDeferredHandwritingComplete(true);
      });
    } else {
      setDeferredHandwritingComplete(true);
    }
  }, []);

  useEffect(() => {
    if (shouldHandwrite) {
      setHandwritingComplete(false);
      setDeferredHandwritingComplete(false);
    }
  }, [message.id, shouldHandwrite]);

  // Use deferred state for determining when to show complex MarkdownText on Android.
  // This prevents view tree corruption when switching components during draw.
  const isHandwritingActive = shouldHandwrite && !deferredHandwritingComplete;
  const isAnimating = isHandwritingActive;

  const textStyle = [styles.messageText, { color: colors.textPrimary }];

  useEffect(() => {
    if (!__DEV__) return;
    console.debug('[AssistantMessage] render state', {
      id: message.id,
      isStreaming,
      shouldHandwrite,
      handwritingComplete,
      isAnimating,
      activeTextLength: isAnimating ? handwritingText.length : message.text.length,
      fullTextLength: message.text.length,
    });
  }, [
    handwritingText.length,
    handwritingComplete,
    isAnimating,
    isStreaming,
    message.id,
    message.text.length,
    shouldHandwrite,
  ]);

  const aiBubbleStyle = mode === 'dark'
    ? {
        backgroundColor: colors.backgroundCard,
        borderColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
      }
    : {
        backgroundColor: colors.backgroundSecondary,
        borderColor: colors.divider,
        borderWidth: 1,
      };

  const messageContent = isHandwritingActive ? (
    <HandwritingText
      text={handwritingText}
      style={textStyle}
      animate={isHandwritingActive}
      onComplete={handleHandwritingComplete}
    />
  ) : (
    <MarkdownText style={textStyle}>
      {message.text}
    </MarkdownText>
  );

  return (
    <FadeInStaggered>
      <View style={[styles.messageRow, styles.messageRowAI]}>
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
          <MaterialCommunityIcons name="brain" size={20} color={colors.textPrimary} />
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
                backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.08)' : colors.backgroundSecondary,
                borderColor: colors.divider,
              },
              pressed && styles.retryButtonPressed,
            ]}
          >
            <MaterialCommunityIcons name="refresh" size={18} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>
    </FadeInStaggered>
  );
});

/**
 * AnimatedDot - Single pulsing dot with staggered timing
 */
function AnimatedDot({ delay, color }: { delay: number; color: string }) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 450 }),
          withTiming(0.4, { duration: 450 })
        ),
        -1,
        false
      )
    );
  }, [delay, opacity]);

  const animatedStyle = useAnimatedStyle(() => {
    return { opacity: opacity.value };
  });

  return <Animated.View style={[loadingStyles.dot, { backgroundColor: color }, animatedStyle]} />;
}

/**
 * LoadingIndicator - Shows thinking state
 * Exported for use in Composer headerContent
 */
export function LoadingIndicator({ text }: { text?: string }) {
  const { colors } = useTheme();

  return (
    <View style={loadingStyles.container}>
      <View style={[loadingStyles.avatar, { backgroundColor: colors.accent }]}>
        <MaterialCommunityIcons name="brain" size={20} color={colors.textPrimary} />
      </View>
      <View style={[loadingStyles.bubble, { backgroundColor: colors.backgroundSecondary }]}>
        <View style={loadingStyles.dots}>
          <AnimatedDot delay={0} color={colors.accent} />
          <AnimatedDot delay={150} color={colors.accent} />
          <AnimatedDot delay={300} color={colors.accent} />
        </View>
        {text && (
          <Text style={[loadingStyles.text, { color: colors.textSecondary }]}>
            {text}
          </Text>
        )}
      </View>
    </View>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 12,
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
});

/**
 * BottomSpacer - Adds space at the bottom of the list for the floating composer
 * Keyboard height is now handled by KeyboardAwareChatContent wrapper
 */
function BottomSpacer() {
  const { composerHeight } = useComposerHeightContext();
  const insets = useSafeAreaInsets();

  const animatedStyle = useAnimatedStyle(() => {
    // Space for composer + safe area + extra padding
    const height = composerHeight.value.value + insets.bottom + 40;
    return { height };
  }, [insets.bottom]);

  return <Animated.View style={animatedStyle} />;
}

export function MessagesList({
  messages,
  isLoading,
  loadingText,
  ListHeaderComponent,
  ListFooterComponent,
  style,
  contentContainerStyle,
  onRetryMessage,
  retryA11yLabel,
}: MessagesListProps) {
  const handwritingAnimatedMessages = useRef<Set<string>>(new Set());
  const prevMessagesLengthRef = useRef(0);
  const prevLastRoleRef = useRef<ChatMessage['role'] | undefined>(undefined);
  const insets = useSafeAreaInsets();

  const prevLength = prevMessagesLengthRef.current;
  const delta = messages.length - prevLength;
  const didInitialHydrate = prevLength === 0 && messages.length > 0;
  const canHandwriteNewAiMessage =
    !didInitialHydrate &&
    messages.length > 0 &&
    messages[messages.length - 1].role === 'model' &&
    ((delta === 1 && prevLastRoleRef.current === 'user') ||
      (delta === 2 && messages.length >= 2 && messages[messages.length - 2].role === 'user'));

  useEffect(() => {
    prevMessagesLengthRef.current = messages.length;
    prevLastRoleRef.current = messages.length ? messages[messages.length - 1].role : undefined;
  }, [messages]);

  // Apply composable hooks for chat behavior
  useKeyboardAwareMessageList();
  useScrollWhenComposerSizeUpdates();
  useUpdateLastMessageIndex(messages.length);
  useAutoScrollOnNewMessage(messages.length, messages);
  useInitialScrollToEnd(messages.length > 0);

  const { animatedProps, ref, onContentSizeChange, onScroll } = useMessageListProps();
  const { isStreaming, hasAnimatedMessages } = useNewMessageAnimationContext();
  const { isNearBottom } = useMessageListContext();
  const { colors } = useTheme();
  const scrollViewRef = useRef<Animated.ScrollView | null>(null);
  const [isStreamingSnapshot, setIsStreamingSnapshot] = useState(false);
  const [isNearBottomSnapshot, setIsNearBottomSnapshot] = useState(true);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const lastErrorMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === 'model' && message.meta?.isError) {
        return message.id;
      }
    }
    return null;
  }, [messages]);

  // Sync shared value to JS state to avoid reading .value during render
  useEffect(() => {
    setIsStreamingSnapshot(isStreaming.value.value);
  }, [isStreaming]);

  useAnimatedReaction(
    () => isStreaming.value.value,
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

  // Sync isNearBottom to JS so we can disable expensive behaviors when the user is reading history.
  useEffect(() => {
    setIsNearBottomSnapshot(isNearBottom.value.value);
  }, [isNearBottom]);

  useAnimatedReaction(
    () => isNearBottom.value.value,
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
      const isNew = !didInitialHydrate && !hasAnimatedMessages.current.has(messageId);
      const isStreamingMessage =
        isStreamingSnapshot && index === messages.length - 1 && item.role === 'model';
      const allowHandwrite = isNearBottomSnapshot && !isUserScrolling;
      const hasAnimatedHandwriting = handwritingAnimatedMessages.current.has(messageId);
      let shouldHandwrite = false;
      const isRetryableError = Boolean(
        onRetryMessage &&
          item.role === 'model' &&
          item.meta?.isError &&
          lastErrorMessageId &&
          item.id === lastErrorMessageId
      );

      if (
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
    ]
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  // Avoid copying data on every render (can trigger extra list work)
  const listData = messages;
  const shouldRecycleItems = Platform.OS !== 'android';
  const lastMessageRole = messages.length ? messages[messages.length - 1].role : undefined;
  const shouldMaintainScrollAtEnd =
    isNearBottomSnapshot && lastMessageRole === 'user' && !isStreamingSnapshot;

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
      style={[styles.container, style, { backgroundColor: colors.backgroundDark }]}
      {...loadingAccessibility}
    >
      <AnimatedLegendList
        ref={ref}
        refScrollView={scrollViewRef}
        animatedProps={animatedProps}
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onContentSizeChange={onContentSizeChange}
        onScroll={onScroll}
        onScrollBeginDrag={() => setIsUserScrolling(true)}
        onScrollEndDrag={() => setIsUserScrolling(false)}
        onMomentumScrollBegin={() => setIsUserScrolling(true)}
        onMomentumScrollEnd={() => setIsUserScrolling(false)}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 8 }, contentContainerStyle]}
        // LegendList specific props for chat UX
        recycleItems={shouldRecycleItems}
        estimatedItemSize={80}
        // Enable maintainScrollAtEnd for chat-style auto-scroll behavior
        // This keeps the list anchored at the bottom during layout/size changes
        // if the user is already near the bottom (threshold ~10% from end)
        // Note: onDataChange is handled by useAutoScrollOnNewMessage hook for smart scrolling
        maintainScrollAtEnd={
          shouldMaintainScrollAtEnd
            ? {
                onLayout: true,
                onItemLayout: true,
              }
            : undefined
        }
        maintainScrollAtEndThreshold={0.1}
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
    // paddingBottom is set dynamically via animatedProps in useChatList
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
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
    lineHeight: 20,
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
