import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

import { BottomSheet } from './BottomSheet';
import { BottomSheetActions, type BottomSheetActionsProps } from './BottomSheetActions';

export type StandardBottomSheetProps = {
  /** Whether the sheet is visible */
  visible: boolean;
  /** Called when sheet should close (backdrop tap, etc.) */
  onClose: () => void;
  /** Main title text */
  title: string;
  /** Optional subtitle text below title */
  subtitle?: string;
  /** Optional custom body content between subtitle and actions */
  children?: React.ReactNode;
  /** Actions configuration - passed to BottomSheetActions */
  actions: BottomSheetActionsProps;
  /** Test ID for E2E testing */
  testID?: string;
  /** Test ID for title text */
  titleTestID?: string;
  /** Additional style for the sheet container */
  style?: StyleProp<ViewStyle>;
};

/**
 * Standardized bottom sheet with consistent styling.
 *
 * Provides:
 * - Theme-aware backdrop color
 * - Handle indicator
 * - Consistent title/subtitle styling
 * - Safe area padding
 * - Shadow styling
 *
 * Usage:
 * ```tsx
 * <StandardBottomSheet
 *   visible={isVisible}
 *   onClose={() => setIsVisible(false)}
 *   title="Confirm Action"
 *   subtitle="Are you sure you want to proceed?"
 *   actions={{
 *     primaryLabel: "Confirm",
 *     onPrimary: handleConfirm,
 *     secondaryLabel: "Cancel",
 *     onSecondary: handleCancel,
 *   }}
 * />
 * ```
 */
export function StandardBottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  actions,
  testID,
  titleTestID,
  style,
}: StandardBottomSheetProps) {
  const { colors, mode, shadows } = useTheme();
  const insets = useSafeAreaInsets();

  // Consistent backdrop color based on theme
  const backdropColor = mode === 'dark'
    ? 'rgba(2, 0, 12, 0.75)'
    : 'rgba(0, 0, 0, 0.25)';

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      backdropColor={backdropColor}
      style={[
        styles.sheet,
        {
          backgroundColor: colors.backgroundCard,
          paddingBottom: insets.bottom + ThemeLayout.spacing.md,
        },
        shadows.xl,
        style,
      ]}
      testID={testID}
    >
      {/* Handle indicator */}
      <View style={[styles.handle, { backgroundColor: colors.divider }]} />

      {/* Title */}
      <Text
        style={[styles.title, { color: colors.textPrimary }]}
        testID={titleTestID}
      >
        {title}
      </Text>

      {/* Subtitle */}
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>
      ) : null}

      {/* Optional custom body content */}
      {children}

      {/* Actions */}
      <BottomSheetActions {...actions} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: ThemeLayout.borderRadius.xl,
    borderTopRightRadius: ThemeLayout.borderRadius.xl,
    paddingTop: ThemeLayout.spacing.xs,
    paddingHorizontal: ThemeLayout.spacing.lg,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: ThemeLayout.spacing.md,
  },
  title: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 20,
    textAlign: 'center',
    marginBottom: ThemeLayout.spacing.sm,
  },
  subtitle: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: ThemeLayout.spacing.lg,
  },
});

export default StandardBottomSheet;
