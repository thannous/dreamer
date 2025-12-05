/**
 * Chat List Hooks - v0-style composable hooks for chat UX
 * Based on patterns from https://vercel.com/blog/how-we-built-the-v0-ios-app
 */

import {
    useComposerHeightContext,
    useKeyboardStateContext,
    useMessageListContext,
} from '@/context/ChatContext';
import { useCallback, useEffect } from 'react';
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
export function useMessageListProps() {
  const { composerHeight } = useComposerHeightContext();
  const { listRef, containerHeight, contentHeight, scrollY } = useMessageListContext();
  const insets = useSafeAreaInsets();

  // Animated props for ScrollView/LegendList contentInset
  // This keeps the composer floating on top while allowing scroll
  const animatedProps = useAnimatedProps(() => {
    // Add extra space so the last message isn't tucked under the composer/footer
    // Extra padding ensures content is visible above the floating composer
    const bottomInset = composerHeight.value.value + insets.bottom + 80;
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

  // Animated scroll handler
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value.value = event.contentOffset.y;
      containerHeight.value.value = event.layoutMeasurement.height;
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
 */
export function useKeyboardAwareMessageList() {
  const { isKeyboardVisible, keyboardHeight } = useKeyboardStateContext();
  const { scrollToEnd } = useMessageListContext();

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

  // Auto-scroll to end when keyboard shows
  useAnimatedReaction(
    () => isKeyboardVisible.value.value,
    (visible, prevVisible) => {
      if (visible && !prevVisible) {
        runOnJS(scrollToEnd)({ animated: true });
      }
    }
  );
}

/**
 * useScrollWhenComposerSizeUpdates - Auto-scroll when composer height changes
 * Ensures content stays visible when typing multi-line messages
 */
export function useScrollWhenComposerSizeUpdates() {
  const { composerHeight } = useComposerHeightContext();
  const { listRef, scrollToEnd, contentHeight, containerHeight, scrollY } = useMessageListContext();

  const autoscrollToEnd = useCallback(() => {
    const list = listRef.current;
    if (!list) return;

    // Calculate distance from end
    const content = contentHeight.get();
    const container = containerHeight.get();
    const scroll = scrollY.get();
    const distanceFromEnd = content - scroll - container;

    // Only scroll if we're near the end (within 50px)
    if (distanceFromEnd < 50) {
      scrollToEnd({ animated: false });
      // Fire again after a frame for LegendList to update
      setTimeout(() => {
        scrollToEnd({ animated: false });
      }, 16);
    }
  }, [listRef, scrollToEnd, contentHeight, containerHeight, scrollY]);

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
 */
export function useAutoScrollOnNewMessage(messageCount: number) {
  const { scrollToEnd, scrollY, contentHeight, containerHeight } = useMessageListContext();

  useEffect(() => {
    if (messageCount === 0) return;

    // Check if we're near the bottom
    const content = contentHeight.get();
    const container = containerHeight.get();
    const scroll = scrollY.get();
    const distanceFromEnd = content - scroll - container;

    // Only auto-scroll if we're near the end or it's a new chat
    if (distanceFromEnd < 100 || messageCount <= 2) {
      setTimeout(() => {
        scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messageCount, scrollToEnd, scrollY, contentHeight, containerHeight]);
}
