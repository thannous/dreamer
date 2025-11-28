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
import { MessageContextProvider, useNewMessageAnimationContext } from '@/context/ChatContext';
import { useTheme } from '@/context/ThemeContext';
import {
    useAutoScrollOnNewMessage,
    useKeyboardAwareMessageList,
    useMessageListProps,
    useScrollWhenComposerSizeUpdates,
    useUpdateLastMessageIndex,
} from '@/hooks/useChatList';
import type { ChatMessage } from '@/lib/types';
import { MaterialCommunityIcons } from '@expo/vector-icons';
 import { AnimatedLegendList } from '@legendapp/list/reanimated';
 import React, { useCallback, useRef } from 'react';
 import { StyleSheet, Text, View } from 'react-native';
 import type Animated from 'react-native-reanimated';
 import { FadeInStaggered, TextFadeInStaggeredIfStreaming } from './FadeInStaggered';

interface MessagesListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  loadingText?: string;
}

/**
 * UserMessage - Styled user message bubble
 */
function UserMessage({ message }: { message: ChatMessage; index: number }) {
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
}

/**
 * AssistantMessage - Styled AI message bubble with streaming support
 */
function AssistantMessage({ message, isStreaming }: { message: ChatMessage; index: number; isStreaming: boolean }) {
  const { colors } = useTheme();

  return (
    <FadeInStaggered>
      <View style={[styles.messageRow, styles.messageRowAI]}>
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
          <MaterialCommunityIcons name="brain" size={20} color={colors.textPrimary} />
        </View>
        <View style={[styles.messageBubble, styles.messageBubbleAI, { backgroundColor: colors.backgroundSecondary }]}>
          <TextFadeInStaggeredIfStreaming
            isStreaming={isStreaming}
            style={{ color: colors.textPrimary }}
          >
            <Text style={[styles.messageText, { color: colors.textPrimary }]}>
              {message.text}
            </Text>
          </TextFadeInStaggeredIfStreaming>
        </View>
      </View>
    </FadeInStaggered>
  );
}

/**
 * LoadingIndicator - Shows thinking state
 */
function LoadingIndicator({ text }: { text?: string }) {
  const { colors } = useTheme();

  return (
    <View style={styles.loadingContainer}>
      <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
        <MaterialCommunityIcons name="brain" size={20} color={colors.textPrimary} />
      </View>
      <View style={[styles.loadingBubble, { backgroundColor: colors.backgroundSecondary }]}>
        <View style={styles.loadingDots}>
          <View style={[styles.dot, { backgroundColor: colors.accent }]} />
          <View style={[styles.dot, styles.dotDelay1, { backgroundColor: colors.accent }]} />
          <View style={[styles.dot, styles.dotDelay2, { backgroundColor: colors.accent }]} />
        </View>
        {text && (
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {text}
          </Text>
        )}
      </View>
    </View>
  );
}

export function MessagesList({ messages, isLoading, loadingText }: MessagesListProps) {
  // Apply composable hooks for chat behavior
  useKeyboardAwareMessageList();
  useScrollWhenComposerSizeUpdates();
  useUpdateLastMessageIndex(messages.length);
  useAutoScrollOnNewMessage(messages.length);

  const { animatedProps, ref, onContentSizeChange, onScroll } = useMessageListProps();
  const { isStreaming, hasAnimatedMessages } = useNewMessageAnimationContext();
  const { colors } = useTheme();
  const scrollViewRef = useRef<Animated.ScrollView | null>(null);

  // Render individual message with context
  const renderItem = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
    const messageId = `${item.role}-${index}`;
    const isNew = !hasAnimatedMessages.current.has(messageId);
    const isStreamingMessage = isStreaming.get() && index === messages.length - 1 && item.role === 'model';

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
          <AssistantMessage message={item} index={index} isStreaming={isStreamingMessage} />
        )}
      </MessageContextProvider>
    );
  }, [messages.length, isStreaming, hasAnimatedMessages]);

  const keyExtractor = useCallback((item: ChatMessage, index: number) => `${item.role}-${index}`, []);

  // Prepare data with loading indicator
  const listData = [...messages];

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDark }]}>
      <AnimatedLegendList
        ref={ref}
        refScrollView={scrollViewRef}
        animatedProps={animatedProps}
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onContentSizeChange={onContentSizeChange}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        // LegendList specific props
        recycleItems={true}
        estimatedItemSize={80}
        maintainScrollAtEnd={false}
      />
      {isLoading && <LoadingIndicator text={loadingText} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100, // Space for floating composer
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
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
    maxWidth: '75%',
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 12,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.6,
  },
  dotDelay1: {
    opacity: 0.4,
  },
  dotDelay2: {
    opacity: 0.2,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
});
