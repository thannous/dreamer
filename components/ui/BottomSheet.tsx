import { BottomSheet as ExpoBottomSheet, RNHostView } from '@expo/ui';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { blurActiveElement } from '@/lib/accessibility';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional style override for the React Native sheet content. */
  style?: StyleProp<ViewStyle>;
  /**
   * Kept for API compatibility. Expo UI owns the native/Vaul backdrop.
   */
  backdropColor?: string;
  /** Test ID for E2E testing. */
  testID?: string;
  /** How users can dismiss the sheet by gesture (default: 'pan'). */
  dismissBehavior?: 'pan' | 'none';
};

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
  backdropColor: _backdropColor,
  testID,
  dismissBehavior = 'pan',
}: BottomSheetProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
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

  return (
    <ExpoBottomSheet
      key={`${testID ?? 'bottom-sheet'}-${presentationEpoch}`}
      isPresented={visible}
      onDismiss={handleDismiss}
      showDragIndicator={false}
      testID={testID}
    >
      <RNHostView matchContents>
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: noctalia.surface.raised,
              borderColor: noctalia.surface.border,
            },
            style,
          ]}
        >
          {normalizedChildren}
        </View>
      </RNHostView>
    </ExpoBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    width: '100%',
    alignSelf: 'stretch',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
});
