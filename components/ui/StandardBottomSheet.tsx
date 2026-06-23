import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

import { BottomSheet } from './BottomSheet';
import {
  BottomSheetActions,
  BottomSheetLinkAction,
  BottomSheetPrimaryAction,
  BottomSheetSecondaryAction,
  type BottomSheetActionState,
} from './BottomSheetActions';

export type StandardBottomSheetActions = {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  primaryTestID?: string;
  primaryVariant?: 'accent' | 'danger';

  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryDisabled?: boolean;
  secondaryTestID?: string;

  linkLabel?: string;
  onLink?: () => void;
  linkTestID?: string;
};

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
  actions: StandardBottomSheetActions;
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
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

  const backdropColor = noctalia.surface.overlay;

  const primaryState: BottomSheetActionState = actions.primaryLoading
    ? 'loading'
    : actions.primaryDisabled
      ? 'disabled'
      : 'enabled';

  const secondaryState: Exclude<BottomSheetActionState, 'loading'> = actions.secondaryDisabled
    ? 'disabled'
    : 'enabled';

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      backdropColor={backdropColor}
      style={[
        styles.sheet,
        {
          backgroundColor: noctalia.surface.raised,
          paddingBottom: insets.bottom + ThemeLayout.spacing.md,
          borderColor: noctalia.surface.border,
        },
        shadows.xl,
        style,
      ]}
      testID={testID}
    >
      {/* Handle indicator */}
      <View style={[styles.handle, { backgroundColor: noctalia.surface.border }]} />

      {/* Title */}
      <Text
        style={[styles.title, { color: noctalia.text.primary }]}
        testID={titleTestID}
      >
        {title}
      </Text>

      {/* Subtitle */}
      {subtitle ? (
        <Text style={[styles.subtitle, { color: noctalia.text.secondary }]}>
          {subtitle}
        </Text>
      ) : null}

      {/* Optional custom body content */}
      {children}

      {/* Actions */}
      <BottomSheetActions>
        <BottomSheetPrimaryAction
          label={actions.primaryLabel}
          onPress={actions.onPrimary}
          state={primaryState}
          testID={actions.primaryTestID}
          variant={actions.primaryVariant}
        />
        {actions.secondaryLabel && actions.onSecondary ? (
          <BottomSheetSecondaryAction
            label={actions.secondaryLabel}
            onPress={actions.onSecondary}
            state={secondaryState}
            testID={actions.secondaryTestID}
          />
        ) : null}
        {actions.linkLabel && actions.onLink ? (
          <BottomSheetLinkAction
            label={actions.linkLabel}
            onPress={actions.onLink}
            testID={actions.linkTestID}
          />
        ) : null}
      </BottomSheetActions>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: ThemeLayout.borderRadius.xl,
    borderTopRightRadius: ThemeLayout.borderRadius.xl,
    borderTopWidth: 1,
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
