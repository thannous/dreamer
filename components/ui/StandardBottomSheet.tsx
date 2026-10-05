import React, { useEffect, useMemo, useRef } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
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
  /** Re-focus the heading when an in-sheet chapter changes. */
  focusKey?: string;
  /** Optional decorative icon above the title */
  headerIcon?: BottomSheetActionIcon;
  /** Optional subtitle text below title */
  subtitle?: string;
  /** Optional custom body content between subtitle and actions */
  children?: React.ReactNode;
  /** Optional footer actions; informational sheets can use a close button instead. */
  actions?: StandardBottomSheetActions;
  /** Optional fixed top-right close control, with a localized accessibility label. */
  closeButton?: { label: string; testID?: string };
  /** Optional opaque color for the platform host. */
  surfaceColor?: BottomSheetProps['surfaceColor'];
  /** Use the host's surface without a second content background or shadow. */
  transparentContent?: BottomSheetProps['transparentContent'];
  /** Test ID for E2E testing */
  testID?: string;
  /** Test ID for title text */
  titleTestID?: string;
  /** Additional style for the sheet container */
  style?: StyleProp<ViewStyle>;
  /** Optional native sheet heights. Omit to keep content-sized behavior. */
  snapPoints?: BottomSheetProps['snapPoints'];
  /** Existing nested scrollers can retain their own keyboard and inset behavior. */
  bodyScrollEnabled?: boolean;
  /** Replace the platform handle when its default contrast does not suit the surface. */
  dragIndicatorColor?: string;
  showsVerticalScrollIndicator?: boolean;
  dismissBehavior?: BottomSheetProps['dismissBehavior'];
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
  focusKey,
  headerIcon,
  subtitle,
  children,
  actions,
  closeButton,
  surfaceColor,
  transparentContent = false,
  testID,
  titleTestID,
  style,
  snapPoints,
  bodyScrollEnabled = true,
  dragIndicatorColor,
  showsVerticalScrollIndicator = true,
  dismissBehavior,
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
  }, [visible, focusKey]);

  const backdropColor = noctalia.surface.overlay;

  const primaryState: BottomSheetActionState = actions?.primaryLoading
    ? 'loading'
    : actions?.primaryDisabled
      ? 'disabled'
      : 'enabled';

  const secondaryState: Exclude<BottomSheetActionState, 'loading'> = actions?.secondaryDisabled
    ? 'disabled'
    : 'enabled';

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      backdropColor={backdropColor}
      surfaceColor={surfaceColor}
      transparentContent={transparentContent}
      snapPoints={snapPoints}
      scrollable={false}
      showDragIndicator={!dragIndicatorColor}
      dismissBehavior={dismissBehavior ?? (actions?.primaryLoading ? 'none' : 'pan')}
      className="px-6 pt-2"
      style={[
        // Safe-area inset and the theme shadow are runtime values, not classes.
        { paddingBottom: insets.bottom + ThemeLayout.spacing.md },
        !transparentContent && shadows.xl,
        style,
      ]}
      testID={testID}
    >
      {dragIndicatorColor ? <View accessible={false} pointerEvents="none" style={{ height: 16, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 48, height: 4, borderRadius: 2, backgroundColor: dragIndicatorColor }} />
      </View> : null}
      {closeButton ? (
        <View className="mb-2 min-h-12 flex-row items-center">
          <View accessible={false} className="w-12" />
          <Text
            ref={titleRef}
            {...(process.env.EXPO_OS === 'web' ? { tabIndex: -1 as const } : {})}
            accessible
            accessibilityRole="header"
            className="flex-1 text-center font-sans-bold text-[20px] text-ivory"
            style={webTitleFocusResetStyle}
            testID={titleTestID}
          >
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={closeButton.label}
            onPress={onClose}
            disabled={actions?.primaryLoading}
            className="h-12 w-12 items-center justify-center rounded-full"
            testID={closeButton.testID}
          >
            <IconSymbol name="xmark" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>
      ) : null}
      <ScrollView scrollEnabled={bodyScrollEnabled} showsVerticalScrollIndicator={showsVerticalScrollIndicator} style={{ flexShrink: 1 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">

      {/* Title */}
      {headerIcon ? (
        <View
          accessible={false}
          className="mb-4 h-14 w-14 items-center justify-center self-center rounded-artwork border-2 border-champagne-soft bg-ink-soft"
        >
          <IconSymbol name={headerIcon} size={32} color={noctalia.accent.soft} />
        </View>
      ) : null}

      {!closeButton ? <Text
        ref={titleRef}
        {...(process.env.EXPO_OS === 'web' ? { tabIndex: -1 as const } : {})}
        accessible
        accessibilityRole="header"
        className="mb-2 text-center font-sans-bold text-[20px] text-ivory"
        style={webTitleFocusResetStyle}
        testID={titleTestID}
      >
        {title}
      </Text> : null}

      {/* Subtitle */}
      {subtitle ? (
        <Text className="mb-6 text-center font-sans text-body-sm text-ivory-muted">
          {subtitle}
        </Text>
      ) : null}

      {/* Optional custom body content */}
      {children}

      </ScrollView>

      {/* Actions remain outside the scrollable content. */}
      {actions ? <BottomSheetActions>
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
      </BottomSheetActions> : null}
    </BottomSheet>
  );
}

export default StandardBottomSheet;
