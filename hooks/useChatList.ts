/**
 * Chat List Hooks - v0-style composable hooks for chat UX
 * Based on patterns from https://vercel.com/blog/how-we-built-the-v0-ios-app
 */

import {
    useComposerHeightContext,
    useKeyboardStateContext,
    useMessageListContext,
} from '@/context/ChatContext';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NativeModules, Platform } from 'react-native';
import {
    runOnJS,
    useAnimatedProps,
    useAnimatedReaction,
    useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * useMessageListProps - Returns animated props and handlers for the message list
 * Handles contentInset calculation based on composer height
 */
/** Threshold in pixels to consider "near bottom" for auto-scroll */
const NEAR_BOTTOM_THRESHOLD = 120;

export function useMessageListProps() {
  const { composerHeight } = useComposerHeightContext();
  const { listRef, containerHeight, contentHeight, scrollY, isNearBottom, hasNewMessages } = useMessageListContext();
  const insets = useSafeAreaInsets();

  // Animated props for ScrollView/LegendList contentInset
  // This keeps the composer floating on top while allowing scroll
  // Note: Keyboard height is now handled by KeyboardAwareChatContent wrapper
  const animatedProps = useAnimatedProps(() => {
    // Add extra space so the last message isn't tucked under the composer/footer
    const bottomInset = composerHeight.value.value + insets.bottom + 40;
    return {
      contentInset: {
        bottom: Platform.OS === 'ios' ? bottomInset : 0,
      },
      contentContainerStyle: {
        // Ensure all platforms leave room for the floating composer
        paddingBottom: bottomInset,
      },
    };
  }, [insets.bottom]);

  // Track content size changes
  const onContentSizeChange = useCallback((_width: number, height: number) => {
    contentHeight.set(height);
  }, [contentHeight]);

  // Animated scroll handler - also tracks isNearBottom
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value.value = event.contentOffset.y;
      containerHeight.value.value = event.layoutMeasurement.height;

      // Calculate distance from bottom and update isNearBottom
      const distanceFromEnd = contentHeight.value.value - event.contentOffset.y - event.layoutMeasurement.height;
      const nearBottom = distanceFromEnd < NEAR_BOTTOM_THRESHOLD;

      if (isNearBottom.value.value !== nearBottom) {
        isNearBottom.value.value = nearBottom;
      }

      // Clear hasNewMessages when user scrolls to bottom
      if (nearBottom && hasNewMessages.value.value) {
        hasNewMessages.value.value = false;
      }
    },
  });

  return {
    animatedProps,
    ref: listRef,
    onContentSizeChange,
    onScroll,
  };
}

/**
 * useKeyboardAwareMessageList - Handles keyboard show/hide events
 * Updates keyboard state context for other hooks to consume
 * Only auto-scrolls when user is near the bottom of the chat
 */
export function useKeyboardAwareMessageList() {
  const { isKeyboardVisible, keyboardHeight } = useKeyboardStateContext();
  const { scrollToEnd, isNearBottom } = useMessageListContext();

  // Try to use keyboard-controller if available
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    try {
      // Only attempt to require when the native module is linked (avoids Expo Go crash)
      if (NativeModules?.KeyboardController) {
        // Dynamic import to avoid crash if not installed
        const KeyboardController = require('react-native-keyboard-controller');
        if (KeyboardController?.KeyboardEvents) {
          const showSub = KeyboardController.KeyboardEvents.addListener(
            'keyboardWillShow',
            (e: { height: number }) => {
              isKeyboardVisible.set(true);
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
        }
      }
    } catch {
      // Fallback to RN Keyboard API
      const { Keyboard } = require('react-native');
      const showSub = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
        (e: { endCoordinates: { height: number } }) => {
          isKeyboardVisible.set(true);
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
    }

    return () => {
      unsubscribe?.();
    };
  }, [isKeyboardVisible, keyboardHeight]);

  // Auto-scroll to end when keyboard shows, but ONLY if user is near bottom
  useAnimatedReaction(
    () => ({ visible: isKeyboardVisible.value.value, nearBottom: isNearBottom.value.value }),
    (current, previous) => {
      const justBecameVisible = current.visible && !previous?.visible;
      // Only auto-scroll if keyboard just appeared AND user was near bottom
      if (justBecameVisible && current.nearBottom) {
        runOnJS(scrollToEnd)({ animated: true });
      }
    }
  );
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
    () => composerHeight.value.value,
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
 * useInitialScrollToEnd - Scroll to end when opening an existing chat
 * Handles dynamic heights with multiple scroll attempts
 */
export function useInitialScrollToEnd(hasMessages: boolean) {
  const { scrollToEnd, contentHeight } = useMessageListContext();

  useEffect(() => {
    if (!hasMessages) return;

    // Multiple scroll attempts to handle dynamic content
    const scrollToEndMultiple = () => {
      scrollToEnd({ animated: false });
      requestAnimationFrame(() => {
        scrollToEnd({ animated: false });
        setTimeout(() => {
          scrollToEnd({ animated: false });
        }, 16);
      });
    };

    // Wait for content to be measured
    const timeout = setTimeout(scrollToEndMultiple, 100);
    return () => clearTimeout(timeout);
  }, [hasMessages, scrollToEnd, contentHeight]);
}

/**
 * useAutoScrollOnNewMessage - Scroll to end when new messages arrive
 * Uses isNearBottom from context for consistent behavior
 * Sets hasNewMessages when user is scrolled up to show "scroll to bottom" button
 */
export function useAutoScrollOnNewMessage(messageCount: number) {
  const { scrollToEnd, isNearBottom, hasNewMessages } = useMessageListContext();
  const prevMessageCountRef = useRef(messageCount);

  useEffect(() => {
    // Skip if no messages or count didn't increase (deletion, etc.)
    if (messageCount === 0 || messageCount <= prevMessageCountRef.current) {
      prevMessageCountRef.current = messageCount;
      return;
    }

    prevMessageCountRef.current = messageCount;

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
    const nearBottom = isNearBottom.get();

    if (nearBottom) {
      // User is near bottom - auto-scroll to show new message
      // Use RAF + timeout to ensure content height is updated
      requestAnimationFrame(() => {
        setTimeout(() => {
          scrollToEnd({ animated: true });
        }, 50);
      });
    } else {
      // User has scrolled up - don't interrupt, but show indicator
      hasNewMessages.set(true);
    }
  }, [messageCount, scrollToEnd, isNearBottom, hasNewMessages]);
}

/**
 * useHasNewMessages - Hook to get hasNewMessages state for UI
 * Returns a JS state that syncs with the shared value
 */
export function useHasNewMessages() {
  const { hasNewMessages, scrollToEnd } = useMessageListContext();
  const [hasNew, setHasNew] = useState(false);

  useAnimatedReaction(
    () => hasNewMessages.value.value,
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
