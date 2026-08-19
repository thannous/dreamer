import { BottomSheet as ExpoBottomSheet, RNHostView } from '@expo/ui';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

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
  /** Test ID for E2E testing. */
  testID?: string;
  /** How users can dismiss the sheet by gesture (default: 'pan'). */
  dismissBehavior?: 'pan' | 'none';
  /** Optional native sheet heights. Omit to keep content-sized behavior. */
  snapPoints?: React.ComponentProps<typeof ExpoBottomSheet>['snapPoints'];
};

const NATIVE_SHEET_HORIZONTAL_INSET = 16;
const IOS_SHEET_MAX_WIDTH = 540;
const ANDROID_SHEET_MAX_WIDTH = 640;

export function getNativeBottomSheetContentWidth(
  viewportWidth: number,
  platform: 'android' | 'ios'
) {
  const sheetMaxWidth = platform === 'ios' ? IOS_SHEET_MAX_WIDTH : ANDROID_SHEET_MAX_WIDTH;
  return Math.max(
    0,
    Math.min(viewportWidth, sheetMaxWidth) - NATIVE_SHEET_HORIZONTAL_INSET * 2
  );
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
  backdropColor: _backdropColor,
  testID,
  dismissBehavior = 'pan',
  snapPoints,
}: BottomSheetProps) {
  const { width: viewportWidth } = useWindowDimensions();
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
    [children]
  );

  const handleDismiss = () => {
    if (dismissBehavior === 'pan') {
      onClose();
      return;
    }

    // Expo UI does not expose an interactive-dismiss switch on its universal
    // sheet. Remounting with the controlled `visible` value still true restores
    // the non-dismissible behavior expected by existing callers on every host.
    setPresentationEpoch((epoch) => epoch + 1);
  };

  const nativeContentWidth = Platform.OS === 'web'
    ? undefined
    : getNativeBottomSheetContentWidth(
        viewportWidth,
        Platform.OS === 'ios' ? 'ios' : 'android'
      );
  const fillsViewport = snapPoints?.some((snapPoint) =>
    snapPoint === 'full' || (
      typeof snapPoint === 'object' &&
      'fraction' in snapPoint &&
      snapPoint.fraction >= 1
    )
  ) ?? false;

  return (
    <ExpoBottomSheet
      key={`${testID ?? 'bottom-sheet'}-${presentationEpoch}`}
      isPresented={visible}
      onDismiss={handleDismiss}
      showDragIndicator={false}
      snapPoints={snapPoints}
      testID={testID}
    >
      <RNHostView matchContents={!fillsViewport}>
        <View
          accessibilityViewIsModal
          className={[
            'w-full self-stretch rounded-t-artwork border-line border-t bg-ink-raised px-6 py-7',
            className,
            fillsViewport ? 'flex-1' : undefined,
          ]
            .filter(Boolean)
            .join(' ')}
          style={[style, nativeContentWidth != null && { width: nativeContentWidth }]}
        >
          {normalizedChildren}
        </View>
      </RNHostView>
    </ExpoBottomSheet>
  );
}

