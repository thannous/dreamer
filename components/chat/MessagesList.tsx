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
  useKeyboardAwareMessageList,
  useMessageListProps,
  useUpdateLastMessageIndex,
} from '@/hooks/useChatList';
import type { ChatMessage } from '@/lib/types';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AnimatedLegendList } from '@legendapp/list/reanimated';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  InteractionManager,
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
import { MarkdownText } from './MarkdownText';
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

const MARKDOWN_HINT_REGEX =
  /(^#{1,6}\s|```|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|!\[[^\]]*]\([^)]+\)|\[[^\]]+]\([^)]+\)|^\s*[-+*]\s+|^\s*\d+\.\s+|^\s*>)/m;

const hasMarkdownSyntax = (value: string): boolean => {
  return MARKDOWN_HINT_REGEX.test(value);
};

type HandwritingTextProps = {
  text: string;
  style?: StyleProp<TextStyle>;
  animate: boolean;
};

function HandwritingText({ text, style, animate }: HandwritingTextProps) {
  const [displayedText, setDisplayedText] = useState(animate ? '' : text);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!animate) {
      setDisplayedText(text);
      return undefined;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setDisplayedText('');
    if (text.length === 0) {
      return undefined;
    }

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

    timerRef.current = setInterval(() => {
      index = Math.min(text.length, index + step);
      setDisplayedText(text.slice(0, index));

      if (index >= text.length && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }, HANDWRITING_TICK_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [animate, text]);

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
  const shouldHandwritePlainText = useMemo(
    () => shouldHandwrite && !hasMarkdownSyntax(message.text),
    [message.text, shouldHandwrite]
  );
  const [showMarkdown, setShowMarkdown] = useState(!shouldHandwritePlainText);
  const handwritingText = useMemo(() => {
    // Perf: `stripMarkdownForHandwriting()` runs ~7 regex passes over the full string.
    // Only compute it when handwriting mode is actually active; most model messages contain Markdown.
    return shouldHandwritePlainText ? stripMarkdownForHandwriting(message.text) : '';
  }, [message.text, shouldHandwritePlainText]);
  const markdownTextRef = useRef(shouldHandwritePlainText ? '' : message.text);
  const runAfterInteractionsRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);
  const deferMarkdownSwitch = useCallback(() => {
    // On Android, defer the visual switch to MarkdownText to avoid NullPointerException
    // in ViewGroup.dispatchDraw when the view tree changes during a draw cycle.
    if (showMarkdown) return;
    const applySwitch = () => {
      requestAnimationFrame(() => {
        setShowMarkdown(true);
      });
    };
    if (Platform.OS === 'android') {
      runAfterInteractionsRef.current?.cancel();
      runAfterInteractionsRef.current = InteractionManager.runAfterInteractions(applySwitch);
    } else {
      applySwitch();
    }
  }, [showMarkdown]);

  useEffect(() => {
    return () => {
      runAfterInteractionsRef.current?.cancel();
    };
  }, []);

  useEffect(() => {
    setShowMarkdown(!shouldHandwritePlainText);
    runAfterInteractionsRef.current?.cancel();
  }, [message.id, shouldHandwritePlainText]);

  useEffect(() => {
    if (!shouldHandwritePlainText) return;
    if (!isStreaming && !showMarkdown) {
      deferMarkdownSwitch();
    }
  }, [deferMarkdownSwitch, isStreaming, shouldHandwritePlainText, showMarkdown]);

  const shouldAnimateHandwriting = shouldHandwritePlainText && isStreaming;
  const shouldShowPlainText = shouldHandwritePlainText && !showMarkdown;
  const markdownText = shouldHandwritePlainText && isStreaming ? markdownTextRef.current : message.text;

  if (!shouldHandwritePlainText || !isStreaming) {
    markdownTextRef.current = message.text;
  }

  const textStyle = [styles.messageText, { color: colors.textPrimary }];

  useEffect(() => {
    if (!__DEV__) return;
    console.debug('[AssistantMessage] render state', {
      id: message.id,
      isStreaming,
      shouldHandwrite,
      shouldHandwritePlainText,
      showMarkdown,
      shouldShowPlainText,
      activeTextLength: shouldShowPlainText ? handwritingText.length : message.text.length,
      fullTextLength: message.text.length,
    });
  }, [
    handwritingText.length,
    isStreaming,
    message.id,
    message.text.length,
    shouldHandwritePlainText,
    shouldShowPlainText,
    shouldHandwrite,
    showMarkdown,
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

  // On Android, we use a single-layer approach to avoid NullPointerException in ViewGroup.dispatchDraw
  // when the view tree changes during a draw cycle. iOS can use the dual-layer approach safely.
  const messageContent = shouldHandwritePlainText ? (
    <View style={styles.messageContent}>
      {Platform.OS === 'android' ? (
        // Android: Single layer - only render the active component to avoid draw cycle conflicts
        shouldShowPlainText ? (
          <HandwritingText
            text={handwritingText}
            style={textStyle}
            animate={shouldAnimateHandwriting}
          />
        ) : (
          <MarkdownText style={textStyle}>
            {markdownText}
          </MarkdownText>
        )
      ) : (
        // iOS: Dual layer with opacity switching - safe on iOS
        <>
          <View
            style={[styles.contentLayer, shouldShowPlainText ? styles.layerHidden : styles.layerVisible]}
            pointerEvents={shouldShowPlainText ? 'none' : 'auto'}
          >
            <MarkdownText style={textStyle}>
              {markdownText}
            </MarkdownText>
          </View>
          <View
            style={[
              styles.contentLayerOverlay,
              shouldShowPlainText ? styles.layerVisible : styles.layerHidden,
            ]}
            pointerEvents={shouldShowPlainText ? 'auto' : 'none'}
          >
            <HandwritingText
              text={handwritingText}
              style={textStyle}
              animate={shouldAnimateHandwriting}
            />
          </View>
        </>
      )}
    </View>
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
 * Exported for use in Composer.Header
 *
 * IMPORTANT: Uses visibility control instead of conditional rendering to prevent
 * Android NullPointerException in ViewGroup.dispatchDraw when animated views
 * are removed mid-animation.
 */
export function LoadingIndicator({ text, visible = true }: { text?: string; visible?: boolean }) {
  const { colors } = useTheme();

  // Animate visibility to prevent Android crash when removing animated views
  const animatedVisibilityStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(visible ? 1 : 0, { duration: 150 }),
      // Use maxHeight instead of height to allow content to size naturally when visible
      maxHeight: withTiming(visible ? 100 : 0, { duration: 150 }),
    };
  }, [visible]);

  return (
    <Animated.View
      style={[loadingStyles.wrapper, animatedVisibilityStyle]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
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
    </Animated.View>
  );
}

const loadingStyles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
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
  useUpdateLastMessageIndex(messages.length);

  const { animatedProps, ref, onContentSizeChange, onScroll } = useMessageListProps();
  const { isStreaming, hasAnimatedMessages } = useNewMessageAnimationContext();
  const { isNearBottom } = useMessageListContext();
  const { colors } = useTheme();
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
    ]
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  // Avoid copying data on every render (can trigger extra list work)
  const listData = messages;
  const shouldRecycleItems = Platform.OS !== 'android';

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
