import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  findNodeHandle,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type LayoutChangeEvent,
  type TextStyle,
  type ViewStyle,
  type ScrollViewInstance,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';

import { BottomSheet, getBottomSheetMaximumHeight, type BottomSheetProps } from './BottomSheet';
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

/** Read by assistive technology, never drawn. */
const VISUALLY_HIDDEN: TextStyle = { position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' };

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
  /** Re-focus the heading, and return to the top, when an in-sheet chapter changes. */
  focusKey?: string;
  /** Optional decorative icon above the title */
  headerIcon?: BottomSheetActionIcon;
  /** Optional subtitle text below title */
  subtitle?: string;
  /** Optional custom body content between subtitle and actions */
  children?: React.ReactNode;
  /** Optional footer actions; informational sheets can use a close button instead. */
  actions?: StandardBottomSheetActions;
  /** A custom fixed footer, used instead of `actions` when the footer has its own timing. */
  footer?: React.ReactNode;
  /**
   * Shown in the close-button row in place of the visible title. The title stays the
   * sheet's accessible heading and focus target.
   */
  headerContent?: React.ReactNode;
  /** A decorative layer painted behind the whole sheet content (artwork, never controls). */
  background?: React.ReactNode;
  /** The close icon's colour when `background` sets its own ground. */
  closeIconColor?: string;
  /** Optional fixed top-right close control, with a localized accessibility label. */
  closeButton?: { label: string; testID?: string };
  /** Optional top-left back control, beside `closeButton`, for a sheet that moved to another page. */
  backButton?: { label: string; onPress: () => void; testID?: string };
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
  /**
   * Told the height the body can take before it scrolls: the tallest sheet in this window less
   * the header, the footer and the margins. A body can then give up what it can spare, so its
   * end does not hide under the footer.
   */
  onBodyRoom?: (room: number) => void;
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
  footer,
  headerContent,
  background,
  closeIconColor,
  closeButton,
  backButton,
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
  onBodyRoom,
}: StandardBottomSheetProps) {
  const { colors, mode, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const titleRef = useRef<ViewInstance | null>(null);
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const { height: viewportHeight } = useWindowDimensions();
  // Safe-area inset and the theme shadow are runtime values, not classes. On iOS the platform
  // sheet already holds its content above the home indicator and draws its own edge: there the
  // inset would count twice, and the shadow would mark a seam on the sheet wherever the content
  // stops short of it (the iPhone Duo's status bar column).
  const paddingBottom = (process.env.EXPO_OS === 'ios' ? 0 : insets.bottom) + ThemeLayout.spacing.md;
  // What sits above and below the body. Neither depends on the body, so a body sized from its
  // room never moves the room.
  const [chrome, setChrome] = useState<{ top: number | null; footer: number }>({ top: null, footer: 0 });
  const bodyRoom = onBodyRoom && chrome.top !== null
    ? getBottomSheetMaximumHeight(viewportHeight, insets) - paddingBottom - chrome.top - chrome.footer
    : null;
  useEffect(() => {
    if (bodyRoom !== null) onBodyRoom?.(bodyRoom);
  }, [bodyRoom, onBodyRoom]);

  useEffect(() => {
    if (!visible) return;
    // A new chapter starts at its top, not where the reader left the previous one.
    scrollRef.current?.scrollTo({ y: 0, animated: false });
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

  const measureBodyTop = onBodyRoom ? (event: LayoutChangeEvent) => {
    const top = event.nativeEvent?.layout?.y;
    if (top !== undefined) setChrome((current) => (current.top === top ? current : { ...current, top }));
  } : undefined;
  const body = (
    <>
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
        className="mb-2 text-center font-sans-bold text-h2 text-ivory"
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
    </>
  );

  // Actions remain outside the scrollable content.
  const footerContent = footer ?? (actions ? (
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
  ) : null);

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
      style={[{ paddingBottom }, !transparentContent && process.env.EXPO_OS !== 'ios' && shadows.xl, style]}
      testID={testID}
    >
      {background ? <View accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none" style={StyleSheet.absoluteFill}>
        {background}
      </View> : null}
      {dragIndicatorColor ? <View accessible={false} pointerEvents="none" style={{ height: 16, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 48, height: 4, borderRadius: 2, backgroundColor: dragIndicatorColor }} />
      </View> : null}
      {closeButton ? (
        <View className="mb-2 min-h-12 flex-row items-center">
          {backButton ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={backButton.label}
              onPress={backButton.onPress}
              className="h-12 w-12 items-center justify-center rounded-full"
              testID={backButton.testID}
            >
              <IconSymbol name="chevron.left" size={22} color={closeIconColor ?? colors.textPrimary} />
            </Pressable>
          ) : <View accessible={false} className="w-12" />}
          {headerContent ? (
            <View className="flex-1 items-center justify-center">
              <Text
                ref={titleRef}
                {...(process.env.EXPO_OS === 'web' ? { tabIndex: -1 as const } : {})}
                accessible
                accessibilityRole="header"
                style={[webTitleFocusResetStyle, VISUALLY_HIDDEN]}
                testID={titleTestID}
              >
                {title}
              </Text>
              {headerContent}
            </View>
          ) : <Text
            ref={titleRef}
            {...(process.env.EXPO_OS === 'web' ? { tabIndex: -1 as const } : {})}
            accessible
            accessibilityRole="header"
            className="flex-1 text-center font-sans-bold text-h2 text-ivory"
            style={webTitleFocusResetStyle}
            testID={titleTestID}
          >
            {title}
          </Text>}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={closeButton.label}
            onPress={onClose}
            disabled={actions?.primaryLoading}
            className="h-12 w-12 items-center justify-center rounded-full"
            testID={closeButton.testID}
          >
            <IconSymbol name="xmark" size={22} color={closeIconColor ?? colors.textPrimary} />
          </Pressable>
        </View>
      ) : null}
      {bodyScrollEnabled ? (
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={showsVerticalScrollIndicator} style={{ flexShrink: 1 }} nestedScrollEnabled keyboardShouldPersistTaps="handled" onLayout={measureBodyTop}>
          {body}
        </ScrollView>
      ) : (
        // A body that scrolls on its own needs a height it can share, which a scroll view's content
        // never has: its scroller would keep its full height and run under the footer. It still
        // grows as the scroll view did, so a full-height sheet keeps its footer at the bottom.
        <View style={{ flexGrow: 1, flexShrink: 1, minHeight: 0 }} onLayout={measureBodyTop}>
          {body}
        </View>
      )}

      {onBodyRoom && footerContent ? (
        <View onLayout={(event: LayoutChangeEvent) => {
          const height = event.nativeEvent?.layout?.height;
          if (height !== undefined) setChrome((current) => (current.footer === height ? current : { ...current, footer: height }));
        }}>
          {footerContent}
        </View>
      ) : footerContent}
    </BottomSheet>
  );
}

export default StandardBottomSheet;
