import { BottomSheet as ExpoBottomSheet, RNHostView } from '@expo/ui';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetSurface } from './BottomSheetSurface';

import { blurActiveElement } from '@/lib/accessibility';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional style override for the React Native sheet content. */
  style?: StyleProp<ViewStyle>;
  /** Optional class override for the React Native sheet content. Applied last, so it wins. */
  className?: string;
  /**
   * Kept for API compatibility. Expo UI owns the native/Vaul backdrop.
   */
  backdropColor?: string;
  /** Opaque native sheet background, including the handle and safe area. */
  surfaceColor?: string;
  /** Test ID for E2E testing. */
  testID?: string;
  /** How users can dismiss the sheet by gesture (default: 'pan'). */
  dismissBehavior?: 'pan' | 'none';
  /** Show the native gesture handle above the hosted content. */
  showDragIndicator?: boolean;
  /** Disable when the caller owns scrolling and a fixed action area. */
  scrollable?: boolean;
  /** Optional native sheet heights. Omit to keep content-sized behavior. */
  snapPoints?: React.ComponentProps<typeof ExpoBottomSheet>['snapPoints'];
};

const NATIVE_SHEET_HORIZONTAL_INSET = 0;
const IOS_SHEET_MAX_WIDTH = 540;
const ANDROID_SHEET_MAX_WIDTH = 640;

export function getNativeBottomSheetContentWidth(
  viewportWidth: number,
  platform: 'android' | 'ios',
) {
  const sheetMaxWidth = platform === 'ios' ? IOS_SHEET_MAX_WIDTH : ANDROID_SHEET_MAX_WIDTH;
  return Math.max(0, Math.min(viewportWidth, sheetMaxWidth) - NATIVE_SHEET_HORIZONTAL_INSET * 2);
}

/**
 * Universal Expo UI sheet that hosts the existing branded React Native content.
 *
 * The single RN child is intentionally responsible for styling and test IDs:
 * RNHostView does not forward every React Native prop on all native platforms.
 */
export function BottomSheet({
  visible,
  onClose,
  children,
  style,
  className,
  backdropColor,
  surfaceColor,
  testID,
  dismissBehavior = 'pan',
  showDragIndicator = true,
  scrollable = true,
  snapPoints,
}: BottomSheetProps) {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maximumHeight = Math.max(160, viewportHeight - insets.top - insets.bottom - 72);
  const previouslyFocusedElementRef = useRef<{ focus?: () => void } | null>(null);
  const wasVisibleRef = useRef(false);
  const [presentationEpoch, setPresentationEpoch] = useState(0);

  useEffect(() => {
    const wasVisible = wasVisibleRef.current;
    wasVisibleRef.current = visible;

    if (visible && !wasVisible) {
      blurActiveElement();
      if (typeof document !== 'undefined') {
        previouslyFocusedElementRef.current = document.activeElement as {
          focus?: () => void;
        } | null;
      }
    }

    if (!visible && wasVisible) {
      const previouslyFocusedElement = previouslyFocusedElementRef.current;
      previouslyFocusedElementRef.current = null;
      setTimeout(() => previouslyFocusedElement?.focus?.(), 0);
    }
  }, [visible]);

  const normalizedChildren = useMemo(
    () =>
      React.Children.toArray(children).map((child, index) => {
        if (typeof child === 'string' || typeof child === 'number') {
          return (
            <Text key={`bs-text-${index}`} accessibilityRole="text">
              {child}
            </Text>
          );
        }
        return child;
      }),
    [children],
  );

  const handleDismiss = () => {
    if (dismissBehavior === 'pan') {
      onClose();
      return;
    }

    // Native hosts block the gesture before dismissal. Keep the web fallback
    // presented if its underlying library still reports a dismissal.
    setPresentationEpoch((epoch) => epoch + 1);
  };

  const nativeContentWidth =
    Platform.OS === 'web'
      ? undefined
      : getNativeBottomSheetContentWidth(viewportWidth, Platform.OS === 'ios' ? 'ios' : 'android');
  const fillsViewport =
    snapPoints?.some(
      (snapPoint) =>
        snapPoint === 'full' ||
        (typeof snapPoint === 'object' && 'fraction' in snapPoint && snapPoint.fraction >= 1),
    ) ?? false;

  return (
    <BottomSheetSurface
      key={`${testID ?? 'bottom-sheet'}-${presentationEpoch}`}
      isPresented={visible}
      dismissible={dismissBehavior === 'pan'}
      scrimColor={backdropColor}
      containerColor={surfaceColor}
      onDismiss={handleDismiss}
      showDragIndicator={showDragIndicator && dismissBehavior === 'pan'}
      snapPoints={snapPoints}
      testID={testID}
    >
      <RNHostView matchContents={!fillsViewport}>
        <View
          accessibilityViewIsModal
          style={[
            { maxHeight: maximumHeight },
            fillsViewport && { flex: 1 },
            nativeContentWidth != null && { width: nativeContentWidth },
          ]}
        >
          {scrollable ? (
            <ScrollView
              style={{ flexShrink: 1 }}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            >
              <View
                className={['bg-ink-solid px-6 pt-2 pb-6', className].filter(Boolean).join(' ')}
                style={style}
              >
                {normalizedChildren}
              </View>
            </ScrollView>
          ) : (
            <View
              className={['bg-ink-solid px-6 pt-2 pb-6', className, fillsViewport ? 'flex-1' : undefined]
                .filter(Boolean)
                .join(' ')}
              style={[{ maxHeight: maximumHeight }, style]}
            >
              {normalizedChildren}
            </View>
          )}
        </View>
      </RNHostView>
    </BottomSheetSurface>
  );
}
