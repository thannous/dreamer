/**
 * Chat List Hooks - v0-style composable hooks for chat UX
 * Based on patterns from https://vercel.com/blog/how-we-built-the-v0-ios-app
 */

import {
    useComposerHeightContext,
    useKeyboardStateContext,
    useMessageListContext,
} from '@/context/ChatContext';
import { isChatDebugEnabled } from '@/lib/env';
import type { ChatMessage } from '@/lib/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, NativeModules, Platform, type LayoutChangeEvent } from 'react-native';
import {
    runOnJS,
    useAnimatedReaction,
    useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Threshold in pixels to consider "near bottom" for auto-scroll
 */
const NEAR_BOTTOM_THRESHOLD = 120;

/**
 * Character threshold for detecting "long" AI messages
 * Messages longer than this will scroll to the beginning instead of the end
 * 280 chars is roughly 75% of a screen in a message bubble
 */
const LONG_MESSAGE_THRESHOLD = 280;

/**
 * Room the latest message may take under the composer's top before a conversation
 * opens on it: the bottom spacer keeps 40 between them once scrolled to the end.
 */
const LATEST_MESSAGE_SLACK = 40;

/** When the opening check looks again, in ms: rows measure late on a slow device. */
const REVEAL_RETRY_DELAYS = [100, 200, 400, 700, 1000];

/**
 * Distance from the window's bottom edge to the composer's. With a keyboard up, iOS's
 * KeyboardStickyView keeps the composer 8 above it; Android lifts the composer, still
 * padded by the safe area, by the keyboard's height.
 */
export function composerBottomOffset(keyboardHeight: number, safeAreaBottom: number) {
  'worklet';
  if (keyboardHeight <= 0) return safeAreaBottom;
  return Platform.OS === 'ios' ? keyboardHeight + 8 : keyboardHeight + safeAreaBottom;
}

/**
 * useMessageListProps - Returns the ref and handlers for the message list
 * The floating composer's room is the list footer (BottomSpacer in MessagesList).
 */

export function useMessageListProps() {
  const { listRef, containerHeight, contentHeight, scrollY, isNearBottom, hasNewMessages } = useMessageListContext();

  // Track content size changes
  const onContentSizeChange = useCallback((_width: number, height: number) => {
    contentHeight.set(height);
  }, [contentHeight]);

  // Animated scroll handler - also tracks isNearBottom
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.set(event.contentOffset.y);
      containerHeight.set(event.layoutMeasurement.height);

      // Calculate distance from bottom and update isNearBottom
      const distanceFromEnd = contentHeight.get() - event.contentOffset.y - event.layoutMeasurement.height;
      const nearBottom = distanceFromEnd < NEAR_BOTTOM_THRESHOLD;

      if (isNearBottom.get() !== nearBottom) {
        isNearBottom.set(nearBottom);
      }

      // Clear hasNewMessages when user scrolls to bottom
      if (nearBottom && hasNewMessages.get()) {
        hasNewMessages.set(false);
      }
    },
  });

  // The viewport height before any scroll, for the opening check
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    containerHeight.set(event.nativeEvent.layout.height);
  }, [containerHeight]);

  return {
    ref: listRef,
    onContentSizeChange,
    onLayout,
    onScroll,
  };
}

/**
 * useKeyboardAwareMessageList - Handles keyboard show/hide events
 * Updates keyboard state context for other hooks to consume
 * (useKeyboardSpacer keeps a reader at the end on the latest message)
 */
export function useKeyboardAwareMessageList() {
  const { isKeyboardVisible, keyboardHeight } = useKeyboardStateContext();

  // Try to use keyboard-controller if available
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    const attachFallback = () => {
      const showSub = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
        (e: { endCoordinates: { height: number } }) => {
          isKeyboardVisible.set(e.endCoordinates.height > 0);
          keyboardHeight.set(e.endCoordinates.height);
        }
      );
      const hideSub = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
        () => {
          isKeyboardVisible.set(false);
          keyboardHeight.set(0);
        }
      );
      unsubscribe = () => {
        showSub.remove();
        hideSub.remove();
      };
    };

    const setup = async () => {
      try {
        // Only attempt to load when the native module is linked (avoids Expo Go crash)
        if (NativeModules?.KeyboardController) {
          const KeyboardController = await import('react-native-keyboard-controller');
          if (cancelled) return;
          if (KeyboardController?.KeyboardEvents) {
            const showSub = KeyboardController.KeyboardEvents.addListener(
              'keyboardWillShow',
              (e: { height: number }) => {
                // Folding the iPhone Duo reports a keyboard of no height, which covers nothing.
                isKeyboardVisible.set(e.height > 0);
                keyboardHeight.set(e.height);
              }
            );
            const hideSub = KeyboardController.KeyboardEvents.addListener(
              'keyboardWillHide',
              () => {
                isKeyboardVisible.set(false);
                keyboardHeight.set(0);
              }
            );
            unsubscribe = () => {
              showSub.remove();
              hideSub.remove();
            };
            return;
          }
        }
        attachFallback();
      } catch {
        if (!cancelled) {
          attachFallback();
        }
      }
    };

    void setup();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [isKeyboardVisible, keyboardHeight]);
}

/**
 * useKeyboardSpacer - Room for the keyboard under the last message
 * The list keeps its height while the keyboard covers its bottom, so the footer grows
 * by the distance the composer rides up. A reader at the end stays on the latest
 * message as the keyboard comes and goes.
 */
export function useKeyboardSpacer() {
  const { keyboardHeight } = useKeyboardStateContext();
  const { scrollToEnd, isNearBottom } = useMessageListContext();
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  const heightRef = useRef(0);
  const followRef = useRef(false);

  const update = useCallback((keyboard: number) => {
    const next = Math.max(0, composerBottomOffset(keyboard, insets.bottom) - insets.bottom);
    if (next === heightRef.current) return;
    heightRef.current = next;
    followRef.current = isNearBottom.get();
    setHeight(next);
  }, [insets.bottom, isNearBottom]);

  useAnimatedReaction(
    () => keyboardHeight.get(),
    (current, previous) => {
      if (current !== previous) {
        runOnJS(update)(current);
      }
    },
    [update]
  );

  const onLayout = useCallback(() => {
    if (!followRef.current) return;
    followRef.current = false;
    // The list measures its footer in the same layout pass: scroll on the next frame.
    requestAnimationFrame(() => scrollToEnd({ animated: true }));
  }, [scrollToEnd]);

  return { height, onLayout };
}

/**
 * useFollowComposerResize - Layout handler for the composer's room in the list footer
 * When the composer grows or shrinks (a second line, the thinking indicator), a reader
 * at the end stays on the latest message once the footer has its new height. The
 * distance is measured before the change, so a conversation opened on its header stays put.
 */
export function useFollowComposerResize() {
  const { scrollToEnd, contentHeight, containerHeight, scrollY } = useMessageListContext();
  const heightRef = useRef<number | null>(null);

  return useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    const previous = heightRef.current;
    heightRef.current = height;
    if (previous === null || previous === height || containerHeight.get() <= 0) return;
    const distanceFromEnd = contentHeight.get() - (height - previous) - scrollY.get() - containerHeight.get();
    if (distanceFromEnd < NEAR_BOTTOM_THRESHOLD) {
      requestAnimationFrame(() => scrollToEnd({ animated: true }));
    }
  }, [containerHeight, contentHeight, scrollToEnd, scrollY]);
}

/**
 * useScrollWhenComposerSizeUpdates - Auto-scroll when composer height changes
 * Ensures content stays visible when typing multi-line messages
 * Respects isNearBottom to avoid unwanted scroll jumps
 */
export function useScrollWhenComposerSizeUpdates() {
  const { composerHeight } = useComposerHeightContext();
  const { listRef, scrollToEnd, isNearBottom } = useMessageListContext();

  const autoscrollToEnd = useCallback(() => {
    const list = listRef.current;
    if (!list) return;

    // Only scroll if we're near the bottom (use shared value)
    if (isNearBottom.get()) {
      scrollToEnd({ animated: false });
      // Fire again after a frame for LegendList to update
      requestAnimationFrame(() => {
        scrollToEnd({ animated: false });
      });
    }
  }, [listRef, scrollToEnd, isNearBottom]);

  useAnimatedReaction(
    () => composerHeight.get(),
    (height, prevHeight) => {
      if (height > 0 && height !== prevHeight) {
        runOnJS(autoscrollToEnd)();
      }
    }
  );
}

/**
 * useUpdateLastMessageIndex - Tracks the last message index
 * Used for animation coordination
 */
export function useUpdateLastMessageIndex(messageCount: number) {
  const { lastMessageIndex } = useMessageListContext();

  useEffect(() => {
    lastMessageIndex.set(messageCount - 1);
  }, [messageCount, lastMessageIndex]);
}

/**
 * useRevealLatestMessageOnOpen - Open a conversation on its latest message when the composer covers it
 * A short window (the folded iPhone Duo) or a long history would otherwise open on the
 * dream's header with the latest message under the composer. A conversation that
 * already shows it keeps the header in view.
 */
export function useRevealLatestMessageOnOpen(hasMessages: boolean, hasUserScrolled: () => boolean) {
  const { scrollToEnd, contentHeight, containerHeight, scrollY } = useMessageListContext();

  useEffect(() => {
    if (!hasMessages) return;

    const revealIfCovered = () => {
      if (hasUserScrolled()) return;
      const viewport = containerHeight.get();
      if (viewport <= 0) return;
      const distanceFromEnd = contentHeight.get() - scrollY.get() - viewport;
      if (distanceFromEnd > LATEST_MESSAGE_SLACK) {
        scrollToEnd({ animated: false });
      }
    };

    // Wait for content to be measured, then try again as late rows get their height
    // (a slow cold open, a long history): each try only acts while the message is covered.
    const tries = REVEAL_RETRY_DELAYS.map((delay) => setTimeout(revealIfCovered, delay));
    return () => tries.forEach(clearTimeout);
  }, [containerHeight, contentHeight, hasMessages, hasUserScrolled, scrollToEnd, scrollY]);
}

/**
 * useAutoScrollOnNewMessage - Smart auto-scroll when new messages arrive
 * - For short messages: Scrolls to end (traditional chat behavior)
 * - For long AI messages: Scrolls to beginning so users can read from start
 * - For scrolled-up users: Shows "new message" indicator without interrupting
 */
export function useAutoScrollOnNewMessage(
  messageCount: number,
  messages: ChatMessage[]
) {
  const { scrollToEnd, listRef, isNearBottom, hasNewMessages } = useMessageListContext();
  const prevMessageCountRef = useRef(messageCount);

  useEffect(() => {
    // Skip if no messages or count didn't increase (deletion, etc.)
    if (messageCount === 0 || messageCount <= prevMessageCountRef.current) {
      prevMessageCountRef.current = messageCount;
      return;
    }

    prevMessageCountRef.current = messageCount;

    const lastMessage = messages[messages.length - 1];
    const nearBottom = isNearBottom.get();
    const isModelMessage = lastMessage?.role === 'model';
    if (isModelMessage && !nearBottom) {
      hasNewMessages.set(true);
      return;
    }

    // For new chats (1-2 messages), always scroll to bottom
    if (messageCount <= 2) {
      // Use RAF + timeout to wait for content to be measured
      requestAnimationFrame(() => {
        setTimeout(() => {
          scrollToEnd({ animated: true });
        }, 50);
      });
      return;
    }

    // Check if user is near bottom using the shared value
    if (nearBottom) {
      // User is near bottom - smart scroll based on message length
      const isLongAIMessage =
        isModelMessage &&
        (lastMessage?.text?.length ?? 0) >= LONG_MESSAGE_THRESHOLD;

      // Use RAF + timeout to ensure content height is updated
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (isLongAIMessage) {
            // For long AI messages, scroll to the beginning of the message
            // so users can read from top to bottom naturally
            const lastIndex = messages.length - 1;
            listRef.current?.scrollToIndex({
              index: lastIndex,
              animated: true,
              viewPosition: 0, // 0 = top of message at top of viewport
            });
          } else {
            // For short messages, scroll to bottom (traditional behavior)
            scrollToEnd({ animated: true });
          }
        }, 50);
      });
    } else {
      // User has scrolled up - don't interrupt, but show indicator
      hasNewMessages.set(true);
    }
  }, [messageCount, messages, scrollToEnd, listRef, isNearBottom, hasNewMessages]);
}

/**
 * useHasNewMessages - Hook to get hasNewMessages state for UI
 * Returns a JS state that syncs with the shared value
 */
export function useHasNewMessages() {
  const { hasNewMessages, scrollToEnd } = useMessageListContext();
  const [hasNew, setHasNew] = useState(false);

  useAnimatedReaction(
    () => hasNewMessages.get(),
    (current, prev) => {
      if (current !== prev) {
        runOnJS(setHasNew)(current);
      }
    }
  );

  const scrollToBottom = useCallback(() => {
    hasNewMessages.set(false);
    scrollToEnd({ animated: true });
  }, [hasNewMessages, scrollToEnd]);

  return { hasNewMessages: hasNew, scrollToBottom };
}

/**
 * useScrollToBottomButton - Hook for scroll-to-bottom button visibility
 * Shows button when user is not near the bottom of the chat (scrolled up)
 * Provides scrollToBottom function to jump back to the latest message
 */
export function useScrollToBottomButton() {
  const { isNearBottom, scrollToEnd } = useMessageListContext();
  const [isNearBottomSnapshot, setIsNearBottomSnapshot] = useState(true);
  const debugChat = __DEV__ && isChatDebugEnabled();
  const debugLogNearBottom = useCallback(
    (value: boolean) => {
      if (!debugChat) return;
      console.debug('[ChatList] isNearBottom changed', { value, ts: Date.now() });
    },
    [debugChat]
  );

  useAnimatedReaction(
    () => isNearBottom.get(),
    (current, prev) => {
      if (current !== prev) {
        runOnJS(setIsNearBottomSnapshot)(current);
        if (debugChat) {
          runOnJS(debugLogNearBottom)(current);
        }
      }
    }
  );

  const scrollToBottom = useCallback(() => {
    if (debugChat) {
      console.debug('[ChatList] scrollToBottom pressed', { ts: Date.now() });
    }
    // Multiple scroll attempts to ensure we reach the bottom
    // This matches the pattern in useInitialScrollToEnd for consistency
    scrollToEnd({ animated: true });
    requestAnimationFrame(() => {
      scrollToEnd({ animated: true });
      setTimeout(() => {
        scrollToEnd({ animated: true });
      }, 16);
    });
  }, [debugChat, scrollToEnd]);

  return { shouldShowButton: !isNearBottomSnapshot, scrollToBottom };
}
