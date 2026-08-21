import React, { useEffect, useMemo, useRef } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';

import { BottomSheet, type BottomSheetProps } from './BottomSheet';
import {
  BottomSheetActions,
  BottomSheetLinkAction,
  BottomSheetPrimaryAction,
  BottomSheetSecondaryAction,
  type BottomSheetActionIcon,
  type BottomSheetActionState,
} from './BottomSheetActions';

const webTitleFocusResetStyle: TextStyle | null = process.env.EXPO_OS === 'web'
  ? ({
      outlineColor: 'transparent',
      outlineStyle: 'none',
      outlineWidth: 0,
    } as unknown as TextStyle)
  : null;

export type StandardBottomSheetActions = {
  primaryLabel: string;
  primaryDetail?: string;
  primaryIcon?: BottomSheetActionIcon;
  primaryTrailingIcon?: BottomSheetActionIcon;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  primaryTestID?: string;
  primaryVariant?: 'accent' | 'danger';

  secondaryLabel?: string;
  secondaryDetail?: string;
  secondaryIcon?: BottomSheetActionIcon;
  secondaryTrailingIcon?: BottomSheetActionIcon;
  onSecondary?: () => void;
  secondaryDisabled?: boolean;
  secondaryTestID?: string;

  linkLabel?: string;
  onLink?: () => void;
  linkTestID?: string;
  supportingContent?: React.ReactNode;
};

export type StandardBottomSheetProps = {
  /** Whether the sheet is visible */
  visible: boolean;
  /** Called when sheet should close (backdrop tap, etc.) */
  onClose: () => void;
  /** Main title text */
  title: string;
  /** Optional decorative icon above the title */
  headerIcon?: BottomSheetActionIcon;
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
  /** Optional native sheet heights. Omit to keep content-sized behavior. */
  snapPoints?: BottomSheetProps['snapPoints'];
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
  headerIcon,
  subtitle,
  children,
  actions,
  testID,
  titleTestID,
  style,
  snapPoints,
}: StandardBottomSheetProps) {
  const { colors, mode, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const titleRef = useRef<Text | null>(null);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      if (process.env.EXPO_OS === 'web') {
        titleRef.current?.focus();
        return;
      }

      const titleNode = findNodeHandle(titleRef.current);
      if (titleNode) AccessibilityInfo.setAccessibilityFocus(titleNode);
    }, 120);
    return () => clearTimeout(timer);
  }, [visible]);

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
      snapPoints={snapPoints}
      className="rounded-t-xl border-t border-line bg-ink-raised px-6 pt-1"
      style={[
        // Safe-area inset and the theme shadow are runtime values, not classes.
        { paddingBottom: insets.bottom + ThemeLayout.spacing.md },
        shadows.xl,
        style,
      ]}
      testID={testID}
    >
      {/* Handle indicator */}
      <View className="mb-4 h-1 w-9 self-center rounded-[2px] bg-line" />

      {/* Title */}
      {headerIcon ? (
        <View
          accessible={false}
          className="mb-4 h-14 w-14 items-center justify-center self-center rounded-artwork border-2 border-champagne-soft bg-ink-soft"
        >
          <IconSymbol name={headerIcon} size={32} color={noctalia.accent.soft} />
        </View>
      ) : null}

      <Text
        ref={titleRef}
        {...(process.env.EXPO_OS === 'web' ? { tabIndex: -1 as const } : {})}
        accessible
        accessibilityRole="header"
        className="mb-2 text-center font-sans-bold text-[20px] text-ivory"
        style={webTitleFocusResetStyle}
        testID={titleTestID}
      >
        {title}
      </Text>

      {/* Subtitle */}
      {subtitle ? (
        <Text className="mb-6 text-center font-sans text-body-sm text-ivory-muted">
          {subtitle}
        </Text>
      ) : null}

      {/* Optional custom body content */}
      {children}

      {/* Actions */}
      <BottomSheetActions>
        <BottomSheetPrimaryAction
          label={actions.primaryLabel}
          detail={actions.primaryDetail}
          leadingIcon={actions.primaryIcon}
          trailingIcon={actions.primaryTrailingIcon}
          onPress={actions.onPrimary}
          state={primaryState}
          testID={actions.primaryTestID}
          variant={actions.primaryVariant}
        />
        {actions.secondaryLabel && actions.onSecondary ? (
          <BottomSheetSecondaryAction
            label={actions.secondaryLabel}
            detail={actions.secondaryDetail}
            leadingIcon={actions.secondaryIcon}
            trailingIcon={actions.secondaryTrailingIcon}
            onPress={actions.onSecondary}
            state={secondaryState}
            testID={actions.secondaryTestID}
          />
        ) : null}
        {actions.supportingContent}
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

export default StandardBottomSheet;
